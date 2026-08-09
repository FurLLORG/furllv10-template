let injected = false

/**
 * 加载 V10 官方图标库（/upload/common/iconfont/iconfont.css，随系统源码分发）
 * 菜单接口返回的 icon 字段即为该库中的类名（如 icon-a-7），配合 .iconfont 使用
 * 幂等：全局只注入一次
 */
export function loadIconfont(): void {
  if (injected || typeof document === 'undefined') return
  injected = true
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = '/upload/common/iconfont/iconfont.css'
  document.head.appendChild(link)
}
