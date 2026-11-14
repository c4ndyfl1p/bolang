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
   │  GET /get-replacements?url=<page>&targetLanguage=..&nounSliderValue=..
   ▼
 Flask backend (backend/app.py)
   1. downloads the page at <url>          (requests + BeautifulSoup)
   2. tags parts of speech                 (spaCy, en_core_web_sm)
   3. picks the N most frequent nouns / verbs / prepositions
   4. translates them in one batch         (DeepL API)
   ▼
 { "nouns": {"water": "vand"}, "verbs": {...}, "prepositions": {...} }
   │
 content.js walks the page's text nodes and replaces matches with highlighted <span>s
```

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
| `backend/server2.py` | Old test server with hardcoded Danish words. Not used |
| `requirements.txt` | Python dependencies (`backend/requirements.txt` is empty and can be ignored) |

---

## Development

You need two things running: the **backend** (a Python Flask server on `localhost:5000`) and the **extension** (loaded into Chrome unpacked, from source).

### Prerequisites

- Python 3.12 (3.10+ should work)
- Google Chrome or another Chromium browser (Edge, Brave), or Firefox (see [Firefox](#firefox))
- A free **DeepL API key**. Sign up at <https://www.deepl.com/pro-api> and choose the *Free* plan. The code calls the free endpoint `api-free.deepl.com`, so a Pro key won't work without changing the URL in `app.py`.

### 1. Set up the backend (one time)

From the repo root:

```bash
python3 -m venv .hcai
source .hcai/bin/activate            # fish: source .hcai/bin/activate.fish
pip install -r requirements.txt
python -m spacy download en_core_web_sm   # the English language model spaCy needs
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
flask run            # serves on http://127.0.0.1:5000
```

You have to run `flask run` from inside `backend/`, because that's where `app.py` is. From the repo root you can use `flask --app backend/app run` instead. Add `--debug` to get auto-reload while you edit.

Quick check that it works:

```bash
curl "http://localhost:5000/get-replacements?url=https://en.wikipedia.org/wiki/Coffee&targetLanguage=DA"
```

You should get JSON with `nouns`, `verbs` and `prepositions`. If every translation ends in ` (DK)`, the DeepL call failed. Check your key and the server log.

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

- The backend URL is hardcoded as `http://localhost:5000` in `content.js` (`baseUrl`) and in `manifest.json` (`host_permissions`). Both have to change when the backend is hosted somewhere else.
- The slider-to-word-count mapping (`0 → 0`, `1 → 5`, `2 → 30`) is in `backend/app.py`.

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
- **Login-only pages don't work:** the backend downloads the URL again on its own, so it can't see pages that require a login and may see different content from what you see.
- Translations are single words with no context.
- The `.hcai/` virtualenv is committed to git. It should be removed from the repo with `git rm -r --cached .hcai` and added to `.gitignore`.

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
