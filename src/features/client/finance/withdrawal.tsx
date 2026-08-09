import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { fetchCommon } from '@/api'
import { useClientLang } from '@/hooks/use-client-lang'
import { fetchWithdrawals, type WithdrawalItem } from '@/api/finance'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PaginationBar } from './pagination-bar'
import { formatMoney, formatTime } from './shared'

/** 状态样式映射（官方 js/withdraw.js：0待审核 1待打款 2已驳回 3已打款） */
const STATUS_META: Record<
  number,
  { text: string; className: string }
> = {
  0: { text: 'finance_text97', className: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
  1: { text: 'finance_text98', className: 'bg-secondary text-secondary-foreground' },
  2: { text: 'finance_text109', className: 'bg-destructive/10 text-destructive border-destructive/30' },
  3: { text: 'finance_text100', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
}

/** 提现记录（官方 /withdrawal.htm，GET /console/v1/withdraw 列表） */
export function WithdrawalPage() {
  const { t } = useClientLang()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

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

  const listQuery = useQuery({
    queryKey: ['finance-withdrawals', page, limit],
    queryFn: () =>
      fetchWithdrawals({ page, limit, orderby: 'id', sort: 'desc' }),
    retry: false,
    placeholderData: (prev) => prev,
  })
  const list = listQuery.data?.data.list ?? []
  const total = listQuery.data?.data.count ?? 0

  useEffect(() => {
    const base = (commonData.website_name as string) || 'FurLL'
    document.title = `${base} - ${t('finance_btn9', '提现记录')}`
  }, [commonData, t])

  return (
    <Card>
      <CardContent className='p-5 sm:p-6'>
        <div className='mb-4 flex items-center gap-3'>
          <Button
            variant='ghost'
            size='icon'
            onClick={() => window.history.back()}
            aria-label='返回'
          >
            <ArrowLeft className='h-5 w-5' />
          </Button>
          <h1 className='text-xl font-bold tracking-tight'>
            {t('finance_btn9', '提现记录')}
          </h1>
        </div>

        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-[150px]'>
                  {t('finance_label17', '提现金额')}
                </TableHead>
                <TableHead>{t('security_label4', '创建时间')}</TableHead>
                <TableHead className='w-[150px]'>
                  {t('finance_label4', '状态')}
                </TableHead>
                <TableHead>{t('finance_withdraw_reason', '驳回原因')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className='h-24 text-center'>
                    <span className='text-sm text-muted-foreground'>
                      {t('common_loading', '加载中...')}
                    </span>
                  </TableCell>
                </TableRow>
              ) : list.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className='h-24 text-center'>
                    <span className='text-sm text-muted-foreground'>
                      {t('finance_text6', '暂无数据')}
                    </span>
                  </TableCell>
                </TableRow>
              ) : (
                list.map((item: WithdrawalItem) => {
                  const meta = STATUS_META[Number(item.status)] ?? {
                    text: '--',
                    className: 'bg-secondary text-secondary-foreground',
                  }
                  return (
                    <TableRow key={item.id ?? item.create_time}>
                      <TableCell className='font-medium'>
                        {currencyPrefix}
                        {formatMoney(item.withdraw_amount)}
                      </TableCell>
                      <TableCell>{formatTime(item.create_time)}</TableCell>
                      <TableCell>
                        {item.reason ? (
                          <span title={item.reason}>
                            <Badge variant='outline' className={meta.className}>
                              {t(meta.text, '--')}
                            </Badge>
                          </span>
                        ) : (
                          <Badge variant='outline' className={meta.className}>
                            {t(meta.text, '--')}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className='max-w-[260px]'>
                        {item.reason ? (
                          <span
                            className='block truncate text-sm text-destructive'
                            title={item.reason}
                          >
                            {item.reason}
                          </span>
                        ) : (
                          <span className='text-sm text-muted-foreground'>
                            --
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        <PaginationBar
          page={page}
          limit={limit}
          total={total}
          onPageChange={setPage}
          onLimitChange={(v) => {
            setLimit(v)
            setPage(1)
          }}
        />
      </CardContent>
    </Card>
  )
}
