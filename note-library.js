(() => {
  const DB_NAME = "jotit-library";
  const DB_VERSION = 1;
  const STORE_NAME = "notes";
  const UPDATED_AT_INDEX = "updatedAt";

  let dbPromise = null;
  let persistRequested = false;

  const openDb = () => {
    if (dbPromise) return dbPromise;
    if (typeof indexedDB === "undefined") {
      return Promise.reject(new Error("IndexedDB is not available."));
    }
    dbPromise = new Promise((resolve, reject) => {
      let settled = false;
      const failOpen = (error) => {
        if (settled) return;
        settled = true;
        dbPromise = null;
        reject(error || new Error("Couldn't open the note library."));
      };
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex(UPDATED_AT_INDEX, UPDATED_AT_INDEX, {
            unique: false,
          });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        if (settled) {
          db.close();
          return;
        }
        settled = true;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => failOpen(request.error);
      request.onblocked = () =>
        failOpen(new Error("The note library is blocked by another open window."));
    });
    return dbPromise;
  };

  // Reduces (doesn't guarantee) eviction risk under disk pressure — a
  // runtime API call, not a manifest permission, so it triggers no
  // install/update permission-dialog entry. Best-effort: a denied or
  // unsupported request just leaves storage "best-effort" as before this
  // call, it doesn't affect correctness. See ADR-0006.
  const requestPersistence = async () => {
    if (persistRequested) return;
    persistRequested = true;
    try {
      if (navigator?.storage?.persist) {
        const granted = await navigator.storage.persist();
        console.info(
          `[Jot it] IndexedDB persistence ${granted ? "granted" : "not granted"}.`
        );
      }
    } catch (error) {
      // best-effort only
    }
  };

  const putEntry = async (entry) => {
    const db = await openDb();
    requestPersistence();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(entry);
      tx.oncomplete = () => resolve(entry);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  };

  const getEntry = async (id) => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  };

  const deleteEntry = async (id) => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  };

  // Reverse-chronological (most recently updated first) — the library's
  // default and only sort order, per note-library.md.
  const listEntries = async () => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const index = tx.objectStore(STORE_NAME).index(UPDATED_AT_INDEX);
      const results = [];
      const request = index.openCursor(null, "prev");
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });
  };

  const generateId = () =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `note-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const api = {
    openDb,
    putEntry,
    getEntry,
    deleteEntry,
    listEntries,
    generateId,
  };

  if (typeof window !== "undefined") {
    window.NoteLibrary = api;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
