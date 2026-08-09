/* eslint-disable react-hooks/refs -- PayFlow 用 ref+commit() 复刻官方命令式 data 模型：
   所有 flow.current 写操作均以 commit()（setTick）收尾强制重渲染，渲染期读 ref 安全 */
/* eslint-disable react-hooks/set-state-in-effect -- 弹窗 open 时同步初始化/重置是合法的挂载副作用 */
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Copy, Loader2, X } from 'lucide-react'
import {
  applyCoin as applyCoinApi,
  applyVoucher as applyVoucherApi,
  fetchCoinCoupon,
  fetchCoinPayList,
  fetchCreditLimit,
  fetchGateway,
  fetchOrderDetail,
  fetchPayStatus,
  fetchVoucherPayList,
  payCreditLimit,
  payOrder,
  submitApplication,
  submitCreditUse,
  type CoinClientCouponData,
  type CoinItem,
  type CreditLimitData,
  type GatewayItem,
  type OrderDetail,
  type VoucherItem,
} from '@/api/finance'
import { fetchAccount, fetchCommon } from '@/api'
import { getErrorMessage } from '@/lib/api'
import { installedAddons } from '@/lib/addons'
import { useClientLang } from '@/hooks/use-client-lang'
import { formatMoney, formatTime } from '@/features/client/finance/shared'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ProofDialog } from '@/features/client/finance/proof-dialog'

export interface PayDialogProps {
  open: boolean
  orderId: number | null
  /** 是否允许使用信用额（默认 true） */
  allowCredit?: boolean
  onOpenChange: (open: boolean) => void
  onPaySuccess: (orderId: number) => void
  onPayCancel: (orderId: number) => void
}

/** 支付流程可变状态（官方 zfData/orderData 等 data 字段的同步等价物，ref 承载 + commit 刷新渲染） */
interface PayFlow {
  orderId: number
  amount: number
  checked: boolean
  gateway: string
  gatewayList: GatewayItem[]
  balance: number
  isShowPay: boolean
  payHtml: string
  payLoading: boolean
  priceLoading: boolean
  getWayLoading: boolean
  creditData: CreditLimitData | null
  isShowCredit: boolean
  isCz: boolean
  isPaySuccess: boolean
  isTransfer: boolean
  useCoin: boolean
  auto: boolean
  coinCouponIds: number[]
  coinCouponsCount: number
  coinAmount: number
  showCoin: boolean
  coinName: string
  coinClientInfo: CoinClientCouponData
  showCoupon: boolean
  selectedCouponId: string
  couponList: VoucherItem[]
  couponListLoading: boolean
  voucherAmount: number
  remainPayTime: number
  time: number
  orderData: OrderDetail | null
  orderCustomfields: Record<string, unknown>
  doPayLoading: boolean
  submitLoading: boolean
}

/** 可同时使用平台币/代金券的订单类型 */
const CAN_USE_COIN_ORDER_TYPE = ['renew', 'upgrade', 'new', 'change_billing_cycle']

function makeFlow(): PayFlow {
  return {
    orderId: 0,
    amount: 0,
    checked: false,
    gateway: '',
    gatewayList: [],
    balance: 0,
    isShowPay: false,
    payHtml: '',
    payLoading: false,
    priceLoading: false,
    getWayLoading: false,
    creditData: null,
    isShowCredit: false,
    isCz: false,
    isPaySuccess: false,
    isTransfer: false,
    useCoin: false,
    auto: false,
    coinCouponIds: [],
    coinCouponsCount: 0,
    coinAmount: 0,
    showCoin: false,
    coinName: '',
    coinClientInfo: {},
    showCoupon: false,
    selectedCouponId: '',
    couponList: [],
    couponListLoading: false,
    voucherAmount: 0,
    remainPayTime: 0,
    time: 300000,
    orderData: null,
    orderCustomfields: {},
    doPayLoading: false,
    submitLoading: false,
  }
}

