/**
 * preview 行值工具：官方接口返回的 preview value 首段带标识
 * （国家码如 "US"、系统名如 "CentOS"），图标渲染与展示文本拆分时共用。
 */

/** 取 preview value 首段标识（国家码 / 系统名） */
export function extractPreviewCode(value?: string): string {
  return (value ?? '').trim().split(/\s+/)[0] ?? ''
}

/**
 * 去掉 preview value 首段标识，仅保留展示文本：
 * "US 美国轻量区" → "美国轻量区"；"CentOS CentOS-7.6.1810-x64" → "CentOS-7.6.1810-x64"
 */
export function stripPreviewPrefix(value?: string): string {
  const parts = (value ?? '').trim().split(/\s+/)
  return parts.slice(1).join(' ') || (parts[0] ?? '')
}
