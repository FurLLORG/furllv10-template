import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Info } from 'lucide-react'
import { fetchAccount, fetchCommon } from '@/api'
import { useAddons } from '@/hooks/use-addons'
import { useClientLang } from '@/hooks/use-client-lang'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  fetchCoinCoupon,
  fetchFreezeRecords,
  fetchPendingRefundAmount,
  fetchWithdrawRule,
  type FreezeRecordItem,
} from '@/api/finance'
import { OrderTab } from './order-tab'
import { TransactionTab } from './transaction-tab'
import { BalanceTab } from './balance-tab'
import VoucherTab from './voucher-tab'
import CoinTab from './coin-tab'
import ContractTab from './contract-tab'
import CreditTab from './credit-tab'
import { PayDialog } from './pay-dialog'
import { ProofDialog } from './proof-dialog'
import { RechargeDialog } from './recharge-dialog'
import { WithdrawDialog } from './withdraw-dialog'
import { formatMoney, formatTime, navigateHref } from './shared'

type FinanceTab =
  | 'order'
  | 'transaction'
  | 'balance'
  | 'voucher'
  | 'contract'
  | 'credit'
  | 'coin'

/** 官方 finance.js getRule：订单记录有权限时默认 tab=订单记录 */
const DEFAULT_TAB: FinanceTab = 'order'

