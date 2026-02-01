const STORAGE_KEY = "noteDraft";
const meetingNameInput = document.getElementById("meetingName");
const titleLockButton = document.getElementById("titleLockButton");
const meetingDateInput = document.getElementById("meetingDate");
const meetingDateDisplay = document.getElementById("meetingDateDisplay");
const notesInput = document.getElementById("notes");
const setNowButton = document.getElementById("setNow");
const openDatePickerButton = document.getElementById("openDatePicker");
const datePicker = document.getElementById("datePicker");
const dateGrid = document.getElementById("dateGrid");
const dateMonthLabel = document.getElementById("dateMonth");
const datePrev = document.getElementById("datePrev");
const dateNext = document.getElementById("dateNext");
const dateToday = document.getElementById("dateToday");
const dateDone = document.getElementById("dateDone");
const timeHourDec = document.getElementById("timeHourDec");
const timeHourInc = document.getElementById("timeHourInc");
const timeMinuteDec = document.getElementById("timeMinuteDec");
const timeMinuteInc = document.getElementById("timeMinuteInc");
const timeHourValue = document.getElementById("timeHourValue");
const timeMinuteValue = document.getElementById("timeMinuteValue");
const openWindowButton = document.getElementById("openWindow");
const attachWindowButton = document.getElementById("attachWindow");
const saveButton = document.getElementById("saveBtn");
const clearButton = document.getElementById("clearBtn");
const toolbar = document.querySelector(".toolbar");
const editorStack = document.querySelector(".editor-stack");
const statusMessage = document.getElementById("statusMessage");
const contextSuggestion = document.getElementById("contextSuggestion");

const NoteUtils = window.NoteUtils;
if (!NoteUtils) {
  throw new Error("NoteUtils not loaded.");
}

const {
  toLocalDateTimeValue,
  formatDateTime,
  sanitizeMeetingName,
  slugify,
  buildFilename,
  normalizeUrl,
  htmlToMarkdown,
  markdownToHtml,
} = NoteUtils;

const CONTEXT_KEY = "contextByHost";
const DEBUG_KEY = "debugLogsEnabled";
const TITLE_LOCK_KEY = "titleLockEnabled";

let statusTimer;
let toastTimer;
let lastToastAt = 0;
let lastAutoTitle = "";
let currentPageTitle = "";
let userEditedTitle = false;
let lastAutoTabId = null;
let lastAutoTabUrl = "";
let pickerOpen = false;
let pickerMonth = null;
let currentPageUrl = "";
let panelTabId = null;
let lastNotesRange = null;
let lastNotesInserted = { text: "", url: "" };
let lastNotesInsertedAt = 0;
let lastCaretOffset = null;
let pageHistory = [];
let debugEnabled = false;
let contextByHost = {};
let titleLocked = false;
const urlParams = new URLSearchParams(window.location.search);
const isStandalone = urlParams.get("standalone") === "1";
const sourceTabIdParam = Number(urlParams.get("sourceTabId"));
const sourceTabId =
  Number.isInteger(sourceTabIdParam) && sourceTabIdParam > 0
    ? sourceTabIdParam
    : null;
const sourceTitleParam = urlParams.get("sourceTitle") || "";
const sourceUrlParam = urlParams.get("sourceUrl") || "";

if (isStandalone) {
  document.body.classList.add("standalone");
}

const showToast = (message, { timeoutMs = 1800, minIntervalMs = 0 } = {}) => {
  if (!statusMessage) return;
  const now = Date.now();
  if (minIntervalMs && now - lastToastAt < minIntervalMs) return;
  lastToastAt = now;
  window.clearTimeout(toastTimer);
  statusMessage.textContent = message || "";
  statusMessage.classList.toggle("is-visible", Boolean(message));
  if (timeoutMs > 0) {
    toastTimer = window.setTimeout(() => {
      if (statusMessage.textContent === message) {
        statusMessage.textContent = "";
        statusMessage.classList.remove("is-visible");
      }
    }, timeoutMs);
  }
};

const debugLog = (message, data = {}) => {
  if (!debugEnabled) return;
  try {
    console.log("[Jot it][panel]", message, data);
    chrome.runtime.sendMessage({
      type: "DEBUG_LOG",
      scope: "panel",
      message,
      data,
    });
  } catch (error) {
    // ignore
  }
};

const loadDebugFlag = () => {
  chrome.storage.local.get(DEBUG_KEY, (result) => {
    if (chrome.runtime.lastError) return;
    debugEnabled = Boolean(result?.[DEBUG_KEY]);
  });
};

const updateTitleLockButton = () => {
  if (!titleLockButton) return;
  titleLockButton.classList.toggle("is-locked", titleLocked);
  const label = titleLocked ? "Unlock context title" : "Lock context title";
  titleLockButton.setAttribute("aria-label", label);
  titleLockButton.setAttribute("title", label);
  titleLockButton.dataset.label = titleLocked ? "Unlock" : "Lock";
};

