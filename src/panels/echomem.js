import { getCurrentPlatform } from '../core/detection.js';

export function getEchoMemMenuItems() {
  const platform = getCurrentPlatform();
  return platform?.config?.menuItems || [
    { text: '资源管理', panel: '资源管理', description: '管理文件资源与上传内容' },
    { text: '输入联想', panel: '输入联想', description: '开启或关闭智能联想' },
    { text: '认知反馈', panel: '认知反馈', description: '查看会话分析与反馈报告' },
    { text: 'skill商店', panel: 'skill商店', description: '浏览、上传、安装 Skill' },
    { text: '效能', panel: '效能', description: '查看使用效率与工作表现' }
  ];
}

export function getEchoMemHomeContent() {
  const colors = ['#2563eb', '#059669', '#7c3aed', '#d97706', '#dc2626'];
  const cards = getEchoMemMenuItems().map((item, index) => {
    const color = colors[index % colors.length];

    return `
      <button class="claw-echomem-menu-item" data-panel="${item.panel}" style="
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
