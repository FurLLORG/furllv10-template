import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Download } from 'lucide-react'
import { fetchCommon } from '@/api'
import {
  fetchOrderDetail,
  fetchOrderTransactionRecord,
  type OrderTransactionItem,
} from '@/api/finance'
import { useClientLang } from '@/hooks/use-client-lang'
import { formatMoney, formatTime } from './shared'
import { PayDialog } from './pay-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

/**
 * 订单详情（官方 /orderDetail.htm?id=，对照官方 orderDetail.php + js/orderDetail.js）。
 * - 订单头部：客户名称 / 订单号 / 下单时间 + 状态 / 去支付 / 支付信息
 * - 自选字段 self_defined_field
 * - 商品明细 GET /order/:id（items）+ 合计
 * - 交易记录 GET /order/:id/transaction_record
 * - 下载 PDF：打印版导出（浏览器打印另存为 PDF，官方 html2pdf 等价物）
 * - 去支付复用 PayDialog（官方 payDialog 组件）
 */

// 订单状态（官方 orderData.status 分支）
const STATUS_TEXT: Record<string, { key: string; className: string }> = {
  Unpaid: { key: 'order_text4', className: 'bg-destructive text-white' },
  Paid: { key: 'order_text5', className: 'bg-primary text-white' },
  Refunded: { key: 'order_text6', className: 'bg-destructive text-white' },
  WaitUpload: { key: 'finance_custom1', className: 'bg-amber-500 text-white' },
  WaitReview: { key: 'finance_custom2', className: 'bg-amber-500 text-white' },
  ReviewFail: { key: 'finance_custom3', className: 'bg-destructive text-white' },
}

