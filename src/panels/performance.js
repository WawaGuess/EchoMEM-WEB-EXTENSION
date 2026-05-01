export function getPerformanceContent() {
  const metrics = [
    { label: '今日会话', value: '0' },
    { label: 'Skill 使用', value: '0' },
    { label: '联想触发', value: '0' },
    { label: '资源引用', value: '0' }
  ];

  const metricCards = metrics.map(metric => `
    <div style="
      padding: 14px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      background: #f9fafb;
    ">
      <p style="margin: 0 0 6px; font-size: 12px; color: #6b7280;">${metric.label}</p>
      <p style="margin: 0; font-size: 22px; font-weight: 700; color: #111827;">${metric.value}</p>
    </div>
  `).join('');

  return `
    <div style="color: #374151;">
      <p style="margin: 0 0 14px; font-size: 13px; color: #6b7280; line-height: 1.6;">
        当前为效能概览占位，后续可接入真实会话、Skill、联想和资源引用数据。
      </p>
      <div style="
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin-bottom: 16px;
      ">
        ${metricCards}
      </div>
      <div style="
        padding: 14px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        background: #fff;
      ">
        <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #111827;">最近状态</p>
        <p style="margin: 0; font-size: 13px; color: #9ca3af;">暂无效能数据</p>
      </div>
    </div>
  `;
}
