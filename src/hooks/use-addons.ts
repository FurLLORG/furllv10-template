import { useQuery } from '@tanstack/react-query'
import { fetchAddons, type AddonsData, type AddonItem } from '@/api'
import { shellAddonItems } from '@/lib/addons'

/**
 * 已安装扩展列表（FurllHome 插件）。
 *
 * - 开发环境（npm run dev，Vite 无 php 壳注入）：请求 /console/v1/furll_home/addons
 * - 生产环境：官方 header.php 壳返回的 HTML 已注入 window.__CLIENT_CONFIG__.addons JSON
 *   （[{id,name,title,url}] 对象数组），直接解析该 JSON 不再请求接口；
 *   壳注入缺失（如官网页面）时回退接口。
 */
export function useAddons(): {
  addons: AddonItem[]
  count: number
  data?: AddonsData
  isLoading: boolean
  isError: boolean
  error: Error | null
} {
  const shellAddons = import.meta.env.DEV ? null : shellAddonItems()

  const query = useQuery({
    queryKey: ['client-addons'],
    queryFn: fetchAddons,
    enabled: shellAddons === null,
    retry: false,
  })

  if (shellAddons) {
    const data: AddonsData = {
      client_id: 0,
      addons: shellAddons,
      count: shellAddons.length,
    }
    return {
      addons: data.addons,
      count: data.count,
      data,
      isLoading: false,
      isError: false,
      error: null,
    }
  }

  return {
    addons: query.data?.data.addons ?? [],
    count: query.data?.data.count ?? 0,
    data: query.data?.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error ?? null,
  }
}
