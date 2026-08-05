#!/usr/bin/env bash
set -euo pipefail

# 打包 EchoMem 公网版和内网版发行包
# 用法：./scripts/package-release.sh [public|intranet|all]
# 默认输出两个目录：
#   release/EchoMem-Extension-Public/
#   release/EchoMem-Extension-Intranet/

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROFILE="${1:-all}"

exec node "${SCRIPT_DIR}/package-release.mjs" "${PROFILE}"
