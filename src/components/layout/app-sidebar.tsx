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
import { sidebarData } from './data/sidebar-data'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'
import { TeamSwitcher } from './team-switcher'
import { type SidebarData } from './types'

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

export function AppSidebar({
  data = sidebarData,
  logoUrl,
  loading = false,
  menuLoading = false,
}: {
  data?: SidebarData
  logoUrl?: string
  loading?: boolean
  menuLoading?: boolean
}) {
  const { collapsible, variant } = useLayout()
  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} logoUrl={logoUrl} />
      </SidebarHeader>
      <SidebarContent className='animate-in duration-300 ease-out fade-in slide-in-from-left-2'>
        {menuLoading ? (
          <SidebarNavSkeleton rows={7} />
        ) : (
          data.navGroups.map((props, index) => (
            <NavGroup key={`top-${index}`} {...props} />
          ))
        )}
      </SidebarContent>
      <SidebarFooter>
        {menuLoading ? (
          <SidebarNavSkeleton rows={3} />
        ) : (
          <>
            {data.bottomNavGroups && data.bottomNavGroups.length > 0 && (
              <Separator />
            )}
            <div className='flex max-h-[45svh] flex-col gap-2 overflow-y-auto'>
              {data.bottomNavGroups?.map((props, index) => (
                <NavGroup key={`bottom-${index}`} {...props} />
              ))}
            </div>
          </>
        )}
        <NavUser user={data.user} loading={loading} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
