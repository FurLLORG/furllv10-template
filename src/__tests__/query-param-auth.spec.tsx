// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyQueryParamAuth } from '@/lib/query-param-auth'

function makeWindow(href: string) {
  const loc = new URL(href)
  return {
    location: loc,
    history: {
      replaceState: (_data: unknown, _title: string, url: string) => {
        const next = new URL(url, loc.origin)
        loc.href = next.href
      },
    },
    localStorage: {
      setItem: vi.fn(),
    },
  }
}

describe('query-param-auth', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('把 queryParam 里的 jwt 写入 localStorage.jwt', () => {
    const win = makeWindow('https://example.com/home.htm?queryParam=abc123')
    applyQueryParamAuth(win)
    expect(win.localStorage.setItem).toHaveBeenCalledWith('jwt', 'abc123')
  })

  it('抹掉地址栏的 queryParam，保留页面路径', () => {
    const win = makeWindow('https://example.com/home.htm?queryParam=abc123')
    applyQueryParamAuth(win)
    expect(win.location.href).toBe('https://example.com/home.htm')
  })

  it('无 queryParam 时不写入、不修改地址', () => {
    const win = makeWindow('https://example.com/home.htm')
    applyQueryParamAuth(win)
    expect(win.localStorage.setItem).not.toHaveBeenCalled()
    expect(win.location.href).toBe('https://example.com/home.htm')
  })
})
