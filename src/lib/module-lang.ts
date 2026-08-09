/**
 * 官方插件语言文件加载（mf_finance reserver 插件 productdetail.htm / idcsmart_ticket 工单插件）
 *
 * 官方模板把语言文件当普通 <script> 引入：文件是 IIFE，内部 const module_lang 包含
 * zh-cn/en-us/zh-hk 三套字典，根据 localStorage.getItem('lang') 选中当前 locale，
 * 写入 window.module_lang（工单插件为 window.plugin_lang），页面组件再经 lang.<key> 取值
 * （cloudDetail.js: Vue.prototype.lang = Object.assign(window.lang, window.module_lang)）。
 *
 * FurLLV10 不在壳里引脚本，改为运行时 fetch + 沙箱执行：按当前 locale 取官方字典，
 * 与官方「直接从 js 文件获取语言显示」行为对齐。
 */

import {
  PRODUCT_MODULES,
  REMF_LANG_URL,
  type ProductModule,
  type RemfModule,
} from '@/lib/remf-module'

/** mf_finance 模块语言文件（默认模块，兼容既有调用） */
export const MODULE_LANG_URL = REMF_LANG_URL.mf_finance

/**
 * 详情页文案的基准模块语言文件。官方各模块 lang/index.js 并非全量字典
 * （mf_dcim / mf_cloud / idcsmart_common 等缺状态、管理卡片、图表等 key，
 * 仅 mf_finance 为超集），t() 缺 key 时用该模块字典兜底。
 */
export const BASE_MODULE: LangModule = 'mf_finance'

/** 语言文件可选的模块标识：remf 三模块名或完整 ProductModule */
export type LangModule = RemfModule | ProductModule

function moduleLangUrl(module: LangModule): string {
  if (typeof module === 'string') return REMF_LANG_URL[module]
  const found = PRODUCT_MODULES.find(
    (item) =>
      item.module === module.module && item.type === module.type
  )
  return found?.langUrl ?? module.langUrl
}

export const MODULE_LOCALES = ['zh-cn', 'en-us', 'zh-hk'] as const
export type ModuleLocale = (typeof MODULE_LOCALES)[number]

/** 官方字典：值为字符串（com_config 这类为嵌套对象，取值走 lookup 点路径） */
export type ModuleLangDict = Record<string, string | Record<string, unknown>>

/** 当前语言（与官方 DEFAULT_LANG 同款读取 localStorage.lang，缺省 zh-cn） */
export function getModuleLocale(): ModuleLocale {
  const stored =
    typeof localStorage !== 'undefined' ? localStorage.getItem('lang') : null
  return (MODULE_LOCALES as readonly string[]).includes(stored ?? '')
    ? (stored as ModuleLocale)
    : 'zh-cn'
}

const codeCache = new Map<string, string>()

/** 测试用：清空已缓存的语言文件源码 */
export function clearModuleLangCache(): void {
  codeCache.clear()
}

async function loadModuleLangCode(url: string): Promise<string> {
  const cached = codeCache.get(url)
  if (cached) return cached
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`加载语言文件失败（HTTP ${res.status}）`)
  }
  const code = await res.text()
  codeCache.set(url, code)
  return code
}

/**
 * 沙箱执行官方语言文件，取指定 locale 的字典。
 * 文件本身只暴露当前 localStorage.lang 对应的字典（window.module_lang），
 * 因此用 fake localStorage 控制 locale 后执行；checkLangFun 在官方页里负责把
 * module_lang 并入全局 lang，这里不需要，传 no-op。
 */
export async function resolveModuleLangDict(
  locale: ModuleLocale,
  module: LangModule = 'mf_finance'
): Promise<ModuleLangDict> {
  return resolveLangDictByWindowKey(
    locale,
    moduleLangUrl(module),
    'module_lang'
  )
}

/**
 * 工单插件语言文件（官方 GET /plugins/addon/idcsmart_ticket/.../lang/index.js，
 * 结构同模块语言但写 window.plugin_lang 而非 module_lang）
 */
