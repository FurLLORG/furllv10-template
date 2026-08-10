import { afterEach, describe, expect, it } from 'vitest'
import { installedAddons, shellAddonItems } from '@/lib/addons'

function setAddons(addons: unknown) {
  ;(window as { __CLIENT_CONFIG__?: unknown }).__CLIENT_CONFIG__ = { addons }
}

describe('installedAddons', () => {
  afterEach(() => {
    delete (window as { __CLIENT_CONFIG__?: unknown }).__CLIENT_CONFIG__
  })

  it('官方注入格式：对象数组（{id,name,title,url}）取 name', () => {
    setAddons([
      { id: 1, name: 'IdcsmartRenew', title: '续费' },
      { id: 2, name: 'PromoCode', title: '优惠码' },
    ])
    expect(installedAddons()).toEqual(['IdcsmartRenew', 'PromoCode'])
    expect(installedAddons().includes('IdcsmartRenew')).toBe(true)
  })

  it('兼容字符串数组', () => {
    setAddons(['IdcsmartRenew', 'PromoCode'])
    expect(installedAddons()).toEqual(['IdcsmartRenew', 'PromoCode'])
  })

  it('无 addons 或非法格式返回空数组', () => {
    delete (window as { __CLIENT_CONFIG__?: unknown }).__CLIENT_CONFIG__
    expect(installedAddons()).toEqual([])
    setAddons('not-array')
    expect(installedAddons()).toEqual([])
  })
})

describe('shellAddonItems（生产壳注入 JSON 解析）', () => {
  afterEach(() => {
    delete (window as { __CLIENT_CONFIG__?: unknown }).__CLIENT_CONFIG__
  })

  it('对象数组：解析出完整 ShellAddon 结构', () => {
    setAddons([
      { id: 17, name: 'IdcsmartRenew', title: '续费', url: '' },
      { id: 18, name: 'IdcsmartRefund', title: '退款', url: '' },
    ])
    expect(shellAddonItems()).toEqual([
      { id: 17, name: 'IdcsmartRenew', title: '续费', url: '' },
      { id: 18, name: 'IdcsmartRefund', title: '退款', url: '' },
    ])
  })

  it('兼容字符串数组（dev index.html 默认配置格式）', () => {
    setAddons(['IdcsmartRenew', 'PromoCode'])
    expect(shellAddonItems()).toEqual([
      { id: 0, name: 'IdcsmartRenew', title: '', url: '' },
      { id: 0, name: 'PromoCode', title: '', url: '' },
    ])
  })

  it('注入空数组返回空数组（生产环境确无插件时不再请求接口）', () => {
    setAddons([])
    expect(shellAddonItems()).toEqual([])
  })

  it('无注入/非法格式返回 null（回退接口）', () => {
    delete (window as { __CLIENT_CONFIG__?: unknown }).__CLIENT_CONFIG__
    expect(shellAddonItems()).toBeNull()
    setAddons('not-array')
    expect(shellAddonItems()).toBeNull()
    setAddons([null, 42, { title: '缺 name' }])
    expect(shellAddonItems()).toEqual([
      { id: 0, name: '42', title: '', url: '' },
    ])
  })
})
