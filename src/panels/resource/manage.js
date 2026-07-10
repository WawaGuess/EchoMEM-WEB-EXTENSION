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
    <div style="display: flex; flex-direction: column; gap: 12px; color: #333;">
      <div id="claw-resource-toast" style="display: none;"></div>
      <div id="claw-resource-list-loading" style="text-align: center; padding: 40px 20px; color: #888;">
        <p style="font-size: 14px;">⏳ 正在加载资源列表...</p>
      </div>
      <div id="claw-resource-toolbar" style="display: none; justify-content: flex-end; margin-bottom: 8px;">
        <button id="claw-resource-btn-refresh" style="
          padding: 5px 12px;
          background: white;
          color: #374151;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          刷新
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
      info: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
      success: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
      error: { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' }
    };
    const c = colors[type] || colors.info;
    toastEl.style.display = 'block';
    toastEl.style.padding = '10px 12px';
    toastEl.style.borderRadius = '6px';
    toastEl.style.fontSize = '13px';
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
    let entries = Array.isArray(lsResult) ? lsResult : (lsResult?.entries || []);
    entries = entries.filter((e) => (e.name || e.uri?.split('/').pop() || '') !== '.idx');
    console.log('[EchoMem:manage] entries count:', entries.length, 'type:', typeof entries);

    if (entries.length === 0) {
      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';
      if (toolbarEl) toolbarEl.style.display = 'flex';
      contentEl.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: #999;">
          <p style="font-size: 36px; margin-bottom: 12px;">📂</p>
          <p style="font-size: 14px;">暂无已导入资源</p>
          <p style="font-size: 12px; margin-top: 6px;">当前目录: ${dirUri}</p>
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
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        ">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="min-width: 0; flex: 1;">
              <p style="font-weight: 600; font-size: 13px; color: #111827; margin-bottom: 2px; word-break: break-all;">${name}</p>
              <p style="font-size: 11px; color: #6b7280;">
                <span>${size}</span>
                <span style="margin: 0 6px;">·</span>
                <span>${date}</span>
              </p>
            </div>
            <span style="
              padding: 2px 8px;
              border-radius: 999px;
              font-size: 11px;
              font-weight: 500;
              background: #15803d15;
              color: #15803d;
              white-space: nowrap;
              margin-left: 8px;
            ">已处理</span>
          </div>
          ${abstractText ? `<p style="font-size: 12px; color: #4b5563; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${abstractText}</p>` : ''}
          <div class="claw-resource-actions" style="display: flex; gap: 6px; margin-top: 4px;">
            <button class="claw-resource-btn-view" data-uri="${contentUri}" style="
              padding: 5px 10px;
              background: #eff6ff;
              color: #2563eb;
              border: 1px solid #bfdbfe;
              border-radius: 5px;
              font-size: 12px;
              cursor: pointer;
            ">查看内容</button>
            <button class="claw-resource-btn-insert" data-uri="${contentUri}" style="
              padding: 5px 10px;
              background: #f0fdf4;
              color: #15803d;
              border: 1px solid #bbf7d0;
              border-radius: 5px;
              font-size: 12px;
              cursor: pointer;
            ">插入对话</button>
            <button class="claw-resource-btn-delete" data-resource-id="${resourceId}" style="
              padding: 5px 10px;
              background: #fef2f2;
              color: #dc2626;
              border: 1px solid #fecaca;
              border-radius: 5px;
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
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <p style="font-size: 12px; color: #6b7280;">当前目录: <span style="font-family: monospace;">${dirUri}</span></p>
        <p style="font-size: 12px; color: #6b7280;">共 ${entries.length} 个资源</p>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
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
          const previewHtml = `<div style="padding: 16px 18px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; line-height: 1.7; color: #374151; white-space: pre-wrap; word-break: break-word;">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
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
          <div style="padding: 12px 16px; display: flex; flex-direction: column; gap: 10px;">
            <div style="text-align: center;">
              <p style="font-size: 24px; margin: 0; line-height: 1;">🗑️</p>
              <p style="font-size: 15px; color: #333; font-weight: 500; margin: 4px 0 2px;">确认删除资源</p>
              <p style="font-size: 12px; color: #666; line-height: 1.4; margin: 0;">确定删除资源「<strong style="color: #111;">${resourceId}</strong>」？此操作不可恢复。</p>
            </div>
            <div style="display: flex; gap: 10px; justify-content: center;">
              <button id="claw-resource-manage-del-cancel" style="
                padding: 8px 20px;
                background: #f3f4f6;
                color: #374151;
                border: 1px solid #d1d5db;
                border-radius: 8px;
                font-size: 13px;
                cursor: pointer;
                font-weight: 500;
              ">取消</button>
              <button id="claw-resource-manage-del-ok" style="
                padding: 8px 20px;
                background: #ef5350;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 13px;
                cursor: pointer;
                font-weight: 500;
              ">确认删除</button>
            </div>
          </div>
        `;

        openCenterOverlay('删除确认', dialogHtml, {
          width: '360px',
          maxWidth: '360px',
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
      <div style="text-align: center; padding: 40px 20px; color: #b91c1c; background: #fef2f2; border-radius: 8px;">
        <p style="font-size: 14px; margin-bottom: 6px;">❌ 加载失败</p>
        <p style="font-size: 12px;">${err.message}</p>
        <p style="font-size: 11px; color: #888; margin-top: 8px;">目录: ${getResourceDirUri()}</p>
      </div>
    `;
  }
}
