import { injectContent } from '../core/content-injector.js';
import { renderTimeline, cleanupTimeline } from '../panels/feedback/timeline/timeline-view.js';
import { injectTimelineTheme } from '../panels/feedback/timeline/timeline-theme.js';
import { fetchEpisodeTimeline } from '../services/episode-client.js';
import { showFloatingToast } from '../services/toast.js';

function isViewActive(container, viewApi) {
  return container.isConnected && (
    typeof viewApi.isActive !== 'function' || viewApi.isActive()
  );
}

function setLoadingState(container) {
  container.innerHTML = `
    <div class="em-loading" role="status" aria-live="polite">
      <div class="em-state-orb" aria-hidden="true"></div>
      <p class="em-state-title">正在加载情节记忆…</p>
      <p class="em-state-copy">EchoMem 正在整理相关记忆，请稍候。</p>
    </div>
  `;
}

function setErrorState(container, err, onRetry) {
  container.innerHTML = `
    <div class="em-error" role="alert">
      <div class="em-state-orb" aria-hidden="true"></div>
      <p class="em-state-title">加载失败</p>
      <p class="em-state-copy"></p>
      <button class="em-primary-btn" type="button">重试</button>
    </div>
  `;
  container.querySelector('.em-state-copy').textContent = err?.message || '未知错误';
  container.querySelector('.em-primary-btn')?.addEventListener('click', onRetry);
}

function closeFeedbackOverlay() {
  const overlay = Array.from(document.querySelectorAll('.claw-feedback-overlay'))
    .find((element) => element.isConnected && element.style.display !== 'none');
  overlay?.querySelector('.claw-close-panel')?.click();
}

function useMemory(content, message) {
  const success = injectContent(content, { replace: true, focus: true });
  if (!success) {
    showFloatingToast('未找到聊天输入框，无法带入记忆', 'error');
    return;
  }
  showFloatingToast(message || '记忆已带入当前对话', 'success');
  setTimeout(closeFeedbackOverlay, 260);
}

async function mountEpisodeView(container, viewApi = {}) {
  try {
    setLoadingState(container);
    let model = container._episodeModel;
    if (!model) {
      model = await fetchEpisodeTimeline();
      container._episodeModel = model;
    }
    if (!isViewActive(container, viewApi)) return;

    renderTimeline(container, model, {
      onUseMemory: (content, message) => useMemory(content, message),
    });
    injectTimelineTheme(container);
  } catch (err) {
    console.error('EchoMem: 加载 Episode 失败', err);
    if (!isViewActive(container, viewApi)) return;
    setErrorState(container, err, () => {
      if (!isViewActive(container, viewApi)) return;
      container._episodeModel = null;
      mountEpisodeView(container, viewApi);
    });
  }
}

const episodeFeedbackView = {
  key: 'timeline',
  label: '情节记忆',
  mount: mountEpisodeView,
  cleanup: (container) => {
    cleanupTimeline(container);
    container._episodeModel = null;
  },
};

globalThis.__ECHOMEM_FEEDBACK_VIEWS__ ||= new Map();
globalThis.__ECHOMEM_FEEDBACK_VIEWS__.set(episodeFeedbackView.key, episodeFeedbackView);
