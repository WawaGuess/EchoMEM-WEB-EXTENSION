const CONNECTION_TEST_FEEDBACK = {
  testing: {
    title: '正在测试连接',
    detail: '正在检查服务是否可用，请稍候。',
  },
  success: {
    title: '连接成功',
    detail: '服务可用，当前配置可以正常连接。',
  },
  error: {
    title: '连接失败',
    detail: '请检查服务地址和认证配置后重试。',
  },
  dirty: {
    title: '配置已修改',
    detail: '请重新测试连接，以确认当前配置可用。',
  },
};

function hasErrorStatus(error, statuses) {
  const status = Number(error?.status);
  if (statuses.includes(status)) return true;

  const message = String(error?.message || '');
  return statuses.some((candidate) => message.includes(`HTTP ${candidate}`));
}

export function getConnectionTestErrorFeedback(error) {
  const message = String(error?.message || '');

  if (error?.name === 'AbortError' || message.includes('aborted')) {
    return {
      title: '连接超时',
      detail: '服务未在预期时间内响应，请检查服务地址和运行状态。',
    };
  }

  if (hasErrorStatus(error, [401, 403])) {
    return {
      title: '认证失败',
      detail: '请检查认证密钥是否正确，并确认当前密钥仍然有效。',
    };
  }

  if (message.includes('Failed to fetch') || message.includes('Could not establish connection')) {
    return {
      title: '无法连接到服务',
      detail: '请检查服务是否已启动，以及当前网络能否访问该地址。',
    };
  }

  return CONNECTION_TEST_FEEDBACK.error;
}

export function updateConnectionTestFeedback(elements, state, feedback = null) {
  const {
    statusElement,
    titleElement,
    detailElement,
    testButton,
    testButtonLabel,
  } = elements || {};

  if (!statusElement || !titleElement || !detailElement || !testButton || !testButtonLabel) {
    return;
  }

  if (state === 'idle') {
    statusElement.hidden = true;
    statusElement.dataset.state = 'idle';
    statusElement.setAttribute('aria-live', 'polite');
    testButton.disabled = false;
    testButton.removeAttribute('aria-busy');
    testButton.removeAttribute('aria-describedby');
    testButton.classList.remove('is-loading');
    testButtonLabel.textContent = '测试连接';
    return;
  }

  const content = feedback || CONNECTION_TEST_FEEDBACK[state] || CONNECTION_TEST_FEEDBACK.error;
  const isTesting = state === 'testing';

  statusElement.hidden = false;
  statusElement.dataset.state = state;
  statusElement.setAttribute('aria-live', state === 'error' ? 'assertive' : 'polite');
  titleElement.textContent = content.title;
  detailElement.textContent = content.detail;

  testButton.disabled = isTesting;
  testButton.classList.toggle('is-loading', isTesting);
  testButton.setAttribute('aria-describedby', statusElement.id);
  testButtonLabel.textContent = isTesting ? '正在连接…' : '测试连接';

  if (isTesting) {
    testButton.setAttribute('aria-busy', 'true');
  } else {
    testButton.removeAttribute('aria-busy');
  }
}

