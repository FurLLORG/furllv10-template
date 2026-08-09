/**
 * 面板区域 HTML 解析器（官方 mf_finance_common custom/content 等返回完整 HTML 文档，
 * 用 bootstrap 卡片等结构呈现面板信息）。把服务端渲染的面板 HTML 解析为结构化
 * 卡片/操作/提示，便于用 shadcn 组件重新渲染，而不是把裸 HTML 塞进页面。
 *
 * 解析规则：
 * - .card（.card-header + .card-body）→ 标签/值卡片（如 用户名 → ser...@qq.com）
 * - a[href]（.btn）→ 操作按钮（如 登录面板）
 * - 其他叶子文本（不在卡片/链接内，如 <center> 提示）→ 提示行
 */

export interface PanelCard {
  label: string
  value: string
}
export interface PanelAction {
  text: string
  href: string
}
export interface PanelNote {
  text: string
}
export interface PanelContent {
  cards: PanelCard[]
  actions: PanelAction[]
  notes: PanelNote[]
}

function cleanText(value: string | null | undefined): string {
  if (!value) return ''
  return value.replace(/\s+/g, ' ').trim()
}

/** 提取 <body> 内部内容（面板常带 doctype/html/head/body 包裹） */
export function extractBodyHtml(html: string): string {
  if (!html) return ''
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  return body ? body[1] : html
}

/** 面板内容是否解析出结构化元素 */
export function hasPanelContent(content: PanelContent): boolean {
  return (
    content.cards.length > 0 ||
    content.actions.length > 0 ||
    content.notes.length > 0
  )
}

/**
 * 解析面板 HTML。浏览器/Node(jsdom) 均有 DOMParser；不可用时返回空结构。
 */
export function parsePanelHtml(html: string): PanelContent {
  const empty: PanelContent = { cards: [], actions: [], notes: [] }
  if (!html || typeof DOMParser === 'undefined') return empty

  let doc: Document
  try {
    doc = new DOMParser().parseFromString(html, 'text/html')
  } catch {
    return empty
  }
  if (!doc.body) return empty

  const cards: PanelCard[] = []
  doc.querySelectorAll('.card').forEach((card) => {
    const header = card.querySelector('.card-header')
    const body = card.querySelector('.card-body')
    const label = cleanText(header?.textContent)
    const value = cleanText(body?.textContent)
    if (label || value) cards.push({ label, value })
  })

  const actions: PanelAction[] = []
  doc.querySelectorAll('a[href]').forEach((a) => {
    const text = cleanText(a.textContent)
    const href = a.getAttribute('href') ?? ''
    if (text || href) actions.push({ text, href })
  })

  // 叶子文本节点（跳过卡片/链接/脚本/样式），收集为提示行
  const notes: string[] = []
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const el = walker.currentNode.parentElement
    if (!el) continue
    if (el.closest('.card')) continue
    if (el.closest('a')) continue
    // </html> 后尾随资产（DOMParser 会并入 body）里的 <style>/<script> 文本
    // （如 .swal2-popup{...}）不属于面板提示，跳过
    if (el.closest('style, script')) continue
    const text = cleanText(walker.currentNode.textContent)
    if (text && !notes.includes(text)) notes.push(text)
  }

  return {
    cards,
    actions,
    notes: notes.map((text) => ({ text })),
  }
}

/**
 * 是否应走 srcDoc iframe 渲染（而非结构化卡片）：
 * - 面板带 `<button>` 或「内联脚本」：存在交互逻辑（点击跳面板/复制 token 等），
 *   结构化解析无法保留，必须 iframe 让脚本/按钮原样生效；
 * - 仅加载外部库的 `<script src>`（如 sweetalert2）不视为富交互——按钮本身是
 *   静态 a[href]，可直接结构化渲染（否则会因 bootstrap 样式未加载而显示无 css 原内容）；
 * - 解析不出结构化内容（无 .card / a[href]）但有内容：无法用卡片安全呈现，iframe 兜底。
 * 简单信息面板（纯 .card + a[href] 登录按钮，无脚本）→ 结构化渲染。
 */
export function shouldUseIframe(html: string, content: PanelContent): boolean {
  if (!html) return false
  if (extractInlineScripts(html).length > 0 || /<button/i.test(html)) return true
  if (!hasPanelContent(content)) return true
  return false
}

/**
 * 提取 html 中所有匹配指定正则的完整标签字符串（用于收集 head 样式/尾随全局资产）。
 */
function extractTags(html: string, pattern: RegExp): string[] {
  const tags: string[] = []
  const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g'
  const re = new RegExp(pattern.source, flags)
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) tags.push(m[0])
  return tags
}

/**
 * 构建 srcDoc 文档。面板 HTML 是三段式：`<head>`（title/style 等面板样式）、
 * `<body>`（内容 + 交互脚本）、以及 `</html>` 之后官方模板追加的全局资产
 * （sweetalert2 / htools.css 等）。全部收集进 iframe head，样式才解析显示正常。
 *
 * 额外注入系统自带 jQuery（面板脚本普遍依赖 `$`）。srcDoc 继承父页面 base URL，
 * 相对路径（/plugins/...、/console/v1 等）可正常解析。
 */
