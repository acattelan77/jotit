const setDefaultPanelBehavior = () => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
};

chrome.runtime.onInstalled.addListener(() => {
  setDefaultPanelBehavior();
});

chrome.runtime.onStartup.addListener(() => {
  setDefaultPanelBehavior();
});

setDefaultPanelBehavior();

const detachedWindows = new Map();
const openPanelTabs = new Set();
const DEBUG_KEY = "debugLogsEnabled";
let debugEnabled = false;
let debugLogs = [];

const hasDetachedWindowForTab = (tabId) => {
  for (const mappedTabId of detachedWindows.values()) {
    if (mappedTabId === tabId) return true;
  }
  return false;
};

const loadDebugFlag = () => {
  chrome.storage.local.get(DEBUG_KEY, (result) => {
    if (chrome.runtime.lastError) return;
    debugEnabled = Boolean(result?.[DEBUG_KEY]);
  });
};

const debugLog = (scope, message, data = {}) => {
  if (!debugEnabled) return;
  const entry = {
    ts: new Date().toISOString(),
    scope,
    message,
    data,
  };
  debugLogs.push(entry);
  if (debugLogs.length > 200) {
    debugLogs = debugLogs.slice(-200);
  }
  console.log("[Jot it][debug]", entry);
};

const ensurePanelOptions = async (tabId, source) => {
  if (!Number.isInteger(tabId)) return;
  try {
    await chrome.sidePanel.setOptions({
      tabId,
      enabled: true,
      path: "sidepanel.html",
    });
    debugLog("background", "PANEL_OPTIONS", { tabId, source });
  } catch (error) {
    debugLog("background", "PANEL_OPTIONS failed", {
      tabId,
      source,
      error: String(error),
    });
  }
};


chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (Object.prototype.hasOwnProperty.call(changes, DEBUG_KEY)) {
    debugEnabled = Boolean(changes[DEBUG_KEY].newValue);
  }
});

loadDebugFlag();

const ensureSelectionScript = async (tabId) => {
  if (!Number.isInteger(tabId)) return;
  debugLog("background", "ensureSelectionScript", { tabId });
  const tab = await new Promise((resolve) => {
    chrome.tabs.get(tabId, (result) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(result || null);
    });
  });
  const tabUrl = typeof tab?.url === "string" ? tab.url : "";
  if (!/^https?:/i.test(tabUrl)) {
    debugLog("background", "skip inject (non-http)", { tabId, url: tabUrl });
    return;
  }
  const hasListener = await new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: "PING_SELECTION" }, (response) => {
      if (chrome.runtime.lastError) {
        resolve(false);
        return;
      }
      resolve(Boolean(response?.ok));
    });
  });

  if (hasListener || !chrome.scripting?.executeScript) return;

  try {
    debugLog("background", "inject content-selection", { tabId });
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ["content-selection.js"],
    });
    debugLog("background", "inject success", { tabId });
  } catch (error) {
    // Ignore injection errors for restricted pages.
    debugLog("background", "inject failed", {
      tabId,
      url: tabUrl,
      error: String(error),
    });
  }
};

