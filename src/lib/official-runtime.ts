/**
 * 官方 PC 模板运行时的同文档装载。
 *
 * 复刻官方 `clientarea/template/pc/default/header.php` + `cart/template/pc/default/goods.php`
 * + `footer.php` 的资源顺序，让 React 页面自己具备官方 goods.htm 的全局环境
 * （Vue2 / Element UI / window.lang / window.Axios / 各组件），从而可以自己完成
 * 「取 JSON → 把 data.content 注入 .config-box .content → 执行 content 内的脚本」。
 *
 * 三处刻意的差异（都有硬原因，见各自注释）：
 * - 不加载 `theme/index.js`：它向 head 追加全局 `theme/<theme>/index.css`，本实现改为带作用域注入；
 * - 不加载 `lang/index.js`：它用 `document.writeln` 注入脚本，页面加载后执行会 document.open() 清空 SPA；
 * - 不加载 `cart/template/pc/default/js/goods.js`：它的 boot 挂在 `window.onload`，且 React 自己负责取数注入。
 */
import {
  fetchCssText,
  officialScopeMapper,
  resolveCssImports,
  transformCss,
} from '@/lib/official-css'

export const OFFICIAL_CLIENT_BASE = '/clientarea/template/pc/default/'
export const OFFICIAL_CART_BASE = '/cart/template/pc/default/'

/** 官方配置页宿主容器类名（内容注入与 CSS 作用域共用同一常量） */
export const OFFICIAL_HOST_CLASS = 'furll-official-goods'
export const OFFICIAL_HOST_SELECTOR = `.${OFFICIAL_HOST_CLASS}`

/** 官方注入点：`goods.js` 的 `$(".config-box .content").html(res.data.data.content)` */
export const OFFICIAL_CONTENT_SELECTOR = '.config-box .content'

/** rem 改写目标：桌面 100px 复刻 `goods_iframe.css` 的 `html{font-size:100px!important}` */
export const OFFICIAL_REM_VAR = 'var(--furll-rem)'

interface WindowOfficialConfig {
  __CLIENT_CONFIG__?: {
    system_version?: string
    theme_color?: string
    addons?: unknown[]
  }
  __LANG_CONFIG__?: Record<string, unknown>
  getBrowserLanguage?: () => string
  ELEMENT?: { locale: (lang: unknown) => void; lang: Record<string, unknown> }
}

const DEFAULT_LANG_CONFIG: Record<string, unknown> = {
  lang_home: 'zh-cn',
  lang_home_follow_browser: 0,
  lang_home_open: 0,
}

/** 官方 lang/index.js 的语言白名单与 Element locale 名映射 */
const VALID_LANGS = ['en-us', 'zh-cn', 'zh-hk'] as const
const ELEMENT_LOCALE: Record<string, string> = {
  'en-us': 'en',
  'zh-cn': 'zhCN',
  'zh-hk': 'zhTW',
}

function officialWindow(): WindowOfficialConfig {
  return window as unknown as WindowOfficialConfig
}

export function getOfficialTheme(): string {
  return (
    document.documentElement.getAttribute('theme') ||
    officialWindow().__CLIENT_CONFIG__?.theme_color ||
    'default'
  )
}

function getSystemVersion(): string {
  return officialWindow().__CLIENT_CONFIG__?.system_version ?? ''
}

function getLangConfig(): Record<string, unknown> {
  return officialWindow().__LANG_CONFIG__ ?? DEFAULT_LANG_CONFIG
}

/** 复刻官方 lang/index.js 的 DEFAULT_LANG 选择逻辑（jwt 优先，其次跟随浏览器/站点开关） */
function resolveOfficialLang(): string {
  const config = getLangConfig()
  const normalize = (value: unknown): string =>
    VALID_LANGS.includes(String(value) as (typeof VALID_LANGS)[number])
      ? String(value)
      : 'zh-cn'
  const jwt = localStorage.getItem('jwt')
  if (jwt) {
    return normalize(localStorage.getItem('lang') || config.lang_home || 'zh-cn')
  }
  const followBrowser =
    Number(config.lang_home_follow_browser) === 1 &&
    typeof officialWindow().getBrowserLanguage === 'function'
  if (followBrowser) {
    return normalize(officialWindow().getBrowserLanguage?.())
  }
  if (Number(config.lang_home_open) === 1 && localStorage.getItem('lang')) {
    return normalize(localStorage.getItem('lang'))
  }
  return normalize(config.lang_home || 'zh-cn')
}

