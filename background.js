// Background Service Worker
// 处理扩展的后台逻辑

// 文档：docs/flows/panel-system/工具栏打开浮层.md
// 工具栏图标与网页标题栏入口统一打开活动页面中的 EchoMem overlay。
chrome.action.onClicked.addListener((tab) => {
  if (!tab?.id) return;

  chrome.tabs.sendMessage(tab.id, { action: 'openEchoMemOverlay' }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn('EchoMem: unable to open overlay in the active tab', chrome.runtime.lastError.message);
      return;
    }
    if (!response?.success) {
      console.warn('EchoMem: active tab did not open the overlay', response?.error || 'unknown error');
    }
  });
});

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
    // 发布包未包含 src/services/openview-client.js；从 Service Worker 导入它会导致
    // Manifest V3 注册失败。EchoAgent 也尚未提供当前面板需要的统计接口。
    sendResponse({
      success: false,
      error: '当前 EchoAgent 服务暂不支持会话统计汇总',
    });
    return false;
  }

  if (request.action === 'openViewRequest') {
    const { url, method = 'GET', headers = {}, body, credentials } = request;

    fetch(url, { method, headers, body, credentials })
      .then(async (response) => {
        const text = await response.text().catch(() => '');
        let data = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          data = {};
        }
        if (!response.ok) {
          sendResponse({
            success: false,
            status: response.status,
            error: data.message || data.error?.message || `HTTP ${response.status}`,
            data,
            text,
          });
          return;
        }
        sendResponse({ success: true, status: response.status, data, text });
      })
      .catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }

  if (request.action === 'echoMemRequest') {
    const { url, method = 'GET', headers = {}, body, timeout = 5000 } = request;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    })
      .then(async (response) => {
        clearTimeout(timer);
        const text = await response.text().catch(() => '');
        let data = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          data = {};
        }
        if (!response.ok) {
          sendResponse({
            success: false,
            status: response.status,
            error: data.error?.message || data.message || `HTTP ${response.status}`,
            data,
            text,
          });
          return;
        }
        sendResponse({
          success: true,
          status: response.status,
          data,
          text,
        });
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
