#!/bin/bash
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "未检测到 Node.js，请先安装 Node.js 18 或更高版本。"
  read -n 1 -s -r -p "按任意键退出"
  exit 1
fi

(sleep 1; open "http://localhost:4599") &
node "launcher/server.js"