/** 选择平台币子弹窗（官方 selectCoin 组件） */
function CoinSelectDialog({
  open,
  orderId,
  coinName,
  auto,
  coinCouponIds,
  currencyPrefix,
  onConfirm,
  onClose,
}: {
  open: boolean
  orderId: number
  coinName: string
  auto: boolean
  coinCouponIds: number[]
  currencyPrefix: string
  onConfirm: (data: { auto: boolean; coin_coupon_ids: number[] }) => void
  onClose: () => void
}) {
  const { t } = useClientLang()
  const [coinList, setCoinList] = useState<CoinItem[]>([])
  const [loading, setLoading] = useState(false)
  const [autoFlag, setAutoFlag] = useState(auto)
  const [ids, setIds] = useState<number[]>(coinCouponIds)
  const [coinAmount, setCoinAmount] = useState(0)
  const [coinCouponsCount, setCoinCouponsCount] = useState(0)
  const [discounts, setDiscounts] = useState<Record<number, number>>({})

  async function doApplyCoin(
    nextAuto: boolean,
    nextIds: number[],
    list: CoinItem[]
  ) {
    try {
      const res = await applyCoinApi({
        order_id: orderId,
        use: nextAuto || nextIds.length > 0 ? 1 : 0,
        auto: Number(nextAuto),
        coin_coupon_ids: nextIds,
      })
      setCoinAmount(Number(res.data?.coin_amount ?? 0))
      setCoinCouponsCount(Number(res.data?.coin_coupons_count ?? 0))
      const map: Record<number, number> = {}
      for (const item of list) {
        map[item.id] = 0
      }
      res.data?.coin_coupons?.forEach((coin) => {
        if (coin.rel_id != null && map[coin.rel_id] != null) {
          map[coin.rel_id] = map[coin.rel_id] + Math.abs(Number(coin.amount))
        }
      })
      setDiscounts(map)
    } catch (error) {
      setCoinAmount(0)
      setCoinCouponsCount(0)
      toast.error(getErrorMessage(error))
    }
  }

  async function init() {
    setLoading(true)
    try {
      const res = await fetchCoinPayList({ order_id: orderId })
      const list = (res.data?.list ?? []).map((item) => ({
        ...item,
        discount_amount: 0,
      }))
      setCoinList(list)
      await doApplyCoin(auto, coinCouponIds, list)
    } catch {
      setCoinList([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    setCoinList([])
    setDiscounts({})
    setCoinAmount(0)
    setCoinCouponsCount(0)
    setAutoFlag(auto)
    setIds(coinCouponIds)
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderId])

  async function handleAutoChange(val: boolean) {
    setAutoFlag(val)
    const nextIds = val ? coinList.map((item) => item.id) : []
    setIds(nextIds)
    await doApplyCoin(val, nextIds, coinList)
  }

  async function toggleCoin(id: number, checked: boolean) {
    const nextIds = checked
      ? [...ids, id]
      : ids.filter((item) => item !== id)
    setIds(nextIds)
    await doApplyCoin(autoFlag, nextIds, coinList)
  }

  function handleClose() {
    onConfirm({ auto: autoFlag, coin_coupon_ids: ids })
    onClose()
  }

  const coinNameShow = coinName || t('coin_text43', '平台币')

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader className='flex flex-row items-center justify-between'>
          <DialogTitle>
            {t('coin_text32', '选择')}
            {coinNameShow}
          </DialogTitle>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='h-6 w-6'
            onClick={handleClose}
            aria-label='关闭'
          >
            <X className='h-4 w-4' />
          </Button>
        </DialogHeader>
        <div className='space-y-3'>
          {loading && (
            <div className='flex justify-center py-8'>
              <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
            </div>
          )}
          {!loading && coinList.length > 0 && (
            <>
              <div className='flex flex-wrap items-center gap-2 text-sm'>
                <span className='text-muted-foreground'>
                  {t('coin_text33', '使用')}
                  {coinNameShow}（{t('coin_text34', '总抵扣金额')}：
                  <span className='text-foreground'>
                    {currencyPrefix}
                    {coinAmount}
                  </span>
                  ，{t('coin_text35', '已选')}
                  {autoFlag ? coinCouponsCount : ids.length}
                  {t('coin_text36', '张')},{t('coin_text37', '可使用')}
                  <span>{coinList.length}</span>
                  {t('coin_text36', '张')}）
                </span>
              </div>
              <div className='flex items-center gap-2 text-sm'>
                <Checkbox
                  checked={autoFlag}
                  onCheckedChange={(v) => handleAutoChange(!!v)}
                />
                <span>{t('coin_text38', '自动选择')}</span>
              </div>
            </>
          )}
          {!loading && coinList.length === 0 && (
            <p className='py-6 text-center text-sm text-muted-foreground'>
              {t('coin_text41', '暂无可用')}
              {coinNameShow}
            </p>
          )}
          <div className='max-h-72 space-y-2 overflow-y-auto pr-1'>
            {coinList.map((item) => {
              const discount = discounts[item.id] ?? 0
              const selected =
                autoFlag || ids.includes(item.id)
              return (
                <div
                  key={item.id}
                  className='flex items-start justify-between gap-3 rounded-md border p-3'
                >
                  <div className='min-w-0 space-y-1'>
                    <div className='text-base font-semibold tabular-nums'>
                      {item.leave_amount != null
                        ? String(item.leave_amount).split('.')[0]
                        : ''}
                      {item.leave_amount != null &&
                      String(item.leave_amount).split('.')[1]
                        ? `.${String(item.leave_amount).split('.')[1]}`
                        : ''}
                    </div>
                    <div className='text-sm'>{item.name}</div>
                    {discount > 0 && selected && (
                      <div className='text-sm text-primary'>
                        {t('coin_text39', '抵扣金额')}：{currencyPrefix}
                        {discount.toFixed(2)}
                      </div>
                    )}
                    <div className='text-xs text-muted-foreground'>
                      {t('coin_text40', '有效期')}：
                      {item.effective_start_time
                        ? `${formatTime(item.effective_start_time)} - ${formatTime(item.effective_end_time)}`
                        : t('voucher_effective', '长期有效')}
                    </div>
                  </div>
                  {!autoFlag && (
                    <Checkbox
                      checked={ids.includes(item.id)}
                      onCheckedChange={(v) => toggleCoin(item.id, !!v)}
                      aria-label={item.name}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleClose}>
            {t('coin_text42', '返回支付')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** 通用支付弹窗（官方 payDialog 组件） */
export function PayDialog({
  open,
  orderId,
  allowCredit = true,
  onOpenChange,
  onPaySuccess,
  onPayCancel,
}: PayDialogProps) {
  const { t } = useClientLang()
  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  const commonData = (commonQuery.data?.data ?? {}) as Record<string, unknown>
  const currencyPrefix = (commonData.currency_prefix as string) ?? '¥'
  const currencyCode = (commonData.currency_code as string) ?? ''

  const flow = useRef<PayFlow>(makeFlow())
  const [, setTick] = useState(0)
  const commit = () => setTick((x) => x + 1)

  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [proofMode, setProofMode] = useState(false)
  const [proofOpen, setProofOpen] = useState(false)
  const [coinDialogOpen, setCoinDialogOpen] = useState(false)

  const propsRef = useRef({ allowCredit, onOpenChange, onPaySuccess, onPayCancel })
  propsRef.current = { allowCredit, onOpenChange, onPaySuccess, onPayCancel }

  function clearPolling() {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current)
      pollingTimerRef.current = null
    }
  }

  function clearCountdown() {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
  }

  /** 关闭（官方 zfClose：非成功/非转账时 emit paycancel；勾选了余额则取消使用余额） */
  function closeDialog(emitCancel: boolean) {
    clearPolling()
    clearCountdown()
    const f = flow.current
    if (emitCancel && !f.isPaySuccess && !f.isTransfer) {
      propsRef.current.onPayCancel(f.orderId)
    }
    if (f.checked && !f.isPaySuccess) {
      f.checked = false
      if (!f.isCz) {
        submitCreditUse({ id: f.orderId, use: 0 }).catch(() => {})
      }
    }
    f.isCz = false
    f.isTransfer = false
    f.isShowPay = false
    f.isPaySuccess = false
    setProofMode(false)
    setProofOpen(false)
    setCoinDialogOpen(false)
    propsRef.current.onOpenChange(false)
    commit()
  }

  function formatRemainTime(seconds: number): string {
    if (!seconds || seconds <= 0) return ''
    const year = Math.floor(seconds / (365 * 24 * 3600))
    const month = Math.floor((seconds % (365 * 24 * 3600)) / (30 * 24 * 3600))
    const day = Math.floor((seconds % (30 * 24 * 3600)) / (24 * 3600))
    const hour = Math.floor((seconds % (24 * 3600)) / 3600)
    const minute = Math.floor((seconds % 3600) / 60)
    const second = seconds % 60
    const parts: string[] = []
    if (year > 0) parts.push(`${year}${t('coin_text139', '年')}`)
    if (month > 0) parts.push(`${month}${t('coin_text140', '月')}`)
    if (day > 0) parts.push(`${day}${t('coin_text141', '日')}`)
    if (hour > 0) parts.push(`${hour}${t('coin_text142', '时')}`)
    if (minute > 0) parts.push(`${minute}${t('coin_text143', '分')}`)
    if (second > 0) parts.push(`${second}${t('coin_text144', '秒')}`)
    return parts.join('')
  }

  function calcPayAmount(): string {
    const balance = flow.current.checked ? Number(flow.current.balance) : 0
    const showAmount = Number(flow.current.amount) - balance
    if (
      flow.current.gateway === 'credit' ||
      flow.current.gateway === 'CreditLimit'
    ) {
      return Number(flow.current.amount).toFixed(2)
    }
    return showAmount <= 0 ? '0.00' : showAmount.toFixed(2)
  }

  function calcShowOriginAmount(): string {
    return (
      Number(flow.current.amount) + Number(flow.current.coinAmount)
    ).toFixed(2)
  }

  // ---------- 支付方式 ----------

  async function getGateway() {
    flow.current.getWayLoading = true
    commit()
    try {
      const res = await fetchGateway()
      if (res.status === 200) {
        flow.current.gatewayList = res.data.list
        flow.current.gateway = res.data.list[0]?.name ?? ''
        commit()
      }
    } catch {
      flow.current.gatewayList = []
    }
    flow.current.getWayLoading = false
    commit()
  }

  async function getCreditDetail() {
    try {
      const res = await fetchCreditLimit()
      if (res.status === 200) {
        flow.current.creditData = res.data.credit_limit
        if (
          res.data.credit_limit.status === 'Active' &&
          Number(res.data.credit_limit.remaining_amount) > 0
        ) {
          flow.current.gatewayList.unshift({
            id: '1411373683',
            name: 'CreditLimit',
            title: t('pay_text18', '信用支付'),
          })
          commit()
        }
      }
    } catch {
      // 信用额详情失败忽略
    }
  }

  function addCreditGateway() {
    if (
      flow.current.balance >= flow.current.amount &&
      flow.current.balance > 0
    ) {
      flow.current.gatewayList.unshift({
        id: 0,
        name: 'credit',
        title: t('order_text8', '余额支付'),
      })
      commit()
    }
  }

  async function handleGatewaySelection() {
    if (!flow.current.isCz) {
      const res = await fetchAccount()
      if (res.status === 200) {
        flow.current.balance = Number(res.data.account.credit ?? 0)
        commit()
        if (flow.current.orderCustomfields?.is_pre_invoice !== 1) {
          addCreditGateway()
        }
      }
    }
    if (flow.current.isShowCredit && propsRef.current.allowCredit && !flow.current.isCz) {
      await getCreditDetail()
    }
    flow.current.gateway = flow.current.gatewayList[0]?.name ?? ''
    if (flow.current.gateway === 'CreditLimit') {
      const isExceedLimit =
        flow.current.amount > Number(flow.current.creditData?.remaining_amount ?? 0)
      if (isExceedLimit) {
        flow.current.gateway = flow.current.gatewayList[1]?.name ?? ''
      }
    }
    if (
      flow.current.balance > 0 &&
      flow.current.orderCustomfields?.is_pre_invoice !== 1
    ) {
      flow.current.checked = true
    }
    commit()
  }

  // ---------- 支付核心 ----------

  function pollingStatus(id: number) {
    clearPolling()
    flow.current.time = 300000
    pollingTimerRef.current = setInterval(async () => {
      try {
        const res = await fetchPayStatus(id)
        flow.current.time = flow.current.time - 2000
        if (res.code === 'Paid') {
          clearPolling()
          flow.current.time = 300000
          toast.success(res.msg || t('coin_text63', '订单已支付'))
          flow.current.isPaySuccess = true
          propsRef.current.onPaySuccess(flow.current.orderId)
          closeDialog(false)
          return
        }
        if (flow.current.time <= 0) {
          clearPolling()
          toast.error(t('pay_text20', '支付超时'))
          closeDialog(false)
        }
      } catch {
        // 单次轮询失败忽略，继续轮询
      }
    }, 2000)
  }

  async function zfSelectChange() {
    clearPolling()
    try {
      if (flow.current.gateway === 'credit' && flow.current.balance > 0) {
        flow.current.checked = true
        flow.current.isShowPay = false
        commit()
        return
      }
      if (flow.current.gateway === 'CreditLimit') {
        flow.current.checked = false
        flow.current.isShowPay = false
        commit()
        return
      }
      if (flow.current.amount === 0) {
        flow.current.isShowPay = false
        commit()
        return
      }
      const balance = Number(flow.current.balance)
      const money = Number(flow.current.amount)
      if (balance >= money && flow.current.checked) {
        flow.current.isShowPay = false
        commit()
        return
      }
      if (!flow.current.isCz) {
        await submitCreditUse({
          id: flow.current.orderId,
          use: flow.current.checked && balance > 0 ? 1 : 0,
        })
      }
      flow.current.priceLoading = true
      flow.current.isShowPay = true
      flow.current.payHtml = ''
      flow.current.payLoading = true
      commit()
      const res = await payOrder({
        gateway: flow.current.gateway,
        id: flow.current.orderId,
      })
      flow.current.payLoading = false
      flow.current.payHtml = res.data?.html ?? ''
      flow.current.priceLoading = false
      commit()
      if (flow.current.gateway !== 'UserCustom') {
        pollingStatus(flow.current.orderId)
      }
    } catch (error) {
      flow.current.priceLoading = false
      flow.current.payLoading = false
      flow.current.isShowPay = false
      commit()
      toast.error(getErrorMessage(error))
    }
  }

  async function handleCheckChange(checked: boolean) {
    flow.current.checked = checked
    commit()
    await zfSelectChange()
  }

  function handelSelect(item: GatewayItem) {
    if (flow.current.gateway === item.name) return
    if (
      item.name === 'CreditLimit' &&
      flow.current.amount > Number(flow.current.creditData?.remaining_amount ?? 0)
    ) {
      toast.error(t('pay_text16', '信用额不够！'))
      flow.current.gateway =
        flow.current.gatewayList.find((g) => g.name !== 'CreditLimit')?.name ?? ''
      commit()
      return
    }
    if (flow.current.gateway === 'CreditLimit' && flow.current.balance > 0) {
      flow.current.checked = true
    }
    if (item.name === 'CreditLimit') {
      flow.current.checked = false
    }
    flow.current.gateway = item.name
    commit()
    zfSelectChange()
  }

  // ---------- 确认支付 / 线下支付 ----------

  async function handleOk() {
    flow.current.doPayLoading = true
    commit()
    try {
      const gateway =
        flow.current.checked || flow.current.amount === 0
          ? 'credit'
          : 'CreditLimit'
      const res =
        flow.current.gateway === 'CreditLimit'
          ? await payCreditLimit({ gateway, id: flow.current.orderId })
          : await payOrder({ gateway, id: flow.current.orderId })
      toast.success(res.msg || t('coin_text63', '订单已支付'))
      flow.current.doPayLoading = false
      flow.current.isPaySuccess = true
      propsRef.current.onPaySuccess(flow.current.orderId)
      closeDialog(false)
    } catch (error) {
      flow.current.doPayLoading = false
      commit()
      toast.error(getErrorMessage(error))
    }
  }

  async function handleCustom() {
    flow.current.submitLoading = true
    commit()
    try {
      const res = await submitApplication(flow.current.orderId)
      toast.success(res.msg || t('finance_custom4', '上传凭证'))
      flow.current.submitLoading = false
      flow.current.isTransfer = true
      setProofOpen(true)
      commit()
    } catch (error) {
      flow.current.submitLoading = false
      commit()
      toast.error(getErrorMessage(error))
    }
  }

  function copyText(text: string) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
      toast.success(t('pay_text17', '复制成功'))
      return
    }
    const textArea = document.createElement('textarea')
    textArea.value = text
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    try {
      document.execCommand('copy')
      toast.success(t('pay_text17', '复制成功'))
    } catch {
      // 忽略复制失败
    }
    textArea.remove()
  }

  // ---------- 代金券 ----------

  async function getVoucherList() {
    flow.current.couponListLoading = true
    commit()
    try {
      const res = await fetchVoucherPayList({ order_id: flow.current.orderId })
      if (res.status === 200) {
        flow.current.couponList = res.data.list ?? []
        const usedVoucher = flow.current.couponList.find(
          (item) => item.is_applied === 1
        )
        if (usedVoucher) {
          flow.current.selectedCouponId = String(usedVoucher.id)
        }
      }
    } catch {
      flow.current.couponList = []
    } finally {
      flow.current.couponListLoading = false
      commit()
    }
  }

  async function applyVoucher(
    voucherGetId = '',
    auto = 0,
    isInit = false
  ) {
    try {
      flow.current.priceLoading = true
      commit()
      const res = await applyVoucherApi({
        order_id: flow.current.orderId,
        use: voucherGetId !== '' || auto === 1 ? 1 : 0,
        auto,
        voucher_get_id: voucherGetId,
      })
      flow.current.voucherAmount = Number(res.data?.voucher_amount ?? 0)
      if (res.data?.voucher_get_id) {
        flow.current.selectedCouponId = res.data.voucher_get_id
      }
      const detailRes = await fetchOrderDetail(flow.current.orderId)
      flow.current.amount = Number(detailRes.data.order.amount)
      flow.current.priceLoading = false
      commit()
      if (!isInit) {
        await zfSelectChange()
      }
    } catch (error) {
      flow.current.priceLoading = false
      flow.current.voucherAmount = 0
      commit()
      toast.error(getErrorMessage(error))
      if (!isInit) {
        await zfSelectChange()
      }
    }
  }

  function handleVoucherChange(value: string) {
    if (value) {
      applyVoucher(value, 0)
    } else {
      applyVoucher('', 0)
    }
  }

  function formatLabel(item: VoucherItem): string {
    if (
      String(item.id) === flow.current.selectedCouponId &&
      flow.current.voucherAmount > 0
    ) {
      return `${item.code} (${t('shoppingCar_tip_text16', '已抵扣')} ${currencyPrefix}${Number(flow.current.voucherAmount).toFixed(2)})`
    }
    return item.code
  }

  // ---------- 平台币 ----------

  async function getCoinInfo() {
    try {
      const res = await fetchCoinCoupon()
      if (res.status === 200) {
        flow.current.coinName = res.data.name ?? t('coin_text43', '平台币')
        flow.current.coinClientInfo = res.data
        commit()
      }
    } catch {
      // 忽略
    }
  }

  async function applyCoin(isInit = false) {
    try {
      flow.current.priceLoading = true
      commit()
      const res = await applyCoinApi({
        order_id: flow.current.orderId,
        use: Number(flow.current.useCoin),
        auto: Number(flow.current.auto),
        coin_coupon_ids: flow.current.coinCouponIds,
      })
      flow.current.coinAmount = Number(res.data?.coin_amount ?? 0)
      flow.current.coinCouponsCount = Number(res.data?.coin_coupons_count ?? 0)
      const detailRes = await fetchOrderDetail(flow.current.orderId)
      flow.current.amount = Number(detailRes.data.order.amount)
      flow.current.priceLoading = false
      commit()
      if (!isInit) {
        await zfSelectChange()
      }
    } catch (error) {
      flow.current.priceLoading = false
      flow.current.coinAmount = 0
      flow.current.coinCouponsCount = 0
      commit()
      toast.error(getErrorMessage(error))
      if (!isInit) {
        await zfSelectChange()
      }
    }
  }

  async function checkUseCoin(val: boolean) {
    if (val) {
      flow.current.auto = true
    } else {
      flow.current.auto = false
      flow.current.coinCouponIds = []
    }
    commit()
    await applyCoin()
  }

  async function confirmCoin(data: { auto: boolean; coin_coupon_ids: number[] }) {
    flow.current.useCoin = data.auto || data.coin_coupon_ids.length > 0
    flow.current.coinCouponIds = data.coin_coupon_ids
    flow.current.auto = data.auto
    commit()
    await applyCoin()
  }

  function openSelectDialog() {
    setCoinDialogOpen(true)
  }

  // ---------- 初始化 ----------

  function startCountdown(orderData: OrderDetail) {
    clearCountdown()
    if (!orderData.unpaid_timeout || Number(orderData.remain_pay_time) <= 0) {
      return
    }
    flow.current.remainPayTime = Number(orderData.remain_pay_time)
    commit()
    countdownTimerRef.current = setInterval(() => {
      if (flow.current.remainPayTime > 0) {
        flow.current.remainPayTime -= 1
        commit()
      } else {
        clearCountdown()
        toast.warning(t('coin_text138', '支付超时'))
        closeDialog(true)
      }
    }, 1000)
  }

  async function initPay(orderId: number) {
    clearPolling()
    clearCountdown()
    Object.assign(flow.current, makeFlow())
    flow.current.orderId = Number(orderId)
    commit()

    const detailRes = await fetchOrderDetail(orderId)
    if (detailRes.status !== 200) {
      toast.error(detailRes.msg)
      closeDialog(false)
      return
    }
    const orderData = detailRes.data.order
    flow.current.orderData = orderData
    flow.current.orderCustomfields = detailRes.data.customfields ?? {}
    commit()

    if (orderData.status === 'Paid') {
      toast.success(t('coin_text63', '订单已支付'))
      flow.current.isPaySuccess = true
      propsRef.current.onPaySuccess(flow.current.orderId)
      closeDialog(false)
      return
    }
    flow.current.isCz = orderData.type === 'recharge'
    flow.current.amount = Number(orderData.amount ?? 0)
    commit()

    startCountdown(orderData)

    const specialStatus = ['WaitUpload', 'WaitReview', 'ReviewFail']
    if (specialStatus.includes(orderData.status ?? '')) {
      setProofMode(true)
      setProofOpen(true)
      return
    }

    flow.current.isShowCredit = installedAddons().includes('CreditLimit')
    await getGateway()
    await handleGatewaySelection()

    if (
      installedAddons().includes('IdcsmartVoucher') &&
      CAN_USE_COIN_ORDER_TYPE.includes(orderData.type)
    ) {
      await getVoucherList()
      if (flow.current.couponList.length > 0) {
        await applyVoucher(flow.current.selectedCouponId, 1, true)
        flow.current.showCoupon = true
      } else {
        flow.current.showCoupon = false
      }
      commit()
    }

    if (
      installedAddons().includes('Coin') &&
      CAN_USE_COIN_ORDER_TYPE.includes(orderData.type)
    ) {
      await getCoinInfo()
      if (flow.current.coinClientInfo?.use_coin === 1) {
        flow.current.showCoin = true
        flow.current.auto = true
        flow.current.useCoin = true
        await applyCoin(true)
      } else if (
        flow.current.coinClientInfo?.credit_enough_no_use == 1 &&
        Number(flow.current.balance) >= Number(orderData.amount)
      ) {
        flow.current.showCoin = false
      } else if (flow.current.coinClientInfo?.available_coin) {
        flow.current.showCoin = true
        flow.current.auto = true
        flow.current.useCoin = true
        await applyCoin(true)
      }
      commit()
    }
    await zfSelectChange()
  }

  useEffect(() => {
    if (open && orderId != null) {
      initPay(orderId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderId])

  useEffect(() => {
    if (!open) {
      setProofMode(false)
      setProofOpen(false)
      setCoinDialogOpen(false)
    }
  }, [open])

  useEffect(
    () => () => {
      clearPolling()
      clearCountdown()
    },
    []
  )

  // ---------- ProofDialog 联动 ----------

  function handleProofClose() {
    setProofMode(false)
    setProofOpen(false)
    propsRef.current.onOpenChange(false)
  }

  function handleProofRefresh(changed: boolean, id?: number) {
    if (changed) {
      setProofMode(false)
      setProofOpen(false)
      initPay(id ?? flow.current.orderId)
    } else {
      flow.current.isPaySuccess = true
      setProofMode(false)
      setProofOpen(false)
      propsRef.current.onPaySuccess(flow.current.orderId)
      propsRef.current.onOpenChange(false)
    }
  }

  const f = flow.current
  const isShowCreditGateway =
    f.gateway === 'CreditLimit'
  const showBalanceCheck =
    f.gateway !== 'credit' &&
    f.gateway !== 'CreditLimit' &&
    f.balance > 0 &&
    f.orderCustomfields?.is_pre_invoice !== 1
  const showConfirmBtn = !f.isShowPay || f.gateway === 'CreditLimit'

  return (
    <div>
      {!proofMode && (
        <Dialog open={open} onOpenChange={(v) => !v && closeDialog(true)}>
          <DialogContent className='sm:max-w-lg'>
            <DialogHeader>
              <DialogTitle>{t('coin_text24', '提交成功')}</DialogTitle>
            </DialogHeader>

            <div className='space-y-4'>
              {/* 顶部订单信息 */}
              <div className='flex items-start justify-between gap-3 rounded-md border p-3'>
                <div className='space-y-1'>
                  <div className='text-sm font-medium'>
                    {t('coin_text25', '订单提交成功了，去付款咯~')}
                    {f.orderData &&
                      Number(f.orderData.unpaid_timeout) > 0 && (
                        <span className='ml-2 text-xs text-muted-foreground'>
                          {t('coin_text137', '剩余支付时间')}：
                          {formatRemainTime(f.remainPayTime)}
                        </span>
                      )}
                  </div>
                  <div className='text-xs text-muted-foreground'>
                    {t('coin_text26', '请尽快付款，订单号')}：ID-{f.orderId}
                  </div>
                </div>
                <div className='text-right text-sm'>
                  <div>
                    {f.gateway === 'UserCustom'
                      ? t('pay_text7', '线下支付')
                      : f.gateway === 'credit'
                        ? t('order_text8', '余额支付')
                        : f.gateway === 'CreditLimit'
                          ? t('coin_text62', '信用额支付')
                          : t('pay_text8', '扫码支付')}
                    {t('coin_text27', '金额')}：{currencyPrefix}
                    <span className='font-semibold'>
                      {f.priceLoading ? '--' : calcPayAmount()}
                    </span>
                    {currencyCode}
                  </div>
                  <div>
                    {t('coin_text28', '订单金额')}：{currencyPrefix}
                    <span className='font-semibold'>
                      {f.priceLoading ? '--' : calcShowOriginAmount()}
                    </span>
                    {currencyCode}
                  </div>
                </div>
              </div>

              {/* 充值通知 */}
              {f.isCz && (commonData.recharge_pay_notice_content as string) && (
                <div
                  className='rounded-md border bg-muted/40 px-3 py-2 text-xs'
                  dangerouslySetInnerHTML={{
                    __html: commonData.recharge_pay_notice_content as string,
                  }}
                />
              )}

              {/* 余额 / 平台币勾选 */}
              {!f.isCz && (
                <div className='space-y-2 text-sm'>
                  <div className='flex items-center gap-2'>
                    <span className='shrink-0'>
                      {t('coin_text23', '选择支付方式')}
                    </span>
                    {showBalanceCheck && (
                      <>
                        <Checkbox
                          checked={f.checked}
                          onCheckedChange={(v) => handleCheckChange(!!v)}
                        />
                        <span>
                          {t('pay_text21', '余额组合支付')}（{t('pay_text6', '当前余额')}
                          {currencyPrefix}
                          <span className='font-medium'>{f.balance.toFixed(2)}</span>
                          {f.checked && (
                            <>
                              ,{t('order_text8', '余额支付')}
                              {currencyPrefix}
                              <span className='font-medium'>
                                {(
                                  f.balance >= f.amount
                                    ? f.amount
                                    : f.balance
                                ).toFixed(2)}
                              </span>
                            </>
                          )}
                          ）
                        </span>
                      </>
                    )}
                  </div>
                  {f.showCoin && (
                    <div className='flex items-baseline gap-2'>
                      <Checkbox
                        checked={f.useCoin}
                        onCheckedChange={(v) => checkUseCoin(!!v)}
                      />
                      <span>
                        {t('coin_text44', '使用')}
                        {f.coinName}
                      </span>
                      {f.useCoin && (
                        <span>
                          （{t('coin_text35', '已选')}
                          {f.coinCouponsCount}
                          {t('coin_text36', '张')},
                          {t('coin_text45', '可抵扣')}
                          {currencyPrefix}
                          <span className='font-medium'>{f.coinAmount}</span>{' '}
                          <span
                            className='cursor-pointer text-primary hover:underline'
                            onClick={openSelectDialog}
                          >
                            {t('coin_text46', '使用详情')}
                          </span>
                          ）
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 信用额提示 */}
              {isShowCreditGateway && (
                <p className='text-xs text-amber-600'>
                  {t('pay_text4', '提示：您正在使用信用支付，如需退款，请先还清对应周期账单，否则无法成功退款，请谨慎选择！')}
                </p>
              )}

              {/* 支付方式列表 */}
              <div>
                <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
                  {f.gatewayList.map((item) => (
                    <button
                      key={`${item.id}`}
                      type='button'
                      onClick={() => handelSelect(item)}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                        f.gateway === item.name
                          ? 'border-primary bg-primary/5'
                          : 'hover:border-border'
                      }`}
                    >
                      {item.url && (
                        <img
                          src={item.url}
                          alt=''
                          className='h-6 w-6 shrink-0 object-contain'
                        />
                      )}
                      <span className='min-w-0 flex-1'>
                        <span className='block truncate'>{item.title}</span>
                        {f.isShowCredit && item.name === 'CreditLimit' && (
                          <span className='block text-xs text-muted-foreground'>
                            ({currencyPrefix}
                            {formatMoney(f.creditData?.remaining_amount)})
                          </span>
                        )}
                        {item.name === 'credit' && (
                          <span className='block text-xs text-muted-foreground'>
                            ({currencyPrefix}
                            {f.balance})
                          </span>
                        )}
                      </span>
                      {f.gateway === item.name && (
                        <span className='text-primary'>✓</span>
                      )}
                    </button>
                  ))}
                </div>

                {/* 支付内容区 */}
                {f.isShowPay && f.gateway !== 'CreditLimit' && (
                  <div className='mt-3 rounded-md border p-3'>
                    {f.gateway === 'UserCustom' ? (
                      <>
                        <div className='text-sm font-medium'>
                          {t('coin_text29', '详细信息')}
                        </div>
                        <div className='mt-2'>
                          {f.payLoading ? (
                            <div className='flex justify-center py-6'>
                              <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
                            </div>
                          ) : (
                            <>
                              <div
                                className='break-all text-sm'
                                dangerouslySetInnerHTML={{ __html: f.payHtml }}
                              />
                              {f.payHtml && (
                                <button
                                  type='button'
                                  aria-label='复制'
                                  className='mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground'
                                  onClick={() => copyText(f.payHtml)}
                                >
                                  <Copy className='h-3.5 w-3.5' />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                        <div className='mt-3 grid grid-cols-4 gap-1 text-center text-xs text-muted-foreground'>
                          <span>{t('finance_custom7', '提交申请')}</span>
                          <span>{t('finance_custom4', '上传凭证')}</span>
                          <span>{t('finance_custom8', '管理员审核')}</span>
                          <span>{t('finance_custom10', '购买成功')}</span>
                        </div>
                        <Button
                          className='mt-3 w-full'
                          onClick={handleCustom}
                          disabled={f.submitLoading}
                        >
                          {f.submitLoading && (
                            <Loader2 className='mr-1 h-4 w-4 animate-spin' />
                          )}
                          {t('finance_custom20', '提交转账凭证')}
                        </Button>
                      </>
                    ) : (
                      <div className='flex flex-col items-center gap-2 py-2'>
                        {f.payLoading ? (
                          <div className='flex justify-center py-6'>
                            <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
                          </div>
                        ) : (
                          <div
                            className='w-full [&_img]:mx-auto'
                            dangerouslySetInnerHTML={{ __html: f.payHtml }}
                          />
                        )}
                        <div className='text-center text-xs text-muted-foreground'>
                          {t('coin_text30', '在线支付')}
                          <br />
                          {t('coin_text31', '扫一扫继续支付')}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className='flex-wrap items-center gap-2'>
              <div className='mr-auto flex min-w-0 flex-1 flex-wrap items-center gap-2'>
                {f.showCoupon && (
                  <>
                    <span className='shrink-0 text-sm'>
                      {t('shoppingCar_tip_text10', '使用代金券')}：
                    </span>
                    <Select
                      value={f.selectedCouponId}
                      onValueChange={handleVoucherChange}
                    >
                      <SelectTrigger className='w-56'>
                        <SelectValue
                          placeholder={t('shoppingCar_tip_text11', '请选择要使用的代金券！')}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {f.couponList.map((item) => (
                          <SelectItem key={item.id} value={String(item.id)}>
                            {formatLabel(item)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>
              <div className='flex items-center gap-2'>
                {showConfirmBtn && (
                  <Button
                    onClick={handleOk}
                    disabled={
                      f.getWayLoading ||
                      f.priceLoading ||
                      (f.balance < f.amount && f.gateway !== 'CreditLimit')
                    }
                  >
                    {f.doPayLoading && (
                      <Loader2 className='mr-1 h-4 w-4 animate-spin' />
                    )}
                    {t('pay_text9', '确认支付')}
                  </Button>
                )}
                <Button variant='outline' onClick={() => closeDialog(true)}>
                  {t('pay_text12', '取消')}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* 内部子弹窗：上传凭证 */}
      <ProofDialog
        open={proofOpen}
        orderId={proofOpen ? f.orderId : null}
        onOpenChange={(v) => {
          if (!v) handleProofClose()
        }}
        onRefresh={handleProofRefresh}
      />

      {/* 内部子弹窗：选择平台币 */}
      <CoinSelectDialog
        open={coinDialogOpen}
        orderId={f.orderId}
        coinName={f.coinName}
        auto={f.auto}
        coinCouponIds={f.coinCouponIds}
        currencyPrefix={currencyPrefix}
        onConfirm={confirmCoin}
        onClose={() => setCoinDialogOpen(false)}
      />
    </div>
  )
}

