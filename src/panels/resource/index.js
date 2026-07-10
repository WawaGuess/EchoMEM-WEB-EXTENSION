// 资源管理面板首页

export function getResourceHomeContent() {
  const sections = [
    {
      id: 'import',
      title: '⬆️ 上传资源',
      desc: '上传本地文件并浏览已导入的资源',
      color: '#2563eb'
    },
    {
      id: 'query',
      title: '🔍 查询资源',
      desc: '按 session、resource id、tag、metadata 搜索资源',
      color: '#059669'
    }
  ];

  const cards = sections.map(s => `
    <div class="claw-resource-section" data-resource-section="${s.id}" style="
      padding: 16px;
      border: 1px solid #e0e0e0;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 12px;
    " onmouseenter="this.style.borderColor='${s.color}';this.style.background='#fafafa';this.style.transform='translateX(4px)'"
       onmouseleave="this.style.borderColor='#e0e0e0';this.style.background='none';this.style.transform='none'"
    >
      <div style="
        width: 40px;
        height: 40px;
        border-radius: 10px;
        background: ${s.color}15;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        flex-shrink: 0;
      ">${s.title.split(' ')[0]}</div>
      <div style="flex: 1;">
        <p style="font-weight: 600; color: #333; font-size: 14px; margin-bottom: 2px;">${s.title.split(' ').slice(1).join(' ')}</p>
        <p style="font-size: 12px; color: #888;">${s.desc}</p>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    </div>
  `).join('');

  return `
    <div style="display: flex; flex-direction: column; gap: 10px;">
      ${cards}
    </div>
  `;
}
