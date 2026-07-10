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
const saveAsBtn = document.getElementById("saveAsBtn");
const toolbar = document.querySelector(".toolbar");
const editorStack = document.querySelector(".editor-stack");
const statusMessage = document.getElementById("statusMessage");
const contextSuggestion = document.getElementById("contextSuggestion");
const wordCount = document.getElementById("wordCount");
const characterCount = document.getElementById("characterCount");
const selectionCapture = document.getElementById("selectionCapture");
const selectionPreview = document.getElementById("selectionPreview");
const addSelectionBtn = document.getElementById("addSelectionBtn");
const dismissSelectionBtn = document.getElementById("dismissSelectionBtn");

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
  normalizeImageSrc,
  htmlToMarkdown,
  markdownToHtml,
  getActiveTab,
} = NoteUtils;

const CONTEXT_KEY = "contextByHost";
const DEBUG_KEY = "debugLogsEnabled";
const TITLE_LOCK_KEY = "titleLockEnabled";
const MAX_PASTED_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_EXPORTED_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_IMAGES_PER_PASTE = 8;
const SUPPORTED_IMAGE_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/gif", "gif"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
]);
const SUPPORTED_IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "avif",
]);
const userAgent = navigator.userAgent || "";
const chromeVersionMatch = userAgent.match(/\bChrome\/(\d+)\./i);
const chromeMajorVersion = chromeVersionMatch
  ? Number.parseInt(chromeVersionMatch[1], 10)
  : null;
const isMacOs = /\bMacintosh\b|\bMac OS X\b/i.test(userAgent);

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
let pendingPageSelection = null;
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

const TOAST_TRANSITION_MS = 160;

