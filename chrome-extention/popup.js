// Popup UI: language + intensity settings (saved in chrome.storage) and two buttons.
// "Translate this page" injects content.js into the active tab (only when clicked, via activeTab)
// and asks it to translate. "Show original" asks it to undo the replacements.

const SETTINGS = ["targetLanguage", "nounSliderValue", "verbSliderValue", "prepositionSliderValue"];

document.addEventListener("DOMContentLoaded", () => {
  const targetLanguageSelect = document.getElementById("target-language");
  const sliders = {
    nounSliderValue: document.getElementById("noun-slider"),
    verbSliderValue: document.getElementById("verb-slider"),
    prepositionSliderValue: document.getElementById("preposition-slider"),
  };
  const translateBtn = document.getElementById("translate-btn");
  const restoreBtn = document.getElementById("restore-btn");
  const statusText = document.getElementById("status-text");

  // Load stored settings
  chrome.storage.local.get(SETTINGS, (data) => {
    targetLanguageSelect.value = data.targetLanguage ?? "DA";
    for (const [key, slider] of Object.entries(sliders)) {
      slider.value = data[key] ?? 1;
    }
  });

  // Save settings when they change
  targetLanguageSelect.addEventListener("change", () => {
    chrome.storage.local.set({ targetLanguage: targetLanguageSelect.value });
  });
  for (const [key, slider] of Object.entries(sliders)) {
    slider.addEventListener("input", () => chrome.storage.local.set({ [key]: slider.value }));
  }

  translateBtn.addEventListener("click", async () => {
    setBusy(true, "Translating… this can take a few seconds.");
    const settings = {
      targetLanguage: targetLanguageSelect.value,
      nounSliderValue: sliders.nounSliderValue.value,
      verbSliderValue: sliders.verbSliderValue.value,
      prepositionSliderValue: sliders.prepositionSliderValue.value,
    };
    const result = await sendToPage({ type: "TRANSLATE_PAGE", settings });
    if (result?.ok) {
      const { nouns, verbs, prepositions } = result.counts;
      if (nouns + verbs + prepositions === 0) {
        setBusy(false, "No matching words found on this page.");
      } else {
        setBusy(false,
          `Translated ${plural(nouns, "unique noun")}, ${plural(verbs, "unique verb")} ` +
          `and ${plural(prepositions, "unique preposition")}. Hover one to see the original.`);
      }
    } else {
      setBusy(false, result?.error || "Something went wrong.", true);
    }
  });

  restoreBtn.addEventListener("click", async () => {
    const result = await sendToPage({ type: "RESTORE_PAGE" });
    setStatus(result?.ok ? "Original text restored." : (result?.error || "Something went wrong."), !result?.ok);
  });

  // Inject content.js into the active tab (it guards against double-loading) and send it a message.
  async function sendToPage(message) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      return await chrome.tabs.sendMessage(tab.id, message);
    } catch (err) {
      console.error(err);
      return { ok: false, error: "This page can't be translated (browser pages and the extension store are off-limits)." };
    }
  }

  function plural(n, word) {
    return `${n} ${word}${n === 1 ? "" : "s"}`;
  }

  function setBusy(busy, text, isError = false) {
    translateBtn.disabled = busy;
    restoreBtn.disabled = busy;
    setStatus(text, isError);
  }

  function setStatus(text, isError = false) {
    statusText.textContent = text;
    statusText.classList.toggle("error", isError);
  }
});
