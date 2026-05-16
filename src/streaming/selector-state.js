// selector-state：监听某个元素的属性 / class 状态变化
//
// 适用于：平台用 data-* 属性或 class 标识"流式中"（如 ChatGPT 的 data-message-streaming）。
//
// 参数：
//   {
//     "targetSelector": "[data-message-streaming]",
//        // 监视的元素。注意：如果元素在流式开始后才挂载，detector 内部会做轮询查找。
//     "streamingMatch": { "attr": "data-streaming", "rule": "equals:true" }
//        // 或 { "class": "is-streaming", "present": true }
//     "idleMatch": { "attr": "data-streaming", "rule": "equals:false" },
//     "pollIntervalMs": 300,
//     "timeoutMs": 60000
//   }

function evalRule(value, rule) {
  if (!rule) return false;
  const idx = rule.indexOf(':');
  if (idx === -1) return value === rule;
  const op = rule.slice(0, idx);
  const arg = rule.slice(idx + 1);
  switch (op) {
    case 'startsWith':
      return value.startsWith(arg);
    case 'equals':
      return value === arg;
    case 'contains':
      return value.includes(arg);
    case 'regex':
      try {
        return new RegExp(arg).test(value);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

function matches(el, match) {
  if (!el || !match) return false;
  if (match.attr) {
    const v = el.getAttribute(match.attr) || '';
    return evalRule(v, match.rule);
  }
  if (match.class) {
    const has = el.classList?.contains(match.class) ?? false;
    return match.present === false ? !has : has;
  }
  return false;
}

export function createSelectorStateDetector(params = {}) {
  const {
    targetSelector,
    streamingMatch,
    idleMatch,
    pollIntervalMs = 300,
    timeoutMs = 60000,
  } = params;

  let pollTimer = null;
  let timeoutTimer = null;
  let wasStreaming = false;
  let fired = false;
  let onCompleteRef = null;

  function readState() {
    if (!targetSelector) return { streaming: false, idle: true };
    let el;
    try {
      el = document.querySelector(targetSelector);
    } catch {
      return { streaming: false, idle: false };
    }
    return {
      streaming: matches(el, streamingMatch),
      idle: matches(el, idleMatch),
    };
  }

  function fire() {
    if (fired) return;
    fired = true;
    cleanup();
    try {
      onCompleteRef && onCompleteRef();
    } catch (err) {
      console.warn('EchoMem: streaming onComplete threw', err);
    }
  }

  function cleanup() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
      timeoutTimer = null;
    }
  }

  return {
    start(onComplete) {
      fired = false;
      wasStreaming = false;
      onCompleteRef = onComplete;
      cleanup();

      const initial = readState();
      if (initial.idle && !initial.streaming) {
        Promise.resolve().then(fire);
        return;
      }
      if (initial.streaming) wasStreaming = true;

      timeoutTimer = setTimeout(() => fire(), timeoutMs);

      pollTimer = setInterval(() => {
        if (fired) return;
        const s = readState();
        if (s.streaming) {
          wasStreaming = true;
        } else if (wasStreaming && s.idle) {
          fire();
        }
      }, pollIntervalMs);
    },

    stop() {
      fired = true;
      onCompleteRef = null;
      cleanup();
    },
  };
}
