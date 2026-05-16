// button-svg-poll：按钮图标特征轮询策略
//
// 适用于：发送按钮在流式中切换图标的平台（如 DeepSeek 的箭头 ↔ 正方形）。
//
// 全部参数化，平台只需在 platforms.json 中声明：
//   {
//     "strategy": "button-svg-poll",
//     "params": {
//       "anchorSelector": "textarea",
//       "anchorParents": ["closest:form", "closest:[class*=chat]", "parent:2", "parent:3"],
//       "buttonSelector": ".ds-icon-button--l[role='button']",
//       "iconSelector": "svg path",
//       "iconAttr": "d",
//       "streamingMatch": "startsWith:M2 4.88",
//       "idleMatch":      "startsWith:M8.3125",
//       "pollIntervalMs": 500,
//       "timeoutMs": 60000
//     }
//   }
//
// 匹配规则支持："startsWith:xxx" / "equals:xxx" / "contains:xxx" / "regex:^pattern"
// anchorParents 支持："closest:<selector>" 或 "parent:<N>"（向上 N 层）

function matchRule(value, rule) {
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

function resolveAnchorParents(anchor, rules) {
  const result = [];
  for (const rule of rules || []) {
    if (typeof rule !== 'string') continue;
    const idx = rule.indexOf(':');
    if (idx === -1) continue;
    const op = rule.slice(0, idx);
    const arg = rule.slice(idx + 1);
    try {
      if (op === 'closest') {
        const c = anchor.closest(arg);
        if (c) result.push(c);
      } else if (op === 'parent') {
        const n = parseInt(arg, 10);
        let p = anchor;
        for (let i = 0; i < n && p; i++) p = p.parentElement;
        if (p) result.push(p);
      }
    } catch {
      // ignore
    }
  }
  return result;
}

export function createButtonSvgPollDetector(params = {}) {
  const {
    anchorSelector = null,
    anchorParents = [],
    buttonSelector,
    iconSelector = 'svg path',
    iconAttr = 'd',
    streamingMatch = null,
    idleMatch = null,
    pollIntervalMs = 500,
    timeoutMs = 60000,
  } = params;

  function readIcon(btn) {
    try {
      const icon = btn.querySelector(iconSelector);
      if (!icon) return '';
      return icon.getAttribute(iconAttr) || '';
    } catch {
      return '';
    }
  }

  function isCandidate(btn) {
    const v = readIcon(btn);
    return matchRule(v, streamingMatch) || matchRule(v, idleMatch);
  }

  function findButton() {
    if (!buttonSelector) return null;

    // 优先按 anchor 邻近搜索（更稳定，避免页面其它角落的同名按钮）
    if (anchorSelector) {
      const anchor = document.querySelector(anchorSelector);
      if (anchor) {
        const containers = resolveAnchorParents(anchor, anchorParents);
        for (const c of containers) {
          let btns;
          try {
            btns = c.querySelectorAll(buttonSelector);
          } catch {
            continue;
          }
          for (const btn of btns) {
            if (isCandidate(btn)) return btn;
          }
        }
      }
    }

    // 兜底：全文档搜索，取最下方的候选
    let all;
    try {
      all = document.querySelectorAll(buttonSelector);
    } catch {
      return null;
    }
    const candidates = [];
    for (const btn of all) {
      if (isCandidate(btn)) {
        candidates.push({ btn, top: btn.getBoundingClientRect().top });
      }
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.top - a.top);
    return candidates[0].btn;
  }

  function isStreaming() {
    const btn = findButton();
    if (!btn) return false;
    return matchRule(readIcon(btn), streamingMatch);
  }

  let pollTimer = null;
  let timeoutTimer = null;
  let wasStreaming = false;
  let fired = false;
  let onCompleteRef = null;

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
      // 重置一次性状态，允许 stop 后再次 start
      fired = false;
      wasStreaming = false;
      onCompleteRef = onComplete;
      cleanup();

      // 启动时已经处于 idle → 直接完成
      if (!isStreaming()) {
        console.log('EchoMem: streaming already finished at start, firing immediately');
        // 用微任务延后，让调用方有机会先 return
        Promise.resolve().then(fire);
        return;
      }

      wasStreaming = true;

      timeoutTimer = setTimeout(() => {
        console.log('EchoMem: streaming check timeout, forcing complete');
        fire();
      }, timeoutMs);

      pollTimer = setInterval(() => {
        if (fired) return;
        const streaming = isStreaming();
        if (streaming) {
          wasStreaming = true;
        } else if (wasStreaming) {
          console.log('EchoMem: streaming finished (button back to idle icon)');
          fire();
        }
      }, pollIntervalMs);
    },

    stop() {
      fired = true; // 阻止 cleanup 之后还回调
      onCompleteRef = null;
      cleanup();
    },
  };
}