export function buildPanelIframeDoc(html: string): string {
  // 面板 <head> 资产（title/style 等）
  const head = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? ''
  // </html> 之后官方模板追加的全局 css/js/style
  const tail = html.match(/<\/html>[\s\S]*$/i)?.[0] ?? ''
  const tailAssets = [
    ...extractTags(tail, /<style[\s\S]*?<\/style>/gi),
    ...extractTags(tail, /<link\b[^>]*>/gi),
    ...extractTags(tail, /<script\b[^>]*src=["'][^"']*["'][^>]*>\s*<\/script>/gi),
  ]

  return [
    '<!DOCTYPE html><html><head>',
    '<meta charset="UTF-8">',
    '<style>html,body{margin:0;padding:0;background:transparent}</style>',
    '<script src="/clientarea/template/pc/default/js/common/jquery.mini.js"></script>',
    head,
    ...tailAssets,
    '</head><body>',
    extractBodyHtml(html),
    '</body></html>',
  ].join('')
}

// ---------------------------------------------------------------------------
// 自定义面板解析器（识别特定 class 签名，结构化渲染为 shadcn 卡片，
// 不走默认的 iframe/通用 bootstrap 解析。如 tianqi-cdnfly、lecdn 等。）
// ---------------------------------------------------------------------------

export interface CustomPanelContent extends PanelContent {
  /** 面板标题（如 CDN面板信息） */
  title?: string
}

/** 自定义解析器：detect 识别格式，parse 提取结构化内容 */
interface PanelParser {
  detect: (doc: Document) => boolean
  parse: (doc: Document) => CustomPanelContent | null
}

/** 从纯文本按第一个冒号拆分为 label/value（如 "用户名: xxx"） */
function splitLabelValue(text: string): { label: string; value: string } | null {
  const idx = text.indexOf(':')
  if (idx <= 0) return null
  return {
    label: text.slice(0, idx).trim(),
    value: text.slice(idx + 1).trim(),
  }
}

const customParsers: PanelParser[] = [
  {
    // tianqi-cdnfly：<h4 class="tianqi-cdnfly-card-title"> + <p class="tianqi-cdnfly-p"> + <button class="tianqi-cdnfly-btn">
    detect: (doc) =>
      !!doc.querySelector('.tianqi-cdnfly-card-title, .tianqi-cdnfly-p'),
    parse: (doc) => {
      const title = cleanText(
        doc.querySelector('.tianqi-cdnfly-card-title')?.textContent
      )
      const cards: PanelCard[] = []
      const notes: PanelNote[] = []
      doc.querySelectorAll('.tianqi-cdnfly-p').forEach((p) => {
        const text = cleanText(p.textContent)
        const kv = splitLabelValue(text)
        if (kv) cards.push(kv)
        else if (text) notes.push({ text })
      })
      const actions: PanelAction[] = []
      doc.querySelectorAll('.tianqi-cdnfly-btn').forEach((b) => {
        const text = cleanText(b.textContent)
        if (text) actions.push({ text, href: '' })
      })
      return { title: title || undefined, cards, actions, notes }
    },
  },
  // 后续自定义格式（如 lecdn 若带独立 class 签名）在此追加
]

/**
 * 运行自定义解析器；命中则返回结构化内容，未命中返回 null（交默认解析/iframe 处理）。
 */
export function parseCustomPanel(html: string): CustomPanelContent | null {
  if (!html || typeof DOMParser === 'undefined') return null
  let doc: Document
  try {
    doc = new DOMParser().parseFromString(html, 'text/html')
  } catch {
    return null
  }
  if (!doc.body) return null
  for (const parser of customParsers) {
    if (parser.detect(doc)) return parser.parse(doc)
  }
  return null
}

/** 提取面板内联 <script> 的源码内容（不含带 src 的外部脚本） */
function extractInlineScripts(html: string): string[] {
  const bodies: string[] = []
  const re = /<script(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const body = (m[1] ?? '').trim()
    if (body) bodies.push(body)
  }
  return bodies
}

/**
 * 在沙箱里执行面板的内联脚本，抓取脚本最终 window.open 的目标 URL。
 * 用于结构化渲染时保留「跳转到面板」类按钮的交互（脚本通常：
 * $(document).ready 里算 token → $('#id').click → window.open(url)）。
 *
 * 通过 stub 掉 $/window.open/btoa 等依赖，执行脚本后立即触发捕获的 click
 * handler，取回 window.open 参数。解析失败返回 null（调用方回退 iframe）。
 */
export function extractPanelJumpUrl(html: string): string | null {
  const scripts = extractInlineScripts(html)
  if (!scripts.length) return null

  let captured: string | null = null
  let clickHandler: (() => void) | null = null

  const fakeWindow: Window = {
    open: (u: unknown) => {
      if (typeof u === 'string') captured = u
      return null
    },
  } as unknown as Window

  const fakeJquery = (_sel: unknown) => ({
    ready: (fn: () => void) => {
      try {
        fn()
      } catch {
        /* ignore */
      }
    },
    click: (fn: () => void) => {
      clickHandler = fn
    },
    on: (_evt: unknown, fn: () => void) => {
      clickHandler = fn
    },
  })

  const globals = {
    window: fakeWindow,
    document: { readyState: 'complete' as const, getElementById: () => null },
    $: fakeJquery,
    jQuery: fakeJquery,
    btoa,
    atob,
    console: { log: () => {}, warn: () => {}, error: () => {}, info: () => {} },
  }

  try {
    const run = new Function(
      ...Object.keys(globals),
      scripts.join('\n')
    )
    run(...Object.values(globals))
    ;(clickHandler as (() => void) | null)?.()
  } catch {
    return null
  }
  return captured
}
