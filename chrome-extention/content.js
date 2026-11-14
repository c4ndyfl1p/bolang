// Injected into the current tab by popup.js when the user clicks "Translate this page".
// It asks the backend for translations of the most frequent nouns/verbs/prepositions on this page,
// then replaces matching words in the page's text nodes with <span class="bolang-word">.
// Translated words get a thin coloured underline; hovering shows a small card with the original.
// The original word is kept in data-bolang-original so "Show original" can undo everything.
//
// Known limitations:
// - Content loaded after translating (infinite scroll, SPAs) isn't translated until you click again.
// - Translations are single words without context.

// popup.js injects this file on every click; only set things up once per page.
if (!window.__bolangLoaded) {
  window.__bolangLoaded = true;

  // Where the backend lives. Change this one line (and host_permissions in manifest.json) when deploying.
  // For local development, use "http://localhost:5000" (and add it to host_permissions in manifest.json).
  const BACKEND_URL = "https://bolang-backend.onrender.com";
  const MAX_TEXT_CHARS = 100000; // same cap as the backend
  const WORD_SELECTOR = ".bolang-word";
  const POS = {
    nouns: { className: "bolang-noun", label: "noun" },
    verbs: { className: "bolang-verb", label: "verb" },
    prepositions: { className: "bolang-preposition", label: "preposition" },
  };

  // Firefox's native API is `browser`; Chrome only has `chrome`.
  const ext = globalThis.browser ?? globalThis.chrome;

  ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "TRANSLATE_PAGE") {
      translatePage(message.settings)
        .then((counts) => sendResponse({ ok: true, counts }))
        .catch((err) => {
          console.error("BoLang:", err);
          sendResponse({ ok: false, error: err.message, status: err.status });
        });
      return true; // keep the message channel open for the async response
    }
    if (message.type === "RESTORE_PAGE") {
      removePreviousTranslations();
      sendResponse({ ok: true });
    }
  });

  async function translatePage(settings) {
    // Send the text the user is looking at (not the URL): works on logged-in pages and means the
    // server never has to download arbitrary web pages. Capped to keep requests small.
    const text = document.body.innerText.slice(0, MAX_TEXT_CHARS);

    // The invite code goes in the standard Authorization header, not in the body
    const { inviteCode, ...options } = settings;
    const headers = { "Content-Type": "application/json" };
    if (inviteCode) headers.Authorization = `Bearer ${inviteCode}`;

    let response;
    try {
      response = await fetch(`${BACKEND_URL}/replacements`, {
        method: "POST",
        headers,
        body: JSON.stringify({ text, ...options }),
      });
    } catch {
      throw new Error("Can't reach the BoLang server. Is the backend running?");
    }
    let replacements;
    try {
      replacements = await response.json();
    } catch {
      throw new Error(`Server error (${response.status})`);
    }
    if (!response.ok) {
      const err = new Error(replacements.error || `Server error (${response.status})`);
      err.status = response.status; // lets the popup react to 401 (invite code needed)
      throw err;
    }

    // Start from the original text so clicking again with new settings doesn't stack translations
    removePreviousTranslations();
    addStyle();
    setUpTooltip();
    return replaceText(document.body, replacements);
  }

  function removePreviousTranslations() {
    hideTooltip();
    for (const span of document.querySelectorAll(WORD_SELECTOR)) {
      const parent = span.parentNode;
      span.replaceWith(document.createTextNode(span.dataset.bolangOriginal));
      parent.normalize(); // merge the split text nodes back together
    }
  }

  // Replace words in text nodes (no innerHTML).
  // Returns how many *unique* words of each type were actually replaced on the page.
  function replaceText(root, replacements) {
    const seen = { nouns: new Set(), verbs: new Set(), prepositions: new Set() };
    const uniqueCounts = () => ({
      nouns: seen.nouns.size,
      verbs: seen.verbs.size,
      prepositions: seen.prepositions.size,
    });

    const allWords = Object.keys(POS).flatMap((pos) => Object.keys(replacements[pos] || {}));
    if (allWords.length === 0) return uniqueCounts();
    const regex = new RegExp(`\\b(${allWords.join("|")})\\b`, "gi");

    // Collect text nodes first, then modify, so the DOM isn't changing while we walk it
    const textNodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => (shouldSkipNode(node.parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    let index = 0; // used to stagger the underline animation
    for (const node of textNodes) {
      const text = node.textContent;
      const fragments = [];
      let lastIndex = 0;
      let match;
      regex.lastIndex = 0;

      while ((match = regex.exec(text)) !== null) {
        const original = match[0];
        const lower = original.toLowerCase();
        const pos = Object.keys(POS).find((p) => replacements[p]?.[lower]);
        if (!pos) continue;
        seen[pos].add(lower);

        if (match.index > lastIndex) {
          fragments.push(document.createTextNode(text.slice(lastIndex, match.index)));
        }
        const span = document.createElement("span");
        span.className = `bolang-word ${POS[pos].className}`;
        span.textContent = replacements[pos][lower];
        span.dataset.bolangOriginal = original;
        span.dataset.bolangPos = POS[pos].label;
        span.style.setProperty("--bolang-delay", `${Math.min(index++ * 12, 900)}ms`);
        fragments.push(span);
        lastIndex = regex.lastIndex;
      }

      if (fragments.length > 0) {
        if (lastIndex < text.length) fragments.push(document.createTextNode(text.slice(lastIndex)));
        node.replaceWith(...fragments);
      }
    }
    return uniqueCounts();
  }

  // Don't touch form fields, scripts, styles or editable areas
  function shouldSkipNode(el) {
    if (!el) return true;
    return (
      ["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT"].includes(el.nodeName) ||
      el.isContentEditable
    );
  }

  // ---------- Styling: thin underline in the part-of-speech colour, sweeping in ----------
  function addStyle() {
    if (document.getElementById("bolang-style")) return;
    const style = document.createElement("style");
    style.id = "bolang-style";
    style.textContent = `
      .bolang-word {
        --bolang-line: 2px;
        cursor: help;
        text-decoration: none;
        background-image: linear-gradient(var(--bolang-c), var(--bolang-c));
        background-repeat: no-repeat;
        background-position: 0 100%;
        background-size: 100% var(--bolang-line);
        border-radius: 2px;
        padding-bottom: 1px;
        -webkit-box-decoration-break: clone;
        box-decoration-break: clone;
        transition: background-size 180ms ease, background-color 180ms ease;
        animation: bolang-sweep 500ms cubic-bezier(.2, .7, .2, 1) var(--bolang-delay, 0ms) both;
      }
      .bolang-word:hover { background-color: var(--bolang-tint); --bolang-line: 3px; }
      .bolang-noun        { --bolang-c: rgba(232, 145, 45, .9);  --bolang-tint: rgba(232, 145, 45, .16); }
      .bolang-verb        { --bolang-c: rgba(42, 157, 143, .9);  --bolang-tint: rgba(42, 157, 143, .16); }
      .bolang-preposition { --bolang-c: rgba(139, 127, 214, .9); --bolang-tint: rgba(139, 127, 214, .18); }
      @keyframes bolang-sweep { from { background-size: 0% var(--bolang-line); } }
      @media (prefers-reduced-motion: reduce) { .bolang-word { animation: none; transition: none; } }
    `;
    document.head.appendChild(style);
  }

  // ---------- Hover card: one shared element in a shadow root, so page CSS can't break it ----------
  let tooltipHost, tooltipEl;

  function setUpTooltip() {
    if (tooltipHost) return;
    tooltipHost = document.createElement("bolang-tooltip");
    tooltipHost.style.cssText = "position:fixed;top:0;left:0;z-index:2147483647;pointer-events:none;";
    const shadow = tooltipHost.attachShadow({ mode: "closed" });
    shadow.innerHTML = `
      <style>
        .card {
          position: fixed; transform: translate(-50%, calc(-100% - 10px));
          display: flex; align-items: baseline; gap: 8px;
          padding: 6px 10px; border-radius: 8px;
          background: #2b2350; color: #fbf3e4;
          font: 500 14px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif;
          box-shadow: 0 6px 20px rgba(20, 15, 40, .28);
          white-space: nowrap; opacity: 0; transition: opacity 120ms ease;
        }
        .card.below { transform: translate(-50%, 10px); }
        .card.show { opacity: 1; }
        .card::after {
          content: ""; position: absolute; left: 50%; top: 100%; transform: translateX(-50%);
          border: 6px solid transparent; border-top-color: #2b2350;
        }
        .card.below::after { top: auto; bottom: 100%; border-top-color: transparent; border-bottom-color: #2b2350; }
        .pos { font-size: 11px; letter-spacing: .04em; text-transform: uppercase; opacity: .8; }
        .pos::before {
          content: ""; display: inline-block; width: 7px; height: 7px; border-radius: 50%;
          margin-right: 5px; background: var(--dot);
        }
      </style>
      <div class="card"><span class="word"></span><span class="pos"></span></div>`;
    tooltipEl = shadow.querySelector(".card");
    document.documentElement.appendChild(tooltipHost);

    const dots = { noun: "#e8912d", verb: "#2a9d8f", preposition: "#8b7fd6" };
    document.addEventListener("mouseover", (e) => {
      const word = e.target.closest?.(WORD_SELECTOR);
      if (!word) return;
      tooltipEl.querySelector(".word").textContent = word.dataset.bolangOriginal;
      tooltipEl.querySelector(".pos").textContent = word.dataset.bolangPos;
      tooltipEl.style.setProperty("--dot", dots[word.dataset.bolangPos]);
      const rect = word.getBoundingClientRect();
      const below = rect.top < 48; // not enough room above: show it underneath
      tooltipEl.classList.toggle("below", below);
      const centre = rect.left + rect.width / 2;
      const half = tooltipEl.offsetWidth / 2 + 8; // keep the card inside the window
      tooltipEl.style.left = `${Math.min(Math.max(centre, half), window.innerWidth - half)}px`;
      tooltipEl.style.top = `${below ? rect.bottom : rect.top}px`;
      tooltipEl.classList.add("show");
    });
    document.addEventListener("mouseout", (e) => {
      if (e.target.closest?.(WORD_SELECTOR)) hideTooltip();
    });
    window.addEventListener("scroll", hideTooltip, { passive: true });
  }

  function hideTooltip() {
    tooltipEl?.classList.remove("show");
  }
}
