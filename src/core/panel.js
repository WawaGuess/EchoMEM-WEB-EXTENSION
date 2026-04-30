// 面板系统（支持 sidebar 和 overlay 两种模式）

import { getCurrentPlatform } from './detection.js';

let originalPanelContent = null;
let isCustomPanelOpen = false;
let currentOverlayPanel = null;

export function getPanelContainer() {
  const platform = getCurrentPlatform();
  if (!platform) return null;

  const panelConfig = platform.config.panel;

  if (panelConfig.type === 'sidebar') {
    return document.querySelector(panelConfig.containerSelector);
  } else if (panelConfig.type === 'overlay') {
    return currentOverlayPanel;
  }

  return null;
}

export function isPanelOpen() {
  return isCustomPanelOpen;
}

export function getOriginalPanelContent() {
  return originalPanelContent;
}

export function setOriginalPanelContent(content) {
  originalPanelContent = content;
}

export function saveOriginalPanel() {
  const platform = getCurrentPlatform();
  if (!platform) return;

  const panelConfig = platform.config.panel;

  if (panelConfig.type === 'sidebar') {
    const container = document.querySelector(panelConfig.containerSelector);
    if (container && !originalPanelContent) {
      originalPanelContent = container.innerHTML;
    }
  }
}

function buildPanelHeader(title, showBack, onBack) {
  if (showBack) {
    return `
      <div style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px;
        border-bottom: 1px solid #e0e0e0;
        background: #fafafa;
      ">
        <div style="display: flex; align-items: center; gap: 12px;">
          <button class="claw-back-btn" style="
            background: none;
            border: none;
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #666;
            transition: background 0.2s;
          " title="返回">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>
          <h6 style="
            margin: 0;
            font-size: 16px;
            font-weight: 600;
            color: #333;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          ">${title}</h6>
        </div>
        <button class="claw-close-panel" style="
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #666;
          transition: background 0.2s;
        " title="关闭">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;
  } else {
    return `
      <div style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px;
        border-bottom: 1px solid #e0e0e0;
        background: #fafafa;
      ">
        <h6 style="
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #333;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        ">${title}</h6>
        <button class="claw-close-panel" style="
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #666;
          transition: background 0.2s;
        " title="关闭">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;
  }
}

function bindPanelEvents(container, showBack, onBack) {
  if (showBack) {
    const backBtn = container.querySelector('.claw-back-btn');
    if (backBtn) {
      backBtn.addEventListener('mouseenter', () => {
        backBtn.style.background = '#f0f0f0';
      });
      backBtn.addEventListener('mouseleave', () => {
        backBtn.style.background = 'none';
      });
      backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onBack) onBack();
      });
    }
  }

  const closeBtn = container.querySelector('.claw-close-panel');
  if (closeBtn) {
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = '#f0f0f0';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'none';
    });
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      restoreOriginalPanel();
    });
  }
}

export function openCustomPanel(title, contentHtml, options = {}) {
  const platform = getCurrentPlatform();
  if (!platform) return;

  const panelConfig = platform.config.panel;
  const { showBack = false, onBack = null } = options;

  isCustomPanelOpen = true;

  const headerHtml = buildPanelHeader(title, showBack, onBack);
  const panelHtml = `
    <div class="claw-custom-panel" style="
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #fff;
    ">
      ${headerHtml}
      <div style="
        flex: 1;
        overflow-y: auto;
        padding: 16px;
      ">
        ${contentHtml}
      </div>
    </div>
  `;

  if (panelConfig.type === 'sidebar') {
    const container = document.querySelector(panelConfig.containerSelector);
    if (!container) return;

    if (!originalPanelContent) {
      originalPanelContent = container.innerHTML;
    }

    container.innerHTML = panelHtml;
    bindPanelEvents(container, showBack, onBack);

  } else if (panelConfig.type === 'overlay') {
    createOverlayPanel(panelHtml, panelConfig.overlayConfig);
    bindPanelEvents(currentOverlayPanel, showBack, onBack);
  }
}

function createOverlayPanel(panelHtml, overlayConfig) {
  if (currentOverlayPanel) {
    currentOverlayPanel.remove();
    currentOverlayPanel = null;
  }

  // 移除所有已存在的遮罩层（防止多次打开叠加导致背景变暗）
  document.querySelectorAll('.claw-overlay-backdrop').forEach(b => b.remove());

  let backdrop = null;
  if (overlayConfig.backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'claw-overlay-backdrop';
    backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 9998;
    `;
    backdrop.addEventListener('click', restoreOriginalPanel);
    document.body.appendChild(backdrop);
  }

  const overlay = document.createElement('div');
  overlay.className = 'claw-overlay-panel';

  const position = overlayConfig.position || 'right';
  const width = overlayConfig.width || '400px';

  let positionStyles = '';
  if (position === 'right') {
    positionStyles = `
      top: 0;
      right: 0;
      bottom: 0;
      width: ${width};
      transform: translateX(100%);
    `;
  } else if (position === 'left') {
    positionStyles = `
      top: 0;
      left: 0;
      bottom: 0;
      width: ${width};
      transform: translateX(-100%);
    `;
  } else if (position === 'center') {
    positionStyles = `
      top: 50%;
      left: 50%;
      width: ${width};
      max-height: 80vh;
      transform: translate(-50%, -50%) scale(0.9);
      border-radius: 12px;
    `;
  }

  overlay.style.cssText = `
    position: fixed;
    ${positionStyles}
    background: #fff;
    z-index: 9999;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    transition: transform 0.3s ease;
    overflow: hidden;
  `;

  overlay.innerHTML = panelHtml;
  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    if (position === 'right' || position === 'left') {
      overlay.style.transform = 'translateX(0)';
    } else if (position === 'center') {
      overlay.style.transform = 'translate(-50%, -50%) scale(1)';
    }
  });

  currentOverlayPanel = overlay;
}

export function restoreOriginalPanel() {
  const platform = getCurrentPlatform();
  if (!platform) return;

  const panelConfig = platform.config.panel;

  if (panelConfig.type === 'sidebar') {
    const container = document.querySelector(panelConfig.containerSelector);
    if (container && originalPanelContent) {
      container.innerHTML = originalPanelContent;
      isCustomPanelOpen = false;
      console.log('Claw Extension: Sidebar panel restored');
    }
  } else if (panelConfig.type === 'overlay') {
    if (currentOverlayPanel) {
      const position = panelConfig.overlayConfig?.position || 'right';

      if (position === 'right') {
        currentOverlayPanel.style.transform = 'translateX(100%)';
      } else if (position === 'left') {
        currentOverlayPanel.style.transform = 'translateX(-100%)';
      } else if (position === 'center') {
        currentOverlayPanel.style.transform = 'translate(-50%, -50%) scale(0.9)';
        currentOverlayPanel.style.opacity = '0';
      }

      setTimeout(() => {
        if (currentOverlayPanel) {
          currentOverlayPanel.remove();
          currentOverlayPanel = null;
        }
      }, 300);
    }

    // 移除所有遮罩层
    document.querySelectorAll('.claw-overlay-backdrop').forEach(b => {
      b.style.opacity = '0';
      setTimeout(() => b.remove(), 300);
    });

    isCustomPanelOpen = false;
    console.log('Claw Extension: Overlay panel closed');
  }
}
