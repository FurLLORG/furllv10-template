import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import {
  fetchWithdrawRule,
  submitWithdraw,
  type WithdrawRuleData,
} from '@/api/finance'
import { fetchCommon } from '@/api'
import { getErrorMessage } from '@/lib/api'
import { useClientLang } from '@/hooks/use-client-lang'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface WithdrawDialogProps {
  open: boolean
  /** 可提现余额（父级算好传入） */
  balance: number
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

/** 官方 oninput：只允许数字 / 一个小数点 / 两位小数，首位不能是 0/./+- */
function sanitizeAmount(value: string): string {
  let str = String(value)
  if (str.length > 1 && str[0] === '0' && str[1] !== '.') {
    str = str.slice(1)
  }
  if (str[0] === '.' || str[0] === '+' || str[0] === '-') {
    str = ''
  }
  if (str.indexOf('.') !== -1) {
    const dotIdx = str.indexOf('.')
    const rest = str.slice(dotIdx + 1)
    if (rest.indexOf('.') !== -1) {
      str = str.slice(0, dotIdx + rest.indexOf('.') + 1)
    }
  }
  str = str.replace(/[^\d.]+/g, '')
  str = str.replace(/^\D*([0-9]\d*\.?\d{0,2})?.*$/, '$1')
  return str
}

/**
 * 提现弹窗（官方 withdrawDialog 组件）。
 * - 打开时拉取提现规则（fetchWithdrawRule），方式 Select 默认第一个
 * - 校验（银行卡号 / 方式 / 金额 / min / 可提现 / max）→ submitWithdraw
 */
export function WithdrawDialog({
  open,
  balance,
  onOpenChange,
  onSuccess,
}: WithdrawDialogProps) {
  const { t } = useClientLang()
  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  const commonData = (commonQuery.data?.data ?? {}) as Record<string, unknown>
  const currencyPrefix = (commonData.currency_prefix as string) ?? '¥'

  const [ruler, setRuler] = useState<WithdrawRuleData | null>(null)
  const [methodId, setMethodId] = useState<string>('')
  const [amount, setAmount] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [account, setAccount] = useState('')
  const [name, setName] = useState('')
  const [errText, setErrText] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // 打开时重置表单（官方 shwoWithdrawal 初始化；render-phase reset，React 官方推荐模式）
  const [prevOpen, setPrevOpen] = useState(false)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setErrText('')
      setLoading(true)
      setCardNumber('')
      setAccount('')
      setName('')
      setAmount('')
    }
  }

  useEffect(() => {
    if (!open) return
    fetchWithdrawRule()
      .then((res) => {
        const data = res.data
        setRuler(data)
        const methodId = data.method_id ?? data.method?.[0]?.id ?? ''
        setMethodId(String(methodId))
        if (data.source === 'deposit') {
          setAmount(sanitizeAmount(String(balance)))
        }
      })
      .catch((error) => {
        toast.error(getErrorMessage(error))
      })
      .finally(() => setLoading(false))
  }, [open, balance])

  const selectedMethod = useMemo(
    () => (ruler?.method ?? []).find((item) => String(item.id) === methodId),
    [ruler, methodId]
  )
  const isBank = selectedMethod?.name === '银行卡'
  const isWithdrawToCredit =
    ruler?.source === 'market' && Number(methodId) === 0
  const showAccountFields =
    !selectedMethod?.no_account && Number(methodId) !== 0

  const handlingFee =
    ruler?.withdraw_fee_type === 'fixed'
      ? `${currencyPrefix}${ruler.withdraw_fee}`
      : ruler?.percent
        ? `${ruler.percent}%`
        : ''

  function doApplyWithdraw() {
    let err = ''
    if (isBank && !cardNumber) {
      err = t('withdraw_placeholder3', '请输入银行卡号')
    } else if (!methodId && Number(methodId) !== 0) {
      err = t('withdraw_placeholder1', '请选择提现方式')
    } else if (!amount) {
      err = t('withdraw_placeholder6', '请输入提现金额')
    } else {
      if (
        !isWithdrawToCredit &&
        ruler?.min &&
        Number(ruler.min) > Number(amount)
      ) {
        err = t('withdraw_tips1', '提现金额不能小于') + currencyPrefix + ruler.min
      } else if (Number(amount) > Number(balance)) {
        err = t('withdraw_tips2', '提现金额超出可提现金额')
      } else if (
        !isWithdrawToCredit &&
        ruler?.max &&
        Number(ruler.max) < Number(amount)
      ) {
        err = t('withdraw_tips3', '提现金额不能大于') + currencyPrefix + ruler.max
      }
    }
    if (err) {
      setErrText(err)
      return
    }
    setErrText('')
    setSubmitting(true)
    const params: {
      source: string
      method_id: string
      amount: string
      account?: string
      card_number?: string
      name?: string
    } = {
      source: ruler?.source ?? 'credit',
      method_id: methodId,
      amount,
    }
    if (showAccountFields) {
      if (isBank) {
        params.card_number = cardNumber
      } else {
        params.account = account
      }
      params.name = name
    }
    submitWithdraw(params)
      .then((res) => {
        if (res.status === 200) {
          toast.success(res.msg || t('finance_text124', '申请成功'))
          onSuccess()
          onOpenChange(false)
        } else {
          toast.error(res.msg)
        }
      })
      .catch((error) => {
        toast.error(getErrorMessage(error))
      })
      .finally(() => setSubmitting(false))
  }

  const withdrawableAmount = balance

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onOpenChange(false)}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('withdraw_title', '申请提现')}</DialogTitle>
        </DialogHeader>

        <div className='space-y-4'>
          {loading ? (
            <div className='flex justify-center py-8'>
              <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
            </div>
          ) : (
            <>
              <div className='space-y-2'>
                <Label>{t('withdraw_label1', '提现方式')}</Label>
                <Select
                  value={methodId}
                  onValueChange={(v) => setMethodId(v)}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder={t('withdraw_placeholder1', '请选择提现方式')} />
                  </SelectTrigger>
                  <SelectContent>
                    {(ruler?.method ?? []).map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {showAccountFields && (
                <>
                  {isBank ? (
                    <div className='space-y-2'>
                      <Label>{t('withdraw_label2', '银行卡号')}</Label>
                      <Input
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        placeholder={t('withdraw_placeholder3', '请输入银行卡号')}
                      />
                    </div>
                  ) : (
                    <div className='space-y-2'>
                      <Label>{t('withdraw_label3', '账号')}</Label>
                      <Input
                        value={account}
                        onChange={(e) => setAccount(e.target.value)}
                        placeholder={t('withdraw_placeholder2', '请输入账号')}
                      />
                    </div>
                  )}
                  <div className='space-y-2'>
                    <Label>{t('withdraw_label4', '姓名')}</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('withdraw_placeholder4', '请输入姓名')}
                    />
                  </div>
                </>
              )}

              <div className='space-y-2'>
                <Label>{t('withdraw_label5', '提现金额')}</Label>
                <div className='relative'>
                  <Input
                    disabled={ruler?.source === 'deposit'}
                    value={amount}
                    onChange={(e) =>
                      setAmount(sanitizeAmount(e.target.value))
                    }
                    placeholder={`${t('withdraw_placeholder5', '可提现')}${currencyPrefix}${withdrawableAmount}`}
                    className='pr-16'
                  />
                  {ruler?.source !== 'deposit' && (
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      className='absolute inset-y-0 right-0 h-full px-3 text-xs text-primary'
                      onClick={() => setAmount(sanitizeAmount(String(withdrawableAmount)))}
                    >
                      {t('withdraw_btn3', '全部')}
                    </Button>
                  )}
                </div>
              </div>

              {errText && (
                <Alert className='text-destructive'>
                  {errText}
                </Alert>
              )}
            </>
          )}
        </div>

        {!loading && ruler?.source !== 'deposit' && (
          <div className='space-y-1 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground'>
            <div className='mb-1 font-medium text-foreground'>
              {t('withdraw_title2', '提现规则')}
            </div>
            {isWithdrawToCredit && (
              <p>{t('withdraw_text_no_limit', '•单次提现没有限制')}</p>
            )}
            {isWithdrawToCredit && (
              <p>{t('withdraw_text_credit_fee', '•提现手续费：每次8%')}</p>
            )}
            {!isWithdrawToCredit && (ruler?.min || ruler?.max) && (
              <p>
                {t('withdraw_text1', '•单次提现')}
                {ruler?.min && (
                  <span>
                    {t('withdraw_text2', '不能低于')}
                    {currencyPrefix}
                    {ruler.min}
                  </span>
                )}
                {ruler?.min && ruler?.max && <span>,</span>}
                {ruler?.max && (
                  <span>
                    {t('withdraw_text3', '不能超过')}
                    {currencyPrefix}
                    {ruler.max}
                  </span>
                )}
              </p>
            )}
            {!isWithdrawToCredit && (handlingFee || ruler?.percent_min) && (
              <p>
                {t('withdraw_text4', '•提现手续费：每次')}
                {handlingFee && <span>{handlingFee}</span>}
                {ruler?.percent_min && (
                  <span>
                    {t('withdraw_text5', '最低')}
                    {currencyPrefix}
                    {ruler.percent_min}
                  </span>
                )}
                <span>{t('withdraw_text6', '(用于发票税点及增值税点缴纳等)')}</span>
              </p>
            )}
            {!isWithdrawToCredit && (
              <p>{t('withdraw_text_weekly_settlement', '•每周五财务人员统一打款结算')}</p>
            )}
            <p>{t('withdraw_text7', '•需通过平台实名认证')}</p>
          </div>
        )}

        <DialogFooter>
          <Button onClick={doApplyWithdraw} disabled={submitting || loading}>
            {submitting && <Loader2 className='mr-1 h-4 w-4 animate-spin' />}
            {t('withdraw_btn1', '提交')}
          </Button>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('withdraw_btn2', '取消')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
