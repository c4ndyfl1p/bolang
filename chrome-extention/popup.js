document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("toggle-extension");
  const statusText = document.getElementById("status-text");

  // Load stored state
  chrome.storage.local.get("extensionEnabled", (data) => {
    toggle.checked = data.extensionEnabled ?? false;
    updateStatusText(toggle.checked);
  });

  // Add an event listener to handle changes in the toggle switch state
  toggle.addEventListener("change", () => {
    const enabled = toggle.checked;
    chrome.storage.local.set({ extensionEnabled: enabled });
    updateStatusText(enabled);

    // Optional: Send message to content script if you want to act immediately
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { type: "TOGGLE_EXTENSION", enabled });
    });
  });

  function updateStatusText(enabled) {
    statusText.innerHTML = `Extension is <strong>${enabled ? "On" : "Off"}</strong>`;
  }
});
