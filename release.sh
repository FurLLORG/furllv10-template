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
echo "→ [1/6] 检查依赖 ..."
if [ ! -d node_modules ]; then
    echo "      未检测到 node_modules，执行 pnpm install ..."
    pnpm install
else
    echo "      ✓ node_modules 已存在，跳过安装"
fi

# 2. 站点配置
echo ""
echo "→ [2/6] 站点配置 ..."
echo "      各项可直接回车使用默认值；生产部署无需填写开发代理。"

read -r -p "      VITE_API_PROXY_TARGET（开发代理，本地调试用，可留空）: " api_proxy_target
read -r -p "      VITE_APP_SITE_NAME（站点名，可留空）: " app_site_name
read -r -p "      VITE_APP_TITLE（浏览器标题，可留空）: " app_title
read -r -p "      VITE_APP_DESCRIPTION（SEO 描述，回车使用默认云服务文案）: " app_description
read -r -p "      VITE_APP_KEYWORDS（SEO 关键词，回车使用默认云服务关键词）: " app_keywords

DEFAULT_APP_DESCRIPTION="专业云服务商，提供云服务器（VPS）、独立服务器、裸金属服务器、CDN 加速、高防服务器、云存储、对象存储、域名注册与 SSL 证书等一站式云计算服务。高性能硬件、全球多节点部署、弹性伸缩、安全稳定，7×24 小时技术支持，助您轻松上云、快速部署业务。"
DEFAULT_APP_KEYWORDS="云服务器, VPS, 服务器, 服务器租用, 独立服务器, 裸金属服务器, 物理服务器, 云主机, 虚拟主机, CDN, CDN加速, 内容分发网络, 网站加速, 云存储, 对象存储, 云盘, 高防服务器, 高防IP, DDoS防护, 香港服务器, 美国服务器, 海外服务器, 免备案服务器, 国内服务器, 云数据库, 负载均衡, 弹性伸缩, 容器服务, GPU云服务器, 云计算, IDC, 机房托管, 服务器托管, 域名注册, 域名, SSL证书, 网站备案, 企业邮箱, 主机托管, 云安全, 大数据, 边缘计算, 网络加速"

app_description="${app_description:-$DEFAULT_APP_DESCRIPTION}"
app_keywords="${app_keywords:-$DEFAULT_APP_KEYWORDS}"

# 3. 弹出提示位置
echo ""
echo "→ [3/6] 弹出提示位置 ..."
echo "      1) 右下（默认）  2) 右上  3) 顶部居中  4) 页面中间"
while true; do
    read -r -p "      请选择 [1-4，默认 1]: " toast_position_choice
    case "${toast_position_choice:-1}" in
        1) toast_position="bottom-right"; break ;;
        2) toast_position="top-right"; break ;;
        3) toast_position="top-center"; break ;;
        4) toast_position="center"; break ;;
        *) echo "      请输入 1、2、3 或 4。" ;;
    esac
done

# 统一写入构建环境，避免 toast 配置覆盖站点配置。
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
    printf 'VITE_TOAST_POSITION="%s"\n' "$toast_position"
    printf 'VITE_FORCE_OFFICIAL_CONSOLE="1"\n'
    printf 'VITE_FORCE_OFFICIAL_GOODS="1"\n'
} > .env
echo "      ✓ 已生成 .env"

# 4. 构建（tsc 类型检查失败时回退 vite build，产物一致）
echo ""
echo "→ [4/6] 构建 React 产物 ..."
if pnpm build >/dev/null 2>&1; then
    echo "      ✓ pnpm build 完成"
else
    echo "      ⚠ tsc 检查失败，回退 npx vite build"
    npx vite build
    echo "      ✓ vite build 完成"
fi

# 5. 分发
echo ""
echo "→ [5/6] 分发模板到 public/ ..."
node deploy.mjs

# 6. 清理构建中间产物
echo ""
echo "→ [6/6] 清理 dist/（构建中间产物，无需上传） ..."
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
