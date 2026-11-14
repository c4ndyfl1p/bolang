# बोलLang (BoLang)

**Learn a new language naturally while browsing the web.**

BoLang is a browser extension that quietly swaps some of the English words on the page you're reading for words in the language you're learning. You keep reading as usual, and you pick up vocabulary along the way. Hover over a highlighted word to see the original English.

## Why

Most language tools (Duolingo, Babbel, flashcards, Google Translate) need you to stop what you're doing and study. That makes the language hard to fit into your day, and progress is slow when practice is irregular.

BoLang is based on Stephen Krashen's theory of language acquisition, in particular the *Input Hypothesis*: people acquire a language best through lots of **comprehensible input** that they mostly understand. Swapping a few words in text you already understand gives you that input in a real context, without interrupting your reading.

A small user survey from the project found:

- 80% found passive, in-context learning very helpful compared with traditional tools.
- Over 70% wanted to choose which kinds of words get translated (nouns, verbs, and so on).
- 90% were interested in trying or recommending the extension.

## Features

- **Target language:** Danish, Spanish, French, German, Italian or Polish.
- **Separate amount controls for nouns, verbs and prepositions.** Each is Off / Some / Lots, which is about 0, 5 or 30 of the most frequent words of that type on the page.
- **Quiet colour coding:** translated words get a thin underline: saffron for nouns, teal for verbs and violet for prepositions. Hover one to see a small card with the English word and its part of speech.
- **Translate on demand:** click **Translate this page** in the popup to translate the page you're on, and **Show original** to undo it. The extension only touches a page when you click.

## How it works

```
 popup.js ──settings──▶ chrome.storage
                              │
 content.js (injected into the current tab when you click "Translate this page")
   │  POST /replacements  {"text": <visible page text>, "targetLanguage": "DA", "nounSliderValue": 1, ...}
   ▼
 Flask backend (backend/app.py)
   1. validates the input and applies a per-IP rate limit
   2. tags parts of speech                 (spaCy, en_core_web_sm)
   3. picks the N most frequent nouns / verbs / prepositions
   4. translates them: cached words are free, the rest go to DeepL in one batch
   ▼
 { "nouns": {"water": "vand"}, "verbs": {...}, "prepositions": {...} }
   │
 content.js walks the page's text nodes and replaces matches with underlined <span>s
```

The extension sends the text you can see rather than the page's URL. That way the server never downloads arbitrary web pages (which would be an SSRF risk), logged-in pages work, and the server never learns which URL you're on.

An earlier version used an LLM for the translations. It was replaced with spaCy + DeepL because that is faster, cheaper and sends less data to third parties. The trade-off is that the translations don't take context into account.

## Repository layout

