# Claw Extension 按钮功能实现细节文档

## 1. 概述

Claw Extension 在 HIGO Office 页面注入 4 个功能按钮，点击后在右侧打开对应的功能面板。本文档详细说明每个按钮的功能实现。

## 2. 按钮注入

### 2.1 按钮栏样式

```css
.claw-custom-buttons {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid #e0e0e0;
  background: rgb(255, 251, 254);
  align-items: center;
  flex-wrap: wrap;
}
```

### 2.2 按钮默认样式

```css
button {
  padding: 4px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background: #fff;
  color: #333;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}
```

### 2.3 按钮悬停效果

```css
button:hover {
  background: #667eea;
  color: #fff;
  border-color: #667eea;
}
```

### 2.4 按钮位置

插入到 `.MuiPaper-root` 容器之后：

```
┌─────────────────────────────┐
│      .MuiPaper-root         │
│  ┌─────────────────────┐    │
│  │     textarea        │    │
│  └─────────────────────┘    │
│  [发送按钮]                   │
└─────────────────────────────┘
        ↑
  按钮栏插入到这里
┌─────────────────────────────┐
│ [资源管理][输入联想][认知反馈] │
│      [skill商店]             │
└─────────────────────────────┘
```

## 3. 通用面板框架

所有按钮点击后打开的面板共享统一的框架结构：

```
┌─────────────────────────────────────┐
│  ┌───────────────────────────────┐  │
│  │  ← 返回（可选）    标题    ×  │  │  ← Header
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │                               │  │
│  │        内容区域                │  │  ← Content
│  │      （各面板不同）             │  │
│  │                               │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### 3.1 面板打开流程

```
点击按钮
    │
    ▼
openCustomPanel(title, contentHtml, options)
    │
    ├── 获取平台配置
    │       └── panel.type: 'sidebar' 或 'overlay'
    │
    ├── 根据面板类型执行不同逻辑
    │       │
    │       ├── sidebar 模式
    │       │       ├── 保存原始面板内容
    │       │       └── 替换 container.innerHTML
    │       │
    │       └── overlay 模式
    │               ├── 创建遮罩层（可选）
    │               ├── 创建浮层面板 DOM
    │               └── 触发动画滑入
    │
    └── 绑定事件
            ├── 返回按钮点击 → onBack()
            └── 关闭按钮点击 → restoreOriginalPanel()
```

### 3.2 面板关闭流程

```
点击 × 按钮
    │
    ▼
restoreOriginalPanel()
    │
    ├── 获取平台配置
    │       └── panel.type
    │
    ├── sidebar 模式
    │       └── container.innerHTML = originalPanelContent
    │
    └── overlay 模式
            ├── 触发动画滑出
            ├── 300ms 后移除浮层面板 DOM
            └── 移除遮罩层 DOM
```

## 4. 资源管理

### 4.1 功能说明

提供文件资源管理功能，支持拖拽上传和查看已上传资源。

### 4.2 面板内容

```html
<div style="color: #666;">
  <p style="margin-bottom: 12px;">📁 资源管理面板</p>

  <!-- 拖拽上传区域 -->
  <div style="
    border: 1px dashed #ccc;
    border-radius: 8px;
    padding: 24px;
    text-align: center;
    color: #999;
  ">
    <p>拖拽文件到此处上传</p>
    <p style="font-size: 12px; margin-top: 8px;">支持 PDF, DOC, TXT, MD 等格式</p>
  </div>

  <!-- 已上传资源列表 -->
  <div style="margin-top: 16px;">
    <p style="font-weight: 500; margin-bottom: 8px; color: #333;">已上传资源</p>
    <div style="
      padding: 12px;
      background: #f5f5f5;
      border-radius: 6px;
      font-size: 13px;
      color: #999;
    ">暂无资源</div>
  </div>
</div>
```

### 4.3 界面预览

```
┌─────────────────────────────┐
│  资源管理              ×    │
├─────────────────────────────┤
│                             │
│  📁 资源管理面板             │
│                             │
│  ┌─────────────────────┐    │
│  │                     │    │
│  │   拖拽文件到此处上传  │    │
│  │                     │    │
│  │ 支持 PDF,DOC,TXT,MD │    │
│  │                     │    │
│  └─────────────────────┘    │
│                             │
│  已上传资源                  │
│  ┌─────────────────────┐    │
│  │       暂无资源       │    │
│  └─────────────────────┘    │
│                             │
└─────────────────────────────┘
```

## 5. 输入联想

### 5.1 功能说明

提供输入联想功能的开关控制，显示当前状态和功能说明。

### 5.2 状态管理

```javascript
let inputAssociationEnabled = false;  // 全局状态
```

### 5.3 面板内容

根据状态动态渲染：

**关闭状态**（默认）：
- 按钮文字："确认开启"
- 按钮背景：`#667eea`（蓝色）
- 状态文字："❌ 输入联想未开启"
- 状态颜色：`#888`（灰色）

