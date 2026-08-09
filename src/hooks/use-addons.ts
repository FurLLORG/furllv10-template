import { useQuery } from '@tanstack/react-query'
import { fetchAddons, type AddonsData, type AddonItem } from '@/api'

/**
 * 已安装扩展列表（FurllHome 插件 /console/v1/furll_home/addons，无需认证）。
 * 返回 addons 数组，便于判断某插件是否安装（如 installedAddons().includes('xxx')）。
 * 功能留空待后续实现，此处仅负责获取。
 */
export function useAddons(): {
  addons: AddonItem[]
  count: number
  data?: AddonsData
  isLoading: boolean
  isError: boolean
  error: Error | null
} {
  const query = useQuery({
    queryKey: ['client-addons'],
    queryFn: fetchAddons,
    retry: false,
  })

  return {
    addons: query.data?.data.addons ?? [],
    count: query.data?.data.count ?? 0,
    data: query.data?.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error ?? null,
  }
}
