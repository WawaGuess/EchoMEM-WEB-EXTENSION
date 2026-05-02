// 面板内容聚合

import { getEchoMemHomeContent } from './echomem.js';
import {
  getPanelContent,
  getPanelDefinition,
  panelRegistry,
  resolvePanelId
} from './registry.js';
import { getResourceContent } from './resource.js';
import { getInputAssociationContent } from './association.js';
import { getFeedbackContent } from './feedback.js';
import { getPerformanceContent } from './performance.js';
import {
  getSkillStoreHomeContent,
  getSkillHistoryContent,
  getSkillUploadContent,
  getSkillPurchaseContent,
  getSkillMerchantContent,
  getSkillManageContent
} from './skill-store.js';

export {
  panelRegistry,
  getPanelDefinition,
  getPanelContent,
  resolvePanelId,
  getEchoMemHomeContent,
  getPerformanceContent,
  getResourceContent,
  getInputAssociationContent,
  getFeedbackContent,
  getSkillStoreHomeContent,
  getSkillHistoryContent,
  getSkillUploadContent,
  getSkillPurchaseContent,
  getSkillMerchantContent,
  getSkillManageContent
};