const showToast = (
  message,
  { timeoutMs = 1800, minIntervalMs = 0, variant = "default" } = {}
) => {
  if (!statusMessage) return;
  const now = Date.now();
  if (minIntervalMs && now - lastToastAt < minIntervalMs) return;
  lastToastAt = now;
  window.clearTimeout(toastTimer);
  statusMessage.textContent = message || "";
  statusMessage.classList.toggle("is-visible", Boolean(message));
  statusMessage.classList.toggle("is-error", variant === "error");
  statusMessage.classList.toggle("is-ambient", variant === "ambient");
  if (timeoutMs > 0) {
    toastTimer = window.setTimeout(() => {
      if (statusMessage.textContent === message) {
        statusMessage.classList.remove("is-visible");
        window.setTimeout(() => {
          if (statusMessage.textContent === message) {
            statusMessage.textContent = "";
            statusMessage.classList.remove("is-error");
            statusMessage.classList.remove("is-ambient");
          }
        }, TOAST_TRANSITION_MS);
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
  showToast(message, { timeoutMs: 5000, variant: "error" });
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

const getSelectionPreviewText = (text) => {
  const normalized = (text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > 110
    ? `${normalized.slice(0, 107).trim()}...`
    : normalized;
};

const clearPendingPageSelection = () => {
  pendingPageSelection = null;
  if (selectionCapture) {
    selectionCapture.hidden = true;
  }
  if (selectionPreview) {
    selectionPreview.textContent = "";
  }
};

const showPendingPageSelection = (selection) => {
  const preview = getSelectionPreviewText(selection?.text || "");
  if (!preview || !selectionCapture || !selectionPreview) return;
  pendingPageSelection = selection;
  selectionPreview.textContent = preview;
  selectionCapture.hidden = false;
};


const storageState = { refreshed: {} };

if (chrome?.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (Object.prototype.hasOwnProperty.call(changes, DEBUG_KEY)) {
      debugEnabled = Boolean(changes[DEBUG_KEY].newValue);
    }
    if (Object.prototype.hasOwnProperty.call(changes, TITLE_LOCK_KEY)) {
      titleLocked = Boolean(changes[TITLE_LOCK_KEY].newValue);
      updateTitleLockButton();
      storageState.refreshed[TITLE_LOCK_KEY] = true;
    }
    if (Object.prototype.hasOwnProperty.call(changes, CONTEXT_KEY)) {
      contextByHost = changes[CONTEXT_KEY].newValue || {};
      storageState.refreshed[CONTEXT_KEY] = true;
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

const getVisitedPagesForFrontmatter = () =>
  pageHistory
    .filter((entry) => normalizeUrl(entry.url) === entry.url)
    .map((entry) => ({
      title:
        typeof entry.title === "string" && entry.title.trim()
          ? entry.title.trim()
          : entry.url,
      url: entry.url,
    }));

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


// contenteditable suppresses a link's default click-to-navigate behavior
// (so users can click into link text to edit it), so opening a link is an
// explicit Cmd/Ctrl+Click instead of a plain click — see the notesInput
// click listener below.
const openLinkInNewTab = (url) => {
  if (typeof chrome !== "undefined" && chrome.tabs?.create) {
    chrome.tabs.create({ url });
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
};

// Inserts a block-level element (heading, code block, ...) at `range`. If
// that lands it inside an existing <p>/<div>, splits that parent around the
// new block instead of leaving invalid block-inside-<p> nesting.
const insertBlockElement = (range, blockEl) => {
  range.insertNode(blockEl);
  const parent = blockEl.parentElement;
  if (!parent || parent === notesInput) return;
  const tag = parent.tagName.toLowerCase();
  if (tag !== "p" && tag !== "div") return;

  const rest = document.createRange();
  rest.setStartAfter(blockEl);
  rest.setEndAfter(parent.lastChild || parent);
  const restFragment = rest.extractContents();
  const afterP = document.createElement("p");
  if (restFragment.textContent?.trim()) {
    afterP.appendChild(restFragment);
  }

  const beforeP = document.createElement("p");
  const beforeRange = document.createRange();
  beforeRange.selectNodeContents(parent);
  beforeRange.setEndBefore(blockEl);
  const beforeFragment = beforeRange.extractContents();
  if (beforeFragment.textContent?.trim()) {
    beforeP.appendChild(beforeFragment);
  }

  parent.parentNode?.insertBefore(beforeP, parent);
  parent.parentNode?.insertBefore(blockEl, parent);
  if (afterP.textContent?.trim()) {
    parent.parentNode?.insertBefore(afterP, parent);
  }
  parent.remove();
};

// Text pasted from elsewhere (typically a webpage, given this app's job) is
// wrapped in a code block by default, since that's usually a snippet/quote
// worth visually setting apart rather than blending into normal prose. If
// the caret is already inside a code block, the paste just extends that
// block's text instead of nesting a new one.
const insertPastedTextAsCodeBlock = (text) => {
  const selection = ensureSelectionInNotes();
  if (!selection || selection.rangeCount === 0) return;
  const normalized = text.replace(/\r\n?/g, "\n");
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.textContent = normalized;
  pre.appendChild(code);
  insertBlockElement(range, pre);
  if (!pre.nextSibling) {
    pre.parentNode?.insertBefore(document.createElement("p"), null);
  }
  const caretRange = document.createRange();
  caretRange.selectNodeContents(code);
  caretRange.collapse(false);
  selection.removeAllRanges();
  selection.addRange(caretRange);
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
    case "heading": {
      if (!selection || selection.rangeCount === 0) return;
      const headingRange = selection.getRangeAt(0);
      const anchorNode = selection.anchorNode || selection.focusNode;
      const existingHeading = anchorNode
        ? findClosestTag(anchorNode, ["h1", "h2", "h3"])
        : null;
      if (existingHeading) {
        const el = anchorNode?.nodeType === Node.ELEMENT_NODE
          ? anchorNode
          : anchorNode?.parentElement;
        const headingEl = el?.closest?.(existingHeading);
        if (headingEl) {
          const parent = headingEl.parentNode;
          while (headingEl.firstChild) {
            parent.insertBefore(headingEl.firstChild, headingEl);
          }
          parent.removeChild(headingEl);
          if (parent !== notesInput && !parent.textContent?.trim()) {
            parent.remove();
          }
        }
      } else {
        const h2 = document.createElement("h2");
        const fragment = headingRange.extractContents();
        if (!fragment.textContent.trim()) {
          h2.textContent = "Heading";
        } else {
          h2.appendChild(fragment);
        }
        insertBlockElement(headingRange, h2);
      }
      break;
    }
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
    case "codeblock": {
      if (!selection || selection.rangeCount === 0) return;
      const codeBlockRange = selection.getRangeAt(0);
      const anchorNode = selection.anchorNode || selection.focusNode;
      const existingPre = anchorNode ? findClosestTag(anchorNode, ["pre"]) : null;
      if (existingPre) {
        const el = anchorNode?.nodeType === Node.ELEMENT_NODE
          ? anchorNode
          : anchorNode?.parentElement;
        const preEl = el?.closest?.(existingPre);
        if (preEl) {
          const p = document.createElement("p");
          const codeEl = preEl.querySelector("code") || preEl;
          while (codeEl.firstChild) {
            p.appendChild(codeEl.firstChild);
          }
          preEl.parentNode?.insertBefore(p, preEl);
          preEl.remove();
        }
      } else {
        const fragment = codeBlockRange.extractContents();
        const pre = document.createElement("pre");
        const codeBlock = document.createElement("code");
        const isEmpty = !fragment.textContent?.trim();
        if (isEmpty) {
          // A literal placeholder text node here (e.g. "code") would let the
          // browser replace the whole <code> with a styled <span> the moment
          // the user selects-and-types over it, silently losing the code
          // tag. An empty element anchored by a <br> is the standard
          // contenteditable idiom for "focusable empty line" and keeps
          // typing inside the actual <code> element.
          codeBlock.appendChild(document.createElement("br"));
        } else {
          codeBlock.appendChild(fragment);
        }
        pre.appendChild(codeBlock);
        insertBlockElement(codeBlockRange, pre);
        if (!pre.nextSibling) {
          pre.parentNode?.insertBefore(document.createElement("p"), null);
        }
        if (isEmpty) {
          const caretRange = document.createRange();
          caretRange.setStart(codeBlock, 0);
          caretRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(caretRange);
        }
      }
      break;
    }
    case "highlight": {
      if (!selection || selection.rangeCount === 0) return;
      const highlightRange = selection.getRangeAt(0);
      const highlightAnchor = selection.anchorNode || selection.focusNode;
      const existingMark = highlightAnchor
        ? findClosestTag(highlightAnchor, ["mark"])
        : null;
      if (existingMark) {
        const el = highlightAnchor?.nodeType === Node.ELEMENT_NODE
          ? highlightAnchor
          : highlightAnchor?.parentElement;
        const markEl = el?.closest?.(existingMark);
        if (markEl) {
          const parent = markEl.parentNode;
          while (markEl.firstChild) {
            parent.insertBefore(markEl.firstChild, markEl);
          }
          parent.removeChild(markEl);
        }
      } else {
        const fragment = highlightRange.extractContents();
        const mark = document.createElement("mark");
        if (!fragment.textContent?.trim()) {
          mark.textContent = "highlight";
        } else {
          mark.appendChild(fragment);
        }
        highlightRange.insertNode(mark);
      }
      break;
    }
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
        a.title = `${url} — ⌘/Ctrl+Click to open`;
        a.textContent = linkText;
        linkRange.deleteContents();
        linkRange.insertNode(a);
      }
      break;
  }

  updateEditorStats();
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
    codeblock: toolbar.querySelector('[data-format="codeblock"]'),
    highlight: toolbar.querySelector('[data-format="highlight"]'),
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

  const codeblockActive = Boolean(anchorNode && findClosestTag(anchorNode, ["pre"]));
  const highlightActive = Boolean(anchorNode && findClosestTag(anchorNode, ["mark"]));

  buttons.bold?.classList.toggle("active", safeQueryState("bold"));
  buttons.italic?.classList.toggle("active", safeQueryState("italic"));
  buttons.heading?.classList.toggle("active", Boolean(headingTag));
  buttons.ul?.classList.toggle("active", unorderedActive);
  buttons.ol?.classList.toggle("active", orderedActive);
  buttons.codeblock?.classList.toggle("active", codeblockActive);
  buttons.highlight?.classList.toggle("active", highlightActive);
};

const pluralize = (count, singular, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

const countWords = (text) => {
  const normalized = (text || "").trim();
  if (!normalized) return 0;
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
    return Array.from(segmenter.segment(normalized)).filter(
      (segment) => segment.isWordLike
    ).length;
  }
  return normalized.split(/\s+/).filter(Boolean).length;
};

const getEditorSelectionText = () => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return "";
  }
  if (
    !notesInput.contains(selection.anchorNode) ||
    !notesInput.contains(selection.focusNode)
  ) {
    return "";
  }
  return selection.toString();
};

const updateEditorStats = () => {
  if (!wordCount || !characterCount) return;
  const selectedText = getEditorSelectionText();
  const text = selectedText || notesInput.textContent || "";
  const words = countWords(text);
  const characters = text.length;
  wordCount.textContent = pluralize(words, "word");
  characterCount.textContent = pluralize(characters, "character");
};

const getImageExtensionFromUrl = (value) => {
  try {
    const parsed = new URL(value);
    const extension = parsed.pathname.split(".").pop()?.toLowerCase() || "";
    return SUPPORTED_IMAGE_EXTENSIONS.has(extension) ? extension : "";
  } catch (error) {
    return "";
  }
};

const getDataImageType = (value) => {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,/i.exec(value || "");
  const mimeType = match?.[1]?.toLowerCase() || "";
  return SUPPORTED_IMAGE_TYPES.has(mimeType) ? mimeType : "";
};

const getImageExtension = (src, fallbackType = "") => {
  const dataType = getDataImageType(src);
  if (dataType) return SUPPORTED_IMAGE_TYPES.get(dataType);
  if (fallbackType && SUPPORTED_IMAGE_TYPES.has(fallbackType)) {
    return SUPPORTED_IMAGE_TYPES.get(fallbackType);
  }
  return getImageExtensionFromUrl(src) || "png";
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });

const dataUrlToBlob = async (dataUrl) => {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=]+)$/i.exec(
    dataUrl || ""
  );
  if (!match) {
    throw new Error("Unsupported image data.");
  }
  const mimeType = match[1].toLowerCase();
  if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) {
    throw new Error("Unsupported image type.");
  }
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
};

const createRemoteImagePlaceholder = ({ src, alt }) => {
  const figure = document.createElement("figure");
  figure.className = "image-attachment";
  figure.contentEditable = "false";
  figure.dataset.jotImageSrc = src;
  figure.dataset.jotImageAlt = alt || "Image";
  const badge = document.createElement("span");
  badge.className = "image-attachment__badge";
  badge.textContent = "Image";
  const caption = document.createElement("figcaption");
  caption.textContent = alt || "Web image";
  figure.append(badge, caption);
  return figure;
};

const createEditorImageNode = ({ src, alt = "Image" }) => {
  const safeSrc = normalizeImageSrc(src);
  if (!safeSrc) return null;
  if (/^data:/i.test(safeSrc)) {
    const img = document.createElement("img");
    img.src = safeSrc;
    img.alt = alt;
    return img;
  }
  return createRemoteImagePlaceholder({ src: safeSrc, alt });
};

const insertImageIntoEditor = ({ src, alt = "Image" }) => {
  const imageNode = createEditorImageNode({ src, alt });
  if (!imageNode) return false;
  notesInput.focus();
  const block = document.createElement("p");
  block.appendChild(imageNode);
  const spacer = document.createElement("p");
  spacer.appendChild(document.createElement("br"));
  const fragment = document.createDocumentFragment();
  fragment.append(block, spacer);
  const range = getInsertRange();
  if (!range) {
    notesInput.appendChild(fragment);
  } else {
    range.deleteContents();
    range.insertNode(fragment);
    range.setStartAfter(spacer);
    range.collapse(true);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    lastNotesRange = range.cloneRange();
  }
  updateEditorStats();
  debouncedSaveDraft();
  return true;
};

const getClipboardImageFiles = (clipboard) => {
  const items = Array.from(clipboard?.items || []);
  return items
    .filter(
      (item) =>
        item.kind === "file" &&
        SUPPORTED_IMAGE_TYPES.has((item.type || "").toLowerCase())
    )
    .map((item) => item.getAsFile())
    .filter(Boolean)
    .slice(0, MAX_IMAGES_PER_PASTE);
};

const getClipboardHtmlImages = (clipboard) => {
  const html = clipboard?.getData("text/html") || "";
  if (!html.trim()) return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  return Array.from(doc.querySelectorAll("img"))
    .map((img) => ({
      src: normalizeImageSrc(img.currentSrc || img.src || img.getAttribute("src") || ""),
      alt: img.getAttribute("alt") || "Web image",
    }))
    .filter((image) => image.src)
    .slice(0, MAX_IMAGES_PER_PASTE);
};

const insertPastedImageFiles = async (files) => {
  let inserted = 0;
  for (const file of files) {
    const mimeType = (file.type || "").toLowerCase();
    if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) continue;
    if (file.size > MAX_PASTED_IMAGE_BYTES) {
      showToast("Image is too large to paste.", {
        timeoutMs: 2600,
        variant: "error",
      });
      continue;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      if (insertImageIntoEditor({ src: dataUrl, alt: file.name || "Pasted image" })) {
        inserted += 1;
      }
    } catch (error) {
      reportError("Couldn't paste image.", error);
    }
  }
  if (inserted) {
    showToast("Image added.", { timeoutMs: 1600 });
  }
};