const loadedScripts = new Set<string>()

function loadScript(src: string): Promise<void> {
  if (loadedScripts.has(src)) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = false
    script.addEventListener('load', () => {
      loadedScripts.add(src)
      resolve()
    })
    script.addEventListener('error', () => {
      reject(new Error(`官方脚本加载失败：${src}`))
    })
    document.head.append(script)
  })
}

/**
 * 用真实 `<script>` 元素执行代码：顶层 `const`/`let` 会进入全局词法环境，
 * 后续经典脚本才能按名字读到（`eval` 做不到，见 ES 规范的 eval 声明作用域）。
 */
function runInlineScript(code: string): void {
  const script = document.createElement('script')
  script.textContent = code
  document.head.append(script)
  script.remove()
}

let rootFontGuardInstalled = false

/**
 * `common.js:33-71` 会把 `documentElement.style.fontSize` 写成官方 rem 基准
 * （1920 宽 ⇒ 100px），那会按 6.25 倍放大 React 壳的全部 Tailwind rem 尺寸。
 * 官方页面的 rem 基准改由宿主容器的 `--furll-rem` 承担，这里把根字号还原。
 * 它的 resize 监听是匿名函数无法移除，只能在它之后注册一个更晚执行的还原。
 */
function neutralizeRootFontSize(): void {
  const root = document.documentElement
  const restore = () => {
    if (root.style.fontSize) root.style.removeProperty('font-size')
  }
  restore()
  if (rootFontGuardInstalled) return
  rootFontGuardInstalled = true
  window.addEventListener('resize', restore)
}

async function applyDocumentGlobals(): Promise<void> {
  const root = document.documentElement
  // 官方 header.php:2 `<html lang="en" theme="..." id="addons_js" addons_js='[...]'>`
  root.id = 'addons_js'
  root.setAttribute('addons_js', JSON.stringify(officialWindow().__CLIENT_CONFIG__?.addons ?? []))
  const config = getLangConfig()
  if (!officialWindow().__LANG_CONFIG__) {
    officialWindow().__LANG_CONFIG__ = { ...DEFAULT_LANG_CONFIG }
  }
  // header.php:12-20 定义全局 `url` / `system_version`（theme/index.js 与 lang/index.js 依赖）
  runInlineScript(
    [
      `const url = ${JSON.stringify(OFFICIAL_CLIENT_BASE)}`,
      `const system_version = ${JSON.stringify(getSystemVersion())}`,
      `window.__LANG_CONFIG__ = ${JSON.stringify(config)}`,
    ].join('\n')
  )
}

async function loadOfficalLang(): Promise<void> {
  const lang = resolveOfficialLang()
  if (!localStorage.getItem('jwt')) localStorage.setItem('lang', lang)
  await loadScript(`${OFFICIAL_CLIENT_BASE}lang/${lang}/element-lang.js`)
  await loadScript(
    `${OFFICIAL_CLIENT_BASE}lang/${lang}/index.js?v=${encodeURIComponent(getSystemVersion())}`
  )
  runInlineScript(`ELEMENT.locale(ELEMENT.lang.${ELEMENT_LOCALE[lang]})`)
}

/** 官方样式：`element-ui.css`（285KB、0 rem、全 `.el-*`）与字体用普通 link，其余改写后按作用域注入 */
const PLAIN_STYLESHEETS = [
  `${OFFICIAL_CLIENT_BASE}theme/${getOfficialTheme()}/element-ui.css`,
  '/upload/common/iconfont/iconfont.css',
]

