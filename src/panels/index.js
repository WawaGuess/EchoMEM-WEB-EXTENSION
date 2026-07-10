// 面板内容聚合

import { getEchoMemHomeContent } from './echomem/index.js';
import {
  getPanelContent,
  getPanelDefinition,
  panelRegistry,
  resolvePanelId
} from './registry.js';
import { getResourceHomeContent } from './resource/index.js';
import { getResourceImportContent } from './resource/import.js';
import { getResourceManageContent } from './resource/manage.js';
import {
  getResourceQueryContent,
  initQueryPanel
} from './resource/query.js';
import {
  getEchoMemConfigContent,
  initConfigPanel
} from './echomem/config.js';
import { getInputAssociationContent } from './association/index.js';
import { getFeedbackContent, getGraphOverlayContent } from './feedback/index.js';
import {
  getPerformanceContent,
  fetchPerformanceData,
  initPerformancePanel
} from './performance/index.js';
import {
  getSkillStoreHomeContent,
  getSkillHistoryContent,
  getSkillUploadContent,
  getSkillManageContent,
  initSkillUploadPanel,
  initSkillHistoryPanel,
  initSkillManagePanel
} from './skill-store/index.js';

export {
  panelRegistry,
  getPanelDefinition,
  getPanelContent,
  resolvePanelId,
  getEchoMemHomeContent,
  getPerformanceContent,
  fetchPerformanceData,
  initPerformancePanel,
  getResourceHomeContent,
  getResourceImportContent,
  getResourceManageContent,
  getResourceQueryContent,
  initQueryPanel,
  getEchoMemConfigContent,
  initConfigPanel,
  getInputAssociationContent,
  getFeedbackContent,
  getGraphOverlayContent,
  getSkillStoreHomeContent,
  getSkillHistoryContent,
  getSkillUploadContent,
  getSkillManageContent,
  initSkillUploadPanel,
  initSkillHistoryPanel,
  initSkillManagePanel
};
