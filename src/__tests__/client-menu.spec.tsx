// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { menuToNavGroups, navLinkActive } from '@/lib/client-menu'

const menu = [
  {
    id: 2403,
    name: 'DCIM(自定义配置)',
    url: 'product.htm?m=2403',
    second_reminder: 0,
    icon: 'icon-a-6',
    parent_id: 0,
    menu_type: 'module',
    is_cross_module: 0,
  },
  {
    id: 2404,
    name: '魔方云(自定义配置)',
    url: 'product.htm?m=2404',
    icon: 'icon-a-6',
    parent_id: 0,
    menu_type: 'module',
    is_cross_module: 0,
  },
  {
    id: 2405,
    name: '跨模块产品',
    url: 'crossModule.htm?m=2405',
    icon: 'icon-a-6',
    parent_id: 0,
    menu_type: 'module',
    is_cross_module: 1,
  },
  { id: 2406, name: '分隔符', url: '' },
  { id: 2407, name: '账户', url: 'account.htm', icon: 'icon-a-1' },
  { id: 2408, name: '工单中心', url: 'ticket', icon: 'icon-a-17' },
]

describe('client-menu 模块菜单 URL 解析', () => {
  it('product.htm?m= 保留 search 且视为 SPA 路由', () => {
    const groups = menuToNavGroups(menu)!
    const top = groups.top[0].items
    const dcim = top[0]
    expect(dcim).toMatchObject({
      title: 'DCIM(自定义配置)',
      url: '/product.htm',
      search: { m: 2403 },
      external: false,
    })
    expect(top[1]).toMatchObject({
      url: '/product.htm',
      search: { m: 2404 },
      external: false,
    })
  })

  it('crossModule.htm?m= 保留 search 且视为 SPA 路由', () => {
    const groups = menuToNavGroups(menu)!
    const cross = groups.top[0].items[2]
    expect(cross).toMatchObject({
      title: '跨模块产品',
      url: '/crossModule.htm',
      search: { m: 2405 },
      external: false,
    })
  })

  it('无 query 的菜单 url 不带 search', () => {
    const groups = menuToNavGroups(menu)!
    const account = groups.bottom[0].items[0]
    expect(account).toMatchObject({ url: '/account.htm', search: undefined })
  })

  it('插件导航裸 url（工单 ticket）补 .htm 后缀且视为 SPA 路由', () => {
    const groups = menuToNavGroups(menu)!
    const ticket = groups.bottom[0].items[1]
    expect(ticket).toMatchObject({
      title: '工单中心',
      url: '/ticket.htm',
      search: undefined,
      external: false,
    })
  })
})

describe('client-menu 插件导航 url（plugin/<插件ID>/ticket.htm）', () => {
  it('官方 createPluginNav 转换后的插件 url 保留原路径且视为 SPA 路由', () => {
    const pluginMenu = [
      { id: 2501, name: '工单中心', url: 'plugin/27/ticket.htm' },
    ]
    const groups = menuToNavGroups(pluginMenu)!
    const item = groups.top[0].items[0]
    expect(item).toMatchObject({
      title: '工单中心',
      url: '/plugin/27/ticket.htm',
      search: undefined,
      external: false,
    })
  })

  it('子账户插件 url plugin/<id>/childAccount.htm 视为 SPA 路由', () => {
    const pluginMenu = [
      { id: 2502, name: '子账户管理', url: 'plugin/28/childAccount.htm' },
    ]
    const groups = menuToNavGroups(pluginMenu)!
    const item = groups.top[0].items[0]
    expect(item).toMatchObject({
      title: '子账户管理',
      url: '/plugin/28/childAccount.htm',
      search: undefined,
      external: false,
    })
  })

  it('子账户裸导航 url childAccount 补 .htm 后缀且视为 SPA 路由', () => {
    const pluginMenu = [
      { id: 2503, name: '子账户管理', url: 'childAccount' },
    ]
    const groups = menuToNavGroups(pluginMenu)!
    const item = groups.top[0].items[0]
    expect(item).toMatchObject({
      title: '子账户管理',
      url: '/childAccount.htm',
      search: undefined,
      external: false,
    })
  })
})

