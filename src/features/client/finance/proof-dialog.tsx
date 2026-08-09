import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { FileText, Loader2, X } from 'lucide-react'
import {
  changeOrderPayType,
  fetchOrderDetail,
  payOrder,
  uploadOrderProof,
  type OrderDetail,
} from '@/api/finance'
import { fetchCommon, uploadTicketFile } from '@/api'
import { getErrorMessage } from '@/lib/api'
import { useClientLang } from '@/hooks/use-client-lang'
import { formatMoney } from '@/features/client/finance/shared'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface ProofDialogProps {
  open: boolean
  orderId: number | null
  onOpenChange: (open: boolean) => void
  onRefresh: (changed: boolean, orderId?: number) => void
}

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'bmp', 'webp', 'gif', 'svg', 'avif', 'ico', 'tif', 'tiff']

function extOf(urlOrName?: string): string {
  return (urlOrName ?? '').split('?')[0].split('.').pop()?.toLowerCase() ?? ''
}

function isImageFile(url?: string, name?: string): boolean {
  return IMAGE_EXTS.includes(extOf(url)) || IMAGE_EXTS.includes(extOf(name ?? ''))
}

/**
 * 上传凭证弹窗（官方 proofDialog 组件：线下支付订单凭证上传 / 查看）。
 * - 打开时拉取订单详情；Paid 且有凭证 → 查看模式
 * - payOrder({gateway:'UserCustom'}) 渲染转账信息；uploadTicketFile 逐个上传收集 save_name
 * - uploadOrderProof 提交凭证；changeOrderPayType 变更支付方式
 */
