/**
 * 文档：docs/flows/performance/Token指标流程.md
 * 效能面板（Token 消耗概览）
 *
 * 支持骨架屏先渲染、数据异步填充，以及可选的定时轮询刷新。
 * 使用方式：
 *   1. openCustomPanel(panel.title, getPerformanceContent())  // 先显示骨架屏
 *   2. initPerformancePanel(bodyElement, { pollInterval: 30000 })  // 再加载数据 + 可选轮询
 *   3. 面板关闭时调用返回的 destroy() 清理轮询定时器
 */

import { getEchoMemConfig } from '../../services/config.js';
import { createClient } from '../../services/echomem-client.js';
import { getCurrentPlatform } from '../../core/detection.js';
import { buildPerformanceState, updatePerformanceDOM } from './view-state.js';

function isHigoPlatform() {
  const platform = getCurrentPlatform();
  return platform?.config?.id === 'higo' || platform?.key === 'higo';
}

// ── 骨架屏 HTML（带 id，供后续异步更新） ───────────────────────────────

function skeletonValue(width = '60px') {
  return `<span class="perf-skeleton" style="width: ${width};"></span>`;
}

export function getPerformanceContent() {
  const showSessionStats = isHigoPlatform();
  const totalSection = showSessionStats ? `
      <!-- 核心指标：总 Token 消耗 -->
      <div class="perf-hero-card">
        <div class="perf-hero-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>
        </div>
        <div class="perf-label perf-hero-label">总 Token 消耗</div>
        <div id="perf-total" class="perf-total-value">${skeletonValue('100px')}</div>
        <div id="perf-total-status" class="perf-unit perf-hero-unit" aria-live="polite">tokens</div>
      </div>
  ` : '';

  const sessionNotice = showSessionStats ? `
      <div id="perf-session-notice" class="perf-notice" role="status" hidden>
        <span class="perf-notice-icon" aria-hidden="true">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
        </span>
        <span>
          <strong id="perf-session-notice-title" class="perf-notice-title"></strong>
          <span id="perf-session-notice-detail" class="perf-notice-detail"></span>
        </span>
      </div>
  ` : '';

  const sessionStatsSection = showSessionStats ? `
      <!-- 会话统计 -->
      <div class="perf-grid">
        <div class="perf-metric-card">
          <p class="perf-label">会话数</p>
          <p id="perf-sessions" class="perf-metric-value">${skeletonValue('60px')}</p>
          <p id="perf-sessions-status" class="perf-unit perf-card-status" aria-live="polite"></p>
        </div>
        <div class="perf-metric-card">
          <p class="perf-label">轮次数</p>
          <p id="perf-turns" class="perf-metric-value">${skeletonValue('60px')}</p>
          <p id="perf-turns-status" class="perf-unit perf-card-status" aria-live="polite"></p>
        </div>
      </div>

      <!-- Input / Output 拆分 -->
      <div class="perf-grid">
        <div class="perf-metric-card">
          <p class="perf-label">Input Tokens</p>
          <p id="perf-input" class="perf-metric-value">${skeletonValue('80px')}</p>
          <p id="perf-input-status" class="perf-unit perf-card-status" aria-live="polite">tokens</p>
        </div>
        <div class="perf-metric-card">
          <p class="perf-label">Output Tokens</p>
          <p id="perf-output" class="perf-metric-value">${skeletonValue('80px')}</p>
          <p id="perf-output-status" class="perf-unit perf-card-status" aria-live="polite">tokens</p>
        </div>
      </div>
  ` : '';

  return `
    <style>
      @keyframes perf-skeleton-pulse {
        0%, 100% { opacity: 0.95; }
        50% { opacity: 0.42; }
      }
      #perf-root {
        color: #1D1B20;
        display: flex;
        flex-direction: column;
        gap: 12px;
        font-family: Roboto, "Noto Sans SC", sans-serif;
      }
      #perf-root, #perf-root * { box-sizing: border-box; }
      #perf-root .perf-hero-card {
        position: relative;
        overflow: hidden;
        padding: 20px 16px 18px;
        border: 1px solid #D8CCE7;
        border-radius: 20px;
        background: linear-gradient(145deg, #F3E9FF 0%, #EADDFF 58%, #F8F2FF 100%);
        box-shadow: 0 6px 20px rgba(103, 80, 164, 0.12);
        text-align: center;
      }
      #perf-root .perf-hero-card::after {
        content: '';
        position: absolute;
        top: -34px;
        right: -30px;
        width: 100px;
        height: 100px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.38);
        pointer-events: none;
      }
      #perf-root .perf-hero-icon {
        position: absolute;
        top: 14px;
        left: 14px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.64);
        color: #6750A4;
      }
      #perf-root .perf-label {
        margin: 0 0 6px;
        color: #625F66;
        font-size: 12px;
        font-weight: 500;
        line-height: 1.4;
      }
      #perf-root .perf-hero-label { color: #6750A4; }
      #perf-root .perf-total-value {
        position: relative;
        z-index: 1;
        color: #21005D;
        font-size: 32px;
        font-weight: 750;
        letter-spacing: -0.025em;
        line-height: 1.08;
      }
      #perf-root .perf-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      #perf-root .perf-metric-card {
        min-width: 0;
        padding: 14px;
        border: 1px solid #E7E0EC;
        border-radius: 16px;
        background: #FFFFFF;
        box-shadow: 0 1px 2px rgba(29, 27, 32, 0.04);
      }
      #perf-root .perf-backend-card {
        background: #FEF7FF;
        border-color: #E0D4F1;
      }
      #perf-root .perf-metric-value {
        margin: 0;
        overflow: hidden;
        color: #1D1B20;
        font-size: 21px;
        font-weight: 700;
        letter-spacing: -0.015em;
        line-height: 1.2;
        text-overflow: ellipsis;
      }
      #perf-root .perf-unit {
        margin: 4px 0 0;
        color: #79747E;
        font-size: 10px;
        line-height: 1.4;
      }
      #perf-root .perf-hero-unit { color: #625B71; }
      #perf-root .perf-card-status { font-size: 11px; }
      #perf-root .perf-notice {
        display: flex;
        align-items: flex-start;
        gap: 9px;
        padding: 12px 14px;
        border: 1px solid #E7E0EC;
        border-radius: 14px;
        background: #F7F2FA;
        color: #49454F;
        font-size: 12px;
        line-height: 1.5;
      }
      #perf-root .perf-notice[hidden] { display: none; }
      #perf-root .perf-notice-icon {
        display: inline-flex;
        flex: 0 0 auto;
        margin-top: 1px;
        color: #6750A4;
      }
      #perf-root .perf-notice-title,
      #perf-root .perf-notice-detail { display: block; }
      #perf-root .perf-notice-title {
        margin-bottom: 2px;
        color: #49454F;
        font-weight: 650;
      }
      #perf-root .perf-notice-detail { color: #79747E; }
      #perf-root .perf-status-error { color: #B3261E; }
      #perf-root .perf-skeleton {
        display: inline-block;
        height: 20px;
        max-width: 100%;
        border-radius: 8px;
        background: linear-gradient(90deg, #DED6E3, #F3EDF7, #DED6E3);
        animation: perf-skeleton-pulse 1.5s ease-in-out infinite;
        vertical-align: middle;
      }
      #perf-root .perf-toolbar {
        display: flex;
        justify-content: flex-end;
        align-items: center;
      }
      #perf-root .perf-refresh {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 36px;
        padding: 7px 13px;
        border: 1px solid #E0D4F1;
        border-radius: 999px;
        background: #F3EDF7;
        color: #6750A4;
        font-family: inherit;
        font-size: 12px;
        font-weight: 600;
        line-height: 1.3;
        cursor: pointer;
        transition: background 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
      }
      #perf-root .perf-refresh:hover {
        background: #EADDFF;
        box-shadow: 0 3px 10px rgba(103, 80, 164, 0.14);
      }
      #perf-root .perf-refresh:active { transform: scale(0.98); }
      #perf-root .perf-refresh:focus-visible {
        outline: 3px solid rgba(103, 80, 164, 0.22);
        outline-offset: 2px;
      }
      #perf-root .perf-refresh:disabled { cursor: wait; opacity: 0.62; }
      #perf-root .perf-refresh::before {
        content: '↻';
        font-size: 15px;
        font-weight: 500;
        line-height: 1;
      }
      #perf-root .perf-description {
        padding: 13px 14px;
        border: 1px solid #E7E0EC;
        border-radius: 14px;
        background: #FFFFFF;
        color: #625F66;
        font-size: 12px;
        line-height: 1.65;
      }
      .claw-overlay-panel--narrow #perf-root .perf-grid { grid-template-columns: 1fr; }
      .claw-overlay-panel--narrow #perf-root .perf-hero-card { padding: 18px 14px 16px; }
      .claw-overlay-panel--narrow #perf-root .perf-total-value { font-size: 28px; }
      @media (prefers-reduced-motion: reduce) {
        #perf-root .perf-skeleton { animation: none; }
        #perf-root .perf-refresh { transition: none; }
      }
    </style>
    <div id="perf-root">
      ${totalSection}

      ${sessionNotice}

      ${sessionStatsSection}

      <!-- 后端消耗 -->
      <div class="perf-metric-card perf-backend-card">
        <p class="perf-label">EchoMem 后端消耗</p>
        <p id="perf-backend" class="perf-metric-value">${skeletonValue('80px')}</p>
        <p id="perf-backend-status" class="perf-unit perf-card-status" aria-live="polite">tokens</p>
      </div>

      <!-- 说明 -->
      <div class="perf-toolbar">
        <button id="perf-refresh-btn" class="perf-refresh">
          刷新
        </button>
      </div>
      <div id="perf-desc" class="perf-description">
        <span style="color: #6750A4; font-weight: 600;">正在加载数据…</span>
      </div>
    </div>
  `;
}

