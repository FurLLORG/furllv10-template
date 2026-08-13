import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from '@tanstack/react-router'
import {
  addCartItem,
  fetchCommon,
  fetchProductConfigOption,
  fetchProductDetail,
  fetchProductGroupSecond,
  fetchProductList,
  updateCartItem,
  type CommonConfig,
  type ProductGroupSecondItem,
  type ProductListItem,
} from '@/api'
import {
  ArrowLeft,
  Boxes,
  ChevronDown,
  LifeBuoy,
  Loader2,
  Search,
  X,
} from 'lucide-react'
import { getErrorMessage } from '@/lib/api'
import { detectRemfModule } from '@/lib/remf-module'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { MfFinanceConfigPage } from '@/features/cart/config-page'
import {
  LegacyGoods,
  type LegacyGoodsHandle,
} from '@/features/cart/legacy-goods'

// 切换商品弹层里的分组（官方 secProductGroupList：二级分组 + 各分组商品）
type ChangeGroup = ProductGroupSecondItem & { goodsList: ProductListItem[] }

/**
 * 测试开关（.env 配置 VITE_FORCE_OFFICIAL_GOODS=1）：强制所有商品配置页走官方
 * pc/default 壳（legacy iframe），临时关闭已适配模块（remf 系列）的 React 自定义
 * 选配页，用于验证未适配模块能否按官方方法渲染配置表单。
 */
const FORCE_OFFICIAL_GOODS = ['1', 'true'].includes(
  import.meta.env.VITE_FORCE_OFFICIAL_GOODS ?? ''
)

