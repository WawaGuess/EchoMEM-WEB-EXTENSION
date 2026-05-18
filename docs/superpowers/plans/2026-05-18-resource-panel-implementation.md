# 资源管理面板实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 EchoMem 扩展中的资源管理占位面板替换为完整功能，支持本地文件上传、URL 录入、资源列表浏览、内容预览与插入对话。

**Architecture:** 采用混合架构（方案 3）：Content Script 直连 OpenViking（DirectResourceService）快速落地，ResourceService 抽象接口预留未来 Background Script 代理迁移。资源按平台+年月自动归档目录。

**Tech Stack:** ES6 modules, vanilla JavaScript (no framework), Chrome Extension Manifest V3, OpenViking HTTP API

---

## 文件结构

| 文件 | 类型 | 职责 |
|------|------|------|
| `src/services/openviking-client.js` | 修改 | 抽离 `_buildHeaders()` 公共方法，消除 4 处重复 |
| `src/services/resource-service.js` | 新增 | ResourceService 抽象接口（7 个方法） |
| `src/services/direct-resource-service.js` | 新增 | DirectResourceService：Content Script 直接 fetch 实现 |
| `src/core/content-injector.js` | 新增 | 将文本内容注入当前聊天输入框的轻量工具 |
| `src/panels/resource/index.js` | 重写 | 完整资源面板：渲染、状态管理、事件绑定、API 调用 |
| `src/core/router.js` | 修改 | 在 `navigateToEchoMemPanel` 中增加资源面板特殊处理 |
| `src/panels/index.js` | 修改 | 导出 `bindResourcePanelEvents` 和 `loadResourcePanel` |

---

## Task 1: 抽离 OpenVikingClient headers 公共方法

**Files:**
- Modify: `src/services/openviking-client.js`

**Context:** 当前 `find()`、`createSession()`、`addMessage()`、`commitSession()` 四个方法中各有完全相同的 headers 构造逻辑（约 15 行重复代码）。需要抽离为 `_buildHeaders()` 方法，供 `DirectResourceService` 复用。

- [ ] **Step 1: 添加 `_buildHeaders()` 方法**

```javascript
_buildHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (this.cfg.agentId) {
    headers['X-OpenViking-Agent'] = this.cfg.agentId;
  }
  if (this.cfg.authEnabled) {
    if (this.cfg.apiKey) {
      headers['X-API-Key'] = this.cfg.apiKey;
    }
    if (this.cfg.accountId) {
      headers['X-OpenViking-Account'] = this.cfg.accountId;
    }
    if (this.cfg.userId) {
      headers['X-OpenViking-User'] = this.cfg.userId;
    }
  }
  return headers;
}
```

将上述代码添加到 `OpenVikingClient` 类中，`find()` 方法之前。

- [ ] **Step 2: 替换 4 个方法中的 headers 构造逻辑**

将 `find()` 方法中的：
```javascript
const headers = { 'Content-Type': 'application/json' };
if (this.cfg.agentId) {
  headers['X-OpenViking-Agent'] = this.cfg.agentId;
}
if (this.cfg.authEnabled) {
  if (this.cfg.apiKey) {
    headers['X-API-Key'] = this.cfg.apiKey;
  }
  if (this.cfg.accountId) {
    headers['X-OpenViking-Account'] = this.cfg.accountId;
  }
  if (this.cfg.userId) {
    headers['X-OpenViking-User'] = this.cfg.userId;
  }
}
```
替换为：
```javascript
const headers = this._buildHeaders();
```

对 `createSession()`、`addMessage()`、`commitSession()` 做同样的替换（共 4 处）。

- [ ] **Step 3: 验证构建不报错**

Run: `npm run build`
Expected: 构建成功，无错误

- [ ] **Step 4: Commit**

```bash
git add src/services/openviking-client.js
git commit -m "refactor: 抽离 OpenVikingClient headers 构造为 _buildHeaders() 方法"
```

