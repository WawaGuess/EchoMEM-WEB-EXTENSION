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

const CARD_STYLE = `width: 100%; min-height: 76px; padding: 14px 16px; margin: 0; border-radius: 12px; border: 1px solid rgba(121, 116, 126, 0.24); background: #FFFFFF; cursor: pointer; text-align: left; display: flex; align-items: center; gap: 14px; transition: background-color 200ms ease, border-color 200ms ease, box-shadow 200ms ease, transform 200ms ease; position: relative; overflow: hidden;`;

function buildHoverEvents(style) {
  const enter = `this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 18px ${style.shadow}';this.style.borderColor='rgba(103,80,164,0.42)';this.style.background='#FEF7FF';var d=this.querySelector('.droplet');if(d)d.style.transform='scale(1.04)';var a=this.querySelector('.arrow');if(a){a.style.color='${style.accent}';a.style.transform='translateX(2px)';}`;
  const leave = `this.style.transform='none';this.style.boxShadow='none';this.style.borderColor='rgba(121,116,126,0.24)';this.style.background='${style.cardBackground || '#FFFFFF'}';var d=this.querySelector('.droplet');if(d)d.style.transform='none';var a=this.querySelector('.arrow');if(a){a.style.color='#79747E';a.style.transform='none';}`;
  return `onmouseenter="${enter}" onmouseleave="${leave}"`;
}

function buildCardBody(text, description, style) {
  return `
    <span class="droplet claw-echomem-menu-icon" style="
      width: 44px; height: 44px;
      border-radius: 12px;
      flex-shrink: 0; display: flex; align-items: center; justify-content: center;
      background: ${style.gradient};
      transition: transform 200ms ease;
      color: ${style.iconColor || '#6750A4'};
    ">${style.icon}</span>
    <span class="claw-echomem-menu-copy" style="display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1;">
      <span class="claw-echomem-menu-title" style="font-size: 14px; font-weight: 500; color: #21005D; font-family: Roboto, 'Noto Sans SC', sans-serif; letter-spacing: -0.01em;">${text}</span>
      <span class="claw-echomem-menu-description" style="font-size: 12px; color: #49454F; font-family: Roboto, 'Noto Sans SC', sans-serif; line-height: 1.5;">${description}</span>
    </span>
    <svg class="arrow claw-echomem-menu-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; color: #79747E; transition: color 200ms ease, transform 200ms ease;">
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  `;
}

export function getEchoMemHomeContent() {
  const navigationStyle = {
    gradient: 'linear-gradient(135deg, #EADDFF 0%, #FEF7FF 100%)',
    shadow: 'rgba(33, 0, 93, 0.12)',
    accent: '#6750A4',
    iconColor: '#6750A4',
    cardBackground: '#FFFFFF'
  };

  const panelStyles = {
    resources: {
      ...navigationStyle,
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`
    },
    association: {
      ...navigationStyle,
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`
    },
    feedback: {
      ...navigationStyle,
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`
    },
    skillStore: {
      ...navigationStyle,
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`
    },
    performance: {
      ...navigationStyle,
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`
    }
  };

  const configStyle = {
    gradient: 'linear-gradient(135deg, #6750A4 0%, #21005D 100%)',
    shadow: 'rgba(33, 0, 93, 0.14)',
    accent: '#6750A4',
    iconColor: '#FFFFFF',
    cardBackground: '#FEF7FF',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`
  };

  const cards = getEchoMemMenuItems().map((item) => {
    const style = panelStyles[item.panelId] || panelStyles.resources;
    return `
      <button type="button" class="claw-echomem-menu-item" data-panel-id="${item.panelId}" data-panel="${item.panelId}" style="${CARD_STYLE} background: ${style.cardBackground};" ${buildHoverEvents(style)}>
        ${buildCardBody(item.text, item.description, style)}
      </button>
    `;
  }).join('');

  const configCard = `
    <button type="button" class="claw-config-section" data-config="echomem" style="${CARD_STYLE} background: ${configStyle.cardBackground};" ${buildHoverEvents(configStyle)}>
      ${buildCardBody('后端连接配置', '配置后端地址、API Key 和认证信息', configStyle)}
    </button>
  `;

  return `
    <div class="claw-echomem-home">
      <section class="claw-echomem-home-intro" aria-label="EchoMem 工作台">
        <span class="claw-echomem-home-eyebrow">ECHO MEMORY</span>
        <p>让记忆、资源与能力在当前对话中随时可用。</p>
      </section>
      <nav class="claw-echomem-home-nav" aria-label="EchoMem 功能导航">
        ${cards}
      </nav>
      <div class="claw-echomem-home-divider" aria-hidden="true">
        <span>连接设置</span>
      </div>
      <div class="claw-echomem-home-config">
        ${configCard}
      </div>
    </div>
  `;
}
