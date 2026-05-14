// 联想建议浮层 — 多选 + 全选 + 确定/取消 + 可折叠
// 交互流程：
//   1. 用户输入触发记忆召回，浮层以多选列表形式呈现
//   2. 用户可勾选若干条（或使用全选），点击「确定」后按统一格式追加到输入框
//   3. 「取消」直接关闭浮层不写回；点击折叠按钮可最小化/恢复列表
//   4. 每次重渲染（新一轮搜索结果）清空已勾选状态

import { escapeHtml } from '../../utils/text-processor.js';

// 记忆段标签
const MEM_TAG_OPEN = '<relevant-memories>';
const MEM_TAG_CLOSE = '</relevant-memories>';

let selectedIndex = -1;            // 键盘高亮索引（仅视觉聚焦）
let currentSuggestions = [];       // 当前浮层数据
let checkedKeys = new Set();       // 已勾选条目 key
let currentInputElement = null;    // 当前绑定的输入元素
let keyboardBound = false;
let collapsed = false;             // 折叠状态（保持跨重渲染）
let suppressBlurClose = false;     // 浮层内点击时抑制 blur 关闭
let committedItems = new Map();    // 已提交到 textarea 的记忆 key -> body

/**
 * 为 completion 派生稳定 key
 */
function getItemKey(c, i) {
  return c.sourceUri || c.insertText || `idx-${i}`;
}

/**
 * 渲染补全建议浮层（多选模式）
 * @param {HTMLTextAreaElement} inputElement
 * @param {Array} completions
 */
export function renderCompletions(inputElement, completions) {
  currentSuggestions = completions;
  currentInputElement = inputElement;
  selectedIndex = completions.length > 0 ? 0 : -1;

  // 每次重渲染清空勾选
  checkedKeys = new Set();

  const container = getOrCreateContainer();

  if (!completions.length) {
    hideSuggestions();
    return;
  }

  container.innerHTML = buildContainerHtml(completions);
  container.style.display = 'block';
  positionContainer(container, inputElement);

  bindContainerEvents(container, inputElement);
  bindOutsideClick(container);
}

/**
 * 绑定点击浮层外部关闭的事件（只绑定一次）
 */
function bindOutsideClick(container) {
  // 先移除旧的监听器，避免重复
  if (container._outsideClickHandler) {
    document.removeEventListener('mousedown', container._outsideClickHandler);
    container._outsideClickHandler = null;
  }

  const handler = (e) => {
    if (!container.contains(e.target)) {
      hideSuggestions();
      document.removeEventListener('mousedown', handler);
      container._outsideClickHandler = null;
    }
  };

  // 延迟绑定，避免当前点击事件立即触发关闭
  setTimeout(() => {
    document.addEventListener('mousedown', handler);
    container._outsideClickHandler = handler;
  }, 0);
}

/**
 * 构造浮层完整 HTML
 */
function buildContainerHtml(completions) {
  const headerHtml = `
    <div class="echomem-suggestion-header">
      <label class="echomem-suggestion-select-all">
        <input type="checkbox" class="echomem-suggestion-check-all" />
        <span>全选</span>
      </label>
      <span class="echomem-suggestion-title">相关记忆 (${completions.length})</span>
      <button type="button" class="echomem-suggestion-toggle" title="${collapsed ? '展开' : '折叠'}">
        ${collapsed ? '▸' : '▾'}
      </button>
    </div>
  `;

  const itemsHtml = completions.map((c, i) => {
    const isActive = i === selectedIndex;
    const key = getItemKey(c, i);
    const sourceBadge = c.source === 'memory'
      ? '<span class="echomem-source-badge memory">记忆</span>'
      : '<span class="echomem-source-badge session">会话</span>';

    return `
      <div class="echomem-suggestion-item ${isActive ? 'echomem-suggestion-active' : ''}"
           data-index="${i}"
           data-key="${escapeHtml(key)}">
        <input type="checkbox" class="echomem-suggestion-check" tabindex="-1" />
        <span class="suggestion-text">${escapeHtml(c.displayText || '')}</span>
        <div class="suggestion-meta">
          ${sourceBadge}
          <span class="suggestion-score">${(c.score || 0).toFixed(2)}</span>
        </div>
      </div>
    `;
  }).join('');

  const bodyHtml = `
    <div class="echomem-suggestion-list" style="${collapsed ? 'display:none;' : ''}">
      ${itemsHtml}
    </div>
  `;

  const actionsHtml = `
    <div class="echomem-suggestion-actions" style="${collapsed ? 'display:none;' : ''}">
      <button type="button" class="echomem-btn-cancel">取消</button>
      <button type="button" class="echomem-btn-confirm" disabled>确定 (0)</button>
    </div>
  `;

  return headerHtml + bodyHtml + actionsHtml;
}

