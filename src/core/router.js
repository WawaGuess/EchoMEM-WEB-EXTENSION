import {
  getPanelBodyElement,
  openCustomPanel,
  restoreOriginalPanel
} from './panel.js';
import { setCurrentRoute } from './state.js';
import {
  getEchoMemHomeContent,
  getPanelContent,
  getPanelDefinition,
  getSkillStoreHomeContent,
  getSkillHistoryContent,
  getSkillUploadContent,
  getSkillPurchaseContent,
  getSkillMerchantContent,
  getSkillManageContent
} from '../panels/index.js';
import {
  bindToggleButton,
  getInputAssociationContent,
  toggleInputAssociation
} from '../panels/association/index.js';

const skillStoreRoutes = {
  history: {
    title: '用户历史 Skill',
    render: getSkillHistoryContent
  },
  upload: {
    title: '上传 Skill 到商店',
    render: getSkillUploadContent
  },
  purchase: {
    title: '商店 Skill 购买',
    render: getSkillPurchaseContent
  },
  merchant: {
    title: '商家提供的 Skill',
    render: getSkillMerchantContent
  },
  manage: {
    title: 'Skill 安装管理',
    render: getSkillManageContent
  }
};

export function openEchoMemHomePanel() {
  setCurrentRoute({ type: 'home' });
  openCustomPanel('EchoMem', getEchoMemHomeContent());
  bindPanelNavigation();
}

export function navigateToEchoMemPanel(panelIdOrTitle) {
  const panel = getPanelDefinition(panelIdOrTitle);
  if (!panel) return;

  setCurrentRoute({ type: 'panel', panelId: panel.id });
  openCustomPanel(panel.title, getPanelContent(panel.id), {
    showBack: true,
    onBack: openEchoMemHomePanel
  });
  bindPanelNavigation();
}

export function navigateToSkillSection(sectionId) {
  const route = skillStoreRoutes[sectionId];
  if (!route) return;

  setCurrentRoute({
    type: 'panel',
    panelId: 'skillStore',
    route: sectionId
  });

  openCustomPanel(route.title, route.render(), {
    showBack: true,
    onBack: () => {
      openCustomPanel('skill商店', getSkillStoreHomeContent(), {
        showBack: true,
        onBack: openEchoMemHomePanel
      });
      bindPanelNavigation();
    }
  });
  bindPanelControls();
}

export function closePanel() {
  setCurrentRoute(null);
  restoreOriginalPanel();
}

export function refreshInputAssociationPanel() {
  const contentDiv = getPanelBodyElement();

  if (contentDiv) {
    contentDiv.innerHTML = getInputAssociationContent();
    bindToggleButton(handleInputAssociationToggle);
  }
}

function handleInputAssociationToggle() {
  toggleInputAssociation();
  refreshInputAssociationPanel();
}

export function bindPanelControls() {
  bindToggleButton(handleInputAssociationToggle);
}

export function bindPanelNavigation(root = document) {
  const customPanel = root.querySelector('.claw-custom-panel');
  if (!customPanel || customPanel.dataset.clawEventsBound) {
    bindPanelControls();
    return;
  }

  customPanel.dataset.clawEventsBound = 'true';
  customPanel.addEventListener('click', (e) => {
    const menuItem = e.target.closest('.claw-echomem-menu-item');
    if (menuItem) {
      const panelId = menuItem.dataset.panelId || menuItem.dataset.panel;
      if (panelId) {
        navigateToEchoMemPanel(panelId);
      }
      return;
    }

    const card = e.target.closest('.claw-skill-section');
    if (card) {
      const sectionId = card.dataset.section;
      if (sectionId) {
        navigateToSkillSection(sectionId);
      }
    }
  });

  bindPanelControls();
}
