/**
 * 系统已安装插件检测（官方 html#addons_js / __CLIENT_CONFIG__.addons）
 *
 * 官方模板在壳里注入 addons 列表，mixin 的 mounted 从 #addons_js 属性读取并判断
 * hasAutoRenew（含 IdcsmartRenew 续费插件）/ 优惠码插件等；FurLLV10 由 header.php 壳
 * 注入 __CLIENT_CONFIG__.addons。
 *
 * 注意：官方控制器注入的是 $PluginModel->plugins('addon')['list']——对象数组
 * （[{id,name,title,url}]，官方 mixin 也是 item.name 取插件标识），非字符串数组。
 */
export function installedAddons(): string[] {
  try {
    const cfg = (window as { __CLIENT_CONFIG__?: { addons?: unknown[] } })
      .__CLIENT_CONFIG__
    const addons = cfg?.addons
    if (!Array.isArray(addons)) return []
    return addons
      .map((item) => {
        if (typeof item === 'string' || typeof item === 'number') {
          return String(item)
        }
        const name = (item as { name?: unknown } | null)?.name
        return typeof name === 'string' ? name : ''
      })
      .filter((name) => name.length > 0)
  } catch {
    return []
  }
}
