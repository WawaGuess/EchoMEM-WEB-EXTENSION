const FMT = (n) => n.toLocaleString('zh-CN');
const SESSION_STATS_UNSUPPORTED_ERROR = '当前 EchoAgent 服务暂不支持会话统计汇总';

function getFailureMessage(result) {
  return result?.status === 'rejected'
    ? String(result.reason?.message || result.reason || '')
    : '';
}

/**
 * 将两个独立请求的结果转换成可展示状态。
 * `null` 表示无法获取；只有接口成功返回的 0 才保留为真实 0。
 */
export function buildPerformanceState({ showSessionStats = true, statsResult, usageResult }) {
  const hasSessionData = showSessionStats
    && statsResult?.status === 'fulfilled'
    && statsResult.value;
  const sessionStatus = !showSessionStats
    ? 'hidden'
    : hasSessionData
      ? 'available'
      : getFailureMessage(statsResult).includes(SESSION_STATS_UNSUPPORTED_ERROR)
        ? 'unavailable'
        : 'error';

  const hasBackendData = usageResult?.status === 'fulfilled'
    && Number.isFinite(usageResult.value);
  const backendStatus = hasBackendData ? 'available' : 'error';
  const stats = hasSessionData ? statsResult.value : {};
  const sessionTokens = hasSessionData ? (stats.totalTokens ?? 0) : null;
  const backendTokens = hasBackendData ? usageResult.value : null;

  return {
    sessionStatus,
    backendStatus,
    totalSessions: hasSessionData ? (stats.totalSessions ?? 0) : null,
    totalTurns: hasSessionData ? (stats.totalTurns ?? 0) : null,
    totalInputTokens: hasSessionData ? (stats.totalInputTokens ?? 0) : null,
    totalOutputTokens: hasSessionData ? (stats.totalOutputTokens ?? 0) : null,
    sessionTokens,
    backendTokens,
    totalTokens: showSessionStats && hasSessionData && hasBackendData
      ? sessionTokens + backendTokens
      : null,
    since: hasSessionData ? (stats.since ?? null) : null,
  };
}

function setMetricValue(element, value) {
  if (!element) return;
  element.textContent = Number.isFinite(value) ? FMT(value) : '—';
  element.style.color = Number.isFinite(value) ? '#1D1B20' : '#79747E';
}

function setMetricStatus(element, text, status = 'neutral') {
  if (!element) return;
  element.textContent = text;
  element.classList.toggle('perf-status-error', status === 'error');
}

function updateSessionNotice(bodyElement, sessionStatus) {
  const noticeEl = bodyElement?.querySelector('#perf-session-notice');
  if (!noticeEl) return;

  if (sessionStatus === 'available' || sessionStatus === 'hidden') {
    noticeEl.hidden = true;
    return;
  }

  const titleEl = noticeEl.querySelector('#perf-session-notice-title');
  const detailEl = noticeEl.querySelector('#perf-session-notice-detail');
  const isUnavailable = sessionStatus === 'unavailable';
  noticeEl.hidden = false;
  if (titleEl) titleEl.textContent = isUnavailable ? '会话统计暂不可用' : '会话统计获取失败';
  if (detailEl) {
    detailEl.textContent = isUnavailable
      ? 'EchoAgent 当前未提供会话汇总数据。'
      : '请稍后重试；EchoMem 后端消耗仍可单独查看。';
  }
}