export function OrderDetailPage() {
  const { t } = useClientLang()
  const orderId = useMemo(() => {
    const id = new URLSearchParams(window.location.search).get('id')
    return id ? Number(id) : null
  }, [])
  const printRef = useRef<HTMLDivElement>(null)
  const [payOpen, setPayOpen] = useState(false)

  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  const commonData = useMemo(
    () => (commonQuery.data?.data ?? {}) as Record<string, unknown>,
    [commonQuery.data]
  )
  const currencyPrefix = String(commonData.currency_prefix ?? '￥')

  const orderQuery = useQuery({
    queryKey: ['finance-order-detail', orderId],
    queryFn: () => fetchOrderDetail(orderId as number),
    enabled: orderId != null,
    retry: false,
  })
  const orderData = orderQuery.data?.data.order
  const selfDefinedField = orderQuery.data?.data.self_defined_field

  const transactionQuery = useQuery({
    queryKey: ['finance-order-transactions', orderId],
    queryFn: () => fetchOrderTransactionRecord(orderId as number),
    enabled: orderId != null,
    retry: false,
  })
  const transactionList = transactionQuery.data?.data.list ?? []

  // 页面标题（官方 getCommonData）
  useEffect(() => {
    const base = (commonData.website_name as string) || 'FurLL'
    document.title = `${base} - ${t('order_text1', '订单详情')}`
  }, [commonData, t])

  const status = orderData?.status
  const statusMeta = status ? STATUS_TEXT[status] : undefined

  // 支付信息（官方 info-right 下：pay_time + gateway/credit 分支）
  function renderPayInfo() {
    if (orderData?.pay_time) {
      return <div>{formatTime(orderData.pay_time)}</div>
    }
    if (status !== 'Unpaid' && orderData?.gateway) {
      if (orderData.gateway_sign === 'credit') {
        return <div>{t('order_text8', '余额支付')}</div>
      }
      if (
        Number(orderData.credit ?? 0) > 0 &&
        String(orderData.credit ?? '') !== String(orderData.amount ?? '')
      ) {
        return (
          <div>
            <span className='text-amber-600'>{t('order_text9', '余额')}</span>+
            {orderData.gateway}
          </div>
        )
      }
      return <div>{orderData.gateway}</div>
    }
    return null
  }

  // 下载 PDF（官方 handelPdf：打印订单区域另存为 PDF）
  function handlePdf() {
    if (!printRef.current) return
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)
    const doc = iframe.contentDocument
    if (!doc) {
      iframe.remove()
      return
    }
    doc.open()
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${orderId ?? ''}-${t(
      'order_text22',
      '订单详情'
    )}</title><style>
      * { box-sizing: border-box; }
      body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; color: #1e2736; padding: 24px; }
      .print-order { font-size: 13px; }
      .po-head { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e6e7eb; padding-bottom: 16px; }
      .po-user { font-size: 16px; font-weight: 600; }
      .po-meta { color: #666b80; margin-top: 8px; }
      .po-meta span { color: #1e2736; margin-left: 4px; }
      .po-status { font-size: 14px; color: #fff; padding: 4px 12px; border-radius: 4px; }
      .po-table { margin-top: 24px; border: 1px solid #e6e7eb; border-radius: 4px; }
      .po-row { display: flex; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid #e6e7eb; }
      .po-row:last-child { border-bottom: none; }
      .po-th { background: #fafbff; font-weight: 600; }
      .po-amount { color: #666b80; }
      .po-total { font-weight: 600; }
      .po-total .po-amount { color: #1e2736; }
      .po-trans { margin-top: 24px; }
      .po-trans-title { font-weight: 600; margin-bottom: 8px; }
      .po-trans-head, .po-trans-row { display: flex; border-bottom: 1px solid #e6e7eb; padding: 8px 0; }
      .po-trans-head { font-weight: 600; }
      .po-col { flex: 1; }
      .po-col-2 { width: 120px; flex: none; }
      .po-col-r { text-align: right; }
    </style></head><body><div class="print-order">${printRef.current.innerHTML}</div></body></html>`)
    doc.close()
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    // 打印/关闭后清理 iframe
    setTimeout(() => iframe.remove(), 1000)
  }

  function handlePaySuccess() {
    orderQuery.refetch()
    transactionQuery.refetch()
    setPayOpen(false)
  }

  const loading = orderQuery.isLoading || orderId == null

  return (
    <div className='space-y-4'>
      <div className='flex items-center gap-3'>
        <Button
          variant='ghost'
          size='icon'
          onClick={() => window.history.back()}
          aria-label='返回'
        >
          <ArrowLeft className='h-5 w-5' />
        </Button>
        <h1 className='text-xl font-bold tracking-tight'>
          {t('order_text1', '订单详情')}
        </h1>
      </div>

      <Card>
        <CardContent className='p-5 sm:p-6'>
          {loading ? (
            <div className='space-y-3'>
              <Skeleton className='h-10 w-full' />
              <Skeleton className='h-32 w-full' />
              <Skeleton className='h-20 w-full' />
            </div>
          ) : !orderData ? (
            <div className='py-12 text-center text-sm text-muted-foreground'>
              {t('order_text15', '暂无数据')}
            </div>
          ) : (
            <>
              {/* 订单头部（官方 order-info） */}
              <div
                ref={printRef}
                className='space-y-5'
              >
                <div className='flex flex-wrap items-start justify-between gap-4'>
                  <div className='min-w-[220px] space-y-1'>
                    <div className='text-lg font-semibold'>
                      {orderData.client_name}
                    </div>
                    <div className='text-sm text-muted-foreground'>
                      {t('order_text2', '订单号：')}
                      <span>{orderData.id}</span>
                    </div>
                    <div className='text-sm text-muted-foreground'>
                      {t('order_text3', '订单日期：')}
                      <span>{formatTime(orderData.create_time)}</span>
                    </div>
                  </div>
                  <div className='flex flex-col items-center gap-2'>
                    <Badge className={statusMeta?.className ?? 'bg-secondary text-secondary-foreground'}>
                      {statusMeta ? t(statusMeta.key) : (status ?? '--')}
                    </Badge>
                    <div className='text-center'>
                      {status === 'Unpaid' ? (
                        <button
                          type='button'
                          className='cursor-pointer text-sm text-primary hover:underline'
                          onClick={() => setPayOpen(true)}
                        >
                          {t('order_text7', '去支付')}
                        </button>
                      ) : null}
                      <div className='text-sm font-semibold text-foreground'>
                        {renderPayInfo()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 自选字段（官方 self-field） */}
                {selfDefinedField && selfDefinedField.length > 0 ? (
                  <div className='space-y-1'>
                    {selfDefinedField.map((item) => (
                      <div key={item.id} className='text-sm'>
                        <span className='shrink-0'>{item.field_name}：</span>
                        <span className='whitespace-pre text-muted-foreground'>
                          {item.value || '--'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* 商品明细（官方 order-table） */}
                <div className='overflow-hidden rounded-md border'>
                  <div className='border-b bg-muted/40 px-4 py-2.5 text-sm font-medium'>
                    {t('order_text1', '订单详情')}
                  </div>
                  <div className='divide-y'>
                    <div className='flex items-center justify-between bg-muted/20 px-4 py-2.5 text-sm font-medium'>
                      <span>{t('order_text10', '描述')}</span>
                      <span>{t('order_text11', '金额')}</span>
                    </div>
                    {(orderData.items ?? []).map((item) => (
                      <div
                        key={item.id}
                        className='flex items-center justify-between gap-4 px-4 py-2.5 text-sm'
                      >
                        <span className='text-muted-foreground'>{item.description}</span>
                        <span className='shrink-0 text-muted-foreground'>
                          {currencyPrefix}
                          {formatMoney(item.amount)}
                        </span>
                      </div>
                    ))}
                    <div className='flex items-center justify-between px-4 py-2.5 text-sm font-semibold'>
                      <span>{t('order_text12', '总额')}</span>
                      <span>
                        {currencyPrefix}
                        {formatMoney(orderData.amount)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 交易记录（官方 order-transaction） */}
                <div>
                  <div className='overflow-x-auto'>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className='w-44'>
                            {t('order_text13', '交易日期')}
                          </TableHead>
                          <TableHead className='w-40'>
                            {t('finance_label1', '商品名称')}
                          </TableHead>
                          <TableHead className='w-40'>
                            {t('finance_custom21', '产品标识')}
                          </TableHead>
                          <TableHead>{t('finance_custom22', '交易记录')}</TableHead>
                          <TableHead className='w-24 text-end'>
                            {t('order_text11', '金额')}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactionQuery.isLoading ? (
                          <TableRow>
                            <TableCell colSpan={5}>
                              <Skeleton className='h-8 w-full' />
                            </TableCell>
                          </TableRow>
                        ) : transactionList.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={5}
                              className='h-16 text-center text-sm text-muted-foreground'
                            >
                              {t('order_text15', '暂无数据')}
                            </TableCell>
                          </TableRow>
                        ) : (
                          transactionList.map((item: OrderTransactionItem) => (
                            <TableRow key={item.id}>
                              <TableCell>{formatTime(item.create_time)}</TableCell>
                              <TableCell>{item.product_name || '--'}</TableCell>
                              <TableCell>{item.host_name || '--'}</TableCell>
                              <TableCell>{item.description || '--'}</TableCell>
                              <TableCell className='text-end'>
                                {currencyPrefix}
                                {formatMoney(item.amount)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 下载 PDF（官方 down-pag） */}
      {orderData ? (
        <div className='flex justify-center'>
          <Button variant='outline' onClick={handlePdf}>
            <Download className='mr-1 h-4 w-4' />
            {t('order_text16', '下载')}
          </Button>
        </div>
      ) : null}

      {/* 去支付（官方 payDialog） */}
      <PayDialog
        open={payOpen}
        orderId={payOpen ? (orderId as number) : null}
        onOpenChange={(open) => {
          if (!open) setPayOpen(false)
        }}
        onPaySuccess={handlePaySuccess}
        onPayCancel={() => setPayOpen(false)}
      />
    </div>
  )
}