**开启状态**：
- 按钮文字："关闭联想"
- 按钮背景：`#ffebee`（浅红）
- 按钮文字颜色：`#c62828`（红色）
- 状态文字："✅ 输入联想已开启"
- 状态颜色：`#2e7d32`（绿色）

### 5.4 切换流程

```
点击开关按钮
    │
    ▼
toggleInputAssociation()
    │
    ├── inputAssociationEnabled = !inputAssociationEnabled
    │
    ├── 获取面板配置
    │       ├── sidebar 模式 → 查找 containerSelector
    │       └── overlay 模式 → 查找 currentOverlayPanel
    │
    ├── 重新渲染内容区域
    │       └── contentDiv.innerHTML = getInputAssociationContent()
    │
    └── 重新绑定按钮事件
            └── bindToggleButton()
```

### 5.5 防止重复绑定

```javascript
function bindToggleButton() {
  const toggleBtn = document.getElementById('claw-toggle-association');
  if (toggleBtn && !toggleBtn.dataset.clawBound) {
    toggleBtn.dataset.clawBound = 'true';
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleInputAssociation();
    });
  }
}
```

通过 `dataset.clawBound` 标记防止 MutationObserver 重复绑定事件。

### 5.6 界面预览

**关闭状态**：
```
┌─────────────────────────────┐
│  输入联想              ×    │
├─────────────────────────────┤
│                             │
│  ┌─────────────────────┐    │
│  │      确认开启        │    │  ← 蓝色按钮
│  └─────────────────────┘    │
│                             │
│  ┌─────────────────────┐    │
│  │   ❌ 输入联想未开启   │    │  ← 灰色
│  └─────────────────────┘    │
│                             │
│  💡 功能说明                 │
│  • 智能补全                  │
│  • 代码片段联想              │
│  • 历史记录联想              │
│                             │
│  💡 提示：输入时按 Tab...    │
│                             │
└─────────────────────────────┘
```

**开启状态**：
```
┌─────────────────────────────┐
│  输入联想              ×    │
├─────────────────────────────┤
│                             │
│  ┌─────────────────────┐    │
│  │      关闭联想        │    │  ← 红色按钮
│  └─────────────────────┘    │
│                             │
│  ┌─────────────────────┐    │
│  │   ✅ 输入联想已开启   │    │  ← 绿色
│  └─────────────────────┘    │
│                             │
│  ...                        │
└─────────────────────────────┘
```

## 6. 认知反馈

### 6.1 功能说明

显示当前会话的统计分析数据，包括对话轮次、响应时间、Token 消耗等。

### 6.2 面板内容

```html
<div style="color: #666;">
  <p style="margin-bottom: 12px;">🧠 认知反馈面板</p>

  <!-- 会话统计 -->
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

  <!-- 生成报告按钮 -->
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
```

### 6.3 界面预览

```
┌─────────────────────────────┐
│  认知反馈              ×    │
├─────────────────────────────┤
│                             │
│  🧠 认知反馈面板             │
│                             │
│  ┌─────────────────────┐    │
│  │   当前会话分析       │    │
│  │                     │    │
│  │  对话轮次         0  │    │
│  │  平均响应时间    --  │    │
│  │  Token 消耗      0  │    │
│  └─────────────────────┘    │
│                             │
│  ┌─────────────────────┐    │
│  │    生成反馈报告      │    │
│  └─────────────────────┘    │
│                             │
└─────────────────────────────┘
```

## 7. Skill 商店

### 7.1 功能说明

提供 Skill 的浏览、购买、上传和管理功能。采用层级导航设计，首页显示板块列表，点击进入详情页。

### 7.2 导航系统

```
skill商店首页
    │
    ├── 点击 📜 用户历史 Skill
    │       └── 打开详情页（带返回按钮）
    │               └── 点击 ← 返回首页
    │
    ├── 点击 ⬆️ 上传 Skill 到商店
    │       └── 打开详情页（带返回按钮）
    │               └── 点击 ← 返回首页
    │
    ├── 点击 🛒 商店 Skill 购买
    │       └── 打开详情页（带返回按钮）
    │               └── 点击 ← 返回首页
    │
    ├── 点击 🏪 商家提供的 Skill
    │       └── 打开详情页（带返回按钮）
    │               └── 点击 ← 返回首页
    │
    └── 点击 ⚙️ Skill 安装管理
            └── 打开详情页（带返回按钮）
                    └── 点击 ← 返回首页
```

### 7.3 首页实现

