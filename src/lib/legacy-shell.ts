/**
 * 未适配模块的官方兼容壳配置（FurLLV10 React 页 → 官方 pc/default 壳，10.7.2 对照）。
 *
 * 官方 /console/v1/host/:id/view 返回的模块 content 依赖官方壳全局环境：
 * Vue2 / Element UI / window.lang / window.Axios / asideMenu/topMenu 组件等。
 * 这些在 FurLLV10 的 React 壳（header.php 仅注入 __CLIENT_CONFIG__）里不存在。
 *
 * 兼容方案：iframe 真实跳转静态壳页 src/assets-public/legacy-host.html?id=<hostId>。
 * - URL 带真实 query，官方 productdetail.js 的 getQuery('id') 与模块自带
 *   cloudDetail.js/dcimDetail.js 的 getUrlParams().id 均能读到产品 ID。
 * - 壳运行时配置（addons/system_version/theme_color/__LANG_CONFIG__）由本文件在
 *   跳转前写入同源 sessionStorage，壳页首个脚本读取应用。
 * - 弃用 srcdoc + history.replaceState：Chromium 禁止在 about:srcdoc 文档上
 *   replaceState（抛 SecurityError），官方脚本读不到 id，内容无法渲染。
 *
 * 壳页静态资源路径复刻官方 header.php + productdetail.php + footer.php（pc/default）。
 */

/** 壳运行时配置的 sessionStorage 键（父页面写、legacy-host.html 读，同源） */
export const LEGACY_SHELL_STORAGE_KEY = 'furll_legacy_shell'

/** 官方壳基础资源路径（官方 {$template_catalog}/template/{$themes}，themes=pc/default） */
export const OFFICIAL_SHELL_BASE = '/clientarea/template/pc/default'

/** 官方 pc/default 产品详情内容接口：由 FurllHome 真实渲染 productdetail.php，隐藏重复导航后供 iframe 使用。 */
export function legacyHostUrl(hostId: number): string {
  return `/console/v1/furll_home/default-product-detail?id=${hostId}`
}

/** 壳运行时配置（父页面写入 sessionStorage，壳页据此构建官方环境） */
export interface LegacyShellConfig {
  /** 产品（host）ID */
  hostId: number
  systemVersion: string
  themeColor: string
  /** 插件列表原始数组（[{id,name,title,url}] 或 dev 的字符串数组） */
  addons: unknown[]
  langConfig: Record<string, unknown>
}

interface WindowClientConfig {
  __CLIENT_CONFIG__?: {
    system_version?: string
    theme_color?: string
    addons?: unknown[]
  }
  __LANG_CONFIG__?: Record<string, unknown>
}

/** 默认语言配置（官方 lang/index.js 读取，缺失时回退 zh-cn） */
const DEFAULT_LANG_CONFIG: Record<string, unknown> = {
  lang_home: 'zh-cn',
  lang_home_follow_browser: 0,
  lang_home_open: 0,
}

/** 从 window 读取官方壳配置（缺省兜底，测试环境无壳也能生成） */
export function buildLegacyShellConfig(hostId: number): LegacyShellConfig {
  const win = window as unknown as WindowClientConfig
  const cfg = win.__CLIENT_CONFIG__
  return {
    hostId,
    systemVersion: cfg?.system_version ?? '',
    themeColor: cfg?.theme_color || 'default',
    addons: cfg?.addons ?? [],
    langConfig: win.__LANG_CONFIG__ ?? DEFAULT_LANG_CONFIG,
  }
}

/** 写入壳运行时配置（iframe 跳转 legacy-host.html 前调用，同源 sessionStorage） */
export function writeLegacyShellConfig(config: LegacyShellConfig): void {
  try {
    sessionStorage.setItem(LEGACY_SHELL_STORAGE_KEY, JSON.stringify(config))
  } catch {
    // sessionStorage 不可用（隐私模式等）时静默降级：壳页用默认配置兜底
  }
}
