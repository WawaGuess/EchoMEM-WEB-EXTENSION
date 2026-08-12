// 文档：docs/flows/panel-system/生命周期.md
// 面板系统（统一使用 overlay 模式）

import { getCurrentPlatform } from './detection.js';
import {
  getPanelWidth,
  setPanelOpen,
  setPanelWidth,
} from './state.js';
import {
  calculateSidePanelWidth,
  clampSidePanelWidth,
  getKeyboardSidePanelWidth,
  getSidePanelResponsiveState,
  getSidePanelWidthForViewport,
  getSidePanelWidthBounds,
  shouldHandleSidePanelWindowResize,
} from './panel-resize.js';

let isCustomPanelOpen = false;
let currentOverlayPanel = null;

export function getPanelConfig(platform = getCurrentPlatform()) {
  return platform?.config?.panelHost || platform?.config?.panel || null;
}

export function getPanelContainer() {
  return currentOverlayPanel;
}

export function isPanelOpen() {
  return isCustomPanelOpen;
}

function buildPanelHeader(title, showBack, onBack, compact = false) {
  if (showBack) {
    return `
      <div class="claw-panel-header claw-panel-header--with-back${compact ? ' claw-panel-header--compact' : ''}" style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: ${compact ? '56px' : '64px'};
        padding: 0 ${compact ? '16px' : '20px'};
      ">
        <div class="claw-panel-header-leading" style="display: flex; align-items: center; gap: ${compact ? '8px' : '12px'};">
          <button type="button" class="claw-back-btn" style="
            width: ${compact ? '36px' : '40px'};
            height: ${compact ? '36px' : '40px'};
            border-radius: 50%;
            border: none;
            background: transparent;
            cursor: pointer;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #49454f;
            transition: background-color 200ms ease, color 200ms ease, transform 200ms ease;
          " title="返回">
            <svg width="${compact ? '16' : '18'}" height="${compact ? '16' : '18'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>
          <h6 class="claw-panel-title" style="
            margin: 0;
            font-size: ${compact ? '16px' : '18px'};
            font-weight: 500;
            color: #21005d;
            font-family: Roboto, 'Noto Sans SC', sans-serif;
            letter-spacing: -0.01em;
          ">${title}</h6>
        </div>
        <button type="button" class="claw-close-panel" style="
          width: ${compact ? '36px' : '40px'};
          height: ${compact ? '36px' : '40px'};
          border-radius: 50%;
          border: none;
          background: transparent;
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #49454f;
          transition: background-color 200ms ease, color 200ms ease, transform 200ms ease;
        " title="关闭">
          <svg width="${compact ? '16' : '18'}" height="${compact ? '16' : '18'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;
  } else {
    return `
      <div class="claw-panel-header" style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 64px;
        padding: 0 20px;
      ">
        <h6 class="claw-panel-title" style="
          margin: 0;
          font-size: 18px;
          font-weight: 500;
          color: #21005d;
          font-family: Roboto, 'Noto Sans SC', sans-serif;
          letter-spacing: -0.01em;
        ">${title}</h6>
        <button type="button" class="claw-close-panel" style="
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          background: transparent;
          color: #49454f;
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 200ms ease, color 200ms ease, transform 200ms ease;
        " title="关闭">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;
  }
}

function bindPanelEvents(container, showBack, onBack, closeMode = 'restore') {
  if (showBack) {
    const backBtn = container.querySelector('.claw-back-btn');
    if (backBtn) {
      backBtn.addEventListener('mouseenter', () => {
        backBtn.style.background = '#EADDFF';
        backBtn.style.color = '#21005D';
      });
      backBtn.addEventListener('mouseleave', () => {
        backBtn.style.background = 'transparent';
        backBtn.style.color = '#49454F';
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
      closeBtn.style.background = '#EADDFF';
      closeBtn.style.color = '#21005D';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'transparent';
      closeBtn.style.color = '#49454F';
    });
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (closeMode === 'overlay-only') {
        closeOverlayPanel();
      } else {
        restoreOriginalPanel();
      }
    });
  }
}

function removeOverlayElement(overlay) {
  if (!overlay) return;
  if (typeof overlay._resizeCleanup === 'function') {
    overlay._resizeCleanup();
    overlay._resizeCleanup = null;
  }
  overlay.remove();
}

