/** Promise-based access to the panel's chrome.storage.local boundary. */

export const createStorage = (storageArea, getLastError = () => null) => {
  if (!storageArea) throw new Error("A storage area is required.");

  const get = (keys) =>
    new Promise((resolve, reject) => {
      storageArea.get(keys, (result) => {
        const error = getLastError();
        if (error) {
          reject(error);
          return;
        }
        resolve(result || {});
      });
    });

  const set = (data) =>
    new Promise((resolve, reject) => {
      storageArea.set(data, () => {
        const error = getLastError();
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

  const remove = (key) =>
    new Promise((resolve, reject) => {
      storageArea.remove(key, () => {
        const error = getLastError();
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

  return { get, set, remove };
};

export const debounce = (fn, wait = 250, timerApi = globalThis) => {
  let timeoutId;
  const debounced = (...args) => {
    timerApi.clearTimeout(timeoutId);
    timeoutId = timerApi.setTimeout(() => fn(...args), wait);
  };
  debounced.cancel = () => timerApi.clearTimeout(timeoutId);
  return debounced;
};
