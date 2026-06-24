// Background Service Worker
// 处理扩展的后台逻辑

import {
  getOpenViewAuth,
  setOpenViewAuth,
  clearOpenViewAuth,
  refreshToken,
  fetchStatsSummary,
} from './src/services/openview-client.js';

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
    handleFetchStatsSummary(sendResponse);
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

async function handleFetchStatsSummary(sendResponse) {
  const auth = await getOpenViewAuth();
  if (!auth?.accessToken || !auth?.refreshToken || !auth?.baseUrl) {
    sendResponse({
      success: false,
      error: 'OpenView 未登录，请先在 EchoMem 配置面板登录',
    });
    return;
  }

  try {
    const data = await fetchStatsSummary({
      baseUrl: auth.baseUrl,
      accessToken: auth.accessToken,
    });
    sendResponse({ success: true, data });
    return;
  } catch (error) {
    if (error.status !== 401) {
      sendResponse({
        success: false,
        error: error.message || '获取统计失败',
      });
      return;
    }
  }

  // Token 过期，尝试刷新
  try {
    const newAuth = await refreshToken({
      baseUrl: auth.baseUrl,
      refreshToken: auth.refreshToken,
    });
    const data = await fetchStatsSummary({
      baseUrl: newAuth.baseUrl,
      accessToken: newAuth.accessToken,
    });
    sendResponse({ success: true, data });
  } catch (error) {
    await clearOpenViewAuth();
    sendResponse({
      success: false,
      error: `OpenView 登录已过期，请重新登录: ${error.message}`,
    });
  }
}

// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    console.log('Page loaded:', tab.url);
  }
});