function attachSideOverlayResize(overlay, position, configuredWidth) {
  if (position !== 'right' && position !== 'left') return;

  const handle = document.createElement('div');
  handle.className = 'claw-overlay-resize-handle';
  handle.tabIndex = 0;
  handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-label', '调整 EchoMem 面板宽度');
  handle.setAttribute('aria-orientation', 'vertical');
  handle.title = '拖拽调整宽度；双击恢复默认宽度';
  overlay.appendChild(handle);

  let dragState = null;
  let previousBodyCursor = '';
  let previousBodyUserSelect = '';

  const updateHandleValue = (width) => {
    const { minWidth, maxWidth } = getSidePanelWidthBounds(window.innerWidth);
    handle.setAttribute('aria-valuemin', String(Math.round(minWidth)));
    handle.setAttribute('aria-valuemax', String(Math.round(maxWidth)));
    handle.setAttribute('aria-valuenow', String(Math.round(width)));
  };

  const updateResponsiveState = (width) => {
    const { isCompact, isNarrow } = getSidePanelResponsiveState(width);
    overlay.classList.toggle('claw-overlay-panel--compact', isCompact);
    overlay.classList.toggle('claw-overlay-panel--narrow', isNarrow);
  };

  const applyWidth = (width) => {
    const nextWidth = clampSidePanelWidth(width, window.innerWidth);
    overlay.style.width = `${Math.round(nextWidth)}px`;
    updateHandleValue(nextWidth);
    updateResponsiveState(nextWidth);
    return nextWidth;
  };

  const restorePageInteraction = () => {
    document.body.style.cursor = previousBodyCursor;
    document.body.style.userSelect = previousBodyUserSelect;
    overlay.classList.remove('claw-overlay-panel--resizing');
  };

  const finishResize = (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    dragState = null;
    if (handle.hasPointerCapture(event.pointerId)) {
      handle.releasePointerCapture(event.pointerId);
    }
    restorePageInteraction();
    setPanelWidth(overlay.getBoundingClientRect().width);
  };

  const onPointerDown = (event) => {
    if (event.button !== 0 || dragState) return;
    event.preventDefault();
    event.stopPropagation();

    const rect = overlay.getBoundingClientRect();
    dragState = {
      pointerId: event.pointerId,
      startWidth: rect.width,
      startX: event.clientX,
    };
    previousBodyCursor = document.body.style.cursor;
    previousBodyUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    overlay.classList.add('claw-overlay-panel--resizing');
    handle.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    event.preventDefault();
    applyWidth(calculateSidePanelWidth({
      position,
      startWidth: dragState.startWidth,
      startX: dragState.startX,
      currentX: event.clientX,
      viewportWidth: window.innerWidth,
    }));
  };

  const onKeyDown = (event) => {
    const currentWidth = overlay.getBoundingClientRect().width;
    const nextWidth = getKeyboardSidePanelWidth({
      position,
      currentWidth,
      key: event.key,
      shiftKey: event.shiftKey,
      viewportWidth: window.innerWidth,
    });
    if (nextWidth === null) return;

    event.preventDefault();
    applyWidth(nextWidth);
    setPanelWidth(nextWidth);
  };

  const onDoubleClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const defaultWidth = Number.parseFloat(configuredWidth);
    const nextWidth = applyWidth(defaultWidth);
    setPanelWidth(nextWidth);
  };

  const resizeToCurrentViewport = () => {
    if (!shouldHandleSidePanelWindowResize({
      isConnected: overlay.isConnected,
      display: overlay.style.display,
    })) return null;

    const nextWidth = getSidePanelWidthForViewport({
      preferredWidth: dragState ? null : getPanelWidth(),
      currentWidth: overlay.getBoundingClientRect().width,
      viewportWidth: window.innerWidth,
    });
    return applyWidth(nextWidth);
  };

  const onWindowResize = () => resizeToCurrentViewport();

  handle.addEventListener('pointerdown', onPointerDown);
  handle.addEventListener('pointermove', onPointerMove);
  handle.addEventListener('pointerup', finishResize);
  handle.addEventListener('pointercancel', finishResize);
  handle.addEventListener('lostpointercapture', finishResize);
  handle.addEventListener('keydown', onKeyDown);
  handle.addEventListener('dblclick', onDoubleClick);
  window.addEventListener('resize', onWindowResize);
  const initialWidth = overlay.getBoundingClientRect().width;
  updateHandleValue(initialWidth);
  updateResponsiveState(initialWidth);
  overlay._resizeToCurrentViewport = resizeToCurrentViewport;

  overlay._resizeCleanup = () => {
    handle.removeEventListener('pointerdown', onPointerDown);
    handle.removeEventListener('pointermove', onPointerMove);
    handle.removeEventListener('pointerup', finishResize);
    handle.removeEventListener('pointercancel', finishResize);
    handle.removeEventListener('lostpointercapture', finishResize);
    handle.removeEventListener('keydown', onKeyDown);
    handle.removeEventListener('dblclick', onDoubleClick);
    window.removeEventListener('resize', onWindowResize);
    overlay._resizeToCurrentViewport = null;
    if (dragState) {
      if (handle.hasPointerCapture(dragState.pointerId)) {
        handle.releasePointerCapture(dragState.pointerId);
      }
      dragState = null;
      restorePageInteraction();
    }
  };
}

