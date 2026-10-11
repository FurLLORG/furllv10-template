/**
 * 官方配置内容的同文档注入：等价官方 `goods.js` 的
 * `$.ajaxSetup({cache:true}); $(".config-box .content").html(res.data.data.content)`。
 *
 * 与官方唯一的差别是执行方式：官方靠 jQuery `domManip` 为每个 `<script>` 建标签执行，
 * 顶层 `const`/`let` 进入全局词法环境，所以同一个 document 里第二次注入模块脚本会抛
 * `Identifier 'template' has already been declared`（`mf_cloud.js:1` 的 `const template`），
 * 即官方页面切换商品必须整页跳转。这里改为把脚本放进函数作用域执行（`new Function`），
 * 于是 React 内切换商品无需整页刷新。
 */
import {
  fetchCssText,
  officialScopeMapper,
  resolveCssImports,
  transformCss,
} from '@/lib/official-css'
import {
  OFFICIAL_CONTENT_SELECTOR,
  OFFICIAL_HOST_SELECTOR,
  OFFICIAL_REM_VAR,
} from '@/lib/official-runtime'

/** 模块自带样式（随商品变化）的标记，切换商品时按标记清理 */
const MODULE_CSS_ATTR = 'data-furll-official-module-css'

interface VueHostElement extends HTMLElement {
  __vue__?: { $destroy?: () => void }
}

function destroyModuleInstances(host: HTMLElement): void {
  host.querySelectorAll<VueHostElement>('.template').forEach((element) => {
    element.__vue__?.$destroy?.()
  })
}

/** 清空宿主内容与模块样式（切换商品 / 卸载时调用） */
export function disposeOfficialContent(host: HTMLElement): void {
  destroyModuleInstances(host)
  document
    .querySelectorAll(`style[${MODULE_CSS_ATTR}]`)
    .forEach((element) => element.remove())
  const target = host.querySelector(OFFICIAL_CONTENT_SELECTOR)
  if (target) target.innerHTML = ''
}

function scopeModuleCss(css: string, baseHref: string): string {
  return transformCss(css, {
    baseHref,
    remVar: OFFICIAL_REM_VAR,
    mapSelector: officialScopeMapper(OFFICIAL_HOST_SELECTOR),
  })
}

async function executeScriptTag(script: HTMLScriptElement): Promise<void> {
  const src = script.getAttribute('src')
  const type = (script.getAttribute('type') ?? '').toLowerCase()
  let code: string
  let sourceUrl: string
  if (src) {
    const absolute = new URL(src, document.baseURI).href
    const response = await fetch(absolute, { credentials: 'same-origin' })
    if (!response.ok) {
      throw new Error(`官方模块脚本加载失败：${absolute}（HTTP ${response.status}）`)
    }
    code = await response.text()
    sourceUrl = absolute
  } else {
    code = script.textContent ?? ''
    sourceUrl = 'furll-official-inline.js'
  }
  if (!code.trim()) return
  if (type === 'module') {
    const blob = new Blob([code], { type: 'text/javascript' })
    const url = URL.createObjectURL(blob)
    try {
      await import(/* @vite-ignore */ url)
    } finally {
      URL.revokeObjectURL(url)
    }
    return
  }
  // 函数作用域执行：模块顶层 `const template` 不再污染全局词法环境，可反复注入
  new Function(`${code}\n//# sourceURL=${sourceUrl}`)()
}

/**
 * 把官方 `config_option.content` 的 HTML 嵌入宿主并执行其内嵌脚本。
 * 模块自带的 `<link rel=stylesheet>` / `<style>` 与官方模板同样按 rem 基准改写。
 */
export async function mountOfficialContent(
  host: HTMLElement,
  html: string
): Promise<void> {
  disposeOfficialContent(host)
  const target = host.querySelector<HTMLElement>(OFFICIAL_CONTENT_SELECTOR)
  if (!target) throw new Error('官方配置容器缺失')

  const parsed = new DOMParser().parseFromString(html, 'text/html')

  const links = [...parsed.querySelectorAll('link[rel~="stylesheet"][href]')]
  for (const link of links) {
    const href = link.getAttribute('href') ?? ''
    try {
      const absolute = new URL(href, document.baseURI).href
      const css = await resolveCssImports(await fetchCssText(absolute), absolute)
      const style = document.createElement('style')
      style.setAttribute(MODULE_CSS_ATTR, absolute)
      style.textContent = scopeModuleCss(css, absolute)
      document.head.append(style)
    } catch (error) {
      console.warn('[official-goods] 模块样式加载失败', href, error)
    }
    link.remove()
  }

  parsed.querySelectorAll('style').forEach((style) => {
    style.textContent = scopeModuleCss(
      style.textContent ?? '',
      document.baseURI
    )
  })

  const scripts = [...parsed.querySelectorAll('script')].map((script) => {
    const clone = script.cloneNode(true) as HTMLScriptElement
    script.remove()
    return clone
  })

  target.innerHTML = parsed.body.innerHTML
  if (!target.children.length) {
    throw new Error('官方配置内容为空，请稍后重试')
  }

  // 按文档顺序执行，单个脚本报错不阻断后续脚本（与浏览器多标签行为一致）
  for (const script of scripts) {
    try {
      await executeScriptTag(script)
    } catch (error) {
      console.error('[official-goods] 官方模块脚本执行失败', error)
    }
  }
}
