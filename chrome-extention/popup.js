// This script runs in the context of the popup window of the Chrome extension.

// 1.first loads UI elemts such as toggle, status text and target language select (these are classes in the popup.html file)

// 2. it then loads the stored state of the extension from chrome.storage, and changes the UI elemets accordingly

// 3.It also has events listeres for changes of the UI elemts such as the toggle and target language selec. 
// 3. On the change of the UI element, the event listerer is triggered, local storage is set with the new value and a message is sent to content.js


document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("toggle-extension");
  const statusText = document.getElementById("status-text");
  const targetLanguageSelect = document.getElementById("target-language");
  const nounSlider = document.getElementById("noun-slider");
  const verbSlider = document.getElementById("verb-slider");
  const prepositionSlider = document.getElementById("preposition-slider");

  // Load stored state
  chrome.storage.local.get(["extensionEnabled", "targetLanguage", "nounSliderValue", "verbSliderValue", "prepositionSliderValue"], (data) => {
    // Set the toggle state based on stored value
    // If no value is stored, default to false for extensionEnabled
    toggle.checked = data.extensionEnabled ?? false;
    updateStatusText(toggle.checked);

    const selectedLanguage = data.targetLanguage ?? "da"; // Default to Danish if no language is stored
    targetLanguageSelect.value = selectedLanguage;
    updateTargetLanguageSelect(selectedLanguage);

    nounSlider.value = data.nounSliderValue ?? 1; // Default to 1 if no value is stored
    updateNounSlider(nounSlider.value); // Update the slider UI

    verbSlider.value = data.verbSliderValue ?? 1; // Default to 1 if no value is stored
    updateVerbSlider(verbSlider.value); // Update the slider UI

    prepositionSlider.value = data.prepositionSliderValue ?? 1; // Default to 1 if no value is stored
    updatePrepositionSlider(prepositionSlider.value); // Update the slider UI

    
  });



  // Add an event listener to handle changes in the toggle switch state
  // When the user toggles the switch, we save the state to chrome.storage
  toggle.addEventListener("change", () => {
    const enabled = toggle.checked;
    chrome.storage.local.set({ extensionEnabled: enabled });
    updateStatusText(enabled);

    // Optional: Send message to content script if you want to act immediately
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { type: "TOGGLE_EXTENSION", enabled });
    });
  });

  // Add event listener for the target language select to handle changes
  targetLanguageSelect.addEventListener("change", () => {
    const selectedLanguage = targetLanguageSelect.value;
    chrome.storage.local.set({ targetLanguage: selectedLanguage });
    updateTargetLanguageSelect(selectedLanguage);

    // Send message to content script with the selected target language
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            
    });
  });

    // Add event listener for the noun slider to handle changes
  nounSlider.addEventListener("input", () => {
    const nounSliderValue = nounSlider.value;
    chrome.storage.local.set({ nounSliderValue: nounSliderValue });
    console.log('Noun slider value stored:', nounSliderValue); // Optional: for debugging

    updateNounSlider(nounSliderValue);
    
  });

  verbSlider.addEventListener("input", () => {
    const verbSliderValue = verbSlider.value;
    chrome.storage.local.set({ verbSliderValue: verbSliderValue });
    console.log('Verb slider value stored:', verbSliderValue); // Optional: for debugging

    updateVerbSlider(verbSliderValue);
  });

  prepositionSlider.addEventListener("input", () => {
    const prepositionSliderValue = prepositionSlider.value;
    chrome.storage.local.set({ prepositionSliderValue: prepositionSliderValue });
    console.log('Preposition slider value stored:', prepositionSliderValue); // Optional: for debugging

    updatePrepositionSlider(prepositionSliderValue);
  }
  );



  // Function to update the target language select element
  function updateTargetLanguageSelect(selectedLanguage) {    
    targetLanguageSelect.value = selectedLanguage;
    
  }

  // Function to update the status text based on the extension state
  function updateStatusText(enabled) {
    statusText.innerHTML = `Extension is <strong>${enabled ? "On" : "Off"}</strong>`;
  }

  function updateNounSlider(value) {
    nounSlider.value  = value;
  }

  function updateVerbSlider(value) {
    verbSlider.value  = value;
  }
  function updatePrepositionSlider(value) {
    prepositionSlider.value  = value;
  }
});
