import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPerformanceState,
  updatePerformanceDOM,
} from '../src/panels/performance/view-state.js';

function createFakeElement(children = {}) {
  const classes = new Set();
  return {
    textContent: '',
    hidden: false,
    style: {},
    classList: {
      contains(name) { return classes.has(name); },
      toggle(name, enabled) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
    },
    querySelector(selector) { return children[selector] || null; },
  };
}

function createPerformanceRoot() {
  const title = createFakeElement();
  const detail = createFakeElement();
  const notice = createFakeElement({
    '#perf-session-notice-title': title,
    '#perf-session-notice-detail': detail,
  });
  notice.hidden = true;

  const elements = {
    '#perf-total': createFakeElement(),
    '#perf-total-status': createFakeElement(),
    '#perf-sessions': createFakeElement(),
    '#perf-sessions-status': createFakeElement(),
    '#perf-turns': createFakeElement(),
    '#perf-turns-status': createFakeElement(),
    '#perf-input': createFakeElement(),
    '#perf-input-status': createFakeElement(),
    '#perf-output': createFakeElement(),
    '#perf-output-status': createFakeElement(),
    '#perf-backend': createFakeElement(),
    '#perf-backend-status': createFakeElement(),
    '#perf-desc': createFakeElement(),
    '#perf-session-notice': notice,
  };

  return {
    elements,
    title,
    detail,
    querySelector(selector) { return elements[selector] || null; },
  };
}

test('unsupported HIGO session stats stay unavailable instead of becoming zero', () => {
  const state = buildPerformanceState({
    showSessionStats: true,
    statsResult: {
      status: 'rejected',
      reason: new Error('当前 EchoAgent 服务暂不支持会话统计汇总'),
    },
    usageResult: { status: 'fulfilled', value: 4500 },
  });

  assert.equal(state.sessionStatus, 'unavailable');
  assert.equal(state.backendStatus, 'available');
  assert.equal(state.totalSessions, null);
  assert.equal(state.totalTurns, null);
  assert.equal(state.totalInputTokens, null);
  assert.equal(state.totalOutputTokens, null);
  assert.equal(state.sessionTokens, null);
  assert.equal(state.backendTokens, 4500);
  assert.equal(state.totalTokens, null);
  assert.equal(state.since, null);
});

test('successful zero values remain distinguishable from unavailable data', () => {
  const state = buildPerformanceState({
    showSessionStats: true,
    statsResult: {
      status: 'fulfilled',
      value: {
        totalSessions: 0,
        totalTurns: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        since: '2026-08-06T00:00:00.000Z',
      },
    },
    usageResult: { status: 'fulfilled', value: 0 },
  });

  assert.equal(state.sessionStatus, 'available');
  assert.equal(state.backendStatus, 'available');
  assert.equal(state.totalSessions, 0);
  assert.equal(state.totalTurns, 0);
  assert.equal(state.totalInputTokens, 0);
  assert.equal(state.totalOutputTokens, 0);
  assert.equal(state.sessionTokens, 0);
  assert.equal(state.backendTokens, 0);
  assert.equal(state.totalTokens, 0);
  assert.equal(state.since, '2026-08-06T00:00:00.000Z');
});

test('non-HIGO platforms hide session state and preserve backend failures', () => {
  const state = buildPerformanceState({
    showSessionStats: false,
    statsResult: { status: 'fulfilled', value: null },
    usageResult: { status: 'rejected', reason: new Error('network error') },
  });

  assert.equal(state.sessionStatus, 'hidden');
  assert.equal(state.backendStatus, 'error');
  assert.equal(state.backendTokens, null);
  assert.equal(state.totalTokens, null);
});

test('unexpected HIGO session failures use the retryable error state', () => {
  const state = buildPerformanceState({
    showSessionStats: true,
    statsResult: { status: 'rejected', reason: new Error('network error') },
    usageResult: { status: 'fulfilled', value: 12 },
  });

  assert.equal(state.sessionStatus, 'error');
  assert.equal(state.totalSessions, null);
  assert.equal(state.backendTokens, 12);
  assert.equal(state.totalTokens, null);
});

test('HIGO unavailable state renders dashes and an explanatory notice', () => {
  const state = buildPerformanceState({
    showSessionStats: true,
    statsResult: {
      status: 'rejected',
      reason: new Error('当前 EchoAgent 服务暂不支持会话统计汇总'),
    },
    usageResult: { status: 'fulfilled', value: 4500 },
  });
  const root = createPerformanceRoot();

  updatePerformanceDOM(root, state, true);

  assert.equal(root.elements['#perf-total'].textContent, '—');
  assert.equal(root.elements['#perf-total-status'].textContent, '缺少会话统计，暂无法计算');
  assert.equal(root.elements['#perf-sessions'].textContent, '—');
  assert.equal(root.elements['#perf-sessions-status'].textContent, '暂不可用');
  assert.equal(root.elements['#perf-input-status'].textContent, '暂不可用');
  assert.equal(root.elements['#perf-backend'].textContent, '4,500');
  assert.equal(root.elements['#perf-backend-status'].textContent, 'tokens');
  assert.equal(root.elements['#perf-session-notice'].hidden, false);
  assert.equal(root.title.textContent, '会话统计暂不可用');
  assert.equal(root.detail.textContent, 'EchoAgent 当前未提供会话汇总数据。');
  assert.match(root.elements['#perf-desc'].textContent, /无法计算完整总量/);
});
