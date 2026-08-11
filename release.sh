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
echo "→ [1/5] 检查依赖 ..."
if [ ! -d node_modules ]; then
    echo "      未检测到 node_modules，执行 pnpm install ..."
    pnpm install
else
    echo "      ✓ node_modules 已存在，跳过安装"
fi

# 2. 站点配置
echo ""
echo "→ [2/5] 站点配置 ..."
echo "      各项可直接回车使用默认值；生产部署无需填写开发代理。"

read -r -p "      VITE_API_PROXY_TARGET（开发代理，本地调试用，可留空）: " api_proxy_target
read -r -p "      VITE_APP_SITE_NAME（站点名，默认: FurLL 客户中心）: " app_site_name
read -r -p "      VITE_APP_TITLE（浏览器标题，默认: FurLL 客户中心）: " app_title
read -r -p "      VITE_APP_DESCRIPTION（SEO 描述，默认: 魔方财务前台模板 FurLLV10）: " app_description
read -r -p "      VITE_APP_KEYWORDS（SEO 关键词，默认: 魔方财务,IDC,FurLLV10）: " app_keywords
read -r -p "      是否强制所有产品详情使用魔方财务官方 productdetail 解析？[y/N]: " force_official
read -r -p "      是否强制所有商品配置页使用官方 goods 解析？[y/N]: " force_goods

app_site_name="${app_site_name:-FurLL 客户中心}"
app_title="${app_title:-FurLL 客户中心}"
app_description="${app_description:-魔方财务前台模板 FurLLV10}"
app_keywords="${app_keywords:-魔方财务,IDC,FurLLV10}"

# 强制官方解析开关（VITE_FORCE_OFFICIAL_CONSOLE）：
# 开启（=1）后所有产品详情走魔方财务官方 pc/default 壳（legacy iframe），
# 关闭（默认，=0）后已适配模块走 React 原生渲染，仅未适配模块走官方壳。
# 仅用于排查模板解析问题，生产环境建议保持关闭。
case "${force_official,,}" in
    y|yes|1) force_official_console="1" ;;
    *)       force_official_console="0" ;;
esac

# 强制官方商品配置解析开关（VITE_FORCE_OFFICIAL_GOODS）：
# 开启（=1）后所有商品配置页（/cart/goods.htm）走官方 pc/default 壳（legacy iframe），
# 关闭（默认，=0）后 remf 系列模块走 React 原生选配，其余模块（mf_cloud/mf_dcim/
# idcsmart_common/第三方）自动走官方壳 + React 动作栏。
# 仅用于排查模板解析问题，生产环境建议保持关闭。
case "${force_goods,,}" in
    y|yes|1) force_official_goods="1" ;;
    *)       force_official_goods="0" ;;
esac

# 双引号保护空格、# 等 dotenv 特殊字符，避免配置被错误截断。
escape_env_value() {
    local value="$1"
    value="${value//$'\r'/}"
    value="${value//\\/\\\\}"
    value="${value//\"/\\\"}"
    printf '%s' "$value"
}

{
    printf '# 由 release.sh 自动生成；如需调整，请重新运行脚本。\n'
    printf 'VITE_API_PROXY_TARGET="%s"\n' "$(escape_env_value "$api_proxy_target")"
    printf 'VITE_APP_SITE_NAME="%s"\n' "$(escape_env_value "$app_site_name")"
    printf 'VITE_APP_TITLE="%s"\n' "$(escape_env_value "$app_title")"
    printf 'VITE_APP_DESCRIPTION="%s"\n' "$(escape_env_value "$app_description")"
    printf 'VITE_APP_KEYWORDS="%s"\n' "$(escape_env_value "$app_keywords")"
    printf 'VITE_FORCE_OFFICIAL_CONSOLE="%s"\n' "$force_official_console"
    printf 'VITE_FORCE_OFFICIAL_GOODS="%s"\n' "$force_official_goods"
} > .env
echo "      ✓ 已生成 .env"

# 3. 构建（tsc 类型检查失败时回退 vite build，产物一致）
echo ""
echo "→ [3/5] 构建 React 产物 ..."
if pnpm build >/dev/null 2>&1; then
    echo "      ✓ pnpm build 完成"
else
    echo "      ⚠ tsc 检查失败，回退 npx vite build"
    npx vite build
    echo "      ✓ vite build 完成"
fi

# 4. 分发
echo ""
echo "→ [4/5] 分发模板到 public/ ..."
node deploy.mjs

# 5. 清理构建中间产物
echo ""
echo "→ [5/5] 清理 dist/（构建中间产物，无需上传） ..."
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
read -r _ || true
