import { type LinkProps } from '@tanstack/react-router'

type User = {
  name: string
  email: string
  avatar: string
}

type Team = {
  name: string
  logo: React.ElementType
  plan: string
}

type BaseNavItem = {
  title: string
  badge?: string
  icon?: React.ElementType
  /** V10 iconfont 类名（/upload/common/iconfont/iconfont.css），与 icon 二选一优先 */
  iconClass?: string
  /** 非 SPA 路由（系统原生页/外链），用整页跳转而非前端路由 */
  external?: boolean
  /** 二次提醒（后台菜单 second_reminder=1）：外链先经 /transfer.htm 中转页确认再访问 */
  secondReminder?: boolean
}

type NavLink = BaseNavItem & {
  url: LinkProps['to'] | (string & {})
  /** URL query 参数（如 product.htm?m=2403 拆出的 { m: 2403 }，TanStack Router 需 search 单独传） */
  search?: Record<string, unknown>
  items?: never
}

type NavCollapsible = BaseNavItem & {
  items: (BaseNavItem & {
    url: LinkProps['to'] | (string & {})
    search?: Record<string, unknown>
  })[]
  url?: never
}

type NavItem = NavCollapsible | NavLink

type NavGroup = {
  title: string
  items: NavItem[]
}

type SidebarData = {
  user: User
  teams: Team[]
  navGroups: NavGroup[]
  /** 贴底分组（V10 菜单 分隔符 之后的段落，渲染在侧边栏底部） */
  bottomNavGroups?: NavGroup[]
}

export type { SidebarData, NavGroup, NavItem, NavCollapsible, NavLink }
