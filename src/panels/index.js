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
  getOpenVikingConfigContent,
  initConfigPanel
} from './echomem/config.js';
import { getInputAssociationContent } from './association/index.js';
import { getFeedbackContent, getGraphOverlayContent } from './feedback/index.js';
import { getPerformanceContent } from './performance/index.js';
import {
  getSkillStoreHomeContent,
  getSkillHistoryContent,
  getSkillUploadContent,
  getSkillPurchaseContent,
  getSkillMerchantContent,
  getSkillManageContent
} from './skill-store/index.js';

export {
  panelRegistry,
  getPanelDefinition,
  getPanelContent,
  resolvePanelId,
  getEchoMemHomeContent,
  getPerformanceContent,
  getResourceHomeContent,
  getResourceImportContent,
  getResourceManageContent,
  getOpenVikingConfigContent,
  initConfigPanel,
  getInputAssociationContent,
  getFeedbackContent,
  getGraphOverlayContent,
  getSkillStoreHomeContent,
  getSkillHistoryContent,
  getSkillUploadContent,
  getSkillPurchaseContent,
  getSkillMerchantContent,
  getSkillManageContent
};
