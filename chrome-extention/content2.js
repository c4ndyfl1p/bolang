// // with pasign the dom and sending tot he backend

// function getPageText() {
//     let walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
//     let text = '';
//     let nodes = [];
  
//     while (walker.nextNode()) {
//       let node = walker.currentNode;
//       text += node.textContent + ' ';
//       nodes.push(node);
//     }
  
//     return { text, nodes };
//   }
  
//   function applyReplacements(nodes, replacements) {
//     for (const node of nodes) {
//       if (node.nodeType !== Node.TEXT_NODE) continue;
//       let original = node.textContent;
//       let replaced = original;
//       let changed = false;
  
//       for (const [word, translated] of Object.entries(replacements)) {
//         const regex = new RegExp(`\\b${word}\\b`, "gi");
//         if (regex.test(replaced)) {
//           changed = true;
//           replaced = replaced.replace(regex, match => {
//             return `<span class="translated-word" title="${match}">${translated}</span>`;
//           });
//         }
//       }
  
//       if (changed) {
//         const span = document.createElement("span");
//         span.innerHTML = replaced;
//         node.replaceWith(span);
//       }
//     }
//   }
  
//   // Add some basic styling
//   const style = document.createElement("style");
//   style.textContent = `
//     .translated-word {
//       background-color: #e0f7fa;
//       cursor: help;
//       border-radius: 4px;
//       padding: 0 2px;
//     }
//   `;
//   document.head.appendChild(style);
  
//   // Main logic
//   (async () => {
//     const { text, nodes } = getPageText();
//     console.log("🧠 Extracted text:", text.slice(0, 500));
  
//     const res = await fetch("http://localhost:5000/replace-nouns", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ text })
//     });
  
//     const json = await res.json();
//     console.log("✅ Replacements received from backend:", json);
  
//     if (json.replacements) {
//       applyReplacements(nodes, json.replacements);
//     } else {
//       console.warn("⚠️ No replacements found in response");
//     }
//   })();
  