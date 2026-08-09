import { type CartSidebarMode } from '@/stores/cart-sidebar-store'
import { cn } from '@/lib/utils'
import { useLayout } from '@/context/layout-provider'
import { Separator } from '@/components/ui/separator'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { clientSidebarData } from '@/components/layout/data/sidebar-data-client'
import { NavGroup } from '@/components/layout/nav-group'
import { NavUser } from '@/components/layout/nav-user'
import { TeamSwitcher } from '@/components/layout/team-switcher'
import { type NavGroup as NavGroupProps } from '@/components/layout/types'
import { ProductGroupsTree } from '@/features/cart/goods-groups-sidebar'
import { SidebarModeToggle } from '@/features/cart/sidebar-mode-toggle'

type ClientSidebarProps = {
  mode: CartSidebarMode
  logoUrl?: string
  user: {
    name: string
    email: string
    avatar: string
  }
  loading?: boolean
  menuLoading?: boolean
  navGroups: NavGroupProps[]
  bottomNavGroups?: NavGroupProps[]
}

// 会员中心统一侧边栏：头部（logo + 模式切换按钮）跨模式保持挂载，
// 切换按钮激活指示条才能播放滑动动画；内容区按 key 重挂载并淡入（标签页切换风格）
export function ClientSidebar({
  mode,
  logoUrl,
  user,
  loading,
  menuLoading,
  navGroups,
  bottomNavGroups,
}: ClientSidebarProps) {
  const { collapsible, variant } = useLayout()

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <TeamSwitcher teams={clientSidebarData.teams} logoUrl={logoUrl} />
        <SidebarModeToggle mode={mode} />
      </SidebarHeader>
      <SidebarContent
        key={mode}
        className={cn(
          'animate-in duration-300 ease-out fade-in',
          mode === 'groups' ? 'slide-in-from-right-2' : 'slide-in-from-left-2'
        )}
      >
        {mode === 'groups' ? (
          <ProductGroupsTree />
        ) : menuLoading ? (
          <SidebarNavSkeleton rows={7} />
        ) : (
          navGroups.map((props, index) => (
            <NavGroup key={`top-${index}`} {...props} />
          ))
        )}
      </SidebarContent>
      <SidebarFooter>
        {menuLoading ? (
          <SidebarNavSkeleton rows={3} />
        ) : (
          <>
            {bottomNavGroups && bottomNavGroups.length > 0 && <Separator />}
            <div className='flex max-h-[45svh] flex-col gap-2 overflow-y-auto'>
              {bottomNavGroups?.map((props, index) => (
                <NavGroup key={`bottom-${index}`} {...props} />
              ))}
            </div>
          </>
        )}
        <NavUser user={user} loading={loading} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function SidebarNavSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <SidebarGroup>
      <SidebarMenu>
        {Array.from({ length: rows }).map((_, index) => (
          <SidebarMenuItem key={index}>
            <SidebarMenuButton size='lg' className='pointer-events-none'>
              <Skeleton className='size-4 shrink-0' />
              <Skeleton className='h-4 w-full max-w-32' />
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
