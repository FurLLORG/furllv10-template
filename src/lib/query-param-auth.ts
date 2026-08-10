/**
 * 后台「以用户登录」前置引导。
 *
 * 官方 /admin/v1/client/:id/login 之后，后台会跳转到：
 *   {clientarea_url 或 website_url}/home.htm?queryParam=<jwt>
 * （见 public/admin/template/default/js/client_detail.js loginByUser）
 *
 * 这里在 SPA 启动前把 queryParam 里的 jwt 落地到 localStorage.jwt，
 * 使 auth-store 初始化 getJwt() / 路由守卫 / axios 拦截器能读到登录态。
 * 写完后从地址栏抹掉该参数，避免刷新时残留。
 *
 * 本模块是 side-effect（顶部自执行），同时导出纯函数供测试复用。
 */
const QUERY_KEY = 'queryParam'
const JWT_KEY = 'jwt'

/**
 * 函数实际只用到这三个成员，用结构化接口收窄类型：
 * - location 只需可读 href（测试用 URL mock，无需完整 Location 类型）
 * - history 只需 replaceState
 * - localStorage 只需 setItem
 */
export type QueryParamAuthWindow = {
  location: { href: string }
  history: { replaceState(data: unknown, title: string, url: string): void }
  localStorage: Pick<Storage, 'setItem'>
}

export function applyQueryParamAuth(win: QueryParamAuthWindow): void {
  const url = new URL(win.location.href)
  const jwt = url.searchParams.get(QUERY_KEY)
  if (!jwt) return

  win.localStorage.setItem(JWT_KEY, jwt)

  url.searchParams.delete(QUERY_KEY)
  win.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
}

if (typeof window !== 'undefined') {
  applyQueryParamAuth(window)
}