const getActiveTab = () =>
  new Promise((resolve) => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      if (tabs && tabs.length) {
        resolve(tabs[0]);
        return;
      }
      chrome.tabs.query({ active: true }, (fallbackTabs) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve(fallbackTabs && fallbackTabs.length ? fallbackTabs[0] : null);
      });
    });
  });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") return;
  const senderUrl = sender?.url || "";
  const trustedOrigin = chrome.runtime.getURL("");
  const isTrustedSender =
    sender?.id === chrome.runtime.id && senderUrl.startsWith(trustedOrigin);

  const restrictedTypes = new Set([
    "DETACH_PANEL",
    "DETACH_AND_OPEN",
    "REGISTER_DETACH_WINDOW",
    "PANEL_OPEN",
    "PANEL_CLOSE",
  ]);

  if (restrictedTypes.has(message.type) && !isTrustedSender) {
    sendResponse({ ok: false, error: "Untrusted sender." });
    return;
  }

  if (message.type === "DETACH_PANEL" && Number.isInteger(message.tabId)) {
    (async () => {
      try {
        await ensurePanelOptions(message.tabId, "detach_panel");
        await chrome.sidePanel.setOptions({
          tabId: message.tabId,
          enabled: false,
          path: "sidepanel.html",
        });
        debugLog("background", "DETACH_PANEL", { tabId: message.tabId });
        await ensureSelectionScript(message.tabId);
        sendResponse({ ok: true });
      } catch (error) {
        sendResponse({ ok: false, error: String(error) });
      }
    })();
    return true;
  }

  if (message.type === "DETACH_AND_OPEN") {
    (async () => {
      try {
        let tab = null;
        if (Number.isInteger(message.tabId)) {
          tab = await new Promise((resolve) => {
            chrome.tabs.get(message.tabId, (result) => {
              if (chrome.runtime.lastError) {
                resolve(null);
                return;
              }
              resolve(result || null);
            });
          });
        }
        if (!tab) {
          tab = await getActiveTab();
        }
        if (!tab?.id) {
          sendResponse({ ok: false, error: "No active tab found." });
          return;
        }
        debugLog("background", "DETACH_AND_OPEN", { tabId: tab.id });

        try {
          await ensurePanelOptions(tab.id, "detach_open");
          await chrome.sidePanel.setOptions({
            tabId: tab.id,
            enabled: false,
            path: "sidepanel.html",
          });
          openPanelTabs.delete(tab.id);
          chrome.tabs.sendMessage(tab.id, { type: "PANEL_CLOSE" }, () => {
            if (chrome.runtime.lastError) {
              // Ignore if the content script isn't available on this tab.
            }
          });
          debugLog("background", "DETACH_PANEL (pre-open)", { tabId: tab.id });
        } catch (error) {
          debugLog("background", "DETACH_PANEL failed (pre-open)", {
            tabId: tab.id,
            error: String(error),
          });
        }

        const url = new URL(chrome.runtime.getURL("sidepanel.html"));
        url.searchParams.set("standalone", "1");
        url.searchParams.set("sourceTabId", String(tab.id));
        if (tab.title) {
          url.searchParams.set("sourceTitle", tab.title);
        }
        if (tab.url) {
          url.searchParams.set("sourceUrl", tab.url);
        }

        const createdWindow = await chrome.windows.create({
          url: url.toString(),
          type: "popup",
          width: 420,
          height: 720,
        });

        if (!createdWindow?.id) {
          try {
            await chrome.sidePanel.setOptions({
              tabId: tab.id,
              enabled: true,
              path: "sidepanel.html",
            });
            await chrome.sidePanel.open({ tabId: tab.id });
          } catch (restoreError) {
            // Best effort restore; ignore.
          }
          sendResponse({ ok: false, error: "Failed to open detached window." });
          return;
        }

        detachedWindows.set(createdWindow.id, tab.id);

        await ensureSelectionScript(tab.id);

        sendResponse({ ok: true, windowId: createdWindow?.id || null });
      } catch (error) {
        sendResponse({ ok: false, error: String(error) });
      }
    })();
    return true;
  }

  if (
    message.type === "REGISTER_DETACH_WINDOW" &&
    Number.isInteger(message.tabId) &&
    Number.isInteger(message.windowId)
  ) {
    debugLog("background", "REGISTER_DETACH_WINDOW", {
      tabId: message.tabId,
      windowId: message.windowId,
    });
    detachedWindows.set(message.windowId, message.tabId);
    sendResponse({ ok: true });
  }

  if (message.type === "PANEL_OPEN" && Number.isInteger(message.tabId)) {
    openPanelTabs.add(message.tabId);
    debugLog("background", "PANEL_OPEN", { tabId: message.tabId });
    ensurePanelOptions(message.tabId, "panel_open");
    ensureSelectionScript(message.tabId);
    chrome.tabs.sendMessage(message.tabId, { type: "PANEL_OPEN" }, () => {
      if (chrome.runtime.lastError) {
        // Ignore if the content script isn't available on this tab.
      }
    });
    sendResponse({ ok: true });
  }

  if (message.type === "PANEL_OPEN_ACTIVE") {
    (async () => {
      const tab = await getActiveTab();
      if (!tab?.id) {
        sendResponse({ ok: false, error: "No active tab." });
        return;
      }
      ensurePanelOptions(tab.id, "panel_open_active");
      openPanelTabs.add(tab.id);
      debugLog("background", "PANEL_OPEN_ACTIVE", { tabId: tab.id });
      ensureSelectionScript(tab.id);
      chrome.tabs.sendMessage(tab.id, { type: "PANEL_OPEN" }, () => {
        if (chrome.runtime.lastError) {
          // Ignore if the content script isn't available on this tab.
        }
      });
      sendResponse({ ok: true, tabId: tab.id });
    })();
    return true;
  }

  if (message.type === "PANEL_CLOSE" && Number.isInteger(message.tabId)) {
    openPanelTabs.delete(message.tabId);
    debugLog("background", "PANEL_CLOSE", { tabId: message.tabId });
    chrome.tabs.sendMessage(message.tabId, { type: "PANEL_CLOSE" }, () => {
      if (chrome.runtime.lastError) {
        // Ignore if the content script isn't available on this tab.
      }
    });
    sendResponse({ ok: true });
  }

  if (message.type === "PANEL_STATE") {
    const tabId = sender?.tab?.id;
    sendResponse({ open: Number.isInteger(tabId) && openPanelTabs.has(tabId) });
  }

  if (message.type === "PAGE_SELECTION" && sender?.tab?.id) {
    const tabId = sender.tab.id;
    const panelVisibleForTab =
      openPanelTabs.has(tabId) || hasDetachedWindowForTab(tabId);
    if (!panelVisibleForTab) {
      debugLog("background", "PAGE_SELECTION dropped (panel closed)", {
        tabId,
        url: message.url || "",
      });
      sendResponse({ ok: true, dropped: true });
      return;
    }
    debugLog("background", "PAGE_SELECTION", {
      tabId,
      textLength: typeof message.text === "string" ? message.text.length : 0,
      url: message.url || "",
    });
    const fallbackUrl = typeof sender.tab.url === "string" ? sender.tab.url : "";
    const fallbackTitle =
      typeof sender.tab.title === "string" ? sender.tab.title : "";
    chrome.runtime.sendMessage(
      {
        type: "PAGE_SELECTION",
        text: message.text,
        tabId,
        url: message.url || fallbackUrl,
        title: message.title || fallbackTitle,
      },
      () => {
        if (chrome.runtime.lastError) {
          // No side panel listening; ignore.
          debugLog("background", "PAGE_SELECTION forward failed", {
            error: chrome.runtime.lastError?.message || "",
          });
        }
      }
    );
    sendResponse({ ok: true });
  }

  if (message.type === "DEBUG_LOG") {
    if (!isTrustedSender) {
      sendResponse({ ok: false, error: "Untrusted sender." });
      return;
    }
    debugLog(message.scope || "unknown", message.message || "", message.data || {});
    sendResponse({ ok: true });
  }

  if (message.type === "GET_DEBUG_LOGS") {
    if (!isTrustedSender) {
      sendResponse({ ok: false, error: "Untrusted sender." });
      return;
    }
    sendResponse({ ok: true, logs: debugLogs });
  }

  if (message.type === "CLEAR_DEBUG_LOGS") {
    if (!isTrustedSender) {
      sendResponse({ ok: false, error: "Untrusted sender." });
      return;
    }
    debugLogs = [];
    sendResponse({ ok: true });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  openPanelTabs.delete(tabId);
});

chrome.windows.onRemoved.addListener((windowId) => {
  if (!detachedWindows.has(windowId)) return;
  const tabId = detachedWindows.get(windowId);
  detachedWindows.delete(windowId);
  if (!Number.isInteger(tabId)) return;

  (async () => {
    try {
      await chrome.sidePanel.setOptions({
        tabId,
        enabled: true,
        path: "sidepanel.html",
      });
      await chrome.sidePanel.open({ tabId });
    } catch (error) {
      // Best-effort reattach/open; ignore if the tab is gone.
    }
  })();
});
