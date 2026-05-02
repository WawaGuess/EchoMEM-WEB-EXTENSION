// Claw Extension - Content Script Entry Point
// 注入到每个页面中执行

console.log('Claw Extension: Content script loaded');

// 向页面注入一个标记，方便调试
window.clawExtensionLoaded = true;

// ====== 导入模块 ======

import { detectPlatform, getCurrentPlatform } from './core/detection.js';
import { addCustomButtons } from './core/buttons.js';
import { restoreOriginalPanel, isPanelOpen, setOriginalPanelContent } from './core/panel.js';
import { bindToggleButton, toggleInputAssociation, getInputAssociationContent } from './panels/association.js';
import {
  getEchoMemHomeContent,
  getPanelContent,
  getSkillStoreHomeContent,
  getSkillHistoryContent,
  getSkillUploadContent,
  getSkillPurchaseContent,
  getSkillMerchantContent,
  getSkillManageContent
} from './panels/index.js';
import { openCustomPanel } from './core/panel.js';

// ====== Skill 商店导航 ======

function navigateToSkillSection(sectionId) {
  const contents = {
    'history': getSkillHistoryContent(),
    'upload': getSkillUploadContent(),
    'purchase': getSkillPurchaseContent(),
    'merchant': getSkillMerchantContent(),
    'manage': getSkillManageContent()
  };

  const titles = {
    'history': '用户历史 Skill',
    'upload': '上传 Skill 到商店',
    'purchase': '商店 Skill 购买',
    'merchant': '商家提供的 Skill',
    'manage': 'Skill 安装管理'
  };

  openCustomPanel(titles[sectionId], contents[sectionId], {
    showBack: true,
    onBack: () => {
      openCustomPanel('skill商店', getSkillStoreHomeContent(), {
        showBack: true,
        onBack: openEchoMemHomePanel
      });
    }
  });
}

function openEchoMemHomePanel() {
  openCustomPanel('EchoMem', getEchoMemHomeContent());
}

function navigateToEchoMemPanel(panelName) {
  openCustomPanel(panelName, getPanelContent(panelName), {
    showBack: true,
    onBack: openEchoMemHomePanel
  });
}

// ====== 辅助函数 ======

function insertText(textarea, text) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const currentValue = textarea.value;

  textarea.value = currentValue.substring(0, start) + text + currentValue.substring(end);
  textarea.selectionStart = textarea.selectionEnd = start + text.length;

  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.focus();
}

function refreshInputAssociationPanel() {
  const platform = getCurrentPlatform();
  if (!platform) return;

  const panelConfig = platform.config.panel;
  let contentDiv = null;

  if (panelConfig.type === 'sidebar') {
    const container = document.querySelector(panelConfig.containerSelector);
    if (container) {
      contentDiv = container.querySelector('.claw-custom-panel > div:last-child');
    }
  } else if (panelConfig.type === 'overlay') {
    const overlayPanel = document.querySelector('.claw-overlay-panel');
    if (overlayPanel) {
      contentDiv = overlayPanel.querySelector('.claw-custom-panel > div:last-child');
    }
  }

  if (contentDiv) {
    contentDiv.innerHTML = getInputAssociationContent();
    bindToggleButton(handleInputAssociationToggle);
  }
}

function handleInputAssociationToggle() {
  toggleInputAssociation();
  refreshInputAssociationPanel();
}

// ====== MutationObserver ======

const observer = new MutationObserver(() => {
  addCustomButtons();

  // 如果面板被重新渲染（比如切换标签），且自定义面板未打开，保存新的原始内容
  const platform = getCurrentPlatform();
  if (platform) {
    const panelConfig = platform.config.panel;
    if (panelConfig.type === 'sidebar') {
      const container = document.querySelector(panelConfig.containerSelector);
      if (container && !isPanelOpen() && !container.querySelector('.claw-custom-panel')) {
        setOriginalPanelContent(container.innerHTML);
      }
    }
  }

  // 绑定自定义面板内的卡片点击事件（事件委托）
  const customPanel = document.querySelector('.claw-custom-panel');
  if (customPanel && !customPanel.dataset.clawEventsBound) {
    customPanel.dataset.clawEventsBound = 'true';
    customPanel.addEventListener('click', (e) => {
      const menuItem = e.target.closest('.claw-echomem-menu-item');
      if (menuItem) {
        const panelName = menuItem.dataset.panel;
        if (panelName) {
          navigateToEchoMemPanel(panelName);
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
  }

  // 绑定输入联想开关按钮事件
  bindToggleButton(handleInputAssociationToggle);
});

// 启动观察
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// 初始尝试添加按钮
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addCustomButtons);
} else {
  addCustomButtons();
}

// 监听来自 popup 或 background 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 预留消息处理接口，用于后续扩展
  return true;
});
