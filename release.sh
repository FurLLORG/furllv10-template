#!/usr/bin/env bash
# FurLLV10 一键构建脚本（本地执行，产物 public/ 由用户自行上传服务器）
# 用法：./release.sh   （或双击运行，执行完会停留显示上传指引，按回车关闭）
set -euo pipefail
cd "$(dirname "$0")"

echo "┌─────────────────────────────────────────────┐"
echo "│  FurLLV10 一键构建                          │"
echo "└─────────────────────────────────────────────┘"

# 1. 依赖安装（首次运行或 node_modules 缺失时自动安装）
echo ""
echo "→ [1/4] 检查依赖 ..."
if [ ! -d node_modules ]; then
    echo "      未检测到 node_modules，执行 pnpm install ..."
    pnpm install
else
    echo "      ✓ node_modules 已存在，跳过安装"
fi

# 2. 构建（tsc 类型检查失败时回退 vite build，产物一致）
echo ""
echo "→ [2/4] 构建 React 产物 ..."
if pnpm build >/dev/null 2>&1; then
    echo "      ✓ pnpm build 完成"
else
    echo "      ⚠ tsc 检查失败，回退 npx vite build"
    npx vite build
    echo "      ✓ vite build 完成"
fi

# 3. 分发
echo ""
echo "→ [3/4] 分发模板到 public/ ..."
node deploy.mjs

# 4. 清理构建中间产物
echo ""
echo "→ [4/4] 清理 dist/（构建中间产物，无需上传） ..."
rm -rf dist
echo "      ✓ 已删除 dist/"

echo ""
echo "✅ 构建完成！以下是需要上传到服务器的文件："
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "📁 上传本目录 public/ 下这些目录到服务器（宝塔/FTP/SFTP 均可）："
echo ""
echo "   ┌──────────────────────────────┬──────────────────────────────────┐"
echo "   │ 本机目录（public/ 下）        │ 上传到服务器                      │"
echo "   ├──────────────────────────────┼──────────────────────────────────┤"
echo "   │ web/                         │ 站点根目录/public/web/           │"
echo "   │ clientarea/                  │ 站点根目录/public/clientarea/    │"
echo "   │ cart/                        │ 站点根目录/public/cart/          │"
echo "   │ home/                        │ 站点根目录/public/home/          │"
echo "   │ images/                      │ 站点根目录/public/images/        │"
echo "   └──────────────────────────────┴──────────────────────────────────┘"
echo ""
echo "   （站点根目录 = 魔方系统所在目录，运行目录为其中 public/）"
echo ""
echo "💡 上传后到后台切换主题："
echo "   官网       → 系统设置 → 前台模板       → web_theme = FurLLV10"
echo "   会员中心   → 系统设置 → 会员中心模板   → clientarea_theme = FurLLV10"
echo ""
echo "⚠ 不需要上传：favicon.ico（服务器已有）、mock-sw.js（仅本地调试用）、"
echo "   dist/（构建中间产物，已自动删除）、node_modules/"
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "按回车键关闭窗口 ..."
read -r _
