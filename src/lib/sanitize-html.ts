/**
 * 工单内容 HTML 清洗（复刻官方 ticketDetails.js filterContent 行为：
 * 去 iframe / 去 http-equiv=refresh / js-xss filterXSS 的脚本与事件属性剥离）。
 * - 保留富文本标签（p/br/strong/img/a/table 等）与行内样式
 * - 移除 script/style/iframe/object/embed、事件属性（on*）、javascript: 协议链接
 * - 实体（&amp;/&lt; 等）保持编码，由浏览器原生渲染，不做二次解码（避免字面 < 破坏结构）
 */

const DROP_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed'])
const DANGEROUS_PROTOCOLS = ['javascript:', 'data:text/html', 'vbscript:']

/** 清洗后的 HTML（输入需为字符串；DOMParser 不可用时原样返回） */
export function sanitizeHtml(html: string): string {
  if (!html) return ''
  if (typeof DOMParser === 'undefined') return html

  const doc = new DOMParser().parseFromString(html, 'text/html')

  doc.querySelectorAll('*').forEach((node) => {
    if (DROP_TAGS.has(node.tagName.toLowerCase())) {
      node.remove()
      return
    }
    // 事件属性与危险协议
    Array.from(node.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase()
      if (name.startsWith('on')) {
        node.removeAttribute(attr.name)
        return
      }
      const value = attr.value.trim().toLowerCase()
      if (
        (name === 'href' || name === 'src' || name === 'xlink:href') &&
        DANGEROUS_PROTOCOLS.some((protocol) => value.startsWith(protocol))
      ) {
        node.removeAttribute(attr.name)
        return
      }
      if (name === 'http-equiv' && value === 'refresh') {
        node.removeAttribute(attr.name)
      }
    })
  })

  return doc.body.innerHTML
}
