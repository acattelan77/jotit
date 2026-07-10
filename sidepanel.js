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
const wordCount = document.getElementById("wordCount");
const characterCount = document.getElementById("characterCount");
const selectionCapture = document.getElementById("selectionCapture");
const selectionPreview = document.getElementById("selectionPreview");
const addSelectionBtn = document.getElementById("addSelectionBtn");
const dismissSelectionBtn = document.getElementById("dismissSelectionBtn");
const metaSection = document.getElementById("metaSection");
const notesSection = document.getElementById("notesSection");
const libraryToggleBtn = document.getElementById("libraryToggleBtn");
const libraryView = document.getElementById("libraryView");
const librarySearchInput = document.getElementById("librarySearch");
const libraryExportAllBtn = document.getElementById("libraryExportAllBtn");
const libraryList = document.getElementById("libraryList");
const libraryEmptyState = document.getElementById("libraryEmptyState");
const libraryImportBtn = document.getElementById("libraryImportBtn");
const libraryImportInput = document.getElementById("libraryImportInput");
const librarySortSelect = document.getElementById("librarySortSelect");
const libraryFilterSiteBtn = document.getElementById("libraryFilterSiteBtn");
const libraryMultiSelectBtn = document.getElementById("libraryMultiSelectBtn");
const libraryBulkBar = document.getElementById("libraryBulkBar");
const libraryBulkCount = document.getElementById("libraryBulkCount");
const libraryBulkDeleteBtn = document.getElementById("libraryBulkDeleteBtn");
const libraryBulkCancelBtn = document.getElementById("libraryBulkCancelBtn");
const onboardingHint = document.getElementById("onboardingHint");
const onboardingHintDismiss = document.getElementById("onboardingHintDismiss");

const NoteUtils = window.NoteUtils;
if (!NoteUtils) {
  throw new Error("NoteUtils not loaded.");
}

