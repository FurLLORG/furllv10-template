import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronDown, Coins, Loader2 } from 'lucide-react'
import { fetchCommon } from '@/api'
import {
  fetchCoinList,
  fetchCoinUseDetail,
  fetchCoinWaitList,
  getCoin,
  type CoinItem,
} from '@/api/finance'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useClientLang } from '@/hooks/use-client-lang'
import { getErrorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'
import { formatMoney, formatTimeFull, PaginationBar } from './shared'

/**
 * 财务中心 - 平台币（Coin 插件）。
 * 待使用/待领取/已使用/已过期列表 + 领取 + 使用明细，数据走 /console/v1/coin/*。
 */

type CoinType = 'active' | 'wait' | 'used_up' | 'expired'

function CoinDetail({ item }: { item: CoinItem }) {
  const { t } = useClientLang()
  const hostIds = item.host_ids ?? []
  const products = item.product ?? []
  const cycles = item.cycle ?? []

  const scenarios: string[] = []
  if (item.order_available === 1) scenarios.push(t('coin_text133', '新购'))
  if (item.renew_available === 1) scenarios.push(t('coin_text134', '续费'))
  if (item.upgrade_available === 1) scenarios.push(t('coin_text135', '升降级'))
  if (item.demand_available === 1)
    scenarios.push(t('coin_text136', '按需转包年包月'))

  return (
    <div className='space-y-1.5 border-t bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground'>
      {item.certification_can_use === 1 && (
        <p>{t('coin_text48', '需要通过实名认证')}</p>
      )}
      {item.with_event_promotion_use === 0 && (
        <p>{t('coin_text49', '不能与促销活动同时使用')}</p>
      )}
      {item.with_promo_code_use === 0 && (
        <p>{t('coin_text50', '不能与优惠码同时使用')}</p>
      )}
      {item.with_client_level_use === 0 && (
        <p>{t('coin_text51', '不能与用户等级优惠同时使用')}</p>
      )}
      {item.with_voucher_use === 0 && (
        <p>{t('coin_text52', '不能与代金券同时使用')}</p>
      )}
      {hostIds.length > 0 && (
        <p>
          {t('coin_text64', '仅限以下产品使用')}：
          {hostIds.map((el, i) => (
            <span key={el}>
              <a
                href={`/productdetail.htm?id=${el}`}
                target='_blank'
                rel='noreferrer'
                className='text-primary underline'
              >
                ID:{el}
              </a>
              {i < hostIds.length - 1 && '、'}
            </span>
          ))}
        </p>
      )}
      {hostIds.length === 0 &&
        (products.length > 0 ? (
          <p>
            {t('coin_text47', '可使用商品')}：
            {products.map((el, i) => (
              <span key={el.id}>
                <a
                  href={`/cart/goods.htm?id=${el.id}`}
                  target='_blank'
                  rel='noreferrer'
                  className='text-primary underline'
                >
                  {el.name ?? `#${el.id}`}
                </a>
                {i < products.length - 1 && '、'}
              </span>
            ))}
          </p>
        ) : (
          <p>{t('coin_text74', '所有商品均可使用')}</p>
        ))}
      {item.product_only_defence === 1 && (
        <p>{t('coin_text65', '仅用于防御')}</p>
      )}
      {scenarios.length > 0 && (
        <p>
          {t('coin_text132', '使用场景')}：{scenarios.join('、')}
        </p>
      )}
      {item.cycle_limit === 1 && (
        <p>
          {t('coin_text5', '以下周期可以使用')}：
          {cycles.map((cycle, i) => (
            <span key={cycle}>
              {t(cycle, cycle)}
              {i < cycles.length - 1 && '、'}
            </span>
          ))}
        </p>
      )}
    </div>
  )
}

export default function CoinTab({
  onCoinChanged,
}: {
  onCoinChanged?: () => void
}) {
  const { t } = useClientLang()
  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  const currencyPrefix = String(commonQuery.data?.data.currency_prefix || '¥')

  const [coinType, setCoinType] = useState<CoinType>('active')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(24)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [gettingId, setGettingId] = useState<number | null>(null)
  const [detailItem, setDetailItem] = useState<CoinItem | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailRows, setDetailRows] = useState<
    NonNullable<CoinItem['use_detail_list']>
  >([])

  const waitTotalQuery = useQuery({
    queryKey: ['coin-wait-total'],
    queryFn: () => fetchCoinWaitList({ page: 1, limit: 1 }),
    retry: false,
  })
  const waitCoinTotal = waitTotalQuery.data?.data.count ?? 0

  const isWait = coinType === 'wait'
  const listQuery = useQuery({
    queryKey: isWait
      ? ['coin-wait-list', page, limit]
      : ['coin-list', coinType, page, limit],
    queryFn: () =>
      isWait
        ? fetchCoinWaitList({ page, limit })
        : fetchCoinList({ status: coinType, page, limit }),
    retry: false,
    placeholderData: (prev) => prev,
  })
  const coinList = listQuery.data?.data.list ?? []
  const coinTotal = listQuery.data?.data.count ?? 0

  function changeCoinType(value: string) {
    setCoinType(value as CoinType)
    setPage(1)
  }

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleGetCoin(item: CoinItem) {
    if (gettingId === item.id) return
    setGettingId(item.id)
    try {
      const res = await getCoin(item.id)
      toast.success(res.msg || '领取成功')
      listQuery.refetch()
      waitTotalQuery.refetch()
      onCoinChanged?.()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setGettingId(null)
    }
  }

  async function showDetail(item: CoinItem) {
    setDetailItem(item)
    setDetailLoading(true)
    setDetailRows([])
    try {
      const res = await fetchCoinUseDetail(item.id)
      setDetailRows(res.data?.list ?? [])
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setDetailLoading(false)
    }
  }

  function renderCoinTime(item: CoinItem): string {
    if (isWait) {
      if (item.begin_time) {
        return `${formatTimeFull(item.begin_time)} - ${formatTimeFull(item.end_time)}`
      }
      return t('voucher_effective', '长期有效')
    }
    if (item.effective_start_time) {
      return `${formatTimeFull(item.effective_start_time)} - ${formatTimeFull(item.effective_end_time)}`
    }
    return t('voucher_effective', '长期有效')
  }

  return (
    <div>
      <div className='mb-3'>
        <RadioGroup
          value={coinType}
          onValueChange={changeCoinType}
          className='flex flex-wrap items-center gap-x-6 gap-y-2'
        >
          <div className='flex items-center gap-2'>
            <RadioGroupItem value='active' id='coin-active' />
            <Label htmlFor='coin-active' className='text-sm font-normal'>
              {t('coin_text7', '待使用')}
            </Label>
          </div>
          <div className='flex items-center gap-2'>
            <RadioGroupItem value='wait' id='coin-wait' />
            <Label
              htmlFor='coin-wait'
              className='flex items-center gap-1.5 text-sm font-normal'
            >
              {t('coin_text6', '待领取')}
              {waitCoinTotal > 0 && (
                <Badge
                  variant='destructive'
                  className='h-4 min-w-4 rounded-full px-1 text-[10px]'
                >
                  {waitCoinTotal}
                </Badge>
              )}
            </Label>
          </div>
          <div className='flex items-center gap-2'>
            <RadioGroupItem value='used_up' id='coin-used' />
            <Label htmlFor='coin-used' className='text-sm font-normal'>
              {t('coin_text8', '已使用')}
            </Label>
          </div>
          <div className='flex items-center gap-2'>
            <RadioGroupItem value='expired' id='coin-expired' />
            <Label htmlFor='coin-expired' className='text-sm font-normal'>
              {t('coin_text9', '已过期')}
            </Label>
          </div>
        </RadioGroup>
      </div>

      {listQuery.isLoading ? (
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className='h-32 w-full rounded-xl' />
          ))}
        </div>
      ) : listQuery.error ? (
        <div className='flex items-center justify-center gap-3 py-14 text-sm text-muted-foreground'>
          <span>加载失败：{getErrorMessage(listQuery.error)}</span>
          <Button
            variant='outline'
            size='sm'
            onClick={() => listQuery.refetch()}
          >
            重试
          </Button>
        </div>
      ) : coinList.length === 0 ? (
        <div className='flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground'>
          <Coins className='h-9 w-9' />
          <p>{t('coin_text60', '暂无平台币')}</p>
        </div>
      ) : (
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          {coinList.map((item) => {
            const isUsedUp = coinType === 'used_up'
            const isExpired = coinType === 'expired'
            return (
              <Card key={item.id} className='overflow-hidden p-0!'>
                <div className='flex h-full'>
                  <div
                    className={cn(
                      'flex w-28 shrink-0 flex-col items-center justify-center p-3 text-center text-primary-foreground',
                      isUsedUp
                        ? 'bg-zinc-400'
                        : isExpired
                          ? 'bg-zinc-800'
                          : 'bg-primary'
                    )}
                  >
                    <span className='text-xs leading-none'>
                      {currencyPrefix}
                      <span className='text-3xl font-medium tabular-nums'>
                        {formatMoney(
                          isWait ? item.amount : item.leave_amount
                        )}
                      </span>
                    </span>
                  </div>
                  <div className='flex min-w-0 flex-1 flex-col justify-between gap-2 p-3'>
                    <p className='truncate text-base font-medium text-foreground'>
                      {item.name}
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      {renderCoinTime(item)}
                    </p>
                    <div className='flex items-center justify-between gap-2'>
                      <button
                        type='button'
                        onClick={() => toggle(item.id)}
                        className='flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground'
                      >
                        {t('voucher_rule', '使用规则')}
                        <ChevronDown
                          className={cn(
                            'h-3.5 w-3.5 transition-transform',
                            expanded.has(item.id) && 'rotate-180'
                          )}
                        />
                      </button>
                      {isWait ? (
                        <Button
                          size='sm'
                          disabled={gettingId === item.id}
                          onClick={() => handleGetCoin(item)}
                        >
                          {gettingId === item.id && (
                            <Loader2 className='h-3.5 w-3.5 animate-spin' />
                          )}
                          {t('voucher_get_now', '立即领取')}
                        </Button>
                      ) : (
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() => showDetail(item)}
                        >
                          {t('coin_text53', '使用详情')}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                {expanded.has(item.id) && <CoinDetail item={item} />}
              </Card>
            )
          })}
        </div>
      )}

      {coinTotal > 0 && !listQuery.isLoading && (
        <PaginationBar
          page={page}
          limit={limit}
          total={coinTotal}
          onPageChange={setPage}
          onLimitChange={(v) => {
            setLimit(v)
            setPage(1)
          }}
        />
      )}

      <Dialog
        open={!!detailItem}
        onOpenChange={(open) => !open && setDetailItem(null)}
      >
        <DialogContent className='sm:max-w-2xl'>
          <DialogHeader>
            <DialogTitle>{t('coin_text53', '使用详情')}</DialogTitle>
          </DialogHeader>
          <div className='max-h-[60vh] overflow-auto rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>{t('coin_text54', '订单ID')}</TableHead>
                  <TableHead>{t('coin_text55', '使用时间')}</TableHead>
                  <TableHead>{t('coin_text56', '使用金额')}</TableHead>
                  <TableHead>{t('coin_text57', '剩余金额')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className='py-6'>
                      <Skeleton className='h-8 w-full' />
                    </TableCell>
                  </TableRow>
                ) : detailRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className='py-8 text-center text-sm text-muted-foreground'
                    >
                      {t('coin_text60', '暂无数据')}
                    </TableCell>
                  </TableRow>
                ) : (
                  detailRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.id}</TableCell>
                      <TableCell>{row.order_id ?? '--'}</TableCell>
                      <TableCell>{formatTimeFull(row.create_time)}</TableCell>
                      <TableCell>
                        {currencyPrefix}
                        {formatMoney(row.amount)}
                      </TableCell>
                      <TableCell>
                        {currencyPrefix}
                        {formatMoney(row.leave_amount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
