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
  panel: {
    type: 'overlay',
    containerSelector: null,
    overlayConfig: {
      position: 'right',
      width: '400px',
      backdrop: true
    }
  },
  menuItems: [
    { text: '资源管理', panel: '资源管理', description: '管理文件资源与上传内容' },
    { text: '输入联想', panel: '输入联想', description: '开启或关闭智能联想' },
    { text: '认知反馈', panel: '认知反馈', description: '查看会话分析与反馈报告' },
    { text: 'skill商店', panel: 'skill商店', description: '浏览、上传、安装 Skill' },
    { text: '效能', panel: '效能', description: '查看使用效率与工作表现' }
  ]
};
