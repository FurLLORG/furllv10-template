// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DirectionProvider } from '@/context/direction-provider'
import { FontProvider } from '@/context/font-provider'
import { ThemeProvider } from '@/context/theme-provider'
import { router } from '@/router'
import { useAuthStore } from '@/stores/auth-store'

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
  window.history.replaceState({}, '', '/')
})

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

describe('免登录公共页面（仅 /cart/goodsList.htm）', () => {
  it('游客（无 token）可直接访问 /cart/goodsList.htm，不跳登录', async () => {
    useAuthStore.getState().auth.reset()
    window.localStorage.removeItem('jwt')
    window.history.replaceState({}, '', '/')
    await router.load()
    await router.navigate({ href: '/cart/goodsList.htm' })
    expect(router.state.location.pathname).toBe('/cart/goodsList.htm')
    expect(
      router.state.matches.map((m) => m.routeId).join(' | ')
    ).toContain('public-client')
  })

  it('游客访问其他页面（/home.htm /source.htm /cart/goods.htm /news_detail.htm）仍跳登录页', async () => {
    useAuthStore.getState().auth.reset()
    window.localStorage.removeItem('jwt')
    window.history.replaceState({}, '', '/')
    await router.load()
    for (const href of [
      '/home.htm',
      '/source.htm',
      '/news_detail.htm?id=3',
      '/cart/goods.htm?id=1',
      '/cart/shoppingCar.htm',
    ]) {
      await router.navigate({ href })
      expect(router.state.location.pathname).toBe('/login.htm')
    }
  })
})

describe('工单插件路径路由（/plugin/:plugin_id/:view_html.htm）', () => {
  it('侧边栏菜单链接 plugin/<插件ID>/ticket.htm 命中 SPA 工单路由而非 404', async () => {
    // 会员中心路由守卫需要登录态（axios 拦截器见 lib/api.ts）
    useAuthStore.getState().auth.setAccessToken('test-jwt-token')
    window.history.replaceState({}, '', '/')
    await router.load()
    await router.navigate({ href: '/plugin/27/ticket.htm' })
    expect(router.state.location.pathname).toBe('/plugin/27/ticket.htm')
    const routeIds = router.state.matches.map((m) => m.routeId).join(' | ')
    expect(routeIds).toContain('plugin')
    // 插件视图由 PluginPage 统一解析（命中 idcsmart_ticket 渲染工单，否则提示未适配）
    expect(router.state.matches.some((m) => /plugin/i.test(m.routeId))).toBe(
      true
    )
  })

  it('plugin/<插件ID>/addTicket.htm 与 ticketDetails.htm?id= 同样命中 SPA 插件路由', async () => {
    await router.navigate({ href: '/plugin/27/addTicket.htm' })
    expect(router.state.location.pathname).toBe('/plugin/27/addTicket.htm')
    expect(
      router.state.matches.some((m) => /plugin/i.test(m.routeId))
    ).toBe(true)

    await router.navigate({ href: '/plugin/27/ticketDetails.htm?id=5' })
    expect(router.state.location.pathname).toBe(
      '/plugin/27/ticketDetails.htm'
    )
    expect(router.state.location.searchStr).toContain('id=5')
  })
})

