/**
 * 官方模板 CSS 的同文档改造工具。
 *
 * 官方 PC 模板的尺寸以 `rem` 书写、基准是 100px：
 * - `cart/template/pc/default/css/goods_iframe.css:17-19` 把 `html` 字号钉死 100px；
 * - `clientarea/template/pc/default/js/common/common.js:50-67` 按 1920 宽算出 `rem = 100px`。
 * 而 React 壳是 Tailwind v4，全站 rem 基准必须是浏览器默认 16px，两者无法共用同一个根字号。
 * ⇒ 把官方 CSS 的 rem 改写成 `calc(N * var(--furll-rem))`，基准由宿主容器提供。
 *
 * 官方 CSS 的 `html` / `body` / `:root` 指向「整个文档」，同文档注入时必须改写成宿主容器，
 * 否则官方 reset 与 common.css 会直接改动 React 页面布局。
 */

/** 选择器改写：返回 null 表示该选择器在本次注入中不生效（整条规则可能被丢弃）。 */
export type SelectorMapper = (selector: string) => string | null

export interface CssTransformOptions {
  /** 相对 `url()` 的解析基准，应当是 CSS 文件自身的绝对地址 */
  baseHref: string
  /** rem 的改写目标变量；缺省时保留 rem 原样（覆盖表这类已全 px 的样式不需要改写） */
  remVar?: string
  /** 选择器改写；缺省时保留原选择器 */
  mapSelector?: SelectorMapper
}

/** 递归遍历内部块的 at-rule（其内部仍是规则表） */
const NESTED_AT_RULES = new Set([
  'media',
  'supports',
  'layer',
  'container',
  'document',
])

