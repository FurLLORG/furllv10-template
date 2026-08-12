/**
 * 新闻/公告内容反转义（复刻官方 news_detail.js 的 calStr）。
 *
 * 官方 content 字段在数据库中经 HTML 实体编码（&lt; &gt; &quot; &#039; 等），
 * 前端渲染前必须先解码还原真实 HTML，再交给 sanitizeHtml 清洗后注入。
 * - 单层编码（&lt;→<）与后台二次编码（&amp;lt;→<）均处理
 * - &#039; / &nbsp; 等字符引用不解码，由浏览器 innerHTML 渲染时原生解析
 * - 结尾将 <?php 重新转义，防止模板注入
 */

export function decodeNewsContent(str: string): string {
  if (!str) return ''
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;lt;/g, '<')
    .replace(/&amp;gt;/g, '>')
    .replace(/&amp;quot;/g, '"')
    .replace(/&amp;amp;nbsp;/g, ' ')
    .replace(/&amp;#039;/g, "'")
    .replace('<?php', '&lt;?php')
}