/**
 * 绑定浮层内交互事件
 */
function bindContainerEvents(container, inputElement) {
  // mousedown：仅设置抑制 blur 关闭的标志；不再统一 preventDefault，
  // 以避免阻止原生 checkbox/按钮的默认行为。对于非交互元素的失焦抑制，
  // 由具体行/按钮各自的 mousedown 处理。
  container.addEventListener('mousedown', (e) => {
    suppressBlurClose = true;
    setTimeout(() => { suppressBlurClose = false; }, 50);
    // 仅对非交互元素阻止默认行为，避免 textarea 失焦闪烁
    const target = e.target;
    const isInteractive =
      target.tagName === 'INPUT' ||
      target.tagName === 'BUTTON' ||
      target.closest('label');
    if (!isInteractive) {
      e.preventDefault();
    }
  });

  // 行点击 = 切换勾选（在行容器上用 click，避免和内部 checkbox 默认行为冲突）
  container.querySelectorAll('.echomem-suggestion-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const key = item.dataset.key;
      const checkbox = item.querySelector('.echomem-suggestion-check');
      // 若点击的是 checkbox 本身，使用浏览器切换后的真值；否则我们手动切换
      if (e.target === checkbox) {
        if (checkbox.checked) {
          checkedKeys.add(key);
        } else {
          checkedKeys.delete(key);
        }
      } else {
        toggleKey(key);
      }
      syncUi(container);
    });

    item.addEventListener('mouseenter', () => {
      selectedIndex = Number(item.dataset.index);
      updateHighlight(container);
    });
  });

  // 全选：用 click + 真值源 e.target.checked，避免与 mousedown 时序冲突
  const checkAll = container.querySelector('.echomem-suggestion-check-all');
  checkAll.addEventListener('click', (e) => {
    e.stopPropagation();
    const allKeys = currentSuggestions.map((c, i) => getItemKey(c, i));
    if (e.target.checked) {
      checkedKeys = new Set(allKeys);
    } else {
      checkedKeys = new Set();
    }
    syncUi(container);
  });

  // 折叠
  const toggleBtn = container.querySelector('.echomem-suggestion-toggle');
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    collapsed = !collapsed;
    const list = container.querySelector('.echomem-suggestion-list');
    const actions = container.querySelector('.echomem-suggestion-actions');
    if (list) list.style.display = collapsed ? 'none' : '';
    if (actions) actions.style.display = collapsed ? 'none' : '';
    toggleBtn.textContent = collapsed ? '▸' : '▾';
    toggleBtn.title = collapsed ? '展开' : '折叠';
    positionContainer(container, inputElement);
  });

  // 取消
  container.querySelector('.echomem-btn-cancel').addEventListener('click', (e) => {
    e.stopPropagation();
    hideSuggestions();
  });

  // 确定
  container.querySelector('.echomem-btn-confirm').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!checkedKeys.size) return;
    const selected = [];
    currentSuggestions.forEach((c, i) => {
      const key = getItemKey(c, i);
      if (checkedKeys.has(key)) {
        selected.push({ key, item: c });
      }
    });
    if (!selected.length) return;
    composeAndInsert(currentInputElement, currentInputElement.value || '', selected);
    hideSuggestions();
  });
}

