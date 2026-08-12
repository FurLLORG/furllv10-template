import { afterEach, describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import {
  buildLegacyShellConfig,
  legacyHostUrl,
  LEGACY_SHELL_STORAGE_KEY,
  writeLegacyShellConfig,
} from '@/lib/legacy-shell'
import { LegacyHost } from '@/features/client/legacy-host'

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
    sessionStorage.removeItem(LEGACY_SHELL_STORAGE_KEY)
  } catch {
    // ignore
  }
}

describe('legacy-shell 官方兼容壳配置', () => {
  afterEach(() => {
    delete (window as unknown as WindowCfg).__CLIENT_CONFIG__
    delete (window as unknown as WindowCfg).__LANG_CONFIG__
    clearSessionStorage()
  })

  it('buildLegacyShellConfig：读取 __CLIENT_CONFIG__ / __LANG_CONFIG__，缺省兜底', () => {
    setCfg({
      __CLIENT_CONFIG__: {
        system_version: '10.7.2',
        theme_color: 'blue',
        addons: [
          { id: 1, name: 'IdcsmartRenew', title: '续费' },
          { id: 2, name: "O'Reilly", title: 'x' },
        ],
      },
      __LANG_CONFIG__: { lang_home: 'en-us', lang_home_follow_browser: 1 },
    })

    const config = buildLegacyShellConfig(123)
    expect(config.hostId).toBe(123)
    expect(config.systemVersion).toBe('10.7.2')
    expect(config.themeColor).toBe('blue')
    expect(config.addons).toEqual([
      { id: 1, name: 'IdcsmartRenew', title: '续费' },
      { id: 2, name: "O'Reilly", title: 'x' },
    ])
    expect(config.langConfig).toMatchObject({ lang_home: 'en-us' })
  })

  it('buildLegacyShellConfig：无壳注入时兜底默认值', () => {
    const config = buildLegacyShellConfig(0)
    expect(config.themeColor).toBe('default')
    expect(config.addons).toEqual([])
    expect(config.langConfig).toMatchObject({ lang_home: 'zh-cn' })
  })

  it('writeLegacyShellConfig：写入同源 sessionStorage 供壳页读取', () => {
    setCfg({
      __CLIENT_CONFIG__: {
        system_version: '10.7.2',
        theme_color: 'theme9',
        addons: [{ id: 1, name: 'EContract', title: '合同' }],
      },
    })
    writeLegacyShellConfig(buildLegacyShellConfig(7))
    const stored = JSON.parse(sessionStorage.getItem(LEGACY_SHELL_STORAGE_KEY)!)
    expect(stored.hostId).toBe(7)
    expect(stored.systemVersion).toBe('10.7.2')
    expect(stored.themeColor).toBe('theme9')
    expect(stored.addons).toEqual([{ id: 1, name: 'EContract', title: '合同' }])
  })

  it('legacyHostUrl：走 FurllHome 官方 default 内容接口，URL 带真实 ?id= 供官方 getQuery 读取', () => {
    expect(legacyHostUrl(456)).toBe(
      '/console/v1/furll_home/default-product-detail?id=456'
    )
  })
})

describe('LegacyHost 兼容容器', () => {
  afterEach(() => {
    delete (window as unknown as WindowCfg).__CLIENT_CONFIG__
    delete (window as unknown as WindowCfg).__LANG_CONFIG__
    clearSessionStorage()
  })

  it('渲染 iframe，src 为带产品 id 的静态壳页 URL，占主内容区（非全屏），并写入 sessionStorage 配置', () => {
    setCfg({ __CLIENT_CONFIG__: { system_version: '10.7.2' } })
    const { container } = render(<LegacyHost hostId={789} />)
    const iframe = container.querySelector('iframe')
    expect(iframe).not.toBeNull()
    expect(iframe!.getAttribute('src')).toContain(
      '/console/v1/furll_home/default-product-detail?id=789'
    )
    // 高度使用显式 style，避免兼容壳依赖 Tailwind 任意值的构建产物。
    expect(iframe!.style.height).toBe('calc(100svh - 8rem)')
    expect(iframe!.className).not.toContain('fixed')
    const stored = JSON.parse(
      sessionStorage.getItem(LEGACY_SHELL_STORAGE_KEY)!
    )
    expect(stored.hostId).toBe(789)
  })
})
