/**
 * 产品模块注册表（产品详情页 /host/:id/view 渲染的模块模板，官方 10.7.2 对照）。
 *
 * 官方系统有两类模块插件目录：
 * - plugins/server/<module>/       自营模块（自己的商品走这些 API）
 * - plugins/reserver/<module>/     代理/上游模块（API 命名空间带 re 前缀）
 *
 * 两类模块的产品详情模板结构同族（product_detail.html + cloudDetail.js/dcimDetail.js
 * /common_product_detail.js），仅 API 命名空间与模板资源路径不同：
 * - mf_finance         → remf_finance（云产品全功能：磁盘/NAT/备份快照）
 * - mf_finance_common  → remf_finance_common（简化：无磁盘/NAT/备份）
 * - mf_finance_dcim    → remf_finance_dcim（有磁盘/备份，无 NAT）
 * - mf_cloud           → mf_cloud / remf_cloud（云产品全功能 + 防御）
 * - mf_dcim            → mf_dcim / remf_dcim（裸金属：IP+流量，无磁盘/备份/NAT）
 * - idcsmart_common    → idcsmart_common / reidcsmart_common（独立资源：configoption 驱动）
 *
 * 购物车 remf 三模块（mf_finance 系列）继续走 REMF_* 导出；产品详情页用
 * detectProductModule 全量探测。
 */

export const REMF_MODULES = [
  'mf_finance',
  'mf_finance_common',
  'mf_finance_dcim',
] as const

export type RemfModule = (typeof REMF_MODULES)[number]

/** 各模块的 API 命名空间（order_page/link 等接口的路径段） */
export const REMF_API_BASE: Record<RemfModule, string> = {
  mf_finance: 'remf_finance',
  mf_finance_common: 'remf_finance_common',
  mf_finance_dcim: 'remf_finance_dcim',
}

/** 各模块的官方语言文件（goods 配置页 goods.html 引用的 lang/index.js） */
export const REMF_LANG_URL: Record<RemfModule, string> = {
  mf_finance:
    '/plugins/reserver/mf_finance/template/clientarea/pc/default/lang/index.js',
  mf_finance_common:
    '/plugins/reserver/mf_finance_common/template/clientarea/pc/default/lang/index.js',
  mf_finance_dcim:
    '/plugins/reserver/mf_finance_dcim/template/clientarea/pc/default/lang/index.js',
}

/**
 * 后端返回的模块页 HTML 中是否引用该模块模板（带结尾斜杠，避免 mf_finance 误匹配
 * mf_finance_common / mf_finance_dcim）
 */
function contentReferencesModule(content: string, module: RemfModule): boolean {
  return content.includes(`/plugins/reserver/${module}/`)
}

/** 从后端渲染的模块页 HTML 探测 remf 通用商品模块；非 remf 模块返回 null */
export function detectRemfModule(content: string): RemfModule | null {
  for (const module of REMF_MODULES) {
    if (contentReferencesModule(content, module)) return module
  }
  return null
}

/** 该模块是否有级联（option_type 20）的 link 子项接口（官方 route.php 对照） */
export function remfHasLinkRoute(module: RemfModule): boolean {
  return module !== 'mf_finance_common'
}

// ---------- 全量产品详情模块（server + reserver） ----------

/** 模块插件类型：server=自营模块，reserver=代理/上游模块 */
export type ProductPluginType = 'server' | 'reserver'

/**
 * 详情页能力集（官方各模块 product_detail.html 选项卡对照）：
 * - monitor  统计图表（cloud 族 chart API）
 * - manage   管理（电源/控制台/重装/救援/重置密码）
 * - disk     磁盘
 * - network  IP+流量（无 NAT）
 * - nat      NAT 转发/建站
 * - backup   备份与快照
 * - upgrade  产品/配置升降级
 */
export interface ProductModuleFeatures {
  monitor: boolean
  manage: boolean
  disk: boolean
  network: boolean
  nat: boolean
  backup: boolean
  upgrade: boolean
}

