import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRef } from 'react'
import { fireEvent, render } from '@testing-library/react'
import {
  buildLegacyGoodsConfig,
  legacyGoodsUrl,
  LEGACY_GOODS_STORAGE_KEY,
  writeLegacyGoodsConfig,
} from '@/lib/legacy-goods'
import {
  LegacyGoods,
  type LegacyGoodsHandle,
} from '@/features/cart/legacy-goods'

type WindowCfg = {
  __CLIENT_CONFIG__?: {
    system_version?: string
    theme_color?: string
    addons?: unknown[]
  }
  __LANG_CONFIG__?: Record<string, unknown>
}

function setCfg(cfg: WindowCfg) {
  const win = window as unknown as WindowCfg
  win.__CLIENT_CONFIG__ = cfg.__CLIENT_CONFIG__
  win.__LANG_CONFIG__ = cfg.__LANG_CONFIG__
}

function clearSessionStorage() {
  try {
    sessionStorage.removeItem(LEGACY_GOODS_STORAGE_KEY)
  } catch {
    // ignore
  }
}

describe('legacy-goods 官方兼容壳配置', () => {
  afterEach(() => {
    delete (window as unknown as WindowCfg).__CLIENT_CONFIG__
    delete (window as unknown as WindowCfg).__LANG_CONFIG__
    clearSessionStorage()
  })

  it('legacyGoodsUrl：走 FurllHome 官方 default 内容接口，URL 带真实 ?id= 供 goods.js getUrlParams 读取', () => {
    expect(legacyGoodsUrl(456, false, '')).toBe(
      '/console/v1/furll_home/default-cart-goods?id=456'
    )
  })

  it('legacyGoodsUrl：change/name 编辑模式参数透传（官方 goods.htm?change=true&name=）', () => {
    expect(legacyGoodsUrl(7, true, '我的云主机')).toBe(
      '/console/v1/furll_home/default-cart-goods?id=7&change=true&name=' +
        encodeURIComponent('我的云主机')
    )
  })

  it('buildLegacyGoodsConfig：读取 __CLIENT_CONFIG__ / __LANG_CONFIG__ + commonData，缺省兜底', () => {
    setCfg({
      __CLIENT_CONFIG__: {
        system_version: '10.7.2',
        theme_color: 'blue',
        addons: [{ id: 1, name: 'IdcsmartRenew', title: '续费' }],
      },
      __LANG_CONFIG__: { lang_home: 'en-us', lang_home_follow_browser: 1 },
    })

    const config = buildLegacyGoodsConfig(123, { currency_prefix: '¥' })
    expect(config.productId).toBe(123)
    expect(config.systemVersion).toBe('10.7.2')
    expect(config.themeColor).toBe('blue')
    expect(config.addons).toEqual([
      { id: 1, name: 'IdcsmartRenew', title: '续费' },
    ])
    expect(config.langConfig).toMatchObject({ lang_home: 'en-us' })
    expect(config.commonData).toEqual({ currency_prefix: '¥' })
  })

  it('buildLegacyGoodsConfig：无壳注入/commonData 缺失时兜底默认值', () => {
    const config = buildLegacyGoodsConfig(0, undefined)
    expect(config.themeColor).toBe('default')
    expect(config.addons).toEqual([])
    expect(config.langConfig).toMatchObject({ lang_home: 'zh-cn' })
    expect(config.commonData).toBeNull()
  })

  it('writeLegacyGoodsConfig：写入同源 sessionStorage 供壳页读取（commonData 给壳写 common_set_before）', () => {
    const config = buildLegacyGoodsConfig(7, { cart_change_product: 1 })
    writeLegacyGoodsConfig(config)
    const stored = JSON.parse(sessionStorage.getItem(LEGACY_GOODS_STORAGE_KEY)!)
    expect(stored.productId).toBe(7)
    expect(stored.commonData).toEqual({ cart_change_product: 1 })
  })
})

