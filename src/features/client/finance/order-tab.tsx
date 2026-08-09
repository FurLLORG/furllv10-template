import { Fragment, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  Search as SearchIcon,
  X,
} from 'lucide-react'
import {
  batchDeleteOrders,
  combineOrders,
  deleteOrder,
  exportOrders,
  fetchOrderDetail,
  fetchOrders,
  type OrderItem,
} from '@/api/finance'
import { fetchCommon } from '@/api'
import { getErrorMessage, type ApiResponse } from '@/lib/api'
import { useClientLang } from '@/hooks/use-client-lang'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PaginationBar } from './pagination-bar'
import { formatMoney, formatTime } from './shared'

/**
 * 财务中心「订单记录」tab（对照官方 finance.php 订单记录 + finance.js）。
 * - 列表 GET /console/v1/order，树表子项 GET /order/:id 懒加载展开（order_item_count > 1）
 * - 合并支付 POST /order/combine、批量/单个删除 DELETE /order、导出 EXCEL /export_excel/order
 * - onPay / onUploadProof 由父级（财务中心页）接管支付弹窗与凭证弹窗
 */

export interface OrderTabProps {
  hasCombine: boolean
  onPay: (orderId: number) => void
  onUploadProof: (orderId: number) => void
}

const ORDER_TYPES = [
  { value: 'new', key: 'finance_text12', fallback: '新订单' },
  { value: 'renew', key: 'finance_text13', fallback: '续费订单' },
  { value: 'on_demand', key: 'demand_text5', fallback: '按需续费' },
  { value: 'upgrade', key: 'finance_text14', fallback: '升降级订单' },
  { value: 'artificial', key: 'finance_text15', fallback: '人工订单' },
  { value: 'recharge', key: 'finance_text16', fallback: '充值订单' },
  { value: 'change_billing_cycle', key: 'coin_text136', fallback: '按需转包年包月' },
]

const TIPS_LIST: Array<{
  color: string
  label: string
  fallback: string
  sub?: string
}> = [
  { color: '#0058FF', label: 'finance_text12', fallback: '新订单' },
  { color: '#3DD598', label: 'finance_text13', fallback: '续费订单', sub: 'demand_text5' },
  { color: '#F0142F', label: 'finance_text14', fallback: '升降级订单', sub: 'demand_text6' },
  { color: '#F99600', label: 'finance_text15', fallback: '人工订单' },
  { color: '#9C27B0', label: 'finance_text16', fallback: '充值订单' },
]

const DOT_COLORS: Record<string, string> = {
  new: '#0058FF',
  renew: '#3DD598',
  on_demand: '#3DD598',
  upgrade: '#F0142F',
  change_billing_cycle: '#F0142F',
  artificial: '#F99600',
  recharge: '#9C27B0',
}

/** 订单状态文案（官方 orderTypeObj.status 同款） */
const ORDER_STATUS_TEXT: Record<string, string> = {
  Unpaid: 'finance_text3',
  Paid: 'finance_text4',
  Refunded: 'finance_text17',
  WaitUpload: 'finance_custom1',
  WaitReview: 'finance_custom2',
  ReviewFail: 'finance_custom3',
}

/** 订单项/产品状态（官方 status 映射，host_status 用） */
const HOST_STATUS: Record<string, string> = {
  Unpaid: 'finance_text3',
  Pending: 'finance_text88',
  Active: 'finance_text89',
  Suspended: 'finance_text90',
  Deleted: 'finance_text91',
  Failed: 'finance_text92',
}