// ── 数据获取 ────────────────────────────────────────────────────────────

/**
 * 从后端获取用户会话 Token 统计数据
 * 通过 background script 代理请求，绕过页面域 CORS 限制
 */
export async function fetchPerformanceData() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'fetchStatsSummary' }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response || !response.success) {
        reject(new Error(response?.error || 'Unknown error'));
        return;
      }
      const data = response.data;
      resolve({
        totalSessions: data.total_sessions ?? 0,
        totalTurns: data.total_turns ?? 0,
        totalInputTokens: data.total_input_tokens ?? 0,
        totalOutputTokens: data.total_output_tokens ?? 0,
        totalTokens: data.total_tokens ?? 0,
        since: data.since,
      });
    });
  });
}

/**
 * 从 EchoMem（记忆后端引擎）获取后端 Token 消耗统计
 */
async function fetchBackendUsageData() {
  const config = await getEchoMemConfig();
  const client = createClient(config);
  const result = await client.fetchUsage();
  return result.total?.total_tokens ?? 0;
}

// ── DOM 更新 ────────────────────────────────────────────────────────────

// ── 面板初始化（含可选轮询） ────────────────────────────────────────────

/**
 * 初始化效能面板：异步加载数据并可选开启轮询
 * @param {HTMLElement} bodyElement - .claw-custom-panel-body 元素
 * @param {Object} [options]
 * @param {number} [options.pollInterval] - 轮询间隔（毫秒），不传则不轮询
 * @returns {{ destroy: Function }} 销毁对象，面板关闭时调用 destroy() 停止轮询
 */
