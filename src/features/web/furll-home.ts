import { useQuery } from '@tanstack/react-query'
import { fetchFurllHome, type FurllHomeBanner, type FurllHomePartner, type FurllHomeRecommend } from '@/api'

/**
 * 官网首页配置（FurllHome 插件 /console/v1/furll_home/home）
 *
 * 插件未安装/接口异常时静默回退到空数据，由调用方决定是否使用内置静态数据兜底。
 * 缓存：首页配置可被后台随时调整，数据即时失效并在窗口聚焦/重新挂载时自动重拉，保证改动及时反映。
 */
export interface FurllHomeConfig {
  banners: FurllHomeBanner[]
  recommendEnabled: boolean
  recommends: FurllHomeRecommend[]
  partners: FurllHomePartner[]
}

const EMPTY: FurllHomeConfig = {
  banners: [],
  recommendEnabled: true,
  recommends: [],
  partners: [],
}

export function useFurllHome(): {
  config: FurllHomeConfig
  isReady: boolean
  isAvailable: boolean
} {
  const query = useQuery({
    queryKey: ['web-furll-home'],
    queryFn: async () => {
      const res = await fetchFurllHome()
      // 接口异常（HTTP 错误或 body.status !== 200）统一抛错，isAvailable=false 走失败态
      if (res.status !== 200) {
        throw new Error(res.msg || '首页信息获取失败')
      }
      const data = res.data
      return {
        banners: data.banners ?? [],
        recommendEnabled: String(data.recommend_enabled ?? '1') === '1',
        recommends: data.recommends ?? [],
        partners: data.partners ?? [],
      } satisfies FurllHomeConfig
    },
    retry: false,
    // 首页配置由后台可随时调整，需及时反映：数据默认即时失效，窗口聚焦/重新挂载时自动重拉
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  return {
    config: query.data ?? EMPTY,
    // 已 settle（成功或失败兜底）才算就绪，用于驱动首页加载动画
    isReady: query.isFetched,
    // 接口是否真正成功：失败时为 false，调用方据此渲染失败态
    isAvailable: query.isSuccess,
  }
}
