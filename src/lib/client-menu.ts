import {
  ArrowLeftRight,
  Circle,
  Home,
  Landmark,
  ListOrdered,
  Megaphone,
  Newspaper,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Ticket,
  UserCircle,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { MenuItem } from '@/api'
import type { NavGroup, NavItem } from '@/components/layout/types'

/** SPA 内已实现路由的页面（其余 URL 视为系统原生页/外链，整页跳转） */
const SPA_ROUTES = new Set([
  'home',
  'goodsList',
  'goods',
  'shoppingCar',
  'product',
  'productdetail',
  'crossModule',
  'productList',
  'announcement',
  'finance',
  'transaction',
  'withdrawal',
  'transfer',
  'ticket',
  'ticketDetails',
  'addTicket',
  'childAccount',
  'addChildAccount',
  'authentication_select',
  'authentication_person',
  'authentication_company',
  'authentication_status',
  'authentication_thrid',
  'news',
  'source',
  'news_detail',
  'account',
  'security',
  'security_ssh',
  'security_log',
  'security_group',
  'group_rules',
  'transfer',
])

/** 按 URL 关键词映射 lucide 图标（V10 iconfont 类名无法直接复用） */
const URL_ICON_MAP: Array<[RegExp, LucideIcon]> = [
  [/home\.htm/, Home],
  [/productList|product_list|host/, Package],
  [/order/, ListOrdered],
  [/finance|recharge|bill/, Receipt],
  [/transaction/, Wallet],
  [/withdrawal/, Landmark],
  [/transfer/, ArrowLeftRight],
  [/ticket/, Ticket],
  [/account/, UserCircle],
  [/security/, ShieldCheck],
  [/settings|message|notice/, Settings],
  [/news|source|article|help/, Newspaper],
  [/announcement|bulletin/, Megaphone],
  [/goods|product\.htm|crossModule|custom_iframe/, ShoppingCart],
]

function normalizePath(url?: string): string {
  const raw = (url ?? '').trim()
  if (!raw) return '/home.htm'
  if (/^https?:\/\//i.test(raw)) return raw
  // 保留 query（如 product.htm?m=2403），SPA 路由经 Link 解析为 pathname+search
  const path = raw.startsWith('/') ? raw : `/${raw}`
  // 插件导航裸 url（如工单 sidebar_clientarea.php url='ticket'，无 .htm 后缀）：
  // 命中 SPA 路由时补全后缀，避免侧边栏链接落到 /ticket 404
  const base = path.split('/').pop()?.split('?')[0] ?? ''
  if (base && !base.includes('.') && SPA_ROUTES.has(base)) {
    return `${path}.htm`
  }
  return path
}

function isExternal(url: string): boolean {
  if (/^https?:\/\//i.test(url)) return true
  const base = url.split('/').pop()?.split('?')[0].split('.')[0] ?? ''
  return !SPA_ROUTES.has(base)
}

function matchIcon(url: string): LucideIcon | undefined {
  const path = url.split('?')[0]
  for (const [re, icon] of URL_ICON_MAP) {
    if (re.test(path)) return icon
  }
  return undefined
}

/**
 * 拆分 URL 的 query 为 search 对象（TanStack Router 的 Link to 不支持内嵌 ?query，
 * 需经 search prop 单独传；product.htm?m=2403 → { to: '/product.htm', search: { m: 2403 } }）
 */
function parseNavTarget(url: string): {
  url: string
  search?: Record<string, unknown>
} {
  const queryIndex = url.indexOf('?')
  if (queryIndex === -1) return { url }
  const search: Record<string, unknown> = {}
  for (const [key, value] of new URLSearchParams(url.slice(queryIndex + 1))) {
    search[key] = /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value
  }
  return { url: url.slice(0, queryIndex), search }
}

/** V10 菜单 icon 字段为 iconfont 类名（如 icon-a-7），直接复用官方图标库 */
function resolveIcon(item: MenuItem): { icon?: LucideIcon; iconClass?: string } {
  const iconClass = (item.icon ?? '').trim() || undefined
  if (iconClass) return { iconClass }
  return { icon: matchIcon(normalizePath(item.url)) ?? Circle }
}

/**
 * 链接与当前地址是否匹配：
 * - 不带 search 的菜单项按 pathname 匹配（home.htm / productList.htm 等）
 * - 带 search 的菜单项（product.htm?m=2403）要求 query 键值一致，
 *   避免多个同为 /product.htm 的模块菜单（不同 ?m=）同时高亮
 */
export function navLinkActive(
  href: string,
  target: { url?: string; search?: Record<string, unknown> }
): boolean {
  const [hrefBase, hrefQuery = ''] = href.split('?')
  const urlBase = target.url?.split('?')[0]
  if (hrefBase !== urlBase) return false
  if (!target.search || Object.keys(target.search).length === 0) return true
  const params = new URLSearchParams(hrefQuery)
  return Object.entries(target.search).every(
    ([key, value]) => params.get(key) === String(value)
  )
}

function toNavItem(item: MenuItem): NavItem {  const { url, search } = parseNavTarget(normalizePath(item.url))
  const { icon, iconClass } = resolveIcon(item)
  const external = isExternal(url)
  // 二次提醒（second_reminder=1）：外链不直接跳转，先进 /transfer.htm 中转页确认（对齐官方 asideMenu.js）
  const secondReminder = external && item.second_reminder === 1
  const target = secondReminder
    ? {
        title: item.name,
        url: '/transfer.htm',
        search: { target: url },
        icon,
        iconClass,
        external: false,
        secondReminder: true,
      }
    : null

  if (item.child?.length) {
    return {
      title: item.name,
      icon,
      iconClass,
      items: item.child.map((child) => {
        const childTarget = parseNavTarget(normalizePath(child.url))
        const childIcon = resolveIcon(child)
        const childExternal = isExternal(childTarget.url)
        const childReminder = childExternal && child.second_reminder === 1
        return childReminder
          ? {
              title: child.name,
              url: '/transfer.htm',
              search: { target: childTarget.url },
              icon: childIcon.icon,
              iconClass: childIcon.iconClass,
              external: false,
              secondReminder: true,
            }
          : {
              title: child.name,
              url: childTarget.url,
              search: childTarget.search,
              icon: childIcon.icon,
              iconClass: childIcon.iconClass,
              external: childExternal,
            }
      }),
    }
  }

  if (target) return target
  return { title: item.name, url, search, icon, iconClass, external }
}

/**
 * 将 V10 /console/v1/menu 返回的菜单树解析为侧边栏上下两段
 * - name=分隔符 之前的段落 → top（贴顶），之后的段落 → bottom（贴底），对齐官方模板排版
 * - 空分组丢弃；整段为空返回 null（由调用方回退静态菜单）
 */
export function menuToNavGroups(
  menu: MenuItem[]
): { top: NavGroup[]; bottom: NavGroup[] } | null {
  const segments: MenuItem[][] = []
  let current: MenuItem[] = []

  for (const item of menu) {
    if (item.name === '分隔符') {
      if (current.length > 0) {
        segments.push(current)
        current = []
      }
      continue
    }
    current.push(item)
  }
  if (current.length > 0) segments.push(current)

  if (segments.length === 0) return null

  // 第一段贴顶，其余段落全部贴底（官方模板：分隔符仅一个，下段为账户类菜单）
  const [first, ...rest] = segments
  const top: NavGroup[] = [{ title: '', items: first.map(toNavItem) }]
  const bottom: NavGroup[] = rest.map((items) => ({
    title: '',
    items: items.map(toNavItem),
  }))

  return { top, bottom }
}