/** 模块渲染类型（决定用哪套 React 详情页） */
export type ProductModuleKind = 'cloud' | 'dcim' | 'common'

export interface ProductModule {
  /** 模块名（与 plugins/ 目录同名） */
  module: string
  /** server 自营 / reserver 代理 */
  type: ProductPluginType
  /** API 命名空间（/console/v1/<ns>/:id/... 的路径段） */
  apiNamespace: string
  kind: ProductModuleKind
  features: ProductModuleFeatures
  /** 官方语言文件 URL（产品详情页 lang/index.js） */
  langUrl: string
}

/**
 * 官方产品内页 tab 编号 → React tab id（官方 product_detail.html el-tab-pane name）：
 * - tab1 统计图表 → monitor
 * - tab2 管理     → manage
 * - tab3 磁盘     → disk
 * - tab4 网络     → network
 * - tab5 备份快照 → backup
 * - tab6 日志     → log
 */
export type ProductDetailTab =
  | 'monitor'
  | 'manage'
  | 'disk'
  | 'network'
  | 'backup'
  | 'log'

const TAB_NUMBER_TO_ID: Record<string, ProductDetailTab> = {
  '1': 'monitor',
  '2': 'manage',
  '3': 'disk',
  '4': 'network',
  '5': 'backup',
  '6': 'log',
}

/**
 * 从官方模块页 HTML 动态解析实际渲染的 tab 集合（各模块 product_detail.html 的
 * el-tab-pane 静态不同，官方"动态"即模板差异；这里直接按模板还原，不再靠
 * features 注册表猜测）。
 * - 去掉 HTML 注释（如 mf_finance 磁盘 tab 是注释掉的）
 * - 只认 name="1".."6"，未知编号忽略
 */
export function detectTabsFromContent(content: string): Set<ProductDetailTab> {
  const set = new Set<ProductDetailTab>()
  if (!content) return set
  const noComments = content.replace(/<!--[\s\S]*?-->/g, '')
  const re = /el-tab-pane\s+:label="[^"]*"\s+name="([1-6])"/g
  let m
  while ((m = re.exec(noComments))) {
    const id = TAB_NUMBER_TO_ID[m[1]]
    if (id) set.add(id)
  }
  return set
}

/** 探测用的内容标记：模板静态资源路径前缀 */
function templateMarker(type: ProductPluginType, module: string): string {
  return `/plugins/${type}/${module}/template`
}

function makeModule(
  module: string,
  type: ProductPluginType,
  apiNamespace: string,
  kind: ProductModuleKind,
  features: ProductModuleFeatures
): ProductModule {
  return {
    module,
    type,
    apiNamespace,
    kind,
    features,
    langUrl: `${templateMarker(type, module)}/clientarea/pc/default/lang/index.js`,
  }
}

const CLOUD_FULL: ProductModuleFeatures = {
  monitor: true,
  manage: true,
  disk: true,
  network: true,
  nat: true,
  backup: true,
  upgrade: true,
}

const CLOUD_NO_NAT: ProductModuleFeatures = {
  monitor: true,
  manage: true,
  disk: true,
  network: false,
  nat: false,
  backup: true,
  upgrade: true,
}

const DCIM: ProductModuleFeatures = {
  monitor: true,
  manage: true,
  disk: false,
  network: true,
  nat: false,
  backup: false,
  upgrade: true,
}

const CLOUD_LITE: ProductModuleFeatures = {
  monitor: true,
  manage: true,
  disk: false,
  network: false,
  nat: false,
  backup: false,
  upgrade: true,
}