const setStatus = (message, timeoutMs = 0) => {
  showToast(message, { timeoutMs, minIntervalMs: 0 });
};

const reportError = (message, error) => {
  console.warn(message, error);
  setStatus(message, 5000);
};

const storageGet = (key) =>
  new Promise((resolve, reject) => {
    chrome.storage.local.get(key, (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(result);
    });
  });

const storageGetMultiple = (keys) =>
  new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(result || {});
    });
  });

const storageSet = (data) =>
  new Promise((resolve, reject) => {
    chrome.storage.local.set(data, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve();
    });
  });

const setTitleLocked = (locked, { persist = true } = {}) => {
  const nextValue = Boolean(locked);
  if (titleLocked === nextValue) return;
  titleLocked = nextValue;
  updateTitleLockButton();
  if (persist) {
    storageSet({ [TITLE_LOCK_KEY]: titleLocked }).catch(() => {});
  }
};

const storageRemove = (key) =>
  new Promise((resolve, reject) => {
    chrome.storage.local.remove(key, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve();
    });
  });

const debounce = (fn, wait = 250) => {
  let timeoutId;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => fn(...args), wait);
  };
};


if (chrome?.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (Object.prototype.hasOwnProperty.call(changes, DEBUG_KEY)) {
      debugEnabled = Boolean(changes[DEBUG_KEY].newValue);
    }
    if (Object.prototype.hasOwnProperty.call(changes, TITLE_LOCK_KEY)) {
      titleLocked = Boolean(changes[TITLE_LOCK_KEY].newValue);
      updateTitleLockButton();
    }
  });
}

loadDebugFlag();
debugLog("panel initialized");

const getCurrentHost = () => {
  if (!currentPageUrl) return null;
  const normalized = normalizeUrl(currentPageUrl) || currentPageUrl;
  try {
    return new URL(normalized).hostname;
  } catch (error) {
    return null;
  }
};

const updateContextSuggestion = () => {
  if (!contextSuggestion) return;
  const host = getCurrentHost();
  const entry = host ? contextByHost[host] : null;
  const value = typeof entry?.value === "string" ? entry.value.trim() : "";
  if (!value) {
    contextSuggestion.hidden = true;
    return;
  }
  if (meetingNameInput.value.trim() === value) {
    contextSuggestion.hidden = true;
    return;
  }
  contextSuggestion.textContent = `Use last: ${value}`;
  contextSuggestion.hidden = false;
};

const rememberContextForHost = (value) => {
  const host = getCurrentHost();
  if (!host) return;
  const trimmed = value.trim();
  if (!trimmed || trimmed === currentPageTitle) return;
  contextByHost[host] = { value: trimmed, updatedAt: Date.now() };
  const entries = Object.entries(contextByHost);
  if (entries.length > 100) {
    entries
      .sort((a, b) => (a[1].updatedAt || 0) - (b[1].updatedAt || 0))
      .slice(0, entries.length - 100)
      .forEach(([key]) => delete contextByHost[key]);
  }
  storageSet({ [CONTEXT_KEY]: contextByHost }).catch((error) => {
    console.warn("Couldn't store context suggestions.", error);
  });
};

const recordPageVisit = (url, title) => {
  const normalized = normalizeUrl(url);
  if (!normalized) return;
  const safeTitle =
    typeof title === "string" && title.trim() ? title.trim() : normalized;
  const lastEntry = pageHistory[pageHistory.length - 1];
  if (lastEntry?.url === normalized) {
    lastEntry.title = safeTitle;
    return;
  }
  if (pageHistory.some((entry) => entry.url === normalized)) return;
  pageHistory.push({ url: normalized, title: safeTitle, visitedAt: Date.now() });
  if (pageHistory.length > 100) {
    pageHistory = pageHistory.slice(-100);
  }
};

const buildVisitedPagesMarkdown = () => {
  if (!pageHistory.length) return "";
  pageHistory = pageHistory.filter((entry) => normalizeUrl(entry.url) === entry.url);
  if (!pageHistory.length) return "";
  const lines = pageHistory.map((entry) => {
    if (entry.title && entry.title !== entry.url) {
      return `- [${entry.title}](${entry.url})`;
    }
    return `- ${entry.url}`;
  });
  return `---\n\n## Pages visited\n${lines.join("\n")}\n`;
};

const buildVisitedPagesText = () => {
  if (!pageHistory.length) return "";
  pageHistory = pageHistory.filter((entry) => normalizeUrl(entry.url) === entry.url);
  if (!pageHistory.length) return "";
  const lines = pageHistory.map((entry) => {
    if (entry.title && entry.title !== entry.url) {
      return `- ${entry.title} — ${entry.url}`;
    }
    return `- ${entry.url}`;
  });
  return `\n---\nPages visited:\n${lines.join("\n")}\n`;
};

