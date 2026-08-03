// 资源管理面板首页

export function getResourceHomeContent() {
  const sections = [
    {
      id: 'import',
      title: '资源导入',
      desc: '上传本地文件或通过 URL 添加资源',
      color: '#6750A4',
      surface: '#F4EEFF',
      icon: '<path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />'
    },
    {
      id: 'manage',
      title: '查看资源',
      desc: '浏览、预览和删除已导入的资源',
      color: '#625B71',
      surface: '#F3EDF7',
      icon: '<path d="M4 6.5h16M4 12h16M4 17.5h10M7 4v5M7 9v11" />'
    }
  ];

  const cards = sections.map(s => `
    <div class="claw-resource-section" data-resource-section="${s.id}" style="
      padding: 16px 14px;
      border: 1px solid #E7E0EC;
      border-radius: 16px;
      background: #FFFFFF;
      cursor: pointer;
      transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
      display: flex;
      align-items: center;
      gap: 12px;
    " onmouseenter="this.style.borderColor='${s.color}';this.style.background='${s.surface}';this.style.transform='translateY(-1px)'"
       onmouseleave="this.style.borderColor='#E7E0EC';this.style.background='#FFFFFF';this.style.transform='none'"
    >
      <div class="claw-resource-section-icon" style="
        width: 42px;
        height: 42px;
        border-radius: 14px;
        background: ${s.surface};
        color: ${s.color};
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      ">
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${s.icon}</svg>
      </div>
      <div style="flex: 1; min-width: 0;">
        <p style="font-weight: 600; color: #1D1B20; font-size: 14px; line-height: 1.45; margin: 0 0 3px;">${s.title}</p>
        <p style="font-size: 12px; line-height: 1.55; color: #625F66; margin: 0;">${s.desc}</p>
      </div>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#79747E" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    </div>
  `).join('');

  return `
    <style>
      .claw-resource-home {
        display: flex;
        flex-direction: column;
        gap: 10px;
        color: #1D1B20;
        font-family: Roboto, "Noto Sans SC", sans-serif;
      }
      .claw-resource-home .claw-resource-section {
        box-sizing: border-box;
        box-shadow: 0 1px 2px rgba(29, 27, 32, 0.05);
      }
      .claw-resource-home .claw-resource-section:hover {
        box-shadow: 0 6px 18px rgba(103, 80, 164, 0.12);
      }
      .claw-resource-home .claw-resource-section:focus-visible {
        outline: 3px solid rgba(103, 80, 164, 0.22);
        outline-offset: 2px;
      }
      @media (max-width: 360px) {
        .claw-resource-home .claw-resource-section {
          padding: 14px 12px !important;
          gap: 10px !important;
        }
        .claw-resource-home .claw-resource-section-icon {
          width: 38px !important;
          height: 38px !important;
          border-radius: 12px !important;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .claw-resource-home .claw-resource-section { transition: none !important; }
      }
    </style>
    <div class="claw-resource-home">
      ${cards}
    </div>
  `;
}
