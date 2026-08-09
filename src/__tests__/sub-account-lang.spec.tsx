// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearModuleLangCache,
  resolveSubAccountLangDict,
  SUBACCOUNT_LANG_URL,
} from '@/lib/module-lang'

// 官方 idcsmart_sub_account lang/index.js 结构（IIFE + plugin_lang 三套字典 + window.plugin_lang）
const SUBACCOUNT_IIFE = `
(function () {
  const plugin_lang = {
    "zh-cn": {
      subaccount_text1: "编辑子账户",
      subaccount_text33: "子账户列表",
      subaccount_text45: "创建成功",
    },
    "en-us": {
      subaccount_text1: "Edit subaccount",
      subaccount_text33: "Subaccount list",
      subaccount_text45: "Created successfully",
    },
    "zh-hk": {
      subaccount_text1: "編輯子帳號",
      subaccount_text33: "子帳號清單",
      subaccount_text45: "建立成功",
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

describe('resolveSubAccountLangDict（子账户插件 window.plugin_lang 等价物）', () => {
  it('沙箱执行官方子账户语言文件并取指定 locale 字典', async () => {
    stubLangFetch(SUBACCOUNT_IIFE)
    const zh = await resolveSubAccountLangDict('zh-cn')
    expect(zh.subaccount_text1).toBe('编辑子账户')
    expect(zh.subaccount_text33).toBe('子账户列表')
    const en = await resolveSubAccountLangDict('en-us')
    expect(en.subaccount_text1).toBe('Edit subaccount')
    const hk = await resolveSubAccountLangDict('zh-hk')
    expect(hk.subaccount_text1).toBe('編輯子帳號')
  })

  it('请求官方子账户插件语言文件路径', async () => {
    stubLangFetch(SUBACCOUNT_IIFE)
    await resolveSubAccountLangDict('zh-cn')
    const fetchMock = vi.mocked(fetch)
    expect(fetchMock).toHaveBeenCalledWith(SUBACCOUNT_LANG_URL)
  })

  it('解析失败（无 window.plugin_lang）时抛错', async () => {
    stubLangFetch('(function () {})()')
    await expect(resolveSubAccountLangDict('zh-cn')).rejects.toThrow(
      /语言文件解析失败/
    )
  })
})