export function ProofDialog({
  open,
  orderId,
  onOpenChange,
  onRefresh,
}: ProofDialogProps) {
  const { t } = useClientLang()
  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  const commonData = (commonQuery.data?.data ?? {}) as Record<string, unknown>
  const currencyPrefix = (commonData.currency_prefix as string) ?? '¥'
  const currencyCode = (commonData.currency_code as string) ?? ''

  const [orderInfo, setOrderInfo] = useState<OrderDetail | null>(null)
  const [orderStatus, setOrderStatus] = useState('')
  const [reviewFailReason, setReviewFailReason] = useState('')
  const [stepNum, setStepNum] = useState(3)
  const [payHtml, setPayHtml] = useState('')
  const [payLoading, setPayLoading] = useState(false)
  const [fileList, setFileList] = useState<
    Array<{ save_name?: string; name?: string; url?: string }>
  >([])
  const [voucher, setVoucher] = useState<string[]>([])
  const [isLook, setIsLook] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [changeLoading, setChangeLoading] = useState(false)
  const [showChangeWay, setShowChangeWay] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function init() {
    if (orderId == null) return
    setPayLoading(true)
    try {
      const res = await fetchOrderDetail(orderId)
      if (res.status !== 200) {
        toast.error(res.msg)
        setPayLoading(false)
        return
      }
      const order = res.data.order
      setOrderInfo(order)
      const status = order.status ?? ''
      setOrderStatus(status)
      setReviewFailReason(order.review_fail_reason ?? '')
      const list = order.voucher ?? []
      setIsLook(status === 'Paid' && list.length > 0)
      setStepNum(status === 'WaitUpload' ? 2 : 3)
      setFileList(list)
      setVoucher(list.map((item) => item.save_name ?? '').filter(Boolean))
      if (!(status === 'Paid' && list.length > 0)) {
        const payRes = await payOrder({ id: orderId, gateway: 'UserCustom' })
        setPayHtml(payRes.data?.html ?? '')
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setPayLoading(false)
    }
  }

  useEffect(() => {
    if (!open || orderId == null) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- init 打开时同步置 loading 是合法的挂载副作用
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderId])

  // ---------- 附件 ----------

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    for (const file of files) {
      if (voucher.length >= 10) {
        toast.error(t('finance_custom18', '最多上传10个文件，限制图片或PDF格式。'))
        break
      }
      try {
        const res = await uploadTicketFile(file)
        if (res.status === 200 && res.data.save_name) {
          const item = {
            save_name: res.data.save_name,
            name: file.name,
            url: res.data.image_url,
          }
          setFileList((prev) => [...prev, item])
          setVoucher((prev) => [...prev, res.data.save_name])
        } else {
          toast.error(res.msg || '上传失败')
        }
      } catch (error) {
        toast.error(getErrorMessage(error))
      }
    }
  }

  function removeFile(item: { save_name?: string; name?: string; url?: string }) {
    setFileList((prev) => prev.filter((x) => x.save_name !== item.save_name))
    setVoucher((prev) => prev.filter((x) => x !== item.save_name))
  }

  /** 图片预览 / 非图片下载（官方 clickFile） */
  function clickFile(item: { save_name?: string; name?: string; url?: string }) {
    const imgUrl = item.url
    const name = item.name ?? ''
    if (!imgUrl) return
    if (isImageFile(imgUrl, name)) {
      setPreviewUrl(imgUrl)
    } else {
      const downloadElement = document.createElement('a')
      downloadElement.href = imgUrl
      downloadElement.download = name
      document.body.appendChild(downloadElement)
      downloadElement.click()
      downloadElement.remove()
    }
  }

  // ---------- 提交 / 变更支付方式 ----------

  async function submitProof() {
    if (orderId == null) return
    if (voucher.length === 0) {
      toast.warning(t('finance_custom13', '请上传凭证'))
      return
    }
    setSubmitLoading(true)
    try {
      const res = await uploadOrderProof({ id: orderId, voucher })
      toast.success(res.msg || t('finance_custom4', '上传凭证'))
      onRefresh(false, orderId)
      onOpenChange(false)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSubmitLoading(false)
    }
  }

  async function handleChangeWay() {
    if (orderId == null) return
    setChangeLoading(true)
    try {
      const res = await changeOrderPayType(orderId)
      toast.success(res.msg)
      setShowChangeWay(false)
      onRefresh(true, orderId)
      onOpenChange(false)
    } catch (error) {
      toast.error(getErrorMessage(error))
      setShowChangeWay(false)
    } finally {
      setChangeLoading(false)
    }
  }

  const stepLabels = [
    t('finance_custom7', '提交申请'),
    t('finance_custom4', '上传凭证'),
    orderStatus === 'ReviewFail'
      ? t('finance_custom9', '审核不通过')
      : t('finance_custom8', '管理员审核'),
    t('finance_custom10', '购买成功'),
  ]

  return (
    <div>
      <Dialog open={open} onOpenChange={(v) => !v && onOpenChange(false)}>
        <DialogContent className='sm:max-w-lg'>
          {isLook ? (
            <>
              <DialogHeader>
                <DialogTitle>{t('finance_custom19', '查看凭证')}</DialogTitle>
              </DialogHeader>
              <div className='space-y-2'>
                {fileList.map((item, index) => (
                  <button
                    key={`${item.save_name}-${index}`}
                    type='button'
                    onClick={() => clickFile(item)}
                    className='flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted'
                  >
                    <FileText className='h-4 w-4 shrink-0' />
                    <span className='truncate'>{item.name}</span>
                  </button>
                ))}
                {fileList.length === 0 && (
                  <p className='py-6 text-center text-sm text-muted-foreground'>
                    {t('finance_text58', '关闭')}
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button variant='outline' onClick={() => onOpenChange(false)}>
                  {t('finance_text58', '关闭')}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>
                  <div className='flex items-baseline justify-between gap-3'>
                    <span>
                      {t('finance_custom6', '订单ID')}：{orderId}
                    </span>
                    <span className='text-sm font-normal text-muted-foreground'>
                      {t('pay_text2', '应付金额')}
                      <span className='ml-1 font-semibold text-foreground'>
                        {currencyPrefix}
                        {formatMoney(orderInfo?.amount)}
                        {currencyCode}
                      </span>
                    </span>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className='space-y-4'>
                {/* 待付金额 / 已用余额 */}
                <div className='rounded-md border p-3 text-sm'>
                  <div>
                    {t('finance_custom11', '还需支付')}：
                    <span className='font-semibold'>
                      {currencyPrefix}
                      {formatMoney(Number(orderInfo?.amount_unpaid))}
                      {currencyCode}
                    </span>
                  </div>
                  <p className='mt-1 text-xs text-muted-foreground'>
                    ({t('finance_custom12', '余额已抵扣')}：{currencyPrefix}
                    {formatMoney(orderInfo?.credit)}
                    {currencyCode})
                  </p>
                </div>

                {/* 转账信息 */}
                <div>
                  {payLoading ? (
                    <div className='flex justify-center py-6'>
                      <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
                    </div>
                  ) : (
                    <div
                      className='break-all rounded-md border p-3 text-sm'
                      dangerouslySetInnerHTML={{ __html: payHtml }}
                    />
                  )}
                </div>

                {/* 步骤条 */}
                <div className='grid grid-cols-4 gap-1 text-center text-xs text-muted-foreground'>
                  {stepLabels.map((label, index) => (
                    <div key={index}>
                      <span className='block'>{index + 1}</span>
                      <span
                        className={
                          orderStatus === 'ReviewFail' && index === 2
                            ? 'text-destructive'
                            : index < stepNum
                              ? 'text-foreground'
                              : ''
                        }
                      >
                        {label}
                      </span>
                      {orderStatus === 'ReviewFail' && index === 2 && (
                        <span className='flex items-center justify-center gap-1'>
                          <span className='cursor-help text-muted-foreground' title={reviewFailReason}>
                            ?
                          </span>
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* 上传区 */}
                <div>
                  <p className='mb-2 text-sm font-medium'>
                    {t('finance_custom4', '上传凭证')}
                  </p>
                  <div
                    className='cursor-pointer rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground hover:bg-muted/40'
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <p>
                      {t('finance_custom16', '将文件拖到此处或')}
                      <em className='not-italic text-primary'>
                        {t('finance_custom17', '点击上传')}
                      </em>
                    </p>
                    <p className='mt-1 text-xs'>
                      {t('finance_custom18', '最多上传10个文件，限制图片或PDF格式。')}
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type='file'
                    multiple
                    hidden
                    accept='image/*,.pdf,.PDF'
                    onChange={handleUpload}
                  />
                  {fileList.length > 0 && (
                    <div className='mt-2 space-y-1.5'>
                      {fileList.map((item, index) => (
                        <div
                          key={`${item.save_name}-${index}`}
                          className='flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs'
                        >
                          <button
                            type='button'
                            className='flex min-w-0 flex-1 items-center gap-1.5 truncate hover:text-primary'
                            onClick={() => clickFile(item)}
                          >
                            {isImageFile(item.url, item.name) ? (
                              <img
                                src={item.url}
                                alt={item.name}
                                className='h-5 w-5 shrink-0 rounded object-cover'
                              />
                            ) : (
                              <FileText className='h-4 w-4 shrink-0' />
                            )}
                            <span className='truncate'>{item.name}</span>
                          </button>
                          <button
                            type='button'
                            aria-label='移除'
                            onClick={() => removeFile(item)}
                            className='text-muted-foreground hover:text-foreground'
                          >
                            <X className='h-3.5 w-3.5' />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant='outline' onClick={() => setShowChangeWay(true)}>
                  {t('finance_custom14', '变更支付方式')}
                </Button>
                <Button
                  onClick={submitProof}
                  disabled={voucher.length === 0 || submitLoading}
                >
                  {submitLoading && (
                    <Loader2 className='mr-1 h-4 w-4 animate-spin' />
                  )}
                  {orderStatus === 'WaitUpload'
                    ? t('finance_custom4', '上传凭证')
                    : t('finance_custom5', '重新上传')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 变更支付方式确认 */}
      <ConfirmDialog
        open={showChangeWay}
        onOpenChange={setShowChangeWay}
        title={t('finance_custom14', '变更支付方式')}
        desc={t('finance_custom15', '是否变更支付方式？')}
        confirmText={t('finance_btn8', '确认')}
        cancelBtnText={t('finance_btn7', '取消')}
        isLoading={changeLoading}
        handleConfirm={handleChangeWay}
      />

      {/* 图片预览 */}
      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl('')}>
        <DialogContent className='w-fit! max-w-[90vw]! border-0 bg-transparent p-0 shadow-none'>
          {previewUrl && (
            <img
              src={previewUrl}
              alt='预览'
              className='max-h-[85vh] w-auto max-w-[85vw] rounded-lg object-contain'
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
