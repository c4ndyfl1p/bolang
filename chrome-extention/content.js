// This script fetches a dictionary from the backend and replaces words in the DOM
// with their translations. It also adds hover styling for the translated words.
// Dict is a simple object with nouns and verbs as keys and their translations as values.
// The script avoids modifying form fields, scripts, and styles to prevent issues.
// It uses a single RegExp to match all words for efficiency and applies the replacements
// in a single pass. The replacements are done by creating new text nodes and spans
// instead of modifying innerHTML, which can be error-prone and inefficient.

// Issues:
// 1. Longer pages may not get fully tranbslated because of lazy loading. I dont know wnof Javascrupt to fix that without breaking more
// 2. Translations may not have context since we are just replacing everything. We dont even need ot use OPEN AI on the backend and can use NLP + DeepL. In fututre i want to change this to more context based trabnslations

// To do:
// 1. Add a button to toggle the translation on and off
// 2. Add button to change the language (send that to the backend)
// 3. Add a a slider to change intensity of nouns and verbs translations (send that to the backend)
// 4. Send the website URL to the backend and have the backend generate specific translations for that website

// 1. Fetch the replacements from backend
async function fetchReplacements() {
    try {
      const response = await fetch("http://localhost:5000/get-replacements");
      const replacements = await response.json();
      applyReplacements(replacements);
    } catch (error) {
      console.error("Failed to fetch replacements:", error);
    }
  }
  
  // 2. Apply replacements to the entire DOM
  function applyReplacements(replacements) {
    replaceText(document.body, replacements);
    addStyle();
  }
  
  // 3. Replace words in text nodes recursively (no innerHTML)
  function replaceText(node, replacements) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      const parent = node.parentNode;
  
      let fragments = [];
      let lastIndex = 0;
      let didMatch = false;
  
      // Merge nouns and verbs into one RegExp for efficiency
      const allWords = [
        ...Object.keys(replacements.nouns),
        ...Object.keys(replacements.verbs)
      ];
      const regex = new RegExp(`\\b(${allWords.join("|")})\\b`, "gi");
  
      let match;
      while ((match = regex.exec(text)) !== null) {
        didMatch = true;
  
        // Push text before match
        if (match.index > lastIndex) {
          fragments.push(document.createTextNode(text.slice(lastIndex, match.index)));
        }
  
        const original = match[0];
        const lower = original.toLowerCase();
        let translation, className;
  
        if (replacements.nouns[lower]) {
          translation = replacements.nouns[lower];
          className = "translated-noun";
        } else if (replacements.verbs[lower]) {
          translation = replacements.verbs[lower];
          className = "translated-verb";
        }
  
        const span = document.createElement("span");
        span.className = className;
        span.textContent = translation;
        span.title = original;
        fragments.push(span);
  
        lastIndex = regex.lastIndex;
      }
  
      // Add any remaining text
      if (didMatch && lastIndex < text.length) {
        fragments.push(document.createTextNode(text.slice(lastIndex)));
      }
  
      if (didMatch) {
        fragments.forEach(frag => parent.insertBefore(frag, node));
        parent.removeChild(node);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE && !shouldSkipNode(node)) {
      for (const child of Array.from(node.childNodes)) {
        replaceText(child, replacements);
      }
    }
  }
  
  // 4. Avoid editing form fields and scripts
  function shouldSkipNode(node) {
    const tag = node.nodeName;
    return (
      tag === "SCRIPT" ||
      tag === "STYLE" ||
      tag === "TEXTAREA" ||
      tag === "INPUT" ||
      node.isContentEditable
    );
  }
  
  // 5. Add hover styling for translations
  function addStyle() {
    const style = document.createElement("style");
    style.textContent = `
      .translated-noun {
        background-color: rgb(239, 169, 239);
        cursor: help;
        border-radius: 4px;
        padding: 0 2px;
      }
  
      .translated-verb {
        background-color: #fff9c4;
        cursor: help;
        border-radius: 4px;
        padding: 0 2px;
      }
    `;
    document.head.appendChild(style);
  }
  
  // 🚀 Start the process
  fetchReplacements();
  
  