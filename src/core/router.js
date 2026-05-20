import {
  getPanelBodyElement,
  openCustomPanel,
  openCenterOverlay,
  closeOverlayPanel,
  restoreOriginalPanel
} from './panel-host.js';
import { setCurrentRoute } from './state.js';
import {
  getEchoMemHomeContent,
  getPanelContent,
  getPanelDefinition,
  getGraphOverlayContent,
  getSkillStoreHomeContent,
  getSkillHistoryContent,
  getSkillUploadContent,
  getSkillPurchaseContent,
  getSkillMerchantContent,
  getSkillManageContent,
  getResourceHomeContent,
  getResourceImportContent,
  getResourceManageContent
} from '../panels/index.js';
import { initImportPanel } from '../panels/resource/import.js';
import { initManagePanel } from '../panels/resource/manage.js';
import {
  getOpenVikingConfigContent,
  initConfigPanel
} from '../panels/echomem/config.js';
import {
  bindToggleButton,
  bindConfigUI,
  loadConfigValues,
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

const resourceSubRoutes = {
  import: {
    title: '资源导入',
    render: getResourceImportContent
  },
  manage: {
    title: '查看资源',
    render: getResourceManageContent
  }
};

export function openEchoMemHomePanel() {
  setCurrentRoute({ type: 'home' });
  openCustomPanel('EchoMem', getEchoMemHomeContent());
  // 重置事件绑定标记，确保新渲染的面板可以重新绑定事件
  const customPanel = document.querySelector('.claw-custom-panel');
  if (customPanel) {
    delete customPanel.dataset.clawEventsBound;
  }
  bindPanelNavigation();
}

export async function navigateToEchoMemPanel(panelIdOrTitle) {
  const panel = getPanelDefinition(panelIdOrTitle);
  if (!panel) return;

  setCurrentRoute({ type: 'panel', panelId: panel.id });

  // 认知反馈面板使用居中浮层打开图谱
  if (panel.id === 'feedback') {
    openCenterOverlay('认知图谱', getGraphOverlayContent(), {
      showBack: true,
      onBack: () => {
        closeOverlayPanel();
        openEchoMemHomePanel();
      }
    });
  } else {
    openCustomPanel(panel.title, getPanelContent(panel.id), {
      showBack: true,
      onBack: openEchoMemHomePanel
    });
  }

  bindPanelNavigation();

  // 如果是输入联想面板，加载配置值
  if (panel.id === 'association') {
    await loadConfigValues();
    bindConfigUI();
  }

  if (panel.id === 'resources') {
    const body = getPanelBodyElement();
    initImportPanel(body);
  }
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

export function navigateToResourceSection(sectionId) {
  const route = resourceSubRoutes[sectionId];
  if (!route) return;

  setCurrentRoute({
    type: 'panel',
    panelId: 'resources',
    route: sectionId
  });

  openCustomPanel(route.title, route.render(), {
    showBack: true,
    onBack: () => {
      openCustomPanel('资源管理', getResourceHomeContent(), {
        showBack: true,
        onBack: openEchoMemHomePanel
      });
      bindPanelNavigation();
    }
  });

  // Initialize sub-page
  const body = getPanelBodyElement();
  if (sectionId === 'import') {
    initImportPanel(body);
  } else if (sectionId === 'manage') {
    initManagePanel(body);
  }
}

export function navigateToConfigPanel() {
  setCurrentRoute({
    type: 'panel',
    panelId: 'openvikingConfig'
  });

  openCustomPanel('OpenViking 连接配置', getOpenVikingConfigContent(), {
    showBack: true,
    onBack: openEchoMemHomePanel
  });

  const body = getPanelBodyElement();
  initConfigPanel(body);
}

export function closePanel() {
  setCurrentRoute(null);
  restoreOriginalPanel();
}

export async function refreshInputAssociationPanel() {
  const contentDiv = getPanelBodyElement();

  if (contentDiv) {
    contentDiv.innerHTML = getInputAssociationContent();
    bindToggleButton(handleInputAssociationToggle);
    await loadConfigValues();
    bindConfigUI();
  }
}

function handleInputAssociationToggle() {
  toggleInputAssociation();
  refreshInputAssociationPanel();
}

export function bindPanelControls() {
  bindToggleButton(handleInputAssociationToggle);
  bindConfigUI();
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
      return;
    }

    const resourceCard = e.target.closest('.claw-resource-section');
    if (resourceCard) {
      const sectionId = resourceCard.dataset.resourceSection;
      if (sectionId) {
        navigateToResourceSection(sectionId);
      }
      return;
    }

    const configCard = e.target.closest('.claw-config-section');
    if (configCard) {
      navigateToConfigPanel();
    }
  });

  bindPanelControls();
}
