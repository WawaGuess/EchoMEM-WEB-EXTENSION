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
  messages: {
    // 聊天消息 DOM 选择器（多候选，按优先级排序）
    // HIGO 使用 MUI 组件，消息通常在滚动容器内
    messageContainers: [
      // 常见消息列表容器
      '[class*="MessageList"]',
      '[class*="message-list"]',
      '[class*="chat-messages"]',
      '[class*="conversation"]',
      // MUI 滚动容器
      '.MuiPaper-root > .MuiList-root',
      '.MuiDrawer-paper > div > div',
      // 更宽泛的兜底
      '.MuiPaper-root'
    ],
    userMessages: [
      // HIGO 通常通过布局区分用户/AI，右侧为用户
      '[class*="UserMessage"]',
      '[class*="user-message"]',
      '[class*="user"]',
      // 通过 align-items: flex-end 等样式特征
      '[style*="flex-end"]'
    ],
    assistantMessages: [
      '[class*="AssistantMessage"]',
      '[class*="assistant-message"]',
      '[class*="assistant"]',
      '[class*="bot-message"]',
      '[class*="ai-message"]'
    ],
    allMessages: [
      // 兜底：所有包含文本的 div
      'div[class*="Mui"]',
      'div'
    ]
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
