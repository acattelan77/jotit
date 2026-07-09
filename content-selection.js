(() => {
  if (globalThis.__JOT_SELECTION_ACTIVE) return;
  globalThis.__JOT_SELECTION_ACTIVE = true;
  let lastSentText = "";
  let lastSentAt = 0;
  let debounceTimer;
  let extensionAlive = true;
  let lastSelectionText = "";
  let debugEnabled = false;
  const DEBUG_KEY = "debugLogsEnabled";

  const MAX_SELECTION_LENGTH = 4000;
  const DEBOUNCE_MS = 200;

  const canSend = () => {
    if (!extensionAlive) return false;
    try {
      return (
        typeof chrome !== "undefined" &&
        chrome?.runtime &&
        typeof chrome.runtime.sendMessage === "function"
      );
    } catch (error) {
      extensionAlive = false;
      return false;
    }
  };

  const stopListeners = () => {
    document.removeEventListener("mouseup", handleSelectionFinalize);
    document.removeEventListener("keyup", handleSelectionFinalize);
    document.removeEventListener("selectionchange", handleSelectionChange);
  };

  const debugLog = (message, data = {}) => {
    if (!debugEnabled) return;
    try {
      console.log("[Jot it][selection]", message, data);
      chrome.runtime.sendMessage({
        type: "DEBUG_LOG",
        scope: "content",
        message,
        data,
      });
    } catch (error) {
      // ignore
    }
  };

  const loadDebugFlag = () => {
    if (!chrome?.storage?.local) return;
    chrome.storage.local.get(DEBUG_KEY, (result) => {
      if (chrome.runtime.lastError) return;
      debugEnabled = Boolean(result?.[DEBUG_KEY]);
    });
  };

  const sendSelectionCandidate = (text) => {
    const trimmed = (text || "").trim();
    if (!trimmed) return;
    const payload = trimmed.slice(0, MAX_SELECTION_LENGTH);
    const now = Date.now();
    if (payload === lastSentText && now - lastSentAt < 1000) return;
    lastSentText = payload;
    lastSentAt = now;
    if (!canSend()) return;
    const pageUrl = window.location?.href || "";
    const pageTitle = document?.title || "";
    try {
      chrome.runtime.sendMessage(
        {
          type: "PAGE_SELECTION_CANDIDATE",
          text: payload,
          url: pageUrl,
          title: pageTitle,
        },
        () => {
          try {
            if (chrome.runtime.lastError) {
              // No background listener yet; ignore.
              debugLog("sendSelection runtime error", {
                error: chrome.runtime.lastError?.message || "",
              });
            }
          } catch (error) {
            extensionAlive = false;
            stopListeners();
          }
        }
      );
      debugLog("sendSelectionCandidate", {
        length: payload.length,
        preview: payload.slice(0, 60),
        url: pageUrl,
      });
    } catch (error) {
      extensionAlive = false;
      stopListeners();
    }
  };

  const handleSelectionChange = () => {
    const selection = window.getSelection();
    lastSelectionText = selection ? selection.toString() : "";
  };

  const handleSelectionFinalize = () => {
    const selection = window.getSelection();
    const selectedText = (lastSelectionText || selection?.toString() || "").trim();
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      sendSelectionCandidate(selectedText);
    }, DEBOUNCE_MS);
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message !== "object") return;
    if (message.type === "PING_SELECTION") {
      sendResponse({ ok: true });
      return;
    }
  });

  if (chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (Object.prototype.hasOwnProperty.call(changes, DEBUG_KEY)) {
        debugEnabled = Boolean(changes[DEBUG_KEY].newValue);
      }
    });
  }

  loadDebugFlag();
  debugLog("selection script ready", { href: window.location?.href || "" });

  document.addEventListener("selectionchange", handleSelectionChange);
  document.addEventListener("mouseup", handleSelectionFinalize);
  document.addEventListener("keyup", handleSelectionFinalize);
})();
