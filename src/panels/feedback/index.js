// 认知反馈公共视图壳：Episode / Summary 由独立 bundle 注册。

import { mountViewSwitcher } from './view-switcher.js';
import { getOptionalFeedbackViews } from './view-registry.js';

export function getFeedbackContent() {
  return `
    <div style="color:#49454F;font-family:Roboto,'Noto Sans SC',sans-serif;">
      <p style="margin:0 0 12px;color:#6750A4;font-size:12px;font-weight:600;letter-spacing:.08em;">ECHO · 认知反馈</p>
      <div style="padding:16px;background:#FFF;border:1px solid rgba(121,116,126,.24);border-radius:12px;margin-bottom:12px;">
        <p style="font-weight:500;color:#21005D;margin-bottom:8px;">当前会话分析</p>
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;"><span>对话轮次</span><span style="color:#1D1B20;font-weight:500;">0</span></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;"><span>平均响应时间</span><span style="color:#1D1B20;font-weight:500;">--</span></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;"><span>Token 消耗</span><span style="color:#1D1B20;font-weight:500;">0</span></div>
      </div>
      <button type="button" style="width:100%;min-height:40px;padding:10px 18px;background:linear-gradient(135deg,#6750A4,#21005D);color:#FFF;border:0;border-radius:20px;cursor:pointer;font-size:14px;font-weight:500;">生成反馈报告</button>
    </div>
  `;
}

export function getGraphOverlayContent() {
  const wrapperId = `echomem-feedback-wrapper-${Date.now()}`;

  setTimeout(() => {
    const wrapper = document.getElementById(wrapperId);
    if (!wrapper) return;

    const views = getOptionalFeedbackViews();

    mountViewSwitcher(wrapper, {
      defaultKey: 'summary',
      views,
    });
  }, 100);

  return `<div id="${wrapperId}" style="display:flex;flex-direction:column;width:100%;height:100%;min-height:400px;background:#05070a;"></div>`;
}

export function cleanupGraph(_containerId) {
  // 记忆图谱功能已关闭，无需清理。
}