export function OrderTab({ hasCombine, onPay, onUploadProof }: OrderTabProps) {
  const { t } = useClientLang()
  const queryClient = useQueryClient()

  // 通用配置（复用 ClientLayout 缓存），取货币前缀/后缀
  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  const commonData = commonQuery.data?.data as Record<string, unknown> | undefined
  const currencyPrefix = (commonData?.currency_prefix as string) || ''
  const currencySuffix = (commonData?.currency_suffix as string) || ''

  // 列表筛选（官方 params1：page/limit/orderby/sort/keywords/status/type）
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [keyword, setKeyword] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState(
    () => new URLSearchParams(window.location.search).get('order_status') ?? ''
  )
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [expanded, setExpanded] = useState<Record<number, OrderItem[]>>({})
  const [deleteState, setDeleteState] = useState<
    { mode: 'single'; id: number } | { mode: 'batch' } | null
  >(null)
  const [deleting, setDeleting] = useState(false)
  const [combining, setCombining] = useState(false)
  const [exporting, setExporting] = useState(false)

  const listQuery = useQuery({
    queryKey: ['finance-orders', page, limit, appliedKeyword, status, type],
    queryFn: () =>
      fetchOrders({
        page,
        limit,
        keywords: appliedKeyword || undefined,
        status: status || undefined,
        type: type || undefined,
        orderby: 'id',
        sort: 'desc',
      }),
    retry: false,
    placeholderData: (prev) => prev,
  })
  const total = listQuery.data?.data.count ?? 0

  // 商品名称拼接（官方 getorderList：>2 取前两个 + 等N个商品，否则顿号拼接）
  const list = useMemo(() => {
    return (listQuery.data?.data.list ?? []).map((item) => {
      const names = item.product_names ?? []
      const productName =
        names.length > 2
          ? `${names[0]}、${names[1]} ${t('finance_text121', '等')}${names.length}${t(
              'finance_text122',
              '个商品'
            )}`
          : names.join('、')
      return { ...item, product_name: productName }
    })
  }, [listQuery.data, t])

  // 多选：仅非 Paid/Refunded 可选（官方 selectable）
  const selectable = (row: OrderItem) =>
    row.status !== 'Paid' && row.status !== 'Refunded'
  const pageSelectable = list.filter(selectable)
  const allSelected =
    pageSelectable.length > 0 && pageSelectable.every((r) => selectedIds.has(r.id))
  const someSelected = pageSelectable.some((r) => selectedIds.has(r.id))

  function toggleSelect(id: number, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleSelectAll(checked: boolean | 'indeterminate') {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const r of pageSelectable) {
        if (checked === true) next.add(r.id)
        else next.delete(r.id)
      }
      return next
    })
  }

  // 树形展开：懒加载子订单项（官方 load / showItem）
  async function toggleExpand(row: OrderItem) {
    if (!row.order_item_count || row.order_item_count <= 1) return
    if (expanded[row.id]) {
      setExpanded((prev) => {
        const next = { ...prev }
        delete next[row.id]
        return next
      })
      return
    }
    try {
      const res = await fetchOrderDetail(row.id)
      if (res.status === 200) {
        setExpanded((prev) => ({ ...prev, [row.id]: res.data.order.items ?? [] }))
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  function goOrderDetail(id: number) {
    window.location.href = `/orderDetail.htm?id=${id}`
  }

  // 合并支付（官方 handelAllPay）
  async function handleCombine() {
    if (selectedIds.size === 0) {
      toast.warning(t('finance_text134', '请勾选需要合并支付的订单！'))
      return
    }
    setCombining(true)
    try {
      const res = await combineOrders([...selectedIds])
      onPay(res.data.id)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setCombining(false)
    }
  }

  // 导出 EXCEL（官方 handelExport，blob 下载）
  async function handleExport() {
    setExporting(true)
    try {
      const blob = await exportOrders({
        page,
        limit,
        keywords: appliedKeyword || undefined,
        status: status || undefined,
        type: type || undefined,
        orderby: 'id',
        sort: 'desc',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'orders.xlsx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setExporting(false)
    }
  }

  function handleBatchDeleteClick() {
    if (selectedIds.size === 0) {
      toast.warning(t('finance_text147', '请勾选需要删除的订单！'))
      return
    }
    setDeleteState({ mode: 'batch' })
  }

  // 删除确认（官方 suerDelOrder / handelDeleteOrder / handelBatchDel）
  async function confirmDelete() {
    if (!deleteState) return
    setDeleting(true)
    try {
      if (deleteState.mode === 'single') {
        const { id } = deleteState
        const res = await deleteOrder(id)
        setSelectedIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        setExpanded((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        })
        queryClient.setQueryData<ApiResponse<{ list: OrderItem[]; count: number }>>(
          ['finance-orders', page, limit, appliedKeyword, status, type],
          (old) => {
            if (!old) return old
            return {
              ...old,
              data: {
                ...old.data,
                list: old.data.list.filter((item) => item.id !== id),
                count: Math.max(0, old.data.count - 1),
              },
            }
          }
        )
        toast.success(res.msg || t('finance_text133', '删除成功'))
      } else {
        const res = await batchDeleteOrders([...selectedIds])
        setSelectedIds(new Set())
        setExpanded({})
        listQuery.refetch()
        toast.success(res.msg || t('finance_text133', '删除成功'))
      }
      setDeleteState(null)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setDeleting(false)
    }
  }

  // 状态列（官方 el-tag 颜色 + host_status 兜底）
  function renderStatus(row: OrderItem) {
    switch (row.status) {
      case 'Unpaid':
        return (
          <Badge
            className='cursor-pointer border-transparent bg-red-500/10 text-red-500 hover:bg-red-500/15'
            onClick={() => onPay(row.id)}
          >
            {t('finance_text3', '未付款')}
          </Badge>
        )
      case 'Paid':
        return (
          <Badge className='border-transparent bg-green-500/10 text-green-600'>
            {t('finance_text4', '已付款')}
          </Badge>
        )
      case 'Refunded':
        return <Badge variant='secondary'>{t('finance_text17', '已退款')}</Badge>
      case 'WaitUpload':
      case 'WaitReview':
        return (
          <Badge className='border-transparent bg-amber-500/10 text-amber-600'>
            {t(ORDER_STATUS_TEXT[row.status], '')}
          </Badge>
        )
      case 'ReviewFail':
        return (
          <Badge className='border-transparent bg-red-500/10 text-red-500'>
            {t('finance_custom3', '未通过')}
          </Badge>
        )
      default: {
        if (row.host_status) {
          const key = HOST_STATUS[row.host_status]
          return <Badge variant='secondary'>{key ? t(key) : row.host_status}</Badge>
        }
        return <span className='text-muted-foreground'>--</span>
      }
    }
  }

  // 支付方式列（官方 gateway/credit 分支）
  function renderGateway(row: OrderItem) {
    if (!row.status) return <span className='text-muted-foreground'>--</span>
    if (row.gateway) {
      if ((row.credit ?? 0) > 0) {
        if (row.gateway_sign === 'credit') {
          return <span className='text-amber-600'>{t('finance_text5', '余额')}</span>
        }
        return (
          <span>
            <span className='text-amber-600'>{t('finance_text5', '余额')}</span>+
            {row.gateway}
          </span>
        )
      }
      return <span>{row.gateway}</span>
    }
    return <span className='text-muted-foreground'>--</span>
  }

  // 操作列（官方 operation-box：删除/去支付/上传/修改凭证 + Paid 查看凭证）
  function renderOperation(row: OrderItem) {
    const notPaid = row.status !== 'Paid' && row.status !== 'Refunded'
    const showVoucher = row.status === 'Paid' && (row.voucher?.length ?? 0) > 0
    if (!notPaid && !showVoucher) return null
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' size='icon' className='h-8 w-8'>
            <MoreHorizontal className='h-4 w-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          {notPaid && (
            <DropdownMenuItem
              variant='destructive'
              onClick={() => setDeleteState({ mode: 'single', id: row.id })}
            >
              {t('finance_btn4', '删除订单')}
            </DropdownMenuItem>
          )}
          {row.status === 'Unpaid' && (
            <DropdownMenuItem onClick={() => onPay(row.id)}>
              {t('finance_btn3', '去支付')}
            </DropdownMenuItem>
          )}
          {row.status === 'WaitUpload' && (
            <DropdownMenuItem onClick={() => onUploadProof(row.id)}>
              {t('finance_custom4', '上传凭证')}
            </DropdownMenuItem>
          )}
          {(row.status === 'WaitReview' || row.status === 'ReviewFail') && (
            <DropdownMenuItem onClick={() => onUploadProof(row.id)}>
              {t('finance_custom5', '重新上传')}
            </DropdownMenuItem>
          )}
          {showVoucher && (
            <DropdownMenuItem onClick={() => onUploadProof(row.id)}>
              {t('finance_custom19', '查看凭证')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // 子订单项状态（官方移动端 child-row）
  function renderChildStatus(child: OrderItem) {
    if (child.host_status) {
      const key = HOST_STATUS[child.host_status]
      return <span>{key ? t(key) : child.host_status}</span>
    }
    if (child.status) return <span>{t(ORDER_STATUS_TEXT[child.status] ?? '', child.status)}</span>
    return <span>--</span>
  }

  return (
    <div className='space-y-3'>
      {/* 工具栏：合并/删除/导出 + 图例 + 筛选 */}
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex flex-wrap items-center gap-2'>
          {hasCombine && (
            <Button size='sm' onClick={handleCombine} disabled={combining}>
              {combining && <Loader2 className='mr-1 h-3.5 w-3.5 animate-spin' />}
              {t('finance_btn10', '合并支付')}
            </Button>
          )}
          <Button size='sm' variant='destructive' onClick={handleBatchDeleteClick}>
            {t('batch_delete', '批量删除')}
          </Button>
          <Button
            size='sm'
            variant='outline'
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting && <Loader2 className='mr-1 h-3.5 w-3.5 animate-spin' />}
            {t('batch_export', '导出订单列表')}
          </Button>
          <div className='ml-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground'>
            {TIPS_LIST.map((item) => (
              <span key={item.color} className='inline-flex items-center gap-1.5'>
                <span className='size-2 rounded-full' style={{ background: item.color }} />
                {t(item.label, item.fallback)}
                {item.sub ? `/${t(item.sub)}` : ''}
              </span>
            ))}
          </div>
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          <Select
            value={type || 'all'}
            onValueChange={(v) => {
              setType(v === 'all' ? '' : v)
              setPage(1)
            }}
          >
            <SelectTrigger className='w-36'>
              <SelectValue placeholder={t('finance_label22', '订单类型')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>{t('finance_btn5', '全部')}</SelectItem>
              {ORDER_TYPES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {t(item.key, item.fallback)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status || 'all'}
            onValueChange={(v) => {
              setStatus(v === 'all' ? '' : v)
              setPage(1)
            }}
          >
            <SelectTrigger className='w-32'>
              <SelectValue placeholder={t('finance_label4', '状态')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>{t('finance_btn5', '全部')}</SelectItem>
              <SelectItem value='Unpaid'>{t('finance_text3', '未付款')}</SelectItem>
              <SelectItem value='Paid'>{t('finance_text4', '已付款')}</SelectItem>
            </SelectContent>
          </Select>
          <form
            className='relative'
            onSubmit={(e) => {
              e.preventDefault()
              setAppliedKeyword(keyword.trim())
              setPage(1)
            }}
          >
            <button
              type='submit'
              aria-label='搜索'
              className='absolute top-1/2 left-2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
            >
              <SearchIcon className='h-4 w-4' />
            </button>
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={t('cloud_tip_2', '请输入你需要搜索的内容')}
              className='h-9 w-56 bg-background pr-7 pl-9'
            />
            {keyword && (
              <button
                type='button'
                aria-label='清除搜索'
                onClick={() => {
                  setKeyword('')
                  setAppliedKeyword('')
                  setPage(1)
                }}
                className='absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
              >
                <X className='h-4 w-4' />
              </button>
            )}
          </form>
        </div>
      </div>

      {/* 订单表格 */}
      <div className='rounded-lg border bg-background'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-10'>
                <Checkbox
                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                  onCheckedChange={toggleSelectAll}
                  disabled={pageSelectable.length === 0}
                />
              </TableHead>
              <TableHead className='w-24'>ID</TableHead>
              <TableHead className='min-w-[260px]'>{t('finance_label1', '商品名称')}</TableHead>
              <TableHead className='w-40'>{t('finance_label2', '金额')}</TableHead>
              <TableHead className='w-44'>{t('finance_label3', '时间')}</TableHead>
              <TableHead className='w-28'>{t('finance_label4', '状态')}</TableHead>
              <TableHead className='w-40'>{t('finance_label5', '支付方式')}</TableHead>
              <TableHead className='w-24 text-end'>{t('finance_label6', '操作')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQuery.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={8}>
                    <Skeleton className='h-9 w-full' />
                  </TableCell>
                </TableRow>
              ))
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className='py-12 text-center text-sm text-muted-foreground'
                >
                  {t('order_text15', '暂无数据')}
                </TableCell>
              </TableRow>
            ) : (
              list.map((row) => {
                const isSelectable = selectable(row)
                const isChecked = selectedIds.has(row.id)
                const children = expanded[row.id] ?? []
                const expandable = (row.order_item_count ?? 0) > 1
                const hasProductName = !!row.product_names
                return (
                  <Fragment key={row.id}>
                    <TableRow data-state={isChecked ? 'selected' : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={isChecked}
                          disabled={!isSelectable}
                          onCheckedChange={(checked) =>
                            isSelectable && toggleSelect(row.id, checked === true)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {hasProductName ? (
                          <button
                            type='button'
                            className='cursor-pointer text-primary hover:underline'
                            onClick={() => goOrderDetail(row.id)}
                          >
                            {row.id}
                          </button>
                        ) : (
                          '--'
                        )}
                      </TableCell>
                      <TableCell>
                        <div className='flex items-center gap-1.5'>
                          {expandable && (
                            <button
                              type='button'
                              aria-label={children.length ? '收起' : '展开'}
                              className='text-muted-foreground hover:text-foreground'
                              onClick={() => toggleExpand(row)}
                            >
                              {children.length ? (
                                <ChevronDown className='size-4' />
                              ) : (
                                <ChevronRight className='size-4' />
                              )}
                            </button>
                          )}
                          <span
                            className='size-2 shrink-0 rounded-full'
                            style={{ background: DOT_COLORS[row.type] ?? '#0058FF' }}
                          />
                          {hasProductName ? (
                            <button
                              type='button'
                              className='max-w-[280px] cursor-pointer truncate text-left text-primary hover:underline'
                              title={row.product_name}
                              onClick={() => goOrderDetail(row.id)}
                            >
                              {row.product_name}
                            </button>
                          ) : (
                            <span className='text-muted-foreground'>{row.product_name || '--'}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {row.status === 'Unpaid' ? (
                          <button
                            type='button'
                            className='cursor-pointer text-primary hover:underline'
                            onClick={() => onPay(row.id)}
                          >
                            {currencyPrefix}
                            {formatMoney(row.amount)}
                            {row.billing_cycle ? `/${row.billing_cycle}` : ''}
                          </button>
                        ) : (
                          <span>
                            {currencyPrefix}
                            {formatMoney(row.amount)}
                            {row.billing_cycle ? `/${row.billing_cycle}` : ''}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{formatTime(row.create_time)}</TableCell>
                      <TableCell>{renderStatus(row)}</TableCell>
                      <TableCell>{renderGateway(row)}</TableCell>
                      <TableCell className='text-end'>{renderOperation(row)}</TableCell>
                    </TableRow>
                    {children.length > 0 &&
                      children.map((child) => (
                        <TableRow
                          key={`${row.id}-${child.id}`}
                          className='bg-muted/30 hover:bg-muted/40'
                        >
                          <TableCell colSpan={8} className='py-2 pl-14'>
                            <div className='flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground'>
                              <span
                                className='min-w-[200px] max-w-[40%] truncate'
                                title={child.product_name}
                              >
                                {child.product_name || '--'}
                              </span>
                              <span className='tabular-nums'>
                                {child.amount
                                  ? `${currencyPrefix}${formatMoney(child.amount)}${currencySuffix}${child.billing_cycle ? `/${child.billing_cycle}` : ''}`
                                  : '--'}
                              </span>
                              <span>{renderChildStatus(child)}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
        <div className='border-t px-2 py-1'>
          <PaginationBar
            page={page}
            limit={limit}
            total={total}
            onPageChange={setPage}
            onLimitChange={(l) => {
              setLimit(l)
              setPage(1)
            }}
          />
        </div>
      </div>

      {/* 删除确认（官方 delete-order-dialog） */}
      <AlertDialog
        open={deleteState !== null}
        onOpenChange={(open) => !open && setDeleteState(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteState?.mode === 'batch'
                ? t('batch_delete', '批量删除')
                : t('finance_btn4', '删除订单')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteState?.mode === 'batch'
                ? t('finance_text148', '确认批量删除这些订单？')
                : t('finance_text7', '确认删除该订单？')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {t('finance_btn7', '取消')}
            </AlertDialogCancel>
            <Button variant='destructive' onClick={confirmDelete} disabled={deleting}>
              {deleting && <Loader2 className='mr-1 h-3.5 w-3.5 animate-spin' />}
              {t('finance_btn8', '确认')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
