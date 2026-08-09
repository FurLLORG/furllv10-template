const LOGO_CACHE_KEY = 'furllv10_system_logo'

// 侧边栏顶部 logo 缓存：common 接口未返回时先用上次的 logo 链接占位，
// 接口返回后若 url 变化则更新缓存并展示新 logo
export function getCachedLogo(): string {
  try {
    return window.localStorage.getItem(LOGO_CACHE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function cacheLogo(url: string) {
  try {
    if (url) {
      window.localStorage.setItem(LOGO_CACHE_KEY, url)
    } else {
      window.localStorage.removeItem(LOGO_CACHE_KEY)
    }
  } catch {
    // localStorage 不可用时静默降级，不影响功能
  }
}
