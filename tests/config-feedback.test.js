import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getConnectionTestErrorFeedback,
  updateConnectionTestFeedback,
} from '../src/panels/echomem/config-feedback.js';

function createClassList() {
  const values = new Set();
  return {
    contains(name) { return values.has(name); },
    add(name) { values.add(name); },
    remove(name) { values.delete(name); },
    toggle(name, enabled) {
      if (enabled) values.add(name);
      else values.delete(name);
    },
  };
}

function createElement(id = '') {
  const attributes = new Map();
  return {
    id,
    hidden: false,
    disabled: false,
    dataset: {},
    textContent: '',
    classList: createClassList(),
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name) || null; },
    removeAttribute(name) { attributes.delete(name); },
  };
}

function createFeedbackElements() {
  return {
    statusElement: createElement('cfg-test-status'),
    titleElement: createElement(),
    detailElement: createElement(),
    testButton: createElement('cfg-test-btn'),
    testButtonLabel: createElement('cfg-test-btn-label'),
  };
}

test('testing state stays inside the panel and disables repeated tests', () => {
  const elements = createFeedbackElements();

  updateConnectionTestFeedback(elements, 'testing');

  assert.equal(elements.statusElement.hidden, false);
  assert.equal(elements.statusElement.dataset.state, 'testing');
  assert.equal(elements.titleElement.textContent, '正在测试连接');
  assert.equal(elements.testButton.disabled, true);
  assert.equal(elements.testButton.getAttribute('aria-busy'), 'true');
  assert.equal(elements.testButton.getAttribute('aria-describedby'), 'cfg-test-status');
  assert.equal(elements.testButtonLabel.textContent, '正在连接…');
  assert.equal(elements.testButton.classList.contains('is-loading'), true);
});

test('success and dirty states keep actionable feedback visible', () => {
  const elements = createFeedbackElements();

  updateConnectionTestFeedback(elements, 'success');
  assert.equal(elements.statusElement.dataset.state, 'success');
  assert.equal(elements.titleElement.textContent, '连接成功');
  assert.equal(elements.testButton.disabled, false);

  updateConnectionTestFeedback(elements, 'dirty');
  assert.equal(elements.statusElement.hidden, false);
  assert.equal(elements.statusElement.dataset.state, 'dirty');
  assert.equal(elements.titleElement.textContent, '配置已修改');
  assert.match(elements.detailElement.textContent, /重新测试连接/);
});

test('connection errors are mapped to safe recovery guidance', () => {
  assert.deepEqual(getConnectionTestErrorFeedback({ name: 'AbortError' }), {
    title: '连接超时',
    detail: '服务未在预期时间内响应，请检查服务地址和运行状态。',
  });

  assert.deepEqual(getConnectionTestErrorFeedback({ status: 401 }), {
    title: '认证失败',
    detail: '请检查认证密钥是否正确，并确认当前密钥仍然有效。',
  });

  assert.deepEqual(getConnectionTestErrorFeedback(new Error('Failed to fetch')), {
    title: '无法连接到服务',
    detail: '请检查服务是否已启动，以及当前网络能否访问该地址。',
  });

  const fallback = getConnectionTestErrorFeedback(new Error('<img src=x onerror=alert(1)>'));
  assert.equal(fallback.title, '连接失败');
  assert.doesNotMatch(fallback.detail, /<img/);
});

