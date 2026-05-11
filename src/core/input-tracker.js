// 输入框监听与联想触发（OpenViking 记忆召回）

import { getAssociationEnabled } from './state.js';
import { createClient } from '../services/openviking-client.js';
import { getOpenVikingConfig } from '../services/config.js';
import { renderCompletions, hideSuggestions, bindKeyboardNavigation, shouldSuppressBlurClose } from '../panels/association/suggestions.js';
import { generateCompletions } from './completion-engine.js';

let client = null;
let debounceTimer = null;
let trackingPlatformConfig = null;
let keyboardNavBound = false;

async function getClient() {
  if (!client) {
    const config = await getOpenVikingConfig();
    client = createClient(config);
  }
  return client;
}

export function resetClient() {
  client = null;
}

export function startInputTracking(platformConfig) {
  trackingPlatformConfig = platformConfig;
  tryBindInputElement();
}

export function tryBindInputElement() {
  if (!trackingPlatformConfig) return;

  const textarea = findInputElement(trackingPlatformConfig);
  if (!textarea) {
    console.log('EchoMem: input element not found, will retry on next DOM change');
    return;
  }

  if (textarea.dataset.echomemTracking) return;
  textarea.dataset.echomemTracking = 'true';

  console.log('EchoMem: input tracking started on', textarea);

  // 绑定键盘导航（只绑定一次）
  if (!keyboardNavBound) {
    bindKeyboardNavigation(textarea);
    keyboardNavBound = true;
  }

  textarea.addEventListener('input', (e) => {
    if (!getAssociationEnabled()) {
      hideSuggestions();
      return;
    }

    // 忽略程序触发的事件（如 composeAndInsert 手动 dispatch 的 input），
    // 避免点击确定后浮层关闭又立即重新出现
    if (!e.isTrusted) return;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const text = e.target.value.trim();
      if (text.length >= 3) {
        try {
          await handleInput(textarea, text);
        } catch (err) {
          console.warn('EchoMem: recall failed', err);
          hideSuggestions();
        }
      } else {
        hideSuggestions();
      }
    }, 300);
  });

  textarea.addEventListener('blur', () => {
    // 浮层内按下时抑制本次关闭，避免点击 checkbox/按钮触发 textarea blur 后浮层消失
    setTimeout(() => {
      if (shouldSuppressBlurClose()) return;
      // 若焦点已经回到浮层内部（例如点击按钮），也不关闭
      const active = document.activeElement;
      const container = document.getElementById('echomem-suggestions');
      if (container && active && container.contains(active)) return;
      hideSuggestions();
    }, 200);
  });
}

/**
 * 处理用户输入：OpenViking 记忆召回 + 补全生成
 */
async function handleInput(textarea, userInput) {
  // 1. OpenViking 历史记忆召回
  let memories = [];
  try {
    const ovClient = await getClient();
    console.log('EchoMem: recall triggered, query=', userInput);
    const result = await ovClient.find(userInput, { limit: 5 });
    memories = result.memories || [];
    console.log('EchoMem: found', memories.length, 'memories');
    if (memories.length > 0) {
      console.log('EchoMem: first memory keys', Object.keys(memories[0]));
      console.log('EchoMem: first memory overview', memories[0].overview ? 'present' : 'missing');
    }
  } catch (err) {
    console.warn('EchoMem: OpenViking recall failed', err);
    hideSuggestions();
    return;
  }

  // 2. 如果没有记忆结果，隐藏浮层
  if (!memories.length) {
    hideSuggestions();
    return;
  }

  // 3. 本地补全引擎生成建议
  const completions = await generateCompletions(userInput, memories, 3);
  console.log('EchoMem: generated', completions.length, 'completions');

  if (completions.length > 0) {
    renderCompletions(textarea, completions);
  } else {
    hideSuggestions();
  }
}

function findInputElement(platformConfig) {
  const selector = platformConfig.launcher?.validateSelectors?.textarea;
  if (!selector) return null;
  return document.querySelector(selector);
}
