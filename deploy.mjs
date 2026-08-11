#!/usr/bin/env node
/**
 * FurLLV10 模板分发脚本
 * 用法：pnpm build && node deploy.mjs
 * 职责：把 dist 产物分发为本目录 public/ 下的官方模板标准目录
 *  1. 官网：dist/index.html 复制为 public/web/FurLLV10/<页面名>.html（34 页 + solution 8 子页）
 *  2. 会员中心：用 scripts/shells/ 下的模板生成 pc/mobile 两套 php 薄壳（37 页）+ header/footer.php + theme.jpg
 *  3. assets 只复制进官网 public/web/FurLLV10/assets/（各壳统一引用该目录）
 * 产物目录：public/web/、public/clientarea/、public/cart/、public/home/，可直接合并到魔方系统 public/
 * 注意：勿手改生成产物，壳模板改 scripts/shells/ 后重新分发即可覆盖
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = __dirname
const DIST = path.join(ROOT, 'dist')
const SHELLS = path.join(ROOT, 'scripts', 'shells')
const SYSTEM = path.join(ROOT, 'public')

const THEME = 'FurLLV10'

const WEB_DIR = path.join(SYSTEM, 'web', THEME)
const CLIENT_PC_DIR = path.join(SYSTEM, 'clientarea/template/pc', THEME)
const CLIENT_MOBILE_DIR = path.join(SYSTEM, 'clientarea/template/mobile', THEME)
const HOME_PC_DIR = path.join(SYSTEM, 'home/template/pc', THEME)
const HOME_MOBILE_DIR = path.join(SYSTEM, 'home/template/mobile', THEME)

// 首页壳：viewHome() 由控制器单独拉 clientarea header/footer，home.php 只负责 body
const HOME_PAGE_PHP = `<div id="root"></div>
<script type="module" crossorigin src="/web/FurLLV10/assets/index.js"></script>
`

// 购物车页面清单（对照 public/cart/template/pc/default/，fragment 由 clientarea header/footer 包裹）
const CART_PAGES = ['goodsList', 'goods', 'shoppingCar', 'settlement']

// 会员中心页面清单（对照 public/clientarea/template/pc/default/，不含 header/footer/mainLoading）
const CLIENT_PAGES = [
  '404', 'account', 'addTicket', 'addChildAccount', 'agreement', 'crossModule', 'finance', 'forget',
  'group_rules', 'login', 'networkErro', 'newsView', 'noPermissions',
  'oauth', 'orderDetail', 'product', 'productList', 'product_list',
  'productdetail', 'regist', 'security', 'security_group',
  'security_log', 'security_ssh', 'source', 'template', 'ticket', 'ticketDetails',
  'news_detail', 'transfer', 'withdrawal', 'childAccount',
  // 实名认证插件（IdcsmartCertification）裸别名直链壳（插件 URL 走 pluginRoute，无需壳）
  'authentication_select', 'authentication_person', 'authentication_company',
  'authentication_status', 'authentication_thrid',
]

// 壳模板（版本控制的源文件，勿内联到脚本）
const PAGE_PHP = fs.readFileSync(path.join(SHELLS, 'page.php'), 'utf-8')
const HEADER_PHP = fs.readFileSync(path.join(SHELLS, 'header.php'), 'utf-8')
const FOOTER_PHP = fs.readFileSync(path.join(SHELLS, 'footer.php'), 'utf-8')

// 购物车壳模板：由 ViewCartController 用 clientarea header/footer 包裹后输出，
// 页面 fragment 只需挂载点和脚本；资源统一指向官网 /web/FurLLV10/assets/ 目录
const CART_PAGE_PHP = `<div id="root"></div>
<script type="module" crossorigin src="/web/FurLLV10/assets/index.js"></script>
`

// 官网页面清单（对照 public/web/default/ 一级页面 + solution 子目录页）
const WEB_PAGES = [
  'index', 'domain', 'domain_shop', 'domain_register', 'domain_buy',
  'cloud', 'ssl', 'news', 'news-details', 'news-classify',
  'announce', 'announce-details', 'document', 'document-details',
  'document-result', 'document-view', 'about', 'contact', 'feedback',
  'activities', 'recruit', 'sms', 'icp', 'dedicated', 'model', 'rent',
  'solution', 'ssl', 'trademark', 'trusteeship', 'partner',
  'partner-agent', 'partner-reward', 'service-guarantee',
]

const WEB_SUB_PAGES = {
  solution: ['agriculture', 'auto', 'ecommerce', 'education', 'finance', 'game', 'medical', 'travel'],
}

function clean(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
}

function copyDir(src, dest) {
  fs.cpSync(src, dest, { recursive: true })
  // CSS 内资源引用（@font-face 等）由 vite 产出为绝对路径 /assets/xxx，
  // 部署后与 CSS 同目录，改写为相对路径保证可用（与 index.html 的 /assets/ 替换等价）
  const cssFiles = fs
    .readdirSync(dest)
    .filter((f) => f.endsWith('.css'))
    .map((f) => path.join(dest, f))
  for (const css of cssFiles) {
    const content = fs.readFileSync(css, 'utf-8')
    fs.writeFileSync(css, content.replaceAll('url(/assets/', 'url(./'))
  }
  // JS 包内静态资源引用（import 的 png/jpg 等被 vite 产为 /assets/[name]-[hash]）
  // 也走绝对 /assets/ 前缀，部署后需改写为官网静态路径（/web/FurLLV10/assets/），
  // 否则浏览器会请求站根 /assets/... 导致 404（如登录页 login-*.png）
  const jsFiles = fs
    .readdirSync(dest)
    .filter((f) => f.endsWith('.js'))
    .map((f) => path.join(dest, f))
  for (const js of jsFiles) {
    const content = fs.readFileSync(js, 'utf-8')
    fs.writeFileSync(js, content.replaceAll('/assets/', `/web/${THEME}/assets/`))
  }
}

function writePhp(dir, name, content) {
  const file = path.join(dir, `${name}.php`)
  fs.writeFileSync(file, content)
}

function main() {
  const indexHtml = fs.readFileSync(path.join(DIST, 'index.html'), 'utf-8')

  // ---------- 1. 官网 ----------
  clean(WEB_DIR)
  fs.mkdirSync(WEB_DIR, { recursive: true })
  // assets 引用改为官网静态路径
  const webHtml = indexHtml.replaceAll(
    '/assets/',
    `/web/${THEME}/assets/`
  )
  for (const page of WEB_PAGES) {
    fs.writeFileSync(path.join(WEB_DIR, `${page}.html`), webHtml)
  }
  for (const [dir, pages] of Object.entries(WEB_SUB_PAGES)) {
    const sub = path.join(WEB_DIR, dir)
    fs.mkdirSync(sub, { recursive: true })
    for (const page of pages) {
      fs.writeFileSync(path.join(sub, `${page}.html`), webHtml)
    }
  }
  copyDir(path.join(DIST, 'assets'), path.join(WEB_DIR, 'assets'))
  console.log(`[web] ${WEB_DIR}  ${WEB_PAGES.length + 8} 个页面`)

  // ---------- 1.5 官网图片静态资源（运行时 /images/... 引用） ----------
  // 源码 src/assets-public/images/ 复制进产物顶层 public/images/
  // （favicon.ico、mock-sw.js 不打包：favicon 服务器已有，mock-sw 仅本地调试用）
  const SRC_IMAGES = path.join(ROOT, 'src', 'assets-public', 'images')
  if (fs.existsSync(SRC_IMAGES)) {
    const DEST_IMAGES = path.join(SYSTEM, 'images')
    clean(DEST_IMAGES)
    copyDir(SRC_IMAGES, DEST_IMAGES)
    console.log(`[images] ${DEST_IMAGES}  复制官网图片`)
  }

  // ---------- 2. 会员中心 ----------
  for (const dir of [CLIENT_PC_DIR, CLIENT_MOBILE_DIR]) {
    clean(dir)
    fs.mkdirSync(dir, { recursive: true })
    for (const page of CLIENT_PAGES) {
      writePhp(dir, page, PAGE_PHP)
    }
    // 壳（assets 统一指向 /web/FurLLV10/assets/，不在此目录复制）
    fs.writeFileSync(path.join(dir, 'header.php'), HEADER_PHP)
    fs.writeFileSync(path.join(dir, 'footer.php'), FOOTER_PHP)
    // 未适配模块官方兼容壳页（LegacyHost iframe 跳转入口，URL 带 ?id= 供官方脚本读取）
    fs.copyFileSync(
      path.join(ROOT, 'src', 'assets-public', 'legacy-host.html'),
      path.join(dir, 'legacy-host.html')
    )
    // 未适配商品配置页官方兼容壳页（LegacyGoods iframe 跳转入口，URL 带 ?id= 供 goods.js/模块脚本读取）
    fs.copyFileSync(
      path.join(ROOT, 'src', 'assets-public', 'legacy-goods.html'),
      path.join(dir, 'legacy-goods.html')
    )
    // theme.jpg（预览图，从默认模板复制）
    const themeJpg = path.join(SYSTEM, 'clientarea/template/pc/default/theme.jpg')
    if (fs.existsSync(themeJpg)) {
      fs.copyFileSync(themeJpg, path.join(dir, 'theme.jpg'))
    }
    console.log(`[client] ${dir}  ${CLIENT_PAGES.length} 个 php 壳`)
  }

  // ---------- 3. 购物车 ----------
  for (const type of ['pc', 'mobile']) {
    const dir = path.join(SYSTEM, 'cart/template', type, THEME)
    clean(dir)
    fs.mkdirSync(dir, { recursive: true })
    for (const page of CART_PAGES) {
      writePhp(dir, page, CART_PAGE_PHP)
    }
    const themeJpg = path.join(SYSTEM, 'cart/template/pc/default/theme.jpg')
    if (fs.existsSync(themeJpg)) {
      fs.copyFileSync(themeJpg, path.join(dir, 'theme.jpg'))
    }
    console.log(`[cart] ${dir}  ${CART_PAGES.length} 个 php 壳`)
  }

  // ---------- 4. 会员中心首页（viewHome，header/footer 由控制器从 clientarea 拉取） ----------
  for (const dir of [HOME_PC_DIR, HOME_MOBILE_DIR]) {
    clean(dir)
    fs.mkdirSync(dir, { recursive: true })
    writePhp(dir, 'home', HOME_PAGE_PHP)
    // theme.jpg（预览图，从默认模板复制）
    const homeThemeJpg = path.join(SYSTEM, 'home/template/pc/default/theme.jpg')
    if (fs.existsSync(homeThemeJpg)) {
      fs.copyFileSync(homeThemeJpg, path.join(dir, 'theme.jpg'))
    }
    console.log(`[home] ${dir}  home.php 壳`)
  }
  console.log('分发完成 ✓')
}

main()
