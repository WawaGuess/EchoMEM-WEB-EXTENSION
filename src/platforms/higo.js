// HIGO Office 平台配置

export const higoConfig = {
  id: 'higo',
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
  panelHost: {
    type: 'sidebar',
    containerSelector: '.MuiDrawer-anchorRight .MuiDrawer-paper',
    overlayConfig: null
  },
  menuItems: [
    { panelId: 'resources' },
    { panelId: 'association' },
    { panelId: 'feedback' },
    { panelId: 'skillStore' },
    { panelId: 'performance' }
  ]
};