const removeLegacySourceLines = () => {
  const candidates = notesInput.querySelectorAll("p");
  let removed = false;
  candidates.forEach((node) => {
    const text = node.textContent.trim();
    if (/^Source:\s+.+https?:\/\//i.test(text)) {
      node.remove();
      removed = true;
    }
  });
  if (removed) {
    debouncedSaveDraft();
  }
};

const getCaretOffset = () => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!notesInput.contains(range.startContainer)) return null;
  const preRange = range.cloneRange();
  preRange.selectNodeContents(notesInput);
  preRange.setEnd(range.endContainer, range.endOffset);
  return preRange.toString().length;
};

const restoreCaretOffset = (targetOffset) => {
  if (!Number.isInteger(targetOffset)) return;
  const walker = document.createTreeWalker(
    notesInput,
    NodeFilter.SHOW_TEXT,
    null
  );
  let currentOffset = 0;
  let node = walker.nextNode();
  while (node) {
    const nextOffset = currentOffset + node.textContent.length;
    if (targetOffset <= nextOffset) {
      const range = document.createRange();
      range.setStart(node, Math.max(0, targetOffset - currentOffset));
      range.collapse(true);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      lastNotesRange = range.cloneRange();
      return;
    }
    currentOffset = nextOffset;
    node = walker.nextNode();
  }
  const range = document.createRange();
  range.selectNodeContents(notesInput);
  range.collapse(false);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  lastNotesRange = range.cloneRange();
  if (Number.isInteger(targetOffset)) {
    lastCaretOffset = targetOffset;
  }
};

const createPopupWindow = (options) =>
  new Promise((resolve) => {
    chrome.windows.create(options, (createdWindow) => {
      if (chrome.runtime.lastError) {
        reportError("Couldn't open detached window.", chrome.runtime.lastError);
        resolve(null);
        return;
      }
      resolve(createdWindow || null);
    });
  });

const ensureSelectionInNotes = () => {
  const selection = window.getSelection();
  if (!selection) return null;
  const hasRange = selection.rangeCount > 0;
  const inNotes = selection.anchorNode && notesInput.contains(selection.anchorNode);
  if (hasRange && inNotes) {
    return selection;
  }

  const range = document.createRange();
  range.selectNodeContents(notesInput);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
  return selection;
};

const updateEditorStackFocus = () => {
  if (!editorStack) return;
  if (document.hasFocus() && editorStack.contains(document.activeElement)) {
    editorStack.classList.add("is-focused");
  } else {
    editorStack.classList.remove("is-focused");
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
      } else {
        chrome.tabs.query({ active: true }, (allTabs) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          resolve(allTabs && allTabs.length ? allTabs[0] : null);
        });
      }
    });
  });

const shouldAutoUpdateTitle = () => {
  return !titleLocked;
};

const updateTitleFromActiveTab = async () => {
  if (isStandalone) {
    if (Number.isInteger(sourceTabId)) {
      try {
        const tab = await new Promise((resolve) => {
          chrome.tabs.get(sourceTabId, (result) => {
            if (chrome.runtime.lastError) {
              resolve(null);
              return;
            }
            resolve(result || null);
          });
        });
        if (tab) {
          const title = typeof tab.title === "string" ? tab.title.trim() : "";
          currentPageTitle = title;
          if (shouldAutoUpdateTitle()) {
            meetingNameInput.value = title;
            lastAutoTitle = title;
            userEditedTitle = false;
          }
          currentPageUrl = typeof tab.url === "string" ? tab.url : "";
          recordPageVisit(currentPageUrl, currentPageTitle);
          updateContextSuggestion();
          debouncedSaveDraft();
          return;
        }
      } catch (error) {
        // fall through to params
      }
    }
    if (sourceTitleParam) {
      currentPageTitle = sourceTitleParam;
      if (shouldAutoUpdateTitle()) {
        meetingNameInput.value = sourceTitleParam;
        lastAutoTitle = sourceTitleParam;
        userEditedTitle = false;
      }
      if (sourceUrlParam) {
        currentPageUrl = sourceUrlParam;
      }
      recordPageVisit(currentPageUrl, currentPageTitle);
      updateContextSuggestion();
      debouncedSaveDraft();
      return;
    }
  }
  const tab = await getActiveTab();
  if (!tab) return;
  const title = typeof tab.title === "string" ? tab.title.trim() : "";
  currentPageTitle = title;
  const tabId = Number.isInteger(tab.id) ? tab.id : null;
  const tabUrl = typeof tab.url === "string" ? tab.url : "";
  const tabChanged = tabId !== lastAutoTabId || tabUrl !== lastAutoTabUrl;
  const shouldUpdateTitle = shouldAutoUpdateTitle();
  if (!tabChanged && !shouldUpdateTitle) return;
  let didUpdate = false;
  if (shouldUpdateTitle) {
    meetingNameInput.value = title;
    lastAutoTitle = title;
    userEditedTitle = false;
    didUpdate = true;
  }
  if (tabChanged) {
    lastAutoTabId = tabId;
    lastAutoTabUrl = tabUrl;
    currentPageUrl = tabUrl;
    recordPageVisit(currentPageUrl, currentPageTitle);
    updateContextSuggestion();
    didUpdate = true;
  }
  if (didUpdate) {
    debouncedSaveDraft();
  }
};

