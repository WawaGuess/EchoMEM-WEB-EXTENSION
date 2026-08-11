import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getConfigSaveErrorFeedback,
  getConnectionTestErrorFeedback,
  getEchoAgentLoginErrorFeedback,
  updateConfigActionFeedback,
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

function createAction(name, options = {}) {
  return {
    button: createElement(`cfg-${name}-btn`),
    labelElement: createElement(`cfg-${name}-btn-label`),
    idleLabel: options.idleLabel || name,
    busyLabel: options.busyLabel || `${name}中`,
    spinIcon: options.spinIcon || false,
  };
}

function createFeedbackElements(actionNames = ['test', 'save']) {
  const actions = {};
  actionNames.forEach((name) => {
    actions[name] = createAction(name, {
      idleLabel: name === 'test' ? '测试连接' : name === 'save' ? '保存配置' : '登录 EchoAgent',
      busyLabel: name === 'test' ? '正在连接…' : name === 'save' ? '正在保存…' : '正在登录…',
      spinIcon: name === 'test',
    });
  });

  return {
    statusElement: createElement('cfg-status'),
    titleElement: createElement(),
    detailElement: createElement(),
    actions,
  };
}

test('connection testing stays inside the card and prevents conflicting actions', () => {
  const elements = createFeedbackElements();

  updateConfigActionFeedback(elements, 'testing');

  assert.equal(elements.statusElement.hidden, false);
  assert.equal(elements.statusElement.dataset.state, 'testing');
  assert.equal(elements.titleElement.textContent, '正在测试连接');
  assert.equal(elements.actions.test.button.disabled, true);
  assert.equal(elements.actions.save.button.disabled, true);
  assert.equal(elements.actions.test.button.getAttribute('aria-busy'), 'true');
  assert.equal(elements.actions.test.button.getAttribute('aria-describedby'), 'cfg-status');
  assert.equal(elements.actions.test.labelElement.textContent, '正在连接…');
  assert.equal(elements.actions.test.button.classList.contains('is-loading'), true);
});

test('save feedback reuses the card status and restores both action buttons', () => {
  const elements = createFeedbackElements();

  updateConfigActionFeedback(elements, 'saving');
  assert.equal(elements.titleElement.textContent, '正在保存配置');
  assert.equal(elements.actions.save.labelElement.textContent, '正在保存…');
  assert.equal(elements.actions.save.button.getAttribute('aria-busy'), 'true');
  assert.equal(elements.actions.test.button.disabled, true);

  updateConfigActionFeedback(elements, 'saved');
  assert.equal(elements.statusElement.dataset.state, 'success');
  assert.equal(elements.titleElement.textContent, '配置已保存');
  assert.equal(elements.actions.test.button.disabled, false);
  assert.equal(elements.actions.save.button.disabled, false);
  assert.equal(elements.actions.save.labelElement.textContent, '保存配置');
});

test('EchoAgent login has an independent inline loading and result state', () => {
  const elements = createFeedbackElements(['login']);

  updateConfigActionFeedback(elements, 'loggingIn');
  assert.equal(elements.statusElement.dataset.state, 'testing');
  assert.equal(elements.titleElement.textContent, '正在登录 EchoAgent');
  assert.equal(elements.actions.login.labelElement.textContent, '正在登录…');
  assert.equal(elements.actions.login.button.getAttribute('aria-busy'), 'true');

  elements.actions.login.idleLabel = '已登录 EchoAgent';
  updateConfigActionFeedback(elements, 'loginSuccess');
  assert.equal(elements.statusElement.dataset.state, 'success');
  assert.equal(elements.titleElement.textContent, 'EchoAgent 登录成功');
  assert.equal(elements.actions.login.labelElement.textContent, '已登录 EchoAgent');

  elements.actions.login.idleLabel = '登录 EchoAgent';
  updateConfigActionFeedback(elements, 'loginDirty');
  assert.equal(elements.statusElement.dataset.state, 'dirty');
  assert.equal(elements.titleElement.textContent, '登录信息已修改');
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

test('save and login failures never expose raw exception content', () => {
  assert.deepEqual(getConfigSaveErrorFeedback({ name: 'QuotaExceededError' }), {
    title: '浏览器存储空间不足',
    detail: '无法保存当前配置，请清理扩展存储空间后重试。',
  });

  assert.deepEqual(getEchoAgentLoginErrorFeedback({ status: 401 }), {
    title: 'EchoAgent 认证失败',
    detail: '请检查用户名和密码是否正确，然后重新登录。',
  });

  assert.deepEqual(getEchoAgentLoginErrorFeedback(new Error('Failed to fetch')), {
    title: '无法连接到 EchoAgent',
    detail: '请检查 EchoAgent 是否已启动，以及当前网络能否访问该地址。',
  });

  const saveFallback = getConfigSaveErrorFeedback(new Error('<script>alert(1)</script>'));
  const loginFallback = getEchoAgentLoginErrorFeedback(new Error('<script>alert(1)</script>'));
  assert.doesNotMatch(saveFallback.detail, /<script/);
  assert.doesNotMatch(loginFallback.detail, /<script/);
});
