/**
 * product.htm?m= 菜单 host content 解析工具
 *
 * 官方 GET /console/v1/menu/:id/host 返回的 data.content 是后端按菜单关联模块渲染的
 * Vue2 插件模板 HTML（组装链路：HostController::menuHostList → HostModel::menuHostList
 * → ModuleLogic::hostList → 模块插件 hostList（moduleDefaultView）→ formatTemplate 渲染
 * 并给 css/js 追加 ?v=system_version）。React 原生页面只取其模块标识做页面映射。
 *
 * 官方菜单关联模块有两类（HostModel::menuHostList 分支）：
 * - menu.module（server 插件）：mf_cloud / mf_dcim / idcsmart_common，渲染资源路径为
 *   /plugins/server/<module>/template/...
 * - menu.res_module 单模块（reserver 插件）：idcsmart_common / mf_finance /
 *   mf_finance_common / mf_finance_dcim，渲染资源路径为 /plugins/reserver/<module>/template/...
 *   （res_module 多模块时强制回退 mf_cloud/mf_dcim 的 server 路径）
 */

export type ModuleHostKind = 'server' | 'reserver'

/** 菜单模块标识（kind 区分 server/reserver 插件，模块同名时 API 命名空间不同） */
export interface ModuleHostRef {
  module: string
  kind: ModuleHostKind
}

/** 从 content 中解析模块标识（官方渲染产物均带 /plugins/{server|reserver}/<module>/template/ 资源路径） */
export function parseModuleFromContent(
  content: string
): ModuleHostRef | null {
  const match = content.match(
    /\/plugins\/(server|reserver)\/([a-z0-9_]+)\/template\//
  )
  if (!match) return null
  return {
    kind: match[1] as ModuleHostKind,
    module: match[2],
  }
}
