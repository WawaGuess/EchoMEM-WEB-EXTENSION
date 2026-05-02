export function bindRuntimeMessages() {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    return true;
  });
}
