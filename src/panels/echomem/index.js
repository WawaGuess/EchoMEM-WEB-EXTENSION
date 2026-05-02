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

export function getEchoMemHomeContent() {
  const colors = ['#2563eb', '#059669', '#7c3aed', '#d97706', '#dc2626'];
  const cards = getEchoMemMenuItems().map((item, index) => {
    const color = colors[index % colors.length];

    return `
      <button class="claw-echomem-menu-item" data-panel-id="${item.panelId}" data-panel="${item.panelId}" style="
        width: 100%;
        padding: 14px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        background: #fff;
        cursor: pointer;
        text-align: left;
        display: flex;
        align-items: center;
        gap: 12px;
        transition: all 0.2s;
      " onmouseenter="this.style.borderColor='${color}';this.style.background='#f9fafb';this.style.transform='translateX(3px)'" onmouseleave="this.style.borderColor='#e5e7eb';this.style.background='#fff';this.style.transform='none'">
        <span style="
          width: 10px;
          height: 32px;
          border-radius: 999px;
          background: ${color};
          flex-shrink: 0;
        "></span>
        <span style="display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1;">
          <span style="font-size: 14px; font-weight: 600; color: #111827;">${item.text}</span>
          <span style="font-size: 12px; color: #6b7280; line-height: 1.45;">${item.description}</span>
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
    `;
  }).join('');

  return `
    <div style="display: flex; flex-direction: column; gap: 10px;">
      ${cards}
    </div>
  `;
}
