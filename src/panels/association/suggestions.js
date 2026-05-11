// 联想建议浮层 — 渲染与交互（支持键盘导航、来源标记、智能补全）

import { escapeHtml } from '../../utils/text-processor.js';

let selectedIndex = -1;
let currentSuggestions = [];
let keyboardBound = false;
let containerElement = null;

/**
 * 渲染补全建议浮层
 * @param {HTMLTextAreaElement} inputElement
 * @param {Array} completions - generateCompletions 的返回
 */
export function renderCompletions(inputElement, completions) {
  currentSuggestions = completions;
  selectedIndex = completions.length > 0 ? 0 : -1;

  const container = getOrCreateContainer();
  containerElement = container;

  if (!completions.length) {
    hideSuggestions();
    return;
  }

  const items = completions.map((c, i) => {
    const isActive = i === selectedIndex;
    const sourceBadge = c.source === 'memory'
      ? '<span class="echomem-source-badge memory">记忆</span>'
      : '<span class="echomem-source-badge session">会话</span>';

    return `
      <div class="echomem-suggestion-item ${isActive ? 'echomem-suggestion-active' : ''}"
           data-index="${i}"
           style="${isActive ? 'background: #e8eaf6;' : ''}">
        <span class="suggestion-text">${escapeHtml(c.displayText)}</span>
        <div class="suggestion-meta">
          ${sourceBadge}
          <span class="suggestion-score">${(c.score || 0).toFixed(2)}</span>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = items;
  container.style.display = 'block';
  positionContainer(container, inputElement);

  // 绑定点击事件
  container.querySelectorAll('.echomem-suggestion-item').forEach(item => {
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const idx = Number(item.dataset.index);
      insertSuggestion(inputElement, completions[idx]);
    });

    item.addEventListener('mouseenter', () => {
      selectedIndex = Number(item.dataset.index);
      updateSelection();
    });
  });
}

/**
 * 隐藏建议浮层
 */
export function hideSuggestions() {
  const container = document.getElementById('echomem-suggestions');
  if (container) {
    container.style.display = 'none';
  }
  selectedIndex = -1;
  currentSuggestions = [];
}

/**
 * 检查浮层是否可见
 */
export function isSuggestionsVisible() {
  const container = document.getElementById('echomem-suggestions');
  return container && container.style.display !== 'none';
}

/**
 * 插入建议到输入框
 * 替换整个输入框内容（避免与用户已输入内容重复）
 * @param {HTMLTextAreaElement} inputElement
 * @param {Object} completion
 */
function insertSuggestion(inputElement, completion) {
  if (!completion) return;

  const text = completion.insertText || '';

  // 直接替换整个输入框内容
  inputElement.value = text;
  inputElement.selectionStart = inputElement.selectionEnd = text.length;
  inputElement.focus();

  hideSuggestions();
}

/**
 * 更新选中状态
 */
function updateSelection() {
  const items = document.querySelectorAll('.echomem-suggestion-item');
  items.forEach((item, i) => {
    if (i === selectedIndex) {
      item.classList.add('echomem-suggestion-active');
      item.style.background = '#e8eaf6';
    } else {
      item.classList.remove('echomem-suggestion-active');
      item.style.background = '';
    }
  });
}

/**
 * 绑定键盘导航事件
 * @param {HTMLTextAreaElement} textarea
 */
export function bindKeyboardNavigation(textarea) {
  if (keyboardBound) return;
  keyboardBound = true;

  textarea.addEventListener('keydown', (e) => {
    if (!isSuggestionsVisible()) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, currentSuggestions.length - 1);
        updateSelection();
        break;

      case 'ArrowUp':
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        updateSelection();
        break;

      case 'Tab':
        e.preventDefault();
        if (selectedIndex >= 0 && currentSuggestions[selectedIndex]) {
          insertSuggestion(textarea, currentSuggestions[selectedIndex]);
        } else if (currentSuggestions.length > 0) {
          // Tab 默认选第一条
          insertSuggestion(textarea, currentSuggestions[0]);
        }
        break;

      case 'Enter':
        if (selectedIndex >= 0 && currentSuggestions[selectedIndex]) {
          e.preventDefault();
          insertSuggestion(textarea, currentSuggestions[selectedIndex]);
        }
        break;

      case 'Escape':
        hideSuggestions();
        break;
    }
  });
}

/**
 * 获取或创建浮层容器
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
 * 定位浮层到输入框上方
 */
function positionContainer(container, inputElement) {
  const rect = inputElement.getBoundingClientRect();
  const containerHeight = Math.min(container.offsetHeight || 160, 200);

  container.style.position = 'fixed';
  container.style.left = `${rect.left}px`;
  container.style.top = `${rect.top - containerHeight - 8}px`;
  container.style.width = `${rect.width}px`;
  container.style.zIndex = '999999';
}

// 兼容旧接口：renderSuggestions 现在调用 renderCompletions
export function renderSuggestions(inputElement, memories) {
  console.warn('renderSuggestions is deprecated, use renderCompletions instead');
  // 简单兼容：将 memories 转为 completions 格式
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
