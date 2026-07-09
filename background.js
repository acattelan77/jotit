const configurePanelBehavior = async () => {
  if (!chrome.sidePanel?.setPanelBehavior) return;
  try {
    // Keep the browser-managed action behavior enabled so `_execute_action`
    // keyboard shortcuts (e.g. Atlas/Chromium extension shortcuts) open the
    // side panel, while we still handle `chrome.action.onClicked` explicitly.
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (error) {
    // Ignore if a Chromium variant does not fully support panel behavior config.
  }
};

chrome.runtime.onInstalled.addListener(() => {
  void configurePanelBehavior();
});

chrome.runtime.onStartup.addListener(() => {
  void configurePanelBehavior();
});

void configurePanelBehavior();

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

const getTabById = (tabId) =>
  new Promise((resolve) => {
    if (!Number.isInteger(tabId)) {
      resolve(null);
      return;
    }
    chrome.tabs.get(tabId, (result) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(result || null);
    });
  });

const openDetachedPanelWindowForTab = async (tab, source = "unknown") => {
  if (!tab?.id) {
    return { ok: false, error: "No active tab found." };
  }

  debugLog("background", "DETACH_AND_OPEN", { tabId: tab.id, source });

  try {
    await ensurePanelOptions(tab.id, `detach_open:${source}`);
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
    debugLog("background", "DETACH_PANEL (pre-open)", { tabId: tab.id, source });
  } catch (error) {
    debugLog("background", "DETACH_PANEL failed (pre-open)", {
      tabId: tab.id,
      source,
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
    return { ok: false, error: "Failed to open detached window." };
  }

  detachedWindows.set(createdWindow.id, tab.id);

  await ensureSelectionScript(tab.id);

  return { ok: true, windowId: createdWindow.id };
};

const openSidePanelFromActionClick = async (clickedTab) => {
  const tab =
    clickedTab && Number.isInteger(clickedTab.id) ? clickedTab : await getActiveTab();
  if (!tab) return;

  const tabId = Number.isInteger(tab.id) ? tab.id : null;
  const windowId = Number.isInteger(tab.windowId) ? tab.windowId : null;

  if (!tabId && !windowId) return;

  // Start enabling the tab panel, but do not await before `open()` to preserve
  // the click gesture context required by `chrome.sidePanel.open()`.
  const ensurePanelPromise = tabId
    ? ensurePanelOptions(tabId, "action_click")
    : Promise.resolve();

  try {
    if (tabId) {
      await chrome.sidePanel.open({ tabId });
    } else {
      await chrome.sidePanel.open({ windowId });
    }
  } catch (error) {
    if (!tabId) throw error;
    await ensurePanelPromise;
    try {
      await chrome.sidePanel.open({ tabId });
    } catch (retryError) {
      debugLog("background", "ACTION_CLICK side panel blocked", {
        tabId,
        error: String(retryError),
      });

      // Atlas and other Chromium variants can refuse the extension side panel
      // when their own sidebar occupies the same UI slot. Fall back to the
      // existing standalone popup window in that case.
      const fallbackResult = await openDetachedPanelWindowForTab(
        tab,
        "action_click_fallback"
      );
      if (fallbackResult?.ok) {
        return;
      }
      throw retryError;
    }
  }

  await ensurePanelPromise;

  if (!tabId) return;

  openPanelTabs.add(tabId);
  debugLog("background", "ACTION_CLICK open", { tabId });
  await ensureSelectionScript(tabId);
  chrome.tabs.sendMessage(tabId, { type: "PANEL_OPEN" }, () => {
    if (chrome.runtime.lastError) {
      // Ignore if the content script isn't available on this tab.
    }
  });
};

chrome.action.onClicked.addListener((tab) => {
  (async () => {
    try {
      await openSidePanelFromActionClick(tab);
    } catch (error) {
      debugLog("background", "ACTION_CLICK open failed", {
        tabId: Number.isInteger(tab?.id) ? tab.id : null,
        error: String(error),
      });
    }
  })();
});

chrome.commands?.onCommand.addListener((command) => {
  if (command !== "open-jot-it") return;
  (async () => {
    try {
      await openSidePanelFromActionClick();
    } catch (error) {
      debugLog("background", "COMMAND open-jot-it failed", {
        error: String(error),
      });
    }
  })();
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
          tab = await getTabById(message.tabId);
        }
        if (!tab) {
          tab = await getActiveTab();
        }
        const result = await openDetachedPanelWindowForTab(tab, "message");
        sendResponse(result);
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
    return;
  }

  if (message.type === "PANEL_OPEN" && Number.isInteger(message.tabId)) {
    openPanelTabs.add(message.tabId);
    debugLog("background", "PANEL_OPEN", { tabId: message.tabId });
    void ensurePanelOptions(message.tabId, "panel_open");
    void ensureSelectionScript(message.tabId);
    chrome.tabs.sendMessage(message.tabId, { type: "PANEL_OPEN" }, () => {
      if (chrome.runtime.lastError) {
        // Ignore if the content script isn't available on this tab.
      }
    });
    sendResponse({ ok: true });
    return;
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
    return;
  }

  if (message.type === "PANEL_STATE") {
    const tabId = sender?.tab?.id;
    sendResponse({ open: Number.isInteger(tabId) && openPanelTabs.has(tabId) });
    return;
  }

  if (message.type === "PAGE_SELECTION_CANDIDATE" && sender?.tab?.id) {
    const tabId = sender.tab.id;
    const panelVisibleForTab =
      openPanelTabs.has(tabId) || hasDetachedWindowForTab(tabId);
    if (!panelVisibleForTab) {
      debugLog("background", "PAGE_SELECTION_CANDIDATE dropped (panel closed)", {
        tabId,
        url: message.url || "",
      });
      sendResponse({ ok: true, dropped: true });
      return;
    }
    debugLog("background", "PAGE_SELECTION_CANDIDATE", {
      tabId,
      textLength: typeof message.text === "string" ? message.text.length : 0,
      url: message.url || "",
    });
    const fallbackUrl = typeof sender.tab.url === "string" ? sender.tab.url : "";
    const fallbackTitle =
      typeof sender.tab.title === "string" ? sender.tab.title : "";
    chrome.runtime.sendMessage(
      {
        type: "PAGE_SELECTION_CANDIDATE",
        text: message.text,
        tabId,
        url: message.url || fallbackUrl,
        title: message.title || fallbackTitle,
      },
      () => {
        if (chrome.runtime.lastError) {
          // No side panel listening; ignore.
          debugLog("background", "PAGE_SELECTION_CANDIDATE forward failed", {
            error: chrome.runtime.lastError?.message || "",
          });
        }
      }
    );
    sendResponse({ ok: true });
    return;
  }

  if (message.type === "DEBUG_LOG") {
    if (!isTrustedSender) {
      sendResponse({ ok: false, error: "Untrusted sender." });
      return;
    }
    debugLog(message.scope || "unknown", message.message || "", message.data || {});
    sendResponse({ ok: true });
    return;
  }

  if (message.type === "GET_DEBUG_LOGS") {
    if (!isTrustedSender) {
      sendResponse({ ok: false, error: "Untrusted sender." });
      return;
    }
    sendResponse({ ok: true, logs: debugLogs });
    return;
  }

  if (message.type === "CLEAR_DEBUG_LOGS") {
    if (!isTrustedSender) {
      sendResponse({ ok: false, error: "Untrusted sender." });
      return;
    }
    debugLogs = [];
    sendResponse({ ok: true });
    return;
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
