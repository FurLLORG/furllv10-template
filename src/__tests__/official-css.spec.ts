import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  dropDocumentSelectors,
  officialScopeMapper,
  resolveCssImports,
  splitSelectorList,
  stripDocumentLevelRules,
  stripDocumentPrefix,
  transformCss,
} from '@/lib/official-css'
import { mountOfficialContent } from '@/lib/official-content'

const HOST = '.furll-official-goods'
const BASE = 'https://example.com/cart/template/pc/default/css/goods.css'
const REM_VAR = 'var(--furll-rem)'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('transformCss：rem 改写', () => {
  it('rem 尺寸改写成 calc(N * var(--furll-rem))，px 原样保留', () => {
    const out = transformCss(
      '.a{font-size:.14rem;padding:10px;margin:1.5rem 0}',
      { baseHref: BASE, remVar: REM_VAR }
    )
    expect(out).toBe(
      '.a{font-size:calc(.14 * var(--furll-rem));padding:10px;margin:calc(1.5 * var(--furll-rem)) 0}'
    )
  })

  it('不传 remVar 时 rem 原样保留（覆盖表这类已全 px 的样式）', () => {
    expect(transformCss('.a{height:2rem}', { baseHref: BASE })).toBe(
      '.a{height:2rem}'
    )
  })

  it('@media 前导条件不碰，块内规则仍改写', () => {
    expect(
      transformCss('@media (min-width:751px){.a{height:1rem}}', {
        baseHref: BASE,
        remVar: REM_VAR,
      })
    ).toBe('@media (min-width:751px){.a{height:calc(1 * var(--furll-rem))}}')
  })
})

describe('transformCss：选择器作用域', () => {
  const options = { baseHref: BASE, mapSelector: officialScopeMapper(HOST) }

  it('html / body / :root 映射到宿主容器', () => {
    const out = transformCss(
      `html body .x{color:red}:root[theme='default']{--color-primary:#1A56DB}`,
      options
    )
    expect(out).toBe(
      `${HOST} .x{color:red}${HOST}[theme='default']{--color-primary:#1A56DB}`
    )
  })

  it('含 .el-* 的选择器保持全局（Element UI 弹层 portal 到 body）', () => {
    expect(transformCss('.el-select-dropdown{display:none}', options)).toBe(
      '.el-select-dropdown{display:none}'
    )
  })

  it('* 选择器同时命中宿主与宿主内元素', () => {
    expect(transformCss('*{box-sizing:border-box}', options)).toBe(
      `${HOST}, ${HOST} *{box-sizing:border-box}`
    )
  })

  it('@keyframes / @font-face 不加作用域前缀', () => {
    const out = transformCss(
      '@keyframes spin{from{transform:rotate(0)}to{transform:rotate(1turn)}}@font-face{font-family:x;src:url(x.woff)}',
      options
    )
    expect(out).toContain(
      '@keyframes spin{from{transform:rotate(0)}to{transform:rotate(1turn)}}'
    )
    expect(out).toContain('@font-face{font-family:x;src:url("https://example.com/cart/template/pc/default/css/x.woff")}')
  })
})

describe('transformCss：url() 绝对化与 @import / @charset 剥离', () => {
  it('相对 url() 按 CSS 文件地址绝对化，data: 与 # 片段不动', () => {
    const out = transformCss(
      '.a{background:url(../img/a.png)}.b{background:url(data:image/png;base64,AA)}.c{background:url(#grad)}',
      { baseHref: BASE }
    )
    expect(out).toContain(
      'url("https://example.com/cart/template/pc/default/img/a.png")'
    )
    expect(out).toContain('url(data:image/png;base64,AA)')
    expect(out).toContain('url(#grad)')
  })

  it('残留 @charset / @import 被剥离（改由 resolveCssImports 内联）', () => {
    const out = transformCss(
      `@charset 'utf-8';\n@import "element-comment.css";\n.a{color:red}`,
      { baseHref: BASE }
    )
    expect(out).not.toContain('@charset')
    expect(out).not.toContain('@import')
    expect(out).toContain('.a{color:red}')
  })
})

describe('选择器工具', () => {
  it('splitSelectorList 只按顶层逗号拆分', () => {
    expect(splitSelectorList('a:not(.x, .y), [data-a=","]')).toEqual([
      'a:not(.x, .y)',
      ' [data-a=","]',
    ])
  })

  it('stripDocumentPrefix 只剥离文档级类型选择器', () => {
    expect(stripDocumentPrefix('html body .x')).toBe('.x')
    expect(stripDocumentPrefix('body')).toBe('')
    expect(stripDocumentPrefix('body > .x')).toBe('> .x')
    expect(stripDocumentPrefix('html-x')).toBe('html-x')
  })

  it('dropDocumentSelectors 丢弃 html / body，保留其余', () => {
    expect(dropDocumentSelectors('html')).toBeNull()
    expect(dropDocumentSelectors('body')).toBeNull()
    expect(dropDocumentSelectors('.goods')).toBe('.goods')
  })
})

describe('stripDocumentLevelRules：覆盖表同文档注入前处理', () => {
  it('丢弃 html, body 规则，其余原样（不改 rem）', () => {
    const out = stripDocumentLevelRules(
      'html, body{height:100%}\n.goods{display:block;font-size:14px}.goods .x{height:2rem}'
    )
    expect(out).not.toContain('height:100%')
    expect(out).toContain('.goods{display:block;font-size:14px}')
    expect(out).toContain('.goods .x{height:2rem}')
  })
})

describe('resolveCssImports：@import 递归内联', () => {
  it('内联 @import 内容并保留被引文件内的相对 url 基准；skip 命中时跳过', async () => {
    const fetched: string[] = []
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = String(input)
      fetched.push(url)
      const body = url.endsWith('element-comment.css')
        ? '.comment{color:blue}'
        : '@import url("element-comment.css");.a{color:red}'
      return new Response(body, { status: 200 })
    })
    const out = await resolveCssImports(
      '@import "common/x.css";.root{color:black}',
      'https://example.com/css/common.css',
      (raw) => raw === 'element-ui.css'
    )
    expect(fetched).toEqual([
      'https://example.com/css/common/x.css',
      'https://example.com/css/common/element-comment.css',
    ])
    expect(out).toContain('.a{color:red}')
    expect(out).toContain('.comment{color:blue}')
    expect(out).toContain('.root{color:black}')
  })
})

describe('mountOfficialContent：官方 content 注入与脚本执行', () => {
  it('内联脚本在函数作用域里执行，同一 const 声明可重复注入（官方切商品不再整页跳转的根因）', async () => {
    const probe = window as unknown as { __furllProbe?: number }
    delete probe.__furllProbe
    const host = document.createElement('div')
    host.className = HOST
    host.innerHTML =
      '<div class="goods"><div class="config-box"><div class="content"></div></div></div>'
    document.body.append(host)
    const html =
      '<div class="template">配置</div>' +
      '<script>const template = document.querySelectorAll(".template")[0];window.__furllProbe = (window.__furllProbe || 0) + 1;template.dataset.touched = "1"</script>'

    await mountOfficialContent(host, html)
    await mountOfficialContent(host, html)

    expect(probe.__furllProbe).toBe(2)
    const rendered = host.querySelector('.template')
    expect(rendered?.textContent).toBe('配置')
    expect(rendered?.getAttribute('data-touched')).toBe('1')
    host.remove()
  })

  it('没有 .config-box .content 容器时抛错', async () => {
    const host = document.createElement('div')
    await expect(mountOfficialContent(host, '<div>x</div>')).rejects.toThrow(
      '官方配置容器缺失'
    )
  })
})
