export function getLocalStorage(keys) {
  return chrome.storage.local.get(keys);
}

export function setLocalStorage(values) {
  return chrome.storage.local.set(values);
}
