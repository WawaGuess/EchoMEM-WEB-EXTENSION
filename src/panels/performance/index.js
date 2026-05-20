/**
 * 效能面板（Token 消耗概览）
 *
 * 支持骨架屏先渲染、数据异步填充，以及可选的定时轮询刷新。
 * 使用方式：
 *   1. openCustomPanel(panel.title, getPerformanceContent())  // 先显示骨架屏
 *   2. initPerformancePanel(bodyElement, { pollInterval: 30000 })  // 再加载数据 + 可选轮询
 *   3. 面板关闭时调用返回的 destroy() 清理轮询定时器
 */

const FMT = (n) => n.toLocaleString('zh-CN');

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
  return `
    <style>
      @keyframes perf-skeleton-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
    </style>
    <div id="perf-root" style="color: #374151; display: flex; flex-direction: column; gap: 12px;">
      <!-- 核心指标：预计节省 -->
      <div style="
        padding: 18px 16px;
        border-radius: 10px;
        background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
        border: 1px solid #a7f3d0;
        text-align: center;
      ">
        <div style="font-size: 12px; color: #059669; font-weight: 500; margin-bottom: 6px;">💰 预计节省 Token</div>
        <div id="perf-saved" style="font-size: 32px; font-weight: 800; color: #047857; line-height: 1;">${skeletonValue('100px')}</div>
      </div>

      <!-- 成本对比：用户消耗 vs 后端消耗 -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <div style="padding: 14px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
          <p style="margin: 0 0 6px; font-size: 12px; color: #6b7280;">用户会话消耗</p>
          <p id="perf-user" style="margin: 0; font-size: 20px; font-weight: 700; color: #111827;">${skeletonValue('80px')}</p>
          <p style="margin: 4px 0 0; font-size: 11px; color: #9ca3af;">tokens</p>
        </div>
        <div style="padding: 14px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
          <p style="margin: 0 0 6px; font-size: 12px; color: #6b7280;">EchoMem 后端消耗</p>
          <p id="perf-backend" style="margin: 0; font-size: 20px; font-weight: 700; color: #111827;">${skeletonValue('80px')}</p>
          <p style="margin: 4px 0 0; font-size: 11px; color: #9ca3af;">tokens</p>
        </div>
      </div>

      <!-- 节省说明 -->
      <div id="perf-desc" style="
        padding: 12px 14px;
        border-radius: 8px;
        background: #fff;
        border: 1px solid #e5e7eb;
        font-size: 12px;
        color: #6b7280;
        line-height: 1.6;
      ">
        <span style="color: #059669; font-weight: 600;">正在加载数据…</span>
      </div>
    </div>
  `;
}

// ── 数据获取 ────────────────────────────────────────────────────────────

/**
 * 从后端获取 Token 效能数据
 * TODO: 接入真实 API，替换为实际请求
 */
export async function fetchPerformanceData() {
  // 示例：
  // const { createClient } = await import('../../services/openviking-client.js');
  // const { getOpenVikingConfig } = await import('../../services/config.js');
  // const client = createClient(await getOpenVikingConfig());
  // const res = await client.get('/api/performance/tokens');
  // return res.data;

  return {
    userTokens: 45280,
    savedTokens: 12500,
    backendTokens: 32780
  };
}

// ── DOM 更新 ────────────────────────────────────────────────────────────

function updatePerformanceDOM(bodyElement, data) {
  if (!bodyElement) return;

  const savedEl = bodyElement.querySelector('#perf-saved');
  const userEl  = bodyElement.querySelector('#perf-user');
  const backendEl = bodyElement.querySelector('#perf-backend');
  const descEl  = bodyElement.querySelector('#perf-desc');

  if (savedEl) savedEl.textContent = FMT(data.savedTokens ?? 0);
  if (userEl)  userEl.textContent  = FMT(data.userTokens ?? 0);
  if (backendEl) backendEl.textContent = FMT(data.backendTokens ?? 0);

  if (descEl) {
    descEl.innerHTML = `
      <span style="color: #059669; font-weight: 600;">净节省：</span>
      EchoMem 本次帮你节省了 <strong style="color: #111827;">${FMT(data.savedTokens ?? 0)}</strong> tokens
      （后端消耗 ${FMT(data.backendTokens ?? 0)} tokens 已计入成本）。
    `;
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
      const data = await fetchPerformanceData();
      if (!destroyed) updatePerformanceDOM(bodyElement, data);
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