| Path | What it is |
|---|---|
| `chrome-extention/manifest.json` | Extension manifest (Manifest V3) |
| `chrome-extention/content.js` | Injected into the current tab on click. Calls the backend and replaces words in the page (and restores them) |
| `chrome-extention/popup.html` / `popup.js` / `popup.css` | The toolbar popup: language chips, Off/Some/Lots controls, Translate / Show original buttons. Follows the system's light/dark mode |
| `chrome-extention/icons/` | Extension icons (16/32/48/128 px PNGs) |
| `branding/` | Logo sources: `logo-source.svg` (editable, uses the Noto Sans Devanagari font), `logo.svg` (text converted to outlines), `logo-small.svg` (simplified 16px version) |
| `chrome-extention/popup2.*` | An older popup design. Not used |
| `backend/app.py` | The Flask server the extension talks to |
| `backend/requirements.txt` | Python dependencies, including the spaCy English model |
| `backend/gunicorn.conf.py` | Production server settings |
| `backend/make_invite.py` | Generates invite codes (see [Invite codes](#invite-codes)) |
| `render.yaml` | Deployment config for Render (see [Deployment](#deployment)) |
| `PRIVACY.md` | Privacy policy (link to it from the store listings) |
| `docs/chrome-web-store.md` | Answers for the Chrome Web Store privacy form |
| `backend/server2.py` | Old test server with hardcoded Danish words. Not used |

---

## Development

You need two things running: the **backend** (a Python Flask server on `localhost:5000`) and the **extension** (loaded into Chrome unpacked, from source).

### Prerequisites

- Python 3.12 (3.10+ should work)
- Google Chrome or another Chromium browser (Edge, Brave), or Firefox (see [Firefox](#firefox))
- A **DeepL API key**. Sign up at <https://www.deepl.com/pro-api> and choose the *Free* plan (500,000 characters a month). The backend picks the right DeepL endpoint automatically for Free keys (ending in `:fx`) and Pro keys.

### 1. Set up the backend (one time)

From the repo root:

```bash
python3 -m venv .hcai
source .hcai/bin/activate            # fish: source .hcai/bin/activate.fish
pip install -r backend/requirements.txt   # also installs spaCy's English model
```

Create `backend/.env` containing your DeepL key:

```
DEEPL_API_KEY=your-key-here
```

`.env` is gitignored, so don't commit the key.

### 2. Run the backend

```bash
source .hcai/bin/activate
cd backend
flask run --debug    # serves on http://127.0.0.1:5000 and reloads when you edit app.py
```

Run it from inside `backend/`, because that's where `app.py` is.

Quick check that it works:

```bash
curl -X POST http://localhost:5000/replacements \
  -H 'Content-Type: application/json' \
  -d '{"text": "The cat drinks milk from a bowl in the kitchen.", "targetLanguage": "DA"}'
```

You should get JSON with `nouns`, `verbs` and `prepositions`. An `error` field tells you what went wrong, for example a bad DeepL key. More detail is in the server log.

To try the production server locally (the same way it runs when hosted): `gunicorn -c gunicorn.conf.py app:app`, from `backend/`. It listens on port 8000, or on `$PORT` if that's set.

> **macOS:** AirPlay Receiver uses port 5000. Turn it off in System Settings, or run on another port and update the port in both `content.js` and `manifest.json`.

### 3. Load the extension in Chrome

1. Go to `chrome://extensions`.
2. Switch on **Developer mode** (top right).
3. Click **Load unpacked** and pick the `chrome-extention/` folder.
4. Pin "BoLang" from the puzzle-piece menu. Open the popup, pick a language and click **Translate this page**.
5. Open or reload any English web page.

### Development loop

- **After editing `content.js` or `manifest.json`:** click the ↻ reload icon on the extension's card in `chrome://extensions`, then reload the web page you're testing on.
- **After editing popup files:** close and reopen the popup.
- **After editing `app.py`:** restart Flask, or have it reload automatically by running with `--debug`.
- **Logs:**
  - `content.js`: the DevTools console of the web page.
  - Popup: right-click the popup → *Inspect*.
  - Backend: the terminal running Flask.

### Configuration

- **Backend URL:** `BACKEND_URL` at the top of `content.js` and `host_permissions` in `manifest.json`. Both have to change when the backend is hosted somewhere else.
- **Backend settings** (environment variables, or `backend/.env` locally):

  | Variable | Default | What it does |
  |---|---|---|
  | `DEEPL_API_KEY` | (required) | Your DeepL key |
  | `RATE_LIMIT` | `20 per minute;300 per day` | Requests allowed per IP address ([syntax](https://flask-limiter.readthedocs.io/en/stable/configuration.html#rate-limit-string-notation)) |
  | `TRUST_PROXY` | off | Set to `1` only behind a load balancer (e.g. Render), so the real client IP is used for rate limiting |
  | `DEEPL_URL` | chosen from the key | Override the DeepL endpoint |
  | `INVITE_CODES` | not set (anyone can use the server) | Who may use the server: `name:CODE,name:CODE`. See [Invite codes](#invite-codes) |
- The Off/Some/Lots → word-count mapping (`0 → 0`, `1 → 5`, `2 → 30`) is `AMOUNT_TO_WORD_COUNT` in `backend/app.py`.

### Regenerating the icons

After editing `branding/logo-source.svg` (needs Inkscape and the Noto Sans Devanagari font):

```bash
cd branding
inkscape "$PWD/logo-source.svg" --export-text-to-path --export-plain-svg --export-filename="$PWD/logo.svg"
for s in 32 48 128; do inkscape "$PWD/logo.svg" -w $s -h $s -o "$PWD/../chrome-extention/icons/icon$s.png"; done
inkscape "$PWD/logo-small.svg" -w 16 -h 16 -o "$PWD/../chrome-extention/icons/icon16.png"
```

### Known issues / TODO

- **Pages that load content later** (infinite scroll, single-page apps) only get partly translated, because the replacement runs once per click. Click again to translate new content.
- Translations are single words with no context.
- The `.hcai/` virtualenv is committed to git. It should be removed from the repo with `git rm -r --cached .hcai` and added to `.gitignore`.

---

## Deployment

The backend is set up to run on [Render](https://render.com)'s free plan. `render.yaml` at the repo root describes the whole service: build command, start command, Python version and environment variables.

**First deploy:**

1. Push the repo to GitHub.
2. On Render: **New → Blueprint**, connect your GitHub account and pick this repo. Render reads `render.yaml`.
3. When asked for `DEEPL_API_KEY`, paste your key. For `INVITE_CODES`, paste the line from `make_invite.py` (see below). Both are stored as secrets on Render, never in the repo.
4. Wait for the build. The first one takes a few minutes because it installs spaCy. When it's done, the service shows a URL like `https://bolang-backend.onrender.com`.
5. Check it: open `https://<your-url>/healthz`. It should show `{"status": "ok"}`.
6. Point the extension at it: set `BACKEND_URL` in `content.js` to that URL, and change `host_permissions` in `manifest.json` to `"https://<your-url>/"`.

**After that:** every push to the main branch that changes something in `backend/` redeploys automatically. Logs are on the service's **Logs** tab.

### Invite codes

The hosted backend only serves people with an invite code, so strangers can't use up your DeepL allowance.

- **Make codes:** `python backend/make_invite.py maria jonas`. It prints a code per person and the line to paste into `INVITE_CODES` on Render (Dashboard → your service → **Environment**). Saving the variable redeploys the service.
- **Give a code to a friend:** they open the popup, click **Invite code** and paste it. It's saved in their browser.
- **Revoke a code:** remove that person's `name:CODE` entry from `INVITE_CODES`.
- **How it works:** the extension sends the code in an `Authorization: Bearer <code>` header. The server compares it against `INVITE_CODES` before doing any work and returns `401` if it doesn't match. Rate limits count per code, so one person can't use up everyone's share. Requests without a valid code are limited per IP address, which makes guessing codes hopeless.
- Locally, leave `INVITE_CODES` unset and no code is needed.

### Free-plan behaviour to know about

- The server **sleeps after 15 minutes without requests**. The next request wakes it, which takes about a minute, so the popup shows "Reading the page…" for a while.
- Memory is 512 MB. That's why gunicorn runs a single worker process (each one loads its own copy of spaCy) with 4 threads.
- The translation cache and rate-limit counters live in memory, so they reset whenever the server sleeps or redeploys.
- The DeepL Free plan allows 500,000 characters a month across all users. Once that's used up, the backend returns "The monthly translation quota has run out" until the next month.

---

## Firefox

Firefox supports Manifest V3 and the `chrome.*` API names, so the same code mostly works. To try it now:

1. Go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and pick `chrome-extention/manifest.json`.
3. Firefox doesn't grant `host_permissions` automatically in MV3. Go to `about:addons` → BoLang → *Permissions* and allow access to `localhost` and to websites.

Temporary add-ons are removed when Firefox restarts. To publish on addons.mozilla.org, the manifest also needs a `browser_specific_settings.gecko` block with an add-on `id` and a data-collection declaration.

## Roadmap

From the project's future-work plan:

- Host the backend on a cloud service, with HTTPS and caching (Redis or in-memory) for repeated words.
- Publish on the Chrome Web Store (and Firefox Add-ons): final manifest and permissions, branding, screenshots, privacy policy.
- Handle content that loads after the page does, and make page edits safer.
- Track progress per user and adapt to what they know: prioritize words they haven't learned yet.
- Gamification: quizzes, streaks, achievements.
- Context-aware translations, including synonyms and idioms.
- CI/CD, plus anonymized usage analytics.