/**
 * 切换某个 key 的勾选状态
 */
function toggleKey(key) {
  if (checkedKeys.has(key)) {
    checkedKeys.delete(key);
  } else {
    checkedKeys.add(key);
  }
}

/**
 * 同步浮层 UI（行 checkbox、全选 checkbox、确定按钮）
 */
function syncUi(container) {
  // 行
  container.querySelectorAll('.echomem-suggestion-item').forEach(item => {
    const key = item.dataset.key;
    const checkbox = item.querySelector('.echomem-suggestion-check');
    const checked = checkedKeys.has(key);
    if (checkbox) checkbox.checked = checked;
    item.classList.toggle('echomem-suggestion-checked', checked);
  });

  // 全选
  const allKeys = currentSuggestions.map((c, i) => getItemKey(c, i));
  const allChecked = allKeys.length > 0 && allKeys.every(k => checkedKeys.has(k));
  const someChecked = allKeys.some(k => checkedKeys.has(k));
  const checkAll = container.querySelector('.echomem-suggestion-check-all');
  if (checkAll) {
    checkAll.checked = allChecked;
    checkAll.indeterminate = !allChecked && someChecked;
  }

  // 确定按钮
  const confirmBtn = container.querySelector('.echomem-btn-confirm');
  if (confirmBtn) {
    const n = checkedKeys.size;
    confirmBtn.textContent = `确定 (${n})`;
    confirmBtn.disabled = n === 0;
  }

  updateHighlight(container);
}

/**
 * 更新键盘高亮
 */
function updateHighlight(container) {
  const items = container.querySelectorAll('.echomem-suggestion-item');
  items.forEach((item, i) => {
    if (i === selectedIndex) {
      item.classList.add('echomem-suggestion-active');
    } else {
      item.classList.remove('echomem-suggestion-active');
    }
  });
}

/**
 * 将单条 completion 格式化为展示文本（确保单行，清理内部换行/空白）
 * 只使用 insertText（原始记忆内容），不拼接 displayText，避免重复和预览前缀污染。
 */
function formatItem(it) {
  return (it.insertText || '').trim().replace(/\s+/g, ' ');
}

/**
 * 从 userText 中剥离记忆段，返回用户原文。
 * 正则匹配并删除所有 <relevant-memories>...</relevant-memories> 标签块。
 * 如果检测到多个标签块，清空 committedItems 一并清除。
 */
function stripMemoryBlock(userText) {
  const text = userText || '';
  const regex = new RegExp(`\\s*${MEM_TAG_OPEN}[\\s\\S]*?${MEM_TAG_CLOSE}\\s*`, 'g');
  const hasMatch = regex.test(text);

  if (!hasMatch) {
    committedItems.clear();
    return text.replace(/\s+$/, '');
  }

  // 存在标签块：清空缓存，去掉所有标签块
  committedItems.clear();
  return text.replace(regex, '').replace(/\s+$/, '');
}

/**
 * 拼接选中记忆并写入输入框（合并式 + 同段内去重）
 * 使用 committedItems Map 做 key 级去重。
 * 每次确定时，旧记忆段被整体替换为新累积的条目，始终只保留一个记忆段。
 * @param {HTMLTextAreaElement} textarea
 * @param {string} userText
 * @param {Array<{key: string, item: Object}>} selected — 带 key 的选中条目
 */