export function FinancePage() {
  const { t } = useClientLang()
  const { addons } = useAddons()
  const queryClient = useQueryClient()

  const pluginNames = useMemo(
    () => new Set(addons.map((a) => a.name.toLowerCase())),
    [addons]
  )
  const hasWithdraw = pluginNames.has('idcsmartwithdraw')
  const hasVoucher = pluginNames.has('idcsmartvoucher')
  const hasCombine = pluginNames.has('idcsmartordercombine')
  const hasContract = pluginNames.has('econtract')
  const hasRefund = pluginNames.has('idcsmartrefund')
  const hasCreditLimit = pluginNames.has('creditlimit')
  const hasCoin = pluginNames.has('coin')

  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  const commonData = useMemo(
    () => (commonQuery.data?.data ?? {}) as Record<string, unknown>,
    [commonQuery.data]
  )
  const currencyPrefix = String(commonData.currency_prefix ?? '')

  const accountQuery = useQuery({
    queryKey: ['client-account'],
    queryFn: fetchAccount,
    retry: false,
  })
  const account = accountQuery.data?.data.account
  const balance = Number(account?.credit ?? 0)
  const freezeCredit = Number(account?.freeze_credit ?? 0)
  const pendingAmount = Number(
    (account?.customfield as Record<string, unknown> | undefined)
      ?.pending_amount ?? 0
  )
  const canUseBalance = Math.max(0, balance - pendingAmount)

  // 待退款金额（IdcsmartRefund 插件）
  const unAmountQuery = useQuery({
    queryKey: ['finance-unamount'],
    queryFn: fetchPendingRefundAmount,
    enabled: hasRefund,
    retry: false,
  })
  const unAmount = unAmountQuery.data?.data.amount ?? 0

  // 平台币余额（Coin 插件）
  const coinQuery = useQuery({
    queryKey: ['finance-coin'],
    queryFn: fetchCoinCoupon,
    enabled: hasCoin,
    retry: false,
  })
  const coinData = coinQuery.data?.data ?? {}

  // 提现开关（IdcsmartWithdraw 插件）
  const withdrawQuery = useQuery({
    queryKey: ['finance-withdraw-rule'],
    queryFn: fetchWithdrawRule,
    enabled: hasWithdraw,
    retry: false,
  })
  const isOpenWithdraw =
    hasWithdraw && Number(withdrawQuery.data?.data.status ?? 0) === 1

  // 可用 tab（插件门控；订单/交易/余额始终可用）
  const availableTabs = useMemo<FinanceTab[]>(() => {
    const tabs: FinanceTab[] = ['order', 'transaction', 'balance']
    if (hasVoucher) tabs.push('voucher')
    if (hasContract) tabs.push('contract')
    if (hasCreditLimit) tabs.push('credit')
    if (hasCoin) tabs.push('coin')
    return tabs
  }, [hasVoucher, hasContract, hasCreditLimit, hasCoin])

  const [activeTab, setActiveTab] = useState<FinanceTab>(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab') as FinanceTab | null
    if (tab && tab in { order: 1, transaction: 1, balance: 1, voucher: 1, contract: 1, credit: 1, coin: 1 }) {
      return tab
    }
    try {
      const saved = sessionStorage.getItem('financeActiveIndex')
      if (saved && (saved in { order: 1, transaction: 1, balance: 1, voucher: 1, contract: 1, credit: 1, coin: 1 })) {
        return saved as FinanceTab
      }
    } catch {
      /* ignore */
    }
    return DEFAULT_TAB
  })

  // 当前 tab 不可见时回退第一个可用 tab
  const resolvedTab: FinanceTab = availableTabs.includes(activeTab)
    ? activeTab
    : (availableTabs[0] ?? 'order')

  // 页面标题
  useEffect(() => {
    const base = (commonData.website_name as string) || 'FurLL'
    document.title = `${base} - ${t('finance_text123', '财务管理')}`
  }, [commonData, t])

  // ---------- 弹窗状态 ----------
  const [payOrderId, setPayOrderId] = useState<number | null>(null)
  const [payAllowCredit, setPayAllowCredit] = useState(true)
  const [proofOrderId, setProofOrderId] = useState<number | null>(null)
  const [rechargeOpen, setRechargeOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [freezeOpen, setFreezeOpen] = useState(false)

  const openPay = (orderId: number, allowCredit = true) => {
    setPayAllowCredit(allowCredit)
    setPayOrderId(orderId)
  }

  function handlePaySuccess() {
    accountQuery.refetch()
    if (hasRefund) unAmountQuery.refetch()
    if (hasCoin) coinQuery.refetch()
    // 刷新各列表 tab（queryKey 前缀统一以 finance- 开头）
    queryClient.invalidateQueries({ queryKey: ['finance-'] })
    queryClient.invalidateQueries({ queryKey: ['voucher-'] })
    queryClient.invalidateQueries({ queryKey: ['credit-limit'] })
    queryClient.invalidateQueries({ queryKey: ['contract-list'] })
    queryClient.invalidateQueries({ queryKey: ['coin-'] })
  }

  const handleCoinChanged = () => {
    if (hasCoin) coinQuery.refetch()
  }

  const [freezeList, setFreezeList] = useState<FreezeRecordItem[]>([])
  const [freezeLoading, setFreezeLoading] = useState(false)
  const openFreeze = () => {
    setFreezeOpen(true)
    setFreezeLoading(true)
    fetchFreezeRecords()
      .then((res) => {
        if (res.status === 200) setFreezeList(res.data.list ?? [])
      })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setFreezeLoading(false))
  }

  return (
    <div className='space-y-4'>
      {/* 余额头部（官方 finance-top / finance-money-main） */}
      <Card>
        <CardContent className='p-5'>
          <div className='flex flex-wrap items-start justify-between gap-4'>
            <div className='min-w-[220px] space-y-3'>
              <div className='text-sm text-muted-foreground'>
                {t('finance_text135', '账户可用余额')}
                {pendingAmount > 0 ? (
                  <span>
                    （{t('finance_text140', '待处理')}
                    <span className='font-medium text-foreground'>
                      {currencyPrefix}
                      {formatMoney(pendingAmount)}
                    </span>
                    ）
                  </span>
                ) : null}
              </div>
              <div className='text-3xl font-bold tracking-tight'>
                <span className='mr-1 text-lg'>{currencyPrefix}</span>
                {formatMoney(balance)}
              </div>
              <div className='flex flex-wrap gap-2'>
                {Number(commonData.recharge_open ?? 0) === 1 ? (
                  <Button size='sm' onClick={() => setRechargeOpen(true)}>
                    {t('finance_btn1', '充值')}
                  </Button>
                ) : null}
                {isOpenWithdraw ? (
                  <>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => setWithdrawOpen(true)}
                    >
                      {t('finance_btn2', '提现')}
                    </Button>
                    <Button
                      size='sm'
                      variant='ghost'
                      onClick={() => {
                        navigateHref('/withdrawal.htm')
                      }}
                    >
                      {t('finance_btn9', '提现记录')}
                    </Button>
                  </>
                ) : null}
              </div>
            </div>

            {(unAmount > 0 ||
              freezeCredit > 0 ||
              (hasCoin && (coinData as { name?: string }).name)) ? (
              <div className='flex flex-wrap gap-3'>
                {unAmount > 0 ? (
                  <div className='rounded-lg bg-muted/60 px-4 py-2.5'>
                    <div className='text-xs text-muted-foreground'>
                      {t('finance_text2', '待退款金额')}
                    </div>
                    <div className='text-base font-semibold'>
                      {currencyPrefix}
                      {formatMoney(unAmount)}
                    </div>
                  </div>
                ) : null}
                {freezeCredit > 0 ? (
                  <div className='rounded-lg bg-muted/60 px-4 py-2.5'>
                    <div className='flex items-center gap-1 text-xs text-muted-foreground'>
                      {t('finance_text136', '冻结')}
                      <Info className='h-3 w-3' />
                    </div>
                    <div className='text-base font-semibold'>
                      {currencyPrefix}
                      {formatMoney(freezeCredit)}
                    </div>
                    <button
                      type='button'
                      className='mt-0.5 text-xs text-primary hover:underline'
                      onClick={openFreeze}
                    >
                      {t('finance_text141', '冻结记录')}
                    </button>
                  </div>
                ) : null}
                {hasCoin && (coinData as { name?: string }).name ? (
                  <div className='rounded-lg bg-muted/60 px-4 py-2.5'>
                    <div className='text-xs text-muted-foreground'>
                      {(coinData as { name?: string }).name}
                    </div>
                    <div className='text-base font-semibold'>
                      {currencyPrefix}
                      {formatMoney(
                        (coinData as { leave_amount?: string }).leave_amount
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* 列表 tabs */}
      <Card className='p-1 sm:p-4'>
        <Tabs
          value={resolvedTab}
          onValueChange={(v) => {
            setActiveTab(v as FinanceTab)
            sessionStorage.setItem('financeActiveIndex', v)
          }}
        >
          <div className='overflow-x-auto pb-1'>
            <TabsList className='w-full justify-start'>
              <TabsTrigger value='order'>
                {t('finance_tab1', '订单记录')}
              </TabsTrigger>
              <TabsTrigger value='transaction'>
                {t('finance_tab2', '交易记录')}
              </TabsTrigger>
              <TabsTrigger value='balance'>
                {t('finance_tab3', '余额记录')}
              </TabsTrigger>
              {hasVoucher ? (
                <TabsTrigger value='voucher'>
                  {t('finance_text22', '代金券')}
                </TabsTrigger>
              ) : null}
              {hasContract ? (
                <TabsTrigger value='contract'>
                  {t('finance_text23', '电子合同')}
                </TabsTrigger>
              ) : null}
              {hasCreditLimit ? (
                <TabsTrigger value='credit'>
                  {t('finance_text38', '信用额')}
                </TabsTrigger>
              ) : null}
              {hasCoin && (coinData as { name?: string }).name ? (
                <TabsTrigger value='coin'>
                  {(coinData as { name?: string }).name}
                </TabsTrigger>
              ) : null}
            </TabsList>
          </div>

          {accountQuery.isLoading ? (
            <div className='space-y-3 p-4'>
              <Skeleton className='h-9 w-full' />
              <Skeleton className='h-64 w-full' />
            </div>
          ) : (
            <>
              <TabsContent value='order' className='mt-4'>
                <OrderTab
                  hasCombine={hasCombine}
                  onPay={(id) => openPay(id)}
                  onUploadProof={(id) => setProofOrderId(id)}
                />
              </TabsContent>
              <TabsContent value='transaction' className='mt-4'>
                <TransactionTab />
              </TabsContent>
              <TabsContent value='balance' className='mt-4'>
                <BalanceTab />
              </TabsContent>
              {hasVoucher ? (
                <TabsContent value='voucher' className='mt-4'>
                  <VoucherTab />
                </TabsContent>
              ) : null}
              {hasContract ? (
                <TabsContent value='contract' className='mt-4'>
                  <ContractTab onPay={(id) => openPay(id)} />
                </TabsContent>
              ) : null}
              {hasCreditLimit ? (
                <TabsContent value='credit' className='mt-4'>
                  <CreditTab onPay={(id) => openPay(id, false)} />
                </TabsContent>
              ) : null}
              {hasCoin && (coinData as { name?: string }).name ? (
                <TabsContent value='coin' className='mt-4'>
                  <CoinTab onCoinChanged={handleCoinChanged} />
                </TabsContent>
              ) : null}
            </>
          )}
        </Tabs>
      </Card>

      {/* ---------- 弹窗 ---------- */}
      <PayDialog
        open={payOrderId !== null}
        orderId={payOrderId}
        allowCredit={payAllowCredit}
        onOpenChange={(open) => {
          if (!open) setPayOrderId(null)
        }}
        onPaySuccess={handlePaySuccess}
        onPayCancel={() => {
          setPayOrderId(null)
        }}
      />
      <ProofDialog
        open={proofOrderId !== null}
        orderId={proofOrderId}
        onOpenChange={(open) => {
          if (!open) setProofOrderId(null)
        }}
        onRefresh={(changed) => {
          if (changed) handlePaySuccess()
          else setProofOrderId(null)
        }}
      />
      <RechargeDialog
        open={rechargeOpen}
        onOpenChange={setRechargeOpen}
        onOpenPay={(id) => {
          setRechargeOpen(false)
          openPay(id)
        }}
      />
      <WithdrawDialog
        open={withdrawOpen}
        balance={canUseBalance}
        onOpenChange={setWithdrawOpen}
        onSuccess={() => {
          accountQuery.refetch()
          setWithdrawOpen(false)
        }}
      />

      {/* 冻结记录弹窗 */}
      <Dialog open={freezeOpen} onOpenChange={setFreezeOpen}>
        <DialogContent className='sm:max-w-3xl'>
          <DialogHeader>
            <DialogTitle>{t('finance_text141', '冻结记录')}</DialogTitle>
            <DialogDescription />
          </DialogHeader>
          <div className='max-h-[60vh] overflow-auto'>
            {freezeLoading ? (
              <div className='space-y-2 p-4'>
                <Skeleton className='h-8 w-full' />
                <Skeleton className='h-8 w-full' />
              </div>
            ) : freezeList.length === 0 ? (
              <div className='py-10 text-center text-sm text-muted-foreground'>
                {t('finance_text6', '没有更多数据了')}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>{t('finance_text143', '冻结金额')}</TableHead>
                    <TableHead>{t('finance_text142', '冻结时间')}</TableHead>
                    <TableHead>{t('finance_text144', '备注')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {freezeList.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.id}</TableCell>
                      <TableCell>
                        {currencyPrefix}
                        {formatMoney(item.amount)}
                      </TableCell>
                      <TableCell>{formatTime(item.create_time)}</TableCell>
                      <TableCell className='max-w-[200px] truncate'>
                        {item.client_notes || '--'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <div className='flex justify-end'>
            <Button variant='outline' onClick={() => setFreezeOpen(false)}>
              {t('finance_text86', '关闭')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
