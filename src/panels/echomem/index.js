import { getCurrentPlatform } from '../../core/detection.js';
import { getPanelDefinition } from '../registry.js';

export function getEchoMemMenuItems() {
  const platform = getCurrentPlatform();
  const menuItems = platform?.config?.menuItems || [
    { panelId: 'resources' },
    { panelId: 'association' },
    { panelId: 'feedback' },
    { panelId: 'skillStore' },
    { panelId: 'performance' }
  ];

  return menuItems
    .map((item) => {
      const panelId = item.panelId || item.panel;
      const panel = getPanelDefinition(panelId);

      if (!panel) return null;

      return {
        panelId: panel.id,
        text: item.text || panel.title,
        description: item.description || panel.description
      };
    })
    .filter(Boolean);
}

const CARD_STYLE = `width: 100%; padding: 16px 18px; margin-bottom: 10px; border-radius: 20px; border: 1px solid rgba(58, 47, 40, 0.06); background: rgba(255, 255, 255, 0.5); backdrop-filter: blur(12px); cursor: pointer; text-align: left; display: flex; align-items: center; gap: 14px; transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1); position: relative; overflow: hidden;`;

function buildHoverEvents(style) {
  const enter = `this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 30px ${style.shadow}, 0 2px 8px rgba(0,0,0,0.04)';this.style.borderColor='rgba(58, 47, 40, 0.1)';var d=this.querySelector('.droplet');if(d)d.style.transform='scale(1.08) rotate(-5deg)';var a=this.querySelector('.arrow');if(a){a.style.color='${style.accent}';a.style.transform='translateX(4px)';}`;
  const leave = `this.style.transform='none';this.style.boxShadow='none';this.style.borderColor='rgba(58, 47, 40, 0.06)';var d=this.querySelector('.droplet');if(d)d.style.transform='none';var a=this.querySelector('.arrow');if(a){a.style.color='#c4b8a8';a.style.transform='none';}`;
  return `onmouseenter="${enter}" onmouseleave="${leave}"`;
}

function buildCardBody(text, description, style) {
  return `
    <span class="droplet" style="
      width: 42px; height: 42px;
      border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
      flex-shrink: 0; display: flex; align-items: center; justify-content: center;
      background: ${style.gradient};
      transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
      color: #fff;
    ">${style.icon}</span>
    <span style="display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1;">
      <span style="font-size: 14px; font-weight: 600; color: #3a2f28; font-family: Roboto, 'Noto Sans SC', sans-serif; letter-spacing: -0.01em;">${text}</span>
      <span style="font-size: 12px; color: #9a8b7a; font-family: Roboto, 'Noto Sans SC', sans-serif; line-height: 1.5;">${description}</span>
    </span>
    <svg class="arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; color: #c4b8a8; transition: all 0.4s ease;">
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  `;
}

export function getEchoMemHomeContent() {
  const panelStyles = {
    resources: {
      gradient: 'linear-gradient(135deg, #8ab0c8 0%, #6a90a8 100%)',
      shadow: 'rgba(122, 158, 181, 0.15)',
      accent: '#5a7e95',
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`
    },
    association: {
      gradient: 'linear-gradient(135deg, #8ac89a 0%, #6aa87a 100%)',
      shadow: 'rgba(122, 176, 138, 0.15)',
      accent: '#5a906a',
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`
    },
    feedback: {
      gradient: 'linear-gradient(135deg, #b0a0c8 0%, #9080a8 100%)',
      shadow: 'rgba(160, 144, 184, 0.15)',
      accent: '#807098',
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`
    },
    skillStore: {
      gradient: 'linear-gradient(135deg, #d8b87a 0%, #b8985a 100%)',
      shadow: 'rgba(200, 168, 106, 0.15)',
      accent: '#a8884a',
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`
    },
    performance: {
      gradient: 'linear-gradient(135deg, #d89888 0%, #b87868 100%)',
      shadow: 'rgba(200, 136, 120, 0.15)',
      accent: '#a86858',
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`
    }
  };

  const configStyle = {
    gradient: 'linear-gradient(135deg, #c8a8d0 0%, #a888b0 100%)',
    shadow: 'rgba(184, 152, 192, 0.15)',
    accent: '#9878a0',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`
  };

  const cards = getEchoMemMenuItems().map((item) => {
    const style = panelStyles[item.panelId] || panelStyles.resources;
    return `
      <button class="claw-echomem-menu-item" data-panel-id="${item.panelId}" data-panel="${item.panelId}" style="${CARD_STYLE}" ${buildHoverEvents(style)}>
        ${buildCardBody(item.text, item.description, style)}
      </button>
    `;
  }).join('');

  const configCard = `
    <div class="claw-config-section" data-config="echomem" style="${CARD_STYLE} margin-top: 8px;" ${buildHoverEvents(configStyle)}>
      ${buildCardBody('后端连接配置', '配置后端地址、API Key 和认证信息', configStyle)}
    </div>
  `;

  return `<div style="display: flex; flex-direction: column;">${cards}${configCard}</div>`;
}