export function updatePerformanceDOM(bodyElement, data, showSessionStats = true) {
  if (!bodyElement) return;

  const totalEl = bodyElement.querySelector('#perf-total');
  const totalStatusEl = bodyElement.querySelector('#perf-total-status');
  const sessionsEl = bodyElement.querySelector('#perf-sessions');
  const sessionsStatusEl = bodyElement.querySelector('#perf-sessions-status');
  const turnsEl = bodyElement.querySelector('#perf-turns');
  const turnsStatusEl = bodyElement.querySelector('#perf-turns-status');
  const inputEl = bodyElement.querySelector('#perf-input');
  const inputStatusEl = bodyElement.querySelector('#perf-input-status');
  const outputEl = bodyElement.querySelector('#perf-output');
  const outputStatusEl = bodyElement.querySelector('#perf-output-status');
  const backendEl = bodyElement.querySelector('#perf-backend');
  const backendStatusEl = bodyElement.querySelector('#perf-backend-status');
  const descEl = bodyElement.querySelector('#perf-desc');

  const sessionAvailable = data.sessionStatus === 'available';
  const backendAvailable = data.backendStatus === 'available';
  const sessionStatusText = data.sessionStatus === 'unavailable' ? '暂不可用' : '获取失败';

  if (showSessionStats) {
    setMetricValue(totalEl, data.totalTokens);
    setMetricValue(sessionsEl, data.totalSessions);
    setMetricValue(turnsEl, data.totalTurns);
    setMetricValue(inputEl, data.totalInputTokens);
    setMetricValue(outputEl, data.totalOutputTokens);

    if (data.totalTokens !== null) {
      setMetricStatus(totalStatusEl, 'tokens');
    } else if (!sessionAvailable) {
      setMetricStatus(totalStatusEl, '缺少会话统计，暂无法计算');
    } else {
      setMetricStatus(totalStatusEl, '缺少后端统计，暂无法计算', 'error');
    }

    const detailStatus = sessionAvailable ? '' : sessionStatusText;
    const detailTone = data.sessionStatus === 'error' ? 'error' : 'neutral';
    setMetricStatus(sessionsStatusEl, detailStatus, detailTone);
    setMetricStatus(turnsStatusEl, detailStatus, detailTone);
    setMetricStatus(inputStatusEl, sessionAvailable ? 'tokens' : detailStatus, detailTone);
    setMetricStatus(outputStatusEl, sessionAvailable ? 'tokens' : detailStatus, detailTone);
    updateSessionNotice(bodyElement, data.sessionStatus);
  }

  setMetricValue(backendEl, data.backendTokens);
  setMetricStatus(
    backendStatusEl,
    backendAvailable ? 'tokens' : '获取失败',
    backendAvailable ? 'neutral' : 'error'
  );

  if (descEl) {
    const sinceDate = data.since ? new Date(data.since) : null;
    const sinceText = sinceDate && !Number.isNaN(sinceDate.getTime())
      ? ` 自 ${sinceDate.toLocaleString('zh-CN')} 起统计。`
      : '';
    if (showSessionStats && sessionAvailable && backendAvailable) {
      descEl.textContent = `Token 统计：累计 ${FMT(data.totalSessions)} 个会话，${FMT(data.totalTurns)} 轮对话；会话消耗 ${FMT(data.sessionTokens)} tokens，EchoMem 后端消耗 ${FMT(data.backendTokens)} tokens，合计 ${FMT(data.totalTokens)} tokens。${sinceText}`;
    } else if (showSessionStats && !sessionAvailable) {
      const sessionCopy = data.sessionStatus === 'unavailable'
        ? '会话统计暂不可用，无法计算完整总量。'
        : '会话统计获取失败，请稍后重试。';
      const backendCopy = backendAvailable
        ? `EchoMem 后端消耗 ${FMT(data.backendTokens)} tokens。`
        : 'EchoMem 后端消耗获取失败。';
      descEl.textContent = `${backendCopy}${sessionCopy}`;
    } else if (showSessionStats) {
      descEl.textContent = `会话统计已获取；EchoMem 后端消耗获取失败，暂无法计算完整总量。${sinceText}`;
    } else if (backendAvailable) {
      descEl.textContent = `Token 统计：当前平台仅展示 EchoMem 后端消耗，共 ${FMT(data.backendTokens)} tokens。`;
    } else {
      descEl.textContent = 'EchoMem 后端消耗获取失败，请稍后重试。';
    }
  }
}
