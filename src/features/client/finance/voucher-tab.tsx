import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronDown, Loader2, Ticket } from 'lucide-react'
import { fetchCommon } from '@/api'
import {
  fetchVoucherAvailable,
  fetchVoucherMine,
  getVoucher,
  type VoucherItem,
} from '@/api/finance'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useClientLang } from '@/hooks/use-client-lang'
import { getErrorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'
import { PaginationBar } from './pagination-bar'
import { formatMoney, formatTimeFull } from './shared'

/**
 * 财务中心 - 代金券（IdcsmartVoucher 插件）。
 * 领券弹窗 + 我的代金券列表，数据走 /console/v1/voucher|voucher/mine|voucher/:id/get。
 */
function VoucherDetail({ item }: { item: VoucherItem }) {
  const { t } = useClientLang()
  const products = item.product ?? []
  const productNeed = item.product_need ?? []

  return (
    <div className='space-y-1.5 border-t bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground'>
      {products.length > 0 && (
        <p>
          {t('voucher_order_product', '使用时订单中需包含以下产品')}：
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
      )}
      {productNeed.length > 0 && (
        <p>
          {t('voucher_accout_product', '账户中需拥有并正在使用以下产品')}：
          {productNeed.map((el, i) => (
            <span key={el.id}>
              {el.name ?? `#${el.id}`}
              {i < productNeed.length - 1 && '、'}
            </span>
          ))}
        </p>
      )}
      {item.user_type === 'no_host' && (
        <p>{t('voucher_no_product', '账户中未拥有任何产品')}</p>
      )}
      {item.user_type === 'need_active' && (
        <p>{t('voucher_active', '账户中需存在激活中的产品')}</p>
      )}
      {!!item.onetime && (
        <p>{t('voucher_onetime', '单个用户该代金券只能使用一次')}</p>
      )}
      {!!item.upgrade_use && (
        <p>{t('voucher_upgrade', '该代金券可在升降级订单中使用')}</p>
      )}
      {!!item.renew_use && (
        <p>{t('voucher_renew', '该代金券可在续费订单中使用')}</p>
      )}
      {!item.upgrade_use && (
        <p>{t('voucher_upgrade_no', '该代金券不可在升降级订单中使用')}</p>
      )}
      {!item.renew_use && (
        <p>{t('voucher_renew_no', '该代金券不可在续费订单中使用')}</p>
      )}
    </div>
  )
}

function VoucherCard({
  item,
  expanded,
  currencyPrefix,
  onToggle,
  onReceive,
  receiving,
}: {
  item: VoucherItem
  expanded: boolean
  currencyPrefix: string
  onToggle: () => void
  onReceive?: () => void
  receiving?: boolean
}) {
  const { t } = useClientLang()
  const isUsed = item.status === 'used'
  const isExpired = item.status === 'expired'

  return (
    <Card className='overflow-hidden p-0!'>
      <div className='flex h-full'>
        <div
          className={cn(
            'flex w-28 shrink-0 flex-col items-center justify-center gap-2 p-3 text-center text-primary-foreground',
            isUsed ? 'bg-zinc-400' : isExpired ? 'bg-zinc-800' : 'bg-primary'
          )}
        >
          <span className='text-xs leading-none'>
            {currencyPrefix}
            <span className='text-3xl font-medium tabular-nums'>
              {formatMoney(item.price)}
            </span>
          </span>
          <p className='text-xs leading-snug opacity-90'>
            {t('voucher_min', '最低使用金额')}：
            {currencyPrefix}
            {formatMoney(item.min_price)}
          </p>
        </div>
        <div className='flex min-w-0 flex-1 flex-col justify-between gap-2 p-3'>
          <p className='truncate text-base font-medium text-foreground'>
            {item.code}
          </p>
          <p className='text-xs text-muted-foreground'>
            {formatTimeFull(item.start_time)} - {formatTimeFull(item.end_time)}
          </p>
          <div className='flex items-center justify-between gap-2'>
            <button
              type='button'
              onClick={onToggle}
              className='flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground'
            >
              {t('voucher_rule', '使用规则')}
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 transition-transform',
                  expanded && 'rotate-180'
                )}
              />
            </button>
            {onReceive && (
              <Button
                size='sm'
                disabled={!!item.is_get || receiving}
                onClick={onReceive}
              >
                {receiving && <Loader2 className='h-3.5 w-3.5 animate-spin' />}
                {item.is_get
                  ? t('voucher_has_get', '已领取')
                  : t('voucher_get_now', '立即领取')}
              </Button>
            )}
          </div>
        </div>
      </div>
      {expanded && <VoucherDetail item={item} />}
    </Card>
  )
}

