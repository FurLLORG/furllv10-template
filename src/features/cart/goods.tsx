import { useEffect, useMemo, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate } from '@tanstack/react-router'
import {
  fetchCommon,
  fetchProductConfigOption,
  fetchProductDetail,
  fetchProductGroupSecond,
  fetchProductList,
  type CommonConfig,
  type ProductGroupSecondItem,
  type ProductListItem,
} from '@/api'
import {
  ArrowLeft,
  Boxes,
  ChevronDown,
  LifeBuoy,
  Search,
  X,
} from 'lucide-react'
import { getErrorMessage } from '@/lib/api'
import { detectRemfModule } from '@/lib/remf-module'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { MfFinanceConfigPage } from '@/features/cart/config-page'

// 切换商品弹层里的分组（官方 secProductGroupList：二级分组 + 各分组商品）
type ChangeGroup = ProductGroupSecondItem & { goodsList: ProductListItem[] }

export function GoodsPage() {
  const navigate = useNavigate()
  // URL 参数与官方一致：id=商品ID，change=true&name=xxx 为购物车编辑回填模式
  const searchStr = useLocation({ select: (location) => location.searchStr })
  const search = useMemo(() => new URLSearchParams(searchStr), [searchStr])
  const id = Number(search.get('id') ?? '') || 0
  const change = search.get('change') === 'true'
  const editName = search.get('name') ?? ''

  // 通用配置（与 ClientLayout 同 key 复用缓存）：cart_change_product 控制是否展示切换商品入口
  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  const commonData = commonQuery.data?.data as CommonConfig | undefined
  const canChangeProduct =
    (commonData?.cart_change_product as number | undefined) === 1

  // 配置页内容：官方 getOrederConfig → GET /product/:id/config_option
  // 切换商品期间保留旧内容占位（isPlaceholderData），模块检测跳过占位数据
  const contentQuery = useQuery({
    queryKey: ['cart-goods-content', id],
    queryFn: () => fetchProductConfigOption(id),
    enabled: id > 0,
    retry: false,
    placeholderData: (previous) => previous,
  })
  const content = contentQuery.isPlaceholderData
    ? undefined
    : contentQuery.data?.data.content
  const productName = contentQuery.data?.data.product_name

  // 模块检测：后端返回的配置页 HTML 引用 remf 系列模块模板（mf_finance / mf_finance_common /
  // mf_finance_dcim）→ 原生 React 渲染；其余模块未适配 → 提示联系客服，不注入官方模板
  const remfModule = content ? detectRemfModule(content) : null

  // 切换商品数据（官方 goods.js getGoodDetail → getProductGroup_second → getProductGoodList）
  const detailQuery = useQuery({
    queryKey: ['cart-goods-detail', id],
    queryFn: () => fetchProductDetail(id),
    enabled: canChangeProduct && id > 0,
    retry: false,
  })
  const firstGroupId =
    detailQuery.data?.data.product.product_group_id_first ?? null
  const groupsQuery = useQuery({
    queryKey: ['cart-goods-change-groups', firstGroupId],
    queryFn: () => fetchProductGroupSecond(firstGroupId!),
    enabled: firstGroupId != null,
    retry: false,
  })
  const secondGroups = useMemo(
    () => groupsQuery.data?.data.list ?? [],
    [groupsQuery.data]
  )
  const groupGoodsQueries = useQueries({
    queries: secondGroups.map((group) => ({
      queryKey: ['cart-goods-change-products', group.id],
      queryFn: () => fetchProductList({ id: group.id, page: 1, limit: 999999 }),
      retry: false,
    })),
  })
  const groupGoodsLists = groupGoodsQueries.map(
    (query) => query.data?.data.list ?? []
  )
  const changeGroups: ChangeGroup[] = useMemo(
    () =>
      secondGroups.map((group, index) => ({
        ...group,
        goodsList: groupGoodsLists[index] ?? [],
      })),
    [secondGroups, groupGoodsLists]
  )
  // 弹层标题：官方取二级分组首个商品的一级分组名
  const currentGroupName =
    changeGroups[0]?.goodsList?.[0]?.product_group_name_first ?? ''

  const [popoverOpen, setPopoverOpen] = useState(false)
  const [filterKey, setFilterKey] = useState('')
  const filteredGroups = useMemo(() => {
    const key = filterKey.trim().toLowerCase()
    if (!key) return changeGroups
    return changeGroups
      .map((group) => ({
        ...group,
        goodsList: group.goodsList.filter((item) =>
          item.name.toLowerCase().includes(key)
        ),
      }))
      .filter((group) => group.goodsList.length > 0)
  }, [changeGroups, filterKey])

  // 页面标题（官方 getCommonData 同款：站点名 - 产品名）
  useEffect(() => {
    const base = commonData?.website_name || 'FurLL'
    document.title = productName
      ? `${productName} - ${base}`
      : `${base} - 产品购买`
  }, [productName, commonData])

  // 切换商品：官方 handleCommand 整页跳转 goods.htm?id=xxx，SPA 内同页导航；
  // 同时清掉购物车编辑草稿，避免新商品错误回填旧配置
  function switchProduct(productId: number) {
    sessionStorage.removeItem('product_information')
    setPopoverOpen(false)
    setFilterKey('')
    navigate({ to: '/cart/goods.htm', search: { id: productId } })
  }

  const contentLoading =
    contentQuery.isLoading || (!content && !contentQuery.error)

  return (
    <div className='space-y-4'>
      {/* 页面标题区（与产品列表/购物车页同款头）：返回 + 产品标题 + 切换商品 + 编辑模式提示 */}
      <div className='mb-2 flex flex-wrap items-center justify-between gap-3'>
        <div className='flex min-w-0 items-center gap-3'>
          <Button
            variant='ghost'
            size='icon'
            className='size-8 shrink-0 rounded-full border'
            aria-label='返回产品列表'
            onClick={() => navigate({ to: '/cart/goodsList.htm' })}
          >
            <ArrowLeft className='size-4' />
          </Button>
          <div className='min-w-0'>
            <h1 className='truncate text-2xl font-bold tracking-tight'>
              {productName || '产品购买'}
            </h1>
            <p className='truncate text-sm text-muted-foreground'>
              选择所需配置并提交订单
            </p>
          </div>
        </div>
        <div className='flex min-w-0 flex-wrap items-center gap-2'>
          {change && editName && (
            <Badge variant='secondary' className='border-transparent text-xs'>
              正在修改购物车商品「{editName}」的配置
            </Badge>
          )}
          {canChangeProduct && (
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant='outline'
                  size='sm'
                  className='max-w-56 justify-start'
                >
                  <Boxes className='h-4 w-4 shrink-0' />
                  <span className='truncate'>
                    {currentGroupName || '切换商品'}
                  </span>
                  <ChevronDown className='h-3.5 w-3.5 shrink-0 opacity-60' />
                </Button>
              </PopoverTrigger>
              <PopoverContent align='start' className='w-72 p-0'>
                <div className='relative border-b p-2'>
                  <Search className='pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                  <Input
                    value={filterKey}
                    onChange={(e) => setFilterKey(e.target.value)}
                    placeholder='搜索产品名称'
                    className='bg-background pr-8 pl-8'
                  />
                  {filterKey && (
                    <button
                      type='button'
                      onClick={() => setFilterKey('')}
                      className='absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground'
                      aria-label='清除搜索'
                    >
                      <X className='h-4 w-4' />
                    </button>
                  )}
                </div>
                <div className='max-h-80 overflow-y-auto p-2'>
                  {filteredGroups.length === 0 ? (
                    <p className='px-2 py-6 text-center text-sm text-muted-foreground'>
                      未找到相关产品
                    </p>
                  ) : (
                    filteredGroups.map((group) => (
                      <div key={group.id} className='mb-1'>
                        <p className='px-2 py-1 text-xs font-medium text-muted-foreground'>
                          {group.name}
                        </p>
                        <div className='space-y-0.5'>
                          {group.goodsList.map((product) => {
                            const active = product.id === id
                            return (
                              <button
                                key={product.id}
                                type='button'
                                onClick={() => switchProduct(product.id)}
                                className={cn(
                                  'w-full cursor-pointer rounded-md px-2 py-1.5 text-left text-[13px] transition-colors',
                                  active
                                    ? 'bg-primary/10 font-medium text-primary'
                                    : 'text-foreground hover:bg-muted'
                                )}
                              >
                                {product.name}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {/* remf 系列（通用商品）：原生渲染，不依赖官方 Vue2 宿主环境 */}
      {remfModule && id > 0 ? (
        <MfFinanceConfigPage
          key={id}
          id={id}
          commonData={commonData}
          change={change}
          module={remfModule}
        />
      ) : (
        <>
          {/* 内容区 */}
          {!id ? (
            <div className='flex flex-col items-center gap-2 rounded-lg border bg-background py-20 text-center'>
              <Boxes className='h-10 w-10 text-muted-foreground' />
              <p className='text-muted-foreground'>
                缺少商品 ID，请从产品列表进入
              </p>
              <Button
                variant='outline'
                className='mt-2'
                onClick={() => navigate({ to: '/cart/goodsList.htm' })}
              >
                去产品列表
              </Button>
            </div>
          ) : contentLoading ? (
            <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px]'>
              <div className='rounded-lg border bg-card p-6'>
                <Skeleton className='h-6 w-2/5' />
                <div className='mt-5 space-y-5'>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className='flex items-start gap-4'>
                      <Skeleton className='h-4 w-24 shrink-0' />
                      <Skeleton className='h-8 flex-1' />
                    </div>
                  ))}
                </div>
              </div>
              <Skeleton className='hidden h-72 lg:block' />
            </div>
          ) : contentQuery.error ? (
            <div className='flex flex-col items-center gap-3 rounded-lg border bg-background py-20 text-center'>
              <p className='text-muted-foreground'>
                配置页加载失败：{getErrorMessage(contentQuery.error)}
              </p>
              <Button variant='outline' onClick={() => contentQuery.refetch()}>
                重试
              </Button>
            </div>
          ) : (
            <div className='flex flex-col items-center gap-3 rounded-lg border bg-background py-20 text-center'>
              <LifeBuoy className='h-10 w-10 text-muted-foreground' />
              <p className='max-w-md text-sm font-medium text-foreground'>
                当前产品信息模板未适配，请联系客服处理模板相关问题
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
