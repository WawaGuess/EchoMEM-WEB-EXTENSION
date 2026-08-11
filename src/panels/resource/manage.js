// 资源管理列表页面

import { getEchoMemConfig } from '../../services/config.js';
import { createClient } from '../../services/echomem-client.js';
import { getCurrentPlatform } from '../../core/detection.js';
import { injectContent } from '../../core/content-injector.js';
import { openCenterOverlay, closeOverlayPanel } from '../../core/panel-host.js';

function getPlatformKey() {
  const platform = getCurrentPlatform();
  return platform?.key || 'unknown';
}

function getCurrentMonthDir() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getResourceDirUri() {
  return 'echo://resources';
}

function formatSize(bytes) {
  if (!bytes || bytes < 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ts) {
  if (!ts) return '-';
  // ISO 8601 string (e.g. "2026-05-18T11:08:51Z") or unix timestamp
  const d = typeof ts === 'string' ? new Date(ts) : new Date(ts * 1000);
  if (isNaN(d.getTime())) return '-';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getResourceIdFromUri(uri) {
  if (!uri) return '';
  return uri.replace(/\/$/, '').split('/').pop() || '';
}

function getEntryUpdatedAt(entry) {
  return entry.updated_at || entry.modTime || entry.mtime || entry.modifiedAt;
}

function getEntrySize(entry) {
  return entry.size ?? entry.stat?.size;
}

export function getResourceManageContent() {
  return `
    <style>
      #claw-resource-manage-root {
        display: flex;
        flex-direction: column;
        gap: 10px;
        color: #1D1B20;
        font-family: Roboto, "Noto Sans SC", sans-serif;
      }
      #claw-resource-manage-root, #claw-resource-manage-root * { box-sizing: border-box; }
      #claw-resource-manage-root #claw-resource-toast {
        padding: 11px 13px !important;
        border-radius: 12px !important;
        font-size: 12px !important;
        line-height: 1.5;
      }
      #claw-resource-manage-root .resource-manage-loading,
      #claw-resource-manage-root .resource-manage-empty,
      #claw-resource-manage-root .resource-manage-error {
        padding: 28px 16px !important;
        border: 1px dashed #D8D0DC;
        border-radius: 16px;
        background: #FFFFFF;
        color: #79747E !important;
        text-align: center;
        font-size: 12px;
        line-height: 1.55;
      }
      #claw-resource-manage-root .resource-manage-spinner {
        display: inline-block;
        width: 22px;
        height: 22px;
        margin-bottom: 8px;
        border: 2px solid #E7E0EC;
        border-top-color: #6750A4;
        border-radius: 50%;
        animation: resource-manage-spin 0.8s linear infinite;
      }
      @keyframes resource-manage-spin { to { transform: rotate(360deg); } }
      #claw-resource-manage-root .resource-manage-state-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 46px;
        height: 46px;
        margin-bottom: 9px;
        border-radius: 16px;
        background: #F3EDF7;
        color: #6750A4;
      }
      #claw-resource-manage-root .resource-manage-error {
        border-style: solid;
        border-color: #F2B8B5;
        background: #FFF8F7 !important;
        color: #B3261E !important;
      }
      #claw-resource-manage-root .resource-manage-error .resource-manage-state-icon {
        background: #F9DEDC;
        color: #B3261E;
      }
      #claw-resource-manage-root #claw-resource-toolbar {
        align-items: center;
        margin: 0 !important;
      }
      #claw-resource-manage-root #claw-resource-btn-refresh {
        min-height: 36px;
        padding: 7px 13px !important;
        border: 1px solid #E0D4F1 !important;
        border-radius: 999px !important;
        background: #F3EDF7 !important;
        color: #6750A4 !important;
        font-family: inherit;
        font-size: 12px !important;
        font-weight: 600;
        line-height: 1.3;
        transition: background 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
      }
      #claw-resource-manage-root #claw-resource-btn-refresh:hover {
        background: #EADDFF !important;
        box-shadow: 0 3px 10px rgba(103, 80, 164, 0.14);
      }
      #claw-resource-manage-root #claw-resource-btn-refresh:active { transform: scale(0.98); }
      #claw-resource-manage-root button:focus-visible {
        outline: 3px solid rgba(103, 80, 164, 0.22);
        outline-offset: 2px;
      }
      #claw-resource-manage-root .resource-manage-summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 9px;
        padding: 9px 11px;
        border-radius: 12px;
        background: #F3EDF7;
        color: #625B71;
        font-size: 11px;
        line-height: 1.45;
      }
      #claw-resource-manage-root .resource-manage-current-dir {
        display: flex;
        flex: 1;
        min-width: 0;
        margin: 0;
      }
      #claw-resource-manage-root .resource-manage-path {
        display: block;
        flex: 1;
        min-width: 0;
        overflow: hidden;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        text-overflow: ellipsis;
        white-space: nowrap;
        vertical-align: bottom;
      }
      #claw-resource-manage-root .resource-manage-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      #claw-resource-manage-root .claw-resource-item {
        padding: 13px !important;
        border: 1px solid #E7E0EC !important;
        border-radius: 16px !important;
        background: #FFFFFF !important;
        box-shadow: 0 1px 2px rgba(29, 27, 32, 0.04);
        transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
      }
      #claw-resource-manage-root .claw-resource-item:hover {
        border-color: #C9B8DE !important;
        box-shadow: 0 5px 16px rgba(103, 80, 164, 0.09);
        transform: translateY(-1px);
      }
      #claw-resource-manage-root .resource-item-name {
        margin: 0 0 3px !important;
        color: #1D1B20 !important;
        font-size: 13px !important;
        font-weight: 600 !important;
        line-height: 1.45;
      }
      #claw-resource-manage-root .resource-item-meta {
        margin: 0 !important;
        color: #79747E !important;
        font-size: 10px !important;
        line-height: 1.4;
      }
      #claw-resource-manage-root .resource-status-badge {
        padding: 4px 9px !important;
        border: 1px solid #B7DDB9;
        border-radius: 999px !important;
        background: #E8F5E9 !important;
        color: #1B5E20 !important;
        font-size: 10px !important;
        font-weight: 600 !important;
      }
      #claw-resource-manage-root .resource-item-abstract {
        margin: 0 !important;
        color: #625F66 !important;
        font-size: 12px !important;
        line-height: 1.55 !important;
      }
      #claw-resource-manage-root .claw-resource-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 7px !important;
        margin-top: 3px !important;
      }
      #claw-resource-manage-root .claw-resource-actions button {
        min-height: 32px;
        padding: 6px 11px !important;
        border-radius: 999px !important;
        font-family: inherit;
        font-size: 11px !important;
        font-weight: 600;
        line-height: 1.25;
      }
      #claw-resource-manage-root .claw-resource-btn-view {
        border: 1px solid #E0D4F1 !important;
        background: #F3EDF7 !important;
        color: #6750A4 !important;
      }
      #claw-resource-manage-root .claw-resource-btn-insert {
        border: 1px solid #B7DDB9 !important;
        background: #E8F5E9 !important;
        color: #1B5E20 !important;
      }
      #claw-resource-manage-root .claw-resource-btn-delete {
        border: 1px solid #F2B8B5 !important;
        background: #F9DEDC !important;
        color: #B3261E !important;
      }
      #claw-resource-manage-root button:disabled { cursor: wait !important; opacity: 0.58 !important; }
      .claw-overlay-panel--narrow #claw-resource-manage-root .resource-manage-summary { align-items: flex-start; flex-direction: column; }
      .claw-overlay-panel--narrow #claw-resource-manage-root .claw-resource-item { padding: 11px !important; border-radius: 14px !important; }
      .claw-overlay-panel--narrow #claw-resource-manage-root .claw-resource-actions .claw-resource-btn-delete { margin-left: 0 !important; }
      @media (prefers-reduced-motion: reduce) {
        #claw-resource-manage-root .resource-manage-spinner { animation: none; }
        #claw-resource-manage-root .claw-resource-item,
        #claw-resource-manage-root #claw-resource-btn-refresh { transition: none; }
      }
    </style>
    <div id="claw-resource-manage-root">
      <div id="claw-resource-toast" style="display: none;"></div>
      <div id="claw-resource-list-loading" class="resource-manage-loading">
        <span class="resource-manage-spinner" aria-hidden="true"></span>
        <p style="margin: 0; font-size: 12px;">正在加载资源列表…</p>
      </div>
      <div id="claw-resource-toolbar" style="display: none; justify-content: flex-end; margin-bottom: 8px;">
        <button id="claw-resource-btn-refresh" style="
          padding: 5px 12px;
          background: white;
          color: #6750A4;
          border: 1px solid #E0D4F1;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          刷新资源
        </button>
      </div>
      <div id="claw-resource-list-content" style="display: none;"></div>
    </div>
  `;
}

export async function initManagePanel(bodyElement) {
  if (!bodyElement) return;

  const loadingEl = bodyElement.querySelector('#claw-resource-list-loading');
  const contentEl = bodyElement.querySelector('#claw-resource-list-content');
  const toastEl = bodyElement.querySelector('#claw-resource-toast');
  const toolbarEl = bodyElement.querySelector('#claw-resource-toolbar');
  const refreshBtn = bodyElement.querySelector('#claw-resource-btn-refresh');

  if (!loadingEl || !contentEl) return;

  // 重置刷新按钮状态（重新加载时恢复可点击）
  if (refreshBtn) {
    refreshBtn.disabled = false;
    refreshBtn.style.opacity = '1';
    refreshBtn.style.cursor = 'pointer';
  }

  if (refreshBtn && !refreshBtn.dataset.bound) {
    refreshBtn.dataset.bound = 'true';
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      refreshBtn.style.opacity = '0.6';
      refreshBtn.style.cursor = 'not-allowed';
      loadingEl.style.display = 'block';
      contentEl.style.display = 'none';
      if (toolbarEl) toolbarEl.style.display = 'none';
      await initManagePanel(bodyElement);
    });
  }

  function showToast(msg, type = 'info') {
    if (!toastEl) return;
    const colors = {
      info: { bg: '#F3EDF7', border: '#E0D4F1', text: '#6750A4' },
      success: { bg: '#E8F5E9', border: '#B7DDB9', text: '#1B5E20' },
      error: { bg: '#F9DEDC', border: '#F2B8B5', text: '#B3261E' }
    };
    const c = colors[type] || colors.info;
    toastEl.style.display = 'block';
    toastEl.style.padding = '10px 12px';
    toastEl.style.borderRadius = '12px';
    toastEl.style.fontSize = '12px';
    toastEl.style.marginBottom = '8px';
    toastEl.style.background = c.bg;
    toastEl.style.border = `1px solid ${c.border}`;
    toastEl.style.color = c.text;
    toastEl.textContent = msg;
    setTimeout(() => {
      if (toastEl) {
        toastEl.style.display = 'none';
        toastEl.textContent = '';
      }
    }, 4000);
  }

  try {
    const config = await getEchoMemConfig();
    const client = createClient(config);
    const dirUri = getResourceDirUri();

    // List directory
    const lsResult = await client.fsLs(dirUri, { output: 'agent', absLimit: 128 });
    console.log('[EchoMem:manage] lsResult type:', typeof lsResult, 'isArray:', Array.isArray(lsResult), 'raw:', lsResult);
    const entries = Array.isArray(lsResult) ? lsResult : (lsResult?.entries || []);
    console.log('[EchoMem:manage] entries count:', entries.length, 'type:', typeof entries);

    if (entries.length === 0) {
      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';
      if (toolbarEl) toolbarEl.style.display = 'flex';
      contentEl.innerHTML = `
        <div class="resource-manage-empty">
          <span class="resource-manage-state-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6.5h6l2 2h10v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-11Z"/></svg>
          </span>
          <p style="margin: 0; color: #49454F; font-size: 13px; font-weight: 600;">暂无已导入资源</p>
          <p style="margin: 5px 0 0; font-size: 11px; word-break: break-word;">当前目录：${dirUri}</p>
        </div>
      `;
      return;
    }

    // Sort by modTime descending (newest first)
    entries.sort((a, b) => {
      const ta = getEntryUpdatedAt(a) ? new Date(getEntryUpdatedAt(a)).getTime() : 0;
      const tb = getEntryUpdatedAt(b) ? new Date(getEntryUpdatedAt(b)).getTime() : 0;
      return tb - ta;
    });

    // Render list
    const itemsHtml = entries.map((entry) => {
      const name = entry.name || entry.uri?.split('/').pop() || '未命名';
      const size = formatSize(getEntrySize(entry));
      const date = formatDate(getEntryUpdatedAt(entry));
      const abstractText = entry.abstract || '';
      const resourceId = getResourceIdFromUri(entry.uri);
      const contentUri = entry.uri ? `${entry.uri.replace(/\/$/, '')}/content` : '';

      return `
        <div class="claw-resource-item" data-uri="${entry.uri}" data-resource-id="${resourceId}" style="
          padding: 12px;
          background: #FFFFFF;
          border: 1px solid #E7E0EC;
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        ">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="min-width: 0; flex: 1;">
              <p class="resource-item-name" style="font-weight: 600; font-size: 13px; color: #1D1B20; margin-bottom: 2px; word-break: break-all;">${name}</p>
              <p class="resource-item-meta" style="font-size: 11px; color: #79747E;">
                <span>${size}</span>
                <span style="margin: 0 6px;">·</span>
                <span>${date}</span>
              </p>
            </div>
            <span class="resource-status-badge" style="
              padding: 2px 8px;
              border-radius: 999px;
              font-size: 11px;
              font-weight: 500;
              background: #E8F5E9;
              color: #1B5E20;
              white-space: nowrap;
              margin-left: 8px;
            ">已处理</span>
          </div>
          ${abstractText ? `<p class="resource-item-abstract" style="font-size: 12px; color: #625F66; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${abstractText}</p>` : ''}
          <div class="claw-resource-actions" style="display: flex; gap: 6px; margin-top: 4px;">
            <button class="claw-resource-btn-view" data-uri="${contentUri}" style="
              padding: 5px 10px;
              background: #F3EDF7;
              color: #6750A4;
              border: 1px solid #E0D4F1;
              border-radius: 999px;
              font-size: 12px;
              cursor: pointer;
            ">查看内容</button>
            <button class="claw-resource-btn-insert" data-uri="${contentUri}" style="
              padding: 5px 10px;
              background: #E8F5E9;
              color: #1B5E20;
              border: 1px solid #B7DDB9;
              border-radius: 999px;
              font-size: 12px;
              cursor: pointer;
            ">插入对话</button>
            <button class="claw-resource-btn-delete" data-resource-id="${resourceId}" style="
              padding: 5px 10px;
              background: #F9DEDC;
              color: #B3261E;
              border: 1px solid #F2B8B5;
              border-radius: 999px;
              font-size: 12px;
              cursor: pointer;
              margin-left: auto;
            ">删除</button>
          </div>
        </div>
      `;
    }).join('');

    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';
    if (toolbarEl) toolbarEl.style.display = 'flex';
    contentEl.innerHTML = `
      <div class="resource-manage-summary">
        <p class="resource-manage-current-dir"><span>当前目录：</span><span class="resource-manage-path">${dirUri}</span></p>
        <p style="margin: 0; white-space: nowrap;">共 ${entries.length} 个资源</p>
      </div>
      <div class="resource-manage-list">
        ${itemsHtml}
      </div>
    `;

    // Bind events
    contentEl.querySelectorAll('.claw-resource-btn-view').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const uri = btn.dataset.uri;
        if (!uri) return;
        btn.textContent = '加载中...';
        try {
          const client = createClient(await getEchoMemConfig());
          const result = await client.fsRead(uri);
          const text = typeof result === 'string' ? result : (result?.content || JSON.stringify(result, null, 2));
          const name = uri.split('/').pop() || uri;
          const previewHtml = `<div style="padding: 18px; border-radius: 14px; background: #FFFBFE; color: #49454F; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; line-height: 1.72; white-space: pre-wrap; word-break: break-word;">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
          openCenterOverlay(name, previewHtml, {
            showBack: true,
            onBack: () => closeOverlayPanel()
          });
        } catch (err) {
          showToast(`❌ 读取失败: ${err.message}`, 'error');
        }
        btn.textContent = '查看内容';
      });
    });

    contentEl.querySelectorAll('.claw-resource-btn-insert').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const uri = btn.dataset.uri;
        if (!uri) return;
        btn.textContent = '插入中...';
        try {
          const client = createClient(await getEchoMemConfig());
          const result = await client.fsRead(uri);
          const text = typeof result === 'string' ? result : (result?.content || JSON.stringify(result, null, 2));
          injectContent(text, { replace: false });
        } catch (err) {
          alert(`❌ 插入失败: ${err.message}`);
        }
        btn.textContent = '插入对话';
      });
    });

    // Delete button: open overlay confirmation
    contentEl.querySelectorAll('.claw-resource-btn-delete').forEach((btn) => {
      btn.addEventListener('click', () => {
        const resourceId = btn.dataset.resourceId;
        if (!resourceId) return;

        const dialogHtml = `
          <div class="echomem-confirm-dialog" style="padding: 18px 16px; display: flex; flex-direction: column; gap: 14px; color: #1D1B20; font-family: Roboto, 'Noto Sans SC', sans-serif;">
            <div style="text-align: center;">
              <span style="display: inline-flex; align-items: center; justify-content: center; width: 46px; height: 46px; border-radius: 16px; background: #F9DEDC; color: #B3261E;" aria-hidden="true">
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 10v6M14 10v6"/></svg>
              </span>
              <p style="font-size: 15px; color: #1D1B20; font-weight: 600; margin: 8px 0 4px;">确认删除资源</p>
              <p style="font-size: 12px; color: #625F66; line-height: 1.55; margin: 0;">确定删除资源「<strong style="color: #1D1B20; word-break: break-all;">${resourceId}</strong>」？此操作不可恢复。</p>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;">
              <button id="claw-resource-manage-del-cancel" style="
                min-width: 104px;
                min-height: 40px;
                padding: 8px 18px;
                background: #F3EDF7;
                color: #6750A4;
                border: 1px solid #E0D4F1;
                border-radius: 999px;
                font-size: 13px;
                cursor: pointer;
                font-weight: 600;
              ">取消</button>
              <button id="claw-resource-manage-del-ok" style="
                min-width: 104px;
                min-height: 40px;
                padding: 8px 18px;
                background: #B3261E;
                color: #FFFFFF;
                border: 1px solid #B3261E;
                border-radius: 999px;
                font-size: 13px;
                cursor: pointer;
                font-weight: 600;
              ">确认删除</button>
            </div>
          </div>
        `;

        openCenterOverlay('删除确认', dialogHtml, {
          width: 'min(360px, calc(100vw - 24px))',
          maxWidth: 'calc(100vw - 24px)',
          height: '240px',
          maxHeight: '280px'
        });

        setTimeout(() => {
          const cancelBtn = document.getElementById('claw-resource-manage-del-cancel');
          const okBtn = document.getElementById('claw-resource-manage-del-ok');

          cancelBtn?.addEventListener('click', () => {
            closeOverlayPanel();
          });

          okBtn?.addEventListener('click', async () => {
            closeOverlayPanel();
            btn.textContent = '删除中...';
            btn.disabled = true;
            try {
              const client = createClient(await getEchoMemConfig());
              await client.deleteResource(resourceId);
              showToast('✅ 资源已删除', 'success');
              await initManagePanel(bodyElement);
            } catch (err) {
              showToast(`❌ 删除失败: ${err.message}`, 'error');
              btn.textContent = '删除';
              btn.disabled = false;
            }
          });
        }, 50);
      });
    });
  } catch (err) {
    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';
    if (toolbarEl) toolbarEl.style.display = 'flex';
    contentEl.innerHTML = `
      <div class="resource-manage-error">
        <span class="resource-manage-state-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/></svg>
        </span>
        <p style="font-size: 13px; font-weight: 600; margin: 0 0 5px;">加载失败</p>
        <p style="font-size: 12px; margin: 0; word-break: break-word;">${err.message}</p>
        <p style="font-size: 11px; color: #79747E; margin: 7px 0 0;">目录：${getResourceDirUri()}</p>
      </div>
    `;
  }
}
