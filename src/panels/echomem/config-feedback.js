const CONFIG_ACTION_FEEDBACK = {
  testing: {
    tone: 'testing',
    action: 'test',
    title: '正在测试连接',
    detail: '正在检查服务是否可用，请稍候。',
  },
  connectionSuccess: {
    tone: 'success',
    title: '连接成功',
    detail: '服务可用，当前配置可以正常连接。',
  },
  connectionError: {
    tone: 'error',
    title: '连接失败',
    detail: '请检查服务地址和认证配置后重试。',
  },
  dirty: {
    tone: 'dirty',
    title: '配置已修改',
    detail: '请重新测试或保存，以确认当前配置可用。',
  },
  saving: {
    tone: 'testing',
    action: 'save',
    title: '正在保存配置',
    detail: '正在将当前设置保存到浏览器，请稍候。',
  },
  saved: {
    tone: 'success',
    title: '配置已保存',
    detail: '新的配置已生效，后续请求将使用当前设置。',
  },
  saveError: {
    tone: 'error',
    title: '保存失败',
    detail: '未能保存当前配置，请稍后重试。',
  },
  loggingIn: {
    tone: 'testing',
    action: 'login',
    title: '正在登录 EchoAgent',
    detail: '正在验证当前账号信息，请稍候。',
  },
  loginSuccess: {
    tone: 'success',
    title: 'EchoAgent 登录成功',
    detail: '当前会话身份认证已更新。',
  },
  loginError: {
    tone: 'error',
    title: 'EchoAgent 登录失败',
    detail: '请检查服务地址、用户名和密码后重试。',
  },
  loginDirty: {
    tone: 'dirty',
    title: '登录信息已修改',
    detail: '请重新登录，以使用更新后的 EchoAgent 配置。',
  },
};

function hasErrorStatus(error, statuses) {
  const status = Number(error?.status);
  if (statuses.includes(status)) return true;

  const message = String(error?.message || '');
  return statuses.some((candidate) => message.includes(`HTTP ${candidate}`));
}

function isTimeoutError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.name === 'AbortError' || message.includes('aborted') || message.includes('timeout');
}

function isNetworkError(error) {
  const message = String(error?.message || '');
  return message.includes('Failed to fetch') || message.includes('Could not establish connection');
}

export function getConnectionTestErrorFeedback(error) {
  if (isTimeoutError(error)) {
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

  if (isNetworkError(error)) {
    return {
      title: '无法连接到服务',
      detail: '请检查服务是否已启动，以及当前网络能否访问该地址。',
    };
  }

  return CONFIG_ACTION_FEEDBACK.connectionError;
}

export function getConfigSaveErrorFeedback(error) {
  if (error?.name === 'QuotaExceededError') {
    return {
      title: '浏览器存储空间不足',
      detail: '无法保存当前配置，请清理扩展存储空间后重试。',
    };
  }

  return CONFIG_ACTION_FEEDBACK.saveError;
}

export function getEchoAgentLoginErrorFeedback(error) {
  if (isTimeoutError(error)) {
    return {
      title: 'EchoAgent 登录超时',
      detail: '服务未在预期时间内响应，请检查服务地址和运行状态。',
    };
  }

  if (hasErrorStatus(error, [401, 403])) {
    return {
      title: 'EchoAgent 认证失败',
      detail: '请检查用户名和密码是否正确，然后重新登录。',
    };
  }

  if (isNetworkError(error)) {
    return {
      title: '无法连接到 EchoAgent',
      detail: '请检查 EchoAgent 是否已启动，以及当前网络能否访问该地址。',
    };
  }

  return CONFIG_ACTION_FEEDBACK.loginError;
}

function resetAction(action, statusId, shouldDescribeStatus) {
  const { button, labelElement, idleLabel } = action || {};
  if (!button || !labelElement) return;

  button.disabled = false;
  button.classList.remove('is-loading');
  button.removeAttribute('aria-busy');
  labelElement.textContent = idleLabel;

  if (shouldDescribeStatus) {
    button.setAttribute('aria-describedby', statusId);
  } else {
    button.removeAttribute('aria-describedby');
  }
}

export function updateConfigActionFeedback(elements, state, feedback = null) {
  const {
    statusElement,
    titleElement,
    detailElement,
    actions = {},
  } = elements || {};

  if (!statusElement || !titleElement || !detailElement) return;

  const actionEntries = Object.entries(actions);
  if (state === 'idle') {
    statusElement.hidden = true;
    statusElement.dataset.state = 'idle';
    statusElement.setAttribute('aria-live', 'polite');
    actionEntries.forEach(([, action]) => resetAction(action, statusElement.id, false));
    return;
  }

  const preset = CONFIG_ACTION_FEEDBACK[state] || CONFIG_ACTION_FEEDBACK.connectionError;
  const content = { ...preset, ...(feedback || {}) };
  const activeAction = content.action || null;

  statusElement.hidden = false;
  statusElement.dataset.state = content.tone;
  statusElement.setAttribute('aria-live', content.tone === 'error' ? 'assertive' : 'polite');
  titleElement.textContent = content.title;
  detailElement.textContent = content.detail;

  actionEntries.forEach(([actionName, action]) => {
    resetAction(action, statusElement.id, true);
    const isActive = actionName === activeAction;
    const { button, labelElement, busyLabel, spinIcon = false } = action || {};
    if (!button || !labelElement) return;

    button.disabled = Boolean(activeAction);
    if (!isActive) return;

    button.setAttribute('aria-busy', 'true');
    button.classList.toggle('is-loading', spinIcon);
    labelElement.textContent = busyLabel;
  });
}