function composeAndInsert(textarea, userText, selected) {
  if (!textarea) return;

  const basePart = stripMemoryBlock(userText);

  // 追加新选条目（key 去重）
  for (const { key, item } of selected) {
    if (committedItems.has(key)) continue;
    const body = formatItem(item);
    if (!body) continue;
    committedItems.set(key, body);
  }

  const bodies = Array.from(committedItems.values());
  if (!bodies.length) return;

  const lines = bodies.map((b, i) => `${i + 1}. ${b}`);
  const prefix = basePart ? `${basePart}\n\n` : '';
  const next = `${prefix}${MEM_TAG_OPEN}\n${lines.join('\n')}\n${MEM_TAG_CLOSE}`;

  textarea.value = next;
  try {
    textarea.selectionStart = textarea.selectionEnd = next.length;
  } catch (_) {
    // 某些受控组件可能不允许直接设置 selection，忽略即可
  }
  // 触发 input 事件，让受控组件感知变更
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.focus();
}

/**
 * 隐藏建议浮层（同时清空勾选状态）
 */
export function hideSuggestions() {
  const container = document.getElementById('echomem-suggestions');
  if (container) {
    container.style.display = 'none';
  }
  selectedIndex = -1;
  currentSuggestions = [];
  checkedKeys = new Set();
}

/**
 * 浮层是否可见
 */
export function isSuggestionsVisible() {
  const container = document.getElementById('echomem-suggestions');
  return !!(container && container.style.display !== 'none');
}

/**
 * blur 时是否应抑制关闭（input-tracker 调用）
 */
export function shouldSuppressBlurClose() {
  return suppressBlurClose;
}

/**
 * 绑定输入框键盘导航
 */
export function bindKeyboardNavigation(textarea) {
  if (keyboardBound) return;
  keyboardBound = true;

  textarea.addEventListener('keydown', (e) => {
    if (!isSuggestionsVisible()) return;
    const container = document.getElementById('echomem-suggestions');
    if (!container) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, currentSuggestions.length - 1);
        updateHighlight(container);
        break;

      case 'ArrowUp':
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        updateHighlight(container);
        break;

      case 'Enter':
        // Enter = 确定（仅在有勾选时阻止默认行为）
        if (checkedKeys.size > 0) {
          e.preventDefault();
          const selected = [];
          currentSuggestions.forEach((c, i) => {
            const key = getItemKey(c, i);
            if (checkedKeys.has(key)) {
              selected.push({ key, item: c });
            }
          });
          composeAndInsert(textarea, textarea.value || '', selected);
          hideSuggestions();
        }
        break;

      case 'Escape':
        e.preventDefault();
        hideSuggestions();
        break;
    }
  });
}

/**
 * 获取或创建浮层根容器
 */
function getOrCreateContainer() {
  let container = document.getElementById('echomem-suggestions');
  if (!container) {
    container = document.createElement('div');
    container.id = 'echomem-suggestions';
    container.className = 'echomem-suggestions-container';
    document.body.appendChild(container);
  }
  return container;
}

/**
 * 将浮层定位到输入框上方
 */
function positionContainer(container, inputElement) {
  if (!inputElement) return;
  const rect = inputElement.getBoundingClientRect();
  // 折叠后高度会变小，先临时显示以读取真实 offsetHeight
  const prevVisibility = container.style.visibility;
  container.style.visibility = 'hidden';
  container.style.display = 'block';
  const containerHeight = Math.min(container.offsetHeight || 160, 320);
  container.style.visibility = prevVisibility || '';

  container.style.position = 'fixed';
  container.style.left = `${rect.left}px`;
  container.style.top = `${rect.top - containerHeight - 8}px`;
  container.style.width = `${rect.width}px`;
  container.style.zIndex = '999999';
}

// 兼容旧接口
export function renderSuggestions(inputElement, memories) {
  console.warn('renderSuggestions is deprecated, use renderCompletions instead');
  const completions = memories.slice(0, 3).map(m => ({
    type: 'fallback',
    displayText: m.abstract?.slice(0, 60) || m.uri || '无标题',
    insertText: m.abstract || m.overview || '',
    source: 'memory',
    sourceUri: m.uri || '',
    score: m.score || 0,
    sourceType: 'memory'
  }));
  renderCompletions(inputElement, completions);
}