describe('LegacyGoods 兼容容器（iframeBuy 协议）', () => {
  afterEach(() => {
    delete (window as unknown as WindowCfg).__CLIENT_CONFIG__
    delete (window as unknown as WindowCfg).__LANG_CONFIG__
    clearSessionStorage()
  })

  function mockIframeContentWindow(container: HTMLElement) {
    const iframe = container.querySelector('iframe')!
    const postMessage = vi.fn()
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: { postMessage },
    })
    return { iframe, postMessage }
  }

  it('渲染 iframe，src 为带商品 id 的官方壳页 URL，并写入 sessionStorage 配置', () => {
    setCfg({ __CLIENT_CONFIG__: { system_version: '10.7.2' } })
    const { container } = render(
      <LegacyGoods
        productId={789}
        change={false}
        editName=''
        commonData={undefined}
      />
    )
    const iframe = container.querySelector('iframe')
    expect(iframe).not.toBeNull()
    expect(iframe!.getAttribute('src')).toContain(
      '/console/v1/furll_home/default-cart-goods?id=789'
    )
    // 自适应高度：flex-1 min-h-0 撑满父容器（内部滚动，整页不滚动）
    expect(iframe!.className).toContain('flex-1')
    expect(iframe!.className).toContain('min-h-0')
    const stored = JSON.parse(
      sessionStorage.getItem(LEGACY_GOODS_STORAGE_KEY)!
    )
    expect(stored.productId).toBe(789)
  })

  it('官方模块内容已出现时移除遗留的 mainLoading 遮罩', () => {
    const { container } = render(
      <LegacyGoods
        productId={789}
        change={false}
        editName=''
        commonData={undefined}
      />
    )
    const iframe = container.querySelector('iframe')!
    const doc = document.implementation.createHTMLDocument()
    doc.body.innerHTML =
      '<div id="mainLoading"></div><div class="goods"><div class="content"><div></div></div></div>'
    Object.defineProperty(iframe, 'contentDocument', {
      configurable: true,
      value: doc,
    })
    Object.defineProperty(doc, 'defaultView', {
      configurable: true,
      value: {
        matchMedia: () => ({ matches: false }),
        requestAnimationFrame: (callback: FrameRequestCallback) => callback(0),
      },
    })

    fireEvent.load(iframe)

    expect(doc.getElementById('mainLoading')).toBeNull()
  })

  it('submit：发送 {type:"iframeBuy", action}，模块回传 {type:"iframeBuy", params, price} 后 resolve', async () => {
    const ref = createRef<LegacyGoodsHandle>()
    const { container } = render(
      <LegacyGoods
        ref={ref}
        productId={11}
        change={false}
        editName=''
        commonData={{ currency_prefix: '¥' }}
      />
    )
    const { postMessage } = mockIframeContentWindow(container)

    const promise = ref.current!.submit('cart')
    expect(postMessage).toHaveBeenCalledWith(
      { type: 'iframeBuy', action: 'cart' },
      '*'
    )

    const params = {
      product_id: 11,
      config_options: { configoption: { 1: 2 }, cycle: 'month' },
      qty: 1,
      customfield: {},
      self_defined_field: {},
    }
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'iframeBuy', params, price: 99.9 },
      })
    )
    const result = await promise
    expect(result.params).toEqual(params)
    expect(result.price).toBe(99.9)
  })

  it('submit：模块校验不过不回调（无 pending 时不处理，超时 reject）', async () => {
    vi.useFakeTimers()
    try {
      const ref = createRef<LegacyGoodsHandle>()
      const { container } = render(
        <LegacyGoods
          ref={ref}
          productId={11}
          change={false}
          editName=''
          commonData={undefined}
        />
      )
      mockIframeContentWindow(container)

      const promise = ref.current!.submit('buy')
      // 模拟模块校验不过：只收到无关消息，不触发 resolve
      window.dispatchEvent(
        new MessageEvent('message', { data: { type: 'other', foo: 1 } })
      )
      vi.advanceTimersByTime(10001)
      await expect(promise).rejects.toThrow('配置未提交，请检查选配项')
    } finally {
      vi.useRealTimers()
    }
  })
})
