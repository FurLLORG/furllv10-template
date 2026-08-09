import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Outlet, useLocation } from '@tanstack/react-router'
import { fetchCommon, fetchIndex, fetchMenu } from '@/api'
import { useCartSidebarStore } from '@/stores/cart-sidebar-store'
import { ProductGroupsPrefetch } from '@/features/cart/product-groups-prefetch'
import { menuToNavGroups } from '@/lib/client-menu'
import { gravatarUrl } from '@/lib/gravatar'
import { loadIconfont } from '@/lib/iconfont'
import { getCachedLogo, cacheLogo } from '@/lib/logo-cache'
import { cn } from '@/lib/utils'
import { LayoutProvider } from '@/context/layout-provider'
import { SearchProvider } from '@/context/search-provider'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { clientSidebarData } from '@/components/layout/data/sidebar-data-client'
import { ClientHeader } from '@/components/layout/client-header'
import { ClientSidebar } from '@/components/layout/client-sidebar'
import { Main } from '@/components/layout/main'
import { SkipToMain } from '@/components/skip-to-main'

type ClientLayoutProps = {
  children?: React.ReactNode
}

export function ClientLayout({ children }: ClientLayoutProps) {
  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  const indexQuery = useQuery({
    queryKey: ['client-index'],
    queryFn: fetchIndex,
    retry: false,
  })
  const menuQuery = useQuery({
    queryKey: ['client-menu'],
    queryFn: fetchMenu,
    retry: false,
  })
  const systemLogo = commonQuery.data?.data.system_logo
  const account = indexQuery.data?.data.account
  const loading = indexQuery.isLoading || commonQuery.isLoading

  // 左侧栏模式：未手动选择时按页面默认（goodsList 产品分组 / 其他页面用户中心）。
  // 进入新页面时重置手动选择，保证每次进 goodsList 都默认产品分组；
  // 手动切换仅对当前页面生效，切换按钮常驻侧边栏头部
  const pathname = useLocation({ select: (location) => location.pathname })
  const chosenMode = useCartSidebarStore((state) => state.mode)
  const isGoodsListPage = pathname === '/cart/goodsList.htm'
  const effectiveMode = chosenMode ?? (isGoodsListPage ? 'groups' : 'user')

  // 工单中心用 fixed 布局：主内容区高度 = 视口 − 顶栏，页面自身内部滚动，
  // 避免靠 100svh 硬编码高度导致整体滚动连带顶栏。addTicket 是普通表单页，不适用
  const isTicketPage =
    pathname.endsWith('/ticket.htm') ||
    pathname.endsWith('/ticket') ||
    pathname.endsWith('/ticketDetails.htm') ||
    /\/(plugin\/[^/]+\/)(ticket|ticketDetails)(\.htm)?$/.test(pathname)

  useEffect(() => {
    useCartSidebarStore.setState({ mode: null })
  }, [pathname])

  // logo 缓存：接口未返回时先用上次缓存的链接占位，返回后 url 变化则更新缓存并展示新 logo。
  // 渲染期调整状态（React 官方模式，替代 effect 内 setState）
  const [cachedLogo, setCachedLogo] = useState(() => getCachedLogo())
  if (systemLogo && systemLogo !== cachedLogo) {
    cacheLogo(systemLogo)
    setCachedLogo(systemLogo)
  }
  const sidebarLogo = systemLogo || cachedLogo || undefined

  // 侧边栏菜单优先用 V10 /menu 接口，失败/为空时回退静态配置（账户组贴底）
  const parsedMenu = menuToNavGroups(menuQuery.data?.data.menu ?? [])
  const fallbackTop = clientSidebarData.navGroups.filter(
    (group) => group.title !== '账户'
  )
  const fallbackBottom = clientSidebarData.navGroups.filter(
    (group) => group.title === '账户'
  )
  const topNavGroups = parsedMenu?.top ?? fallbackTop
  const bottomNavGroups = parsedMenu?.bottom ?? fallbackBottom
  const user = {
    name: account?.username || '用户',
    email:
      account?.email ||
      (account?.phone ? `+${account.phone_code ?? ''}${account.phone}` : ''),
    avatar: account?.email ? gravatarUrl(account.email) : '',
  }

  useEffect(() => {
    loadIconfont()
  }, [])

  return (
    <SearchProvider>
      <LayoutProvider>
        <SidebarProvider>
          <ProductGroupsPrefetch />
          <SkipToMain />
          <ClientSidebar
            mode={effectiveMode}
            logoUrl={sidebarLogo}
            user={user}
            loading={loading}
            menuLoading={menuQuery.isLoading}
            navGroups={topNavGroups}
            bottomNavGroups={bottomNavGroups}
          />
          <SidebarInset
            className={cn(
              '@container/content',
              'has-data-[layout=fixed]:h-svh',
              'peer-data-[variant=inset]:has-data-[layout=fixed]:h-[calc(100svh-(var(--spacing)*4))]'
            )}
          >
            <ClientHeader />
            <Main fluid fixed={isTicketPage}>{children ?? <Outlet />}</Main>
          </SidebarInset>
        </SidebarProvider>
      </LayoutProvider>
    </SearchProvider>
  )
}