const insertRemoteImages = (images) => {
  const inserted = images.filter((image) => insertImageIntoEditor(image)).length;
  if (inserted) {
    showToast("Image reference added.", { timeoutMs: 1600 });
  }
};

const toAttachmentSafeName = (value, fallback = "image") =>
  slugify(value || fallback).replace(/^-+|-+$/g, "") || fallback;

const buildObsidianImageExport = async (markdown, noteFilename) => {
  const noteBase = toAttachmentSafeName(noteFilename.replace(/\.md$/i, ""), "note");
  const attachments = [];
  let output = "";
  let lastIndex = 0;
  const imageRegex = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
  let match;
  while ((match = imageRegex.exec(markdown))) {
    const [fullMatch, rawAlt, rawSrc] = match;
    const src = normalizeImageSrc(rawSrc);
    if (!src) continue;
    output += markdown.slice(lastIndex, match.index);
    lastIndex = match.index + fullMatch.length;
    const alt = rawAlt?.trim() || "Image";
    const extension = getImageExtension(src);
    const attachmentFilename = `${noteBase}-image-${attachments.length + 1}.${extension}`;
    const relativePath = `attachments/${attachmentFilename}`;
    output += `![${alt.replace(/[\[\]\n\r]/g, " ")}](${relativePath})`;
    if (/^data:/i.test(src)) {
      attachments.push({
        kind: "blob",
        path: relativePath,
        blob: await dataUrlToBlob(src),
      });
    } else {
      attachments.push({
        kind: "remote",
        path: relativePath,
        url: src,
      });
    }
  }
  output += markdown.slice(lastIndex);
  return { markdown: output, attachments };
};

