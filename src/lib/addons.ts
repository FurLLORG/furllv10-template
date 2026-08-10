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
export interface ShellAddon {
  id: number
  name: string
  title: string
  url: string
}

/** 读取壳注入的 window.__CLIENT_CONFIG__.addons 原始数组，无注入/非法格式返回 null */
function readShellAddonsRaw(): unknown[] | null {
  try {
    const cfg = (window as { __CLIENT_CONFIG__?: { addons?: unknown[] } })
      .__CLIENT_CONFIG__
    const addons = cfg?.addons
    return Array.isArray(addons) ? addons : null
  } catch {
    return null
  }
}

/**
 * 生产环境壳注入的插件列表（[{id,name,title,url}] 对象数组，兼容字符串数组）。
 * 无注入/非法格式返回 null；注入为空数组时返回 []。
 */
export function shellAddonItems(): ShellAddon[] | null {
  const raw = readShellAddonsRaw()
  if (!raw) return null
  return raw
    .map((item): ShellAddon | null => {
      if (typeof item === 'string' || typeof item === 'number') {
        return { id: 0, name: String(item), title: '', url: '' }
      }
      if (typeof item !== 'object' || item === null) return null
      const obj = item as Record<string, unknown>
      const name = typeof obj.name === 'string' ? obj.name : ''
      if (!name) return null
      return {
        id: typeof obj.id === 'number' ? obj.id : 0,
        name,
        title: typeof obj.title === 'string' ? obj.title : '',
        url: typeof obj.url === 'string' ? obj.url : '',
      }
    })
    .filter((item): item is ShellAddon => item !== null)
}

export function installedAddons(): string[] {
  const items = shellAddonItems()
  if (!items) return []
  return items.map((item) => item.name)
}
