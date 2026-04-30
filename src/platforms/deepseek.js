// DeepSeek 聊天平台配置

export const deepseekConfig = {
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
  buttonBar: {
    containerSelector: '._24fad49',
    validateSelectors: {
      textarea: 'textarea[placeholder*="DeepSeek"]'
    },
    insertAfter: '._020ab5b',
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
      padding: '8px 12px',
      borderTop: '1px solid #e0e0e0',
      alignItems: 'center',
      flexWrap: 'wrap'
    },
    insertPosition: 'after'
  },
  panel: {
    type: 'overlay',
    containerSelector: null,
    overlayConfig: {
      position: 'right',
      width: '400px',
      backdrop: true
    }
  },
  buttons: [
    { text: '资源管理', panel: '资源管理' },
    { text: '输入联想', panel: '输入联想' },
    { text: '认知反馈', panel: '认知反馈' },
    { text: 'skill商店', panel: 'skill商店' }
  ]
};
