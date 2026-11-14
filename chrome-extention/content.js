// Injected into the current tab by popup.js when the user clicks "Translate this page".
// It asks the backend for translations of the most frequent nouns/verbs/prepositions on this page,
// then replaces matching words in the page's text nodes with highlighted <span>s.
// The original word is kept in the span's title (shown on hover) so "Show original" can undo it.
//
// Known limitations:
// - Content loaded after translating (infinite scroll, SPAs) isn't translated until you click again.
// - Translations are single words without context.

// popup.js injects this file on every click; only set things up once per page.
if (!window.__bolangLoaded) {
  window.__bolangLoaded = true;

  const BACKEND_URL = "http://localhost:5000/get-replacements";
  const SPAN_SELECTOR = ".translated-noun, .translated-verb, .translated-preposition";

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "TRANSLATE_PAGE") {
      translatePage(message.settings)
        .then((counts) => sendResponse({ ok: true, counts }))
        .catch((err) => {
          console.error("BoLang:", err);
          sendResponse({ ok: false, error: err.message });
        });
      return true; // keep the message channel open for the async response
    }
    if (message.type === "RESTORE_PAGE") {
      removePreviousTranslations();
      sendResponse({ ok: true });
    }
  });

  async function translatePage(settings) {
    const params = new URLSearchParams({ url: window.location.href, ...settings });

    let response;
    try {
      response = await fetch(`${BACKEND_URL}?${params}`);
    } catch {
      throw new Error("Can't reach the BoLang server. Is the backend running?");
    }
    const replacements = await response.json();
    if (!response.ok) throw new Error(replacements.error || `Server error (${response.status})`);

    // Start from the original text so clicking again with new settings doesn't stack translations
    removePreviousTranslations();
    addStyle();
    return replaceText(document.body, replacements);
  }

  function removePreviousTranslations() {
    for (const span of document.querySelectorAll(SPAN_SELECTOR)) {
      const parent = span.parentNode;
      span.replaceWith(document.createTextNode(span.title)); // original text is in the title attr
      parent.normalize(); // merge the split text nodes back together
    }
  }

  // Replace words in text nodes recursively (no innerHTML).
  // Returns how many *unique* words of each type were actually replaced on the page.
  function replaceText(root, replacements) {
    const seen = { nouns: new Set(), verbs: new Set(), prepositions: new Set() };
    const uniqueCounts = () => ({
      nouns: seen.nouns.size,
      verbs: seen.verbs.size,
      prepositions: seen.prepositions.size,
    });

    const allWords = [
      ...Object.keys(replacements.nouns),
      ...Object.keys(replacements.verbs),
      ...Object.keys(replacements.prepositions),
    ];
    if (allWords.length === 0) return uniqueCounts();
    const regex = new RegExp(`\\b(${allWords.join("|")})\\b`, "gi");

    // Collect text nodes first, then modify, so the DOM isn't changing while we walk it
    const textNodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => (shouldSkipNode(node.parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    for (const node of textNodes) {
      const text = node.textContent;
      const fragments = [];
      let lastIndex = 0;
      let match;
      regex.lastIndex = 0;

      while ((match = regex.exec(text)) !== null) {
        const original = match[0];
        const lower = original.toLowerCase();
        let translation, className;
        if (replacements.nouns[lower]) {
          translation = replacements.nouns[lower];
          className = "translated-noun";
          seen.nouns.add(lower);
        } else if (replacements.verbs[lower]) {
          translation = replacements.verbs[lower];
          className = "translated-verb";
          seen.verbs.add(lower);
        } else {
          translation = replacements.prepositions[lower];
          className = "translated-preposition";
          seen.prepositions.add(lower);
        }

        if (match.index > lastIndex) {
          fragments.push(document.createTextNode(text.slice(lastIndex, match.index)));
        }
        const span = document.createElement("span");
        span.className = className;
        span.textContent = translation;
        span.title = original;
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

  // Highlight styling for translated words (added once)
  function addStyle() {
    if (document.getElementById("bolang-style")) return;
    const style = document.createElement("style");
    style.id = "bolang-style";
    style.textContent = `
      .translated-noun, .translated-verb, .translated-preposition {
        cursor: help;
        border-radius: 4px;
        padding: 0 2px;
        color: #222;
      }
      .translated-noun { background-color: rgb(239, 169, 239); }
      .translated-verb { background-color: #fff9c4; }
      .translated-preposition { background-color: #bbdefb; }
    `;
    document.head.appendChild(style);
  }
}
