import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search as SearchIcon, X } from 'lucide-react'
import { fetchCommon } from '@/api'
import { fetchTransactions } from '@/api/finance'
import { useClientLang } from '@/hooks/use-client-lang'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatMoney, formatTime, navigateHref, PaginationBar } from './shared'

/** 订单类型映射（官方 orderTypeObj），value → 语言 key */
const ORDER_TYPES: Record<string, string> = {
  new: 'finance_text12',
  renew: 'finance_text13',
  upgrade: 'finance_text14',
  artificial: 'finance_text15',
  recharge: 'finance_text16',
  combine: 'finance_label23',
  credit_limit: 'finance_label24',
  on_demand: 'demand_text5',
  change_billing_cycle: 'demand_text6',
}

export function TransactionTab() {
  const { t } = useClientLang()
  const [keyword, setKeyword] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  const commonData = commonQuery.data?.data as Record<string, unknown> | undefined
  const currencyPrefix = (commonData?.currency_prefix as string) || ''

  const listQuery = useQuery({
    queryKey: ['finance-transaction', page, limit, appliedKeyword],
    queryFn: () =>
      fetchTransactions({
        page,
        limit,
        orderby: 'id',
        sort: 'desc',
        keywords: appliedKeyword || undefined,
      }),
    retry: false,
    placeholderData: (prev) => prev,
  })
  const list = listQuery.data?.data.list ?? []
  const total = listQuery.data?.data.count ?? 0
  const loading = listQuery.isLoading

  function applySearch() {
    setAppliedKeyword(keyword.trim())
    setPage(1)
  }

  function goOrderDetail(orderId: number | string) {
    navigateHref(`/orderDetail.htm?id=${orderId}`)
  }

  return (
    <Card className='p-5 sm:p-6'>
      {/* 搜索栏 */}
      <div className='flex justify-end'>
        <div className='relative w-full max-w-xs'>
          <SearchIcon className='pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={keyword}
            placeholder={t('cloud_tip_2', '请输入你需要搜索的内容')}
            className='pr-8 pl-8'
            onChange={(e) => {
              setKeyword(e.target.value)
              if (e.target.value === '') applySearch()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applySearch()
            }}
          />
          {keyword ? (
            <Button
              type='button'
              variant='ghost'
              size='icon'
              aria-label='清除搜索'
              className='absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2'
              onClick={() => {
                setKeyword('')
                applySearch()
              }}
            >
              <X className='h-4 w-4' />
            </Button>
          ) : (
            <Button
              type='button'
              variant='ghost'
              size='icon'
              aria-label='搜索'
              className='absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2'
              onClick={applySearch}
            >
              <SearchIcon className='h-4 w-4' />
            </Button>
          )}
        </div>
      </div>

      {/* 表格 */}
      <div className='mt-4 overflow-hidden rounded-md border'>
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-24'>ID</TableHead>
                <TableHead className='w-36'>{t('finance_label7', '订单ID')}</TableHead>
                <TableHead className='w-36'>{t('finance_label22', '订单类型')}</TableHead>
                <TableHead className='w-36'>{t('finance_label8', '金额')}</TableHead>
                <TableHead className='w-48'>{t('finance_label3', '时间')}</TableHead>
                <TableHead>{t('finance_label5', '支付方式')}</TableHead>
                <TableHead>{t('finance_label9', '交易流水号')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className='h-4 w-10' />
                    </TableCell>
                    <TableCell>
                      <Skeleton className='h-4 w-14' />
                    </TableCell>
                    <TableCell>
                      <Skeleton className='h-4 w-16' />
                    </TableCell>
                    <TableCell>
                      <Skeleton className='h-4 w-16' />
                    </TableCell>
                    <TableCell>
                      <Skeleton className='h-4 w-28' />
                    </TableCell>
                    <TableCell>
                      <Skeleton className='h-4 w-20' />
                    </TableCell>
                    <TableCell>
                      <Skeleton className='h-4 w-32' />
                    </TableCell>
                  </TableRow>
                ))
              ) : listQuery.error ? (
                <TableRow>
                  <TableCell colSpan={7} className='h-40 text-center text-sm text-muted-foreground'>
                    加载失败
                  </TableCell>
                </TableRow>
              ) : list.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className='h-40 text-center text-sm text-muted-foreground'>
                    {t('subaccount_text55', '暂无信息')}
                  </TableCell>
                </TableRow>
              ) : (
                list.map((item) => {
                  const orderId = item.order_id
                  const orderIdText =
                    orderId == null || orderId === '' || Number(orderId) === 0
                      ? '--'
                      : String(orderId)
                  const typeKey = ORDER_TYPES[item.type]
                  return (
                    <TableRow key={item.id}>
                      <TableCell className='text-sm'>{item.id}</TableCell>
                      <TableCell className='text-sm'>
                        {orderIdText === '--' ? (
                          '--'
                        ) : (
                          <button
                            type='button'
                            className='cursor-pointer text-primary hover:underline'
                            onClick={() => goOrderDetail(orderId)}
                          >
                            {orderIdText}
                          </button>
                        )}
                      </TableCell>
                      <TableCell className='text-sm'>
                        {typeKey ? t(typeKey, item.type) : '--'}
                      </TableCell>
                      <TableCell className='text-sm'>
                        {currencyPrefix}
                        {formatMoney(item.amount)}
                      </TableCell>
                      <TableCell className='text-sm text-muted-foreground'>
                        {formatTime(item.create_time)}
                      </TableCell>
                      <TableCell className='text-sm text-muted-foreground'>
                        {item.gateway || '--'}
                      </TableCell>
                      <TableCell className='text-sm text-muted-foreground'>
                        {item.transaction_number || '--'}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 分页 */}
      {!loading && !listQuery.error && total > 0 && (
        <PaginationBar
          page={page}
          limit={limit}
          total={total}
          onPageChange={setPage}
          onLimitChange={(value) => {
            setLimit(value)
            setPage(1)
          }}
        />
      )}
    </Card>
  )
}