export function initPerformancePanel(bodyElement, options = {}) {
  let pollTimer = null;
  let destroyed = false;

  async function refresh() {
    if (destroyed) return;
    try {
      const showSessionStats = isHigoPlatform();
      const promises = [];
      if (showSessionStats) {
        promises.push(fetchPerformanceData());
      }
      promises.push(fetchBackendUsageData());

      const results = await Promise.allSettled(promises);
      const statsResult = showSessionStats ? results[0] : { status: 'fulfilled', value: null };
      const usageResult = showSessionStats ? results[1] : results[0];

      const data = buildPerformanceState({ showSessionStats, statsResult, usageResult });

      if (!destroyed) updatePerformanceDOM(bodyElement, data, showSessionStats);

      if (statsResult.status === 'rejected') {
        console.warn('EchoMem: session stats fetch failed', statsResult.reason);
      }
      if (usageResult.status === 'rejected') {
        console.warn('EchoMem: backend usage fetch failed', usageResult.reason);
      }
    } catch (err) {
      console.warn('EchoMem: performance data refresh failed', err);
      const descEl = bodyElement?.querySelector('#perf-desc');
      if (descEl && !destroyed) {
        descEl.innerHTML = `<span style="color: #B3261E; font-weight: 600;">数据加载失败，请稍后重试</span>`;
      }
    }
  }

  // 立即执行首次加载
  refresh();

  // 绑定手动刷新按钮
  const refreshBtn = bodyElement?.querySelector('#perf-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      const originalText = refreshBtn.textContent;
      refreshBtn.textContent = '刷新中...';
      refreshBtn.disabled = true;
      await refresh();
      refreshBtn.textContent = originalText;
      refreshBtn.disabled = false;
    });
  }

  // 可选轮询
  const { pollInterval } = options;
  if (pollInterval && pollInterval > 0) {
    pollTimer = setInterval(refresh, pollInterval);
  }

  return {
    destroy() {
      destroyed = true;
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }
  };
}