---

## Task 2: 创建 ResourceService 抽象接口

**Files:**
- Create: `src/services/resource-service.js`

- [ ] **Step 1: 创建抽象接口文件**

```javascript
/**
 * ResourceService 抽象接口
 *
 * 未来可通过替换实现迁移到 Background Script 代理模式：
 *   - DirectResourceService: Content Script 直接 fetch（默认）
 *   - BackgroundResourceService: 通过 chrome.runtime.sendMessage 转发
 */
export class ResourceService {
  /**
   * 上传本地文件到 OpenViking
   * @param {File} file - 浏览器 File 对象
   * @param {string} parent - 目标目录 URI
   * @param {Object} config - OpenViking 连接配置
   * @returns {Promise<{uri: string, status: string}>}
   */
  async uploadFile(file, parent, config) {
    throw new Error('Not implemented');
  }

  /**
   * 通过 URL 添加资源
   * @param {string} url - 远程资源 URL
   * @param {string} parent - 目标目录 URI
   * @param {Object} config
   * @returns {Promise<{uri: string, status: string}>}
   */
  async addResourceByUrl(url, parent, config) {
    throw new Error('Not implemented');
  }

  /**
   * 列出目录内容
   * @param {string} uri - 目录 URI
   * @param {Object} config
   * @returns {Promise<Array<{uri, name, type, size, createdAt}>>}
   */
  async listDirectory(uri, config) {
    throw new Error('Not implemented');
  }

  /**
   * 获取资源元数据
   * @param {string} uri
   * @param {Object} config
   */
  async statResource(uri, config) {
    throw new Error('Not implemented');
  }

  /**
   * 获取资源 L1 概览（摘要）
   * @param {string} uri
   * @param {Object} config
   */
  async getOverview(uri, config) {
    throw new Error('Not implemented');
  }

  /**
   * 获取资源完整文本内容（L2）
   * @param {string} uri
   * @param {Object} config
   */
  async getContent(uri, config) {
    throw new Error('Not implemented');
  }

  /**
   * 删除资源
   * @param {string} uri
   * @param {Object} config
   */
  async deleteResource(uri, config) {
    throw new Error('Not implemented');
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/resource-service.js
git commit -m "feat: 添加 ResourceService 抽象接口"
```

---

## Task 3: 创建 DirectResourceService 默认实现

**Files:**
- Create: `src/services/direct-resource-service.js`

- [ ] **Step 1: 实现 DirectResourceService**

