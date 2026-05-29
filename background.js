// Background Service Worker
// 处理扩展的后台逻辑

chrome.runtime.onInstalled.addListener((details) => {
  console.log('Claw Extension installed:', details.reason);

  // 初始化存储
  chrome.storage.local.set({
    settings: {
      autoExtract: false,
      defaultAction: 'info'
    },
    history: []
  });
});

// 监听来自内容脚本和 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getTabInfo') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        sendResponse({
          id: tabs[0].id,
          url: tabs[0].url,
          title: tabs[0].title
        });
      }
    });
    return true; // 保持消息通道开放
  }

  if (request.action === 'saveToHistory') {
    chrome.storage.local.get(['history'], (result) => {
      const history = result.history || [];
      history.unshift({
        ...request.data,
        timestamp: Date.now()
      });
      // 只保留最近 100 条
      if (history.length > 100) {
        history.pop();
      }
      chrome.storage.local.set({ history }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }

  if (request.action === 'fetchStatsSummary') {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    fetch('http://127.0.0.1:8000/api/stats/summary', {
      method: 'GET',
      signal: controller.signal,
    })
      .then(async (response) => {
        clearTimeout(timer);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          sendResponse({ success: false, error: data.error?.message || `HTTP ${response.status}` });
        } else {
          sendResponse({ success: true, data });
        }
      })
      .catch((err) => {
        clearTimeout(timer);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }
});

// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    console.log('Page loaded:', tab.url);
  }
});
