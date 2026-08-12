// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { decodeNewsContent } from '@/lib/news-content'
import { sanitizeHtml } from '@/lib/sanitize-html'

describe('decodeNewsContent（复刻官方 news_detail.js calStr）', () => {
  it('解码单层实体编码还原真实 HTML', () => {
    const encoded =
      '&lt;!DOCTYPE html&gt;&lt;html&gt;&lt;body&gt;&lt;p&gt;尊敬的客户：&lt;/p&gt;&lt;/body&gt;&lt;/html&gt;'
    expect(decodeNewsContent(encoded)).toBe(
      '<!DOCTYPE html><html><body><p>尊敬的客户：</p></body></html>'
    )
  })

  it('解码引号；&#039; 字符引用保留由浏览器原生解析', () => {
    const encoded =
      '&lt;span style=&quot;color: red; font-family: &#039;PingFang SC&#039;&quot;&gt;你好&lt;/span&gt;'
    const decoded = decodeNewsContent(encoded)
    expect(decoded).toContain('<span style="color: red')
    // 单引号保留为字符引用（官方 calStr 不解码 &#039;，渲染时浏览器原生解析为 '）
    expect(decoded).toContain('&#039;PingFang SC&#039;')
  })

  it('再编码实体 &amp;lt; 也解码为标签', () => {
    expect(decodeNewsContent('&amp;lt;b&amp;gt;加粗&amp;lt;/b&amp;gt;')).toBe(
      '<b>加粗</b>'
    )
  })

  it('防止 <?php 模板注入', () => {
    expect(decodeNewsContent('&lt;?php echo 1; ?&gt;')).toBe(
      '&lt;?php echo 1; ?>'
    )
  })

  it('空输入原样返回', () => {
    expect(decodeNewsContent('')).toBe('')
  })
})

describe('新闻/公告内容渲染链路（解码 → 清洗）', () => {
  it('解码后清洗输出 body 内 HTML，去掉文档壳与危险标签', () => {
    const raw =
      '&lt;!DOCTYPE html&gt;&lt;html&gt;&lt;head&gt;&lt;/head&gt;&lt;body&gt;' +
      '&lt;p&gt;尊敬的客户：您好！&lt;/p&gt;' +
      '&lt;script&gt;alert(1)&lt;/script&gt;' +
      '&lt;a href=&quot;javascript:alert(2)&quot; onclick=&quot;x()&quot;&gt;链接&lt;/a&gt;' +
      '&lt;/body&gt;&lt;/html&gt;'
    const html = sanitizeHtml(decodeNewsContent(raw))
    expect(html).toContain('<p>尊敬的客户：您好！</p>')
    expect(html).not.toContain('<html')
    expect(html).not.toContain('script')
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('javascript:')
  })

  it('保留富文本样式与 br', () => {
    const raw =
      '&lt;p&gt;&lt;span style=&quot;color: #2d3436&quot;&gt;尊敬的客户：&lt;/span&gt;' +
      '&lt;br/&gt;&lt;span style=&quot;color: #2d3436&quot;&gt;您好！&lt;/span&gt;&lt;/p&gt;'
    const html = sanitizeHtml(decodeNewsContent(raw))
    expect(html).toContain('<p>')
    expect(html).toContain('color: #2d3436')
    expect(html).toContain('尊敬的客户：')
    expect(html).toContain('您好！')
    // &#039; 字符引用经 DOMParser 解析后在最终 HTML 中呈现为单引号
    const rawApostrophe =
      '&lt;p style=&quot;font-family: &#039;PingFang SC&#039;&quot;&gt;你好&lt;/p&gt;'
    expect(sanitizeHtml(decodeNewsContent(rawApostrophe))).toContain(
      "font-family: 'PingFang SC'"
    )
  })
})
