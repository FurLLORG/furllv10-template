import { useCallback, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  cancelHostRefund,
  fetchHostRefundInfo,
  fetchRefundPage,
  submitHostRefund,
  type HostDetail,
  type RefundInfo,
} from '@/api'
import { getErrorMessage } from '@/lib/api'
import { useClientLang } from '@/hooks/use-client-lang'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

/** 官方 refundStatus 文案映射（unsubscribe 组件） */
const REFUND_STATUS = [
  'Pending',
  'Suspending',
  'Suspend',
  'Suspended',
  'Refund',
  'Reject',
  'Cancelled',
] as const

function formatTime(ts?: number | string): string {
  const num = Number(ts)
  if (!num || Number.isNaN(num)) return '--'
  const d = new Date(num * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatMoney(v?: number | string): string {
  const num = Number(v)
  if (v == null || v === '' || Number.isNaN(num)) return '--'
  return num.toFixed(2)
}

/**
 * 退订（官方 unsubscribe 组件：申请停用/取消停用 + 状态提示，IdcsmartRefund 插件）。
 * - GET  /refund/host/:id/refund 停用信息（refundData，无记录为 null）
 * - GET  /refund?host_id=        停用页面配置（原因/退款方式/金额明细）
 * - POST /refund                 申请停用（type=Immediate，reason_custom 时原因传字符串）
 * - PUT  /refund/:id/cancel      取消停用
 */
export function RefundPanel({
  hostId,
  host,
  currencyPrefix = '¥',
}: {
  hostId: number
  host?: HostDetail
  currencyPrefix?: string
}) {
  const { t } = useClientLang()
  const queryClient = useQueryClient()

  // 停用信息（官方 getRefundMsg；无记录/报错时 refund=null）
  const refundQuery = useQuery({
    queryKey: ['host-refund', hostId],
    queryFn: () => fetchHostRefundInfo(hostId),
    retry: false,
  })
  const refundData: RefundInfo | null | undefined = refundQuery.data?.data?.refund

  // 停用状态文案（官方 refundStatus）
  const statusText = (status?: string): string => {
    if (!status) return ''
    if ((REFUND_STATUS as readonly string[]).includes(status)) {
      return t(`common_unsubscribe_${status.toLowerCase()}`)
    }
    return status
  }

  const [dialogOpen, setDialogOpen] = useState(false)
  const [pageData, setPageData] = useState<{
    allow_refund?: number
    reason_custom?: number
    reasons?: Array<{ id: number; content: string }>
    host?: {
      create_time?: number | string
      first_payment_amount?: number | string
      base_amount?: number | string
      service_fee?: number | string
      amount?: number | string
    }
    show_refund_method?: number
    refund_method_default?: string
    gateway_name?: string
  }>({ host: {} })
  const [suspendReason, setSuspendReason] = useState<number[] | string>([])
  const [refundMethod, setRefundMethod] = useState('credit')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(false)

  const openRefundDialog = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchRefundPage(hostId)
      if (res.status === 200) {
        setPageData(res.data ?? { host: {} })
        setSuspendReason(
          res.data?.reason_custom === 0 ? [] : ''
        )
        setRefundMethod(res.data?.refund_method_default || 'credit')
        setDialogOpen(true)
      } else {
        toast.error(res.msg || t('common_unsubscribe_msg_select_reason'))
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [hostId, t])

  const reasonCustom = pageData.reason_custom === 0 ? false : true
  const allowRefund = pageData.allow_refund === 1
  const showRefundMethod = pageData.show_refund_method === 1

  /** 申请退订（官方 subRefund） */
  async function submitRefund() {
    if (
      !suspendReason ||
      (pageData.reason_custom === 0 && Array.isArray(suspendReason) && suspendReason.length === 0)
    ) {
      toast.error(t('common_unsubscribe_msg_select_reason'))
      return
    }
    setSubmitting(true)
    try {
      const params: {
        host_id: number
        suspend_reason: number[] | string
        type: string
        refund_method?: string
      } = {
        host_id: hostId,
        suspend_reason: suspendReason,
        type: 'Immediate',
      }
      if (showRefundMethod) params.refund_method = refundMethod || 'credit'
      const res = await submitHostRefund(params)
      if (res.status === 200) {
        toast.success(res.msg || t('common_unsubscribe_title'))
        setDialogOpen(false)
        queryClient.invalidateQueries({ queryKey: ['host-refund', hostId] })
      } else {
        toast.error(res.msg)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  /** 取消退订（官方 quitRefund） */
  async function quitRefund() {
    if (!refundData?.id) return
    setSubmitting(true)
    try {
      const res = await cancelHostRefund(refundData.id)
      if (res.status === 200) {
        toast.success(res.msg || t('common_unsubscribe_btn_cancel'))
        queryClient.invalidateQueries({ queryKey: ['host-refund', hostId] })
      } else {
        toast.error(res.msg)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const refundStatus = refundData?.status
  // 申请按钮显示条件（官方 showApplyBtn）
  const showApplyBtn = useMemo(() => {
    const { change_billing_cycle_id } = host as { change_billing_cycle_id?: unknown }
    return (
      (!change_billing_cycle_id && !refundData) ||
      refundStatus === 'Reject' ||
      refundStatus === 'Cancelled'
    )
  }, [host, refundData, refundStatus])

  const showStatus =
    refundData && refundStatus !== 'Cancelled' && refundStatus !== 'Reject'
  const showCancel =
    refundData &&
    (refundStatus === 'Pending' ||
      refundStatus === 'Suspend' ||
      refundStatus === 'Suspending')

  return (
    <div className='flex flex-wrap items-center gap-2'>
      {/* 停用状态提示（官方 refund-msg） */}
      {refundData && refundStatus === 'Suspending' && (
        <span className='text-xs text-muted-foreground'>
          ({t('common_unsubscribe_tip_product')}
          {formatTime(refundData.create_time)}
          {t('common_unsubscribe_tip_apply')}
          {refundData.type === 'Expire'
            ? t('common_unsubscribe_tip_expire')
            : t('common_unsubscribe_tip_immediate')}
          ，{t('common_unsubscribe_tip_at')}
          {refundData.type === 'Expire' && formatTime(host?.due_time)}
          {refundData.type === 'Expire'
            ? t('common_unsubscribe_tip_after_expire')
            : t('common_unsubscribe_tip_pass')}
          {t('common_unsubscribe_tip_auto_delete')})
        </span>
      )}
      {refundData && refundStatus === 'Reject' && (
        <span className='text-xs text-muted-foreground'>
          ({t('common_unsubscribe_tip_product')}
          {formatTime(refundData.create_time)}
          {t('common_unsubscribe_tip_apply')}
          {refundData.type === 'Expire'
            ? t('common_unsubscribe_tip_expire')
            : t('common_unsubscribe_tip_immediate')}
          {t('common_unsubscribe_tip_fail')}，
          <span
            className='cursor-help text-primary'
            title={refundData.reject_reason || '--'}
          >
            {t('common_unsubscribe_tip_view_reason')}
          </span>
          )
        </span>
      )}

      {/* 状态 + 按钮（官方 unsubscribe-btn） */}
      {showStatus && (
        <span className='text-xs font-medium text-amber-600'>
          {statusText(refundStatus)}
        </span>
      )}
      {showCancel && (
        <Button
          size='sm'
          variant='outline'
          className='h-7 text-xs'
          disabled={submitting}
          onClick={quitRefund}
        >
          {t('common_unsubscribe_btn_cancel')}
        </Button>
      )}
      {showApplyBtn && (
        <Button
          size='sm'
          variant='outline'
          className='h-7 text-xs'
          disabled={loading || submitting}
          onClick={openRefundDialog}
        >
          {t('common_unsubscribe_title')}
        </Button>
      )}

      {/* 申请退订弹窗（官方 unsubscribe dialog） */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>{t('common_unsubscribe_title')}</DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            <div>
              <Label>{t('common_unsubscribe_label_product_info')}</Label>
              <div className='mt-2 space-y-1.5 rounded-md border p-3 text-sm'>
                <div className='flex justify-between'>
                  <span className='text-muted-foreground'>
                    {t('common_unsubscribe_label_order_time')}：
                  </span>
                  <span>{formatTime(pageData.host?.create_time)}</span>
                </div>
                {allowRefund && (
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>
                      {t('common_unsubscribe_label_order_amount')}：
                    </span>
                    <span>
                      {currencyPrefix}
                      {formatMoney(pageData.host?.first_payment_amount)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label>{t('common_unsubscribe_label_reason')}</Label>
              {reasonCustom ? (
                <Input
                  className='mt-2'
                  value={String(suspendReason ?? '')}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder={t('common_unsubscribe_label_reason')}
                />
              ) : (
                <Select
                  value={
                    Array.isArray(suspendReason) && suspendReason.length > 0
                      ? String(suspendReason[0])
                      : ''
                  }
                  onValueChange={(v) => setSuspendReason([Number(v)])}
                >
                  <SelectTrigger className='mt-2 w-full'>
                    <SelectValue placeholder={t('common_unsubscribe_label_reason')} />
                  </SelectTrigger>
                  <SelectContent>
                    {(pageData.reasons ?? []).map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.content}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div>
              <Label>{t('common_unsubscribe_label_time')}</Label>
              <Select value='Immediate'>
                <SelectTrigger className='mt-2 w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='Immediate'>
                    {t('common_unsubscribe_label_immediate')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {allowRefund && (
              <>
                {showRefundMethod && (
                  <div>
                    <Label>{t('common_unsubscribe_label_refund_method')}</Label>
                    <Select value={refundMethod} onValueChange={setRefundMethod}>
                      <SelectTrigger className='mt-2 w-full'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='credit'>
                          {t('common_unsubscribe_refund_method_credit')}
                        </SelectItem>
                        <SelectItem value='gateway_original'>
                          {t('common_unsubscribe_refund_method_gateway')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {refundMethod === 'gateway_original' &&
                      pageData.gateway_name && (
                        <p className='mt-1.5 text-xs text-muted-foreground'>
                          {t('common_unsubscribe_refund_gateway_tip').replace(
                            '{gateway}',
                            pageData.gateway_name
                          )}
                        </p>
                      )}
                  </div>
                )}
                <div>
                  <Label>{t('common_unsubscribe_label_refund_info')}</Label>
                  <div className='mt-2 space-y-1.5 rounded-md border p-3 text-sm'>
                    <div className='flex justify-between'>
                      <span className='text-muted-foreground'>
                        {t('common_unsubscribe_label_base_amount')}：
                      </span>
                      <span>
                        {currencyPrefix}
                        {formatMoney(pageData.host?.base_amount)}
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-muted-foreground'>
                        {t('common_unsubscribe_label_service_fee')}：
                      </span>
                      <span className='text-destructive'>
                        -{currencyPrefix}
                        {formatMoney(pageData.host?.service_fee)}
                      </span>
                    </div>
                    <div className='flex justify-between font-medium'>
                      <span className='text-muted-foreground'>
                        {t('common_unsubscribe_label_refund_amount')}：
                      </span>
                      <span>
                        {currencyPrefix}
                        {formatMoney(pageData.host?.amount)}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {!allowRefund && (
              <p className='text-sm text-muted-foreground'>
                {t('common_unsubscribe_tip_no_refund')}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={submitRefund}
              disabled={submitting}
            >
              {submitting && <Loader2 className='mr-1 h-4 w-4 animate-spin' />}
              {allowRefund
                ? t('common_unsubscribe_btn_confirm_refund')
                : t('common_unsubscribe_btn_confirm_unsubscribe')}
            </Button>
            <Button variant='outline' onClick={() => setDialogOpen(false)}>
              {t('account_btn3')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
