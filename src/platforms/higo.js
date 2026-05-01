// HIGO Office 平台配置

export const higoConfig = {
  name: 'HIGO Office',
  detection: {
    urlPatterns: ['/home/session/', '/home/workspace/'],
    titleKeywords: ['Higo', 'HIGO', 'Higo2', 'Higo Office'],
    domFeatures: {
      required: [
        { selector: '.MuiDrawer-root', description: 'MUI 抽屉组件' },
        { selector: '.MuiPaper-root', description: 'MUI Paper 容器' }
      ],
      optional: [
        { selector: 'textarea[id^="_r_"]', description: 'React 输入框' },
        { selector: '[data-testid="ArrowUpwardIcon"]', description: '发送按钮图标' },
        { selector: '.MuiDrawer-anchorRight', description: '右侧抽屉' }
      ]
    },
    contentKeywords: ['higo', 'HIGO', 'Higo2']
  },
  launcher: {
    text: 'EchoMem',
    containerSelector: '.MuiPaper-root',
    validateSelectors: {
      textarea: 'textarea[id^="_r_"]',
      sendButton: '[data-testid="ArrowUpwardIcon"]'
    },
    style: {
      display: 'flex',
      gap: '8px',
      padding: '0 12px 8px',
      background: 'rgb(255, 251, 254)',
      alignItems: 'center',
      justifyContent: 'flex-start'
    },
    insertPosition: 'before'
  },
  panel: {
    type: 'sidebar',
    containerSelector: '.MuiDrawer-anchorRight .MuiDrawer-paper',
    overlayConfig: null
  },
  menuItems: [
    { text: '资源管理', panel: '资源管理', description: '管理文件资源与上传内容' },
    { text: '输入联想', panel: '输入联想', description: '开启或关闭智能联想' },
    { text: '认知反馈', panel: '认知反馈', description: '查看会话分析与反馈报告' },
    { text: 'skill商店', panel: 'skill商店', description: '浏览、上传、安装 Skill' },
    { text: '效能', panel: '效能', description: '查看使用效率与工作表现' }
  ]
};
