// basic replacement scipt


// 👇 Add your words and replacements here
const replacements = {
  "water": "vand",
  "coffee": "kaffe",
  "cat": "kat",
  "dog": "hund"
};

// Replace words in text nodes
function replaceText(node) { // Check if the node is a text node
  if (node.nodeType === Node.TEXT_NODE) { // Check if the text node is empty
    let text = node.textContent; 
    for (const [original, replacement] of Object.entries(replacements)) {
      const regex = new RegExp(`\\b${original}\\b`, "gi");
      text = text.replace(regex, replacement);
    }
    node.textContent = text;
  } else { // If the node is not a text node, recursively process its child nodes
    for (const child of node.childNodes) {
      replaceText(child);
    }
  }
}



replaceText(document.body);