export const TICKET_LANG_URL =
  '/plugins/addon/idcsmart_ticket/template/clientarea/pc/default/lang/index.js'

/** 通用沙箱执行：captureKey 指定语言文件写入的 window 属性名（module_lang/plugin_lang） */
async function resolveLangDictByWindowKey(
  locale: ModuleLocale,
  url: string,
  captureKey: 'module_lang' | 'plugin_lang'
): Promise<ModuleLangDict> {
  const code = await loadModuleLangCode(url)
  const fakeWindow: Record<string, unknown> = {}
  const fakeLocalStorage = {
    getItem: (key: string) => (key === 'lang' ? locale : null),
  }
  const run = new Function('window', 'localStorage', 'checkLangFun', code)
  run(fakeWindow, fakeLocalStorage, () => {})
  const dict = fakeWindow[captureKey]
  if (!dict || typeof dict !== 'object' || Array.isArray(dict)) {
    throw new Error('语言文件解析失败')
  }
  return dict as ModuleLangDict
}

/** 工单插件语言字典（window.plugin_lang 等价物，zh-cn/en-us/zh-hk 三套） */
export async function resolveTicketLangDict(
  locale: ModuleLocale
): Promise<ModuleLangDict> {
  return resolveLangDictByWindowKey(locale, TICKET_LANG_URL, 'plugin_lang')
}

/**
 * 子账户插件（IdcsmartSubAccount）语言文件（官方 GET
 * /plugins/addon/idcsmart_sub_account/.../lang/index.js，key 为 subaccount_text*）
 */
export const SUBACCOUNT_LANG_URL =
  '/plugins/addon/idcsmart_sub_account/template/clientarea/pc/default/lang/index.js'

/** 子账户插件语言字典（window.plugin_lang 等价物，zh-cn/en-us/zh-hk 三套） */
export async function resolveSubAccountLangDict(
  locale: ModuleLocale
): Promise<ModuleLangDict> {
  return resolveLangDictByWindowKey(locale, SUBACCOUNT_LANG_URL, 'plugin_lang')
}

/**
 * 新闻插件（IdcsmartNews）语言文件（官方 GET /plugins/addon/idcsmart_news/.../lang/index.js，
 * 结构同工单插件，写 window.plugin_lang，key 为 news_text*）
 */
export const NEWS_LANG_URL =
  '/plugins/addon/idcsmart_news/template/clientarea/pc/default/lang/index.js'

/** 新闻插件语言字典（window.plugin_lang 等价物，zh-cn/en-us/zh-hk 三套） */
export async function resolveNewsLangDict(
  locale: ModuleLocale
): Promise<ModuleLangDict> {
  return resolveLangDictByWindowKey(locale, NEWS_LANG_URL, 'plugin_lang')
}

/**
 * 公告插件（IdcsmartAnnouncement）语言文件（官方 GET
 * /plugins/addon/idcsmart_announcement/.../lang/index.js，key 与新闻插件同为 news_text*）
 */
export const ANNOUNCEMENT_LANG_URL =
  '/plugins/addon/idcsmart_announcement/template/clientarea/lang/index.js'

/** 公告插件语言字典（window.plugin_lang 等价物，zh-cn/en-us/zh-hk 三套） */
export async function resolveAnnouncementLangDict(
  locale: ModuleLocale
): Promise<ModuleLangDict> {
  return resolveLangDictByWindowKey(locale, ANNOUNCEMENT_LANG_URL, 'plugin_lang')
}

/**
 * 帮助中心插件（IdcsmartHelp）语言文件（官方 GET
 * /plugins/addon/idcsmart_help/.../lang/index.js，key 为 source_* / file_*）
 */
export const HELP_LANG_URL =
  '/plugins/addon/idcsmart_help/template/clientarea/pc/default/lang/index.js'

/** 帮助中心插件语言字典（window.plugin_lang 等价物） */
export async function resolveHelpLangDict(
  locale: ModuleLocale
): Promise<ModuleLangDict> {
  return resolveLangDictByWindowKey(locale, HELP_LANG_URL, 'plugin_lang')
}