```javascript
import { ResourceService } from './resource-service.js';

export class DirectResourceService extends ResourceService {
  _buildHeaders(config, isMultipart = false) {
    const headers = {};
    if (!isMultipart) {
      headers['Content-Type'] = 'application/json';
    }
    if (config.agentId) {
      headers['X-OpenViking-Agent'] = config.agentId;
    }
    if (config.authEnabled) {
      if (config.apiKey) {
        headers['X-API-Key'] = config.apiKey;
      }
      if (config.accountId) {
        headers['X-OpenViking-Account'] = config.accountId;
      }
      if (config.userId) {
        headers['X-OpenViking-User'] = config.userId;
      }
    }
    return headers;
  }

  async uploadFile(file, parent, config) {
    // Step 1: temp_upload
    const formData = new FormData();
    formData.append('file', file);

    const uploadRes = await fetch(`${config.baseUrl}/api/v1/resources/temp_upload`, {
      method: 'POST',
      headers: { 'X-OpenViking-Agent': config.agentId || '' },
      body: formData,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({}));
      throw new Error(err.error?.message || `temp_upload failed: ${uploadRes.status}`);
    }

    const uploadData = await uploadRes.json();
    const tempFileId = uploadData.result?.temp_file_id;
    if (!tempFileId) {
      throw new Error('temp_upload did not return temp_file_id');
    }

    // Step 2: add_resource
    return this._addResource({ temp_file_id: tempFileId, parent, source_name: file.name }, config);
  }

  async addResourceByUrl(url, parent, config) {
    return this._addResource({ path: url, parent }, config);
  }

  async _addResource(body, config) {
    const response = await fetch(`${config.baseUrl}/api/v1/resources`, {
      method: 'POST',
      headers: this._buildHeaders(config),
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.status === 'error') {
      throw new Error(data.error?.message || `add_resource failed: ${response.status}`);
    }

    return data.result || data;
  }

  async listDirectory(uri, config) {
    const response = await fetch(
      `${config.baseUrl}/api/v1/fs/ls?uri=${encodeURIComponent(uri)}`,
      {
        method: 'GET',
        headers: this._buildHeaders(config),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.status === 'error') {
      throw new Error(data.error?.message || `fs/ls failed: ${response.status}`);
    }

    return data.result || [];
  }

  async statResource(uri, config) {
    const response = await fetch(
      `${config.baseUrl}/api/v1/fs/stat?uri=${encodeURIComponent(uri)}`,
      {
        method: 'GET',
        headers: this._buildHeaders(config),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.status === 'error') {
      throw new Error(data.error?.message || `fs/stat failed: ${response.status}`);
    }

    return data.result || null;
  }

  async getOverview(uri, config) {
    const response = await fetch(
      `${config.baseUrl}/api/v1/content/overview?uri=${encodeURIComponent(uri)}`,
      {
        method: 'GET',
        headers: this._buildHeaders(config),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.status === 'error') {
      throw new Error(data.error?.message || `content/overview failed: ${response.status}`);
    }

    return data.result || null;
  }

  async getContent(uri, config) {
    const response = await fetch(
      `${config.baseUrl}/api/v1/content/read?uri=${encodeURIComponent(uri)}`,
      {
        method: 'GET',
        headers: this._buildHeaders(config),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.status === 'error') {
      throw new Error(data.error?.message || `content/read failed: ${response.status}`);
    }

    return data.result || null;
  }

  async deleteResource(uri, config) {
    const response = await fetch(
      `${config.baseUrl}/api/v1/fs?uri=${encodeURIComponent(uri)}`,
      {
        method: 'DELETE',
        headers: this._buildHeaders(config),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.status === 'error') {
      throw new Error(data.error?.message || `fs/rm failed: ${response.status}`);
    }

    return data.result || { uri };
  }
}
```

- [ ] **Step 2: 验证构建不报错**

Run: `npm run build`
Expected: 构建成功，无错误

- [ ] **Step 3: Commit**

```bash
git add src/services/direct-resource-service.js
git commit -m "feat: 添加 DirectResourceService 默认实现"
```

---

## Task 4: 创建内容注入工具

**Files:**
- Create: `src/core/content-injector.js`

- [ ] **Step 1: 实现内容注入器**

```javascript
// 将文本内容注入当前聊天输入框的轻量工具

import { PLATFORM_CONFIGS } from '../config/loader.js';
import { getCurrentPlatform } from './detection.js';

/**
 * 将格式化后的资源内容注入当前聊天输入框
 * @param {string} text - 要注入的文本
 * @param {Object} options
 * @param {string} options.sourceName - 资源来源名称（用于格式化标签）
 */
export function injectToChatInput(text, options = {}) {
  const platform = getCurrentPlatform();
  if (!platform) {
    console.warn('EchoMem: no platform detected, cannot inject');
    return false;
  }

  const config = PLATFORM_CONFIGS[platform.id];
  if (!config || !config.inputSelector) {
    console.warn('EchoMem: no input selector for platform', platform.id);
    return false;
  }

  const inputEl = document.querySelector(config.inputSelector);
  if (!inputEl) {
    console.warn('EchoMem: input element not found');
    return false;
  }

  const formatted = formatForInjection(text, options.sourceName);

  // 处理不同输入框类型
  if (inputEl.tagName === 'TEXTAREA' || inputEl.tagName === 'INPUT') {
    const start = inputEl.selectionStart || 0;
    const end = inputEl.selectionEnd || 0;
    const current = inputEl.value || '';
    inputEl.value = current.slice(0, start) + formatted + current.slice(end);
    inputEl.selectionStart = inputEl.selectionEnd = start + formatted.length;
  } else if (inputEl.isContentEditable) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(formatted);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      inputEl.textContent = (inputEl.textContent || '') + formatted;
    }
  }

  // 触发 input 事件让页面感知变化
  inputEl.dispatchEvent(new Event('input', { bubbles: true }));

  return true;
}

function formatForInjection(text, sourceName) {
  const trimmed = text.trim();
  const source = sourceName ? `\n来源: ${sourceName}` : '';
  return `\n<relevant-memories>${source}\n---\n${trimmed}\n</relevant-memories>\n`;
}
```

