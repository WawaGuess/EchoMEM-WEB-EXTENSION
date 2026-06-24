// 全局悬浮提示（深色玻璃态）
// 用于替换 alert / inline banner，样式与认知图谱 tooltip 保持一致

export function showFloatingToast(message, type = 'success', duration = 2500) {
  let toast = document.getElementById('echomem-floating-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'echomem-floating-toast';
    toast.style.cssText = `
      position: fixed;
      left: 50%;
      bottom: 40px;
      transform: translateX(-50%) translateY(20px);
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      font-family: Roboto, 'Noto Sans SC', sans-serif;
      color: #fff;
      background: rgba(5, 7, 10, 0.88);
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 100000;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease, transform 0.2s ease;
    `;
    document.body.appendChild(toast);
  }

  const ACCENTS = {
    success: '#00e6ff',
    error: '#ff6b6b',
    info: '#667eea',
  };
  const ICONS = {
    success: '✅',
    error: '❌',
    info: '⏳',
  };

  const accent = ACCENTS[type] || ACCENTS.info;
  toast.style.borderColor = accent;
  toast.innerHTML = `<span style="color:${accent}; margin-right:6px;">${ICONS[type] || ICONS.info}</span>${message}`;

  clearTimeout(toast._hideTimer);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });

  if (duration > 0) {
    toast._hideTimer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(20px)';
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }
}
