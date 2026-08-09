import { Link } from '@tanstack/react-router'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

type TeamSwitcherProps = {
  teams: {
    name: string
    logo: React.ElementType
    plan: string
  }[]
  /** 站点 logo（/console/v1/common 的 system_logo），存在时整个按钮显示为 logo */
  logoUrl?: string
}

/** 顶部 logo：点击直达客户中心首页（对齐官方 clientarea_logo_url || /home.htm） */
export function TeamSwitcher({ teams, logoUrl }: TeamSwitcherProps) {
  const team = teams[0]

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          size='lg'
          className='h-auto! p-1 hover:bg-transparent focus-visible:ring-0 focus-visible:outline-none active:bg-transparent'
        >
          <Link to='/home.htm' title='返回客户中心首页'>
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={team?.name ?? 'logo'}
                className='h-auto w-full rounded-lg object-contain'
              />
            ) : (
              <span className='truncate text-base font-semibold'>
                {team?.name ?? '客户中心'}
              </span>
            )}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
