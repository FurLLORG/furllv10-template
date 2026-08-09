import { afterEach, describe, expect, it } from 'vitest'
import { installedAddons } from '@/lib/addons'

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
