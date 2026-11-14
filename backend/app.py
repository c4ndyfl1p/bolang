"""
BoLang backend.

The extension POSTs the visible text of a page plus the user's settings. We:
  1. find the most frequent nouns / verbs / prepositions with spaCy,
  2. translate them with DeepL (using a cache so repeated words cost nothing),
  3. return {"nouns": {...}, "verbs": {...}, "prepositions": {...}}.

Run locally:   flask --app app run --debug        (from the backend/ folder)
Run in prod:   gunicorn -c gunicorn.conf.py app:app
"""

import hmac
import logging
import os
from collections import Counter, OrderedDict

import requests
import spacy
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.middleware.proxy_fix import ProxyFix

# ---------------------------------------------------------------------------
# Configuration (all from environment variables, so nothing secret is in code)
# ---------------------------------------------------------------------------
load_dotenv()  # in development, read backend/.env; in production the host sets real env vars

DEEPL_API_KEY = os.getenv("DEEPL_API_KEY")
if not DEEPL_API_KEY:
    raise RuntimeError("DEEPL_API_KEY is not set (put it in backend/.env locally, or in your host's settings)")

# Free keys (ending in ":fx") use api-free.deepl.com; Pro keys use api.deepl.com
DEEPL_URL = os.getenv(
    "DEEPL_URL",
    "https://api-free.deepl.com/v2/translate" if DEEPL_API_KEY.endswith(":fx") else "https://api.deepl.com/v2/translate",
)

# How many requests one user (IP address) may make. Protects the shared DeepL quota.
RATE_LIMIT = os.getenv("RATE_LIMIT", "20 per minute;300 per day")

def parse_invite_codes(raw):
    """INVITE_CODES looks like "maria:K7PX-29QD,jonas:M3RT-8WHA". Returns {code: name}."""
    codes = {}
    for entry in filter(None, (e.strip() for e in raw.split(","))):
        name, sep, code = entry.partition(":")
        if not sep or not name.strip() or not code.strip():
            raise RuntimeError(f"Bad INVITE_CODES entry {entry!r}; expected name:CODE")
        codes[code.strip().upper()] = name.strip()
    return codes


# Who may use the server. Empty (not set) = no check, which is handy for local development.
INVITE_CODES = parse_invite_codes(os.getenv("INVITE_CODES", ""))

SUPPORTED_TARGET_LANGUAGES = {"DA", "DE", "ES", "FR", "IT", "PL"}
MAX_TEXT_CHARS = 100_000              # longer pages are cut off: plenty to find frequent words
AMOUNT_TO_WORD_COUNT = {0: 0, 1: 5, 2: 30}  # Off / Some / Lots
CACHE_MAX_ENTRIES = 50_000

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("bolang")

if INVITE_CODES:
    log.info("invite codes enabled for %d people", len(INVITE_CODES))
else:
    log.warning("INVITE_CODES is not set: anyone can use this server (fine locally, not in production)")

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 1 * 1024 * 1024  # reject request bodies over 1 MB outright

# Hosting platforms put a proxy (load balancer) in front of the app, so request.remote_addr would be
# the proxy's IP for everyone. ProxyFix trusts ONE X-Forwarded-For hop and recovers the real client IP,
# which the rate limiter needs. Only enable it when actually behind a proxy (we set TRUST_PROXY=1 on Render),
# otherwise anyone could fake their IP by sending that header.
if os.getenv("TRUST_PROXY") == "1":
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)

# CORS: the request comes from a content script, which browsers treat as coming from the *web page's*
# origin (any website). So we can't restrict origins here. CORS is a browser rule, not security:
# the rate limit and input validation are what protect the server.
CORS(app)

# ---------------------------------------------------------------------------
# Invite codes (authentication: "who is making this request?")
# ---------------------------------------------------------------------------
OPEN_ACCESS = "(open)"  # returned when no invite codes are configured


def current_user():
    """Name of the person whose invite code is on this request, OPEN_ACCESS, or None if invalid/missing.

    The code arrives in the standard header:  Authorization: Bearer K7PX-29QD
    """
    if not INVITE_CODES:
        return OPEN_ACCESS
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    sent = header.removeprefix("Bearer ").strip().upper().encode()
    for code, name in INVITE_CODES.items():
        # compare_digest takes the same time whether the first or last character is wrong, so an attacker
        # can't guess a code one character at a time by measuring response times ("timing attack").
        if hmac.compare_digest(sent, code.encode()):
            return name
    return None


def rate_limit_key():
    """Count requests per invite code when there is a valid one, otherwise per IP address.
    So one friend can't use up everyone's share, and code-guessers are limited by IP."""
    user = current_user()
    if user and user != OPEN_ACCESS:
        return f"user:{user}"
    return f"ip:{get_remote_address()}"


# Rate limiting, stored in memory. Fine for a single server process; with several servers you'd use Redis.
limiter = Limiter(rate_limit_key, app=app, storage_uri="memory://")

