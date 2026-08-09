// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearModuleLangCache,
  createModuleTranslator,
  getModuleLocale,
  MODULE_LANG_URL,
  resolveClientLangDict,
  resolveModuleLangDict,
} from '@/lib/module-lang'

// 官方插件 lang/index.js 的结构（IIFE + module_lang 三套字典 + localStorage.lang 选中 + checkLangFun）
const OFFICIAL_IIFE = `
(function () {
  const module_lang = {
    "zh-cn": {
      common_cloud_text73: "CPU占用量",
      com_config: { please_select: "请选择" },
    },
    "en-us": {
      common_cloud_text73: "CPU usage",
      com_config: { please_select: "Please select" },
    },
    "zh-hk": {
      common_cloud_text73: "CPU佔用量",
      com_config: { please_select: "請選擇" },
    },
  };
  const DEFAULT_LANG = localStorage.getItem("lang") || "zh-cn";
  window.module_lang = module_lang[DEFAULT_LANG];
  checkLangFun(module_lang);
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

describe('getModuleLocale', () => {
  it('缺省为 zh-cn', () => {
    expect(getModuleLocale()).toBe('zh-cn')
  })

  it('读取 localStorage.lang（与官方 DEFAULT_LANG 同款）', () => {
    localStorage.setItem('lang', 'en-us')
    expect(getModuleLocale()).toBe('en-us')
  })

  it('未知语言回退 zh-cn', () => {
    localStorage.setItem('lang', 'fr-fr')
    expect(getModuleLocale()).toBe('zh-cn')
  })
})

describe('resolveModuleLangDict', () => {
  it('沙箱执行官方语言文件并取指定 locale 字典', async () => {
    stubLangFetch(OFFICIAL_IIFE)
    const zh = await resolveModuleLangDict('zh-cn')
    expect(zh.common_cloud_text73).toBe('CPU占用量')
    const en = await resolveModuleLangDict('en-us')
    expect(en.common_cloud_text73).toBe('CPU usage')
    const hk = await resolveModuleLangDict('zh-hk')
    expect(hk.common_cloud_text73).toBe('CPU佔用量')
  })

  it('请求官方插件语言文件路径', async () => {
    stubLangFetch(OFFICIAL_IIFE)
    await resolveModuleLangDict('zh-cn')
    const fetchMock = vi.mocked(fetch)
    expect(fetchMock).toHaveBeenCalledWith(MODULE_LANG_URL)
  })

  it('语言文件请求失败时抛错', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('not found', { status: 404 }))
    )
    await expect(resolveModuleLangDict('zh-cn')).rejects.toThrow(
      /HTTP 404/
    )
  })
})

describe('resolveClientLangDict（window.lang 等价物）', () => {
  // 官方 /clientarea/template/pc/default/lang/<locale>/index.js 结构：
  // const lang_obj = {...}; window.lang = lang_obj;
  const CLIENT_IIFE = `
const lang_obj = {
  common_unsubscribe_title: "退订",
  account_btn3: "取消",
  finance_text142: "正常",
};
window.lang = lang_obj;
`

  it('沙箱执行客户端基础语言文件并取 window.lang', async () => {
    stubLangFetch(CLIENT_IIFE)
    const dict = await resolveClientLangDict('zh-cn')
    expect(dict.common_unsubscribe_title).toBe('退订')
    expect(dict.finance_text142).toBe('正常')
  })

  it('请求 clientarea 基础语言文件路径（按 locale 目录）', async () => {
    stubLangFetch(CLIENT_IIFE)
    await resolveClientLangDict('zh-cn')
    const fetchMock = vi.mocked(fetch)
    expect(fetchMock).toHaveBeenCalledWith(
      '/clientarea/template/pc/default/lang/zh-cn/index.js'
    )
  })

  it('解析失败（无 window.lang）时抛错', async () => {
    stubLangFetch('(function () {})()')
    await expect(resolveClientLangDict('zh-cn')).rejects.toThrow(
      /客户端语言文件解析失败/
    )
  })
})

describe('createModuleTranslator', () => {
  const zh = { common_cloud_text73: 'CPU占用量', only_zh: '只有中文' }
  const en = { common_cloud_text73: 'CPU usage' }

  it('优先当前 locale 字典', () => {
    const t = createModuleTranslator(en, zh)
    expect(t('common_cloud_text73')).toBe('CPU usage')
  })

  it('当前字典缺 key 时回退 zh-cn 基准字典', () => {
    const t = createModuleTranslator(en, zh)
    expect(t('only_zh')).toBe('只有中文')
  })

  it('两套字典都缺时回退调用方 fallback，再退回原 key', () => {
    const t = createModuleTranslator(en, zh)
    expect(t('missing_key', '兜底文案')).toBe('兜底文案')
    expect(t('missing_key')).toBe('missing_key')
  })

  it('支持 com_config.please_select 嵌套 key', () => {
    const t = createModuleTranslator({ com_config: { please_select: '请选择' } })
    expect(t('com_config.please_select')).toBe('请选择')
  })
})

describe('createModuleTranslator mf_finance 基准字典兜底', () => {
  const en = { common_cloud_text73: 'CPU usage' }
  const zh = { common_cloud_text73: 'CPU占用量' }
  const baseEn = { appstore_text301: 'Configuration info' }
  const baseZh = { appstore_text301: '配置信息' }

  it('模块字典缺 key 时用基准字典（同 locale）', () => {
    const t = createModuleTranslator(en, zh, baseEn, baseZh)
    expect(t('appstore_text301')).toBe('Configuration info')
  })

  it('基准同 locale 缺时用基准 zh-cn 字典', () => {
    const t = createModuleTranslator(en, zh, { appstore_text301: '配置信息' })
    expect(t('appstore_text301')).toBe('配置信息')
  })

  it('模块字典有 key 时优先于基准字典', () => {
    const t = createModuleTranslator(
      { appstore_text301: '模块自定' },
      undefined,
      baseEn,
      baseZh
    )
    expect(t('appstore_text301')).toBe('模块自定')
  })

  it('全部字典都缺时回退调用方 fallback，再退回原 key', () => {
    const t = createModuleTranslator(undefined, undefined, baseEn, baseZh)
    expect(t('missing_key', '兜底文案')).toBe('兜底文案')
    expect(t('missing_key')).toBe('missing_key')
  })
})