const NoteLibrary = window.NoteLibrary;
if (!NoteLibrary) {
  throw new Error("NoteLibrary not loaded.");
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

const DEBUG_KEY = "debugLogsEnabled";
const TITLE_LOCK_KEY = "titleLockEnabled";
const ONBOARDING_HINT_KEY = "onboardingHintDismissed";
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
let currentLibraryEntryId = null;
let libraryViewOpen = false;
let libraryEntriesCache = [];
let librarySortMode = "updated";
let libraryFilterThisSite = false;
let libraryMultiSelectMode = false;
const librarySelectedIds = new Set();
let debugEnabled = false;
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

const normalizePageHistory = (entries) => {
  if (!Array.isArray(entries)) return [];
  const normalizedEntries = [];
  entries.forEach((entry) => {
    const url = normalizeUrl(entry?.url);
    if (!url || normalizedEntries.some((item) => item.url === url)) return;
    const title =
      typeof entry?.title === "string" && entry.title.trim()
        ? entry.title.trim()
        : url;
    const visitedAt = Number.isFinite(entry?.visitedAt)
      ? entry.visitedAt
      : Date.now();
    normalizedEntries.push({ url, title, visitedAt });
  });
  return normalizedEntries.slice(-100);
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

const shouldAutoUpdateTitle = () => {
  if (titleLocked || userEditedTitle) return false;
  return !hasNoteContent() || !meetingNameInput.value.trim();
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

// Plain-text paste inserts as ordinary prose (text + <br> per line), matching
// what every other notes/document editor does by default. Earlier versions
// of this app wrapped every paste in a code block on the theory that pasted
// text is usually a snippet copied from the page being read — in practice
// that made pasting an agenda, a paragraph to annotate, or any other normal
// prose look broken (unexpectedly monospaced) the first time a user did it,
// with no visible explanation or way to opt out. Captured page selections
// (see insertSelectionWithLink) still go into a code block — that's a
// deliberate "quoted external source, with a link back to it" affordance,
// not a generic paste default, so it's unaffected by this change. See
// docs/specs/rich-text-editor.md.
const insertPastedTextAsPlainText = (text) => {
  const selection = ensureSelectionInNotes();
  if (!selection || selection.rangeCount === 0) return;
  const normalized = text.replace(/\r\n?/g, "\n");
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const lines = normalized.split("\n");
  const fragment = document.createDocumentFragment();
  let lastNode = null;
  lines.forEach((line, index) => {
    if (index > 0) {
      fragment.appendChild(document.createElement("br"));
    }
    if (line) {
      lastNode = document.createTextNode(line);
      fragment.appendChild(lastNode);
    }
  });
  if (!fragment.childNodes.length) return;
  range.insertNode(fragment);
  const caretRange = document.createRange();
  if (lastNode) {
    caretRange.setStartAfter(lastNode);
  } else {
    caretRange.selectNodeContents(notesInput);
    caretRange.collapse(false);
  }
  caretRange.collapse(true);
  selection.removeAllRanges();
  selection.addRange(caretRange);
  lastNotesRange = caretRange.cloneRange();
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
    case "timestamp": {
      if (!selection || selection.rangeCount === 0) return;
      const stampRange = selection.getRangeAt(0);
      const now = new Date();
      const stampNode = document.createTextNode(
        `${pad2(now.getHours())}:${pad2(now.getMinutes())} — `
      );
      stampRange.deleteContents();
      stampRange.insertNode(stampNode);
      const caretRange = document.createRange();
      caretRange.setStartAfter(stampNode);
      caretRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(caretRange);
      lastNotesRange = caretRange.cloneRange();
      break;
    }
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

const hasNoteContent = () => {
  if ((notesInput.textContent || "").trim()) return true;
  return Boolean(notesInput.querySelector("img, figure.image-attachment, pre"));
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
  pageHistory: normalizePageHistory(pageHistory),
});

const getDraftData = (formData = getFormData()) => ({
  ...formData,
  cursorOffset: lastCaretOffset,
  editorFocused: document.activeElement === notesInput,
  libraryEntryId: currentLibraryEntryId,
});

const setFormData = ({
  meetingName,
  meetingDate,
  notes,
  pageUrl,
  pageHistory: savedPageHistory,
  libraryEntryId,
}) => {
  meetingNameInput.value = meetingName || "";
  meetingDateInput.value = meetingDate || toLocalDateTimeValue();
  updateMeetingDateDisplay(meetingDateInput.value);
  currentPageUrl = pageUrl || currentPageUrl;
  pageHistory = normalizePageHistory(savedPageHistory);
  currentLibraryEntryId = libraryEntryId || null;
  notesInput.innerHTML = markdownToHtml(notes || "");
  removeLegacySourceLines();
  updateEditorStats();
};

const saveDraft = async () => {
  const formData = getFormData();
  const draft = getDraftData(formData);
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
  // Every note is automatically kept in the library as the user writes —
  // there's no explicit "save to library" action; Save/Save As only ever
  // export to disk (see handleSave/handleSaveAs). Gated on real,
  // user-authored content (not just an auto-filled title from the active
  // tab — see hasRealNoteContent) so opening the panel on a page doesn't
  // by itself spawn an empty library entry. Runs independently of the
  // draft-storage save above (own try/catch inside saveNoteToLibrary) so a
  // library-write failure never blocks or is blocked by the draft save.
  if (hasRealNoteContent()) {
    await saveNoteToLibrary(formData);
  }
};

const debouncedSaveDraft = debounce(saveDraft, 300);

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

// Side effect of Save/Save As, never of the autosaved draft — see
// ADR-0006 and docs/specs/note-library.md. `data` is the same pre-export
// shape getFormData() already builds (Markdown with data-URI/remote image
// references intact, not the attachments/-rewritten export form), so a
// library entry can be reloaded straight back into the editor via
// markdownToHtml with no extra reconstruction step. A failure here must
// never affect the disk export that already succeeded by the time this
// runs, so it only ever reports softly (no window.alert, no throw).
const saveNoteToLibrary = async (data) => {
  try {
    const now = Date.now();
    const existing = currentLibraryEntryId
      ? await NoteLibrary.getEntry(currentLibraryEntryId)
      : null;
    const id = existing ? existing.id : NoteLibrary.generateId();
    await NoteLibrary.putEntry({
      id,
      title: sanitizeMeetingName(data.meetingName),
      meetingDate: data.meetingDate,
      notes: data.notes,
      pageHistory: normalizePageHistory(data.pageHistory),
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    });
    currentLibraryEntryId = id;
  } catch (error) {
    reportError("Couldn't save this note to your library.", error);
  }
};

// Whether the editor holds real, user-authored content worth keeping as
// its own library entry — deliberately stricter than "editor is non-empty":
// the title auto-fills from the active tab as soon as the panel opens (see
// context-title-suggestion.md), so a plain non-empty check would spawn a
// library entry from that alone. Require either actual note-body text, or
// a title the user deliberately typed/edited (userEditedTitle).
const hasRealNoteContent = () =>
  Boolean(
    notesInput.textContent.trim() ||
      (userEditedTitle && meetingNameInput.value.trim())
  );

// Ensures the note currently in the editor is captured in the library
// before switching away from it (New note / opening a different library
// entry) — normal autosave already keeps it within ~300ms, this just
// removes any dependency on that debounce's timing for an action that's
// about to replace the editor's content outright.
const flushLibrarySync = async () => {
  if (!hasRealNoteContent()) return;
  await saveNoteToLibrary(getFormData());
};

const noteSnippet = (markdown, maxLen = 90) => {
  const plain = (markdown || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_>#=~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > maxLen ? `${plain.slice(0, maxLen).trimEnd()}…` : plain;
};

const openLibraryEntry = async (id) => {
  // No confirmation needed: the note currently in the editor is already
  // autosaved to its own library entry (or about to be, via this flush) —
  // switching to a different one doesn't discard anything.
  await flushLibrarySync();
  let entry;
  try {
    entry = await NoteLibrary.getEntry(id);
  } catch (error) {
    reportError("Couldn't open that note.", error);
    return;
  }
  if (!entry) return;
  setFormData({
    meetingName: entry.title,
    meetingDate: entry.meetingDate,
    notes: entry.notes,
    pageUrl: currentPageUrl,
    pageHistory: entry.pageHistory,
    libraryEntryId: entry.id,
  });
  resetEditorFormatting();
  debouncedSaveDraft();
  setLibraryViewOpen(false);
  notesInput.focus();
};

const deleteLibraryEntryPrompt = async (entry) => {
  const label = entry.title || "this note";
  const confirmed = window.confirm(
    `Remove "${label}" from the library? This only removes it from Jot it! — it does not delete or affect the exported .md file already on disk.`
  );
  if (!confirmed) return;
  try {
    await NoteLibrary.deleteEntry(entry.id);
    if (currentLibraryEntryId === entry.id) {
      currentLibraryEntryId = null;
    }
    await loadLibraryList();
  } catch (error) {
    reportError("Couldn't remove that note from the library.", error);
  }
};

// Pinned entries always sort first regardless of the chosen sort mode;
// within each group (pinned / not pinned), "updated" reuses the
// already-reverse-chronological order NoteLibrary.listEntries() returns
// (an IndexedDB cursor on the updatedAt index), "created"/"title" re-sort
// client-side over the already-loaded cache — the library is expected to
// stay at a personal-notes scale, not a scale where this matters.
const sortLibraryEntries = (entries, mode) => {
  const copy = [...entries];
  if (mode === "created") {
    copy.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } else if (mode === "title") {
    copy.sort((a, b) =>
      (a.title || "").localeCompare(b.title || "", undefined, {
        sensitivity: "base",
      })
    );
  }
  return copy;
};

const entryMatchesCurrentSite = (entry, host) => {
  if (!host) return false;
  return (entry.pageHistory || []).some((page) => {
    try {
      return new URL(page.url).hostname === host;
    } catch (error) {
      return false;
    }
  });
};

const updateLibraryBulkBar = () => {
  if (!libraryBulkBar) return;
  libraryBulkBar.hidden = !libraryMultiSelectMode;
  const count = librarySelectedIds.size;
  if (libraryBulkCount) {
    libraryBulkCount.textContent = `${pluralize(count, "note")} selected`;
  }
  if (libraryBulkDeleteBtn) {
    libraryBulkDeleteBtn.disabled = count === 0;
  }
};

const exitLibraryMultiSelectMode = () => {
  libraryMultiSelectMode = false;
  librarySelectedIds.clear();
  libraryMultiSelectBtn?.classList.remove("active");
  libraryMultiSelectBtn?.setAttribute("aria-pressed", "false");
  updateLibraryBulkBar();
  renderLibraryList(librarySearchInput?.value || "");
};

// Pin/unpin never touches updatedAt/createdAt — it's a display-order
// preference, not an edit to the note itself, so it shouldn't bump a note
// to the top of "recently updated" or count as a real change.
const toggleLibraryEntryPinned = async (entry) => {
  try {
    await NoteLibrary.putEntry({ ...entry, pinned: !entry.pinned });
    await loadLibraryList();
  } catch (error) {
    reportError("Couldn't update that note.", error);
  }
};

const deleteSelectedLibraryEntries = async () => {
  const ids = Array.from(librarySelectedIds);
  if (!ids.length) return;
  const confirmed = window.confirm(
    `Remove ${pluralize(ids.length, "note")} from the library? This only removes them from Jot it! — it does not delete or affect any exported .md files already on disk.`
  );
  if (!confirmed) return;
  try {
    for (const id of ids) {
      await NoteLibrary.deleteEntry(id);
      if (currentLibraryEntryId === id) currentLibraryEntryId = null;
    }
    showToast(`Deleted ${pluralize(ids.length, "note")}`, { timeoutMs: 1800 });
  } catch (error) {
    reportError("Couldn't remove some notes from the library.", error);
  } finally {
    exitLibraryMultiSelectMode();
    await loadLibraryList();
  }
};

const renderLibraryList = (searchTerm) => {
  if (!libraryList) return;
  const term = (searchTerm || "").trim().toLowerCase();
  const currentHost = getCurrentHost();

  let base = libraryEntriesCache;
  if (libraryFilterThisSite) {
    base = base.filter((entry) => entryMatchesCurrentSite(entry, currentHost));
  }

  const filtered = !term
    ? base
    : base.filter((entry) => {
        const haystack = [
          entry.title || "",
          entry.notes || "",
          ...(entry.pageHistory || []).map((page) => page.title || ""),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      });

  const sorted = sortLibraryEntries(filtered, librarySortMode);
  const ordered = [
    ...sorted.filter((entry) => entry.pinned),
    ...sorted.filter((entry) => !entry.pinned),
  ];

  libraryList.innerHTML = "";

  if (libraryEmptyState) {
    if (!libraryEntriesCache.length) {
      libraryEmptyState.hidden = false;
      libraryEmptyState.textContent =
        "No saved notes yet. Every note saves automatically as you type — notes you save will show up here.";
    } else if (!ordered.length && term) {
      libraryEmptyState.hidden = false;
      libraryEmptyState.textContent = "No notes match your search.";
    } else if (!ordered.length && libraryFilterThisSite) {
      libraryEmptyState.hidden = false;
      libraryEmptyState.textContent = "No saved notes from this site yet.";
    } else {
      libraryEmptyState.hidden = true;
    }
  }

  ordered.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "library-row";
    if (entry.pinned) row.classList.add("is-pinned");
    row.dataset.id = entry.id;

    if (libraryMultiSelectMode) {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "library-row__checkbox";
      checkbox.checked = librarySelectedIds.has(entry.id);
      checkbox.setAttribute(
        "aria-label",
        `Select "${entry.title || "Untitled note"}"`
      );
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          librarySelectedIds.add(entry.id);
        } else {
          librarySelectedIds.delete(entry.id);
        }
        updateLibraryBulkBar();
      });
      row.appendChild(checkbox);
    } else {
      const pin = document.createElement("button");
      pin.type = "button";
      pin.className = "library-row__pin";
      pin.classList.toggle("is-pinned", Boolean(entry.pinned));
      pin.setAttribute("aria-pressed", String(Boolean(entry.pinned)));
      const pinLabel = entry.pinned ? "Unpin note" : "Pin note";
      pin.setAttribute("aria-label", pinLabel);
      pin.title = pinLabel;
      pin.innerHTML =
        '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<path d="M12 17v5" />' +
        '<path d="M9 3h6l1 5 3 2-1 3H6l-1-3 3-2z" />' +
        "</svg>";
      pin.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleLibraryEntryPinned(entry);
      });
      row.appendChild(pin);
    }

    const open = document.createElement("button");
    open.type = "button";
    open.className = "library-row__open";

    const titleEl = document.createElement("span");
    titleEl.className = "library-row__title";
    titleEl.textContent = entry.title || "Untitled note";

    const dateEl = document.createElement("span");
    dateEl.className = "library-row__date";
    dateEl.textContent = formatDateTime(new Date(entry.updatedAt));

    const snippetEl = document.createElement("span");
    snippetEl.className = "library-row__snippet";
    snippetEl.textContent = noteSnippet(entry.notes);

    open.append(titleEl, dateEl, snippetEl);
    open.addEventListener("click", () => {
      if (libraryMultiSelectMode) {
        const checkbox = row.querySelector(".library-row__checkbox");
        if (checkbox) {
          checkbox.checked = !checkbox.checked;
          checkbox.dispatchEvent(new Event("change"));
        }
        return;
      }
      openLibraryEntry(entry.id);
    });
    row.appendChild(open);

    if (!libraryMultiSelectMode) {
      const save = document.createElement("button");
      save.type = "button";
      save.className = "library-row__save";
      save.setAttribute("aria-label", "Save .md");
      save.title = "Save .md";
      save.innerHTML =
        '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />' +
        '<polyline points="7 10 12 15 17 10" />' +
        '<line x1="12" y1="15" x2="12" y2="3" />' +
        "</svg>";
      save.addEventListener("click", (event) => {
        event.stopPropagation();
        exportLibraryEntry(entry);
      });
      row.appendChild(save);

      const del = document.createElement("button");
      del.type = "button";
      del.className = "library-row__delete";
      del.setAttribute("aria-label", "Remove from library");
      del.title = "Remove from library (does not delete the exported file)";
      del.innerHTML =
        '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<polyline points="4 7 20 7" />' +
        '<path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />' +
        '<line x1="10" y1="11" x2="10" y2="17" />' +
        '<line x1="14" y1="11" x2="14" y2="17" />' +
        "</svg>";
      del.addEventListener("click", (event) => {
        event.stopPropagation();
        deleteLibraryEntryPrompt(entry);
      });
      row.appendChild(del);
    }

    libraryList.appendChild(row);
  });
};