const toYamlString = (value) => JSON.stringify(String(value || ""));

const toYamlLinkListItem = (title, url) => {
  const safeTitle =
    String(title || url || "")
      .replace(/[\[\]\r\n]/g, " ")
      .trim() || url;
  return toYamlString(`[${safeTitle}](${url})`);
};

const getLocalDateTimeParts = (value) => {
  const parsed = value ? new Date(value) : new Date();
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const datePart = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )}`;
  const timePart = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  return {
    date: datePart,
    time: timePart,
    datetime: `${datePart}T${timePart}`,
  };
};

const buildYamlFrontmatter = ({ title, meetingDate }) => {
  const { date, time, datetime } = getLocalDateTimeParts(meetingDate);
  const pages = getVisitedPagesForFrontmatter();
  const lines = [
    "---",
    `title: ${toYamlString(title)}`,
    `date: ${date}`,
    `time: ${toYamlString(time)}`,
    `datetime: ${toYamlString(datetime)}`,
  ];
  if (pages.length) {
    lines.push("pages_visited:");
    pages.forEach((page) => {
      lines.push(`  - ${toYamlLinkListItem(page.title, page.url)}`);
    });
  } else {
    lines.push("pages_visited: []");
  }
  lines.push("---");
  return lines.join("\n");
};

const buildMarkdown = ({ meetingName, meetingDate, notes }) => {
  const title = sanitizeMeetingName(meetingName);
  const body = notes.trim() ? `${notes.trim()}\n` : "";
  const frontmatter = buildYamlFrontmatter({ title, meetingDate });

  return `${frontmatter}\n\n# ${title}\n\n${body}`;
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
  updateEditorStats();
};