describe('新闻插件资源中心路径路由（/plugin/:plugin_id/source.htm 及子页面）', () => {
  it('plugin/<插件ID>/source.htm 命中 SPA 插件路由而非 404', async () => {
    useAuthStore.getState().auth.setAccessToken('test-jwt-token')
    window.history.replaceState({}, '', '/')
    await router.load()
    await router.navigate({ href: '/plugin/21/source.htm' })
    expect(router.state.location.pathname).toBe('/plugin/21/source.htm')
    expect(
      router.state.matches.some((m) => /plugin/i.test(m.routeId))
    ).toBe(true)
  })

  it('plugin/<插件ID>/news_detail.htm?id= 与裸 news_detail.htm?id= 均命中 SPA 路由', async () => {
    await router.navigate({ href: '/plugin/21/news_detail.htm?id=3' })
    expect(router.state.location.pathname).toBe(
      '/plugin/21/news_detail.htm'
    )
    expect(router.state.location.searchStr).toContain('id=3')

    await router.navigate({ href: '/news_detail.htm?id=3' })
    expect(router.state.location.pathname).toBe('/news_detail.htm')
    expect(
      router.state.matches.some((m) => /news_detail/i.test(m.routeId))
    ).toBe(true)
  })

  it('裸 /source.htm 同样命中 SPA 资源中心路由', async () => {
    await router.navigate({ href: '/source.htm' })
    expect(router.state.location.pathname).toBe('/source.htm')
    expect(
      router.state.matches.some((m) => /source/i.test(m.routeId))
    ).toBe(true)
  })
})

describe('实名认证插件路径路由（/plugin/:plugin_id/authentication_*.htm）', () => {
  it('plugin/<插件ID>/authentication_select.htm 命中 SPA 插件路由而非 404', async () => {
    useAuthStore.getState().auth.setAccessToken('test-jwt-token')
    window.history.replaceState({}, '', '/')
    await router.load()
    await router.navigate({ href: '/plugin/28/authentication_select.htm' })
    expect(router.state.location.pathname).toBe(
      '/plugin/28/authentication_select.htm'
    )
    expect(
      router.state.matches.some((m) => /plugin/i.test(m.routeId))
    ).toBe(true)
  })

  it('plugin/<插件ID>/authentication_status.htm?type=1 携带 search 命中 SPA 路由', async () => {
    await router.navigate({
      href: '/plugin/28/authentication_status.htm?type=1',
    })
    expect(router.state.location.pathname).toBe(
      '/plugin/28/authentication_status.htm'
    )
    expect(router.state.location.searchStr).toContain('type=1')
  })

  it('裸 /authentication_person.htm?name=xxx 与 /authentication_thrid.htm?type=2 同样命中 SPA 路由', async () => {
    await router.navigate({ href: '/authentication_person.htm?name=idcsmartali' })
    expect(router.state.location.pathname).toBe('/authentication_person.htm')
    expect(router.state.location.searchStr).toContain('name=idcsmartali')
    expect(
      router.state.matches.some((m) => /authentication_person/i.test(m.routeId))
    ).toBe(true)

    await router.navigate({ href: '/authentication_thrid.htm?type=2' })
    expect(router.state.location.pathname).toBe('/authentication_thrid.htm')
    expect(router.state.location.searchStr).toContain('type=2')
  })
})

describe('导航流程（复现点击登录卡死）', () => {
  it('首页 → 点击登录 → 登录页；点击进入会员中心 → 登录页', async () => {
    useAuthStore.getState().auth.reset()
    window.localStorage.removeItem('jwt')
    window.history.replaceState({}, '', '/')
    await router.load()
    render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <FontProvider>
            <DirectionProvider>
              <RouterProvider router={router} />
            </DirectionProvider>
          </FontProvider>
        </ThemeProvider>
      </QueryClientProvider>
    )

    expect(screen.getByText(/FurLLV10 模板/)).toBeTruthy()

    // 点击登录
    const loginBtn = screen.getAllByRole('link', { name: /登录/ })[0]
    await userEvent.click(loginBtn)
    await new Promise((r) => setTimeout(r, 200))
    expect(router.state.location.pathname).toBe('/login.htm')
    expect(screen.getByPlaceholderText('手机号或邮箱')).toBeTruthy()

    // 回首页，点进入会员中心
    await router.navigate({ href: '/' })
    await new Promise((r) => setTimeout(r, 200))
    const enterBtn = screen.getByRole('link', { name: /进入会员中心/ })
    await userEvent.click(enterBtn)
    await new Promise((r) => setTimeout(r, 200))
    expect(router.state.location.pathname).toBe('/login.htm')
  })
})
