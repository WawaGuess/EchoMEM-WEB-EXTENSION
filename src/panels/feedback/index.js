// 认知反馈面板内容 - 知识图谱渲染

// 假数据：JavaScript 异步编程知识点图谱
const mockGraphData = {
  nodes: [
    // 核心概念（大节点）
    { id: 'js', name: 'JavaScript', symbolSize: 70, category: 0, value: 100 },
    { id: 'async', name: '异步编程', symbolSize: 60, category: 0, value: 90 },

    // 关键知识点（中等节点）
    { id: 'promise', name: 'Promise', symbolSize: 50, category: 1, value: 80 },
    { id: 'async-await', name: 'async/await', symbolSize: 50, category: 1, value: 80 },
    { id: 'callback', name: '回调函数', symbolSize: 45, category: 1, value: 70 },
    { id: 'event-loop', name: '事件循环', symbolSize: 45, category: 1, value: 70 },

    // 细节概念（小节点）
    { id: 'then', name: '.then()', symbolSize: 35, category: 2, value: 50 },
    { id: 'catch', name: '.catch()', symbolSize: 35, category: 2, value: 50 },
    { id: 'resolve', name: 'resolve', symbolSize: 30, category: 2, value: 40 },
    { id: 'reject', name: 'reject', symbolSize: 30, category: 2, value: 40 },
    { id: 'microtask', name: '微任务', symbolSize: 35, category: 2, value: 50 },
    { id: 'macrotask', name: '宏任务', symbolSize: 35, category: 2, value: 50 },
    { id: 'settimeout', name: 'setTimeout', symbolSize: 30, category: 2, value: 40 },
    { id: 'fetch', name: 'Fetch API', symbolSize: 35, category: 2, value: 50 },
    { id: 'xhr', name: 'XMLHttpRequest', symbolSize: 30, category: 2, value: 40 },

    // 问题/注意（小节点，红色）
    { id: 'hell', name: '回调地狱', symbolSize: 35, category: 3, value: 50 },
  ],
  links: [
    // 层级关系
    { source: 'js', target: 'async', name: '包含' },
    { source: 'async', target: 'promise', name: '核心方案' },
    { source: 'async', target: 'callback', name: '基础方式' },
    { source: 'async', target: 'event-loop', name: '底层机制' },

    // Promise 相关
    { source: 'promise', target: 'then', name: '方法' },
    { source: 'promise', target: 'catch', name: '方法' },
    { source: 'promise', target: 'resolve', name: '状态' },
    { source: 'promise', target: 'reject', name: '状态' },
    { source: 'promise', target: 'async-await', name: '语法糖' },

    // 事件循环相关
    { source: 'event-loop', target: 'microtask', name: '包含' },
    { source: 'event-loop', target: 'macrotask', name: '包含' },
    { source: 'macrotask', target: 'settimeout', name: '示例' },

    // 实际应用
    { source: 'async', target: 'fetch', name: '应用场景' },
    { source: 'callback', target: 'xhr', name: '传统用法' },
    { source: 'callback', target: 'hell', name: '导致' },
    { source: 'promise', target: 'hell', name: '解决' },
  ],
  categories: [
    { name: '核心概念', itemStyle: { color: '#667eea' } },
    { name: '关键知识点', itemStyle: { color: '#f093fb' } },
    { name: '细节/方法', itemStyle: { color: '#4facfe' } },
    { name: '问题/注意', itemStyle: { color: '#fa709a' } },
  ],
};

import * as echarts from 'echarts/core';
import { GraphChart } from 'echarts/charts';
import { CanvasRenderer } from 'echarts/renderers';
import { TooltipComponent, LegendComponent } from 'echarts/components';

// 注册需要的组件（按需加载，减小打包体积）
echarts.use([GraphChart, CanvasRenderer, TooltipComponent, LegendComponent]);

/**
 * 获取 ECharts 实例（已打包进扩展，无需动态加载）
 */
function loadECharts() {
  return Promise.resolve(echarts);
}

/**
 * 初始化并渲染知识图谱
 * @param {HTMLElement} container - 图表容器元素
 * 文档：docs/flows/cognitive-feedback/图谱渲染.md
 */
async function renderGraph(container) {
  try {
    const echarts = await loadECharts();

    const chart = echarts.init(container);

    const option = {
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          if (params.dataType === 'node') {
            const categoryName = mockGraphData.categories[params.data.category]?.name || '未知';
            return `<b>${params.data.name}</b><br/>类型: ${categoryName}`;
          }
          return `${params.data.source} → ${params.data.target}<br/>关系: ${params.data.name}`;
        },
      },
      legend: {
        data: mockGraphData.categories.map((c) => c.name),
        bottom: 10,
        textStyle: { fontSize: 12 },
      },
      series: [
        {
          type: 'graph',
          layout: 'force',
          data: mockGraphData.nodes,
          links: mockGraphData.links,
          categories: mockGraphData.categories,
          roam: true,
          draggable: true,
          label: {
            show: true,
            position: 'inside',
            fontSize: 12,
            color: '#fff',
          },
          force: {
            repulsion: 300,
            edgeLength: [80, 150],
            gravity: 0.1,
          },
          lineStyle: {
            color: 'source',
            curveness: 0.2,
            width: 2,
          },
          emphasis: {
            focus: 'adjacency',
            lineStyle: { width: 4 },
          },
          animationDuration: 1500,
          animationEasingUpdate: 'quinticInOut',
        },
      ],
    };

    chart.setOption(option);

    // 响应式：窗口大小变化时重绘
    const resizeHandler = () => chart.resize();
    window.addEventListener('resize', resizeHandler);

    // 清理：面板关闭时移除 resize 监听
    container._echartsResizeHandler = resizeHandler;
    container._echartsInstance = chart;

    return chart;
  } catch (err) {
    console.error('EchoMem: 加载 ECharts 失败', err);
    const errorMsg = err.message || '未知错误';
    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #999; flex-direction: column; gap: 12px; padding: 20px; text-align: center;">
        <p style="font-size: 14px; color: #666;">图谱加载失败</p>
        <p style="font-size: 12px; color: #999; max-width: 300px;">${errorMsg}</p>
        <button id="echomem-retry-graph" style="padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">重试</button>
      </div>
    `;

    // 绑定重试按钮事件（使用 addEventListener 而不是 onclick）
    const retryBtn = container.querySelector('#echomem-retry-graph');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        container.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #999;">正在加载...</div>';
        renderGraph(container);
      });
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
 * 获取认知图谱浮层内容（用于居中 overlay）
 */
export function getGraphOverlayContent() {
  const containerId = 'echomem-graph-container-' + Date.now();

  // 使用 setTimeout 在 DOM 插入后初始化图表
  setTimeout(() => {
    const container = document.getElementById(containerId);
    if (container) {
      renderGraph(container);
    }
  }, 100);

  return `
    <div id="${containerId}" style="width: 100%; height: 100%; min-height: 400px;"></div>
  `;
}

/**
 * 清理图谱相关资源（在面板关闭时调用）
 */
export function cleanupGraph(containerId) {
  const container = document.getElementById(containerId);
  if (container) {
    if (container._echartsResizeHandler) {
      window.removeEventListener('resize', container._echartsResizeHandler);
    }
    if (container._echartsInstance) {
      container._echartsInstance.dispose();
    }
  }
}