const announcePanelOpen = (tabId) => {
  if (!Number.isInteger(tabId)) return;
  chrome.runtime.sendMessage({ type: "PANEL_OPEN", tabId }, () => {
    if (chrome.runtime.lastError) {
      // Background may be sleeping; ignore.
    }
  });
};

const setPanelTabId = (tabId) => {
  if (!Number.isInteger(tabId)) return;
  if (panelTabId === tabId) return;
  if (panelTabId) {
    chrome.runtime.sendMessage({ type: "PANEL_CLOSE", tabId: panelTabId }, () => {
      if (chrome.runtime.lastError) {
        // Background may be sleeping; ignore.
      }
    });
  }
  panelTabId = tabId;
  announcePanelOpen(panelTabId);
};

const syncPanelOpenState = () => {
  if (panelTabId) {
    announcePanelOpen(panelTabId);
    return;
  }
  chrome.runtime.sendMessage({ type: "PANEL_OPEN_ACTIVE" }, (response) => {
    if (chrome.runtime.lastError) {
      return;
    }
    if (response?.tabId && Number.isInteger(response.tabId)) {
      panelTabId = response.tabId;
    }
  });
};


const applyFormat = (format) => {
  notesInput.focus();
  const selection = ensureSelectionInNotes();

  switch (format) {
    case "bold":
      document.execCommand("bold", false, null);
      break;
    case "italic":
      document.execCommand("italic", false, null);
      break;
    case "heading":
      if (!selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      const selectedText = range.toString() || "Heading";
      const h2 = document.createElement("h2");
      h2.textContent = selectedText;
      range.deleteContents();
      range.insertNode(h2);
      break;
    case "ul":
      document.execCommand("insertUnorderedList", false, null);
      break;
    case "ol":
      document.execCommand("insertOrderedList", false, null);
      break;
    case "code":
      if (!selection || selection.rangeCount === 0) return;
      const codeRange = selection.getRangeAt(0);
      const codeText = codeRange.toString() || "code";
      const code = document.createElement("code");
      code.textContent = codeText;
      codeRange.deleteContents();
      codeRange.insertNode(code);
      break;
    case "link":
      if (!selection || selection.rangeCount === 0) return;
      const linkRange = selection.getRangeAt(0);
      const linkText = linkRange.toString() || "link";
      const url = normalizeUrl(prompt("Enter URL:", "https://"));
      if (url) {
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = linkText;
        linkRange.deleteContents();
        linkRange.insertNode(a);
      }
      break;
  }

  debouncedSaveDraft();
  updateToolbarState();
};

const isSelectionInNotes = () => {
  const selection = window.getSelection();
  if (!selection || !selection.anchorNode) return false;
  return notesInput.contains(selection.anchorNode);
};

const findClosestTag = (node, tags) => {
  let current = node;
  while (current && current !== notesInput) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const tag = current.tagName.toLowerCase();
      if (tags.includes(tag)) {
        return tag;
      }
    }
    current = current.parentNode;
  }
  return null;
};

const updateToolbarState = () => {
  if (!toolbar) return;
  const buttons = {
    bold: toolbar.querySelector('[data-format="bold"]'),
    italic: toolbar.querySelector('[data-format="italic"]'),
    heading: toolbar.querySelector('[data-format="heading"]'),
    ul: toolbar.querySelector('[data-format="ul"]'),
    ol: toolbar.querySelector('[data-format="ol"]'),
  };

  if (!isSelectionInNotes()) {
    Object.values(buttons).forEach((button) =>
      button?.classList.remove("active")
    );
    return;
  }

  const safeQueryState = (command) => {
    try {
      return document.queryCommandState(command);
    } catch (error) {
      return false;
    }
  };

  const selection = window.getSelection();
  const anchorNode = selection?.anchorNode || selection?.focusNode;
  const headingTag = anchorNode
    ? findClosestTag(anchorNode, ["h1", "h2", "h3"])
    : null;
  const unorderedActive =
    safeQueryState("insertUnorderedList") ||
    Boolean(anchorNode && findClosestTag(anchorNode, ["ul"]));
  const orderedActive =
    safeQueryState("insertOrderedList") ||
    Boolean(anchorNode && findClosestTag(anchorNode, ["ol"]));

  buttons.bold?.classList.toggle("active", safeQueryState("bold"));
  buttons.italic?.classList.toggle("active", safeQueryState("italic"));
  buttons.heading?.classList.toggle("active", Boolean(headingTag));
  buttons.ul?.classList.toggle("active", unorderedActive);
  buttons.ol?.classList.toggle("active", orderedActive);
};

