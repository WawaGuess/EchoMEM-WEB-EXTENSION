import { getResourceHomeContent } from './resource/index.js';
import { getInputAssociationContent } from './association/index.js';
import { getFeedbackContent } from './feedback/index.js';
import { getPerformanceContent } from './performance/index.js';
import { getSkillStoreHomeContent } from './skill-store/index.js';

export const panelRegistry = {
  resources: {
    id: 'resources',
    title: '资源管理',
    description: '管理文件资源与上传内容',
    render: getResourceHomeContent
  },
  association: {
    id: 'association',
    title: '输入联想',
    description: '开启或关闭智能联想',
    render: getInputAssociationContent
  },
  feedback: {
    id: 'feedback',
    title: '认知反馈',
    description: '查看会话分析与反馈报告',
    render: getFeedbackContent
  },
  skillStore: {
    id: 'skillStore',
    title: 'skill商店',
    description: '浏览、上传、安装 Skill',
    render: getSkillStoreHomeContent
  },
  performance: {
    id: 'performance',
    title: '效能',
    description: '查看使用效率与工作表现',
    render: getPerformanceContent
  }
};

const legacyPanelIds = {
  '资源管理': 'resources',
  '输入联想': 'association',
  '认知反馈': 'feedback',
  'skill商店': 'skillStore',
  '效能': 'performance'
};

export function resolvePanelId(panelIdOrTitle) {
  if (panelRegistry[panelIdOrTitle]) {
    return panelIdOrTitle;
  }

  return legacyPanelIds[panelIdOrTitle] || panelIdOrTitle;
}

export function getPanelDefinition(panelIdOrTitle) {
  return panelRegistry[resolvePanelId(panelIdOrTitle)] || null;
}

export function getPanelContent(panelIdOrTitle) {
  const panel = getPanelDefinition(panelIdOrTitle);
  return panel ? panel.render() : '<p>暂无内容</p>';
}