export function openCustomPanel(title, contentHtml, options = {}) {
  const platform = getCurrentPlatform();
  if (!platform) return;

  const panelConfig = getPanelConfig(platform);
  if (!panelConfig) return;

  const { showBack = false, onBack = null } = options;

  const headerHtml = buildPanelHeader(title, showBack, onBack);
  const panelHtml = `
    <div class="claw-custom-panel" style="
      display: flex;
      flex-direction: column;
      height: 100%;
      background: linear-gradient(180deg, #FFFBFE 0%, #FEF7FF 100%);
    ">
      ${headerHtml}
      <div class="claw-custom-panel-body" style="
        flex: 1;
        overflow-y: auto;
        padding: 20px 20px 28px;
      ">
        ${contentHtml}
      </div>
    </div>
  `;

  createOverlayPanel(panelHtml, panelConfig.overlayConfig);
  bindPanelEvents(currentOverlayPanel, showBack, onBack);
  isCustomPanelOpen = true;
  setPanelOpen(true);
}

function createOverlayPanel(panelHtml, overlayConfig) {
  if (currentOverlayPanel) {
    removeOverlayElement(currentOverlayPanel);
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
      opacity: 0;
      transition: opacity 200ms ease;
      z-index: 9998;
    `;
    backdrop.addEventListener('click', restoreOriginalPanel);
    document.body.appendChild(backdrop);
  }

  const overlay = document.createElement('div');
  overlay.className = 'claw-overlay-panel';

  const position = overlayConfig.position || 'right';
  const width = overlayConfig.width || '400px';
  const isSideOverlay = position === 'right' || position === 'left';
  const savedWidth = isSideOverlay ? getPanelWidth() : null;
  const initialWidth = savedWidth === null
    ? width
    : `${Math.round(clampSidePanelWidth(savedWidth, window.innerWidth))}px`;
  overlay.classList.add(`claw-overlay-panel--${position}`);

  let positionStyles = '';
  if (position === 'right') {
    positionStyles = `
      top: 0;
      right: 0;
      bottom: 0;
      width: ${initialWidth};
      transform: translateX(100%);
    `;
  } else if (position === 'left') {
    positionStyles = `
      top: 0;
      left: 0;
      bottom: 0;
      width: ${initialWidth};
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
    background: #FFFBFE;
    z-index: 9999;
    box-shadow: 0 12px 36px rgba(33, 0, 93, 0.16);
    transition: transform 200ms cubic-bezier(0.2, 0, 0, 1), opacity 200ms ease;
    overflow: hidden;
  `;

  overlay.innerHTML = panelHtml;
  document.body.appendChild(overlay);
  attachSideOverlayResize(overlay, position, width);

  requestAnimationFrame(() => {
    if (backdrop) {
      backdrop.style.opacity = '1';
    }
    if (position === 'right' || position === 'left') {
      overlay.style.transform = 'translateX(0)';
    } else if (position === 'center') {
      overlay.style.transform = 'translate(-50%, -50%) scale(1)';
    }
  });

  currentOverlayPanel = overlay;
}

/**
 * 关闭当前 overlay 浮层
 * 如果有 _previousOverlay，则恢复它
 */
export function closeOverlayPanel() {
  const overlayToClose = currentOverlayPanel;
  const previousOverlay = overlayToClose?._previousOverlay;

  // 1. 先恢复之前的 overlay（如果有）
  if (previousOverlay) {
    previousOverlay.style.display = '';
    if (typeof previousOverlay._resizeToCurrentViewport === 'function') {
      previousOverlay._resizeToCurrentViewport();
    }
    currentOverlayPanel = previousOverlay;
    isCustomPanelOpen = true;
    setPanelOpen(true);
    console.log('Claw Extension: Restored previous overlay');
  } else {
    currentOverlayPanel = null;
    isCustomPanelOpen = false;
    setPanelOpen(false);
  }

  // 2. 关闭当前浮层（动画 + 移除）
  if (overlayToClose) {
    const transform = overlayToClose.style.transform;
    if (transform && transform.includes('translateX(0)')) {
      const isRight = overlayToClose.style.right === '0px' || overlayToClose.style.right === '';
      overlayToClose.style.transform = isRight ? 'translateX(100%)' : 'translateX(-100%)';
    } else {
      overlayToClose.style.transform = 'translate(-50%, -50%) scale(0.9)';
      overlayToClose.style.opacity = '0';
    }

    setTimeout(() => {
      removeOverlayElement(overlayToClose);
    }, 300);
  }

  // 3. 移除遮罩层
  document.querySelectorAll('.claw-overlay-backdrop').forEach(b => {
    b.style.pointerEvents = 'none';  // 立即禁用点击拦截
    b.style.opacity = '0';
    setTimeout(() => b.remove(), 300);
  });
}

export function restoreOriginalPanel() {
  if (currentOverlayPanel) {
    closeOverlayPanel();
  }
  document.querySelectorAll('.claw-overlay-backdrop').forEach(b => b.remove());
}

export function getPanelBodyElement() {
  const container = getPanelContainer();
  return container?.querySelector('.claw-custom-panel-body') || null;
}

/**
 * 打开居中、大尺寸的浮动窗口（用于认知反馈图谱等全屏展示场景）
 * 不依赖 platform config，直接创建居中 overlay
 * 文档：docs/flows/panel-system/居中浮层.md
 */
export function openCenterOverlay(title, contentHtml, options = {}) {
  const {
    showBack = false,
    onBack = null,
    width,
    height,
    maxWidth,
    maxHeight,
    compactHeader = false,
    panelClass = ''
  } = options;

  // 保存当前可能存在的 EchoMem overlay 面板（DeepSeek 场景）
  const existingOverlay = currentOverlayPanel;
  if (existingOverlay) {
    // 暂时隐藏已有的 overlay，而不是删除它
    existingOverlay.style.display = 'none';
    currentOverlayPanel = null;
  }

  // 移除旧遮罩层
  document.querySelectorAll('.claw-overlay-backdrop').forEach(b => b.remove());

  const headerHtml = buildPanelHeader(title, showBack, onBack, compactHeader);
  const panelHtml = `
    <div class="claw-custom-panel" style="
      display: flex;
      flex-direction: column;
      height: 100%;
      background: linear-gradient(180deg, #FFFBFE 0%, #FEF7FF 100%);
    ">
      ${headerHtml}
      <div class="claw-custom-panel-body" style="
        flex: 1;
        overflow-y: auto;
        padding: 0;
      ">
        ${contentHtml}
      </div>
    </div>
  `;

  createOverlayPanel(panelHtml, {
    position: 'center',
    width: width || '85vw',
    backdrop: true
  });

  // 调整居中浮层的尺寸
  if (currentOverlayPanel) {
    if (typeof panelClass === 'string' && panelClass.trim()) {
      currentOverlayPanel.classList.add(...panelClass.trim().split(/\s+/));
    }
    currentOverlayPanel.style.maxWidth = maxWidth || '1000px';
    currentOverlayPanel.style.height = height || '80vh';
    currentOverlayPanel.style.maxHeight = maxHeight || '700px';
    currentOverlayPanel.style.borderRadius = '16px';
    currentOverlayPanel.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.2)';
    // 标记这是认知图谱浮层，关闭时需要恢复之前的 overlay
    currentOverlayPanel._previousOverlay = existingOverlay;
  }

  bindPanelEvents(currentOverlayPanel, showBack, onBack, 'overlay-only');
  isCustomPanelOpen = true;
  setPanelOpen(true);
}