const loadLibraryList = async () => {
  if (!libraryList) return;
  try {
    libraryEntriesCache = await NoteLibrary.listEntries();
  } catch (error) {
    reportError("Couldn't load saved notes.", error);
    libraryEntriesCache = [];
  }
  renderLibraryList(librarySearchInput?.value || "");
  updateLibraryBulkBar();
};

const setLibraryViewOpen = (open) => {
  libraryViewOpen = open;
  if (libraryView) libraryView.hidden = !open;
  if (metaSection) metaSection.hidden = open;
  if (notesSection) notesSection.hidden = open;
  libraryToggleBtn?.classList.toggle("active", open);
  libraryToggleBtn?.setAttribute("aria-pressed", String(open));
  if (!open && libraryMultiSelectMode) {
    exitLibraryMultiSelectMode();
  }
  if (open) {
    loadLibraryList();
    librarySearchInput?.focus();
  }
};

// Exports a single library entry straight to disk without opening it into
// the editor first — mirrors handleSave's exact single-note behavior
// (folder only if the note has image attachments, silent saveAs:false
// download falling back to saveAs:true on error), just operating on a
// stored entry's data instead of the live editor. Kept as its own
// duplicate rather than refactored to share code with handleSave/
// handleSaveAs/exportAllNotes — that consolidation is known-issue #2 in
// docs/plan/roadmap.md, explicitly left on hold; this follows the same
// already-accepted duplication pattern rather than touching working,
// tested code for an unrelated change.
const exportLibraryEntry = async (entry) => {
  const data = {
    meetingName: entry.title,
    meetingDate: entry.meetingDate,
    notes: entry.notes,
  };
  // buildMarkdown/buildYamlFrontmatter read page-visit history off the
  // module-level pageHistory variable — swap to this entry's own history
  // for the export, restore the live editor's regardless of outcome.
  const originalPageHistory = pageHistory;
  pageHistory = normalizePageHistory(entry.pageHistory);
  try {
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
      await downloadMarkdown(payload, noteDownloadFilename, {
        saveAs: true,
        conflictAction: "uniquify",
        mimeType,
      });
      await downloadImageAttachments(exportData.attachments, exportRoot);
    }
    showToast(
      hasAttachments ? "Exported note folder to Downloads" : "Exported to Downloads",
      { timeoutMs: 1800 }
    );
  } catch (error) {
    reportError(`Couldn't export "${entry.title || "a note"}".`, error);
    window.alert("Save failed. Please try again.");
  } finally {
    pageHistory = originalPageHistory;
  }
};

