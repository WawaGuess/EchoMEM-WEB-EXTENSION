// 认知反馈面板内容 - 知识图谱 3D 渲染
// 文档：docs/flows/cognitive-feedback/图谱渲染.md

import { fetchGraphData } from '../../services/graph-client.js';
import { renderThreeGraph, cleanupThreeGraph } from './graph-three.js';

const DEFAULT_MODE = 'about';

function setLoadingState(container) {
  container.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #999; flex-direction: column; gap: 12px;">
      <div style="width: 32px; height: 32px; border: 3px solid #1a2332; border-top-color: #667eea; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      <p style="font-size: 13px; color: #8899aa;">正在加载认知图谱…</p>
    </div>
    <style>
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
  `;
}

function setErrorState(container, err) {
  container.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #999; flex-direction: column; gap: 12px; padding: 20px; text-align: center;">
      <p style="font-size: 14px; color: #aabbcc;">图谱加载失败</p>
      <p style="font-size: 12px; color: #667788; max-width: 300px;">${err.message || '未知错误'}</p>
      <button id="echomem-retry-graph" style="padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">重试</button>
    </div>
  `;

  const retryBtn = container.querySelector('#echomem-retry-graph');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      container._graphData = null;
      renderGraph(container);
    });
  }
}

function setEmptyState(container) {
  container.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #999; flex-direction: column; gap: 12px; text-align: center;">
      <p style="font-size: 14px; color: #aabbcc;">当前视图暂无数据</p>
      <p style="font-size: 12px; color: #667788; max-width: 300px;">实体关系下没有找到可渲染的节点或关系。</p>
    </div>
  `;
}

function filterGraphData(graphData, mode) {
  if (mode === 'all') return graphData;

  const filteredLinks = graphData.links.filter((l) => l.name === mode);
  const linkedIds = new Set();
  filteredLinks.forEach((l) => {
    linkedIds.add(l.source);
    linkedIds.add(l.target);
  });
  const filteredNodes = graphData.nodes.filter((n) => linkedIds.has(n.id));

  const usedCategories = new Set(filteredNodes.map((n) => n.category));
  const filteredCategories = graphData.categories.filter((_, idx) => usedCategories.has(idx));

  return {
    ...graphData,
    nodes: filteredNodes,
    links: filteredLinks,
    categories: filteredCategories,
  };
}

/**
 * 渲染知识图谱（仅实体关系）
 * @param {HTMLElement} container - 图表容器元素
 */
async function renderGraph(container) {
  try {
    setLoadingState(container);

    let graphData = container._graphData;
    if (!graphData) {
      graphData = await fetchGraphData();
      container._graphData = graphData;
    }

    if (!container.isConnected) return;

    const viewData = filterGraphData(graphData, DEFAULT_MODE);

    if (viewData.nodes.length === 0) {
      setEmptyState(container);
      return;
    }

    renderThreeGraph(container, viewData);
  } catch (err) {
    console.error('EchoMem: 加载认知图谱失败', err);
    if (container.isConnected) {
      setErrorState(container, err);
    }
  }
}

/**
 * 获取认知反馈面板内容（作为基础内容，实际打开时会通过 openCenterOverlay 展示居中图谱）
 */
export function getFeedbackContent() {
  return `
    <div style="color: #666;">
      <p style="margin-bottom: 12px;">🧠 认知反馈面板</p>
      <div style="
        padding: 16px;
        background: #f8f9fa;
        border-radius: 8px;
        margin-bottom: 12px;
      ">
        <p style="font-weight: 500; color: #333; margin-bottom: 8px;">当前会话分析</p>
        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
          <span>对话轮次</span>
          <span style="color: #333; font-weight: 500;">0</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
          <span>平均响应时间</span>
          <span style="color: #333; font-weight: 500;">--</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 13px;">
          <span>Token 消耗</span>
          <span style="color: #333; font-weight: 500;">0</span>
        </div>
      </div>
      <button style="
        width: 100%;
        padding: 10px;
        background: #667eea;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
      ">生成反馈报告</button>
    </div>
  `;
}

/**
 * 获取认知图谱浮层内容（用于居中 overlay，仅展示实体关系）
 */
export function getGraphOverlayContent() {
  const wrapperId = 'echomem-graph-wrapper-' + Date.now();
  const containerId = 'echomem-graph-container-' + Date.now();

  setTimeout(() => {
    const container = document.getElementById(containerId);
    if (container) {
      renderGraph(container);
    }
  }, 100);

  return `
    <div id="${wrapperId}" style="
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      min-height: 400px;
      background: #05070a;
    ">
      <div id="${containerId}" style="flex: 1; min-height: 0;"></div>
    </div>
  `;
}

/**
 * 清理图谱相关资源（在面板关闭时调用）
 */
export function cleanupGraph(containerId) {
  const container = document.getElementById(containerId);
  if (container) {
    cleanupThreeGraph(container);
  }
}
