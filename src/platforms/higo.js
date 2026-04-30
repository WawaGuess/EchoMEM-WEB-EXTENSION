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
  buttonBar: {
    containerSelector: '.MuiPaper-root',
    validateSelectors: {
      textarea: 'textarea[id^="_r_"]',
      sendButton: '[data-testid="ArrowUpwardIcon"]'
    },
    style: {
      display: 'flex',
      gap: '8px',
      padding: '8px 12px',
      borderTop: '1px solid #e0e0e0',
      background: 'rgb(255, 251, 254)',
      alignItems: 'center',
      flexWrap: 'wrap'
    },
    insertPosition: 'after'
  },
  panel: {
    type: 'sidebar',
    containerSelector: '.MuiDrawer-anchorRight .MuiDrawer-paper',
    overlayConfig: null
  },
  buttons: [
    { text: '资源管理', panel: '资源管理' },
    { text: '输入联想', panel: '输入联想' },
    { text: '认知反馈', panel: '认知反馈' },
    { text: 'skill商店', panel: 'skill商店' }
  ]
};
