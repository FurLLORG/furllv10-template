import { useQuery } from '@tanstack/react-query'
import {
  fetchProductGroupFirst,
  fetchProductGroupSecond,
  fetchProductList,
} from '@/api'

/**
 * 产品分组预取模块（用户体验优化）
 *
 * 登录后打开任意会员中心界面时，预先拉取产品分组一级 → 第一个分组下的二级分组 →
 * 该二级分组的产品，写入 react-query 缓存（queryKey 与 goods-groups-sidebar /
 * goods-list 完全一致，缓存命中不重复请求）。之后用户切到「产品分组」侧边栏或
 * goodsList 页时数据秒显，无需再等待网络请求。
 *
 * 本组件渲染为空节点，仅负责预取；由 ClientLayout 挂载，覆盖全部会员中心界面。
 */
export function ProductGroupsPrefetch() {
  // 一级分组
  const firstQuery = useQuery({
    queryKey: ['cart-goods-first'],
    queryFn: fetchProductGroupFirst,
    retry: false,
  })
  const firstGroups = firstQuery.data?.data.list ?? []
  const firstGroupId = firstGroups[0]?.id

  // 第一个分组的二级分组
  const secondQuery = useQuery({
    queryKey: ['cart-goods-second', firstGroupId],
    queryFn: () => fetchProductGroupSecond(firstGroupId!),
    enabled: firstGroupId != null,
    retry: false,
  })
  const secondGroups = secondQuery.data?.data.list ?? []
  const secondGroupId = secondGroups[0]?.id

  // 该二级分组的产品
  useQuery({
    queryKey: ['cart-goods-products', secondGroupId, ''],
    queryFn: () => fetchProductList({ id: secondGroupId! }),
    enabled: secondGroupId != null,
    retry: false,
  })

  return null
}
