/**
 * 未适配商品配置页的官方兼容壳配置（FurLLV10 React goods 页 → 官方 cart/pc/default 壳，
 * 10.7.2 对照）。
 *
 * 官方 /console/v1/product/:id/config_option 返回的模块选配 HTML（/plugins/.../template/
 * cart/pc/default/goods.html）依赖官方壳全局环境：Vue2 / Element UI / window.lang /
 * window.Axios / 组件（payDialog/discountCode/eventCode/customGoods/asideMenu/topMenu）。
 * 这些在 FurLLV10 的 React 壳里不存在。
 *
 * 兼容方案：iframe 真实跳转静态壳页 src/assets-public/legacy-goods.html?id=<productId>。
 * - URL 带真实 query，官方 goods.js 的 getUrlParams().id 与模块 js（remf_finance.js/
 *   mf_cloud.js/...）的 getUrlParams().id 均能读到商品 ID。
 * - 壳运行时配置（addons/system_version/theme_color/__LANG_CONFIG__/commonData）由本文件
 *   在跳转前写入同源 sessionStorage，壳页首个脚本读取应用。
 * - commonData 由壳页写入 localStorage.common_set_before（goods.js 与模块 js 取币种/开关）。
 *
 * 动作按钮由 React 侧渲染（官方 iframeBuy postMessage 协议）：React 发 {type:"iframeBuy",
 * action} → 模块校验配置并回传 {type:"iframeBuy", params, price} → React 完成加购/结算。
 */

import type { AddCartParams } from '@/api'

/** 壳运行时配置的 sessionStorage 键（父页面写、legacy-goods.html 读，同源） */
export const LEGACY_GOODS_STORAGE_KEY = 'furll_legacy_goods'

/** 官方 pc/default 商品内容接口：由 FurllHome 真实渲染 goods.php，隐藏重复导航后供 iframe 使用。 */
export function legacyGoodsUrl(
  productId: number,
  change: boolean,
  name: string
): string {
  const base = '/console/v1/furll_home/default-cart-goods'
  const params = new URLSearchParams({ id: String(productId) })
  if (change) params.set('change', 'true')
  if (name) params.set('name', name)
  return `${base}?${params.toString()}`
}

/** 模块回传的订单参数（与官方 formatData / React AddCartParams 同构） */
export interface LegacyOrderResult {
  params: AddCartParams
  price: number
}

/** 壳运行时配置（父页面写入 sessionStorage，壳页据此构建官方环境） */
export interface LegacyGoodsConfig {
  /** 商品（product）ID */
  productId: number
  systemVersion: string
  themeColor: string
  /** 插件列表原始数组（[{id,name,title,url}] 或 dev 的字符串数组） */
  addons: unknown[]
  langConfig: Record<string, unknown>
  /** /common 全量数据，壳页写入 localStorage.common_set_before 供 goods.js/模块 js 读取 */
  commonData: Record<string, unknown> | null
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
export function buildLegacyGoodsConfig(
  productId: number,
  commonData: Record<string, unknown> | null | undefined
): LegacyGoodsConfig {
  const win = window as unknown as WindowClientConfig
  const cfg = win.__CLIENT_CONFIG__
  return {
    productId,
    systemVersion: cfg?.system_version ?? '',
    themeColor: cfg?.theme_color || 'default',
    addons: cfg?.addons ?? [],
    langConfig: win.__LANG_CONFIG__ ?? DEFAULT_LANG_CONFIG,
    commonData: commonData ?? null,
  }
}

/** 写入壳运行时配置（iframe 跳转前调用，同源存储） */
export function writeLegacyGoodsConfig(config: LegacyGoodsConfig): void {
  try {
    sessionStorage.setItem(LEGACY_GOODS_STORAGE_KEY, JSON.stringify(config))
  } catch {
    // sessionStorage 不可用（隐私模式等）时静默降级：壳页用默认配置兜底
  }

  // FurllHome 游客壳不挂载官方 top-menu；提前提供相同的公共配置，供 goods.js
  // 和模块配置页读取币种、开关等数据。
  if (!config.commonData) return
  try {
    localStorage.setItem('common_set_before', JSON.stringify(config.commonData))
  } catch {
    // localStorage 不可用时由官方壳的空对象兜底
  }
}