```javascript
function getSkillStoreHomeContent() {
  const sections = [
    { id: 'history', title: '📜 用户历史 Skill', desc: '查看和管理你使用过的 Skill', color: '#667eea' },
    { id: 'upload', title: '⬆️ 上传 Skill 到商店', desc: '上传你的自定义 Skill 到商店', color: '#42a5f5' },
    { id: 'purchase', title: '🛒 商店 Skill 购买', desc: '浏览和购买商店中的 Skill', color: '#66bb6a' },
    { id: 'merchant', title: '🏪 商家提供的 Skill', desc: '官方和认证商家的 Skill', color: '#ffa726' },
    { id: 'manage', title: '⚙️ Skill 安装管理', desc: '管理已安装的 Skill', color: '#ef5350' }
  ];

  // 生成卡片列表
  return sections.map(s => `
    <div class="claw-skill-section" data-section="${s.id}"
         style="padding: 16px; border: 1px solid #e0e0e0; border-radius: 10px; cursor: pointer;"
         onmouseenter="..." onmouseleave="..."
    >
      <div>${s.title.split(' ')[0]}</div>  <!-- 图标 -->
      <div>
        <p>${s.title.split(' ').slice(1).join(' ')}</p>  <!-- 标题 -->
        <p>${s.desc}</p>  <!-- 描述 -->
      </div>
      <svg>></svg>  <!-- 箭头图标 -->
    </div>
  `).join('');
}
```

### 7.4 详情页导航

```javascript
function navigateToSkillSection(sectionId) {
  const contents = {
    'history': getSkillHistoryContent(),
    'upload': getSkillUploadContent(),
    'purchase': getSkillPurchaseContent(),
    'merchant': getSkillMerchantContent(),
    'manage': getSkillManageContent()
  };

  const titles = {
    'history': '用户历史 Skill',
    'upload': '上传 Skill 到商店',
    'purchase': '商店 Skill 购买',
    'merchant': '商家提供的 Skill',
    'manage': 'Skill 安装管理'
  };

  openCustomPanel(titles[sectionId], contents[sectionId], {
    showBack: true,
    onBack: () => {
      openCustomPanel('skill商店', getSkillStoreHomeContent());
    }
  });
}
```

### 7.5 卡片点击事件绑定

通过事件委托绑定，避免 innerHTML 替换后事件丢失：

```javascript
const skillPanel = document.querySelector('.claw-custom-panel');
if (skillPanel && !skillPanel.dataset.clawEventsBound) {
  skillPanel.dataset.clawEventsBound = 'true';
  skillPanel.addEventListener('click', (e) => {
    const card = e.target.closest('.claw-skill-section');
    if (card) {
      const sectionId = card.dataset.section;
      if (sectionId) {
        navigateToSkillSection(sectionId);
      }
    }
  });
}
```

### 7.6 界面预览

**首页**：
```
┌─────────────────────────────┐
│  skill商店             ×    │
├─────────────────────────────┤
│                             │
│  ┌─────────────────────┐    │
│  │ 📜  用户历史 Skill  > │    │
│  │     查看和管理...    │    │
│  └─────────────────────┘    │
│                             │
│  ┌─────────────────────┐    │
│  │ ⬆️  上传 Skill...   > │    │
│  │     上传你的自定义... │    │
│  └─────────────────────┘    │
│                             │
│  ┌─────────────────────┐    │
│  │ 🛒  商店 Skill 购买 > │    │
│  │     浏览和购买...    │    │
│  └─────────────────────┘    │
│                             │
│  ┌─────────────────────┐    │
│  │ 🏪  商家提供的...   > │    │
│  │     官方和认证...    │    │
│  └─────────────────────┘    │
│                             │
│  ┌─────────────────────┐    │
│  │ ⚙️  Skill 安装管理  > │    │
│  │     管理已安装...    │    │
│  └─────────────────────┘    │
│                             │
└─────────────────────────────┘
```

**详情页（以用户历史 Skill 为例）**：
```
┌─────────────────────────────┐
│ ←  用户历史 Skill      ×    │
├─────────────────────────────┤
│                             │
│  ┌─────────────────────┐    │
│  │ SQL 查询助手     已启用 │    │
│  │ 上次使用: 2天前      │    │
│  └─────────────────────┘    │
│                             │
│  ┌─────────────────────┐    │
│  │ JSON 格式化      已停用 │    │
│  │ 上次使用: 1周前      │    │
│  └─────────────────────┘    │
│                             │
│  ┌─────────────────────┐    │
│  │ 正则表达式工具   已启用 │    │
│  │ 上次使用: 3天前      │    │
│  └─────────────────────┘    │
│                             │
└─────────────────────────────┘
```

## 8. 各板块详情

### 8.1 用户历史 Skill

显示用户使用过的 Skill 列表，包含：
- Skill 名称
- 使用次数
- 上次使用时间
- 启用状态（已启用/已停用）

