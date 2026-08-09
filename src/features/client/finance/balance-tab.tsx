import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search as SearchIcon, X } from 'lucide-react'
import { fetchCommon } from '@/api'
import { fetchCredits } from '@/api/finance'
import { useClientLang } from '@/hooks/use-client-lang'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DatePicker } from '@/components/date-picker'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatMoney, formatTime, PaginationBar } from './shared'

/** 余额类型映射（官方 balanceType），value → 语言 key */
const BALANCE_TYPES: Record<string, string> = {
  Recharge: 'finance_text8',
  Applied: 'finance_text9',
  Refund: 'finance_text10',
  Withdraw: 'finance_text11',
  Artificial: 'finance_text15',
  Freeze: 'finance_text145',
  Unfreeze: 'finance_text146',
  DeveloperWithdraw: 'finance_text_developer_withdraw',
}

/** 余额类型标签配色（官方 .balance-tag 各类型颜色），未知类型用灰 */
const BALANCE_COLORS: Record<string, { color: string; background: string }> = {
  Recharge: { color: '#3699FF', background: 'rgba(54, 153, 255, 0.12)' },
  Applied: { color: '#F99600', background: 'rgba(249, 150, 0, 0.12)' },
  Refund: { color: '#F0142F', background: 'rgba(240, 20, 47, 0.12)' },
  Withdraw: { color: '#3DD598', background: 'rgba(61, 213, 152, 0.12)' },
  Artificial: { color: '#3699FF', background: 'rgba(54, 153, 255, 0.12)' },
  Freeze: { color: '#F0142F', background: 'rgba(240, 20, 47, 0.12)' },
  Unfreeze: { color: '#3699FF', background: 'rgba(54, 153, 255, 0.12)' },
  DeveloperWithdraw: { color: '#7D8592', background: 'rgba(125, 133, 146, 0.12)' },
}

/** Date → 秒级时间戳（官方 el-date-picker value-format=timestamp，/1000） */
function toSeconds(date?: Date): number | undefined {
  if (!date) return undefined
  return Math.floor(date.getTime() / 1000)
}

export function BalanceTab() {
  const { t } = useClientLang()
  const [startDate, setStartDate] = useState<Date>()
  const [endDate, setEndDate] = useState<Date>()
  const [typeFilter, setTypeFilter] = useState('')
  const [keyword, setKeyword] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  const startTime = toSeconds(startDate)
  const endTime = toSeconds(endDate)

  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  const commonData = commonQuery.data?.data as Record<string, unknown> | undefined
  const currencyPrefix = (commonData?.currency_prefix as string) || ''

  const listQuery = useQuery({
    queryKey: [
      'finance-credit',
      page,
      limit,
      appliedKeyword,
      typeFilter,
      startTime,
      endTime,
    ],
    queryFn: () =>
      fetchCredits({
        page,
        limit,
        orderby: 'id',
        sort: 'desc',
        keywords: appliedKeyword || undefined,
        type: typeFilter || undefined,
        start_time: startTime,
        end_time: endTime,
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

  return (
    <Card className='p-5 sm:p-6'>
      {/* 筛选栏 */}
      <div className='flex flex-wrap items-center gap-2'>
        <DatePicker
          selected={startDate}
          placeholder={t('finance_text19', '开始日期')}
          onSelect={(date) => {
            setStartDate(date)
            setPage(1)
          }}
        />
        <span className='text-sm text-muted-foreground'>
          {t('finance_text18', '至')}
        </span>
        <DatePicker
          selected={endDate}
          placeholder={t('finance_text20', '结束日期')}
          onSelect={(date) => {
            setEndDate(date)
            setPage(1)
          }}
        />
        <Select
          value={typeFilter || 'all'}
          onValueChange={(value) => {
            setTypeFilter(value === 'all' ? '' : value)
            setPage(1)
          }}
        >
          <SelectTrigger className='w-36'>
            <SelectValue placeholder={t('finance_text21', '请选择类型')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>{t('finance_text21', '请选择类型')}</SelectItem>
            {Object.entries(BALANCE_TYPES).map(([value, langKey]) => (
              <SelectItem key={value} value={value}>
                {t(langKey, value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                <TableHead className='w-36'>{t('finance_label8', '金额')}</TableHead>
                <TableHead>{t('finance_label10', '备注')}</TableHead>
                <TableHead className='w-36'>{t('finance_label11', '类型')}</TableHead>
                <TableHead className='w-48'>{t('finance_label3', '时间')}</TableHead>
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
                      <Skeleton className='h-4 w-16' />
                    </TableCell>
                    <TableCell>
                      <Skeleton className='h-4 w-full' />
                    </TableCell>
                    <TableCell>
                      <Skeleton className='h-4 w-16' />
                    </TableCell>
                    <TableCell>
                      <Skeleton className='h-4 w-28' />
                    </TableCell>
                  </TableRow>
                ))
              ) : listQuery.error ? (
                <TableRow>
                  <TableCell colSpan={5} className='h-40 text-center text-sm text-muted-foreground'>
                    加载失败
                  </TableCell>
                </TableRow>
              ) : list.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className='h-40 text-center text-sm text-muted-foreground'>
                    {t('subaccount_text55', '暂无信息')}
                  </TableCell>
                </TableRow>
              ) : (
                list.map((item) => {
                  const typeKey = BALANCE_TYPES[item.type]
                  const color = BALANCE_COLORS[item.type]
                  return (
                    <TableRow key={item.id}>
                      <TableCell className='text-sm'>{item.id}</TableCell>
                      <TableCell className='text-sm'>
                        {currencyPrefix}
                        {formatMoney(item.amount)}
                      </TableCell>
                      <TableCell className='max-w-[520px] truncate text-sm'>
                        <span title={item.notes}>{item.notes || '--'}</span>
                      </TableCell>
                      <TableCell className='text-sm'>
                        {typeKey && color ? (
                          <Badge
                            className='border-transparent'
                            style={{
                              color: color.color,
                              background: color.background,
                            }}
                          >
                            {t(typeKey, item.type)}
                          </Badge>
                        ) : (
                          '--'
                        )}
                      </TableCell>
                      <TableCell className='text-sm text-muted-foreground'>
                        {formatTime(item.create_time)}
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
