import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchAccount,
  fetchCart,
  fetchCommon,
  fetchEventPromotion,
  fetchProductDetail,
  fetchProductPrice,
  fetchSubAccountAuth,
  settleCart,
  settleProduct,
  type CartItem,
  type EventPromotionItem,
  type ProductPriceData,
} from '@/api'
import { Loader2, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/api'
import { stripPreviewPrefix } from '@/lib/preview'
import { PreviewIcon } from '@/lib/preview-icon'
import { useClientLang } from '@/hooks/use-client-lang'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { PayDialog } from '@/features/client/finance/pay-dialog'

function formatMoneyFixed(value: string | number | undefined): string {
  const num = Number(value ?? 0)
  if (isNaN(num) || num < 0) return '0.00'
  return num.toFixed(2)
}

/** 按需计费流量单价（ProductPriceData 索引签名 unknown，需显式转数字） */
function onDemandFlowPrice(info?: ProductPriceData): number {
  return Number(info?.base_on_demand_flow_price ?? 0)
}

/** 商品配置明细：主产品 preview + 子产品/下游 preview 拍平（官方 son_previews 逻辑） */
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

/** 结算行：购物车项 或 直接购买商品对象（product_information） */
interface SettleLine {
  position?: number
  product_id: number
  qty: number
  config_options: Record<string, unknown>
  customfield: Record<string, unknown>
  self_defined_field?: Record<string, unknown>
  name?: string
  isLoading?: boolean
  info?: ProductPriceData
  preview?: Array<{ name?: string; value?: string; price?: string }>
  price?: number
  calcItemPrice?: number
  level_discount?: number
  code_discount?: number
  eventDiscount?: number
}

/** 已选活动促销展示（官方 eventCode 组件 disabled 态） */
function SettlementEventCode({ line }: { line: SettleLine }) {
  const { t } = useClientLang()
  const [event, setEvent] = useState<EventPromotionItem | null>(null)
  const nowParamsRef = useRef('')

  useEffect(() => {
    const info = line.info
    if (!info || info.duration === '' || !line.eventDiscount) return
    const params = {
      id: line.product_id,
      qty: line.qty,
      amount: line.price ?? 0,
      billing_cycle_time: info.duration ?? '',
    }
    const key = JSON.stringify(params)
    if (key === nowParamsRef.current) return
    nowParamsRef.current = key
    let active = true
    fetchEventPromotion(params)
      .then((res) => {
        if (!active) return
        const selectedId = String(
          (line.customfield as Record<string, unknown>).event_promotion ?? ''
        )
        const selected = res.data?.list?.find(
          (item) => String(item.id) === selectedId
        )
        setEvent(selected ?? null)
      })
      .catch(() => {
        if (active) setEvent(null)
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 事件参数由 info/price 派生，customfield 仅取 event_promotion
  }, [line.info, line.product_id, line.qty, line.price, line.eventDiscount])

  if (!event) return null

  const label =
    event.type === 'percent'
      ? `${t('goods_text1', '立折')} ${event.value}%`
      : event.type === 'reduce'
        ? `${t('goods_text2', '满')}${event.full}${t('goods_text3', '减')} ${event.value}`
        : t('goods_text6', '不参加活动')

  return (
    <span className='mt-1.5 inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary'>
      {label}
    </span>
  )
}

export function SettlementPage() {
  const { t } = useClientLang()

  // ---------- 通用配置（与 ClientLayout 同 key 复用缓存） ----------
  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  const commonData = useMemo(
    () => (commonQuery.data?.data ?? {}) as Record<string, unknown>,
    [commonQuery.data]
  )
  const currencyPrefix = (commonData.currency_prefix as string) ?? '¥'
  const donotSavePassword = (commonData.donot_save_client_product_password as number) === 1

  // ---------- 入口判断：?cart=1 来自购物车，否则来自商品配置页直接购买 ----------
  const search = useMemo(() => new URLSearchParams(window.location.search), [])
  const fromCart = search.get('cart') === '1'
  const urlProductId = Number(search.get('id')) || 0

  const [lines, setLines] = useState<SettleLine[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [checked, setChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // 支付弹窗
  const [payOrderId, setPayOrderId] = useState<number | null>(null)

  // 页面标题（官方 getCommonData：站点名-商品结算）
  useEffect(() => {
    const base = (commonData.website_name as string) || 'FurLL'
    document.title = `${base} - ${t('shoppingCar_tip_text7', '商品结算')}`
  }, [commonData, t])

  // ---------- 子账户支付权限（官方 getRule：PayController::pay） ----------
  const [showPayBtn, setShowPayBtn] = useState(false)
  useEffect(() => {
    let active = true
    fetchAccount()
      .then((res) => {
        if (!active || res.status !== 200) return
        const account = res.data.account
        const isSubAccount =
          (account.customfield as { is_sub_account?: number } | undefined)
            ?.is_sub_account === 1
        if (!isSubAccount) {
          setShowPayBtn(true)
          return
        }
        return fetchSubAccountAuth(account.id as number).then((authRes) => {
          if (active && authRes.status === 200) {
            const rule = authRes.data.rule ?? []
            setShowPayBtn(rule.some((r) => r.includes('PayController::pay')))
          }
        })
      })
      .catch(() => {
        if (active) setShowPayBtn(false)
      })
    return () => {
      active = false
    }
  }, [])

  // ---------- 拉取结算列表并逐个算价（官方 getCartList + getConfigOption） ----------
  useEffect(() => {
    let active = true
    async function load() {
      setListLoading(true)
      let initArr: SettleLine[]
      try {
        if (fromCart) {
          // 从购物车结算：sessionStorage.shoppingCartList 为选中 position 数组
          const positions = JSON.parse(
            sessionStorage.shoppingCartList ?? '[]'
          ) as number[]
          const res = await fetchCart()
          const list = res.data?.list ?? []
          initArr = positions
            .map((p) => list[p])
            .filter(Boolean)
            .map((item: CartItem) => ({ ...item, position: undefined }))
        } else {
          // 直接购买：sessionStorage.product_information（官方 settleItem 迁移逻辑）
          const raw =
            sessionStorage.product_information ||
            sessionStorage.settleItem ||
            '{}'
          const obj = JSON.parse(raw)
          // 官方 created()：product_information 迁移到 settleItem 并移除，刷新页面仍能回显
          sessionStorage.settleItem = raw
          sessionStorage.removeItem('product_information')
          const productId = urlProductId || obj.product_id || obj.id || ''
          const line: SettleLine = {
            product_id: productId,
            config_options: obj.config_options ?? {},
            qty: Number(obj.qty) || 1,
            customfield: obj.customfield ?? {},
            self_defined_field: obj.self_defined_field ?? {},
          }
          // 商品名（官方 productDetail）
          if (productId) {
            try {
              const detailRes = await fetchProductDetail(Number(productId))
              line.name = detailRes.data?.product?.name
            } catch {
              // 名称获取失败忽略，行内显示 product_id
            }
          }
          initArr = [line]
        }

        // 每个商品初始折扣字段 + 算价
        initArr = initArr.map((item) => ({
          ...item,
          isLoading: true,
          price: 0,
          calcItemPrice: 0,
          level_discount: 0,
          code_discount: 0,
          eventDiscount: 0,
        }))
        if (!active) return
        setLines(initArr)

        await Promise.all(
          initArr.map(async (line) => {
            try {
              const res = await fetchProductPrice(line.product_id, {
                config_options: {
                  ...(line.config_options as Record<string, unknown>),
                  promo_code: (line.customfield as Record<string, unknown>)
                    .promo_code,
                  event_promotion: (line.customfield as Record<string, unknown>)
                    .event_promotion,
                },
                qty: line.qty,
              })
              const data = res.data
              const updated: SettleLine = {
                ...line,
                isLoading: false,
                info: data,
                preview: collectPreview(data),
                price: Number(data.price ?? 0),
                calcItemPrice: Number(data.price_total ?? 0),
                level_discount:
                  Number(data.price_client_level_discount ?? 0) || 0,
                code_discount: Number(data.price_promo_code_discount ?? 0) || 0,
                eventDiscount: Number(data.price_event_promotion_discount ?? 0) || 0,
              }
              setLines((prev) =>
                prev.map((l) =>
                  l.product_id === line.product_id ? updated : l
                )
              )
            } catch {
              setLines((prev) =>
                prev.map((l) =>
                  l.product_id === line.product_id
                    ? { ...l, isLoading: false, preview: [] }
                    : l
                )
              )
            }
          })
        )
      } catch {
        setLines([])
      } finally {
        if (active) setListLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [fromCart, urlProductId])

  // ---------- 合计（官方 computed：finallyPrice = totalPrice） ----------
  const totalPrice = useMemo(
    () => lines.reduce((pre, cur) => pre + (cur.calcItemPrice ?? 0), 0),
    [lines]
  )
  const orginPrice = useMemo(
    () => lines.reduce((pre, cur) => pre + (cur.price ?? 0), 0),
    [lines]
  )
  const totalLevelDiscount = useMemo(
    () => lines.reduce((pre, cur) => pre + (cur.level_discount ?? 0), 0),
    [lines]
  )
  const totalCodelDiscount = useMemo(
    () => lines.reduce((pre, cur) => pre + (cur.code_discount ?? 0), 0),
    [lines]
  )
  const totalFullDiscount = useMemo(
    () => lines.reduce((pre, cur) => pre + (cur.eventDiscount ?? 0), 0),
    [lines]
  )
  const finallyPrice = totalPrice

  // ---------- 提交订单（官方 goPay） ----------
  async function goPay() {
    if (!checked) {
      toast.warning(t('shoppingCar_tip_text6', '请先勾选协议后再提交订单'))
      return
    }
    const beforeSettle = (
      commonData.custom_fields as { before_settle?: number } | undefined
    )?.before_settle
    if (beforeSettle === 1) {
      window.open('/account.htm')
      return
    }
    setSubmitting(true)
    try {
      let res: { status: number; msg: string; data?: { order_id?: number } }
      if (fromCart) {
        const positions = JSON.parse(
          sessionStorage.shoppingCartList ?? '[]'
        ) as number[]
        res = await settleCart({ positions })
      } else {
        const line = lines[0]
        res = await settleProduct({
          product_id: line.product_id,
          config_options: line.config_options,
          customfield: line.customfield,
          self_defined_field: line.self_defined_field,
          qty: line.qty,
        })
      }
      if (res.status === 200 && res.data?.order_id) {
        setPayOrderId(res.data.order_id)
      } else {
        const cert = (res as { data?: { certification?: number } }).data
          ?.certification
        if (cert === 0) {
          toast.error(
            `${res.msg} `,
            {
              description: (
                <a
                  href='/authentication_select.htm'
                  className='text-primary underline'
                >
                  {t('wx_tip7', '去实名')}
                </a>
              ),
            }
          )
        } else {
          toast.error(res.msg || '提交订单失败')
        }
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  function paySuccess() {
    window.location.href = '/finance.htm'
  }
  function payCancel() {
    window.location.href = '/finance.htm'
  }

  function goHelpUrl(key: string) {
    const url = commonData[key] as string | undefined
    if (url) window.open(url)
  }

  const discountLine = (line: SettleLine) => (
    <>
      {Number(line.level_discount ?? 0) > 0 && (
        <p>
          {t('shoppingCar_tip_text2', '等级折扣金额')}：{currencyPrefix}
          {formatMoneyFixed(line.level_discount)}
        </p>
      )}
      {Number(line.code_discount ?? 0) > 0 && (
        <p>
          {t('shoppingCar_tip_text4', '优惠券折扣金额')}：{currencyPrefix}
          {formatMoneyFixed(line.code_discount)}
        </p>
      )}
      {Number(line.eventDiscount ?? 0) > 0 && (
        <p>
          {t('goods_text4', '商品活动折扣金额')}：{currencyPrefix}
          {formatMoneyFixed(line.eventDiscount)}
        </p>
      )}
    </>
  )

  return (
    <div className='space-y-4 pb-32'>
      {/* 页面标题 */}
      <div className='mb-2'>
        <h1 className='text-2xl font-bold tracking-tight'>
          {t('settlement_title', '请核对商品信息')}
        </h1>
        {donotSavePassword && (
          <p className='mt-1 text-sm text-muted-foreground'>
            {t('dont_save_password_tip', '产品不保存密码信息，如忘记密码请通过重置找回')}
          </p>
        )}
      </div>

      {listLoading ? (
        <div className='space-y-3'>
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className='p-4'>
              <Skeleton className='h-5 w-2/5' />
              <Skeleton className='mt-3 h-10 w-full' />
              <Skeleton className='mt-1.5 h-10 w-full' />
            </Card>
          ))}
        </div>
      ) : lines.length === 0 ? (
        <div className='flex flex-col items-center gap-3 rounded-lg border bg-background py-20 text-center'>
          <p className='text-muted-foreground'>没有待结算的商品</p>
          <Button
            variant='outline'
            onClick={() => (window.location.href = '/cart/goodsList.htm')}
          >
            去选购
          </Button>
        </div>
      ) : (
        <div className='space-y-4'>
          {lines.map((line) => {
            const isOnDemand = line.info?.host_billing_cycle === 'on_demand'
            const infoLoading = line.isLoading
            return (
              <div
                key={line.product_id}
                className='overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm'
              >
                {/* 商品名（卡顶通栏，与表格顶部对齐） */}
                <div className='border-b bg-muted/40 px-4 py-3 sm:px-5'>
                  <span className='text-sm font-semibold text-foreground'>
                    {line.name || `商品 #${line.product_id}`}
                  </span>
                </div>

                <div className='overflow-x-auto'>
                  <table className='w-full min-w-[720px] text-sm'>
                    <thead>
                      <tr className='border-b bg-muted/40 text-left text-muted-foreground'>
                        <th className='px-4 py-2.5 font-medium sm:px-5'>
                          {t('settlement_goodsInfo', '配置详情')}
                        </th>
                        <th className='px-4 py-2.5 font-medium'>
                          {t('settlement_goodsPrice', '单价')}
                        </th>
                        <th className='px-4 py-2.5 font-medium'>
                          {t('settlement_goodsNums', '数量')}
                        </th>
                        <th className='px-4 py-2.5 text-right font-medium'>
                          {t('settlement_goodsTotalPrice', '小计')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className='border-b last:border-0'>
                        {/* 配置详情 */}
                        <td className='align-top px-4 py-4 sm:px-5'>
                          {infoLoading ? (
                            <div className='space-y-2'>
                              <Skeleton className='h-4 w-3/5' />
                              <Skeleton className='h-4 w-2/5' />
                            </div>
                          ) : (line.preview?.length ?? 0) === 0 ? (
                            <span className='text-muted-foreground'>--</span>
                          ) : (
                            <div className='space-y-1.5'>
                              {line.preview!.map((infoItem, index) => (
                                <div
                                  key={index}
                                  className='flex flex-wrap items-center gap-2'
                                >
                                  <span className='flex min-w-0 items-center gap-1.5'>
                                    {infoItem.name && (
                                      <span className='text-muted-foreground'>
                                        {infoItem.name}：
                                      </span>
                                    )}
                                    <PreviewIcon
                                      name={infoItem.name}
                                      value={infoItem.value}
                                      className='shrink-0'
                                    />
                                    <span className='text-foreground'>
                                      {stripPreviewPrefix(infoItem.value ?? '')}
                                    </span>
                                  </span>
                                  <span className='ml-auto shrink-0'>
                                    {currencyPrefix}
                                    {formatMoneyFixed(infoItem.price)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* 单价 */}
                        <td className='align-top px-4 py-4'>
                          {infoLoading ? (
                            <Skeleton className='h-4 w-20' />
                          ) : isOnDemand ? (
                            <div className='space-y-0.5 text-[13px]'>
                              <div>
                                {currencyPrefix}
                                <span className='font-medium'>
                                  {formatMoneyFixed(line.info?.base_price)}
                                </span>
                                <span className='text-muted-foreground'>
                                  {' '}
                                  {t('demand_text1', '配置费')}
                                </span>
                              </div>
                              <div>
                                {currencyPrefix}
                                <span className='font-medium'>
                                  {formatMoneyFixed(
                                    line.info?.base_renew_price
                                  )}
                                </span>
                                <span className='text-muted-foreground'>
                                  /{t('demand_text2', '小时')}
                                </span>
                              </div>
                              {onDemandFlowPrice(line.info) > 0 && (
                                <div>
                                  {currencyPrefix}
                                  <span className='font-medium'>
                                    {formatMoneyFixed(
                                      onDemandFlowPrice(line.info)
                                    )}
                                  </span>
                                  <span className='text-muted-foreground'>
                                    /GB
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className='text-foreground'>
                              {currencyPrefix}
                              {formatMoneyFixed(
                                Number(line.price ?? 0) / (line.qty || 1)
                              )}
                              {line.info?.billing_cycle && (
                                <>
                                  {' '}
                                  /{' '}
                                  {(
                                    line.info.customfield as
                                      | { multi_language?: { billing_cycle?: string } }
                                      | undefined
                                  )?.multi_language?.billing_cycle ||
                                    line.info.billing_cycle}
                                </>
                              )}
                            </span>
                          )}
                        </td>

                        {/* 数量 */}
                        <td className='align-top px-4 py-4'>
                          <span className='tabular-nums'>{line.qty}</span>
                        </td>

                        {/* 小计 */}
                        <td className='align-top px-4 py-4 text-right'>
                          {infoLoading ? (
                            <Skeleton className='ml-auto h-5 w-24' />
                          ) : (
                            <div className='inline-flex flex-col items-end'>
                              <div className='relative inline-block'>
                                <span className='text-base font-bold text-primary tabular-nums'>
                                  {currencyPrefix}
                                  {formatMoneyFixed(line.calcItemPrice)}
                                </span>
                              </div>
                              {Number(line.price ?? 0) !==
                                Number(line.calcItemPrice ?? 0) && (
                                <>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <button
                                        type='button'
                                        className='mt-0.5 inline-flex cursor-pointer items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground'
                                        aria-label='查看优惠明细'
                                      >
                                        <ShieldAlert className='h-3.5 w-3.5' />
                                        已优惠
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                      align='end'
                                      side='top'
                                      className='w-max max-w-64 p-3'
                                    >
                                      <div className='space-y-1 text-[13px]'>
                                        {discountLine(line)}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                  <span className='text-[13px] text-muted-foreground line-through'>
                                    {currencyPrefix}
                                    {formatMoneyFixed(line.price)}
                                  </span>
                                </>
                              )}
                              <SettlementEventCode line={line} />
                              {String(line.customfield?.promo_code ?? '') && (
                                <span className='mt-1.5 text-xs font-bold text-primary'>
                                  {String(line.customfield.promo_code)}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ---------- 底部结算栏（官方 el-footer） ---------- */}
      {!listLoading && lines.length > 0 && (
        <div className='fixed inset-x-4 bottom-3 z-20 rounded-lg border bg-card/95 p-4 shadow-sm backdrop-blur md:start-[calc(var(--sidebar-width)+1rem)] peer-data-[collapsible=icon]:md:start-[calc(var(--sidebar-width-icon)+1rem)] peer-data-[collapsible=offcanvas]:md:start-4 md:end-4'>
          <div className='flex flex-wrap items-center gap-x-4 gap-y-3'>
            {/* 合计 */}
            <div className='min-w-0'>
              <span className='text-sm text-muted-foreground'>
                {t('settlement_tip2', '合计')}：
              </span>
              <span className='text-2xl font-bold text-primary tabular-nums'>
                {currencyPrefix}
                {formatMoneyFixed(finallyPrice)}
              </span>
              {(Number(orginPrice) !== Number(totalPrice) ||
                Number(finallyPrice) !== Number(totalPrice)) &&
                (totalLevelDiscount > 0 ||
                  totalCodelDiscount > 0 ||
                  totalFullDiscount > 0) && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type='button'
                        className='ml-1.5 inline-flex cursor-pointer items-center text-muted-foreground hover:text-foreground'
                        aria-label='查看优惠明细'
                      >
                        <ShieldAlert className='h-4 w-4' />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align='end'
                      side='top'
                      className='w-max max-w-64 p-3'
                    >
                      <div className='space-y-1 text-[13px]'>
                        {totalLevelDiscount > 0 && (
                          <p>
                            {t('shoppingCar_tip_text2', '等级折扣金额')}：
                            {currencyPrefix}
                            {formatMoneyFixed(totalLevelDiscount)}
                          </p>
                        )}
                        {totalCodelDiscount > 0 && (
                          <p>
                            {t('shoppingCar_tip_text4', '优惠券折扣金额')}：
                            {currencyPrefix}
                            {formatMoneyFixed(totalCodelDiscount)}
                          </p>
                        )}
                        {totalFullDiscount > 0 && (
                          <p>
                            {t('goods_text4', '商品活动折扣金额')}：
                            {currencyPrefix}
                            {formatMoneyFixed(totalFullDiscount)}
                          </p>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
            </div>

            {/* 提交订单 + 协议勾选 */}
            {showPayBtn && (
              <div className='ml-auto flex flex-col items-end gap-1.5'>
                <Button onClick={goPay} disabled={submitting}>
                  {submitting && (
                    <Loader2 className='mr-1 h-4 w-4 animate-spin' />
                  )}
                  {t('settlement_tip3', '提交订单')}
                </Button>
                <label className='flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground'>
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => setChecked(Boolean(v))}
                  />
                  <span>{t('settlement_tip4', '已阅读并同意')}</span>
                  <span
                    className='cursor-pointer text-primary hover:underline'
                    onClick={() => goHelpUrl('terms_service_url')}
                  >
                    {t('read_service', '《服务协议》')}
                  </span>
                  {t('settlement_tip6', '和')}
                  <span
                    className='cursor-pointer text-primary hover:underline'
                    onClick={() => goHelpUrl('terms_privacy_url')}
                  >
                    {t('read_privacy', '《隐私协议》')}
                  </span>
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------- 支付弹窗（官方 payDialog） ---------- */}
      <PayDialog
        open={payOrderId !== null}
        orderId={payOrderId}
        onOpenChange={(open) => {
          if (!open) setPayOrderId(null)
        }}
        onPaySuccess={paySuccess}
        onPayCancel={payCancel}
      />
    </div>
  )
}
