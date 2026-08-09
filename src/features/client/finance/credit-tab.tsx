import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, MoreHorizontal, Wallet } from 'lucide-react'
import { fetchCommon } from '@/api'
import {
  fetchCreditLimit,
  fetchCreditLimitAccounts,
  fetchCreditLimitOrders,
  prepayCreditLimit,
  type CreditLimitAccountItem,
  type OrderItem,
} from '@/api/finance'
import { getErrorMessage } from '@/lib/api'
import { useClientLang } from '@/hooks/use-client-lang'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  formatDateYmd,
  formatMoney,
  formatTime,
  PaginationBar,
} from './shared'

interface CreditTabProps {
  /** 支付回调：出账订单 / 提前还款订单 → 父级打开支付弹窗 */
  onPay: (orderId: number) => void
}

interface StatusMeta {
  label: string
  color: string
  background: string
}

function StatusBadge({
  status,
  map,
}: {
  status?: string
  map: Record<string, StatusMeta>
}) {
  const st = status ? map[status] : undefined
  return (
    <Badge
      className='border-transparent font-medium'
      style={{
        color: st?.color ?? 'inherit',
        background: st?.background ?? 'transparent',
      }}
    >
      {st?.label ?? status ?? '--'}
    </Badge>
  )
}

/**
 * 财务中心-信用额（官方 finance.php 信用额 tab，CreditLimit 插件）。
 * 授信总额/剩余额度/本期账单待还三张卡 + 出账周期订单列表 + 消费记录 + 提前还款。
 */
