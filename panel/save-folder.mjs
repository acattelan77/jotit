/**
 * Remembers the folder Save writes to (a FileSystemDirectoryHandle kept in
 * its own IndexedDB database) and checks write access to it.
 * See docs/decisions/0010-remembered-save-folder.md.
 */

const DB_NAME = "jotit-save-folder";
const DB_VERSION = 1;
const STORE_NAME = "handles";
const HANDLE_KEY = "saveFolder";

const requestToPromise = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export const createSaveFolderStore = ({ indexedDBApi = globalThis.indexedDB } = {}) => {
  let dbPromise = null;

  const openDb = () => {
    if (dbPromise) return dbPromise;
    if (!indexedDBApi) {
      return Promise.reject(new Error("IndexedDB is not available."));
    }
    const request = indexedDBApi.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    dbPromise = requestToPromise(request).catch((error) => {
      dbPromise = null;
      throw error;
    });
    return dbPromise;
  };

  const run = async (mode, operation) => {
    const db = await openDb();
    const store = db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
    return requestToPromise(operation(store));
  };

  return {
    get: async () => (await run("readonly", (store) => store.get(HANDLE_KEY))) || null,
    set: (handle) => run("readwrite", (store) => store.put(handle, HANDLE_KEY)),
    clear: () => run("readwrite", (store) => store.delete(HANDLE_KEY)),
  };
};

export class SaveFolderAccessError extends Error {
  constructor(code, folderName) {
    super(
      code === "permission-needed"
        ? `Click Save to allow access to "${folderName}".`
        : `Access to "${folderName}" was not allowed.`
    );
    this.name = "SaveFolderAccessError";
    this.code = code;
  }
}

// Returns the handle once readwrite access is granted. Asking for access
// needs a user gesture: without one (extension commands) Chrome throws a
// SecurityError, reported as "permission-needed" instead of a silent
// Downloads fallback.
export const ensureFolderAccess = async (handle) => {
  const options = { mode: "readwrite" };
  if ((await handle.queryPermission(options)) === "granted") return handle;
  let permission;
  try {
    permission = await handle.requestPermission(options);
  } catch (error) {
    if (error?.name === "SecurityError") {
      throw new SaveFolderAccessError("permission-needed", handle.name);
    }
    throw error;
  }
  if (permission === "granted") return handle;
  throw new SaveFolderAccessError("permission-denied", handle.name);
};