const buildMarkdown = ({ meetingName, meetingDate, notes }) => {
  const title = sanitizeMeetingName(meetingName);
  const parsedDate = meetingDate ? new Date(meetingDate) : new Date();
  const dateLine = formatDateTime(parsedDate);
  const body = notes.trim() ? `${notes.trim()}\n` : "";
  const visitedSection = buildVisitedPagesMarkdown();

  return `# ${title}\n\n- Date: ${dateLine}\n\n---\n\n${body}${
    visitedSection ? `\n${visitedSection}` : ""
  }`;
};

const getFormData = () => ({
  meetingName: meetingNameInput.value,
  meetingDate: meetingDateInput.value,
  notes: htmlToMarkdown(notesInput.innerHTML),
  notesText: notesInput.textContent || "",
  pageUrl: currentPageUrl,
  pageTitle: currentPageTitle,
});

const getDraftData = () => ({
  ...getFormData(),
  cursorOffset: lastCaretOffset,
  editorFocused: document.activeElement === notesInput,
});

const setFormData = ({ meetingName, meetingDate, notes, pageUrl }) => {
  meetingNameInput.value = meetingName || "";
  meetingDateInput.value = meetingDate || toLocalDateTimeValue();
  updateMeetingDateDisplay(meetingDateInput.value);
  currentPageUrl = pageUrl || currentPageUrl;
  notesInput.innerHTML = markdownToHtml(notes || "");
  removeLegacySourceLines();
};

const saveDraft = async () => {
  const draft = getDraftData();
  try {
    await storageSet({ [STORAGE_KEY]: draft });
    showToast("Saved locally", { timeoutMs: 1400, minIntervalMs: 5000 });
  } catch (error) {
    reportError("Couldn't save draft locally.", error);
  }
};

const debouncedSaveDraft = debounce(saveDraft, 300);
const debouncedRememberContext = debounce(rememberContextForHost, 600);

const resetEditorFormatting = () => {
  notesInput.focus();
  document.execCommand("removeFormat", false, null);
  try {
    if (document.queryCommandState("bold")) {
      document.execCommand("bold", false, null);
    }
    if (document.queryCommandState("italic")) {
      document.execCommand("italic", false, null);
    }
  } catch (error) {
    // Ignore if the browser doesn't support queryCommandState here.
  }
  notesInput.blur();
};

const downloadMarkdown = (
  markdown,
  filename,
  { saveAs, conflictAction, mimeType = "text/markdown" }
) =>
  new Promise((resolve, reject) => {
    const blob = new Blob([markdown], { type: mimeType });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download(
      {
        url,
        filename,
        saveAs,
        conflictAction,
      },
      (downloadId) => {
        URL.revokeObjectURL(url);
        if (chrome.runtime.lastError || !downloadId) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve(downloadId);
      }
    );
  });

const handleSave = async () => {
  const data = getFormData();
  const filename = buildFilename(data);
  const markdown = buildMarkdown(data);

  const payload = markdown;
  const mimeType = "text/markdown";

  try {
    await downloadMarkdown(payload, filename, {
      saveAs: false,
      conflictAction: "uniquify",
      mimeType,
    });
  } catch (error) {
    try {
      await downloadMarkdown(payload, filename, {
        saveAs: true,
        conflictAction: "uniquify",
        mimeType,
      });
    } catch (fallbackError) {
      reportError("Save failed. Please try again.", fallbackError);
      window.alert("Save failed. Please try again.");
      return;
    }
  }
  showToast("Exported", { timeoutMs: 1800 });
  notesInput.focus();
};

const handleClear = async () => {
  const hasContent = meetingNameInput.value || notesInput.textContent.trim();
  if (hasContent && !window.confirm("Clear this note and start fresh?")) {
    return;
  }

  setFormData({
    meetingName: "",
    meetingDate: toLocalDateTimeValue(),
    notes: "",
  });
  updateTitleFromActiveTab().catch(() => {});
  try {
    await storageRemove(STORAGE_KEY);
  } catch (error) {
    reportError("Couldn't clear the saved draft.", error);
  }
  resetEditorFormatting();
  notesInput.focus();
};

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!message || message.type !== "PAGE_SELECTION") return;
  if (typeof message.text !== "string" || !message.text.trim()) return;
  const now = Date.now();
  const incomingUrl =
    typeof message.url === "string" ? message.url : "";
  debugLog("PAGE_SELECTION received", {
    length: message.text.length,
    url: incomingUrl,
    tabId: message.tabId,
  });
  if (
    message.text === lastNotesInserted.text &&
    incomingUrl === lastNotesInserted.url &&
    now - lastNotesInsertedAt < 1000
  ) {
    debugLog("PAGE_SELECTION deduped", { url: incomingUrl });
    return;
  }
  const senderTabId = Number.isInteger(message.tabId)
    ? message.tabId
    : sender?.tab?.id;
  if (isStandalone && Number.isInteger(sourceTabId)) {
    if (senderTabId !== sourceTabId) return;
  }
  if (message.url || message.title) {
    recordPageVisit(message.url, message.title);
  }
  insertSelectionWithLink(message.text, message.url || currentPageUrl);
  debugLog("selection inserted", { url: message.url || currentPageUrl });
  lastNotesInserted = { text: message.text, url: incomingUrl };
  lastNotesInsertedAt = now;
  debouncedSaveDraft();
});
const handleMeetingNameInput = () => {
  const value = meetingNameInput.value.trim();
  userEditedTitle = value !== "" && value !== lastAutoTitle;
  setTitleLocked(true);
  debouncedSaveDraft();
  debouncedRememberContext(value);
  updateContextSuggestion();
};

