import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate } from '@tanstack/react-router'
import {
  fetchCommon,
  fetchProductGroupFirst,
  fetchProductGroupSecond,
  fetchProductList,
  type ProductListItem,
} from '@/api'
import { Package, Search, X } from 'lucide-react'
import { useCartSidebarStore } from '@/stores/cart-sidebar-store'
import { DESC_HTML_CLASS } from '@/lib/goods-html'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

function formatPrice(
  price: string | number,
  prefix: string,
  cycle: string,
  payType: string
) {
  if (payType === 'free' || Number(price) === 0) {
    return { price: '免费', cycle: '' }
  }
  return { price: `${prefix}${price}`, cycle: cycle ? `/ ${cycle}` : '' }
}

export function GoodsListPage() {
  const navigate = useNavigate()
  // 官方 goodsList.js getQuery("fpg_id"/"spg_id"/"keyword")：URL 参数预选一级/二级分组，
  // 切换分组时写回 URL（官方 watch + history.replaceState 同款，不产生历史记录）
  const location = useLocation()
  const searchStr = location.searchStr
  const search = useMemo(() => new URLSearchParams(searchStr), [searchStr])
  const urlFpgId = Number(search.get('fpg_id')) || 0
  const urlSpgId = Number(search.get('spg_id')) || 0
  // 顶栏/页面搜索框的关键词经 URL 带入，进入本页即处于搜索态
  const urlKeyword = search.get('keyword') ?? ''
  const [keyword, setKeyword] = useState(urlKeyword)
  const [searchQuery, setSearchQuery] = useState(urlKeyword)
  // 分组模式下桌面端分类由左侧分类树接管，pills 仅移动端显示；
  // 用户中心模式下不显示旧的分组筛选。本页未手动选择时默认产品分组
  const isGroupsMode =
    useCartSidebarStore((state) => state.mode ?? 'groups') === 'groups'

  // 官方 goodsList.js created() 清掉商品编辑草稿，避免旧配置被后续页面回填
  useEffect(() => {
    sessionStorage.removeItem('product_information')
  }, [])

  // 页面标题（官方 goodsList.js getCommonData 同款：站点名-商城；本站点文案为「产品购买」）。
  // 覆盖 goods 页设置的产品名标题，返回列表时恢复默认标题
  const commonQuery = useQuery({
    queryKey: ['cart-goods-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  useEffect(() => {
    const websiteName =
      (commonQuery.data?.data.website_name as string) || 'FurLL'
    document.title = `${websiteName} - 产品购买`
  }, [commonQuery.data])
  const currencyPrefix =
    (commonQuery.data?.data.currency_prefix as string) || '¥'

  // 一级分组
  const firstQuery = useQuery({
    queryKey: ['cart-goods-first'],
    queryFn: fetchProductGroupFirst,
    retry: false,
  })
  const firstGroups = firstQuery.data?.data.list ?? []
  const effectiveFirstId =
    urlFpgId > 0 ? urlFpgId : (firstGroups[0]?.id ?? null)

  // 二级分组
  const secondQuery = useQuery({
    queryKey: ['cart-goods-second', effectiveFirstId],
    queryFn: () => fetchProductGroupSecond(effectiveFirstId!),
    enabled: effectiveFirstId !== null,
    retry: false,
  })
  const secondGroups = useMemo(
    () => secondQuery.data?.data.list ?? [],
    [secondQuery.data]
  )
  const effectiveSecondId =
    urlSpgId > 0 ? urlSpgId : (secondGroups[0]?.id ?? null)

  const activeSecond = useMemo(
    () => secondGroups.find((g) => g.id === effectiveSecondId) ?? null,
    [secondGroups, effectiveSecondId]
  )

  // 官方 goodsList.js：切换一级分组后二级分组加载完，spg_id 自动回填为首个二级分组
  // （selectFirstType → select_second_obj.id = list[0].id → watch 写 URL）。
  // 这里在分组数据就绪时把 fpg_id/spg_id 同步进 URL（spg_id 缺失或失效时用当前一级分组首项），
  // 搜索态时额外保留 keyword（顶栏/页面搜索经 URL 带入）。
  // 注意：必须校验仍在 goodsList 页（location 先行更新、路由切换前可能带着旧组件跑到别的页面，
  // 不校验会把用户点 logo/菜单发起的跳转拽回本页）
  useEffect(() => {
    if (location.pathname !== '/cart/goodsList.htm') return
    if (secondGroups.length === 0 || effectiveFirstId == null) return
    const secondId =
      urlSpgId > 0 && secondGroups.some((g) => g.id === urlSpgId)
        ? urlSpgId
        : secondGroups[0].id
    const kw = searchQuery.trim()
    const kwOk = urlKeyword === kw
    if (urlFpgId === effectiveFirstId && urlSpgId === secondId && kwOk) return
    navigate({
      to: '/cart/goodsList.htm',
      search: {
        fpg_id: effectiveFirstId,
        spg_id: secondId,
        ...(kw ? { keyword: kw } : {}),
      },
      replace: true,
    })
  }, [
    location.pathname,
    effectiveFirstId,
    secondGroups,
    urlFpgId,
    urlSpgId,
    urlKeyword,
    searchQuery,
    navigate,
  ])

  // 商品列表：搜索态跨全部分组，否则按二级分组
  const productsQuery = useQuery({
    queryKey: ['cart-goods-products', effectiveSecondId, searchQuery],
    queryFn: () =>
      fetchProductList(
        searchQuery
          ? { keywords: searchQuery }
          : { id: effectiveSecondId ?? undefined }
      ),
    enabled: searchQuery !== '' || effectiveSecondId !== null,
    retry: false,
  })
  const products = productsQuery.data?.data.list ?? []
  const productsLoading = productsQuery.isLoading

  // 官方 watch select_first_obj.id：把 fpg_id 写回 URL（replace 不产生历史记录）。
  // 切换一级分组时清掉 spg_id，官方 selectFirstType 重置二级分组后由新一级分组首项回填
  function selectFirst(id: number) {
    setSearchQuery('')
    setKeyword('')
    navigate({
      to: '/cart/goodsList.htm',
      search: { fpg_id: id },
      replace: true,
    })
  }

  // 官方 watch select_second_obj.id：把 spg_id 写回 URL（保留 fpg_id）
  function selectSecond(id: number) {
    setSearchQuery('')
    setKeyword('')
    navigate({
      to: '/cart/goodsList.htm',
      search: { fpg_id: effectiveFirstId ?? undefined, spg_id: id },
      replace: true,
    })
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearchQuery(keyword.trim())
  }

  function goOrder(product: ProductListItem) {
    // 官方 goOrder：开启 before_settle 时先走账户页
    const beforeSettle =
      (
        commonQuery.data?.data.custom_fields as
          | { before_settle?: number }
          | undefined
      )?.before_settle === 1
    if (beforeSettle) {
      window.open('/account.htm')
      return
    }
    // 商品配置页：本页直接展示（保持侧边栏与顶栏），参数与官方 goods.htm?id=xxx 一致
    navigate({ to: '/cart/goods.htm', search: { id: product.id } })
  }

  function renderCard(product: ProductListItem) {
    const soldOut = product.stock_control === 1 && product.qty <= 0
    const { price, cycle } = formatPrice(
      product.price,
      currencyPrefix,
      product.cycle ?? '',
      product.pay_type
    )
    return (
      <div
        key={product.id}
        className={cn(
          'group flex flex-col rounded-lg border bg-card p-4 transition-all duration-200 hover:border-primary/30 hover:shadow-md',
          soldOut && 'opacity-70'
        )}
      >
        <div className='flex items-center justify-between gap-2'>
          <h3 className='min-w-0 truncate text-[15px] font-medium text-foreground'>
            {product.name}
          </h3>
          <div className='flex shrink-0 items-center gap-1.5'>
            {product.pay_type === 'free' && (
              <Badge className='border-transparent bg-emerald-500 text-white'>
                免费
              </Badge>
            )}
            {soldOut && (
              <Badge
                variant='destructive'
                className='border-transparent bg-[#f53f3f] text-white'
              >
                已售罄
              </Badge>
            )}
          </div>
        </div>
        {product.description ? (
          <div
            className={cn(
              'desc-html mt-2 flex-1 text-muted-foreground',
              DESC_HTML_CLASS
            )}
            dangerouslySetInnerHTML={{ __html: product.description }}
          />
        ) : (
          <p className='mt-2 flex-1 text-[13px] leading-relaxed text-muted-foreground'>
            暂无描述
          </p>
        )}
        <div className='mt-3 flex items-end justify-between gap-3 border-t pt-2.5'>
          <div className='min-w-0'>
            <div className='truncate text-lg font-bold text-primary'>
              {price}
              {cycle && (
                <span className='text-xs font-normal text-muted-foreground'>
                  {cycle}
                </span>
              )}
            </div>
          </div>
          <Button size='sm' disabled={soldOut} onClick={() => goOrder(product)}>
            {soldOut ? '已售罄' : '立即购买'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      {/* 页面标题区 + 搜索 */}
      <div className='mb-2 flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>产品购买</h1>
          <p className='text-sm text-muted-foreground'>
            性能强大、安全、稳定的云产品与服务
          </p>
        </div>
        <form onSubmit={submitSearch} className='relative w-full max-w-xs'>
          <Search className='pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder='搜索产品名称 / 描述'
            className='bg-background pr-8 pl-9'
          />
          {keyword && (
            <button
              type='button'
              onClick={() => {
                setKeyword('')
                setSearchQuery('')
              }}
              className='absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
              aria-label='清除搜索'
            >
              <X className='h-4 w-4' />
            </button>
          )}
        </form>
      </div>

      {/* 一级分组筛选：仅分组模式下移动端显示（桌面端由左侧分类树接管） */}
      {firstQuery.isLoading ? (
        <div className='flex gap-2'>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className='h-9 w-24 rounded-full' />
          ))}
        </div>
      ) : (
        firstGroups.length > 0 && (
          <div
            className={cn(
              'flex flex-wrap items-center gap-2',
              !isGroupsMode && 'hidden',
              'lg:hidden'
            )}
          >
            {firstGroups.map((group) => {
              const active = group.id === effectiveFirstId
              return (
                <button
                  key={group.id}
                  onClick={() => selectFirst(group.id)}
                  className={cn(
                    'cursor-pointer rounded-full border px-4 py-1.5 text-sm transition-colors',
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  )}
                >
                  {group.name}
                </button>
              )
            })}
          </div>
        )
      )}

      {/* 二级分组筛选 */}
      {!searchQuery && secondQuery.isLoading && (
        <div className='flex gap-2'>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className='h-8 w-20 rounded-full' />
          ))}
        </div>
      )}
      {!searchQuery && secondGroups.length > 0 && (
        <div
          className={cn(
            'flex flex-wrap items-center gap-2',
            !isGroupsMode && 'hidden',
            'lg:hidden'
          )}
        >
          {secondGroups.map((group) => {
            const active = group.id === effectiveSecondId
            return (
              <button
                key={group.id}
                onClick={() => selectSecond(group.id)}
                className={cn(
                  'cursor-pointer rounded-full border px-3.5 py-1 text-[13px] transition-colors',
                  active
                    ? 'border-primary bg-primary/10 font-medium text-primary'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                )}
              >
                {group.name}
              </button>
            )
          })}
        </div>
      )}

      {/* 当前分组描述 */}
      {!searchQuery && activeSecond?.description && (
        <div
          className={cn(
            'desc-html text-sm text-muted-foreground',
            DESC_HTML_CLASS
          )}
          dangerouslySetInnerHTML={{ __html: activeSecond.description }}
        />
      )}

      {/* 搜索结果显示 */}
      {searchQuery && (
        <div className='flex items-center justify-between rounded-lg border bg-background px-4 py-3'>
          <p className='text-sm'>
            搜索 “<span className='font-medium'>{searchQuery}</span>” 共找到{' '}
            <span className='font-medium text-primary'>
              {productsQuery.data?.data.count ?? 0}
            </span>{' '}
            个产品
          </p>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => {
              setSearchQuery('')
              setKeyword('')
            }}
          >
            <X className='h-4 w-4' />
            清除
          </Button>
        </div>
      )}

      {/* 加载骨架 */}
      {productsLoading && (
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className='rounded-lg border bg-card p-4'>
              <Skeleton className='h-5 w-3/5' />
              <Skeleton className='mt-2 h-4 w-full' />
              <Skeleton className='mt-1.5 h-4 w-2/3' />
              <div className='mt-3 flex items-center justify-between border-t pt-3'>
                <Skeleton className='h-6 w-20' />
                <Skeleton className='h-8 w-20 rounded-lg' />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 错误态 */}
      {!productsLoading && productsQuery.error && (
        <div className='flex flex-col items-center gap-3 rounded-lg border bg-background py-20 text-center'>
          <p className='text-muted-foreground'>产品数据加载失败</p>
          <Button variant='outline' onClick={() => productsQuery.refetch()}>
            重试
          </Button>
        </div>
      )}

      {/* 空态 */}
      {!productsLoading && !productsQuery.error && products.length === 0 && (
        <div className='flex flex-col items-center gap-2 rounded-lg border bg-background py-20 text-center'>
          {searchQuery ? (
            <Search className='h-10 w-10 text-muted-foreground' />
          ) : (
            <Package className='h-10 w-10 text-muted-foreground' />
          )}
          <p className='text-muted-foreground'>
            {searchQuery ? '没有找到相关产品' : '该分类下暂无产品'}
          </p>
        </div>
      )}

      {/* 产品网格 */}
      {!productsLoading && !productsQuery.error && products.length > 0 && (
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'>
          {products.map((product) => renderCard(product))}
        </div>
      )}
    </div>
  )
}
