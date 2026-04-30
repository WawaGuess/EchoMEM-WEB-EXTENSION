// 认知反馈面板内容

export function getFeedbackContent() {
  return `
    <div style="color: #666;">
      <p style="margin-bottom: 12px;">🧠 认知反馈面板</p>
      <div style="
        padding: 16px;
        background: #f8f9fa;
        border-radius: 8px;
        margin-bottom: 12px;
      ">
        <p style="font-weight: 500; color: #333; margin-bottom: 8px;">当前会话分析</p>
        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
          <span>对话轮次</span>
          <span style="color: #333; font-weight: 500;">0</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
          <span>平均响应时间</span>
          <span style="color: #333; font-weight: 500;">--</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 13px;">
          <span>Token 消耗</span>
          <span style="color: #333; font-weight: 500;">0</span>
        </div>
      </div>
      <button style="
        width: 100%;
        padding: 10px;
        background: #667eea;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
      ">生成反馈报告</button>
    </div>
  `;
}
