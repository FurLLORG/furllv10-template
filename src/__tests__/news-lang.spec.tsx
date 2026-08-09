// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearModuleLangCache,
  resolveNewsLangDict,
  NEWS_LANG_URL,
} from '@/lib/module-lang'

// 官方 idcsmart_news lang/index.js 结构（IIFE + plugin_lang 三套字典 + window.plugin_lang）
const NEWS_IIFE = `
(function () {
  const plugin_lang = {
    "zh-cn": {
      news_text1: "新闻中心",
      news_text11: "资源中心",
      news_text7: "暂无数据",
    },
    "en-us": {
      news_text1: "News Center",
      news_text11: "Resource Center",
      news_text7: "No data available at the moment",
    },
    "zh-hk": {
      news_text1: "新聞中心",
      news_text11: "資源中心",
      news_text7: "暫無數據",
    },
  };
  const DEFAULT_LANG = localStorage.getItem("lang") || "zh-cn";
  window.plugin_lang = plugin_lang[DEFAULT_LANG];
  checkLangFun(plugin_lang);
})();
`

function stubLangFetch(code: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(code, { status: 200 }))
  )
}

afterEach(() => {
  clearModuleLangCache()
  vi.unstubAllGlobals()
  localStorage.removeItem('lang')
})

describe('resolveNewsLangDict（新闻插件 window.plugin_lang 等价物）', () => {
  it('沙箱执行官方新闻语言文件并取指定 locale 字典', async () => {
    stubLangFetch(NEWS_IIFE)
    const zh = await resolveNewsLangDict('zh-cn')
    expect(zh.news_text11).toBe('资源中心')
    expect(zh.news_text7).toBe('暂无数据')
    const en = await resolveNewsLangDict('en-us')
    expect(en.news_text11).toBe('Resource Center')
    const hk = await resolveNewsLangDict('zh-hk')
    expect(hk.news_text11).toBe('資源中心')
  })

  it('请求官方新闻插件语言文件路径', async () => {
    stubLangFetch(NEWS_IIFE)
    await resolveNewsLangDict('zh-cn')
    const fetchMock = vi.mocked(fetch)
    expect(fetchMock).toHaveBeenCalledWith(NEWS_LANG_URL)
  })

  it('解析失败（无 window.plugin_lang）时抛错', async () => {
    stubLangFetch('(function () {})()')
    await expect(resolveNewsLangDict('zh-cn')).rejects.toThrow(
      /语言文件解析失败/
    )
  })

  it('语言文件请求失败时抛错', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('not found', { status: 404 }))
    )
    await expect(resolveNewsLangDict('zh-cn')).rejects.toThrow(/HTTP 404/)
  })
})
