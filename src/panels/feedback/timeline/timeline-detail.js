// Episode 详情面板：复用认知图谱右侧滑出面板的深色玻璃拟态风格。
import { EVENT_TYPE_META } from '../../../services/episode-client.js';
import { formatFull } from './timeline-scale.js';

const STATUS_LABEL = {
  ongoing: '进行中', closed: '已结束', merged: '已合并', stale: '已沉寂',
};
const ARC_LABEL = {
  beginning: '起始', middle: '进行', end: '收尾', ongoing: '长期',
};

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function tag(text, color) {
  return `<span style="display:inline-block;padding:2px 8px;margin:2px 4px 2px 0;background:rgba(0,230,255,0.08);border:1px solid ${color};border-radius:2px;color:${color};font-size:11px;">${esc(text)}</span>`;
}

/**
 * 创建详情面板 DOM（一次），返回控制器。
 */
export function createDetailPanel(container) {
  const panel = document.createElement('div');
  panel.className = 'echomem-timeline-detail';
  panel.style.cssText = `
    position:absolute; top:16px; right:16px; width:340px; max-height:calc(100% - 32px);
    padding:18px 22px; overflow-y:auto;
    background:rgba(2,8,20,0.9); backdrop-filter:blur(20px);
    border:1px solid rgba(0,230,255,0.18); border-radius:8px;
    color:#cceeff; font-family:"JetBrains Mono","PingFang SC","Microsoft YaHei",monospace;
    z-index:12; transform:translateX(calc(100% + 32px));
    transition:transform 0.4s cubic-bezier(0.16,1,0.3,1);
  `;
  panel.innerHTML = `
    <button class="echomem-detail-close" style="position:absolute;top:12px;right:12px;width:24px;height:24px;background:rgba(0,230,255,0.08);border:1px solid rgba(0,230,255,0.2);color:#00e6ff;cursor:pointer;font-size:16px;line-height:1;">&times;</button>
    <div class="echomem-detail-content" style="font-size:12px;line-height:1.6;"></div>
  `;
  container.appendChild(panel);

  const closeBtn = panel.querySelector('.echomem-detail-close');
  const content = panel.querySelector('.echomem-detail-content');
  closeBtn.addEventListener('click', () => hide());

  function hide() {
    panel.style.transform = 'translateX(calc(100% + 32px))';
  }

  function showEpisode(ep) {
    if (!ep) return;
    let html = '';
    html += `<h2 style="margin:0 0 12px;font-size:15px;color:#00e6ff;letter-spacing:1px;">${esc(ep.title)}</h2>`;
    html += row('状态', `${STATUS_LABEL[ep.status] || ep.status} · ${ARC_LABEL[ep.arcStage] || ep.arcStage}`);
    html += row('时间', `${formatFull(ep.startTime)} → ${formatFull(ep.endTime)}`);
    html += row('轮次 / 显著度', `${ep.turnCount} 轮 · ${ep.salience.toFixed(2)}`);
    if (ep.summary) html += block('摘要', esc(ep.summary));
    if (ep.topics.length) html += block('主题', ep.topics.map((t) => tag(t, '#00e6ff')).join(''));
    if (ep.entities.length) html += block('实体', ep.entities.map((t) => tag(t, '#667eea')).join(''));
    if (ep.segments.length) {
      html += block('跨会话片段', ep.segments.map((s) =>
        `<div style="font-size:11px;color:#9fc;margin-bottom:3px;">${esc(s.sessionId).slice(0, 12)}… [${s.startMsgIdx}-${s.endMsgIdx}]</div>`
      ).join(''));
    }
    if (ep.events.length) {
      const items = ep.events.map((ev) => {
        const meta = EVENT_TYPE_META[ev.type] || EVENT_TYPE_META.observation;
        return `<div style="margin-bottom:8px;padding:8px 10px;background:rgba(0,150,255,0.05);border-left:2px solid ${meta.color};border-radius:4px;">
          <div style="color:${meta.color};font-size:10px;text-transform:uppercase;letter-spacing:1px;">${meta.label} · ${esc(formatFull(ev.time))}</div>
          <div style="color:#e0f0ff;margin-top:2px;">${esc(ev.description)}</div>
        </div>`;
      }).join('');
      html += block(`事件链 (${ep.events.length})`, items);
    }
    content.innerHTML = html;
    panel.style.transform = 'translateX(0)';
  }

  function showEvent(ep, ev) {
    if (!ev) return;
    const meta = EVENT_TYPE_META[ev.type] || EVENT_TYPE_META.observation;
    let html = '';
    html += `<h2 style="margin:0 0 12px;font-size:14px;color:${meta.color};letter-spacing:1px;">${meta.label}</h2>`;
    html += row('所属 Episode', esc(ep?.title || ev.episodeId));
    html += row('时间', formatFull(ev.time));
    html += row('置信度', ev.confidence.toFixed(2));
    if (ev.sourceTurnId) html += row('来源轮次', esc(ev.sourceTurnId));
    html += block('描述', esc(ev.description));
    content.innerHTML = html;
    panel.style.transform = 'translateX(0)';
  }

  function destroy() {
    if (panel.parentNode) panel.parentNode.removeChild(panel);
  }

  return { showEpisode, showEvent, hide, destroy };
}

function row(label, value) {
  return `<div style="margin-bottom:10px;"><div style="color:#6688aa;font-size:10px;text-transform:uppercase;letter-spacing:1px;">${esc(label)}</div><div style="color:#e0f0ff;">${value}</div></div>`;
}
function block(label, inner) {
  return `<div style="margin-bottom:12px;"><div style="color:#6688aa;font-size:10px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">${esc(label)}</div><div>${inner}</div></div>`;
}
