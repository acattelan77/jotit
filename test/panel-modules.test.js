const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const NoteUtils = require("../lib/note-utils.js");
const importPanelModule = (name) =>
  import(pathToFileURL(path.resolve(__dirname, `../panel/${name}`)).href);

describe("panel date/time module", () => {
  it("rejects rolled-over dates instead of silently normalizing them", async () => {
    const { parseDateValue } = await importPanelModule("date-time.mjs");
    assert.equal(parseDateValue("2026-02-31T10:00"), null);
    assert.equal(parseDateValue("2026-07-11T25:00"), null);
    assert.equal(
      parseDateValue("2026-07-11T10:30")?.getMinutes(),
      30
    );
  });

  it("builds stable local frontmatter parts", async () => {
    const { toLocalDateTimeParts } = await importPanelModule("date-time.mjs");
    assert.deepEqual(toLocalDateTimeParts("2026-07-11T09:05"), {
      date: "2026-07-11",
      time: "09:05",
      datetime: "2026-07-11T09:05",
    });
  });
});

describe("panel state module", () => {
  it("creates isolated state for each panel document", async () => {
    const { createPanelState } = await importPanelModule("state.mjs");
    const first = createPanelState();
    const second = createPanelState();
    first.library.selectedIds.add("note-1");
    first.page.history.push({ url: "https://example.com/" });
    first.storage.refreshed.titleLockEnabled = true;
    assert.equal(second.library.selectedIds.size, 0);
    assert.deepEqual(second.page.history, []);
    assert.deepEqual(second.storage.refreshed, {});
  });

  it("resets title auto-fill guards for a new note", async () => {
    const {
      createPanelState,
      resetTitleTrackingForNewNote,
    } = await importPanelModule("state.mjs");
    const state = createPanelState();
    Object.assign(state.title, {
      lastAutomatic: "Old page",
      currentPage: "Old page",
      userEdited: true,
      lastTabId: 7,
      lastTabUrl: "https://example.com/old",
    });

    resetTitleTrackingForNewNote(state);

    assert.deepEqual(state.title, {
      lastAutomatic: "",
      currentPage: "",
      userEdited: false,
      lastTabId: null,
      lastTabUrl: "",
      locked: false,
    });
  });
});

describe("panel storage module", () => {
  it("wraps callback storage and exposes debounce cancellation", async () => {
    const { createStorage, debounce } = await importPanelModule("storage.mjs");
    const values = {};
    const area = {
      get(keys, callback) {
        const selected = {};
        for (const key of Array.isArray(keys) ? keys : [keys]) {
          if (key in values) selected[key] = values[key];
        }
        callback(selected);
      },
      set(data, callback) {
        Object.assign(values, data);
        callback();
      },
      remove(key, callback) {
        delete values[key];
        callback();
      },
    };
    const storage = createStorage(area);
    await storage.set({ draft: 1 });
    assert.deepEqual(await storage.get("draft"), { draft: 1 });
    await storage.remove("draft");
    assert.deepEqual(await storage.get("draft"), {});

    let called = 0;
    const pending = new Map();
    let nextId = 0;
    const debounced = debounce(() => called += 1, 10, {
      setTimeout(fn) {
        nextId += 1;
        pending.set(nextId, fn);
        return nextId;
      },
      clearTimeout(id) {
        pending.delete(id);
      },
    });
    debounced();
    debounced.cancel();
    pending.forEach((fn) => fn());
    assert.equal(called, 0);
  });
});

describe("panel export service", () => {
  it("builds frontmatter and rewrites embedded images deterministically", async () => {
    const { createExportService } = await importPanelModule(
      "export-service.mjs"
    );
    const service = createExportService({
      noteUtils: NoteUtils,
      normalizePageHistory: (entries) => entries || [],
      chromeApi: { downloads: {}, runtime: {} },
      fetchImpl: async () => {
        throw new Error("unexpected fetch");
      },
    });
    const prepared = await service.prepareNoteExport({
      meetingName: "Review",
      meetingDate: "2026-07-11T09:05",
      notes: "Screenshot\n\n![Image](data:image/png;base64,aGk=)",
      pageHistory: [
        { title: "Example", url: "https://example.com/", visitedAt: 1 },
      ],
    });

    assert.equal(prepared.hasAttachments, true);
    assert.equal(prepared.exportData.attachments.length, 1);
    assert.match(prepared.exportData.markdown, /pages_visited:/);
    assert.match(
      prepared.exportData.markdown,
      /attachments\/2026-07-11-h09-05-review-image-1\.png/
    );
  });
});