// Reverses toYamlString (JSON.stringify) for the frontmatter scalars this
// app itself writes — not a general YAML parser, see toYamlString's own
// comment in buildYamlFrontmatter. Falls back to the raw trimmed string if
// JSON.parse fails, so a hand-edited file with an unquoted value still
// imports something reasonable instead of throwing.
const parseYamlScalarString = (raw) => {
  const trimmed = (raw || "").trim();
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    return trimmed.replace(/^"|"$/g, "");
  }
};

// Reads back a file this app exported (buildMarkdown/buildYamlFrontmatter) —
// deliberately scoped to round-tripping Jot it!'s own export format, not
// arbitrary Markdown/frontmatter from other tools. Returns null if the file
// doesn't start with a "---" frontmatter block at all; anything narrower
// than that (a missing field, an unexpected pages_visited shape) degrades
// gracefully field-by-field rather than rejecting the whole import, since a
// partially-recovered note is more useful than none.
const parseImportedNote = (text) => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text || "");
  if (!match) return null;
  const [, frontmatter, rest] = match;
  const lines = frontmatter.split(/\r?\n/);
  let title = "";
  let date = "";
  let time = "";
  const pageHistory = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const titleMatch = /^title:\s*(.+)$/.exec(line);
    if (titleMatch) {
      title = parseYamlScalarString(titleMatch[1]);
      continue;
    }
    const dateMatch = /^date:\s*(.+)$/.exec(line);
    if (dateMatch) {
      date = dateMatch[1].trim();
      continue;
    }
    const timeMatch = /^time:\s*(.+)$/.exec(line);
    if (timeMatch) {
      time = parseYamlScalarString(timeMatch[1]);
      continue;
    }
    if (/^pages_visited:\s*$/.test(line)) {
      let j = i + 1;
      while (j < lines.length && /^\s*-\s+/.test(lines[j])) {
        const itemMatch = /^\s*-\s+(.+)$/.exec(lines[j]);
        if (itemMatch) {
          const linkString = parseYamlScalarString(itemMatch[1]);
          const linkMatch = /^\[([^\]]*)\]\(([^)]*)\)$/.exec(linkString);
          if (linkMatch) {
            pageHistory.push({
              title: linkMatch[1] || linkMatch[2],
              url: linkMatch[2],
              visitedAt: Date.now(),
            });
          }
        }
        j += 1;
      }
      i = j - 1;
    }
  }

  const meetingDate =
    date && time ? `${date}T${time}` : toLocalDateTimeValue();
  let body = (rest || "").replace(/^\r?\n+/, "");
  const headingMatch = /^#[^\n]*\r?\n\r?\n?/.exec(body);
  if (headingMatch) {
    body = body.slice(headingMatch[0].length);
  }

  return {
    title: title || "Imported note",
    meetingDate,
    notes: body.trim(),
    pageHistory,
  };
};