- [ ] **Step 2: 验证构建不报错**

Run: `npm run build`
Expected: 构建成功，无错误

- [ ] **Step 3: Commit**

```bash
git add src/core/content-injector.js
git commit -m "feat: 添加内容注入工具 content-injector.js"
```

---

## Task 5: 重写资源面板

**Files:**
- Rewrite: `src/panels/resource/index.js`

- [ ] **Step 1: 编写完整面板代码**

```javascript
// 资源管理面板 — 完整实现

import { DirectResourceService } from '../../services/direct-resource-service.js';
import { getOpenVikingConfig } from '../../services/config.js';
import { getCurrentPlatform } from '../../core/detection.js';
import { injectToChatInput } from '../../core/content-injector.js';
import { getPanelBodyElement } from '../../core/panel-host.js';

// === 面板内部状态 ===
const panelState = {
  resources: [],
  expandedUri: null,
  isLoading: false,
  errorMessage: null,
  uploadQueue: [],
  currentPath: '',
  service: null,
  config: null,
};

// === 路径计算 ===
function computeAutoPath(platformId) {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return `viking://resources/${platformId}/${yearMonth}`;
}

// === Service 初始化 ===
async function ensureService() {
  if (!panelState.service) {
    panelState.config = await getOpenVikingConfig();
    panelState.service = new DirectResourceService();
  }
  return panelState.service;
}

// === 列表加载 ===
async function loadResources() {
  const platform = getCurrentPlatform();
  if (!platform) {
    panelState.errorMessage = '未检测到当前平台';
    render();
    return;
  }

  panelState.currentPath = computeAutoPath(platform.id);
  panelState.isLoading = true;
  panelState.errorMessage = null;
  render();

  try {
    const service = await ensureService();
    let items = await service.listDirectory(panelState.currentPath, panelState.config);

    // 并行获取每个资源的 stat
    if (Array.isArray(items) && items.length > 0) {
      const statPromises = items.map(async (item) => {
        try {
          const stat = await service.statResource(item.uri, panelState.config);
          return { ...item, stat };
        } catch {
          return { ...item, stat: null };
        }
      });
      items = await Promise.all(statPromises);
    }

    panelState.resources = Array.isArray(items) ? items : [];
  } catch (err) {
    panelState.errorMessage = err.message || '加载资源列表失败';
    panelState.resources = [];
  } finally {
    panelState.isLoading = false;
    render();
  }
}

// === 状态推断 ===
function inferStatus(item) {
  if (!item.stat) return { label: '❌ 提取失败', color: '#e53935' };
  const hasAbstract = item.stat.abstract && item.stat.abstract.length > 0;
  if (hasAbstract) return { label: '✅ 已索引', color: '#43a047' };
  return { label: '⏳ 处理中', color: '#fb8c00' };
}

function isUrlResource(item) {
  return item.name?.startsWith('http://') || item.name?.startsWith('https://');
}

