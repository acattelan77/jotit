/** Creates the mutable state owned by one side-panel document. */

export const createPanelState = () => ({
  toastTimer: null,
  lastToastAt: 0,
  title: {
    lastAutomatic: "",
    currentPage: "",
    userEdited: false,
    lastTabId: null,
    lastTabUrl: "",
    locked: false,
  },
  page: {
    currentUrl: "",
    panelTabId: null,
    history: [],
  },
  editor: {
    lastRange: null,
    lastInsertedSelection: { text: "", url: "" },
    lastInsertedAt: 0,
    pendingSelection: null,
    lastCaretOffset: null,
  },
  library: {
    currentEntryId: null,
    viewOpen: false,
    entries: [],
    sortMode: "updated",
    filterThisSite: false,
    multiSelect: false,
    selectedIds: new Set(),
    saveQueue: Promise.resolve(),
  },
  draftSaveQueue: Promise.resolve(),
  storage: {
    refreshed: {},
  },
  debugEnabled: false,
  initialized: false,
});
