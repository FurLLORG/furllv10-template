import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Info, Loader2 } from 'lucide-react'
import {
  fetchCoinCoupon,
  fetchCoinRechargeDetail,
  submitRecharge,
  type CoinClientCouponData,
} from '@/api/finance'
import { fetchCommon } from '@/api'
import { getErrorMessage } from '@/lib/api'
import { installedAddons } from '@/lib/addons'
import { useClientLang } from '@/hooks/use-client-lang'
import { formatTime } from '@/features/client/finance/shared'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export interface RechargeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenPay: (orderId: number) => void
}

interface RechargeActiveItem {
  id: number
  name?: string
  begin_time?: number
  end_time?: number
  type?: string
  recharge_min?: number | string
  recharge_proportion?: number | string
  return?: Array<{ id: number; amount: number; award: number }>
}

/**
 * 充值弹窗（官方 rechargeDialog 组件）。
 * - 金额输入 → submitRecharge({amount}) 生成订单 → onOpenPay 打开支付弹窗
 * - Coin 插件：阶梯充值卡（gradient/proportion）+ 充值赠送提示（rechargeTip）
 */
export function RechargeDialog({
  open,
  onOpenChange,
  onOpenPay,
}: RechargeDialogProps) {
  const { t } = useClientLang()
  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  const commonData = (commonQuery.data?.data ?? {}) as Record<string, unknown>
  const currencyPrefix = (commonData.currency_prefix as string) ?? '¥'
  const currencySuffix = (commonData.currency_suffix as string) ?? ''

  const [amount, setAmount] = useState<number | undefined>(undefined)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [rechargeActive, setRechargeActive] = useState<RechargeActiveItem[]>([])
  const [coinClientCoupon, setCoinClientCoupon] = useState<CoinClientCouponData>({})

  // 打开时重置金额（官方 czClose/open 初始化；render-phase reset）
  const [prevOpen, setPrevOpen] = useState(false)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setAmount(undefined)
      if (!installedAddons().includes('Coin')) setRechargeActive([])
    }
  }

  useEffect(() => {
    if (!open) return
    if (installedAddons().includes('Coin')) {
      fetchCoinRechargeDetail()
        .then((res) => setRechargeActive(res.data?.coins ?? []))
        .catch(() => setRechargeActive([]))
      fetchCoinCoupon()
        .then((res) => setCoinClientCoupon(res.data ?? {}))
        .catch(() => setCoinClientCoupon({}))
    }
  }, [open])

  /** 官方 rechargeTip computed：proportion / gradient 两种赠送提示 */
  const rechargeTip = useMemo(() => {
    if (rechargeActive.length === 0 || !amount) return []
    const tips: string[] = []
    const maxCoinAward = Number(coinClientCoupon.per_recharge_get_coin_max)
    const coinName = coinClientCoupon.name ?? ''
    rechargeActive.forEach((item) => {
      if (item.type === 'proportion') {
        if (Number(amount) >= Number(item.recharge_min)) {
          const award = Number(item.recharge_proportion) * 0.01 * Number(amount)
          tips.push(
            `${item.name}：${t('coin_text18', '赠送您')}${Number(award > maxCoinAward ? maxCoinAward : award).toFixed(2)}${coinName}`
          )
        } else {
          tips.push(
            `${item.name}：${t('coin_text19', '增加充值')}${Number(Number(item.recharge_min) - Number(amount)).toFixed(2)}${currencySuffix}${t('coin_text20', '可赠送您')}${Number(Number(item.recharge_proportion) * 0.01 * Number(item.recharge_min)).toFixed(2)}${coinName}`
          )
        }
      }
      if (item.type === 'gradient' && item.return && item.return.length > 0) {
        const maxAmount = Math.max(...item.return.map((r) => Number(r.amount)))
        if (Number(amount) >= maxAmount) {
          const maxAward = item.return.find((r) => Number(r.amount) === maxAmount)?.award
          tips.push(
            `${item.name}：${t('coin_text18', '赠送您')}${Number(Number(maxAward) > maxCoinAward ? maxCoinAward : Number(maxAward)).toFixed(2)}${coinName}`
          )
        } else {
          const currentIndex = item.return.findIndex(
            (r, index) =>
              Number(amount) >= Number(r.amount) &&
              Number(amount) < Number(item.return![index + 1]?.amount)
          )
          const currentAmount = item.return[currentIndex]
          const nextAmount = item.return[currentIndex + 1]
          if (currentAmount && nextAmount) {
            const currentAward =
              Number(currentAmount.award) > maxCoinAward
                ? maxCoinAward
                : Number(currentAmount.award)
            const nextAward =
              Number(nextAmount.award) > maxCoinAward
                ? maxCoinAward
                : Number(nextAmount.award)
            tips.push(
              `${item.name}：${t('coin_text21', '当前赠送您')}${Number(currentAward).toFixed(2)}${coinName}，${t('coin_text22', '增加充值')}${Number(Number(nextAmount.amount) - Number(amount)).toFixed(2)}${currencySuffix}${t('coin_text20', '可赠送您')}${Number(nextAward).toFixed(2)}${coinName}`
            )
          }
        }
      }
    })
    return tips
  }, [rechargeActive, amount, coinClientCoupon, currencySuffix, t])

  function activityTime(item: RechargeActiveItem): string {
    if (item.begin_time === 0) {
      return t('coin_text17', '长期有效')
    }
    if (item.begin_time) {
      return `${formatTime(item.begin_time)} - ${formatTime(item.end_time)}`
    }
    return '--'
  }

  async function handleSubmit() {
    if (!amount) {
      toast.error(t('finance_text130', '请输入充值金额'))
      return
    }
    setSubmitLoading(true)
    try {
      const res = await submitRecharge({ amount })
      if (res.status === 200) {
        onOpenChange(false)
        onOpenPay(res.data.id)
      } else {
        toast.error(res.msg)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSubmitLoading(false)
    }
  }

  const showActivity = rechargeActive.length > 0

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={(v) => !v && onOpenChange(false)}>
        <DialogContent className='sm:max-w-xl'>
          <DialogHeader>
            <DialogTitle>{t('finance_title4', '充值')}</DialogTitle>
          </DialogHeader>

        <div className='space-y-4'>
          <div className='flex gap-2'>
            <div className='relative flex-1'>
              <Input
                type='number'
                min={0}
                step={0.01}
                value={amount ?? ''}
                onChange={(e) => setAmount(e.target.value === '' ? undefined : Number(e.target.value))}
                placeholder={t('finance_text130', '请输入充值金额')}
                className='pr-10'
              />
              <span className='pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground'>
                {currencySuffix}
              </span>
            </div>
            <Button onClick={handleSubmit} disabled={submitLoading}>
              {submitLoading && <Loader2 className='mr-1 h-4 w-4 animate-spin' />}
              {t('finance_btn6', '提交')}
            </Button>
          </div>

          {showActivity && (
            <>
              {rechargeTip.length > 0 && (
                <div className='space-y-1 rounded-md border bg-muted/40 px-3 py-2 text-xs'>
                  {rechargeTip.map((tip, index) => (
                    <p key={index}>{tip}</p>
                  ))}
                </div>
              )}
              <div className='space-y-3'>
                <div className='flex items-center gap-1.5 text-sm font-medium'>
                  <span>{t('coin_text12', '充值活动')}</span>
                  {coinClientCoupon.coin_description_open === 1 &&
                    coinClientCoupon.coin_description && (
                      <Tooltip>
                        <TooltipTrigger type='button' asChild>
                          <span className='cursor-help text-muted-foreground'>
                            <Info className='h-4 w-4' />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div
                            className='max-w-xs text-xs'
                            dangerouslySetInnerHTML={{
                              __html: coinClientCoupon.coin_description,
                            }}
                          />
                        </TooltipContent>
                      </Tooltip>
                    )}
                </div>
                {rechargeActive.map((item) => (
                  <div key={item.id} className='rounded-md border p-3'>
                    <div className='flex flex-wrap items-center justify-between gap-2 text-sm'>
                      <span className='font-medium'>{item.name}</span>
                      <span className='text-xs text-muted-foreground'>
                        {activityTime(item)}
                      </span>
                    </div>
                    <div className='mt-2 grid gap-2 sm:grid-cols-3'>
                      {item.type === 'gradient' &&
                        item.return?.map((items, index) => {
                          const active =
                            Number(amount) >= Number(items.amount) &&
                            (index === (item.return?.length ?? 0) - 1 ||
                              Number(amount) <
                                Number(item.return![index + 1]?.amount))
                          return (
                            <button
                              key={items.id}
                              type='button'
                              onClick={() => setAmount(Number(items.amount))}
                              className={`rounded-md border p-3 text-left transition-colors ${
                                active
                                  ? 'border-primary bg-primary/5'
                                  : 'hover:border-border'
                              }`}
                            >
                              <div className='text-lg font-semibold tabular-nums'>
                                <span className='text-xs font-normal text-muted-foreground'>
                                  {currencyPrefix}
                                </span>
                                {items.amount}
                              </div>
                              <div className='mt-1 text-xs text-muted-foreground'>
                                {t('coin_text13', '充值')}
                                {items.amount}
                                {t('coin_text14', '赠送')}
                                {items.award}
                                {coinClientCoupon.name ?? ''}
                              </div>
                            </button>
                          )
                        })}
                      {item.type === 'proportion' && (
                        <button
                          type='button'
                          onClick={() => setAmount(Number(item.recharge_min))}
                          className={`rounded-md border p-3 text-left transition-colors ${
                            Number(amount) >= Number(item.recharge_min)
                              ? 'border-primary bg-primary/5'
                              : 'hover:border-border'
                          }`}
                        >
                          <div className='text-lg font-semibold tabular-nums'>
                            <span className='text-xs font-normal text-muted-foreground'>
                              {currencyPrefix}
                            </span>
                            {item.recharge_min}
                          </div>
                          <div className='mt-1 text-xs text-muted-foreground'>
                            {t('coin_text15', '最低充值')}
                            {item.recharge_min}
                            <br />
                            {t('coin_text16', '赠送充值金额')}
                            {Number(item.recharge_proportion)}%
                            {coinClientCoupon.name ?? ''}
                          </div>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {(commonData.recharge_money_notice_content as string) && (
            <div
              className='rounded-md border bg-muted/40 px-3 py-2 text-xs'
              dangerouslySetInnerHTML={{
                __html: commonData.recharge_money_notice_content as string,
              }}
            />
          )}
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('pay_text12', '取消')}
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