/** 全量已知模块注册表（供 langUrl 解析等；详情页能力已改为动态 tab 推导） */
export const PRODUCT_MODULES: ProductModule[] = [
  makeModule('mf_finance', 'reserver', 'remf_finance', 'cloud', CLOUD_FULL),
  makeModule(
    'mf_finance_common',
    'reserver',
    'remf_finance_common',
    'cloud',
    CLOUD_LITE
  ),
  makeModule(
    'mf_finance_dcim',
    'reserver',
    'remf_finance_dcim',
    'dcim',
    CLOUD_NO_NAT
  ),
  makeModule('mf_cloud', 'reserver', 'remf_cloud', 'cloud', CLOUD_FULL),
  makeModule('mf_dcim', 'reserver', 'remf_dcim', 'dcim', DCIM),
  makeModule(
    'idcsmart_common',
    'reserver',
    'reidcsmart_common',
    'common',
    CLOUD_LITE
  ),
  makeModule('mf_cloud', 'server', 'mf_cloud', 'cloud', CLOUD_FULL),
  makeModule('mf_dcim', 'server', 'mf_dcim', 'dcim', DCIM),
  makeModule(
    'idcsmart_common',
    'server',
    'idcsmart_common',
    'common',
    CLOUD_LITE
  ),
]

/**
 * 已知模块的 NAT/升降级能力提示（tab 无法表达的开关，官方产品详情页按模块模板
 * 固定）。未知模块用保守默认（upgrade=true 通用，nat=false）。
 */
const KNOWN_EXTRA_FEATURES: Record<string, { nat?: boolean; upgrade?: boolean }> = {
  'reserver/mf_finance': { nat: true },
  'reserver/mf_cloud': { nat: true },
  'server/mf_cloud': { nat: true },
}

/**
 * 从动态 tab 集合 + 已知能力提示构建模块能力集。
 * 监控/管理/磁盘/网络/备份这些"有 tab 的"能力一律以官方模板 tab 为准
 * （避免 mf_finance 误配磁盘、mf_cloud 误配备份等），NAT/升降级用已知提示兜底。
 */
function buildFeatures(
  type: ProductPluginType,
  module: string,
  tabs: Set<ProductDetailTab>
): ProductModuleFeatures {
  const extra = KNOWN_EXTRA_FEATURES[`${type}/${module}`] ?? {}
  return {
    monitor: tabs.has('monitor'),
    manage: tabs.has('manage'),
    disk: tabs.has('disk'),
    network: tabs.has('network'),
    nat: extra.nat ?? false,
    backup: tabs.has('backup'),
    upgrade: extra.upgrade ?? true,
  }
}

/** 自身 detail 脚本（云/DCIM/独立资源）引用的模块模板路径（带 module + kind） */
const DETAIL_JS_RE =
  /\/plugins\/(server|reserver)\/([a-z0-9_]+)\/template[^"']*\/js\/(cloudDetail|dcimDetail|common_product_detail)\.js/

/**
 * 从后端渲染的模块页 HTML 通用推导产品模块（不再依赖白名单注册表）：
 * - 模块名 + 插件类型：detail 脚本引用的 `/plugins/{server|reserver}/{module}/template`
 *   （自身 detail js 所在模板，能避开 reserver 混用 server 图片路径的干扰）
 * - kind：detail js 为 dcimDetail 或模块名含 `_dcim` → dcim；idcsmart_common → common；否则 cloud
 * - 命名空间：server → module；reserver → `re`+module（mf_cloud→remf_cloud、
 *   idcsmart_common→reidcsmart_common，官方一致）
 * - features：由动态 tab 集合推导（见 buildFeatures）
 *
 * 未知/第三方模块零登记自动适配；content 无模块 detail 脚本时返回 null（走空态兜底）。
 */
export function detectProductModule(content: string): ProductModule | null {
  if (!content) return null
  const m = DETAIL_JS_RE.exec(content)
  if (!m) return null
  const type = m[1] as ProductPluginType
  const module = m[2]
  const js = m[3]
  const kind: ProductModuleKind =
    js === 'dcimDetail' || module.includes('_dcim')
      ? 'dcim'
      : module === 'idcsmart_common' || module === 'mf_finance_common'
        ? 'common'
        : 'cloud'
  const apiNamespace = type === 'server' ? module : `re${module}`
  const tabs = detectTabsFromContent(content)
  return {
    module,
    type,
    apiNamespace,
    kind,
    features: buildFeatures(type, module, tabs),
    langUrl: `${templateMarker(type, module)}/clientarea/pc/default/lang/index.js`,
  }
}
