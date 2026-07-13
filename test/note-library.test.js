const assert = require("node:assert/strict");
const { afterEach, describe, it } = require("node:test");

const modulePath = require.resolve("../note-library.js");
const savedIndexedDb = globalThis.indexedDB;

const loadLibrary = (indexedDb) => {
  delete require.cache[modulePath];
  globalThis.indexedDB = indexedDb;
  return require(modulePath);
};

afterEach(() => {
  delete require.cache[modulePath];
  globalThis.indexedDB = savedIndexedDb;
});

describe("NoteLibrary IndexedDB wrapper", () => {
  it("puts, gets, lists by updated time, and deletes entries", async () => {
    const library = loadLibrary(createFakeIndexedDb());
    const older = { id: "older", title: "Older", updatedAt: 10 };
    const newer = { id: "newer", title: "Newer", updatedAt: 20 };

    await library.putEntry(older);
    await library.putEntry(newer);
    assert.deepEqual(await library.getEntry("older"), older);
    assert.deepEqual(await library.listEntries(), [newer, older]);

    await library.deleteEntry("older");
    assert.equal(await library.getEntry("older"), null);
  });

  it("retries after a transient database-open failure", async () => {
    const indexedDb = createFakeIndexedDb({ failFirstOpen: true });
    const library = loadLibrary(indexedDb);

    await assert.rejects(library.openDb(), /transient open failure/);
    const db = await library.openDb();
    assert.ok(db);
    assert.equal(indexedDb.openCalls, 2);
  });
});

function createFakeIndexedDb({ failFirstOpen = false } = {}) {
  const entries = new Map();
  let opened = false;
  const indexedDb = {
    openCalls: 0,
    open() {
      indexedDb.openCalls += 1;
      const request = {};
      queueMicrotask(() => {
        if (failFirstOpen && indexedDb.openCalls === 1) {
          request.error = new Error("transient open failure");
          request.onerror?.();
          return;
        }
        const db = createDb(entries);
        request.result = db;
        if (!opened) {
          opened = true;
          request.onupgradeneeded?.();
        }
        request.onsuccess?.();
      });
      return request;
    },
  };
  return indexedDb;
}

function createDb(entries) {
  const objectStoreNames = {
    contains(name) {
      return name === "notes";
    },
  };

  return {
    objectStoreNames,
    close() {},
    createObjectStore() {
      return { createIndex() {} };
    },
    transaction() {
      const tx = {
        objectStore() {
          return createStore(entries, tx);
        },
      };
      return tx;
    },
  };
}

function createStore(entries, tx) {
  return {
    put(entry) {
      entries.set(entry.id, structuredClone(entry));
      queueMicrotask(() => tx.oncomplete?.());
    },
    get(id) {
      const request = {};
      queueMicrotask(() => {
        request.result = entries.has(id) ? structuredClone(entries.get(id)) : undefined;
        request.onsuccess?.();
      });
      return request;
    },
    delete(id) {
      entries.delete(id);
      queueMicrotask(() => tx.oncomplete?.());
    },
    index() {
      return {
        openCursor() {
          const request = {};
          const values = [...entries.values()].sort(
            (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
          );
          let index = 0;
          const emit = () => {
            const value = values[index];
            request.result = value
              ? {
                  value: structuredClone(value),
                  continue() {
                    index += 1;
                    queueMicrotask(emit);
                  },
                }
              : null;
            request.onsuccess?.();
          };
          queueMicrotask(emit);
          return request;
        },
      };
    },
  };
}