export default function CreditTab({ onPay }: CreditTabProps) {
  const { t } = useClientLang()

  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  const commonData = (commonQuery.data?.data ?? {}) as Record<string, unknown>
  const currencyPrefix = String(commonData.currency_prefix ?? '')
  const currencySuffix = String(commonData.currency_suffix ?? '')

  // ---------- 授信详情 ----------
  const creditQuery = useQuery({
    queryKey: ['credit-limit'],
    queryFn: fetchCreditLimit,
    retry: false,
  })
  const creditData = creditQuery.data?.data.credit_limit
  const account = creditData?.account

  // ---------- 出账周期订单列表 ----------
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const accountsQuery = useQuery({
    queryKey: ['credit-limit-accounts', page, limit],
    queryFn: () => fetchCreditLimitAccounts({ page, limit }),
    retry: false,
  })
  const accounts = accountsQuery.data?.data.list ?? []
  const total = accountsQuery.data?.data.count ?? 0

  // ---------- 消费记录弹窗 ----------
  const [creditOrdersOpen, setCreditOrdersOpen] = useState(false)
  const [creditOrdersId, setCreditOrdersId] = useState(0)
  const [ordersPage, setOrdersPage] = useState(1)
  const [ordersLimit, setOrdersLimit] = useState(20)
  const ordersQuery = useQuery({
    queryKey: ['credit-limit-orders', creditOrdersId, ordersPage, ordersLimit],
    queryFn: () =>
      fetchCreditLimitOrders({
        id: creditOrdersId,
        page: ordersPage,
        limit: ordersLimit,
        orderby: 'id',
        sort: 'desc',
      }),
    enabled: creditOrdersOpen && creditOrdersId > 0,
    retry: false,
  })
  const orderList = ordersQuery.data?.data.list ?? []
  const orderTotal = ordersQuery.data?.data.count ?? 0

  function handelCredit(id: number) {
    setOrdersPage(1)
    setCreditOrdersId(id)
    setCreditOrdersOpen(true)
  }

  // ---------- 提前还款 ----------
  const [preData, setPreData] = useState<Partial<CreditLimitAccountItem> | null>(
    null
  )
  const [prepaying, setPrepaying] = useState(false)

  function handlePre(row?: Partial<CreditLimitAccountItem>) {
    if (!row) {
      row = accounts[0] ?? {}
    }
    setPreData(row)
  }

  async function submitPre() {
    if (prepaying) return
    setPrepaying(true)
    try {
      const res = await prepayCreditLimit()
      setPreData(null)
      const orderId = res.data.order_id
      if (orderId) onPay(orderId)
      toast.success(res.msg || '操作成功')
      creditQuery.refetch()
      accountsQuery.refetch()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setPrepaying(false)
    }
  }

  // 出账状态（官方 creditStatusObj）
  const creditStatusObj: Record<string, StatusMeta> = {
    Outstanding: {
      label: t('finance_text101', '未出账'),
      color: 'rgba(117, 117, 117, 1)',
      background: 'rgba(238, 238, 238, 1)',
    },
    Disbursed: {
      label: t('finance_text102', '已出账'),
      color: 'rgba(249, 150, 0, 1)',
      background: 'rgba(249, 150, 0, 0.12)',
    },
    Repaid: {
      label: t('finance_text103', '已还款'),
      color: 'rgba(61, 213, 152, 1)',
      background: 'rgba(61, 213, 152, 0.12)',
    },
    Overdue: {
      label: t('finance_text104', '已逾期'),
      color: 'rgba(240, 20, 47, 1)',
      background: 'rgba(240, 20, 47, 0.08)',
    },
  }

  // 信用额状态（官方 credit_status）
  const creditStatusText: Record<string, string> = {
    Expired: t('finance_text93', '已失效'),
    Overdue: t('finance_text94', '已逾期'),
    Active: t('finance_text95', '生效中'),
    Suspended: t('finance_text96', '已暂停'),
  }

  // 产品/订单状态（官方 status）
  const orderStatusObj: Record<string, string> = {
    Unpaid: t('finance_text3', '未付款'),
    Pending: t('finance_text88', '开通中'),
    Active: t('finance_text89', '使用中'),
    Suspended: t('finance_text90', '暂停'),
    Deleted: t('finance_text91', '删除'),
    Failed: t('finance_text92', '开通失败'),
  }

  // 消费记录弹窗：订单状态列（官方 Unpaid/Paid/Refunded tag + host_status 兜底）
  function orderStatusCell(item: OrderItem): React.ReactNode {
    if (item.status === 'Unpaid') {
      return (
        <Badge
          className='border-transparent font-medium'
          style={{ color: 'rgba(240, 20, 47, 1)', background: 'rgba(240, 20, 47, 0.08)' }}
        >
          {t('finance_text3', '未付款')}
        </Badge>
      )
    }
    if (item.status === 'Paid') {
      return (
        <Badge
          className='border-transparent font-medium'
          style={{ color: 'rgba(61, 213, 152, 1)', background: 'rgba(61, 213, 152, 0.12)' }}
        >
          {t('finance_text4', '已付款')}
        </Badge>
      )
    }
    if (item.status === 'Refunded') {
      return (
        <Badge
          className='border-transparent font-medium'
          style={{ color: 'rgba(117, 117, 117, 1)', background: 'rgba(238, 238, 238, 1)' }}
        >
          {t('finance_text17', '已退款')}
        </Badge>
      )
    }
    if (item.host_status) {
      return <span>{orderStatusObj[item.host_status] ?? item.host_status}</span>
    }
    if (item.status) {
      return <span>{item.status}</span>
    }
    return '--'
  }

  // 消费记录弹窗：支付方式列（余额/余额+网关/网关/--，官方 gateway 逻辑）
  function gatewayCell(item: OrderItem): string {
    if (!item.status) return '--'
    if (item.gateway) {
      const credit = Number(item.credit)
      if (credit > 0) {
        const allCredit = credit === Number(item.amount)
        return allCredit
          ? t('finance_text5', '余额')
          : `${t('finance_text5', '余额')}+${item.gateway}`
      }
      return item.gateway
    }
    return '--'
  }

  return (
    <div className='space-y-4'>
      {/* 顶部三张卡 */}
      {creditQuery.isLoading ? (
        <div className='grid gap-4 sm:grid-cols-3'>
          <Skeleton className='h-28 w-full' />
          <Skeleton className='h-28 w-full' />
          <Skeleton className='h-28 w-full' />
        </div>
      ) : creditQuery.error ? (
        <div className='rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground'>
          {getErrorMessage(creditQuery.error)}
          <div className='mt-3'>
            <Button variant='outline' size='sm' onClick={() => creditQuery.refetch()}>
              重试
            </Button>
          </div>
        </div>
      ) : (
        <div className='grid gap-4 sm:grid-cols-3'>
          {/* 授信总额 */}
          <div className='rounded-lg border bg-card p-4'>
            <div className='flex items-start justify-between gap-2'>
              <span className='text-sm text-muted-foreground'>
                {t('finance_text39', '授信总额')}({currencySuffix})
              </span>
              {creditData?.status === 'Active' || creditData?.status === 'Suspended' ? (
                <span className='text-xs text-muted-foreground'>
                  {formatDateYmd(creditData.end_time)}
                  {t('finance_text40', '到期')}
                </span>
              ) : (
                <span className='text-xs text-muted-foreground'>
                  {t('finance_credit1', '授信金额已失效')}
                </span>
              )}
            </div>
            <div className='mt-3 text-2xl font-bold'>
              {currencyPrefix}
              {formatMoney(creditData?.credit_limit)}
            </div>
          </div>
          {/* 剩余额度 */}
          <div className='rounded-lg border bg-card p-4'>
            <div className='flex items-start justify-between gap-2'>
              <span className='text-sm text-muted-foreground'>
                {t('finance_text41', '剩余额度')}({currencySuffix})
              </span>
              {creditData?.status && creditData.status !== 'Expired' ? (
                <Badge
                  className='border-transparent font-medium'
                  style={
                    creditData.status !== 'Active'
                      ? { color: 'rgba(117, 117, 117, 1)', background: 'rgba(238, 238, 238, 1)' }
                      : { color: 'rgba(61, 213, 152, 1)', background: 'rgba(61, 213, 152, 0.12)' }
                  }
                >
                  {creditStatusText[creditData.status] ?? creditData.status}
                </Badge>
              ) : null}
            </div>
            <div className='mt-3 text-2xl font-bold'>
              {currencyPrefix}
              {formatMoney(creditData?.remaining_amount)}
            </div>
          </div>
          {/* 本期账单待还 */}
          <div className='rounded-lg border bg-card p-4'>
            <div className='flex items-start justify-between gap-2'>
              <span className='text-sm text-muted-foreground'>
                {t('finance_text42', '本期账单待还')}({currencySuffix})
              </span>
              <div className='text-right text-xs text-muted-foreground'>
                <div>
                  {t('finance_text43', '全部待还')}：{currencyPrefix}
                  {formatMoney(creditData?.used)}
                </div>
                {account?.repayment_time ? (
                  <div>
                    {t('finance_text44', '还款截止')}：
                    {formatDateYmd(account.repayment_time)}
                  </div>
                ) : null}
              </div>
            </div>
            <div className='mt-3 flex flex-wrap items-center gap-2'>
              <span className='text-2xl font-bold'>
                {currencyPrefix}
                {account?.status === 'Repaid' ? '0.00' : formatMoney(account?.amount)}
              </span>
              <div className='ms-auto flex flex-wrap items-center gap-2'>
                {account?.status === 'Outstanding' ? (
                  <Button size='sm' variant='outline' disabled>
                    {t('finance_text45', '未出账')}
                  </Button>
                ) : null}
                {account?.status === 'Outstanding' && Number(account.amount) > 0 ? (
                  <Button size='sm' variant='outline' onClick={() => handlePre()}>
                    {t('finance_credit2', '提前还款')}
                  </Button>
                ) : null}
                {account?.status &&
                account.status !== 'Repaid' &&
                account.status !== 'Outstanding' ? (
                  <Button
                    size='sm'
                    onClick={() => account.order_id && onPay(account.order_id)}
                  >
                    {t('finance_text46', '立即还款')}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 出账周期订单列表 */}
      <div className='rounded-lg border bg-card'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('finance_text47', '出账周期')}</TableHead>
              <TableHead>{t('finance_text48', '消费额度')}</TableHead>
              <TableHead>{t('finance_label4', '状态')}</TableHead>
              <TableHead className='w-20 text-right'>
                {t('finance_label6', '操作')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accountsQuery.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4}>
                    <Skeleton className='h-6 w-full' />
                  </TableCell>
                </TableRow>
              ))
            ) : accountsQuery.error ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className='h-24 text-center text-sm text-muted-foreground'
                >
                  {getErrorMessage(accountsQuery.error)}
                </TableCell>
              </TableRow>
            ) : accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <div className='flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground'>
                    <Wallet className='h-8 w-8' />
                    <p>暂无出账记录</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              accounts.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {formatDateYmd(item.start_time)} - {formatDateYmd(item.end_time)}
                  </TableCell>
                  <TableCell>
                    {currencyPrefix}
                    {formatMoney(item.amount)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} map={creditStatusObj} />
                  </TableCell>
                  <TableCell className='text-right'>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant='ghost' size='icon' className='h-8 w-8'>
                          <MoreHorizontal className='h-4 w-4' />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align='end'>
                        <DropdownMenuItem onClick={() => handelCredit(item.id)}>
                          {t('finance_text49', '消费记录')}
                        </DropdownMenuItem>
                        {item.status === 'Outstanding' && Number(account?.amount) > 0 ? (
                          <DropdownMenuItem onClick={() => handlePre(item)}>
                            {t('finance_credit2', '提前还款')}
                          </DropdownMenuItem>
                        ) : null}
                        {item.status === 'Disbursed' || item.status === 'Overdue' ? (
                          <DropdownMenuItem
                            onClick={() => item.order_id && onPay(item.order_id)}
                          >
                            {t('finance_text50', '还款')}
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {!accountsQuery.isLoading && !accountsQuery.error ? (
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
        ) : null}
      </div>

      {/* 消费记录弹窗 */}
      <Dialog
        open={creditOrdersOpen}
        onOpenChange={(open) => !open && setCreditOrdersOpen(false)}
      >
        <DialogContent className='sm:max-w-3xl'>
          <DialogHeader>
            <DialogTitle>{t('finance_text84', '消费记录')}</DialogTitle>
          </DialogHeader>
          <div className='rounded-lg border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-20'>ID</TableHead>
                  <TableHead>{t('finance_label1', '商品名称')}</TableHead>
                  <TableHead>{t('finance_label2', '金额')}</TableHead>
                  <TableHead>{t('finance_text85', '支付时间')}</TableHead>
                  <TableHead>{t('finance_label4', '状态')}</TableHead>
                  <TableHead>{t('finance_label5', '支付方式')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordersQuery.isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}>
                        <Skeleton className='h-6 w-full' />
                      </TableCell>
                    </TableRow>
                  ))
                ) : ordersQuery.error ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className='h-24 text-center text-sm text-muted-foreground'
                    >
                      {getErrorMessage(ordersQuery.error)}
                    </TableCell>
                  </TableRow>
                ) : orderList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <div className='flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground'>
                        <Wallet className='h-8 w-8' />
                        <p>暂无消费记录</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  orderList.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.product_names ? item.id : '--'}</TableCell>
                      <TableCell className='max-w-xs truncate'>
                        {item.product_name ?? '--'}
                      </TableCell>
                      <TableCell>
                        {currencyPrefix}
                        {formatMoney(item.amount)}
                        {item.billing_cycle ? `/${item.billing_cycle}` : ''}
                      </TableCell>
                      <TableCell>{formatTime(item.pay_time)}</TableCell>
                      <TableCell>{orderStatusCell(item)}</TableCell>
                      <TableCell>{gatewayCell(item)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {!ordersQuery.isLoading && !ordersQuery.error ? (
              <div className='border-t px-2 py-1'>
                <PaginationBar
                  page={ordersPage}
                  limit={ordersLimit}
                  total={orderTotal}
                  onPageChange={setOrdersPage}
                  onLimitChange={(l) => {
                    setOrdersLimit(l)
                    setOrdersPage(1)
                  }}
                />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setCreditOrdersOpen(false)}>
              {t('finance_text86', '关闭')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 提前还款确认弹窗 */}
      <Dialog
        open={preData != null}
        onOpenChange={(open) => !open && setPreData(null)}
      >
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>{t('finance_credit2', '提前还款')}</DialogTitle>
            <DialogDescription>{t('finance_credit3', '确认提前还款？')}</DialogDescription>
          </DialogHeader>
          <div className='rounded-md bg-muted/60 p-3 text-sm'>
            <p className='flex gap-2'>
              <span className='shrink-0 text-muted-foreground'>
                {t('finance_credit4', '账单周期')}：
              </span>
              <span>
                {formatDateYmd(preData?.start_time)} - {formatDateYmd(preData?.end_time)}
              </span>
            </p>
            <p className='mt-1 flex gap-2'>
              <span className='shrink-0 text-muted-foreground'>
                {t('finance_credit5', '提前还款金额')}：
              </span>
              <span>
                {currencyPrefix}
                {formatMoney(preData?.amount)}
              </span>
            </p>
          </div>
          <DialogFooter>
            <Button onClick={submitPre} disabled={prepaying}>
              {prepaying ? <Loader2 className='mr-1 h-4 w-4 animate-spin' /> : null}
              {t('finance_btn8', '确认')}
            </Button>
            <Button variant='outline' onClick={() => setPreData(null)}>
              {t('finance_text58', '关闭')}
            </Button>
          </DialogFooter>
          <p className='text-xs text-muted-foreground'>
            {t('finance_credit6', '提前还款订单超过一天未支付将自动删除')}
          </p>
        </DialogContent>
      </Dialog>
    </div>
  )
}
