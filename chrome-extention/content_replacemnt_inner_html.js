// replacements with hover, using innerHTML, but it's not safe for ome reason. but easy to read

const replacements = {
    "water": "vand",
    "coffee": "kaffe",
    "cat": "kat",
    "dog": "hund"
  };
  
// Replace words and wrap in <span title="original">
function replaceText(node) {
if (node.nodeType === Node.TEXT_NODE) {
    let replaced = false;
    let text = node.textContent;

    for (const [original, translation] of Object.entries(replacements)) {
    const regex = new RegExp(`\\b${original}\\b`, "gi");

    if (regex.test(text)) {
        replaced = true;
        text = text.replace(regex, match => {
        return `<span class="translated-word" title="${match}">${translation}</span>`;
        });
    }
    }

    if (replaced) {
    const span = document.createElement("span");
    span.innerHTML = text;
    node.replaceWith(span);
    }

} else {
    for (const child of Array.from(node.childNodes)) {
    replaceText(child);
    }
}
}

replaceText(document.body);

const style = document.createElement("style");


style.textContent = `
  .translated-word {
    background-color: #e0f7fa;
    cursor: help;
    border-radius: 4px;
    padding: 0 2px;
  }
`;
document.head.appendChild(style);