describe('client-menu 二次提醒（second_reminder=1）中转页', () => {
  it('外链 + second_reminder=1 转为 /transfer.htm 中转链接', () => {
    const remindMenu = [
      { id: 2629, name: '哔哩哔哩', url: 'https://bilibili.com', second_reminder: 1 },
    ]
    const groups = menuToNavGroups(remindMenu)!
    expect(groups.top[0].items[0]).toMatchObject({
      title: '哔哩哔哩',
      url: '/transfer.htm',
      search: { target: 'https://bilibili.com' },
      external: false,
      secondReminder: true,
    })
  })

  it('外链 + second_reminder=0 保持原外链直接跳转', () => {
    const plainMenu = [
      { id: 2630, name: '哔哩哔哩', url: 'https://bilibili.com', second_reminder: 0 },
      { id: 2631, name: '无提醒字段外链', url: 'https://example.com' },
    ]
    const groups = menuToNavGroups(plainMenu)!
    const items = groups.top[0].items
    expect(items[0]).toMatchObject({
      url: 'https://bilibili.com',
      external: true,
    })
    expect(items[0]).not.toHaveProperty('secondReminder')
    expect(items[1]).toMatchObject({
      url: 'https://example.com',
      external: true,
    })
    expect(items[1]).not.toHaveProperty('secondReminder')
  })

  it('子菜单外链 + second_reminder=1 同样转中转页', () => {
    const childMenu = [
      {
        id: 2632,
        name: '外部链接',
        url: '',
        child: [
          { id: 2633, name: '哔哩哔哩', url: 'https://bilibili.com', second_reminder: 1 },
        ],
      },
    ]
    const groups = menuToNavGroups(childMenu)!
    const parent = groups.top[0].items[0]
    expect(parent).toMatchObject({ title: '外部链接' })
    expect(parent).toHaveProperty('items')
    const child = (parent as { items: unknown[] }).items[0]
    expect(child).toMatchObject({
      title: '哔哩哔哩',
      url: '/transfer.htm',
      search: { target: 'https://bilibili.com' },
      external: false,
      secondReminder: true,
    })
  })

  it('非外链菜单即使 second_reminder=1 也走原 SPA 路由', () => {
    const spMenu = [{ id: 2634, name: '账户', url: 'account.htm', second_reminder: 1 }]
    const groups = menuToNavGroups(spMenu)!
    expect(groups.top[0].items[0]).toMatchObject({
      url: '/account.htm',
      external: false,
    })
    expect(groups.top[0].items[0]).not.toHaveProperty('secondReminder')
  })
})

describe('navLinkActive 侧边栏高亮', () => {
  const dcim = { url: '/product.htm', search: { m: 2403 } }
  const magic = { url: '/product.htm', search: { m: 2404 } }
  const plain = { url: '/home.htm' }

  it('同 pathname 不同 ?m= 互不高亮（修复多个模块菜单同时 active）', () => {
    expect(navLinkActive('/product.htm?m=2403', dcim)).toBe(true)
    expect(navLinkActive('/product.htm?m=2403', magic)).toBe(false)
    expect(navLinkActive('/product.htm?m=2404', magic)).toBe(true)
    expect(navLinkActive('/product.htm?m=2404', dcim)).toBe(false)
  })

  it('不带 search 的菜单按 pathname 匹配', () => {
    expect(navLinkActive('/home.htm', plain)).toBe(true)
    expect(navLinkActive('/productList.htm', plain)).toBe(false)
  })

  it('query 为空时带 search 的菜单不高亮', () => {
    expect(navLinkActive('/product.htm', dcim)).toBe(false)
  })
})
