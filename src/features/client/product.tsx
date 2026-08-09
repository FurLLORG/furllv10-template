import { useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  fetchCommon,
  fetchMenuHostContent,
  type CommonConfig,
} from '@/api'
import { getErrorMessage } from '@/lib/api'
import { ModuleHostListPage } from './module-host-list'
import { Boxes } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * 商品/模块菜单页（product.htm?m=，需登录）
 *
 * 官方 product.php + js/product.js 处理方式：
 * - m 为 /menu 导航中 menu_type=module 的菜单 ID（MenuModel 拼装 product.htm?m=<menu_id>）
 * - 请求 GET /console/v1/menu/:id/host，后端按菜单关联模块渲染产品列表 HTML（content，
 *   组装链路：HostController::menuHostList → HostModel::menuHostList → ModuleLogic::hostList
 *   → 模块插件 hostList（如 mf_dcim 的 moduleDefaultView）→ formatTemplate 渲染模板
 *   并给 css/js 追加 ?v=system_version）
 * - 本页 React 原生实现：解析 content 中模块标识（/plugins/server/<module>/），
 *   直接调模块列表接口用 React 渲染（见 ModuleHostListPage）
 */
export function ProductPage() {
  const navigate = useNavigate()
  const searchStr = useLocation({ select: (location) => location.searchStr })
  const search = useMemo(() => new URLSearchParams(searchStr), [searchStr])
  const menuId = Number(search.get('m') ?? '') || 0

  // 通用配置（与 ClientLayout 同 key 复用缓存）：localStorage.common_set_before 供内容插件取币种/配置
  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  const commonData = commonQuery.data?.data as CommonConfig | undefined

  // 菜单关联的模块产品列表内容：官方 getProduct(this.id) → GET /menu/:id/host
  const contentQuery = useQuery({
    queryKey: ['product-menu-content', menuId],
    queryFn: () => fetchMenuHostContent(menuId),
    enabled: menuId > 0,
    retry: false,
  })
  const content = contentQuery.data?.data.content

  // 页面标题（与 crossModule.htm 统一：站点名 - 我的产品）
  useEffect(() => {
    const base = commonData?.website_name || 'FurLL'
    document.title = `${base} - 我的产品`
  }, [commonData])

  const contentLoading =
    contentQuery.isLoading || (content === undefined && !contentQuery.error)

  return (
    <div className='space-y-4'>
      {!menuId ? (
        <div className='flex flex-col items-center gap-2 rounded-lg border bg-background py-20 text-center'>
          <Boxes className='h-10 w-10 text-muted-foreground' />
          <p className='text-muted-foreground'>缺少菜单参数，请从导航菜单进入</p>
          <Button
            variant='outline'
            className='mt-2'
            onClick={() => navigate({ to: '/cart/goodsList.htm' })}
          >
            去产品列表
          </Button>
        </div>
      ) : contentLoading ? (
        <div className='rounded-lg border bg-card p-6'>
          <Skeleton className='h-6 w-2/5' />
          <div className='mt-4 flex gap-6'>
            <div className='flex-1 space-y-4'>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className='h-5 w-full' />
              ))}
            </div>
            <Skeleton className='hidden w-64 sm:block' />
          </div>
        </div>
      ) : contentQuery.error ? (
        <div className='flex flex-col items-center gap-3 rounded-lg border bg-background py-20 text-center'>
          <p className='text-muted-foreground'>
            产品列表加载失败：{getErrorMessage(contentQuery.error)}
          </p>
          <Button variant='outline' onClick={() => contentQuery.refetch()}>
            重试
          </Button>
        </div>
      ) : (
        <ModuleHostListPage content={content ?? ''} menuId={menuId} />
      )}
    </div>
  )
}