const SCOPED_STYLESHEETS = [
  `${OFFICIAL_CLIENT_BASE}css/common/reset.css`,
  `${OFFICIAL_CLIENT_BASE}theme/${getOfficialTheme()}/index.css`,
  `${OFFICIAL_CLIENT_BASE}css/common/common.css`,
  `${OFFICIAL_CART_BASE}css/goods.css`,
]

async function loadOfficialStyles(): Promise<void> {
  for (const href of PLAIN_STYLESHEETS) {
    if (document.querySelector(`link[data-furll-official-css="${href}"]`)) continue
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.dataset.furllOfficialCss = href
    document.head.append(link)
  }
  for (const href of SCOPED_STYLESHEETS) {
    if (document.querySelector(`style[data-furll-official-css="${href}"]`)) continue
    const absolute = new URL(href, document.baseURI).href
    const css = await resolveCssImports(
      await fetchCssText(absolute),
      absolute,
      // element-ui.css 已用 link 单独加载（285KB 的内联会重复一份）
      (raw) => raw.includes('element-ui.css')
    )
    const style = document.createElement('style')
    style.dataset.furllOfficialCss = href
    style.textContent = transformCss(css, {
      baseHref: absolute,
      remVar: OFFICIAL_REM_VAR,
      mapSelector: officialScopeMapper(OFFICIAL_HOST_SELECTOR),
    })
    document.head.append(style)
  }
}

/** 页尾脚本（官方 footer.php + goods.php 顺序，去掉 goods.js / theme/index.js / lang/index.js） */
const RUNTIME_SCRIPTS = [
  `${OFFICIAL_CLIENT_BASE}components/payDialog/payDialog.js`,
  `${OFFICIAL_CART_BASE}api/product.js`,
  `${OFFICIAL_CLIENT_BASE}components/pagination/pagination.js`,
  `${OFFICIAL_CLIENT_BASE}components/discountCode/discountCode.js`,
  `${OFFICIAL_CLIENT_BASE}components/eventCode/eventCode.js`,
  `${OFFICIAL_CLIENT_BASE}components/customGoods/customGoods.js`,
  `${OFFICIAL_CLIENT_BASE}utils/directive.js`,
  `${OFFICIAL_CLIENT_BASE}js/common/axios.min.js`,
  `${OFFICIAL_CLIENT_BASE}utils/request.js`,
  `${OFFICIAL_CLIENT_BASE}api/common.js`,
  `${OFFICIAL_CLIENT_BASE}components/preSalesService/preSalesService.js`,
  `${OFFICIAL_CLIENT_BASE}components/coinActive/coinActive.js`,
  `${OFFICIAL_CLIENT_BASE}components/clientLevelDialog/clientLevelDialog.js`,
  `${OFFICIAL_CLIENT_BASE}components/asideMenu/asideMenu.js`,
  `${OFFICIAL_CLIENT_BASE}components/topMenu/topMenu.js`,
]

let runtimePromise: Promise<void> | null = null

async function bootstrapOfficialRuntime(): Promise<void> {
  await applyDocumentGlobals()
  await loadOfficialStyles()
  // header.php 顺序：vue.js → element.js → utils/util.js → lang → common.js → jquery
  await loadScript(`${OFFICIAL_CLIENT_BASE}js/common/vue.js`)
  await loadScript(`${OFFICIAL_CLIENT_BASE}js/common/element.js`)
  await loadScript(`${OFFICIAL_CLIENT_BASE}utils/util.js`)
  await loadOfficalLang()
  await loadScript(`${OFFICIAL_CLIENT_BASE}js/common/common.js`)
  neutralizeRootFontSize()
  await loadScript(`${OFFICIAL_CLIENT_BASE}js/common/jquery.mini.js`)
  for (const src of RUNTIME_SCRIPTS) {
    await loadScript(src)
  }
}

/** 幂等：整个 document 只装载一次官方运行时（重复装载会撞顶层 `const` 重复声明） */
export function ensureOfficialRuntime(): Promise<void> {
  if (!runtimePromise) runtimePromise = bootstrapOfficialRuntime()
  return runtimePromise
}
