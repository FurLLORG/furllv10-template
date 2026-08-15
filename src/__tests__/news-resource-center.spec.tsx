// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import { DirectionProvider } from '@/context/direction-provider'
import { FontProvider } from '@/context/font-provider'
import { ThemeProvider } from '@/context/theme-provider'
import { router } from '@/router'
import { useAuthStore } from '@/stores/auth-store'

vi.mock('@/hooks/use-addons', () => ({
  useAddons: () => ({
    addons: [
      { id: 19, name: 'IdcsmartFileDownload', title: '文件下载', url: '' },
      { id: 21, name: 'IdcsmartNews', title: '新闻中心', url: '' },
      { id: 26, name: 'IdcsmartHelp', title: '帮助中心', url: '' },
      { id: 27, name: 'IdcsmartTicket', title: '工单中心', url: '' },
    ],
    count: 2,
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
  }),
}))

const newsLang: Record<string, string> = {
  news_text1: '新闻中心',
  news_text2: '分类',
  news_text5: '全部',
  news_text6: '更新时间',
  news_text7: '暂无数据',
  news_text11: '资源中心',
  news_text12: '请输入你需要搜索的内容',
  news_text13: '帮助中心',
  news_text14: '新闻中心',
  news_text15: '文件下载',
}

vi.mock('@/hooks/use-news-lang', () => ({
  useNewsLang: () => ({
    t: (key: string, fallback?: string) => newsLang[key] ?? fallback ?? key,
    lang: newsLang,
    isLoading: false,
    error: null,
  }),
}))

vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return {
    ...actual,
    fetchCommon: vi.fn().mockResolvedValue({
      status: 200,
      msg: 'ok',
      data: { website_name: 'FurLL' },
    }),
    fetchNewsType: vi.fn().mockResolvedValue({
      status: 200,
      msg: 'ok',
      data: {
        list: [
          { id: 1, name: '公告', news_num: 2 },
          { id: 2, name: '行业动态', news_num: 1 },
        ],
        count: 3,
      },
    }),
    fetchNews: vi.fn().mockResolvedValue({
      status: 200,
      msg: 'ok',
      data: {
        list: [
          {
            id: 1,
            title: '平台升级公告',
            img: '',
            create_time: 1723000000,
            update_time: 1723000000,
          },
          { id: 2, title: '新功能上线', img: '', create_time: 1722900000 },
        ],
        count: 2,
      },
    }),
  }
})

beforeEach(() => {
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
  useAuthStore.getState().auth.setAccessToken('test-jwt-token')
  window.localStorage.setItem('jwt', 'test-jwt-token')
  window.history.replaceState({}, '', '/')
})

describe('新闻插件资源中心页面渲染', () => {
  it('/plugin/21/source.htm 渲染资源中心（分类+新闻列表）', async () => {
    await router.load()
    await router.navigate({ href: '/plugin/21/source.htm' })

    render(
      <QueryClientProvider client={new QueryClient()}>
        <ThemeProvider>
          <FontProvider>
            <DirectionProvider>
              <RouterProvider router={router} />
            </DirectionProvider>
          </FontProvider>
        </ThemeProvider>
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('资源中心')).toBeTruthy()
    })
    await waitFor(() => {
      // 列表标题与 header 公告同数据源，可能出现多个匹配
      expect(screen.getAllByText('平台升级公告').length).toBeGreaterThan(0)
      expect(screen.getAllByText('公告').length).toBeGreaterThan(0)
      expect(screen.getByText('行业动态')).toBeTruthy()
    })
  })

  it('点击帮助中心 tab 跳对应插件 URL(/plugin/26/source.htm) 并切换选中高亮，header 不重挂载', async () => {
    await router.load()
    await router.navigate({ href: '/plugin/21/source.htm' })

    render(
      <QueryClientProvider client={new QueryClient()}>
        <ThemeProvider>
          <FontProvider>
            <DirectionProvider>
              <RouterProvider router={router} />
            </DirectionProvider>
          </FontProvider>
        </ThemeProvider>
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getAllByText('资源中心').length).toBeGreaterThan(0)
    })

    // 当前激活 tab 为新闻中心（header 公告同源，tab 按钮文案可能重复，取第一个）
    const helpTab = screen.getAllByRole('button', { name: '帮助中心' })[0]
    const newsTab = screen.getAllByRole('button', { name: '新闻中心' })[0]
    expect(helpTab).toBeTruthy()
    expect(newsTab).toBeTruthy()

    // 切换前：新闻中心为选中态（text-primary），帮助中心为未选中（text-[#303133]）
    expect(newsTab.className).toContain('text-primary')
    expect(helpTab.className).toContain('text-[#303133]')

    helpTab.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true })
    )

    // URL 变为对应插件的 /plugin/26/source.htm（帮助中心插件 id=26，来自 FurllHome 插件接口）
    await waitFor(() => {
      expect(window.location.pathname).toContain('/plugin/26/source.htm')
    })

    // 选中高亮切换到帮助中心（text-primary），新闻中心失选（text-[#303133]）
    await waitFor(() => {
      expect(helpTab.className).toContain('text-primary')
      expect(newsTab.className).toContain('text-[#303133]')
    })
  })
})
