import { useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  fetchCommon,
  fetchHostDetail,
  fetchHostView,
  type CommonConfig,
  type HostDetail,
} from '@/api'
import { getErrorMessage } from '@/lib/api'
import { useModuleLang } from '@/hooks/use-module-lang'
import { detectProductModule } from '@/lib/remf-module'
import { CloudDetailPage } from '@/features/client/cloud-detail'
import { CommonDetailPage } from '@/features/client/common-detail'
import { LegacyHost } from '@/features/client/legacy-host'
import { ArrowLeft, Server } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * 测试开关（.env 配置 VITE_FORCE_OFFICIAL_CONSOLE=1）：强制所有产品详情走官方
 * pc/default 壳解析（legacy iframe），临时关闭已适配模块的 React 自定义解析，
 * 用于验证未适配模块能否按官方方法渲染控制台。
 */
const FORCE_OFFICIAL_CONSOLE = ['1', 'true'].includes(
  import.meta.env.VITE_FORCE_OFFICIAL_CONSOLE ?? ''
)

/**
 * 产品详情页（productdetail.htm?id=，需登录）
 *
 * 官方 productdetail.php + js/productdetail.js 处理方式：
 * - id 为已购产品（host）ID
 * - GET /console/v1/host/:id 取产品基础数据（标题用 host.product_name）
 * - GET /console/v1/host/:id/view 取后端按模块渲染的产品内页 HTML（content）
 *
 * FurLLV10 原生渲染官方各模块（plugins/server|reserver/<module>/template 的
 * product_detail.html，探测见 detectProductModule）：
 * - cloud/dcim 族（mf_finance / mf_finance_common / mf_finance_dcim /
 *   mf_cloud / mf_dcim 及 reserver 变体）→ CloudDetailPage
 * - common 族（idcsmart_common / reidcsmart_common 独立资源）→ CommonDetailPage
 * 其余未知模块提示联系客服，不注入官方 Vue2 模板。
 */
export function ProductDetailPage() {
  const navigate = useNavigate()
  const { t } = useModuleLang()
  const searchStr = useLocation({ select: (location) => location.searchStr })
  const search = useMemo(() => new URLSearchParams(searchStr), [searchStr])
  const hostId = Number(search.get('id') ?? '') || 0

  // 通用配置（与 ClientLayout 同 key 复用缓存）
  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  const commonData = commonQuery.data?.data as CommonConfig | undefined

  // 产品基础数据：官方 productdetail.js hostDetail → GET /host/:id
  const hostQuery = useQuery({
    queryKey: ['product-detail-host', hostId],
    queryFn: () => fetchHostDetail(hostId),
    enabled: hostId > 0 && !FORCE_OFFICIAL_CONSOLE,
    retry: false,
  })
  const host = hostQuery.data?.data.host as HostDetail | undefined

  // 产品内页模块内容：官方 getProductDetail → GET /host/:id/view
  const viewQuery = useQuery({
    queryKey: ['product-detail-view', hostId],
    queryFn: () => fetchHostView(hostId),
    enabled: hostId > 0 && !FORCE_OFFICIAL_CONSOLE,
    retry: false,
  })
  const content = viewQuery.data?.data.content

  // 模块检测：后端返回的产品内页 HTML 引用官方模块模板（plugins/server|reserver/）
  // → 原生 React 渲染对应详情页；cloud/dcim 族走 CloudDetailPage，common 族
  // （idcsmart_common 独立资源）走 CommonDetailPage
  const productModule = content ? detectProductModule(content) : null
  const isCloudFamily =
    productModule !== null && productModule.kind !== 'common'

  // 页面标题（官方 getCommonData 同款：产品名 - 站点名）
  useEffect(() => {
    const base = commonData?.website_name || 'FurLL'
    document.title = host?.product_name
      ? `${host.product_name} - ${base}`
      : `${base} - ${t('common_cloud_text43', '产品详情')}`
  }, [host, commonData, t])

  // 请求中或成功但内容尚未返回时显示骨架；空 content（非失败）单独走空态分支
  const contentLoading =
    viewQuery.isLoading ||
    (!content && !viewQuery.error && !viewQuery.isSuccess)

  // 测试开关开启：全部产品直接走官方壳（legacy iframe），跳过下方自定义 React 解析
  if (FORCE_OFFICIAL_CONSOLE && hostId > 0) {
    return <LegacyHost hostId={hostId} />
  }

  // 云/dcim 产品（mf_finance 系列 / mf_cloud / mf_dcim 及 reserver 变体）：
  // 原生渲染，不依赖官方 Vue2 宿主环境
  // 官方排版：返回箭头+产品名在内容区头部（详情页内），此处不再包裹外层按钮
  if (isCloudFamily && productModule && hostId > 0) {
    return (
      <CloudDetailPage
        key={`${productModule.type}-${productModule.module}-${hostId}`}
        hostId={hostId}
        commonData={commonData}
        module={productModule}
        content={content}
      />
    )
  }

  // 独立资源产品（idcsmart_common / reidcsmart_common）
  if (productModule && hostId > 0) {
    return (
      <CommonDetailPage
        key={`${productModule.type}-${productModule.module}-${hostId}`}
        hostId={hostId}
        commonData={commonData}
        module={productModule}
        content={content}
      />
    )
  }

  return (
    <div className='space-y-4'>
      <div className='mb-2 flex flex-wrap items-center justify-between gap-3'>
        <Button
          variant='ghost'
          size='sm'
          className='text-muted-foreground hover:text-foreground'
          onClick={() => navigate({ to: '/productList.htm' })}
        >
          <ArrowLeft className='h-4 w-4' />
          返回{t('common_cloud_text94', '产品列表')}
        </Button>
        {host?.product_name && (
          <p className='min-w-0 truncate text-sm font-medium text-muted-foreground'>
            {host.product_name}
            {host.name ? ` · ${host.name}` : ''}
          </p>
        )}
      </div>

      {!hostId ? (
        <div className='flex flex-col items-center gap-2 rounded-lg border bg-background py-20 text-center'>
          <Server className='h-10 w-10 text-muted-foreground' />
          <p className='text-muted-foreground'>缺少产品 ID，请从产品列表进入</p>
          <Button
            variant='outline'
            className='mt-2'
            onClick={() => navigate({ to: '/productList.htm' })}
          >
            {t('common_cloud_text94', '产品列表')}
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
      ) : viewQuery.error ? (
        <div className='flex flex-col items-center gap-3 rounded-lg border bg-background py-20 text-center'>
          <p className='text-muted-foreground'>
            产品详情加载失败：{getErrorMessage(viewQuery.error)}
          </p>
          <Button variant='outline' onClick={() => viewQuery.refetch()}>
            重试
          </Button>
        </div>
      ) : !content ? (
        <div className='flex flex-col items-center gap-3 rounded-lg border bg-background py-20 text-center'>
          <Server className='h-10 w-10 text-muted-foreground' />
          <p className='text-muted-foreground'>该产品暂无详情内容</p>
        </div>
      ) : (
        // 未适配模块：注入官方 pc/default 壳，由官方 productdetail.js 在 iframe 内渲染
        // （不再提示"模板暂不支持"，体验与官方 default 一致）
        <LegacyHost hostId={hostId} />
      )}
    </div>
  )
}
