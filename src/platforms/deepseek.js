// DeepSeek 聊天平台配置

export const deepseekConfig = {
  id: 'deepseek',
  name: 'DeepSeek',
  detection: {
    urlPatterns: ['chat.deepseek.com'],
    titleKeywords: ['DeepSeek'],
    domFeatures: {
      required: [
        { selector: 'textarea[placeholder*="DeepSeek"]', description: 'DeepSeek 输入框' },
        { selector: '._24fad49', description: '输入框容器' }
      ],
      optional: [
        { selector: '._020ab5b', description: '底部按钮区域' },
        { selector: '[role="button"]', description: '功能按钮' }
      ]
    },
    contentKeywords: ['deepseek', '深度思考', '智能搜索']
  },
  launcher: {
    text: 'EchoMem',
    containerSelector: '._77cefa5, ._24fad49',
    validateSelectors: {
      textarea: 'textarea[placeholder*="DeepSeek"]'
    },
    getBackgroundColor: () => {
      const inputArea = document.querySelector('._77cefa5');
      if (inputArea) {
        const style = window.getComputedStyle(inputArea);
        if (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)') {
          return style.backgroundColor;
        }
      }
      return '#fff';
    },
    style: {
      display: 'flex',
      gap: '8px',
      padding: '0 12px 8px',
      alignItems: 'center',
      justifyContent: 'flex-start'
    },
    insertPosition: 'before'
  },
  messages: {
    messageContainers: [
      '.ds-chat-message-list',
      '[class*="chat-message-list"]',
      '[class*="ChatMessageList"]',
      'main > div > div'
    ],
    userMessages: [
      '.ds-chat-message-user',
      '[class*="message-user"]',
      '[class*="MessageUser"]'
    ],
    assistantMessages: [
      '.ds-chat-message-assistant',
      '[class*="message-assistant"]',
      '[class*="MessageAssistant"]'
    ],
    allMessages: [
      '[class*="chat-message"]',
      '[class*="ChatMessage"]'
    ]
  },
  panelHost: {
    type: 'overlay',
    containerSelector: null,
    overlayConfig: {
      position: 'right',
      width: '400px',
      backdrop: true
    }
  },
  menuItems: [
    { panelId: 'resources' },
    { panelId: 'association' },
    { panelId: 'feedback' },
    { panelId: 'skillStore' },
    { panelId: 'performance' }
  ]
};
