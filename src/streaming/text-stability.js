// text-stability：文本稳定即视为流式完成
//
// 适用于：没有发送按钮状态指示器、只能通过观察消息文本变化判断的平台。
//
// 参数：
//   {
//     "targetSelector": "[data-message-role='assistant']:last-of-type"
//       // 监视哪个元素的 textContent。可选：默认为整个 messageContainer 的最后一个子元素。
//     "stableMs": 1500,       // 文本连续 stableMs 毫秒不变即认为完成
//     "pollIntervalMs": 300,
//     "timeoutMs": 60000
//   }

export function createTextStabilityDetector(params = {}) {
  const {
    targetSelector = null,
    stableMs = 1500,
    pollIntervalMs = 300,
    timeoutMs = 60000,
  } = params;

  let pollTimer = null;
  let timeoutTimer = null;
  let lastText = '';
  let lastChangeAt = 0;
  let fired = false;
  let onCompleteRef = null;

  function readText() {
    if (!targetSelector) return document.body.textContent || '';
    try {
      const el = document.querySelector(targetSelector);
      return el ? el.textContent || '' : '';
    } catch {
      return '';
    }
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
      onCompleteRef = onComplete;
      cleanup();

      lastText = readText();
      lastChangeAt = Date.now();

      timeoutTimer = setTimeout(() => {
        console.log('EchoMem: text-stability timeout, forcing complete');
        fire();
      }, timeoutMs);

      pollTimer = setInterval(() => {
        if (fired) return;
        const cur = readText();
        if (cur !== lastText) {
          lastText = cur;
          lastChangeAt = Date.now();
          return;
        }
        if (Date.now() - lastChangeAt >= stableMs) {
          console.log('EchoMem: text stable for', stableMs, 'ms, marking complete');
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