const storeNotesSelection = () => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  if (!notesInput.contains(range.startContainer)) return;
  lastNotesRange = range.cloneRange();
  const offset = getCaretOffset();
  if (Number.isInteger(offset)) {
    lastCaretOffset = offset;
  }
};

const getInsertRange = () => {
  if (lastNotesRange && notesInput.contains(lastNotesRange.startContainer)) {
    return lastNotesRange;
  }
  const selection = ensureSelectionInNotes();
  if (selection && selection.rangeCount) {
    const range = selection.getRangeAt(0);
    lastNotesRange = range.cloneRange();
    return range;
  }
  return null;
};

const insertSelectionWithLink = (text, url) => {
  if (!text) return;
  const normalizedUrl = normalizeUrl(url);
  notesInput.focus();
  const em = document.createElement("em");
  em.textContent = text;
  const block = document.createElement("p");
  block.appendChild(em);
  if (normalizedUrl) {
    block.appendChild(document.createTextNode(" "));
    const anchor = document.createElement("a");
    anchor.href = normalizedUrl;
    anchor.textContent = normalizedUrl;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    block.appendChild(anchor);
  }
  const spacer = document.createElement("p");
  spacer.appendChild(document.createElement("br"));
  const fragment = document.createDocumentFragment();
  fragment.appendChild(block);
  fragment.appendChild(spacer);
  let lastNode = spacer;
  const range = getInsertRange();
  if (!range) {
    notesInput.appendChild(fragment);
    return;
  }
  range.deleteContents();
  range.insertNode(fragment);
  range.setStartAfter(lastNode);
  range.collapse(true);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  lastNotesRange = range.cloneRange();
};

const attachTabListeners = () => {
  if (!chrome.tabs) return;
  if (isStandalone) {
    if (Number.isInteger(sourceTabId)) {
      chrome.tabs.onUpdated?.addListener((tabId, info) => {
        if (tabId !== sourceTabId) return;
        if (info.title || info.url) {
          updateTitleFromActiveTab().catch(() => {});
        }
      });
    }
    return;
  }
  chrome.tabs.onActivated?.addListener((info) => {
    if (info?.tabId) {
      setPanelTabId(info.tabId);
    }
    updateTitleFromActiveTab().catch(() => {});
  });
  chrome.tabs.onUpdated?.addListener((tabId, info) => {
    if (info.title || info.url) {
      updateTitleFromActiveTab().catch(() => {});
    }
  });
};

const pad2 = (value) => String(value).padStart(2, "0");

const parseDateValue = (value) => {
  if (!value) return null;
  const [datePart, timePart] = value.split("T");
  if (!datePart || !timePart) return null;
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }
  const date = new Date(year, month - 1, day, hour || 0, minute || 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
};

const updateMeetingDateDisplay = (value) => {
  if (!meetingDateDisplay) return;
  const parsed = parseDateValue(value);
  meetingDateDisplay.textContent = parsed ? formatDateTime(parsed) : "";
};

const setMeetingDateValue = (date) => {
  if (!date) return;
  const value = `${date.getFullYear()}-${pad2(
    date.getMonth() + 1
  )}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(
    date.getMinutes()
  )}`;
  meetingDateInput.value = value;
  updateMeetingDateDisplay(value);
  debouncedSaveDraft();
};

const getSelectedDate = () =>
  parseDateValue(meetingDateInput.value) || new Date();

