// 资源管理列表页面

import { getOpenVikingConfig } from '../../services/config.js';
import { createClient } from '../../services/openviking-client.js';
import { getCurrentPlatform } from '../../core/detection.js';
import { injectContent } from '../../core/content-injector.js';

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
  const platform = getPlatformKey();
  const month = getCurrentMonthDir();
  return `viking://resources/${platform}/${month}`;
}

export function getResourceManageContent() {
  return `
    <div style="display: flex; flex-direction: column; gap: 12px; color: #333;">
      <div id="claw-resource-list-loading" style="text-align: center; padding: 40px 20px; color: #888;">
        <p style="font-size: 14px;">⏳ 正在加载资源列表...</p>
      </div>
      <div id="claw-resource-list-content" style="display: none;"></div>
    </div>
  `;
}

function formatSize(bytes) {
  if (!bytes || bytes < 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ts) {
  if (!ts) return '-';
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function initManagePanel(bodyElement) {
  if (!bodyElement) return;

  const loadingEl = bodyElement.querySelector('#claw-resource-list-loading');
  const contentEl = bodyElement.querySelector('#claw-resource-list-content');

  if (!loadingEl || !contentEl) return;

  try {
    const config = await getOpenVikingConfig();
    const client = createClient(config);
    const dirUri = getResourceDirUri();

    // Step 1: ensure directory exists
    try {
      await client.fsMkdir(dirUri, `Resources for ${getPlatformKey()}`);
    } catch (mkdirErr) {
      // ignore "already exists" or similar errors
      if (!mkdirErr.message?.toLowerCase().includes('exist')) {
        console.warn('EchoMem: mkdir warning', mkdirErr.message);
      }
    }

    // Step 2: list directory
    const lsResult = await client.fsLs(dirUri, { output: 'agent', absLimit: 128 });
    const entries = lsResult?.entries || lsResult || [];

    if (entries.length === 0) {
      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';
      contentEl.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: #999;">
          <p style="font-size: 36px; margin-bottom: 12px;">📂</p>
          <p style="font-size: 14px;">暂无已导入资源</p>
          <p style="font-size: 12px; margin-top: 6px;">当前目录: ${dirUri}</p>
        </div>
      `;
      return;
    }

    // Step 3: stat each entry for richer info
    const enrichedEntries = await Promise.all(
      entries.map(async (entry) => {
        try {
          const stat = await client.fsStat(entry.uri);
          return { ...entry, stat };
        } catch {
          return { ...entry, stat: null };
        }
      })
    );

    // Render list
    const itemsHtml = enrichedEntries.map((entry) => {
      const name = entry.name || entry.uri?.split('/').pop() || '未命名';
      const size = formatSize(entry.stat?.size);
      const date = formatDate(entry.stat?.mtime);
      const abstractText = entry.abstract || '';
      const isReady = abstractText && !abstractText.includes('not ready');
      const statusText = isReady ? '✅ 已处理' : '⏳ 处理中';
      const statusColor = isReady ? '#15803d' : '#d97706';

      return `
        <div class="claw-resource-item" data-uri="${entry.uri}" style="
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
              background: ${statusColor}15;
              color: ${statusColor};
              white-space: nowrap;
              margin-left: 8px;
            ">${statusText}</span>
          </div>
          ${isReady ? `<p style="font-size: 12px; color: #4b5563; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${abstractText}</p>` : ''}
          <div style="display: flex; gap: 6px; margin-top: 4px;">
            <button class="claw-resource-btn-view" data-uri="${entry.uri}" style="
              padding: 5px 10px;
              background: #eff6ff;
              color: #2563eb;
              border: 1px solid #bfdbfe;
              border-radius: 5px;
              font-size: 12px;
              cursor: pointer;
            ">查看内容</button>
            <button class="claw-resource-btn-insert" data-uri="${entry.uri}" style="
              padding: 5px 10px;
              background: #f0fdf4;
              color: #15803d;
              border: 1px solid #bbf7d0;
              border-radius: 5px;
              font-size: 12px;
              cursor: pointer;
            ">插入对话</button>
            <button class="claw-resource-btn-delete" data-uri="${entry.uri}" style="
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
    contentEl.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <p style="font-size: 12px; color: #6b7280;">当前目录: <span style="font-family: monospace;">${dirUri}</span></p>
        <p style="font-size: 12px; color: #6b7280;">共 ${enrichedEntries.length} 个资源</p>
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
          const client = createClient(await getOpenVikingConfig());
          const result = await client.contentOverview(uri);
          const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
          alert(`📄 ${uri}\n\n${text.slice(0, 2000)}${text.length > 2000 ? '\n\n...(内容已截断)' : ''}`);
        } catch (err) {
          alert(`❌ 读取失败: ${err.message}`);
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
          const client = createClient(await getOpenVikingConfig());
          const result = await client.contentOverview(uri);
          const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
          injectContent(text, { replace: false });
        } catch (err) {
          alert(`❌ 插入失败: ${err.message}`);
        }
        btn.textContent = '插入对话';
      });
    });

    contentEl.querySelectorAll('.claw-resource-btn-delete').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const uri = btn.dataset.uri;
        if (!uri) return;
        if (!confirm('确定要删除该资源吗？此操作不可恢复。')) return;
        btn.textContent = '删除中...';
        try {
          const client = createClient(await getOpenVikingConfig());
          await client.fsRm(uri, false);
          // Refresh list
          await initManagePanel(bodyElement);
        } catch (err) {
          alert(`❌ 删除失败: ${err.message}`);
          btn.textContent = '删除';
        }
      });
    });
  } catch (err) {
    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';
    contentEl.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: #b91c1c; background: #fef2f2; border-radius: 8px;">
        <p style="font-size: 14px; margin-bottom: 6px;">❌ 加载失败</p>
        <p style="font-size: 12px;">${err.message}</p>
        <p style="font-size: 11px; color: #888; margin-top: 8px;">目录: ${getResourceDirUri()}</p>
      </div>
    `;
  }
}
