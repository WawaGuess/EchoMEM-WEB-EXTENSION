#!/usr/bin/env bash
set -euo pipefail

# 打包 EchoMem 扩展发行包
# 用法：./scripts/package-release.sh
# 输出：release/EchoMem-Extension/

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
RELEASE_DIR="${PROJECT_ROOT}/release/EchoMem-Extension"

echo "==> 开始打包 EchoMem 扩展发行包"

# 清理旧目录
rm -rf "${RELEASE_DIR}"
mkdir -p "${RELEASE_DIR}"

# 复制扩展运行所需文件
cp "${PROJECT_ROOT}/manifest.json" "${RELEASE_DIR}/"
cp "${PROJECT_ROOT}/background.js" "${RELEASE_DIR}/"
cp "${PROJECT_ROOT}/popup.html" "${RELEASE_DIR}/"
cp "${PROJECT_ROOT}/popup.css" "${RELEASE_DIR}/"
cp "${PROJECT_ROOT}/popup.js" "${RELEASE_DIR}/"
cp "${PROJECT_ROOT}/content.css" "${RELEASE_DIR}/"
cp -R "${PROJECT_ROOT}/dist" "${RELEASE_DIR}/"
cp -R "${PROJECT_ROOT}/icons" "${RELEASE_DIR}/"
if [ -d "${PROJECT_ROOT}/assets" ]; then
  cp -R "${PROJECT_ROOT}/assets" "${RELEASE_DIR}/"
fi

# 生成简化版 README
cat > "${RELEASE_DIR}/README.md" <<'EOF'
# EchoMem Web Extension

EchoMem 浏览器扩展（开发版加载包）。

## 安装方法

无需安装 npm，只需要 Chrome 或 Edge 浏览器。

1. 解压本压缩包
2. 打开 Chrome 或 Edge 浏览器，地址栏输入 `chrome://extensions/`（Edge 为 `edge://extensions/`）
3. 右上角开启「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择解压后的 `EchoMem-Extension` 文件夹
6. 扩展图标将出现在浏览器工具栏中

## 使用

访问支持的平台页面（HIGO Office、DeepSeek），即可看到 EchoMem 入口按钮。
EOF

echo "==> 打包完成：${RELEASE_DIR}"
