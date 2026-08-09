// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CERTIFICATION_LANG_URL,
  clearModuleLangCache,
  resolveCertificationLangDict,
} from '@/lib/module-lang'

// 官方 idcsmart_certification lang/index.js 结构（IIFE + plugin_lang 三套字典 + window.plugin_lang）
const CERTIFICATION_IIFE = `
(function () {
  const plugin_lang = {
    "zh-cn": {
      realname_text1: "实名认证",
      realname_text23: "实名认证",
      realname_text25: "个人认证",
      realname_text33: "下一步",
    },
    "en-us": {
      realname_text1: "Real name authentication",
      realname_text23: "Real name authentication",
      realname_text25: "Personal authentication",
      realname_text33: "Next step",
    },
    "zh-hk": {
      realname_text1: "實名認證",
      realname_text23: "實名認證",
      realname_text25: "個人認證",
      realname_text33: "下一步",
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

describe('resolveCertificationLangDict（实名认证插件 window.plugin_lang 等价物）', () => {
  it('沙箱执行官方实名认证语言文件并取指定 locale 字典', async () => {
    stubLangFetch(CERTIFICATION_IIFE)
    const zh = await resolveCertificationLangDict('zh-cn')
    expect(zh.realname_text25).toBe('个人认证')
    expect(zh.realname_text33).toBe('下一步')
    const en = await resolveCertificationLangDict('en-us')
    expect(en.realname_text25).toBe('Personal authentication')
    const hk = await resolveCertificationLangDict('zh-hk')
    expect(hk.realname_text25).toBe('個人認證')
  })

  it('请求官方实名认证插件语言文件路径', async () => {
    stubLangFetch(CERTIFICATION_IIFE)
    await resolveCertificationLangDict('zh-cn')
    const fetchMock = vi.mocked(fetch)
    expect(fetchMock).toHaveBeenCalledWith(CERTIFICATION_LANG_URL)
  })

  it('解析失败（无 window.plugin_lang）时抛错', async () => {
    stubLangFetch('(function () {})()')
    await expect(resolveCertificationLangDict('zh-cn')).rejects.toThrow(
      /语言文件解析失败/
    )
  })

  it('语言文件请求失败时抛错', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('not found', { status: 404 }))
    )
    await expect(resolveCertificationLangDict('zh-cn')).rejects.toThrow(
      /HTTP 404/
    )
  })
})