// Minimal in-memory stand-in for FileSystemDirectoryHandle.
const createFakeDirectory = (name = "root") => {
  const files = new Map();
  const directories = new Map();
  const notFound = () =>
    Object.assign(new Error("not found"), { name: "NotFoundError" });
  return {
    name,
    files,
    directories,
    async getFileHandle(filename, { create = false } = {}) {
      if (!files.has(filename) && !create) throw notFound();
      return {
        async createWritable() {
          return {
            async write(blob) {
              files.set(filename, blob);
            },
            async close() {},
          };
        },
      };
    },
    async getDirectoryHandle(dirname, { create = false } = {}) {
      if (!directories.has(dirname)) {
        if (!create) throw notFound();
        directories.set(dirname, createFakeDirectory(dirname));
      }
      return directories.get(dirname);
    },
  };
};

describe("panel export service: remembered save folder writes", () => {
  const createService = async () => {
    const { createExportService } = await importPanelModule(
      "export-service.mjs"
    );
    return createExportService({
      noteUtils: NoteUtils,
      normalizePageHistory: (entries) => entries || [],
      chromeApi: { downloads: {}, runtime: {} },
      fetchImpl: async () => {
        throw new Error("unexpected fetch");
      },
    });
  };

  it("writes a plain note at the folder root and uniquifies repeats", async () => {
    const service = await createService();
    const prepared = await service.prepareNoteExport({
      meetingName: "Review",
      meetingDate: "2026-07-11T09:05",
      notes: "Plain text",
      pageHistory: [],
    });
    const folder = createFakeDirectory("_inbox");

    const first = await service.writeNoteToDirectory(folder, prepared);
    const second = await service.writeNoteToDirectory(folder, prepared);

    assert.equal(first, prepared.downloadFilename);
    assert.equal(
      second,
      prepared.downloadFilename.replace(/\.md$/, " (1).md")
    );
    assert.equal(folder.files.size, 2);
    assert.equal(folder.directories.size, 0);
  });

  it("writes notes with images into their own folder with attachments", async () => {
    const service = await createService();
    const prepared = await service.prepareNoteExport({
      meetingName: "Review",
      meetingDate: "2026-07-11T09:05",
      notes: "![Image](data:image/png;base64,aGk=)",
      pageHistory: [],
    });
    const folder = createFakeDirectory("_inbox");

    const written = await service.writeNoteToDirectory(folder, prepared);

    assert.equal(written, prepared.noteDownloadFilename);
    const noteFolder = folder.directories.get(prepared.exportRoot);
    assert.ok(noteFolder.files.has(prepared.downloadFilename));
    assert.equal(noteFolder.directories.get("attachments").files.size, 1);
  });
});

describe("panel save folder access", () => {
  const createHandle = ({ query, request }) => ({
    name: "_inbox",
    requested: 0,
    async queryPermission() {
      return query;
    },
    async requestPermission() {
      this.requested += 1;
      if (request instanceof Error) throw request;
      return request;
    },
  });

  it("returns the folder without prompting when access is already granted", async () => {
    const { ensureFolderAccess } = await importPanelModule("save-folder.mjs");
    const handle = createHandle({ query: "granted", request: "denied" });
    assert.equal(await ensureFolderAccess(handle), handle);
    assert.equal(handle.requested, 0);
  });

  it("asks for access and returns the folder when the user allows it", async () => {
    const { ensureFolderAccess } = await importPanelModule("save-folder.mjs");
    const handle = createHandle({ query: "prompt", request: "granted" });
    assert.equal(await ensureFolderAccess(handle), handle);
    assert.equal(handle.requested, 1);
  });

  it("reports a denied prompt instead of falling back to Downloads", async () => {
    const { ensureFolderAccess } = await importPanelModule("save-folder.mjs");
    const handle = createHandle({ query: "prompt", request: "denied" });
    await assert.rejects(ensureFolderAccess(handle), {
      name: "SaveFolderAccessError",
      code: "permission-denied",
    });
  });

  it("asks for a click when there is no user gesture to prompt with", async () => {
    const { ensureFolderAccess } = await importPanelModule("save-folder.mjs");
    const securityError = Object.assign(new Error("no gesture"), {
      name: "SecurityError",
    });
    const handle = createHandle({ query: "prompt", request: securityError });
    await assert.rejects(ensureFolderAccess(handle), {
      code: "permission-needed",
      message: 'Click Save to allow access to "_inbox".',
    });
  });
});
