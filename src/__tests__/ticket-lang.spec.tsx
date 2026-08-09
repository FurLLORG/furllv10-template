// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearModuleLangCache,
  resolveTicketLangDict,
  TICKET_LANG_URL,
} from '@/lib/module-lang'

// 官方 idcsmart_ticket lang/index.js 结构（IIFE + plugin_lang 三套字典 + window.plugin_lang）
const TICKET_IIFE = `
(function () {
  const plugin_lang = {
    "zh-cn": {
      ticket_title: "工单系统",
      ticket_btn1: "新建工单",
      quote_reply_button: "引用回复",
    },
    "en-us": {
      ticket_title: "Ticket Order System",
      ticket_btn1: "New ticket",
      quote_reply_button: "Quote Reply",
    },
    "zh-hk": {
      ticket_title: "工單系統",
      ticket_btn1: "新建工單",
      quote_reply_button: "引用回覆",
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

describe('resolveTicketLangDict（工单插件 window.plugin_lang 等价物）', () => {
  it('沙箱执行官方工单语言文件并取指定 locale 字典', async () => {
    stubLangFetch(TICKET_IIFE)
    const zh = await resolveTicketLangDict('zh-cn')
    expect(zh.ticket_title).toBe('工单系统')
    expect(zh.quote_reply_button).toBe('引用回复')
    const en = await resolveTicketLangDict('en-us')
    expect(en.ticket_title).toBe('Ticket Order System')
    const hk = await resolveTicketLangDict('zh-hk')
    expect(hk.ticket_title).toBe('工單系統')
  })

  it('请求官方工单插件语言文件路径', async () => {
    stubLangFetch(TICKET_IIFE)
    await resolveTicketLangDict('zh-cn')
    const fetchMock = vi.mocked(fetch)
    expect(fetchMock).toHaveBeenCalledWith(TICKET_LANG_URL)
  })

  it('解析失败（无 window.plugin_lang）时抛错', async () => {
    stubLangFetch('(function () {})()')
    await expect(resolveTicketLangDict('zh-cn')).rejects.toThrow(
      /语言文件解析失败/
    )
  })

  it('语言文件请求失败时抛错', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('not found', { status: 404 }))
    )
    await expect(resolveTicketLangDict('zh-cn')).rejects.toThrow(
      /HTTP 404/
    )
  })
})