const renderDatePicker = () => {
  if (!dateGrid || !dateMonthLabel || !pickerMonth) return;
  const selected = getSelectedDate();
  const year = pickerMonth.getFullYear();
  const month = pickerMonth.getMonth();

  const formatter = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  });
  dateMonthLabel.textContent = formatter.format(pickerMonth);

  dateGrid.innerHTML = "";
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const startDate = new Date(year, month, 1 - startOffset);

  for (let i = 0; i < 42; i += 1) {
    const current = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate() + i
    );
    const button = document.createElement("button");
    button.type = "button";
    button.className = "date-picker__day";
    if (current.getMonth() !== month) {
      button.classList.add("is-muted");
    }
    if (
      current.getFullYear() === selected.getFullYear() &&
      current.getMonth() === selected.getMonth() &&
      current.getDate() === selected.getDate()
    ) {
      button.classList.add("is-selected");
    }
    button.textContent = String(current.getDate());
    button.addEventListener("click", () => {
      const updated = new Date(selected);
      updated.setFullYear(
        current.getFullYear(),
        current.getMonth(),
        current.getDate()
      );
      setMeetingDateValue(updated);
      renderDatePicker();
    });
    dateGrid.appendChild(button);
  }

  const hourValue = pad2(selected.getHours());
  const minuteValue = pad2(selected.getMinutes());
  if (timeHourValue) timeHourValue.textContent = hourValue;
  if (timeMinuteValue) timeMinuteValue.textContent = minuteValue;
};

const adjustTime = ({ hourDelta = 0, minuteDelta = 0 } = {}) => {
  const selected = getSelectedDate();
  let hour = selected.getHours();
  let minute = selected.getMinutes();
  minute += minuteDelta;
  while (minute < 0) {
    minute += 60;
    hour -= 1;
  }
  while (minute >= 60) {
    minute -= 60;
    hour += 1;
  }
  hour = (hour + hourDelta) % 24;
  if (hour < 0) hour += 24;
  selected.setHours(hour, minute, 0, 0);
  setMeetingDateValue(selected);
  renderDatePicker();
};

const openDatePicker = () => {
  if (!datePicker) return;
  pickerOpen = true;
  datePicker.classList.add("is-open");
  datePicker.setAttribute("aria-hidden", "false");
  const selected = getSelectedDate();
  pickerMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
  renderDatePicker();
};

const closeDatePicker = () => {
  if (!datePicker) return;
  pickerOpen = false;
  datePicker.classList.remove("is-open");
  datePicker.setAttribute("aria-hidden", "true");
};

const init = async () => {
  // Time controls are rendered dynamically in the date picker.
  let draft = null;
  try {
    const result = await storageGetMultiple([
      STORAGE_KEY,
      CONTEXT_KEY,
      TITLE_LOCK_KEY,
    ]);
    if (result[CONTEXT_KEY]) {
      contextByHost = result[CONTEXT_KEY] || {};
    }
    if (Object.prototype.hasOwnProperty.call(result, TITLE_LOCK_KEY)) {
      titleLocked = Boolean(result[TITLE_LOCK_KEY]);
    }
    if (result && result[STORAGE_KEY]) {
      draft = result[STORAGE_KEY];
      setFormData(draft);
    } else {
      meetingDateInput.value = toLocalDateTimeValue();
      updateMeetingDateDisplay(meetingDateInput.value);
    }
  } catch (error) {
    reportError("Couldn't load the saved draft.", error);
    meetingDateInput.value = toLocalDateTimeValue();
    updateMeetingDateDisplay(meetingDateInput.value);
  }
  updateTitleLockButton();
  userEditedTitle = Boolean(meetingNameInput.value.trim());
  if (draft && Number.isInteger(draft.cursorOffset)) {
    lastCaretOffset = draft.cursorOffset;
    if (draft.editorFocused) {
      notesInput.focus();
      requestAnimationFrame(() => restoreCaretOffset(draft.cursorOffset));
    }
  }
  updateTitleFromActiveTab().catch(() => {});
  if (isStandalone && Number.isInteger(sourceTabId)) {
    setPanelTabId(sourceTabId);
  } else {
    const tab = await getActiveTab();
    if (tab?.id) {
      setPanelTabId(tab.id);
    }
  }
  if (!notesInput.innerHTML.trim()) {
    resetEditorFormatting();
  }
  updateToolbarState();
  updateContextSuggestion();
  syncPanelOpenState();
};

attachTabListeners();

titleLockButton?.addEventListener("click", () => {
  const nextValue = !titleLocked;
  setTitleLocked(nextValue);
  if (!nextValue) {
    updateTitleFromActiveTab().catch(() => {});
  }
});

meetingNameInput.addEventListener("input", handleMeetingNameInput);
contextSuggestion?.addEventListener("click", () => {
  const host = getCurrentHost();
  const entry = host ? contextByHost[host] : null;
  const value = typeof entry?.value === "string" ? entry.value.trim() : "";
  if (!value) return;
  meetingNameInput.value = value;
  userEditedTitle = true;
  setTitleLocked(true);
  debouncedSaveDraft();
  updateContextSuggestion();
});
notesInput.addEventListener("keyup", storeNotesSelection);
notesInput.addEventListener("mouseup", storeNotesSelection);
notesInput.addEventListener("focus", storeNotesSelection);
notesInput.addEventListener("input", () => {
  storeNotesSelection();
  debouncedSaveDraft();
});
notesInput.addEventListener("paste", (event) => {
  const clipboard = event.clipboardData;
  if (!clipboard) return;
  event.preventDefault();
  const text = clipboard.getData("text/plain");
  document.execCommand("insertText", false, text || "");
});

