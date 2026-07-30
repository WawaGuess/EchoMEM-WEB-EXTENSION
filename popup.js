// Popup 脚本 - 配置 EchoMem Auth Key / Base URL
// 核心功能通过 content.js 注入到 HIGO Office 页面中

const AUTH_STORAGE_KEY = 'echomemConfig';

document.addEventListener('DOMContentLoaded', async () => {
  const authInput = document.getElementById('authKey');
  const baseUrlInput = document.getElementById('baseUrl');
  const saveBtn = document.getElementById('saveConfig');
  const statusEl = document.getElementById('configStatus');

  // 加载已有配置
  try {
    const result = await chrome.storage.local.get(AUTH_STORAGE_KEY);
    const cfg = result[AUTH_STORAGE_KEY] || {};
    if (cfg.authKey) authInput.value = cfg.authKey;
    if (cfg.baseUrl) baseUrlInput.value = cfg.baseUrl;
  } catch (err) {
    console.error('加载配置失败', err);
  }

  saveBtn.addEventListener('click', async () => {
    const authKey = authInput.value.trim();
    const baseUrl = baseUrlInput.value.trim() || 'http://127.0.0.1:8010';

    if (!authKey) {
      statusEl.textContent = '请输入 Auth Key';
      statusEl.className = 'error';
      return;
    }

    try {
      const result = await chrome.storage.local.get(AUTH_STORAGE_KEY);
      const existingConfig = result[AUTH_STORAGE_KEY] || {};
      await chrome.storage.local.set({
        [AUTH_STORAGE_KEY]: { ...existingConfig, authKey, baseUrl }
      });
      statusEl.textContent = '配置已保存';
      statusEl.className = 'success';
      setTimeout(() => { statusEl.textContent = ''; statusEl.className = ''; }, 2000);
    } catch (err) {
      statusEl.textContent = `保存失败: ${err.message}`;
      statusEl.className = 'error';
    }
  });
});

console.log('EchoMem Extension: Popup loaded');