const importLibraryEntryFromFile = async (file) => {
  try {
    const text = await file.text();
    const parsed = parseImportedNote(text);
    if (!parsed) {
      reportError(
        "That file doesn't look like a Jot it! export.",
        new Error("no frontmatter block found")
      );
      return;
    }
    const now = Date.now();
    await NoteLibrary.putEntry({
      id: NoteLibrary.generateId(),
      title: sanitizeMeetingName(parsed.title),
      meetingDate: parsed.meetingDate,
      notes: parsed.notes,
      pageHistory: normalizePageHistory(parsed.pageHistory),
      createdAt: now,
      updatedAt: now,
    });
    showToast("Note imported.", { timeoutMs: 1800 });
    await loadLibraryList();
  } catch (error) {
    reportError("Couldn't import that file.", error);
  }
};

// One-click "get everything back onto disk" — reuses the exact same
// per-note export mechanics as Save As (buildObsidianImageExport,
// writeTextFile/writeAttachmentsToDirectory, or the chrome.downloads
// fallback), just looped over every library entry. Every note gets its
// own subfolder under the chosen destination (<slug>/<filename>.md, +
// attachments/ if needed) — unlike a single Save As, this always creates
// a folder per note (even with no images) since many notes are being
// written into one shared destination and need distinguishable paths.
// See docs/specs/note-library.md.
const exportAllNotes = async () => {
  let entries;
  try {
    entries = await NoteLibrary.listEntries();
  } catch (error) {
    reportError("Couldn't load the note library.", error);
    return;
  }
  if (!entries.length) {
    showToast("No saved notes to export", { timeoutMs: 1800 });
    return;
  }

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

  // buildMarkdown/buildYamlFrontmatter read page-visit history off the
  // module-level `pageHistory` variable (the currently-open note's), not
  // from an argument — swap it to each entry's own history for the
  // duration of that entry's export, and restore the live editor's actual
  // history no matter how the loop ends.
  const originalPageHistory = pageHistory;
  let successCount = 0;
  try {
    for (const entry of entries) {
      const data = {
        meetingName: entry.title,
        meetingDate: entry.meetingDate,
        notes: entry.notes,
      };
      pageHistory = normalizePageHistory(entry.pageHistory);
      try {
        const filename = buildFilename(data);
        const downloadFilename = toDownloadFilename(filename);
        const exportData = await buildObsidianImageExport(
          buildMarkdown(data),
          downloadFilename
        );
        const entryFolderName = toAttachmentSafeName(
          downloadFilename.replace(/\.md$/i, ""),
          "jot-it-note"
        );

        if (directoryHandle) {
          const entryDir = await directoryHandle.getDirectoryHandle(
            entryFolderName,
            { create: true }
          );
          await writeTextFile(
            entryDir,
            downloadFilename,
            exportData.markdown,
            "text/markdown"
          );
          await writeAttachmentsToDirectory(entryDir, exportData.attachments);
        } else {
          await downloadMarkdown(
            exportData.markdown,
            `${entryFolderName}/${downloadFilename}`,
            { saveAs: false, conflictAction: "uniquify", mimeType: "text/markdown" }
          );
          await downloadImageAttachments(exportData.attachments, entryFolderName);
          // Chrome warns/blocks after a handful of downloads triggered in
          // quick succession from one page — throttle between notes.
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
        successCount += 1;
      } catch (error) {
        reportError(`Couldn't export "${entry.title || "a note"}".`, error);
      }
    }
  } finally {
    pageHistory = originalPageHistory;
  }

  showToast(`Exported ${successCount} of ${entries.length} notes`, {
    timeoutMs: 2400,
  });
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
  // No confirmation needed: the current note (if any) is already autosaved
  // to its own library entry (or about to be, via this flush) — starting a
  // new note doesn't lose it, it stays findable in the library.
  await flushLibrarySync();

  setFormData({
    meetingName: "",
    meetingDate: toLocalDateTimeValue(),
    notes: "",
    pageHistory: [],
  });
  pageHistory = [];
  updateTitleFromActiveTab().catch(() => {});
  try {
    await storageRemove(STORAGE_KEY);
  } catch (error) {
    reportError("Couldn't clear the saved draft.", error);
  }
  resetEditorFormatting();
  notesInput.innerHTML = "";
  updateEditorStats();
  setLibraryViewOpen(false);
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

  // A captured page selection is a quoted external source with a link back
  // to it, not generic prose — deliberately still goes in a code block (see
  // insertPastedTextAsPlainText's comment for why a generic clipboard paste
  // no longer does), with the clickable source link as its own paragraph
  // directly below the block rather than inline with the text.
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
      TITLE_LOCK_KEY,
      ONBOARDING_HINT_KEY,
    ]);
    if (Object.prototype.hasOwnProperty.call(result, TITLE_LOCK_KEY) && !storageState.refreshed[TITLE_LOCK_KEY]) {
      titleLocked = Boolean(result[TITLE_LOCK_KEY]);
    }
    if (onboardingHint && !result[ONBOARDING_HINT_KEY]) {
      onboardingHint.hidden = false;
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
  syncPanelOpenState();
  // Covers the migration gap for a draft that already had real body
  // content before this feature existed (or one the user never touches
  // again after this reload) — every other case is covered by the
  // autosave in saveDraft() reacting to the next edit. Deliberately checks
  // body text directly rather than hasRealNoteContent()'s title fallback:
  // init() always sets userEditedTitle from whatever title the draft
  // happened to have (see above), even if it was only ever auto-filled,
  // so the title-based signal isn't trustworthy immediately after a
  // reload the way it is when it's set live by the user actually typing.
  if (notesInput.textContent.trim()) {
    saveNoteToLibrary(getFormData()).catch(() => {});
  }
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
    insertPastedTextAsPlainText(text);
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

// Global app shortcuts. Alt+<letter> combos deliberately avoid E/`/I/N/U —
// on macOS, plain Option+{E,`,I,N,U} are reserved dead keys for typing
// accented characters (é, è, î, ñ, ü); intercepting them here would break
// accent input for anyone typing in a language that uses them. Cmd/Ctrl+Alt
// combos aren't affected (dead-key composition only triggers on a lone
// Option press), so New note uses that instead of a plain Alt+N.
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (libraryViewOpen) {
      setLibraryViewOpen(false);
      return;
    }
    if (pickerOpen) {
      closeDatePicker();
    }
    return;
  }
  const key = event.key.toLowerCase();
  if ((event.metaKey || event.ctrlKey) && !event.altKey && key === "s") {
    event.preventDefault();
    if (event.shiftKey) {
      handleSaveAs();
    } else {
      handleSave();
    }
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.altKey && key === "n") {
    event.preventDefault();
    handleClear();
    return;
  }
  if (event.altKey && !event.metaKey && !event.ctrlKey && key === "l") {
    event.preventDefault();
    setLibraryViewOpen(!libraryViewOpen);
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
libraryToggleBtn?.addEventListener("click", () => {
  setLibraryViewOpen(!libraryViewOpen);
});
librarySearchInput?.addEventListener("input", () => {
  renderLibraryList(librarySearchInput.value);
});
libraryExportAllBtn?.addEventListener("click", exportAllNotes);
libraryImportBtn?.addEventListener("click", () => libraryImportInput?.click());
libraryImportInput?.addEventListener("change", () => {
  const file = libraryImportInput.files?.[0];
  libraryImportInput.value = "";
  if (file) importLibraryEntryFromFile(file);
});
librarySortSelect?.addEventListener("change", () => {
  librarySortMode = librarySortSelect.value;
  renderLibraryList(librarySearchInput?.value || "");
});
libraryFilterSiteBtn?.addEventListener("click", () => {
  libraryFilterThisSite = !libraryFilterThisSite;
  libraryFilterSiteBtn.classList.toggle("active", libraryFilterThisSite);
  libraryFilterSiteBtn.setAttribute("aria-pressed", String(libraryFilterThisSite));
  renderLibraryList(librarySearchInput?.value || "");
});
libraryMultiSelectBtn?.addEventListener("click", () => {
  libraryMultiSelectMode = !libraryMultiSelectMode;
  librarySelectedIds.clear();
  libraryMultiSelectBtn.classList.toggle("active", libraryMultiSelectMode);
  libraryMultiSelectBtn.setAttribute("aria-pressed", String(libraryMultiSelectMode));
  updateLibraryBulkBar();
  renderLibraryList(librarySearchInput?.value || "");
});
libraryBulkCancelBtn?.addEventListener("click", exitLibraryMultiSelectMode);
libraryBulkDeleteBtn?.addEventListener("click", deleteSelectedLibraryEntries);
onboardingHintDismiss?.addEventListener("click", () => {
  if (onboardingHint) onboardingHint.hidden = true;
  storageSet({ [ONBOARDING_HINT_KEY]: true }).catch(() => {});
});
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

// Toolbar-command shortcuts. Digit- and semicolon-based combos check
// e.code (physical key position) rather than e.key, because a Shift+digit
// KeyboardEvent's `key` is the shifted character ("*" for Shift+8, not
// "8"), which is also layout-dependent — `code` avoids both problems.
// Cmd/Ctrl+Shift+8 / +7 deliberately match Google Docs' bullet/numbered
// list shortcuts.
notesInput.addEventListener("keydown", (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && !e.shiftKey && e.key === "b") {
    e.preventDefault();
    applyFormat("bold");
  }
  if (mod && !e.shiftKey && e.key === "i") {
    e.preventDefault();
    applyFormat("italic");
  }
  if (mod && !e.shiftKey && e.key.toLowerCase() === "e") {
    e.preventDefault();
    applyFormat("code");
  }
  if (mod && e.shiftKey && e.key.toLowerCase() === "h") {
    e.preventDefault();
    applyFormat("heading");
  }
  if (mod && e.shiftKey && e.key.toLowerCase() === "k") {
    e.preventDefault();
    applyFormat("codeblock");
  }
  if (mod && e.shiftKey && e.code === "Digit8") {
    e.preventDefault();
    applyFormat("ul");
  }
  if (mod && e.shiftKey && e.code === "Digit7") {
    e.preventDefault();
    applyFormat("ol");
  }
  if (mod && e.shiftKey && e.code === "Digit9") {
    e.preventDefault();
    applyFormat("highlight");
  }
  if (mod && e.shiftKey && e.code === "Semicolon") {
    e.preventDefault();
    applyFormat("timestamp");
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
