// Cognitive Feedback navigation and view lifecycle management.
import { injectFeedbackTheme } from './feedback-theme.js';

/**
 * @param {HTMLElement} container
 * @param {object} opts
 * @param {Array<{key:string,label:string,mount:(el:HTMLElement,api:object)=>void,cleanup?:(el:HTMLElement)=>void}>} opts.views
 * @param {string} [opts.defaultKey]
 */
export function mountViewSwitcher(container, { views, defaultKey }) {
  container.innerHTML = '';
  container.style.position = 'relative';

  const wrapper = document.createElement('div');
  wrapper.className = 'echomem-feedback-shell';
  wrapper.style.cssText = 'display:flex;flex-direction:column;width:100%;height:100%;min-height:400px;';
  injectFeedbackTheme(wrapper);

  const topbar = document.createElement('div');
  topbar.className = 'em-topbar';

  const brand = document.createElement('div');
  brand.className = 'em-brand';
  brand.innerHTML = `
    <div class="em-brand-eyebrow">ECHO · MEMORY INSIGHT</div>
    <div class="em-brand-title">认知反馈</div>
  `;

  const tabList = document.createElement('div');
  tabList.className = 'em-tabs';
  tabList.setAttribute('role', 'tablist');
  tabList.setAttribute('aria-label', '认知反馈视图');

  const content = document.createElement('div');
  content.className = 'em-view-stage';

  topbar.appendChild(brand);
  topbar.appendChild(tabList);
  wrapper.appendChild(topbar);
  wrapper.appendChild(content);
  container.appendChild(wrapper);

  let activeKey = null;
  let activeRevision = 0;
  const tabs = {};

  views.forEach((view) => {
    const btn = document.createElement('button');
    btn.className = 'em-tab';
    btn.type = 'button';
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', 'false');
    btn.innerHTML = `<span class="em-tab-mark"></span><span>${view.label}</span>`;
    btn.addEventListener('click', () => switchTo(view.key));
    tabList.appendChild(btn);
    tabs[view.key] = { btn, view };
  });

  function cleanupActive() {
    if (!activeKey) return;
    try {
      tabs[activeKey]?.view?.cleanup?.(content);
    } catch (err) {
      console.warn('EchoMem view-switcher: cleanup error', err);
    }
  }

  function switchTo(key, params = {}) {
    if (key === activeKey || !tabs[key]) return;
    cleanupActive();
    content.innerHTML = '';
    activeKey = key;
    const revision = ++activeRevision;
    content.dataset.emView = key;
    wrapper.dataset.emView = key;
    Object.entries(tabs).forEach(([tabKey, { btn }]) => {
      btn.setAttribute('aria-selected', String(tabKey === key));
      btn.tabIndex = tabKey === key ? 0 : -1;
    });
    try {
      tabs[key].view.mount(content, {
        switchTo,
        params,
        isActive: () => (
          activeKey === key
          && activeRevision === revision
          && content.isConnected
        ),
      });
    } catch (err) {
      console.error('EchoMem view-switcher: mount error', err);
    }
  }

  const observer = new MutationObserver(() => {
    if (!container.isConnected) destroy();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  function destroy() {
    observer.disconnect();
    cleanupActive();
    activeKey = null;
    activeRevision += 1;
  }

  switchTo(defaultKey || views[0]?.key);
  return { destroy, switchTo };
}
