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

const FMT = (n) => n.toLocaleString('zh-CN');

function isHigoPlatform() {
  const platform = getCurrentPlatform();
  return platform?.config?.id === 'higo' || platform?.key === 'higo';
}

// ── 骨架屏 HTML（带 id，供后续异步更新） ───────────────────────────────

function skeletonValue(width = '60px') {
  return `<span class="perf-skeleton" style="
    display: inline-block;
    width: ${width}; height: 20px;
    background: #e5e7eb;
    border-radius: 4px;
    animation: perf-skeleton-pulse 1.5s ease-in-out infinite;
  "></span>`;
}

export function getPerformanceContent() {
  const showSessionStats = isHigoPlatform();
  const totalSection = showSessionStats ? `
      <!-- 核心指标：总 Token 消耗 -->
      <div style="
        padding: 18px 16px;
        border-radius: 10px;
        background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        border: 1px solid #bfdbfe;
        text-align: center;
      ">
        <div style="font-size: 12px; color: #2563eb; font-weight: 500; margin-bottom: 6px;">总 Token 消耗</div>
        <div id="perf-total" style="font-size: 32px; font-weight: 800; color: #1d4ed8; line-height: 1;">${skeletonValue('100px')}</div>
      </div>
  ` : '';

  const sessionStatsSection = showSessionStats ? `
      <!-- 会话统计 -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <div style="padding: 14px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
          <p style="margin: 0 0 6px; font-size: 12px; color: #6b7280;">会话数</p>
          <p id="perf-sessions" style="margin: 0; font-size: 20px; font-weight: 700; color: #111827;">${skeletonValue('60px')}</p>
        </div>
        <div style="padding: 14px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
          <p style="margin: 0 0 6px; font-size: 12px; color: #6b7280;">轮次数</p>
          <p id="perf-turns" style="margin: 0; font-size: 20px; font-weight: 700; color: #111827;">${skeletonValue('60px')}</p>
        </div>
      </div>

      <!-- Input / Output 拆分 -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <div style="padding: 14px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
          <p style="margin: 0 0 6px; font-size: 12px; color: #6b7280;">Input Tokens</p>
          <p id="perf-input" style="margin: 0; font-size: 20px; font-weight: 700; color: #111827;">${skeletonValue('80px')}</p>
          <p style="margin: 4px 0 0; font-size: 11px; color: #9ca3af;">tokens</p>
        </div>
        <div style="padding: 14px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
          <p style="margin: 0 0 6px; font-size: 12px; color: #6b7280;">Output Tokens</p>
          <p id="perf-output" style="margin: 0; font-size: 20px; font-weight: 700; color: #111827;">${skeletonValue('80px')}</p>
          <p style="margin: 4px 0 0; font-size: 11px; color: #9ca3af;">tokens</p>
        </div>
      </div>
  ` : '';

  return `
    <style>
      @keyframes perf-skeleton-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
    </style>
    <div id="perf-root" style="color: #374151; display: flex; flex-direction: column; gap: 12px;">
      ${totalSection}

      ${sessionStatsSection}

      <!-- 后端消耗 -->
      <div style="padding: 14px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
        <p style="margin: 0 0 6px; font-size: 12px; color: #6b7280;">EchoMem 后端消耗</p>
        <p id="perf-backend" style="margin: 0; font-size: 20px; font-weight: 700; color: #111827;">${skeletonValue('80px')}</p>
        <p style="margin: 4px 0 0; font-size: 11px; color: #9ca3af;">tokens</p>
      </div>

      <!-- 说明 -->
      <div style="display: flex; justify-content: flex-end; align-items: center; gap: 8px;">
        <button id="perf-refresh-btn" style="padding: 4px 10px; font-size: 12px; color: #2563eb; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px; cursor: pointer;"
        >🔄 刷新</button>
      </div>
      <div id="perf-desc" style="
        padding: 12px 14px;
        border-radius: 8px;
        background: #fff;
        border: 1px solid #e5e7eb;
        font-size: 12px;
        color: #6b7280;
        line-height: 1.6;
      ">
        <span style="color: #2563eb; font-weight: 600;">正在加载数据…</span>
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

function updatePerformanceDOM(bodyElement, data, showSessionStats = true) {
  if (!bodyElement) return;

  const totalEl    = bodyElement.querySelector('#perf-total');
  const sessionsEl = bodyElement.querySelector('#perf-sessions');
  const turnsEl    = bodyElement.querySelector('#perf-turns');
  const inputEl    = bodyElement.querySelector('#perf-input');
  const outputEl   = bodyElement.querySelector('#perf-output');
  const backendEl  = bodyElement.querySelector('#perf-backend');
  const descEl     = bodyElement.querySelector('#perf-desc');

  const sessionTokens = data.totalTokens ?? 0;
  const backendTokens = data.backendTokens ?? 0;
  const totalTokens = sessionTokens + backendTokens;

  if (showSessionStats) {
    if (totalEl)    totalEl.textContent    = FMT(totalTokens);
    if (sessionsEl) sessionsEl.textContent = FMT(data.totalSessions ?? 0);
    if (turnsEl)    turnsEl.textContent    = FMT(data.totalTurns ?? 0);
    if (inputEl)    inputEl.textContent    = FMT(data.totalInputTokens ?? 0);
    if (outputEl)   outputEl.textContent   = FMT(data.totalOutputTokens ?? 0);
  }

  if (backendEl) {
    if (data.backendTokens !== undefined && data.backendTokens !== null) {
      backendEl.textContent = FMT(data.backendTokens);
      backendEl.style.color = '#111827';
    } else {
      backendEl.textContent = '--';
      backendEl.style.color = '#9ca3af';
    }
  }

  if (descEl) {
    const sinceText = data.since
      ? `自 ${new Date(data.since).toLocaleString('zh-CN')} 起统计`
      : '统计范围：全部历史会话';
    if (showSessionStats) {
      descEl.innerHTML = `
        <span style="color: #2563eb; font-weight: 600;">Token 统计：</span>
        累计 ${FMT(data.totalSessions ?? 0)} 个会话，${FMT(data.totalTurns ?? 0)} 轮对话；
        会话消耗 <strong style="color: #111827;">${FMT(sessionTokens)}</strong> tokens，
        EchoMem 后端消耗 <strong style="color: #111827;">${FMT(backendTokens)}</strong> tokens，
        合计 <strong style="color: #111827;">${FMT(totalTokens)}</strong> tokens。
        <br><span style="color: #9ca3af;">${sinceText}</span>
      `;
    } else {
      descEl.innerHTML = `
        <span style="color: #2563eb; font-weight: 600;">Token 统计：</span>
        当前平台仅展示 EchoMem 后端 Token 消耗。
        <br><span style="color: #9ca3af;">会话级 Token 统计仅在 HIGO 平台可用</span>
      `;
    }
  }
}

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

      const data = statsResult.status === 'fulfilled' && statsResult.value
        ? statsResult.value
        : {
            totalSessions: 0,
            totalTurns: 0,
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalTokens: 0,
            since: null,
          };

      if (usageResult.status === 'fulfilled') {
        data.backendTokens = usageResult.value;
      }

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
        descEl.innerHTML = `<span style="color: #dc2626;">数据加载失败，请稍后重试</span>`;
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