/**
 * 文件下载插件（IdcsmartFileDownload）语言文件（官方 GET
 * /plugins/addon/idcsmart_file_download/.../lang/index.js，key 为 source_* / file_*）
 */
export const DOWNLOAD_LANG_URL =
  '/plugins/addon/idcsmart_file_download/template/clientarea/pc/default/lang/index.js'

/** 文件下载插件语言字典（window.plugin_lang 等价物） */
export async function resolveDownloadLangDict(
  locale: ModuleLocale
): Promise<ModuleLangDict> {
  return resolveLangDictByWindowKey(locale, DOWNLOAD_LANG_URL, 'plugin_lang')
}

/**
 * 实名认证插件（IdcsmartCertification）语言文件（官方 GET
 * /plugins/addon/idcsmart_certification/.../lang/index.js，key 为 realname_text*）
 */
export const CERTIFICATION_LANG_URL =
  '/plugins/addon/idcsmart_certification/template/clientarea/pc/default/lang/index.js'

/** 实名认证插件语言字典（window.plugin_lang 等价物，zh-cn/en-us/zh-hk 三套） */
export async function resolveCertificationLangDict(
  locale: ModuleLocale
): Promise<ModuleLangDict> {
  return resolveLangDictByWindowKey(locale, CERTIFICATION_LANG_URL, 'plugin_lang')
}

function lookup(dict: ModuleLangDict, key: string): string | undefined {
  // 支持 com_config.please_select 这类嵌套 key（官方 lang.com_config.xxx 取值）
  let value: unknown = dict
  for (const part of key.split('.')) {
    if (value == null || typeof value !== 'object') return undefined
    value = (value as Record<string, unknown>)[part]
  }
  return typeof value === 'string' ? value : undefined
}

/**
 * 官方客户端基础语言文件（window.lang 等价物）：
 * /clientarea/template/pc/default/lang/<locale>/index.js（const lang_obj = {...}; window.lang = lang_obj;）。
 * 官方页面 Vue.prototype.lang = Object.assign(window.lang, window.module_lang)，
 * 本模板在 useClientLang 中单独取用（退款/停用等 clientarea 基础 key 只存在于该文件）。
 */
export const CLIENT_LANG_BASE = '/clientarea/template/pc/default/lang'

/** 客户端基础语言目录名（与官方 lang 目录一致） */
export const CLIENT_LANG_DIRS: Record<ModuleLocale, string> = {
  'zh-cn': 'zh-cn',
  'en-us': 'en-us',
  'zh-hk': 'zh-hk',
}

export async function resolveClientLangDict(
  locale: ModuleLocale
): Promise<ModuleLangDict> {
  const code = await loadModuleLangCode(
    `${CLIENT_LANG_BASE}/${CLIENT_LANG_DIRS[locale]}/index.js`
  )
  const fakeWindow: { lang?: unknown } = {}
  const run = new Function('window', code)
  run(fakeWindow)
  const dict = fakeWindow.lang
  if (!dict || typeof dict !== 'object' || Array.isArray(dict)) {
    throw new Error('客户端语言文件解析失败')
  }
  return dict as ModuleLangDict
}

/**
 * 官方同款翻译函数：
 * 当前模块 locale 字典 → 当前模块 zh-cn 字典 → mf_finance 基准字典
 * （baseDict/baseZhDict，官方各模块 lang 文件的详情文案超集）→ 调用方 fallback → 原 key
 */
export function createModuleTranslator(
  dict?: ModuleLangDict,
  zhDict?: ModuleLangDict,
  baseDict?: ModuleLangDict,
  baseZhDict?: ModuleLangDict
): (key: string, fallback?: string) => string {
  return (key, fallback) => {
    const value = dict ? lookup(dict, key) : undefined
    if (value) return value
    const zhValue = zhDict ? lookup(zhDict, key) : undefined
    if (zhValue) return zhValue
    const baseValue = baseDict ? lookup(baseDict, key) : undefined
    if (baseValue) return baseValue
    const baseZhValue = baseZhDict ? lookup(baseZhDict, key) : undefined
    if (baseZhValue) return baseZhValue
    return fallback ?? key
  }
}