// Removed toggle controls; source is always appended to notes.

setNowButton.addEventListener("click", () => {
  setMeetingDateValue(new Date());
  renderDatePicker();
});

openDatePickerButton?.addEventListener("click", openDatePicker);
meetingDateDisplay?.addEventListener("click", openDatePicker);
meetingDateDisplay?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openDatePicker();
  }
});
datePrev?.addEventListener("click", () => {
  if (!pickerMonth) return;
  pickerMonth = new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() - 1, 1);
  renderDatePicker();
});
dateNext?.addEventListener("click", () => {
  if (!pickerMonth) return;
  pickerMonth = new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() + 1, 1);
  renderDatePicker();
});
dateToday?.addEventListener("click", () => {
  setMeetingDateValue(new Date());
  pickerMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  renderDatePicker();
});
dateDone?.addEventListener("click", closeDatePicker);
timeHourDec?.addEventListener("click", () => adjustTime({ hourDelta: -1 }));
timeHourInc?.addEventListener("click", () => adjustTime({ hourDelta: 1 }));
timeMinuteDec?.addEventListener("click", () => adjustTime({ minuteDelta: -1 }));
timeMinuteInc?.addEventListener("click", () => adjustTime({ minuteDelta: 1 }));

document.addEventListener("click", (event) => {
  if (!pickerOpen || !datePicker) return;
  const target = event.target;
  if (
    target instanceof Node &&
    (datePicker.contains(target) ||
      openDatePickerButton?.contains(target) ||
      meetingDateDisplay?.contains(target))
  ) {
    return;
  }
  closeDatePicker();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && pickerOpen) {
    closeDatePicker();
  }
});

window.addEventListener("beforeunload", () => {
  if (panelTabId) {
    chrome.runtime.sendMessage({ type: "PANEL_CLOSE", tabId: panelTabId }, () => {
      if (chrome.runtime.lastError) {
        // Background may be sleeping; ignore.
      }
    });
  }
});

saveButton.addEventListener("click", handleSave);
clearButton.addEventListener("click", handleClear);
  openWindowButton?.addEventListener("click", async () => {
    const tab = await getActiveTab();
    const tabId = Number.isInteger(panelTabId) ? panelTabId : tab?.id;
    try {
      const response = await chrome.runtime.sendMessage({
        type: "DETACH_AND_OPEN",
        tabId,
      });
      if (!response?.ok) {
        throw new Error(response?.error || "Detach failed.");
      }
    } catch (error) {
      reportError("Couldn't detach the sidebar.", error);
    }
  });

attachWindowButton?.addEventListener("click", async () => {
  const tabId = sourceTabId || (await getActiveTab())?.id;
  if (!tabId) return;
  try {
    await chrome.sidePanel.setOptions({
      tabId,
      enabled: true,
      path: "sidepanel.html",
    });
    await chrome.sidePanel.open({ tabId });
    window.close();
  } catch (error) {
    reportError("Couldn't reattach the sidebar.", error);
  }
});

toolbar?.addEventListener("mousedown", (e) => {
  e.preventDefault();
});

toolbar?.addEventListener("click", (e) => {
  const button = e.target.closest("button[data-format]");
  if (button) {
    applyFormat(button.dataset.format);
  }
});

document.addEventListener("selectionchange", updateToolbarState);
notesInput.addEventListener("keyup", updateToolbarState);
notesInput.addEventListener("mouseup", updateToolbarState);
notesInput.addEventListener("focus", updateToolbarState);

editorStack?.addEventListener("focusin", updateEditorStackFocus);
editorStack?.addEventListener("focusout", () => {
  window.setTimeout(updateEditorStackFocus, 0);
});
window.addEventListener("blur", updateEditorStackFocus);
document.addEventListener("visibilitychange", updateEditorStackFocus);
window.addEventListener("focus", () => {
  updateTitleFromActiveTab().catch(() => {});
  syncPanelOpenState();
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    updateTitleFromActiveTab().catch(() => {});
    syncPanelOpenState();
  }
});

window.JotDebug = {
  enable() {
    chrome.storage.local.set({ [DEBUG_KEY]: true });
  },
  disable() {
    chrome.storage.local.set({ [DEBUG_KEY]: false });
  },
  dump(callback = console.log) {
    chrome.runtime.sendMessage({ type: "GET_DEBUG_LOGS" }, (response) => {
      callback(response);
    });
  },
  clear() {
    chrome.runtime.sendMessage({ type: "CLEAR_DEBUG_LOGS" });
  },
};

notesInput.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "b") {
    e.preventDefault();
    applyFormat("bold");
  }
  if ((e.metaKey || e.ctrlKey) && e.key === "i") {
    e.preventDefault();
    applyFormat("italic");
  }
});

init();
