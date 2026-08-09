// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { sanitizeHtml } from '@/lib/sanitize-html'

describe('sanitizeHtml（复刻官方 ticketDetails filterXSS）', () => {
  it('保留富文本标签与样式', () => {
    const html = '<p>你好 <strong>加粗</strong><br><span style="color:red">红字</span></p>'
    expect(sanitizeHtml(html)).toBe(
      '<p>你好 <strong>加粗</strong><br><span style="color:red">红字</span></p>'
    )
  })

  it('移除 script / style / iframe 标签', () => {
    const html =
      '<p>正文</p><script>alert(1)</script><style>p{color:red}</style>' +
      '<iframe src="http://evil.com"></iframe><p>结尾</p>'
    const result = sanitizeHtml(html)
    expect(result).toContain('正文')
    expect(result).toContain('结尾')
    expect(result).not.toContain('script')
    expect(result).not.toContain('style')
    expect(result).not.toContain('iframe')
    expect(result).not.toContain('alert(1)')
  })

  it('移除事件属性与 javascript: 协议', () => {
    const html =
      '<a href="javascript:alert(1)" onclick="alert(2)">链接</a>' +
      '<img src="javascript:alert(3)" onerror="alert(4)">'
    const result = sanitizeHtml(html)
    expect(result).toContain('链接')
    expect(result).not.toContain('onclick')
    expect(result).not.toContain('onerror')
    expect(result).not.toContain('javascript:')
  })

  it('实体保持编码（浏览器原生渲染）并去除 http-equiv=refresh', () => {
    const html =
      '<meta http-equiv="refresh" content="0">' + '<p>a &amp; b &lt; c</p>'
    const result = sanitizeHtml(html)
    expect(result).toContain('a &amp; b &lt; c')
    expect(result).not.toContain('http-equiv')
  })

  it('空输入原样返回', () => {
    expect(sanitizeHtml('')).toBe('')
  })
})
