// 认知反馈公共视图壳：图谱由底座提供，Episode / Summary 由独立 bundle 注册。

import { fetchGraphData } from '../../services/graph-client.js';
import { renderThreeGraph, cleanupThreeGraph } from './graph-three.js';
import { mountViewSwitcher } from './view-switcher.js';
import { getOptionalFeedbackViews } from './view-registry.js';

const DEFAULT_MODE = 'all';

function isViewActive(container, viewApi) {
  return container.isConnected && (
    typeof viewApi.isActive !== 'function' || viewApi.isActive()
  );
}

function setLoadingState(container, label = '认知反馈') {
  container.innerHTML = `
    <div class="em-loading" role="status" aria-live="polite">
      <div class="em-state-orb" aria-hidden="true"></div>
      <p class="em-state-title">正在加载${label}…</p>
      <p class="em-state-copy">EchoMem 正在整理相关记忆，请稍候。</p>
    </div>
  `;
}

function setErrorState(container, err, onRetry) {
  container.innerHTML = `
    <div class="em-error" role="alert">
      <div class="em-state-orb" aria-hidden="true"></div>
      <p class="em-state-title">加载失败</p>
      <p class="em-state-copy"></p>
      <button class="em-primary-btn" type="button">重试</button>
    </div>
  `;
  container.querySelector('.em-state-copy').textContent = err?.message || '未知错误';
  container.querySelector('.em-primary-btn')?.addEventListener('click', onRetry);
}

function setEmptyState(container) {
  container.innerHTML = `
    <div class="em-empty">
      <div class="em-state-orb" aria-hidden="true"></div>
      <p class="em-state-title">当前视图暂无数据</p>
      <p class="em-state-copy">认知图谱下没有找到可渲染的节点或关系。</p>
    </div>
  `;
}

function filterGraphData(graphData, mode) {
  const visibleNodes = graphData.nodes.filter((node) => !node.id.startsWith('episode:'));
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  const visibleLinks = graphData.links.filter(
    (link) => visibleIds.has(link.source) && visibleIds.has(link.target)
  );
  const visibleGraph = { ...graphData, nodes: visibleNodes, links: visibleLinks };

  if (mode === 'all') return visibleGraph;

  const filteredLinks = visibleLinks.filter((link) => link.name === mode);
  const linkedIds = new Set();
  filteredLinks.forEach((link) => {
    linkedIds.add(link.source);
    linkedIds.add(link.target);
  });
  const filteredNodes = visibleNodes.filter((node) => linkedIds.has(node.id));
  const usedCategories = new Set(filteredNodes.map((node) => node.category));

  return {
    ...visibleGraph,
    nodes: filteredNodes,
    links: filteredLinks,
    categories: graphData.categories.filter((_, index) => usedCategories.has(index)),
  };
}

async function renderGraph(container, viewApi = {}) {
  try {
    setLoadingState(container, '认知图谱');
    let graphData = container._graphData;
    if (!graphData) {
      graphData = await fetchGraphData();
      container._graphData = graphData;
    }
    if (!isViewActive(container, viewApi)) return;

    const viewData = filterGraphData(graphData, DEFAULT_MODE);
    if (viewData.nodes.length === 0) {
      setEmptyState(container);
      return;
    }
    renderThreeGraph(container, viewData);
  } catch (err) {
    console.error('EchoMem: 加载认知图谱失败', err);
    if (!isViewActive(container, viewApi)) return;
    setErrorState(container, err, () => {
      if (!isViewActive(container, viewApi)) return;
      container._graphData = null;
      renderGraph(container, viewApi);
    });
  }
}

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

    const optionalViews = getOptionalFeedbackViews();
    const views = [
      {
        key: 'relation',
        label: '记忆图谱',
        mount: (element, api) => renderGraph(element, api),
        cleanup: (element) => {
          cleanupThreeGraph(element);
          element._graphData = null;
        },
      },
      ...optionalViews,
    ];

    mountViewSwitcher(wrapper, {
      defaultKey: optionalViews[0]?.key || 'relation',
      views,
    });
  }, 100);

  return `<div id="${wrapperId}" style="display:flex;flex-direction:column;width:100%;height:100%;min-height:400px;background:#05070a;"></div>`;
}

export function cleanupGraph(containerId) {
  const container = document.getElementById(containerId);
  if (container) cleanupThreeGraph(container);
}
