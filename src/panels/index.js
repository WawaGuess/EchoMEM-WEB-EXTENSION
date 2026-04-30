// 面板内容聚合

import { getResourceContent } from './resource.js';
import { getInputAssociationContent } from './association.js';
import { getFeedbackContent } from './feedback.js';
import {
  getSkillStoreHomeContent,
  getSkillHistoryContent,
  getSkillUploadContent,
  getSkillPurchaseContent,
  getSkillMerchantContent,
  getSkillManageContent
} from './skill-store.js';

export function getPanelContent(type) {
  const contents = {
    '资源管理': getResourceContent(),
    '输入联想': getInputAssociationContent(),
    '认知反馈': getFeedbackContent(),
    'skill商店': getSkillStoreHomeContent()
  };
  return contents[type] || '<p>暂无内容</p>';
}

export {
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
