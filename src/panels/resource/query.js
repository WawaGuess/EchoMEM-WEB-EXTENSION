// 资源查询面板 —— 按 session id / resource id / tag / metadata 搜索资源

import { getEchoMemConfig } from '../../services/config.js';
import { createClient } from '../../services/echomem-client.js';
import { getCurrentPlatform } from '../../core/detection.js';
import { getRecordingState } from '../../core/session-recorder.js';
import { extractSessionId } from '../../services/session-mapper.js';
import { openCenterOverlay, closeOverlayPanel } from '../../core/panel-host.js';

const FILTER_TYPES = [
  { id: 'session', label: '按 Session' },
  { id: 'resourceId', label: '按 Resource ID' },
  { id: 'tag', label: '按 Tag' },
  { id: 'metadata', label: '按 Metadata' },
];

function resolveCurrentSessionId() {
  const { echoMemSessionId } = getRecordingState();
  if (echoMemSessionId) return echoMemSessionId;

  const platform = getCurrentPlatform();
  if (!platform?.key) return null;

  return extractSessionId(platform.key) || null;
}

function formatDate(ts) {
  if (!ts) return '-';
  const d = typeof ts === 'string' ? new Date(ts) : new Date(ts * 1000);
  if (isNaN(d.getTime())) return '-';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getResourceQueryContent() {
  return `
    <div id="claw-resource-query-root" style="display: flex; flex-direction: column; gap: 14px; color: #333;">
      <div style="font-size: 12px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.05em;">选择查询维度</div>

      <div id="claw-query-filter-tabs" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
        ${FILTER_TYPES.map((f) => `
          <button class="claw-query-filter-tab" data-filter="${f.id}" style="
            padding: 10px 8px;
            border-radius: 14px;
            border: 1px solid rgba(58, 47, 40, 0.08);
            background: rgba(255, 255, 255, 0.4);
            color: #7a6f62;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            text-align: center;
            transition: all 0.35s ease;
          ">${f.label}</button>
        `).join('')}
      </div>

      <div style="font-size: 11px; color: #9a8f80; line-height: 1.4;">
        选择查询维度后，填写条件可缩小范围；留空则仅按关键词搜索。
      </div>

      <div class="input-group" style="display: flex; flex-direction: column; gap: 6px;">
        <label style="font-size: 12px; font-weight: 500; color: #5a5045;">搜索关键词 <span style="color: #c07070;">*</span></label>
        <input id="claw-query-keyword-input" type="text" placeholder="输入搜索关键词，如项目设计、API 文档..." style="
          width: 100%;
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid rgba(58, 47, 40, 0.1);
          background: rgba(255, 255, 255, 0.6);
          color: #3a2f28;
          font-size: 13px;
          font-family: inherit;
          outline: none;
          transition: all 0.35s ease;
        ">
      </div>

      <div id="claw-query-form-area" style="display: flex; flex-direction: column; gap: 10px;">
        <!-- form injected by JS -->
      </div>

      <button id="claw-query-search-btn" style="
        width: 100%;
        padding: 13px;
        border-radius: 16px;
        border: none;
        background: linear-gradient(135deg, #8ab0c8 0%, #6a90a8 100%);
        color: #fff;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: all 0.4s ease;
        box-shadow: 0 4px 16px rgba(122, 158, 181, 0.25);
        margin-top: 4px;
      ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        搜索资源
      </button>

      <div id="claw-query-status" style="display: none; padding: 10px 12px; border-radius: 8px; font-size: 13px;"></div>

      <div id="claw-query-results" style="display: none; flex-direction: column; gap: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 12px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.05em;">搜索结果</span>
          <span id="claw-query-results-count" style="font-size: 12px; color: #888;"></span>
        </div>
        <div id="claw-query-results-list" style="display: flex; flex-direction: column; gap: 8px;"></div>
      </div>
    </div>
  `;
}

export async function initQueryPanel(bodyElement) {
  if (!bodyElement) return;

  const root = bodyElement.querySelector('#claw-resource-query-root');
  const tabsContainer = bodyElement.querySelector('#claw-query-filter-tabs');
  const formArea = bodyElement.querySelector('#claw-query-form-area');
  const searchBtn = bodyElement.querySelector('#claw-query-search-btn');
  const statusEl = bodyElement.querySelector('#claw-query-status');
  const resultsArea = bodyElement.querySelector('#claw-query-results');
  const resultsList = bodyElement.querySelector('#claw-query-results-list');
  const resultsCount = bodyElement.querySelector('#claw-query-results-count');

  if (!root || !tabsContainer || !formArea || !searchBtn) return;

  let currentFilter = 'session';
  const state = {
    query: '',
    sessionId: resolveCurrentSessionId() || '',
    resourceId: '',
    tagInput: '',
    metadataRows: [{ key: '', value: '' }],
  };

  function setActiveTab(filterId) {
    currentFilter = filterId;
    tabsContainer.querySelectorAll('.claw-query-filter-tab').forEach((btn) => {
      const isActive = btn.dataset.filter === filterId;
      btn.style.background = isActive
        ? 'linear-gradient(135deg, #8ab0c8 0%, #6a90a8 100%)'
        : 'rgba(255, 255, 255, 0.4)';
      btn.style.color = isActive ? '#fff' : '#7a6f62';
      btn.style.borderColor = isActive ? 'transparent' : 'rgba(58, 47, 40, 0.08)';
      btn.style.boxShadow = isActive ? '0 4px 14px rgba(122, 158, 181, 0.25)' : 'none';
    });
    renderForm();
  }

  function renderInputGroup(label, innerHtml, helperHtml = '') {
    return `
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <label style="font-size: 12px; font-weight: 500; color: #5a5045;">${label}</label>
        ${innerHtml}
        ${helperHtml ? `<div style="display: flex; gap: 8px; align-items: center;">${helperHtml}</div>` : ''}
      </div>
    `;
  }

  function renderTextInput(id, placeholder, value) {
    return `
      <input id="${id}" type="text" value="${value}" placeholder="${placeholder}" style="
        width: 100%;
        padding: 12px 14px;
        border-radius: 14px;
        border: 1px solid rgba(58, 47, 40, 0.1);
        background: rgba(255, 255, 255, 0.6);
        color: #3a2f28;
        font-size: 13px;
        font-family: inherit;
        outline: none;
        transition: all 0.35s ease;
      ">
    `;
  }

  function renderHelperBtn(id, text) {
    return `
      <button id="${id}" style="
        padding: 5px 10px;
        border-radius: 10px;
        border: 1px solid rgba(122, 158, 181, 0.25);
        background: rgba(122, 158, 181, 0.08);
        color: #5a7e95;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.3s ease;
      ">${text}</button>
    `;
  }

  function renderForm() {
    if (currentFilter === 'session') {
      formArea.innerHTML = renderInputGroup(
        'Session ID',
        renderTextInput('claw-query-session-input', '输入 session id...', state.sessionId),
        renderHelperBtn('claw-query-use-current-session', '使用当前会话') +
        renderHelperBtn('claw-query-clear-session', '清空')
      );

      formArea.querySelector('#claw-query-use-current-session')?.addEventListener('click', () => {
        const current = resolveCurrentSessionId() || '';
        const input = formArea.querySelector('#claw-query-session-input');
        if (input) input.value = current;
        state.sessionId = current;
      });

      formArea.querySelector('#claw-query-clear-session')?.addEventListener('click', () => {
        const input = formArea.querySelector('#claw-query-session-input');
        if (input) input.value = '';
        state.sessionId = '';
      });

      formArea.querySelector('#claw-query-session-input')?.addEventListener('input', (e) => {
        state.sessionId = e.target.value;
      });
      return;
    }

    if (currentFilter === 'resourceId') {
      formArea.innerHTML = renderInputGroup(
        'Resource ID',
        renderTextInput('claw-query-resourceid-input', '输入 resource id...', state.resourceId)
      );
      formArea.querySelector('#claw-query-resourceid-input')?.addEventListener('input', (e) => {
        state.resourceId = e.target.value;
      });
      return;
    }

    if (currentFilter === 'tag') {
      formArea.innerHTML = renderInputGroup(
        'Tags',
        renderTextInput('claw-query-tag-input', '多个 tag 用逗号分隔，如 doc,design', state.tagInput)
      );
      formArea.querySelector('#claw-query-tag-input')?.addEventListener('input', (e) => {
        state.tagInput = e.target.value;
      });
      return;
    }

    if (currentFilter === 'metadata') {
      renderMetadataForm();
    }
  }

  function renderMetadataForm() {
    const rowsHtml = state.metadataRows.map((row, idx) => `
      <div class="claw-query-meta-row" data-idx="${idx}" style="display: grid; grid-template-columns: 1fr 1fr 28px; gap: 8px; align-items: center;">
        <input class="claw-query-meta-key" type="text" value="${row.key}" placeholder="key" style="
          padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(58, 47, 40, 0.1);
          background: rgba(255, 255, 255, 0.6); color: #3a2f28; font-size: 12px; font-family: inherit; outline: none;
        ">
        <input class="claw-query-meta-value" type="text" value="${row.value}" placeholder="value" style="
          padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(58, 47, 40, 0.1);
          background: rgba(255, 255, 255, 0.6); color: #3a2f28; font-size: 12px; font-family: inherit; outline: none;
        ">
        <button class="claw-query-meta-remove" style="
          width: 28px; height: 28px; border-radius: 50%; border: none;
          background: rgba(220, 100, 100, 0.08); color: #c07070; cursor: pointer;
          display: flex; align-items: center; justify-content: center; font-size: 16px;
        ">×</button>
      </div>
    `).join('');

    formArea.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <label style="font-size: 12px; font-weight: 500; color: #5a5045;">Metadata</label>
        <div id="claw-query-meta-rows" style="display: flex; flex-direction: column; gap: 8px;">${rowsHtml}</div>
        <button id="claw-query-add-meta" style="
          align-self: flex-start; padding: 6px 12px; border-radius: 12px;
          border: 1px dashed rgba(58, 47, 40, 0.2); background: transparent;
          color: #7a6f62; font-size: 12px; font-weight: 500; cursor: pointer;
          transition: all 0.3s ease;
        ">+ 添加条件</button>
      </div>
    `;

    formArea.querySelectorAll('.claw-query-meta-key').forEach((input) => {
      input.addEventListener('input', updateMetadataState);
    });
    formArea.querySelectorAll('.claw-query-meta-value').forEach((input) => {
      input.addEventListener('input', updateMetadataState);
    });
    formArea.querySelectorAll('.claw-query-meta-remove').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const row = e.target.closest('.claw-query-meta-row');
        const idx = Number(row?.dataset.idx);
        if (!Number.isNaN(idx)) {
          state.metadataRows.splice(idx, 1);
          if (state.metadataRows.length === 0) state.metadataRows.push({ key: '', value: '' });
          renderMetadataForm();
        }
      });
    });
    formArea.querySelector('#claw-query-add-meta')?.addEventListener('click', () => {
      state.metadataRows.push({ key: '', value: '' });
      renderMetadataForm();
    });
  }

  function updateMetadataState() {
    const rows = formArea.querySelectorAll('.claw-query-meta-row');
    state.metadataRows = Array.from(rows).map((row) => ({
      key: row.querySelector('.claw-query-meta-key')?.value || '',
      value: row.querySelector('.claw-query-meta-value')?.value || '',
    }));
  }

  function showStatus(msg, type = 'info') {
    if (!statusEl) return;
    statusEl.style.display = 'block';
    const colors = {
      info: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
      success: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
      error: { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' },
    };
    const c = colors[type] || colors.info;
    statusEl.style.background = c.bg;
    statusEl.style.border = `1px solid ${c.border}`;
    statusEl.style.color = c.text;
    statusEl.textContent = msg;
  }

  function hideStatus() {
    if (statusEl) statusEl.style.display = 'none';
  }

  function formatError(err) {
    if (err.message?.includes('404')) return '资源记忆引擎未启用或查询接口不存在';
    if (err.message?.includes('Failed to fetch')) return '无法连接到记忆后端引擎';
    if (err.message?.includes('401') || err.message?.includes('403')) return '认证失败，请检查 API Key';
    return err.message;
  }

  function groupResultsByResource(results) {
    const map = new Map();
    for (const item of results) {
      const resourceId = item.resource_id;
      if (!map.has(resourceId)) {
        map.set(resourceId, {
          resourceId,
          sourceUri: item.source_uri,
          chunks: [],
          tags: [],
          updatedAt: null,
        });
      }
      const entry = map.get(resourceId);
      entry.chunks.push(item);
      if (item.updated_at && !entry.updatedAt) entry.updatedAt = item.updated_at;
    }
    return Array.from(map.values()).map((entry) => ({
      ...entry,
      chunks: entry.chunks.sort((a, b) => (a.rank || 0) - (b.rank || 0)),
    }));
  }

  async function fetchResourceName(resourceId) {
    try {
      const config = await getEchoMemConfig();
      const client = createClient(config);
      const meta = await client.fsRead(`echo://resources/${resourceId}/meta.json`);
      if (typeof meta === 'string') {
        const parsed = JSON.parse(meta);
        return parsed.name || resourceId;
      }
      return meta?.name || resourceId;
    } catch {
      return resourceId;
    }
  }

  async function renderResults(result) {
    if (!resultsArea || !resultsList || !resultsCount) return;

    const rawResults = result?.results || [];
    if (rawResults.length === 0) {
      resultsArea.style.display = 'flex';
      resultsCount.textContent = '共 0 个资源';
      resultsList.innerHTML = `
        <div style="text-align: center; padding: 32px 16px; color: #999;">
          <p style="font-size: 24px; margin-bottom: 8px;">🔍</p>
          <p style="font-size: 13px;">未找到匹配资源</p>
        </div>
      `;
      return;
    }

    const grouped = groupResultsByResource(rawResults);
    resultsCount.textContent = `共 ${grouped.length} 个资源`;

    const cardsHtml = await Promise.all(grouped.map(async (group) => {
      const name = await fetchResourceName(group.resourceId);
      const snippet = group.chunks[0]?.text || '';
      const date = formatDate(group.updatedAt);
      const chunkCount = group.chunks.length;

      return `
        <div class="claw-query-result-card" data-resource-id="${group.resourceId}" style="
          padding: 14px; border-radius: 16px; border: 1px solid rgba(58, 47, 40, 0.06);
          background: rgba(255, 255, 255, 0.5); backdrop-filter: blur(8px);
          display: flex; flex-direction: column; gap: 8px; cursor: pointer;
          transition: all 0.35s ease;
        ">
          <div style="font-size: 13px; font-weight: 600; color: #3a2f28; word-break: break-all;">${name}</div>
          <div style="font-size: 11px; color: #8a7f70; display: flex; gap: 10px; flex-wrap: wrap;">
            <span>${chunkCount} 个片段</span>
            <span>·</span>
            <span>${date}</span>
          </div>
          ${snippet ? `<div style="font-size: 12px; color: #6a5f52; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${snippet.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : ''}
        </div>
      `;
    }));

    resultsList.innerHTML = cardsHtml.join('');
    resultsArea.style.display = 'flex';

    resultsList.querySelectorAll('.claw-query-result-card').forEach((card) => {
      card.addEventListener('click', async () => {
        const resourceId = card.dataset.resourceId;
        if (!resourceId) return;
        try {
          const config = await getEchoMemConfig();
          const client = createClient(config);
          const result = await client.fsRead(`echo://resources/${resourceId}/content`);
          const text = typeof result === 'string' ? result : (result?.content || JSON.stringify(result, null, 2));
          const name = await fetchResourceName(resourceId);
          const previewHtml = `<div style="padding: 16px 18px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; line-height: 1.7; color: #374151; white-space: pre-wrap; word-break: break-word;">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
          openCenterOverlay(name, previewHtml, { showBack: true, onBack: () => closeOverlayPanel() });
        } catch (err) {
          showStatus(`读取失败: ${err.message}`, 'error');
        }
      });
    });
  }

  async function doSearch() {
    hideStatus();
    if (resultsArea) resultsArea.style.display = 'none';

    const query = state.query.trim();
    if (!query) {
      showStatus('请输入搜索关键词', 'error');
      return;
    }

    const config = await getEchoMemConfig();
    const client = createClient(config);

    const options = { query, limit: 16 };

    if (currentFilter === 'session') {
      const value = state.sessionId.trim();
      if (value) options.sessionId = value;
    } else if (currentFilter === 'resourceId') {
      const value = state.resourceId.trim();
      if (value) options.resourceIds = [value];
    } else if (currentFilter === 'tag') {
      const tags = state.tagInput.split(',').map((t) => t.trim()).filter(Boolean);
      if (tags.length > 0) options.tags = tags;
    } else if (currentFilter === 'metadata') {
      const metadata = {};
      for (const row of state.metadataRows) {
        if (row.key.trim()) metadata[row.key.trim()] = row.value.trim();
      }
      if (Object.keys(metadata).length > 0) options.metadata = metadata;
    }

    searchBtn.disabled = true;
    searchBtn.style.opacity = '0.7';
    searchBtn.style.cursor = 'not-allowed';
    const originalBtnText = searchBtn.innerHTML;
    searchBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;"><circle cx="12" cy="12" r="10"/></svg> 搜索中...`;

    try {
      const result = await client.searchResources(options);
      await renderResults(result);
    } catch (err) {
      showStatus(`搜索失败: ${formatError(err)}`, 'error');
    } finally {
      searchBtn.disabled = false;
      searchBtn.style.opacity = '1';
      searchBtn.style.cursor = 'pointer';
      searchBtn.innerHTML = originalBtnText;
    }
  }

  // Tab click handlers
  tabsContainer.querySelectorAll('.claw-query-filter-tab').forEach((btn) => {
    btn.addEventListener('click', () => setActiveTab(btn.dataset.filter));
  });

  const keywordInput = bodyElement.querySelector('#claw-query-keyword-input');
  if (keywordInput) {
    keywordInput.addEventListener('input', (e) => {
      state.query = e.target.value;
    });
  }

  searchBtn.addEventListener('click', doSearch);

  setActiveTab('session');
}