# spaCy: we only need part-of-speech tags, so skip the dependency parser and named-entity
# recognition. That makes it faster and uses less memory (important on a 512 MB free server).
nlp = spacy.load("en_core_web_sm", disable=["parser", "ner", "lemmatizer"])
nlp.max_length = MAX_TEXT_CHARS + 1000

# ---------------------------------------------------------------------------
# Translation with a cache
# ---------------------------------------------------------------------------
class LRUCache:
    """A dict that forgets the least-recently-used entry when it gets too big, so memory stays bounded."""

    def __init__(self, max_entries):
        self.max_entries = max_entries
        self.data = OrderedDict()

    def get(self, key):
        if key in self.data:
            self.data.move_to_end(key)
            return self.data[key]
        return None

    def set(self, key, value):
        self.data[key] = value
        self.data.move_to_end(key)
        if len(self.data) > self.max_entries:
            self.data.popitem(last=False)


# Key: (target language, english word) -> translated word.
# Lives in memory: it's lost when the server restarts or sleeps, which is fine for a cache.
translation_cache = LRUCache(CACHE_MAX_ENTRIES)


class TranslationError(Exception):
    pass


def translate_words(words, target_lang):
    """Translate a list of English words. Cached words are free; the rest go to DeepL in one request."""
    result = {}
    missing = []
    for word in words:
        cached = translation_cache.get((target_lang, word))
        if cached is not None:
            result[word] = cached
        else:
            missing.append(word)

    if missing:
        try:
            response = requests.post(
                DEEPL_URL,
                headers={"Authorization": f"DeepL-Auth-Key {DEEPL_API_KEY}"},
                data={"source_lang": "EN", "target_lang": target_lang, "text": missing},
                timeout=10,
            )
            response.raise_for_status()
        except requests.RequestException as e:
            status = getattr(e.response, "status_code", None)
            log.error("DeepL request failed (status %s): %s", status, e)
            if status == 456:  # DeepL's "quota exceeded" status
                raise TranslationError("The monthly translation quota has run out. Try again next month.")
            raise TranslationError("The translation service is unavailable right now.")

        for word, entry in zip(missing, response.json()["translations"]):
            result[word] = entry["text"]
            translation_cache.set((target_lang, word), entry["text"])

    log.info("translated %d words (%d from cache, %d via DeepL)", len(words), len(words) - len(missing), len(missing))
    return result


def top_words(doc, pos_tag, count):
    words = [t.text.lower() for t in doc if t.pos_ == pos_tag and t.is_alpha]
    return [word for word, _ in Counter(words).most_common(count)]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/healthz")
@limiter.exempt
def healthz():
    """Hosting platforms call this to check the server is up."""
    return {"status": "ok"}


@app.post("/replacements")
@limiter.limit(RATE_LIMIT)
def replacements():
    user = current_user()
    if user is None:
        # 401 Unauthorized = "I don't know who you are". Checked before any expensive work.
        return jsonify(error="Invite code missing or not valid."), 401

    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify(error="Expected a JSON body."), 400

    # --- validate input: never trust what a client sends ---
    text = body.get("text")
    if not isinstance(text, str) or not text.strip():
        return jsonify(error="No page text was sent."), 400
    text = text[:MAX_TEXT_CHARS]

    target_lang = str(body.get("targetLanguage", "")).upper()
    if target_lang not in SUPPORTED_TARGET_LANGUAGES:
        return jsonify(error=f"Unsupported language: {target_lang!r}"), 400

    try:
        counts = {
            pos: AMOUNT_TO_WORD_COUNT[int(body.get(key, 1))]
            for pos, key in [("nouns", "nounSliderValue"), ("verbs", "verbSliderValue"), ("prepositions", "prepositionSliderValue")]
        }
    except (ValueError, KeyError, TypeError):
        return jsonify(error="Amounts must be 0, 1 or 2."), 400

    # --- find the most frequent words of each kind ---
    doc = nlp(text)
    picked = {
        "nouns": top_words(doc, "NOUN", counts["nouns"]),
        "verbs": top_words(doc, "VERB", counts["verbs"]),
        "prepositions": top_words(doc, "ADP", counts["prepositions"]),  # ADP = adposition (prepositions)
    }

    # --- translate them all in one go ---
    all_words = sorted({w for words in picked.values() for w in words})
    try:
        translations = translate_words(all_words, target_lang)
    except TranslationError as e:
        return jsonify(error=str(e)), 502  # 502 = "a service we depend on failed"

    # Note: we deliberately don't log the page text or URL; it's the user's private browsing data.
    log.info("replacements for %s: %d chars -> %s", user, len(text), {pos: len(ws) for pos, ws in picked.items()})
    return jsonify({pos: {w: translations[w] for w in words if w in translations} for pos, words in picked.items()})


@app.errorhandler(429)
def too_many_requests(e):
    return jsonify(error="Too many requests. Please wait a minute and try again."), 429


@app.errorhandler(413)
def too_large(e):
    return jsonify(error="The page is too large to translate."), 413


if __name__ == "__main__":
    app.run(debug=True)