/** 去除 `@charset` / 残余 `@import`：两者不能出现在规则表中间，否则会被误当选择器前缀 */
function stripAtStatements(css: string): string {
  return css
    .replace(/@charset\s+[^;]*;/gi, '')
    .replace(
      /@import\s+(?:url\(\s*(['"]?)[^'")]*\1\s*\)|(['"])[^'"]*\2)\s*[^;]*;/gi,
      ''
    )
}

function absolutizeUrls(css: string, baseHref: string): string {
  return css.replace(
    /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
    (match, _quote: string, raw: string) => {
      const url = raw.trim()
      if (!url || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url)) return match
      try {
        return `url("${new URL(url, baseHref).href}")`
      } catch {
        return match
      }
    }
  )
}

function remToCalc(text: string, remVar: string): string {
  return text.replace(
    /(-?\d*\.?\d+)rem\b/g,
    (_match, value: string) => `calc(${value} * ${remVar})`
  )
}

/** 声明体（含自定义属性的值）改写：只在这里碰 rem，避免污染 @media 前导条件 */
function transformBody(body: string, options: CssTransformOptions): string {
  return options.remVar ? remToCalc(body, options.remVar) : body
}

/** 找到与 `{` 配对的 `}`，跳过注释与字符串里的括号 */
function matchBrace(css: string, openAt: number): number {
  let depth = 0
  for (let i = openAt; i < css.length; i += 1) {
    const char = css[i]
    if (char === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      i = end === -1 ? css.length : end + 1
      continue
    }
    if (char === '"' || char === "'") {
      const quote = char
      i += 1
      while (i < css.length && css[i] !== quote) {
        if (css[i] === '\\') i += 1
        i += 1
      }
      continue
    }
    if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return css.length
}

/** 按顶层逗号拆分选择器列表（尊重 `()` / `[]` / 引号） */
export function splitSelectorList(list: string): string[] {
  const result: string[] = []
  let current = ''
  let depth = 0
  for (let i = 0; i < list.length; i += 1) {
    const char = list[i]
    if (char === '"' || char === "'") {
      const quote = char
      current += char
      i += 1
      while (i < list.length && list[i] !== quote) {
        if (list[i] === '\\') {
          current += list[i]
          i += 1
        }
        current += list[i]
        i += 1
      }
      current += quote
      continue
    }
    if (char === '(' || char === '[') depth += 1
    else if (char === ')' || char === ']') depth -= 1
    if (char === ',' && depth === 0) {
      result.push(current)
      current = ''
      continue
    }
    current += char
  }
  result.push(current)
  return result
}

function mapSelectorList(
  list: string,
  mapper: SelectorMapper | undefined
): string | null {
  if (!mapper) return list.trim()
  const mapped = splitSelectorList(list)
    .map((selector) => mapper(selector.trim()))
    .filter((selector): selector is string => Boolean(selector))
  return mapped.length ? mapped.join(', ') : null
}

/**
 * 去掉选择器开头的文档级类型选择器（`html` / `body`）。
 * `html body .x` → `.x`；单独的 `html` / `body` → 空串；`html-x`（自定义元素）不动。
 */
export function stripDocumentPrefix(selector: string): string {
  let rest = selector.trim()
  for (;;) {
    const match = /^(?:html|body)\b/.exec(rest)
    if (!match) return rest
    const after = rest.slice(match[0].length)
    if (after && !/^[\s>+~.:#[]/.test(after)) return rest
    rest = after.trimStart()
  }
}

/**
 * 官方模板 CSS → 宿主容器作用域（`html`/`body`/`:root` 映射为宿主元素本身）。
 *
 * 例外：含 `.el-*` 的选择器保持全局。Element UI 会把下拉/弹层 portal 到 `document.body`，
 * 作用域化后这些节点落在宿主之外会直接掉样式；而 `.el-*` 只可能由官方内容产生，
 * React 壳不用 Element UI，保持全局没有冲突（`element-ui.css` 本身也是全局 link）。
 */
export function officialScopeMapper(hostSelector: string): SelectorMapper {
  return (candidate) => {
    const selector = candidate.trim()
    if (!selector) return hostSelector
    if (/\.el-/.test(selector)) return selector
    if (selector === '*') return `${hostSelector}, ${hostSelector} *`
    if (selector.startsWith(':root')) {
      const rest = selector.slice(':root'.length).trim()
      if (!rest) return hostSelector
      return /^[>+~]/.test(rest)
        ? `${hostSelector} ${rest}`
        : `${hostSelector}${rest}`
    }
    const stripped = stripDocumentPrefix(selector)
    if (!stripped) return hostSelector
    return stripped === selector
      ? `${hostSelector} ${selector}`
      : `${hostSelector} ${stripped}`
  }
}

/** 去掉文档级选择器（`html, body { height:100% }` 整条丢弃），其余保留原样 */
export const dropDocumentSelectors: SelectorMapper = (candidate) => {
  const stripped = stripDocumentPrefix(candidate)
  return stripped === '' ? null : stripped
}

function walk(css: string, options: CssTransformOptions): string {
  let out = ''
  let index = 0
  while (index < css.length) {
    const braceAt = css.indexOf('{', index)
    if (braceAt === -1) {
      out += css.slice(index)
      break
    }
    const prelude = css.slice(index, braceAt)
    const closeAt = matchBrace(css, braceAt)
    const body = css.slice(braceAt + 1, closeAt)
    const trimmed = prelude.trim()
    if (!trimmed.startsWith('@')) {
      const mapped = mapSelectorList(trimmed, options.mapSelector)
      if (mapped) {
        out += `${prelude.slice(0, prelude.length - prelude.trimStart().length)}${mapped}{${transformBody(body, options)}}`
      }
    } else {
      const name = (trimmed.slice(1).match(/^[-\w]+/)?.[0] ?? '').toLowerCase()
      out += NESTED_AT_RULES.has(name)
        ? `${prelude}{${walk(body, options)}}`
        : `${prelude}{${transformBody(body, options)}}`
    }
    index = closeAt + 1
  }
  return out
}

/** 把一段 CSS 文本改写为同文档可安全注入的形态 */
export function transformCss(css: string, options: CssTransformOptions): string {
  const prepared = absolutizeUrls(stripAtStatements(css), options.baseHref)
  return walk(prepared, options)
}

/** 覆盖表（`legacy-goods-iframe.css`，全 px、已按 `.goods` 作用域）同文档注入前只剔除文档级规则 */
export function stripDocumentLevelRules(css: string): string {
  return transformCss(css, {
    baseHref: document.baseURI,
    mapSelector: dropDocumentSelectors,
  })
}

const IMPORT_RE =
  /@import\s+(?:url\(\s*(['"]?)([^'")]+)\1\s*\)|(['"])([^'"]+)\3)\s*([^;]*);/gi

export async function fetchCssText(href: string): Promise<string> {
  const response = await fetch(href, { credentials: 'same-origin' })
  if (!response.ok) {
    throw new Error(`官方样式加载失败：${href}（HTTP ${response.status}）`)
  }
  return response.text()
}

/**
 * 递归内联 `@import`：官方 `common.css:1` 引入 `element-comment.css`。
 * `element-ui.css`（285KB 且 0 rem）由调用方用普通 `<link>` 单独加载，通过 skip 跳过。
 */
export async function resolveCssImports(
  css: string,
  baseHref: string,
  skip?: (rawHref: string) => boolean
): Promise<string> {
  const matches = [...css.matchAll(IMPORT_RE)]
  if (!matches.length) return css
  const parts: string[] = []
  let cursor = 0
  for (const match of matches) {
    parts.push(css.slice(cursor, match.index))
    cursor = match.index + match[0].length
    const raw = match[2] ?? match[4]
    if (skip?.(raw)) continue
    const absolute = new URL(raw, baseHref).href
    const inner = await resolveCssImports(
      await fetchCssText(absolute),
      absolute,
      skip
    )
    const media = (match[5] ?? '').trim()
    parts.push(media ? `@media ${media}{${inner}}` : inner)
  }
  parts.push(css.slice(cursor))
  return parts.join('')
}
