import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchCart,
  fetchCommon,
  fetchProductPrice,
  deleteCartItems,
  updateCartQty,
  type CartItem,
  type ProductPriceData,
} from '@/api'
import { Loader2, Minus, Plus, Search, ShoppingCart, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PreviewIcon } from '@/lib/preview-icon'
import { stripPreviewPrefix } from '@/lib/preview'
import { FadeText } from '@/components/fade-text'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'

function formatMoney(value: string | number | undefined): string {
  const num = Number(value ?? 0)
  if (isNaN(num) || num < 0) return '0.00'
  return num.toFixed(2)
}

// 购物车行：官方用 position（列表下标）定位，删除后 refetch 重新对齐
type CartLine = CartItem & { position: number }

// 价格明细：主产品 preview + 子产品/下游 preview（官方 son_previews 拍平逻辑）
function collectPreview(price: ProductPriceData | undefined) {
  const list: Array<{ name?: string; value?: string; price?: string }> = []
  if (!price) return list
  list.push(...(price.preview ?? []))
  if (price.other?.son_previews) {
    price.other.son_previews.forEach((items) => list.push(...items))
  }
  if (price.sub_host?.length) {
    price.sub_host.forEach((i) => list.push(...(i.preview ?? [])))
  }
  return list
}

function CartRowCard({
  item,
  currencyPrefix,
  checked,
  onToggle,
  onDeleted,
}: {
  item: CartLine
  currencyPrefix: string
  checked: boolean
  onToggle: (position: number, value: boolean) => void
  onDeleted: () => void
}) {
  const queryClient = useQueryClient()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [deleting, setDeleting] = useState(false)
  // 乐观数量：点击立即反馈并触发动画，500ms 防抖后 PUT，失败回滚；
  // 初始值取购物车数据，组件重挂载（返回页面）时自然拿到最新数量
  const [displayQty, setDisplayQty] = useState(item.qty)
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    []
  )

  // 价格计算：官方把优惠码/活动塞进 config_options 一起算价
  const priceQuery = useQuery({
    queryKey: [
      'cart-price',
      item.position,
      item.product_id,
      item.config_options,
      item.customfield.promo_code,
      item.customfield.event_promotion,
      item.qty,
    ],
    queryFn: () =>
      fetchProductPrice(item.product_id, {
        config_options: {
          ...item.config_options,
          promo_code: item.customfield.promo_code,
          event_promotion: item.customfield.event_promotion,
        },
        qty: item.qty,
      }),
    retry: false,
  })
  const price = priceQuery.data?.data
  const priceQueryLoading = priceQuery.isLoading
  // 算价 loading（对齐官方 priceLoading）：本地数量未对齐后端或价格 refetch 期间，小计转圈
  const priceUpdating = priceQuery.isFetching || displayQty !== item.qty
  const preview = useMemo(() => collectPreview(price), [price])

  const maxQty = item.stock_control === 1 ? item.stock_qty : 99999
  const qtyInvalid = item.stock_control === 1 && displayQty > item.stock_qty

  // 官方 500ms 防抖后提交数量，再重新算价；本地乐观更新数字
  function changeQty(next: number) {
    if (next < 1) return
    if (next > maxQty) {
      toast.warning('数量不能超过库存')
      return
    }
    if (next === displayQty) return
    setDisplayQty(next)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      updateCartQty(item.position, next)
        .then(() => {
          // 刷新购物车列表（数量对齐后端），价格查询 key 含 qty 会自动重算
          queryClient.invalidateQueries({ queryKey: ['cart'] })
        })
        .catch(() => {
          toast.error('修改数量失败')
          setDisplayQty(item.qty)
        })
    }, 500)
  }

  async function remove() {
    setDeleting(true)
    try {
      const res = await deleteCartItems([item.position])
      if (res.status === 200) {
        toast.success(res.msg || '已删除')
        onDeleted()
      } else {
        toast.error(res.msg || '删除失败')
      }
    } catch {
      toast.error('删除失败')
    } finally {
      setDeleting(false)
    }
  }

  // 编辑配置：官方存草稿后跳 goods 页（FurLLV10 未实现 goods 页，走系统默认）
  function editGoods() {
    const draft = {
      config_options: item.config_options,
      position: item.position,
      qty: item.qty,
      customfield: item.customfield,
      self_defined_field: item.self_defined_field,
    }
    sessionStorage.setItem('product_information', JSON.stringify(draft))
    window.open(`/cart/goods.htm?id=${item.product_id}&change=true&name=${item.name}`)
  }

  // 商品信息列：勾选 + 商品名 + 编辑入口 + 价格明细/加载/失效态
  function renderProductInfo() {
    if (priceQueryLoading) {
      return (
        <div className='mt-2.5 space-y-2'>
          <Skeleton className='h-4 w-3/5' />
          <Skeleton className='h-4 w-2/5' />
        </div>
      )
    }
    if (!price) {
      return (
        <div className='mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm'>
          <span className='text-muted-foreground'>商品信息已失效，请重新选购</span>
          <Button variant='outline' size='sm' onClick={editGoods}>
            重新选购
          </Button>
        </div>
      )
    }
    if (preview.length === 0) return null
    // 最长标签宽度（em，中文全角≈1em），让各行的值列左对齐到同一位置
    const maxLabelLen = Math.max(...preview.map((p) => (p.name || '').length))
    const labelWidth = `${maxLabelLen + 1.2}em`
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type='button'
            className='flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
          >
            <span className='flex min-w-0 items-center gap-1.5'>
              <span className='shrink-0'>配置明细</span>
              <span className='min-w-0 truncate'>
                {preview.map((p) => stripPreviewPrefix(p.value)).join(' / ')}
              </span>
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align='start'
          sideOffset={6}
          className='w-max max-w-72 p-3'
        >
          <div className='space-y-1.5'>
            {preview.map((p, i) => (
              <div key={i} className='flex items-start gap-3 text-[13px]'>
                <span
                  className='shrink-0 text-muted-foreground'
                  style={{ width: labelWidth }}
                >
                  {p.name ? `${p.name}：` : ''}
                </span>
                <span className='flex min-w-0 flex-1 items-center gap-1.5'>
                  <PreviewIcon
                    name={p.name}
                    value={p.value}
                    className='shrink-0'
                  />
                  <FadeText
                    className='min-w-0 text-left text-foreground'
                    contentClassName='text-foreground'
                  >
                    {stripPreviewPrefix(p.value)}
                  </FadeText>
                </span>
                <span className='shrink-0'>
                  {currencyPrefix}{formatMoney(p.price)}
                </span>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  // 列模板：移动端上下堆叠（标签在左、值在右），lg 起对齐为五列表格
  const gridTemplate =
    'grid grid-cols-1 gap-x-5 gap-y-3 lg:grid-cols-[minmax(0,1fr)_100px_130px_120px_44px] lg:items-start'

  return (
    <Card className='p-4 lg:p-5'>
      <div className={gridTemplate}>
        {/* 商品信息 */}
        <div className='flex min-w-0 items-start gap-3'>
          <Checkbox
            checked={checked}
            onCheckedChange={(value) => onToggle(item.position, Boolean(value))}
            aria-label={`选择 ${item.name}`}
            className='mt-0.5 shrink-0'
          />
          <div className='min-w-0 flex-1'>
            <div className='flex items-start justify-between gap-2'>
              <p className='min-w-0 truncate text-[15px] font-medium leading-snug'>
                {item.name}
              </p>
              <Button
                variant='ghost'
                size='icon'
                className='h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive lg:hidden'
                onClick={remove}
                disabled={deleting}
                aria-label='删除'
              >
                <Trash2 className='h-4 w-4' />
              </Button>
            </div>
            <div className='mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1'>
              <Button
                variant='link'
                size='sm'
                className='h-auto shrink-0 p-0 text-primary'
                onClick={editGoods}
              >
                编辑配置
              </Button>
              {item.stock_control === 1 && (
                <span
                  className={cn(
                    'text-xs',
                    qtyInvalid ? 'text-destructive' : 'text-muted-foreground'
                  )}
                >
                  库存：{item.stock_qty}
                </span>
              )}
            </div>
            {renderProductInfo()}
          </div>
        </div>

        {/* 单价 */}
        <div className='flex items-center justify-between gap-2 lg:block'>
          <span className='shrink-0 text-xs text-muted-foreground lg:hidden'>单价</span>
          {price ? (
            <span className='text-sm font-medium tabular-nums'>
              {currencyPrefix}
              {formatMoney(Number(price.price) / item.qty)}
              {price.billing_cycle ? ` / ${price.billing_cycle}` : ''}
            </span>
          ) : priceQueryLoading ? (
            <Skeleton className='h-4 w-20' />
          ) : (
            <span className='text-sm text-muted-foreground'>--</span>
          )}
        </div>

        {/* 数量 */}
        <div className='flex items-center justify-between gap-2 lg:block'>
          <span className='shrink-0 text-xs text-muted-foreground lg:hidden'>数量</span>
          <div className='flex items-center gap-1'>
            <Button
              variant='outline'
              size='icon'
              className='h-7 w-7'
              onClick={() => changeQty(displayQty - 1)}
              disabled={displayQty <= 1}
              aria-label='减少数量'
            >
              <Minus className='h-3.5 w-3.5' />
            </Button>
            <span
              key={displayQty}
              className='min-w-10 animate-[qty-pop_0.18s_ease-out] text-center text-sm font-medium tabular-nums'
            >
              {displayQty}
            </span>
            <Button
              variant='outline'
              size='icon'
              className='h-7 w-7'
              onClick={() => changeQty(displayQty + 1)}
              disabled={displayQty >= maxQty}
              aria-label='增加数量'
            >
              <Plus className='h-3.5 w-3.5' />
            </Button>
          </div>
        </div>

        {/* 小计 */}
        <div className='flex items-center justify-between gap-2 lg:block lg:text-right'>
          <span className='shrink-0 text-xs text-muted-foreground lg:hidden'>小计</span>
          {price ? (
            <div className='text-right lg:text-right'>
              <div className='relative inline-block'>
                <span
                  className={cn(
                    'text-base font-bold text-primary tabular-nums',
                    priceUpdating && 'opacity-40'
                  )}
                >
                  {currencyPrefix}{formatMoney(price.price_total)}
                </span>
                {priceUpdating && (
                  <span className='absolute inset-0 z-10 flex items-center justify-center'>
                    <Loader2 className='h-4 w-4 animate-spin text-primary' />
                  </span>
                )}
              </div>
              {Number(price.price_total) !== Number(price.price) && (
                <div className='mt-1 flex items-center justify-end gap-2 text-[13px]'>
                  <span className='text-muted-foreground line-through'>
                    {currencyPrefix}{formatMoney(price.price)}
                  </span>
                  <Badge variant='secondary' className='text-xs'>
                    已优惠 {currencyPrefix}
                    {formatMoney(
                      Number(price.price) - Number(price.price_total)
                    )}
                  </Badge>
                </div>
              )}
            </div>
          ) : priceQueryLoading ? (
            <Skeleton className='h-4 w-20' />
          ) : (
            <span className='text-sm text-muted-foreground'>--</span>
          )}
        </div>

        {/* 操作（桌面端） */}
        <div className='hidden lg:flex lg:pt-0.5 lg:justify-end'>
          <Button
            variant='ghost'
            size='icon'
            className='h-8 w-8 text-muted-foreground hover:text-destructive'
            onClick={remove}
            disabled={deleting}
            aria-label='删除'
          >
            <Trash2 className='h-4 w-4' />
          </Button>
        </div>
      </div>
    </Card>
  )
}

export function ShoppingCarPage() {
  const queryClient = useQueryClient()
  const [keyword, setKeyword] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [checkedPositions, setCheckedPositions] = useState<Set<number>>(new Set())
  const [settling, setSettling] = useState(false)

  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  const currencyPrefix = (commonQuery.data?.data.currency_prefix as string) || '¥'
  const beforeSettle =
    (commonQuery.data?.data.custom_fields as { before_settle?: number } | undefined)
      ?.before_settle === 1

  const cartQuery = useQuery({
    queryKey: ['cart'],
    queryFn: fetchCart,
    retry: false,
    // 购物车是强一致数据：从其他页面加购/改量后返回，必须重新拉取（全局 staleTime 10s 会跳过刷新）
    refetchOnMount: 'always',
  })
  const lines: CartLine[] = useMemo(
    () =>
      (cartQuery.data?.data.list ?? [])
        // 域名商品走系统独立流程，不在购物车展示（官方逻辑）
        .filter((item) => (item.customfield as { is_domain?: number })?.is_domain !== 1)
        .map((item, index) => ({ ...item, position: index })),
    [cartQuery.data]
  )

  const showLines = useMemo(
    () =>
      searchQuery
        ? lines.filter((line) => line.name.includes(searchQuery))
        : lines,
    [lines, searchQuery]
  )

  const checkedLines = showLines.filter((line) => checkedPositions.has(line.position))

  // 合计用行内已算出的价格（价格查询 key 与行 position 对齐）
  const totalPriceFromCache = useMemo(() => {
    let sum = 0
    for (const line of checkedLines) {
      const cached = queryClient.getQueryData<{ data: ProductPriceData }>([
        'cart-price',
        line.position,
        line.product_id,
        line.config_options,
        line.customfield.promo_code,
        line.customfield.event_promotion,
        line.qty,
      ])
      sum += Number(cached?.data?.price_total ?? 0)
    }
    return sum
  }, [checkedLines, queryClient])

  function toggleLine(position: number, value: boolean) {
    setCheckedPositions((prev) => {
      const next = new Set(prev)
      if (value) next.add(position)
      else next.delete(position)
      return next
    })
  }

  function reloadCart() {
    queryClient.invalidateQueries({ queryKey: ['cart'] })
    setCheckedPositions(new Set())
  }

  function toggleAll() {
    if (checkedPositions.size === showLines.length && showLines.length > 0) {
      setCheckedPositions(new Set())
    } else {
      setCheckedPositions(new Set(showLines.map((l) => l.position)))
    }
  }

  function deleteChecked() {
    if (checkedPositions.size === 0) {
      toast.warning('请先选择商品')
      return
    }
    deleteCartItems([...checkedPositions])
      .then((res) => {
        if (res.status === 200) {
          toast.success(res.msg || '已删除')
          reloadCart()
        } else {
          toast.error(res.msg || '删除失败')
        }
      })
      .catch(() => toast.error('删除失败'))
  }

  // 结算：官方把选中的 position 存 sessionStorage 后跳官方结算页
  function goSettle() {
    if (beforeSettle) {
      window.open('/account.htm')
      return
    }
    if (checkedPositions.size === 0) {
      toast.warning('请先选择要结算的商品')
      return
    }
    setSettling(true)
    sessionStorage.shoppingCartList = JSON.stringify([...checkedPositions])
    setTimeout(() => {
      window.location.href = '/cart/settlement.htm?cart=1'
    }, 500)
  }

  return (
    <div className='space-y-4 pb-24'>
      <div className='mb-2 flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>购物车</h1>
          <p className='text-sm text-muted-foreground'>
            已选 {checkedPositions.size} / {lines.length} 件商品
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setSearchQuery(keyword.trim())
          }}
          className='relative w-full max-w-xs'
        >
          <Search className='pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder='搜索购物车商品'
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

      {cartQuery.isLoading ? (
        <div className='space-y-3'>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className='rounded-lg border bg-card p-4'>
              <Skeleton className='h-5 w-2/5' />
              <Skeleton className='mt-3 h-4 w-full' />
              <Skeleton className='mt-1.5 h-4 w-2/3' />
            </div>
          ))}
        </div>
      ) : cartQuery.error ? (
        <div className='flex flex-col items-center gap-3 rounded-lg border bg-background py-20 text-center'>
          <p className='text-muted-foreground'>购物车加载失败</p>
          <Button variant='outline' onClick={() => reloadCart()}>
            重试
          </Button>
        </div>
      ) : lines.length === 0 ? (
        <div className='flex flex-col items-center gap-2 rounded-lg border bg-background py-20 text-center'>
          <ShoppingCart className='h-10 w-10 text-muted-foreground' />
          <p className='text-muted-foreground'>购物车空空如也</p>
          <Button variant='outline' className='mt-2' onClick={() => (window.location.href = '/cart/goodsList.htm')}>
            去逛逛
          </Button>
        </div>
      ) : showLines.length === 0 ? (
        <div className='flex flex-col items-center gap-2 rounded-lg border bg-background py-20 text-center'>
          <Search className='h-10 w-10 text-muted-foreground' />
          <p className='text-muted-foreground'>没有匹配「{searchQuery}」的商品</p>
        </div>
      ) : (
        <>
          {/* 桌面端列头：与商品行同一列模板，保证数字列对齐 */}
          <div className='hidden px-1 pb-1 text-xs font-medium text-muted-foreground lg:block'>
            <div className='grid grid-cols-1 gap-x-5 lg:grid-cols-[minmax(0,1fr)_100px_130px_120px_44px]'>
              <span>商品信息</span>
              <span>单价</span>
              <span>数量</span>
              <span className='text-right'>小计</span>
              <span className='text-right'>操作</span>
            </div>
          </div>

          <div className='space-y-3'>
            {showLines.map((line) => (
              <CartRowCard
                key={line.position}
                item={line}
                currencyPrefix={currencyPrefix}
                checked={checkedPositions.has(line.position)}
                onToggle={toggleLine}
                onDeleted={reloadCart}
              />
            ))}
          </div>

          {/* 底部结算栏：固定视口底部，左边缘对齐侧边栏宽度（含折叠/抽屉态） */}
          <div className='fixed inset-x-4 bottom-3 z-20 flex flex-wrap items-center gap-3 rounded-lg border bg-card/95 p-3 shadow-sm backdrop-blur md:start-[calc(var(--sidebar-width)+1rem)] peer-data-[collapsible=icon]:md:start-[calc(var(--sidebar-width-icon)+1rem)] peer-data-[collapsible=offcanvas]:md:start-4'>
            <label className='flex cursor-pointer items-center gap-2 text-sm'>
              <Checkbox
                checked={checkedPositions.size === showLines.length && showLines.length > 0}
                onCheckedChange={toggleAll}
                aria-label='全选'
              />
              全选
            </label>
            <Button
              variant='ghost'
              size='sm'
              className='text-destructive hover:text-destructive'
              onClick={deleteChecked}
              disabled={checkedPositions.size === 0}
            >
              删除选中
            </Button>
            <span className='text-sm text-muted-foreground'>
              已选 <span className='font-medium text-foreground'>{checkedPositions.size}</span> 件
            </span>
            <div className='ml-auto flex items-center gap-3'>
              <p className='text-sm text-muted-foreground'>
                合计：
                <span className='text-lg font-bold text-primary'>
                  {currencyPrefix}
                  {formatMoney(totalPriceFromCache)}
                </span>
              </p>
              <Button onClick={goSettle} disabled={settling}>
                {settling ? '跳转中…' : '去结算'}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