function formatSize(bytes) {
  if (!bytes || bytes === 0) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// === 渲染 ===
function render() {
  const body = getPanelBodyElement();
  if (!body) return;
  body.innerHTML = getResourceContent();
  bindResourcePanelEvents();
}

export function getResourceContent() {
  const { currentPath, resources, isLoading, errorMessage } = panelState;

  const errorHtml = errorMessage
    ? `<div style="padding: 12px; background: #ffebee; border-radius: 6px; color: #c62828; font-size: 13px; margin-bottom: 12px;">${errorMessage}</div>`
    : '';

  const uploadAreaHtml = `
    <div id="echomem-resource-upload-area" style="
      border: 2px dashed #ccc;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      color: #999;
      margin-bottom: 12px;
      cursor: pointer;
      transition: border-color 0.2s, background 0.2s;
    " ondragover="return false;" ondragleave="return false;" ondrop="return false;">
      <p style="margin: 0 0 8px; font-size: 14px;">📤 拖拽文件到此处</p>
      <p style="margin: 0 0 8px; font-size: 13px;">或粘贴 URL 链接</p>
      <input type="file" id="echomem-resource-file-input" style="display: none;" />
      <button id="echomem-resource-select-file" style="
        padding: 6px 16px;
        background: #667eea;
        color: #fff;
        border: none;
        border-radius: 4px;
        font-size: 13px;
        cursor: pointer;
      ">选择文件</button>
    </div>
  `;

  const breadcrumbHtml = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
      <div style="font-size: 12px; color: #888; word-break: break-all;">
        📍 ${currentPath || '...'}
      </div>
      <button id="echomem-resource-refresh" style="
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        color: #666;
        font-size: 14px;
      " title="刷新">🔄</button>
    </div>
  `;

  let listHtml = '';
  if (isLoading) {
    listHtml = `<div style="text-align: center; padding: 24px; color: #999; font-size: 13px;">加载中...</div>`;
  } else if (resources.length === 0) {
    listHtml = `<div style="padding: 24px; text-align: center; color: #999; font-size: 13px; background: #f5f5f5; border-radius: 6px;">暂无资源</div>`;
  } else {
    listHtml = resources.map((item) => renderResourceItem(item)).join('');
  }

  return `
    <div style="color: #666;">
      ${errorHtml}
      ${uploadAreaHtml}
      ${breadcrumbHtml}
      <div id="echomem-resource-list" style="display: flex; flex-direction: column; gap: 8px;">
        ${listHtml}
      </div>
    </div>
  `;
}

function renderResourceItem(item) {
  const status = inferStatus(item);
  const isUrl = isUrlResource(item);
  const icon = isUrl ? '🌐' : '📄';
  const name = item.name || item.uri.split('/').pop();
  const size = formatSize(item.stat?.size || item.size);
  const time = formatTime(item.stat?.created_at || item.created_at);
  const meta = [size, time].filter(Boolean).join(' · ');
  const isExpanded = panelState.expandedUri === item.uri;

  let expandedHtml = '';
  if (isExpanded) {
    const overview = item._overview || '';
    expandedHtml = `
      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee;">
        <div style="font-size: 12px; color: #888; margin-bottom: 6px;">📋 内容摘要:</div>
        <div style="font-size: 12px; color: #555; line-height: 1.6; max-height: 120px; overflow-y: auto; padding: 8px; background: #f8f9fa; border-radius: 4px; margin-bottom: 8px;">
          ${overview || '摘要生成中，请稍后刷新...'}
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="echomem-resource-insert" data-uri="${item.uri}" data-name="${name}" style="
            padding: 6px 12px;
            background: #667eea;
            color: #fff;
            border: none;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
          ">插入到对话</button>
          <button class="echomem-resource-view" data-uri="${item.uri}" style="
            padding: 6px 12px;
            background: #f0f0f0;
            color: #333;
            border: none;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
          ">查看完整内容</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="echomem-resource-item" data-uri="${item.uri}" style="
      padding: 10px 12px;
      background: #fafafa;
      border-radius: 6px;
      border: 1px solid #eee;
      cursor: pointer;
      transition: background 0.2s;
    ">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 13px; color: #333; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${icon} ${name}
          </div>
          <div style="font-size: 11px; color: #999; margin-top: 2px;">${meta}</div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; margin-left: 8px;">
          <span style="font-size: 11px; color: ${status.color};">${status.label}</span>
          <button class="echomem-resource-delete" data-uri="${item.uri}" data-name="${name}" style="
            background: none;
            border: none;
            cursor: pointer;
            padding: 2px;
            color: #999;
            font-size: 14px;
          " title="删除">✕</button>
        </div>
      </div>
      ${expandedHtml}
    </div>
  `;
}

// === 事件绑定 ===
export function bindResourcePanelEvents() {
  const uploadArea = document.getElementById('echomem-resource-upload-area');
  const fileInput = document.getElementById('echomem-resource-file-input');
  const selectBtn = document.getElementById('echomem-resource-select-file');
  const refreshBtn = document.getElementById('echomem-resource-refresh');
  const listContainer = document.getElementById('echomem-resource-list');

  // 选择文件按钮
  if (selectBtn && !selectBtn.dataset.bound) {
    selectBtn.dataset.bound = 'true';
    selectBtn.addEventListener('click', () => {
      fileInput?.click();
    });
  }

  // 文件选择
  if (fileInput && !fileInput.dataset.bound) {
    fileInput.dataset.bound = 'true';
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleUpload(file, file.name);
      fileInput.value = '';
    });
  }

  // 拖拽上传
  if (uploadArea && !uploadArea.dataset.bound) {
    uploadArea.dataset.bound = 'true';
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = '#667eea';
      uploadArea.style.background = '#f0f4ff';
    });
    uploadArea.addEventListener('dragleave', () => {
      uploadArea.style.borderColor = '#ccc';
      uploadArea.style.background = 'transparent';
    });
    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = '#ccc';
      uploadArea.style.background = 'transparent';
      const file = e.dataTransfer.files[0];
      if (file) handleUpload(file, file.name);
    });
  }

  // URL 粘贴
  if (uploadArea && !uploadArea.dataset.pasteBound) {
    uploadArea.dataset.pasteBound = 'true';
    document.addEventListener('paste', (e) => {
      const panel = document.querySelector('.claw-custom-panel');
      if (!panel || !panel.contains(document.activeElement)) return;

      const text = (e.clipboardData || window.clipboardData).getData('text');
      if (text && /^https?:\/\//.test(text.trim())) {
        e.preventDefault();
        handleUrlUpload(text.trim());
      }
    });
  }

  // 刷新按钮
  if (refreshBtn && !refreshBtn.dataset.bound) {
    refreshBtn.dataset.bound = 'true';
    refreshBtn.addEventListener('click', () => {
      loadResources();
    });
  }

  // 列表事件委托
  if (listContainer && !listContainer.dataset.bound) {
    listContainer.dataset.bound = 'true';
    listContainer.addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('.echomem-resource-delete');
      if (deleteBtn) {
        e.stopPropagation();
        const uri = deleteBtn.dataset.uri;
        const name = deleteBtn.dataset.name;
        if (confirm(`确定删除 "${name}" 吗？`)) {
          handleDelete(uri);
        }
        return;
      }

      const insertBtn = e.target.closest('.echomem-resource-insert');
      if (insertBtn) {
        e.stopPropagation();
        handleInsert(insertBtn.dataset.uri, insertBtn.dataset.name);
        return;
      }

      const viewBtn = e.target.closest('.echomem-resource-view');
      if (viewBtn) {
        e.stopPropagation();
        handleView(viewBtn.dataset.uri);
        return;
      }

      const item = e.target.closest('.echomem-resource-item');
      if (item) {
        const uri = item.dataset.uri;
        toggleExpand(uri);
      }
    });
  }
}

// === 操作处理 ===
async function handleUpload(file, name) {
  const action = confirm(`上传 "${name}"\n\n点击「确定」保存并插入对话\n点击「取消」仅保存到知识库`);

  try {
    const service = await ensureService();
    const platform = getCurrentPlatform();
    const parent = computeAutoPath(platform.id);

    const result = await service.uploadFile(file, parent, panelState.config);

    if (action) {
      // 保存并插入对话
      const content = await service.getContent(result.uri, panelState.config);
      const text = typeof content === 'string' ? content : JSON.stringify(content);
      injectToChatInput(text, { sourceName: name });
    }

    // 刷新列表
    await loadResources();
  } catch (err) {
    panelState.errorMessage = `上传失败: ${err.message}`;
    render();
  }
}

async function handleUrlUpload(url) {
  const action = confirm(`添加 URL 资源\n${url}\n\n点击「确定」保存并插入对话\n点击「取消」仅保存到知识库`);

  try {
    const service = await ensureService();
    const platform = getCurrentPlatform();
    const parent = computeAutoPath(platform.id);

    const result = await service.addResourceByUrl(url, parent, panelState.config);

    if (action) {
      const content = await service.getContent(result.uri, panelState.config);
      const text = typeof content === 'string' ? content : JSON.stringify(content);
      injectToChatInput(text, { sourceName: url });
    }

    await loadResources();
  } catch (err) {
    panelState.errorMessage = `URL 添加失败: ${err.message}`;
    render();
  }
}

async function handleDelete(uri) {
  try {
    const service = await ensureService();
    await service.deleteResource(uri, panelState.config);
    await loadResources();
  } catch (err) {
    panelState.errorMessage = `删除失败: ${err.message}`;
    render();
  }
}

async function handleInsert(uri, name) {
  try {
    const service = await ensureService();
    const content = await service.getContent(uri, panelState.config);
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    injectToChatInput(text, { sourceName: name });
  } catch (err) {
    panelState.errorMessage = `读取内容失败: ${err.message}`;
    render();
  }
}

async function handleView(uri) {
  try {
    const service = await ensureService();
    const content = await service.getContent(uri, panelState.config);
    const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2);

    // 在弹层中显示完整内容（复用 openCenterOverlay）
    const { openCenterOverlay, closeOverlayPanel } = await import('../../core/panel-host.js');
    openCenterOverlay('资源内容', `
      <div style="padding: 16px; font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; max-height: 60vh; overflow-y: auto;">
        ${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
      </div>
    `, {
      showBack: true,
      onBack: closeOverlayPanel,
    });
  } catch (err) {
    panelState.errorMessage = `查看内容失败: ${err.message}`;
    render();
  }
}

async function toggleExpand(uri) {
  if (panelState.expandedUri === uri) {
    panelState.expandedUri = null;
  } else {
    panelState.expandedUri = uri;
    // 预加载 overview
    const item = panelState.resources.find((r) => r.uri === uri);
    if (item && !item._overview) {
      try {
        const service = await ensureService();
        const overview = await service.getOverview(uri, panelState.config);
        item._overview = typeof overview === 'string' ? overview : JSON.stringify(overview);
      } catch {
        item._overview = '摘要暂不可用';
      }
    }
  }
  render();
}

// === 外部调用入口 ===
export async function loadResourcePanel() {
  panelState.resources = [];
  panelState.expandedUri = null;
  panelState.errorMessage = null;
  await loadResources();
}
```

- [ ] **Step 2: 验证构建不报错**

Run: `npm run build`
Expected: 构建成功，无错误

- [ ] **Step 3: Commit**

```bash
git add src/panels/resource/index.js
git commit -m "feat: 实现完整的资源管理面板（上传、列表、预览、删除、插入对话）"
```

---

## Task 6: 扩展 router.js 支持资源面板

**Files:**
- Modify: `src/core/router.js`

- [ ] **Step 1: 添加资源面板导入和事件绑定**

在 `router.js` 顶部，在 `import { ... } from '../panels/association/index.js';` 下方添加：

```javascript
import {
  bindResourcePanelEvents,
  loadResourcePanel,
} from '../panels/resource/index.js';
```

在 `navigateToEchoMemPanel` 函数中，在 `if (panel.id === 'association')` 块之后添加：

```javascript
  // 如果是资源管理面板，加载资源列表并绑定事件
  if (panel.id === 'resources') {
    await loadResourcePanel();
    bindResourcePanelEvents();
  }
```

- [ ] **Step 2: 验证构建不报错**

Run: `npm run build`
Expected: 构建成功，无错误

- [ ] **Step 3: Commit**

```bash
git add src/core/router.js
git commit -m "feat: router 支持资源面板加载和事件绑定"
```

---

## Task 7: 导出资源面板事件绑定函数

**Files:**
- Modify: `src/panels/index.js`

- [ ] **Step 1: 添加资源面板导出**

在 `src/panels/index.js` 中，在 `import { getResourceContent } from './resource/index.js';` 下方添加：

```javascript
import {
  bindResourcePanelEvents,
  loadResourcePanel,
} from './resource/index.js';
```

在 `export {` 块中，在 `getResourceContent,` 下方添加：

```javascript
  bindResourcePanelEvents,
  loadResourcePanel,
```

- [ ] **Step 2: 验证构建不报错**

Run: `npm run build`
Expected: 构建成功，无错误

- [ ] **Step 3: Commit**

```bash
git add src/panels/index.js
git commit -m "feat: 导出资源面板事件绑定函数"
```

---

## Task 8: 最终构建与验证

- [ ] **Step 1: 完整构建**

Run: `npm run build`
Expected: 构建成功，`dist/content.js` 更新，无错误

- [ ] **Step 2: 检查 dist/content.js 是否包含新代码**

Run: `grep -n "DirectResourceService\|ResourceService\|content-injector\|echomem-resource" dist/content.js | head -20`
Expected: 输出显示相关符号存在于 bundle 中

- [ ] **Step 3: 最终 Commit**

```bash
git add dist/content.js
git commit -m "build: 重新打包资源管理面板功能"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] 本地文件上传（temp_upload → add_resource）→ Task 3 + Task 5
- [x] URL 资源录入（add_resource with path）→ Task 3 + Task 5
- [x] 资源列表浏览（fs/ls + fs/stat）→ Task 3 + Task 5
- [x] 内容预览（content/overview）→ Task 3 + Task 5
- [x] 插入对话（content/read + injectToChatInput）→ Task 4 + Task 5
- [x] 资源删除（fs/rm）→ Task 3 + Task 5
- [x] 平台+年月自动目录 → Task 5 computeAutoPath
- [x] 状态指示（已索引/处理中/失败）→ Task 5 inferStatus
- [x] 确认对话框（仅保存/保存并插入）→ Task 5 handleUpload/handleUrlUpload
- [x] ResourceService 抽象接口 → Task 2
- [x] DirectResourceService 默认实现 → Task 3
- [x] OpenVikingClient headers 复用 → Task 1

**Placeholder scan:**
- [x] 无 "TBD", "TODO", "implement later"
- [x] 所有方法都有完整实现代码
- [x] 所有文件路径都是精确的相对路径

**Type consistency:**
- [x] `uploadFile(file, parent, config)` 签名在接口和实现中一致
- [x] `addResourceByUrl(url, parent, config)` 签名一致
- [x] `_buildHeaders(config, isMultipart)` 在 DirectResourceService 中定义和使用一致
- [x] `computeAutoPath(platformId)` 接收字符串，返回字符串

**No gaps found.**