export default function VoucherTab() {
  const { t } = useClientLang()
  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  const currencyPrefix = String(commonQuery.data?.data.currency_prefix || '¥')

  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [expandedMine, setExpandedMine] = useState<Set<number>>(new Set())
  const [expandedAvailable, setExpandedAvailable] = useState<Set<number>>(
    new Set()
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const [receivingId, setReceivingId] = useState<number | null>(null)

  const mineQuery = useQuery({
    queryKey: ['voucher-mine', page, limit],
    queryFn: () =>
      fetchVoucherMine({ page, limit, orderby: 'id', sort: 'desc' }),
    retry: false,
    placeholderData: (prev) => prev,
  })
  const voucherList = mineQuery.data?.data.list ?? []
  const mineTotal = mineQuery.data?.data.count ?? 0

  const availableQuery = useQuery({
    queryKey: ['voucher-available', 1, 999999],
    queryFn: () => fetchVoucherAvailable({ page: 1, limit: 999999 }),
    retry: false,
    enabled: dialogOpen,
  })
  const availableList = availableQuery.data?.data.list ?? []

  function toggleMine(id: number) {
    setExpandedMine((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAvailable(id: number) {
    setExpandedAvailable((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleReceive(item: VoucherItem) {
    if (item.is_get || receivingId === item.id) return
    setReceivingId(item.id)
    try {
      const res = await getVoucher(item.id)
      toast.success(res.msg || '领取成功')
      availableQuery.refetch()
      mineQuery.refetch()
    } catch (error) {
      toast.error(getErrorMessage(error))
      availableQuery.refetch()
    } finally {
      setReceivingId(null)
    }
  }

  return (
    <div>
      <div className='mb-3 flex justify-end'>
        <Button onClick={() => setDialogOpen(true)}>
          {t('voucher_get', '我要领券')}
        </Button>
      </div>

      {mineQuery.isLoading ? (
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className='h-32 w-full rounded-xl' />
          ))}
        </div>
      ) : mineQuery.error ? (
        <div className='flex items-center justify-center gap-3 py-14 text-sm text-muted-foreground'>
          <span>加载失败：{getErrorMessage(mineQuery.error)}</span>
          <Button
            variant='outline'
            size='sm'
            onClick={() => mineQuery.refetch()}
          >
            重试
          </Button>
        </div>
      ) : voucherList.length === 0 ? (
        <div className='flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground'>
          <Ticket className='h-9 w-9' />
          <p>{t('voucher_text60', '暂无代金券')}</p>
        </div>
      ) : (
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          {voucherList.map((item) => (
            <VoucherCard
              key={item.id}
              item={item}
              expanded={expandedMine.has(item.id)}
              currencyPrefix={currencyPrefix}
              onToggle={() => toggleMine(item.id)}
            />
          ))}
        </div>
      )}

      {mineTotal > 0 && !mineQuery.isLoading && (
        <PaginationBar
          page={page}
          limit={limit}
          total={mineTotal}
          onPageChange={setPage}
          onLimitChange={(v) => {
            setLimit(v)
            setPage(1)
          }}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='sm:max-w-3xl'>
          <DialogHeader>
            <DialogTitle>{t('voucher_get', '我要领券')}</DialogTitle>
          </DialogHeader>
          {availableQuery.isLoading ? (
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className='h-32 w-full rounded-xl' />
              ))}
            </div>
          ) : availableList.length === 0 ? (
            <div className='flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground'>
              <Ticket className='h-9 w-9' />
              <p>{t('voucher_empty', '暂无代金券可领')}</p>
            </div>
          ) : (
            <div className='grid max-h-[60vh] grid-cols-1 gap-4 overflow-y-auto pr-1 md:grid-cols-2'>
              {availableList.map((item) => (
                <VoucherCard
                  key={item.id}
                  item={item}
                  expanded={expandedAvailable.has(item.id)}
                  currencyPrefix={currencyPrefix}
                  onToggle={() => toggleAvailable(item.id)}
                  onReceive={() => handleReceive(item)}
                  receiving={receivingId === item.id}
                />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