const saveDraft = async () => {
  const draft = getDraftData();
  try {
    await storageSet({ [STORAGE_KEY]: draft });
    showToast("Saved locally", {
      timeoutMs: 1600,
      minIntervalMs: 5000,
      variant: "ambient",
    });
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
  downloadBlob(new Blob([markdown], { type: mimeType }), filename, {
    saveAs,
    conflictAction,
  });

const downloadBlob = (
  blob,
  filename,
  { saveAs = false, conflictAction = "uniquify" } = {}
) =>
  new Promise((resolve, reject) => {
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

const fetchRemoteAttachmentBlob = async (url) => {
  const safeUrl = normalizeImageSrc(url);
  if (!safeUrl || /^data:/i.test(safeUrl)) {
    throw new Error("Unsupported image URL.");
  }
  const response = await fetch(safeUrl, {
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok) {
    throw new Error(`Image download failed (${response.status}).`);
  }
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_EXPORTED_IMAGE_BYTES) {
    throw new Error("Image is too large to export.");
  }
  const contentType = (response.headers.get("content-type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!SUPPORTED_IMAGE_TYPES.has(contentType)) {
    throw new Error("Downloaded file is not a supported image.");
  }
  const blob = await response.blob();
  if (blob.size > MAX_EXPORTED_IMAGE_BYTES) {
    throw new Error("Image is too large to export.");
  }
  return blob;
};

const downloadImageAttachments = async (attachments, exportRoot = "") => {
  for (const attachment of attachments) {
    const filename = exportRoot
      ? `${exportRoot}/${attachment.path}`
      : attachment.path;
    if (attachment.kind === "blob") {
      await downloadBlob(attachment.blob, filename, {
        saveAs: false,
        conflictAction: "overwrite",
      });
    } else if (attachment.kind === "remote") {
      await downloadBlob(await fetchRemoteAttachmentBlob(attachment.url), filename, {
        saveAs: false,
        conflictAction: "overwrite",
      });
    }
  }
};

const writeBlobFile = async (directoryHandle, filename, blob) => {
  const fileHandle = await directoryHandle.getFileHandle(filename, {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(blob);
  } finally {
    await writable.close();
  }
};

const writeTextFile = (directoryHandle, filename, text, mimeType) =>
  writeBlobFile(directoryHandle, filename, new Blob([text], { type: mimeType }));

const writeAttachmentsToDirectory = async (directoryHandle, attachments) => {
  if (!attachments.length) return;
  const attachmentsDirectory = await directoryHandle.getDirectoryHandle(
    "attachments",
    { create: true }
  );
  for (const attachment of attachments) {
    const filename = attachment.path.split("/").pop();
    if (!filename) continue;
    if (attachment.kind === "blob") {
      await writeBlobFile(attachmentsDirectory, filename, attachment.blob);
    } else if (attachment.kind === "remote") {
      await writeBlobFile(
        attachmentsDirectory,
        filename,
        await fetchRemoteAttachmentBlob(attachment.url)
      );
    }
  }
};

const toDownloadFilename = (value) => {
  const fallbackName = "note.md";
  const raw = typeof value === "string" ? value : "";
  const sanitized = (raw || fallbackName)
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  if (!sanitized) return fallbackName;
  return /\.md$/i.test(sanitized) ? sanitized : `${sanitized}.md`;
};

const handleSave = async () => {
  const data = getFormData();
  const filename = buildFilename(data);
  const downloadFilename = toDownloadFilename(filename);
  const exportData = await buildObsidianImageExport(
    buildMarkdown(data),
    downloadFilename
  );
  const hasAttachments = exportData.attachments.length > 0;
  const exportRoot = hasAttachments
    ? toAttachmentSafeName(downloadFilename.replace(/\.md$/i, ""), "jot-it-note")
    : "";
  const payload = exportData.markdown;
  const mimeType = "text/markdown";
  const noteDownloadFilename = exportRoot
    ? `${exportRoot}/${downloadFilename}`
    : downloadFilename;

  try {
    await downloadMarkdown(payload, noteDownloadFilename, {
      saveAs: false,
      conflictAction: "uniquify",
      mimeType,
    });
    await downloadImageAttachments(exportData.attachments, exportRoot);
  } catch (error) {
    if (hasAttachments) {
      reportError("Image export failed. Please try again.", error);
      window.alert("Image export failed. Please try again.");
      return;
    }
    try {
      await downloadMarkdown(payload, noteDownloadFilename, {
        saveAs: true,
        conflictAction: "uniquify",
        mimeType,
      });
      await downloadImageAttachments(exportData.attachments, exportRoot);
    } catch (fallbackError) {
      reportError("Save failed. Please try again.", fallbackError);
      window.alert("Save failed. Please try again.");
      return;
    }
  }
  showToast(
    hasAttachments ? "Exported note folder to Downloads" : "Exported to Downloads",
    { timeoutMs: 1800 }
  );
  notesInput.focus();
};

const handleSaveAs = async () => {
  const data = getFormData();
  const filename = buildFilename(data);
  const downloadFilename = toDownloadFilename(filename);
  let directoryHandle = null;
  if (typeof window.showDirectoryPicker === "function") {
    try {
      directoryHandle = await window.showDirectoryPicker({ mode: "readwrite" });
    } catch (error) {
      if (error?.name === "AbortError") return;
      reportError("Couldn't open folder picker.", error);
      return;
    }
  }
  const exportData = await buildObsidianImageExport(
    buildMarkdown(data),
    downloadFilename
  );
  const hasAttachments = exportData.attachments.length > 0;
  const exportRoot = hasAttachments
    ? toAttachmentSafeName(downloadFilename.replace(/\.md$/i, ""), "jot-it-note")
    : "";
  const noteDownloadFilename = exportRoot
    ? `${exportRoot}/${downloadFilename}`
    : downloadFilename;

  if (directoryHandle) {
    try {
      await writeTextFile(
        directoryHandle,
        downloadFilename,
        exportData.markdown,
        "text/markdown"
      );
      await writeAttachmentsToDirectory(
        directoryHandle,
        exportData.attachments
      );
      showToast(
        hasAttachments ? "Saved note and attachments." : "File saved.",
        { timeoutMs: 1800 }
      );
      notesInput.focus();
      return;
    } catch (error) {
      reportError("Save failed. Please try another folder.", error);
      window.alert("Save failed. Please try another folder.");
      return;
    }
  }

  try {
    await downloadMarkdown(exportData.markdown, noteDownloadFilename, {
      saveAs: !hasAttachments,
      conflictAction: "uniquify",
      mimeType: "text/markdown",
    });
    await downloadImageAttachments(exportData.attachments, exportRoot);
    showToast(
      hasAttachments ? "Exported note folder to Downloads" : "File saved.",
      { timeoutMs: 1800 }
    );
    notesInput.focus();
  } catch (error) {
    reportError("Save failed. Please try again.", error);
    window.alert("Save failed. Please try again.");
  }
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
  notesInput.innerHTML = "";
  updateEditorStats();
  notesInput.focus();
};

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!message) return;
  if (message.type !== "PAGE_SELECTION_CANDIDATE") return;
  if (typeof message.text !== "string" || !message.text.trim()) return;
  const now = Date.now();
  const incomingUrl =
    typeof message.url === "string" ? message.url : "";
  debugLog("PAGE_SELECTION_CANDIDATE received", {
    length: message.text.length,
    url: incomingUrl,
    tabId: message.tabId,
  });
  if (
    message.text === lastNotesInserted.text &&
    incomingUrl === lastNotesInserted.url &&
    now - lastNotesInsertedAt < 1000
  ) {
    debugLog("PAGE_SELECTION_CANDIDATE deduped", { url: incomingUrl });
    return;
  }
  const senderTabId = Number.isInteger(message.tabId)
    ? message.tabId
    : sender?.tab?.id;
  if (isStandalone && Number.isInteger(sourceTabId)) {
    if (senderTabId !== sourceTabId) return;
  }
  showPendingPageSelection({
    text: message.text,
    url: message.url || currentPageUrl,
    title: message.title || "",
    tabId: senderTabId,
    receivedAt: now,
  });
});

const addPendingPageSelection = () => {
  if (!pendingPageSelection?.text?.trim()) return;
  const selection = pendingPageSelection;
  if (selection.url || selection.title) {
    recordPageVisit(selection.url, selection.title);
  }
  insertSelectionWithLink(selection.text, selection.url || currentPageUrl);
  debugLog("selection inserted", { url: selection.url || currentPageUrl });
  lastNotesInserted = { text: selection.text, url: selection.url || "" };
  lastNotesInsertedAt = Date.now();
  clearPendingPageSelection();
  debouncedSaveDraft();
};
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

  // Selected page text is a snippet/quote, same as a clipboard paste — see
  // insertPastedTextAsCodeBlock — so it goes in a code block too, with the
  // clickable source link as its own paragraph directly below the block
  // rather than inline with the text.
  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.textContent = text.replace(/\r\n?/g, "\n");
  pre.appendChild(code);

  let linkP = null;
  if (normalizedUrl) {
    linkP = document.createElement("p");
    const anchor = document.createElement("a");
    anchor.href = normalizedUrl;
    anchor.textContent = normalizedUrl;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.title = `${normalizedUrl} — ⌘/Ctrl+Click to open`;
    linkP.appendChild(anchor);
  }

  const spacer = document.createElement("p");
  spacer.appendChild(document.createElement("br"));

  const range = getInsertRange();
  if (!range) {
    notesInput.appendChild(pre);
    if (linkP) notesInput.appendChild(linkP);
    notesInput.appendChild(spacer);
  } else {
    range.deleteContents();
    insertBlockElement(range, pre);
    const afterPre = linkP || pre;
    if (linkP) pre.parentNode?.insertBefore(linkP, pre.nextSibling);
    afterPre.parentNode?.insertBefore(spacer, afterPre.nextSibling);
  }

  const caretRange = document.createRange();
  caretRange.setStartAfter(spacer);
  caretRange.collapse(true);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(caretRange);
  lastNotesRange = caretRange.cloneRange();
  updateEditorStats();
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
    button.dataset.date = `${current.getFullYear()}-${pad2(current.getMonth() + 1)}-${pad2(current.getDate())}`;
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
    if (result[CONTEXT_KEY] && !storageState.refreshed[CONTEXT_KEY]) {
      contextByHost = result[CONTEXT_KEY] || {};
    }
    if (Object.prototype.hasOwnProperty.call(result, TITLE_LOCK_KEY) && !storageState.refreshed[TITLE_LOCK_KEY]) {
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
  updateEditorStats();
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
addSelectionBtn?.addEventListener("click", addPendingPageSelection);
dismissSelectionBtn?.addEventListener("click", clearPendingPageSelection);
notesInput.addEventListener("click", (event) => {
  if (!(event.metaKey || event.ctrlKey)) return;
  const link = event.target.closest?.("a[href]");
  if (!link || !notesInput.contains(link)) return;
  event.preventDefault();
  openLinkInNewTab(link.href);
});
notesInput.addEventListener("keyup", storeNotesSelection);
notesInput.addEventListener("mouseup", storeNotesSelection);
notesInput.addEventListener("focus", storeNotesSelection);
notesInput.addEventListener("input", () => {
  storeNotesSelection();
  updateEditorStats();
  debouncedSaveDraft();
});
notesInput.addEventListener("paste", (event) => {
  const clipboard = event.clipboardData;
  if (!clipboard) return;
  const imageFiles = getClipboardImageFiles(clipboard);
  if (imageFiles.length) {
    event.preventDefault();
    insertPastedImageFiles(imageFiles);
    return;
  }
  const htmlImages = getClipboardHtmlImages(clipboard);
  if (htmlImages.length) {
    event.preventDefault();
    insertRemoteImages(htmlImages);
    return;
  }
  event.preventDefault();
  const text = clipboard.getData("text/plain");
  if (!text) return;
  const selection = window.getSelection();
  const anchorNode = selection?.anchorNode;
  const pastingIntoExistingCodeBlock =
    anchorNode && findClosestTag(anchorNode, ["pre"]);
  if (pastingIntoExistingCodeBlock) {
    document.execCommand("insertText", false, text);
  } else {
    insertPastedTextAsCodeBlock(text);
    storeNotesSelection();
    updateEditorStats();
    debouncedSaveDraft();
  }
});

notesInput.addEventListener("drop", (event) => {
  event.preventDefault();
  const text = event.dataTransfer?.getData("text/plain") || "";
  if (text) {
    notesInput.focus();
    document.execCommand("insertText", false, text);
  }
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
dateGrid?.addEventListener("keydown", (event) => {
  const days = Array.from(dateGrid.querySelectorAll(".date-picker__day"));
  const currentIndex = days.findIndex((d) => d.classList.contains("is-selected"));
  let nextIndex = currentIndex;
  if (event.key === "ArrowRight") {
    nextIndex = Math.min(currentIndex + 1, days.length - 1);
  } else if (event.key === "ArrowLeft") {
    nextIndex = Math.max(currentIndex - 1, 0);
  } else if (event.key === "ArrowDown") {
    nextIndex = Math.min(currentIndex + 7, days.length - 1);
  } else if (event.key === "ArrowUp") {
    nextIndex = Math.max(currentIndex - 7, 0);
  } else {
    return;
  }
  event.preventDefault();
  if (nextIndex !== currentIndex && days[nextIndex]) {
    const dateStr = days[nextIndex].dataset.date;
    if (dateStr) {
      const parts = dateStr.split("-").map(Number);
      const updated = new Date(parts[0], parts[1] - 1, parts[2]);
      setMeetingDateValue(updated);
      renderDatePicker();
    }
    days[nextIndex].focus();
  }
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
  saveDraft();
  if (panelTabId) {
    chrome.runtime.sendMessage({ type: "PANEL_CLOSE", tabId: panelTabId }, () => {
      if (chrome.runtime.lastError) {
        // Background may be sleeping; ignore.
      }
    });
  }
});

saveButton.addEventListener("click", handleSave);
saveAsBtn?.addEventListener("click", handleSaveAs);
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
document.addEventListener("selectionchange", updateEditorStats);
notesInput.addEventListener("keyup", updateToolbarState);
notesInput.addEventListener("keyup", updateEditorStats);
notesInput.addEventListener("mouseup", updateToolbarState);
notesInput.addEventListener("mouseup", updateEditorStats);
notesInput.addEventListener("focus", updateToolbarState);
notesInput.addEventListener("focus", updateEditorStats);

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
  if (e.key === "Enter") {
    const selection = window.getSelection();
    const anchorNode = selection?.anchorNode;
    // Inside a code block, Enter should insert a line break within the
    // block, not split it into a new paragraph the way the browser's
    // default contenteditable "insert paragraph" behavior would.
    if (selection && anchorNode && findClosestTag(anchorNode, ["pre"])) {
      e.preventDefault();
      const range = selection.getRangeAt(0);
      range.deleteContents();
      // A caret left at the very end of a block's content (right after a
      // lone trailing newline, with nothing after it) makes Chrome's text
      // insertion land *before* that newline instead of at the caret — a
      // caret at the true end of an editable region gets normalized that
      // way. Appending a zero-width space after the newline gives the
      // caret real content to sit between, avoiding the ambiguity. It's
      // stripped back out in htmlToMarkdown so it never reaches saved notes.
      const newline = document.createTextNode("\n\u200B");
      range.insertNode(newline);
      range.setStart(newline, 1);
      range.setEnd(newline, 1);
      selection.removeAllRanges();
      selection.addRange(range);
      updateEditorStats();
      debouncedSaveDraft();
    }
  }
});

init().catch((error) => {
  console.warn("Jot it! init failed:", error);
});
