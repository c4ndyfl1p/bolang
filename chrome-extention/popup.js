// Popup UI: language chips + Off/Some/Lots per part of speech (saved in extension storage), and two buttons.
// "Translate this page" injects content.js into the active tab (only when clicked, via activeTab)
// and asks it to translate. "Show original text" asks it to undo the replacements.

const AMOUNT_KEYS = ["nounSliderValue", "verbSliderValue", "prepositionSliderValue"];

// Firefox's native API is `browser` (promise-based); Chrome only has `chrome`. Use whichever exists.
const ext = globalThis.browser ?? globalThis.chrome;

document.addEventListener("DOMContentLoaded", () => {
  const languageInputs = document.querySelectorAll('input[name="lang"]');
  const amountGroups = document.querySelectorAll(".amount"); // each has data-key = storage key
  const translateBtn = document.getElementById("translate-btn");
  const translateLabel = translateBtn.querySelector(".label");
  const restoreBtn = document.getElementById("restore-btn");
  const result = document.getElementById("result");
  const statusText = document.getElementById("status-text");
  const inviteToggle = document.getElementById("invite-toggle");
  const invitePanel = document.getElementById("invite-panel");
  const inviteInput = document.getElementById("invite-code");
  const inviteSaved = document.getElementById("invite-saved");

  // ---------- Load stored settings ----------
  ext.storage.local.get(["targetLanguage", "inviteCode", ...AMOUNT_KEYS]).then((data) => {
    checkValue(languageInputs, data.targetLanguage ?? "DA");
    inviteInput.value = data.inviteCode ?? "";
    for (const group of amountGroups) {
      checkValue(group.querySelectorAll("input"), String(data[group.dataset.key] ?? 1));
    }
    requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove("preload")));
  });

  // ---------- Save settings when they change ----------
  for (const input of languageInputs) {
    input.addEventListener("change", () => ext.storage.local.set({ targetLanguage: input.value }));
  }
  for (const group of amountGroups) {
    group.addEventListener("change", (e) => ext.storage.local.set({ [group.dataset.key]: e.target.value }));
  }

  // ---------- Invite code ----------
  inviteToggle.addEventListener("click", () => setInvitePanelOpen(invitePanel.hidden));
  inviteInput.addEventListener("input", () => {
    const code = normalizeInviteCode(inviteInput.value);
    ext.storage.local.set({ inviteCode: code });
    inviteSaved.hidden = !code;
  });

  // Accept "ABCD-EFGH", "abcd-efgh" or the whole "name:ABCD-EFGH" line printed by make_invite.py
  function normalizeInviteCode(value) {
    const afterColon = value.split(":").pop();
    return afterColon.replace(/\s+/g, "").toUpperCase();
  }

  function setInvitePanelOpen(open) {
    invitePanel.hidden = !open;
    inviteToggle.setAttribute("aria-expanded", String(open));
    if (open) inviteInput.focus();
  }

  // ---------- Translate ----------
  translateBtn.addEventListener("click", async () => {
    setBusy(true);
    result.hidden = true;
    setStatus("");

    const settings = {
      targetLanguage: checkedValue(languageInputs),
      inviteCode: normalizeInviteCode(inviteInput.value),
    };
    for (const group of amountGroups) {
      settings[group.dataset.key] = checkedValue(group.querySelectorAll("input"));
    }

    const response = await sendToPage({ type: "TRANSLATE_PAGE", settings });
    setBusy(false);

    if (!response?.ok) {
      if (response?.status === 401) {
        // Server says the invite code is missing or wrong: open the field so it can be fixed
        setStatus(inviteInput.value ? "That invite code isn't valid." : "Enter your invite code below to start.", true);
        setInvitePanelOpen(true);
        inviteInput.select();
      } else {
        setStatus(response?.error || "Something went wrong.", true);
      }
      return;
    }
    const { nouns, verbs, prepositions } = response.counts;
    if (nouns + verbs + prepositions === 0) {
      setStatus("No matching words found on this page.");
      return;
    }
    showCounts(response.counts);
  });

  // ---------- Restore ----------
  restoreBtn.addEventListener("click", async () => {
    const response = await sendToPage({ type: "RESTORE_PAGE" });
    result.hidden = true;
    setStatus(response?.ok ? "Original text restored." : (response?.error || "Something went wrong."), !response?.ok);
  });

  // Inject content.js into the active tab (it guards against double-loading) and send it a message.
  async function sendToPage(message) {
    try {
      const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
      await ext.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      return await ext.tabs.sendMessage(tab.id, message);
    } catch (err) {
      console.error(err);
      return { ok: false, error: "This page can't be translated (browser pages and the extension store are off-limits)." };
    }
  }

  // Count up from 0 for a little life
  function showCounts(counts) {
    result.hidden = false;
    for (const [pos, target] of Object.entries(counts)) {
      const el = document.getElementById(`count-${pos}`);
      const start = performance.now();
      const step = (now) => {
        const t = Math.min((now - start) / 500, 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3)));
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  }

  function setBusy(busy) {
    translateBtn.disabled = busy;
    restoreBtn.disabled = busy;
    translateBtn.classList.toggle("busy", busy);
    translateLabel.textContent = busy ? "Reading the page…" : "Translate this page";
  }

  function setStatus(text, isError = false) {
    statusText.textContent = text;
    statusText.classList.toggle("error", isError);
  }

  function checkValue(inputs, value) {
    for (const input of inputs) input.checked = input.value === value;
  }

  function checkedValue(inputs) {
    return [...inputs].find((i) => i.checked)?.value;
  }
});
