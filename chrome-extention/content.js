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
// 1. Add a button to toggle the translation on and off -done
//    - This is done in the popup.js and popup.html files. The content.js listens for messages from the popup.
//    - The popup.js sends a message to the content.js when the toggle is changed.
//    - The content.js then fetches the translations from the backend and applies them to the page.
//    - The content.js also listens for messages from the popup to turn off the translations.
//    - The content.js reloads the page to restore the original text.
//    - The popup.js also stores the state of the toggle in chrome.storage..
// 2. Add UI to - 2.1 selct language, toggle verbs and nouns and prepositions
// 3. Add a a slider to change intensity of nouns and verbs translations (send that to the backend)
// 4. Send the website URL to the backend and have the backend generate specific translations for that website -done


let extensionEnabled = false; // Default state

// ========= ADDED: Listen for toggle messages from the popup =========
// This listener waits for messages (sent by the popup when the toggle is changed)
// to update the extension's state.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Check if the message is of type "TOGGLE_EXTENSION"
  if (message.type === "TOGGLE_EXTENSION") {
    // Update the extension's state based on the message
    extensionEnabled = message.enabled;
    console.log("Extension state changed:", extensionEnabled);
    if (extensionEnabled) {
      // If enabled, fetch and apply translations.
      console.log("Extension enabled. Fetching replacements...");
      fetchReplacements();
    } else {
      // If turned off, revert the translations.
      // For simplicity, we reload the page to restore original text.
      location.reload();
      console.log("Extension disabled. Reloading page to restore original text.");
    }
  }
});

// ========= ADDED: Initialize based on stored setting =========
// When the page loads, we check chrome.storage to see if the extension
// is enabled. Based on that, we decide whether to fetch translations.
chrome.storage.local.get(["extensionEnabled", "targetLanguage"], (data) => {
  extensionEnabled = data.extensionEnabled ?? false;
  // const targetLanguage = data.targetLanguage || "da"; // Default to Danish

  // console.log("content.js: Target language from chrome storage:", targetLanguage);

  if (extensionEnabled) {
    console.log("Extension is enabled, read from chrome storage.");
    fetchReplacements(); // Pass it to your function if needed
  }
});

// 1. Fetch the replacements from backend
async function fetchReplacements() {

  // Only run the process if the extension is enabled.
  if (!extensionEnabled) return;

  // try {   
  //   currentUrl = window.location.href;
  //   const response = await fetch(`http://localhost:5000/get-replacements?url=${encodeURIComponent(currentUrl)}`);
    
  //   // const response = await fetch("http://localhost:5000/get-replacements");
  //   const replacements = await response.json();
  //   applyReplacements(replacements);
  // } catch (error) {
  //   console.error("Failed to fetch replacements:", error);
  // }

  try {
    // Get the targetLanguage from local storage
    chrome.storage.local.get(["targetLanguage", "nounSliderValue", "verbSliderValue", "prepositionSliderValue"], async (data) => {
      const targetLanguage = data.targetLanguage || "danish"; // default if not set
      console.log("fetching replacingts for Target language:", targetLanguage, "Noun slider value:", data.nounSliderValue);
      currentUrl = window.location.href;
      nounSliderValue = data.nounSliderValue || 1; // default if not set
      verbSliderValue = data.verbSliderValue || 1; // default if not set
      prepositionSliderValue = data.prepositionSliderValue || 1; // default if not set
      

      // Construct the URL using the URL object and URLSearchParams
      const baseUrl = "http://localhost:5000/get-replacements";
      const params = new URLSearchParams({
        url: currentUrl,
        targetLanguage: targetLanguage,
        nounSliderValue: nounSliderValue,
        verbSliderValue: verbSliderValue,
        prepositionSliderValue: prepositionSliderValue
      });

      // Combine the base URL with query parameters
      const requestUrl = `${baseUrl}?${params.toString()}`;

      // Fetch data from backend
      const response = await fetch(requestUrl);
      
      //basic way, not using now, using prettier way to encode the url
      // const response = await fetch(`http://localhost:5000/get-replacements?url=${encodeURIComponent(currentUrl)}&targetLanguage=${encodeURIComponent(targetLanguage)}`);

      const replacements = await response.json();
      console.log("Replacements fetched. Target language:", targetLanguage, "Replacements:", replacements);
      // location.reload();
      applyReplacements(replacements);
    });
  } catch (error) {
    console.error("Failed to fetch replacements:", error);
  }
}
  
  // 2. Apply replacements to the entire DOM
  function applyReplacements(replacements) {

    // removePreviousTranslations();
    replaceText(document.body, replacements);
    addStyle();
    
  }

  function removePreviousTranslations() {
    const spans = document.querySelectorAll('.translated-noun, .translated-verb, .translated-preposition', '.translated-pronoun');
    for (const span of spans) {
      const textNode = document.createTextNode(span.title); // original text is in title attr
      span.replaceWith(textNode);
    }
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
        ...Object.keys(replacements.verbs),
        ...Object.keys(replacements.prepositions),
        ...Object.keys(replacements.pronouns)
      ];
      // const regex = new RegExp(`\\b(${allWords.join("|")})\\b`, "gi");
      const regex = new RegExp(`(?<!\\w)(${allWords.join("|")})(?!\\w)`, "gi");

  
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
        } else if (replacements.prepositions[lower]) {
          translation = replacements.prepositions[lower];
          className = "translated-preposition";
        } 
        // else if (replacements.pronouns[lower]) {
        //   translation = replacements.pronouns[lower];
        //   className = "translated-pronoun";
        // }
  
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

      .translated-preposition {
        background-color: #bbdefb;
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

      .translated-pronoun {
        background-color:rgb(95, 240, 158);
        cursor: help;
        border-radius: 4px;
        padding: 0 2px;
      }
    `;
    document.head.appendChild(style);
  }
  
// 🚀 Start the process
fetchReplacements();

  