### 8.2 上传 Skill 到商店

提供上传功能：
- 拖拽上传区域
- 支持格式：.skill, .json, .yaml
- 上传须知说明
- 上传记录列表

### 8.3 商店 Skill 购买

展示可购买的 Skill：
- Skill 图标和名称
- 评分和销量
- 开发者信息
- 价格标签

### 8.4 商家提供的 Skill

展示官方和认证商家的 Skill：
- 官方标识
- 认证商家标识
- Skill 功能描述

### 8.5 Skill 安装管理

管理已安装的 Skill：
- Skill 版本信息
- 占用空间
- 更新按钮
- 卸载按钮
- 一键卸载全部

## 9. 面板系统实现

### 9.1 支持两种面板模式

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| `sidebar` | 替换页面现有侧边栏 | 有右侧边栏的页面 |
| `overlay` | 创建浮层面板 | 无侧边栏的页面 |

### 9.2 Sidebar 模式实现

```javascript
if (panelConfig.type === 'sidebar') {
  const container = document.querySelector(panelConfig.containerSelector);
  if (!container) return;

  // 先保存原始内容
  if (!originalPanelContent) {
    originalPanelContent = container.innerHTML;
  }

  container.innerHTML = panelHtml;
  bindPanelEvents(container, showBack, onBack);
}
```

### 9.3 Overlay 模式实现

```javascript
function createOverlayPanel(panelHtml, overlayConfig) {
  // 移除已存在的浮层面板
  if (currentOverlayPanel) {
    currentOverlayPanel.remove();
  }

  // 创建遮罩层
  let backdrop = null;
  if (overlayConfig.backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'claw-overlay-backdrop';
    backdrop.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 9998;
    `;
    backdrop.addEventListener('click', restoreOriginalPanel);
    document.body.appendChild(backdrop);
  }

  // 创建浮层面板
  const overlay = document.createElement('div');
  overlay.className = 'claw-overlay-panel';

  const position = overlayConfig.position || 'right';
  const width = overlayConfig.width || '400px';

  // 根据位置设置样式
  let positionStyles = '';
  if (position === 'right') {
    positionStyles = `
      top: 0; right: 0; bottom: 0;
      width: ${width};
      transform: translateX(100%);
    `;
  } else if (position === 'left') {
    positionStyles = `
      top: 0; left: 0; bottom: 0;
      width: ${width};
      transform: translateX(-100%);
    `;
  } else if (position === 'center') {
    positionStyles = `
      top: 50%; left: 50%;
      width: ${width}; max-height: 80vh;
      transform: translate(-50%, -50%) scale(0.9);
      border-radius: 12px;
    `;
  }

  overlay.style.cssText = `
    position: fixed;
    ${positionStyles}
    background: #fff;
    z-index: 9999;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    transition: transform 0.3s ease;
    overflow: hidden;
  `;

  overlay.innerHTML = panelHtml;
  document.body.appendChild(overlay);

  // 触发动画
  requestAnimationFrame(() => {
    if (position === 'right' || position === 'left') {
      overlay.style.transform = 'translateX(0)';
    } else if (position === 'center') {
      overlay.style.transform = 'translate(-50%, -50%) scale(1)';
    }
  });

  currentOverlayPanel = overlay;
}
```

### 9.4 关闭动画

```javascript
if (panelConfig.type === 'overlay') {
  if (currentOverlayPanel) {
    const position = panelConfig.overlayConfig?.position || 'right';

    // 添加关闭动画
    if (position === 'right') {
      currentOverlayPanel.style.transform = 'translateX(100%)';
    } else if (position === 'left') {
      currentOverlayPanel.style.transform = 'translateX(-100%)';
    } else if (position === 'center') {
      currentOverlayPanel.style.transform = 'translate(-50%, -50%) scale(0.9)';
      currentOverlayPanel.style.opacity = '0';
    }

    // 动画结束后移除元素
    setTimeout(() => {
      if (currentOverlayPanel) {
        currentOverlayPanel.remove();
        currentOverlayPanel = null;
      }
    }, 300);
  }

  // 移除遮罩层
  const backdrop = document.querySelector('.claw-overlay-backdrop');
  if (backdrop) {
    backdrop.style.opacity = '0';
    setTimeout(() => backdrop.remove(), 300);
  }
}
```

## 10. 文件位置

- 面板框架实现：`/content.js`（第 229-586 行）
- 资源管理内容：`/content.js`（第 589-604 行）
- 输入联想内容：`/content.js`（第 706-770 行）
- 认知反馈内容：`/content.js`（第 614-641 行）
- Skill 商店实现：`/content.js`（第 717-1027 行）
- 本设计文档：`/docs/design/button-features.md`