export function GoodsPage() {
  const navigate = useNavigate()
  const isGuest = !useAuthStore((state) => state.auth.accessToken)
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
  // mf_finance_dcim）→ 原生 React 渲染；其余模块（mf_cloud/mf_dcim/idcsmart_common/第三方）
  // 走官方 pc/default 壳 iframe 渲染选配表单，动作按钮由本页 React 提供
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
  // 未适配模块官方壳（LegacyGoods）的动作栏状态
  const [cartDialog, setCartDialog] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const legacyRef = useRef<LegacyGoodsHandle>(null)
  const queryClient = useQueryClient()
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

  function requireLogin() {
    navigate({
      to: '/login.htm',
      search: {
        redirect: `${window.location.pathname}${window.location.search}`,
      },
    })
  }

  // 未适配模块动作栏：经官方 iframeBuy 协议让模块校验配置并回传最终订单参数（LegacyGoods.submit）
  async function handleAddCart() {
    if (submitting) return
    if (isGuest) {
      requireLogin()
      return
    }
    setSubmitting(true)
    try {
      const result = await legacyRef.current?.submit('cart')
      if (!result) return
      const res = await addCartItem(result.params)
      if (res.status === 200) {
        // 刷新顶栏购物车角标（与 header 同 key 共享缓存）
        queryClient.invalidateQueries({ queryKey: ['cart'] })
        setCartDialog(true)
      } else {
        toast.error(res.msg || '加入购物车失败')
      }
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleBuyNow() {
    if (submitting) return
    if (isGuest) {
      requireLogin()
      return
    }
    // 官方 buyNow：custom_fields.before_settle=1 时先引导完善账户信息
    const beforeSettle =
      (commonData?.custom_fields as { before_settle?: number } | undefined)
        ?.before_settle === 1
    if (beforeSettle) {
      navigate({ to: '/account.htm' })
      return
    }
    setSubmitting(true)
    try {
      const result = await legacyRef.current?.submit('buy')
      if (!result) return
      sessionStorage.setItem(
        'product_information',
        JSON.stringify(result.params)
      )
      window.location.href = `/cart/settlement.htm?id=${result.params.product_id}`
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  // 购物车编辑模式（change=true）：模块回传 params 含 position，改完回购物车
  async function handleSaveChange() {
    if (submitting) return
    setSubmitting(true)
    try {
      const result = await legacyRef.current?.submit('buy')
      if (!result) return
      if (result.params.position == null) {
        toast.error('配置信息缺失，请从购物车重新进入')
        return
      }
      const res = await updateCartItem({
        position: result.params.position,
        product_id: result.params.product_id,
        config_options: result.params.config_options,
        qty: result.params.qty,
        customfield: result.params.customfield,
        self_defined_field: result.params.self_defined_field,
      })
      toast.success(res.msg || '已修改')
      navigate({ to: '/cart/shoppingCar.htm' })
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const contentLoading =
    contentQuery.isLoading || (!content && !contentQuery.error)

  // 官方壳（legacy iframe）是否为主内容：整页固定到视口高度，iframe flex-1 自适应，
  // 内部滚动、页面右侧不出现上下滚动条
  const legacyMode =
    (FORCE_OFFICIAL_GOODS && id > 0) ||
    (remfModule === null && id > 0 && content != null)

  // 未适配模块（或强制官方模式）的官方选配表单块：iframe 壳渲染官方配置，
  // React 提供动作栏（经 iframeBuy 协议收集最终配置）与加购成功弹窗。
  const legacyGoodsBlock = (
    <div className='flex min-h-0 flex-1 flex-col gap-4'>
      <LegacyGoods
        ref={legacyRef}
        productId={id}
        change={change}
        editName={editName}
        commonData={commonData}
      />
      <div className='flex shrink-0 flex-wrap items-center justify-between gap-3 border-t pt-4'>
        <div className='flex w-full flex-wrap items-center gap-3 sm:w-auto'>
          {change ? (
            <Button
              onClick={handleSaveChange}
              disabled={submitting}
              className='min-w-32 flex-1 sm:flex-none'
            >
              {submitting && <Loader2 className='size-4 animate-spin' />}
              保存修改
            </Button>
          ) : isGuest ? (
            <Button
              onClick={requireLogin}
              className='min-w-28 flex-1 sm:flex-none'
            >
              登录后购买
            </Button>
          ) : (
            <>
              <Button
                variant='outline'
                onClick={handleAddCart}
                disabled={submitting}
                className='min-w-28 flex-1 sm:flex-none'
              >
                {submitting && <Loader2 className='size-4 animate-spin' />}
                加入购物车
              </Button>
              <Button
                onClick={handleBuyNow}
                disabled={submitting}
                className='min-w-28 flex-1 sm:flex-none'
              >
                {submitting && <Loader2 className='size-4 animate-spin' />}
                立即购买
              </Button>
            </>
          )}
        </div>
      </div>
      {/* 加入购物车成功弹窗 */}
      <Dialog open={cartDialog} onOpenChange={setCartDialog}>
        <DialogContent className='sm:max-w-sm'>
          <DialogTitle className='sr-only'>加入购物车成功</DialogTitle>
          <div className='py-4 text-center'>
            <p className='text-lg font-medium'>您已成功加入购物车！</p>
          </div>
          <DialogFooter className='flex gap-2 sm:justify-center'>
            <Button variant='outline' onClick={() => setCartDialog(false)}>
              继续购物
            </Button>
            <Button onClick={() => navigate({ to: '/cart/shoppingCar.htm' })}>
              去购物车结算
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )

  return (
    // 官方壳模式整页固定视口高度（100svh - 顶栏4rem - Main 上下 padding 3rem -
    // SidebarInset inset 边距 1rem，见 client-layout 的 m-2 与 ticket 页 var(--spacing)*4 同款补偿；
    // m-2 仅 md+ 生效，手机端无需减 1rem，故高度分档），iframe flex-1 内部滚动、
    // 页面不出现整页滚动条；非官方壳（原生选配页/加载/错误）保持普通流式滚动
    <div
      className={cn(
        legacyMode
          ? 'flex h-[calc(100svh-7rem)] min-h-0 flex-col gap-0 md:h-[calc(100svh-8rem)] md:gap-4'
          : 'space-y-4'
      )}
    >
      {/* 页面标题区（与产品列表/购物车页同款头）：返回 + 产品标题 + 切换商品 + 编辑模式提示 */}
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-2 -mt-1 md:mt-0 md:gap-3',
          legacyMode ? 'shrink-0' : 'mb-2'
        )}
      >
        <div className='flex min-w-0 items-center gap-2 md:gap-3'>
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
            <h1 className='truncate text-lg font-bold tracking-tight sm:text-xl'>
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

      {/* 测试开关开启：全部商品直接走官方 pc/default 壳（legacy iframe），
          跳过模块探测与 React 自定义选配页（用于验证未适配模块的官方渲染） */}
      {FORCE_OFFICIAL_GOODS && id > 0 ? (
        legacyGoodsBlock
      ) : remfModule && id > 0 ? (
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
          ) : content ? (
            // 未适配模块：官方选配表单（iframe 壳渲染，官方购买/加购按钮已由壳 CSS 隐藏）+
            // React 动作栏（加入购物车/立即购买，经 iframeBuy 协议收集最终配置）
            legacyGoodsBlock
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
