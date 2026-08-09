import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search as SearchIcon } from 'lucide-react'
import { fetchApiLogList, fetchCommon } from '@/api'
import { useClientLang } from '@/hooks/use-client-lang'
import { PaginationBar } from '@/features/client/finance/pagination-bar'
import { formatTimeFull } from '@/features/client/finance/shared'
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
import { SecurityTabs } from './security-tabs'

export function SecurityLogPage() {
  const { t } = useClientLang()

  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  const commonData = commonQuery.data?.data as Record<string, unknown> | undefined

  useEffect(() => {
    const base = (commonData?.website_name as string) || 'FurLL'
    document.title = `${base} - ${t('security_tab2', 'API日志')}`
  }, [commonData, t])

  // 回车/清空后才应用搜索词（官方 @keypress.enter.native）
  const [keyword, setKeyword] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  const logQuery = useQuery({
    queryKey: ['client-api-log-list', page, limit, appliedKeyword],
    queryFn: () =>
      fetchApiLogList({
        page,
        limit,
        orderby: 'id',
        sort: 'desc',
        keywords: appliedKeyword,
      }),
    retry: false,
  })

  const list = logQuery.data?.data.list ?? []
  const total = logQuery.data?.data.count ?? 0
  const loading = logQuery.isLoading

  function applySearch() {
    setAppliedKeyword(keyword.trim())
    setPage(1)
  }

  return (
    <div className='space-y-4'>
      <div className='mb-2'>
        <h1 className='text-2xl font-bold tracking-tight'>
          {t('security_title', '安全')}
        </h1>
        <div className='text-sm text-muted-foreground'>
          {t('security_tab2', 'API日志')}
        </div>
      </div>

      <SecurityTabs active='3' />

      <Card className='p-5 sm:p-6'>
        {/* 搜索 */}
        <div className='flex justify-end'>
          <div className='relative w-full max-w-xs'>
            <SearchIcon className='absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              value={keyword}
              placeholder={t('cloud_tip_2', '请输入你需要搜索的内容')}
              className='pl-8'
              onChange={(e) => {
                setKeyword(e.target.value)
                if (e.target.value === '') applySearch()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applySearch()
              }}
            />
          </div>
        </div>

        {/* 表格 */}
        <div className='mt-4 overflow-hidden rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-24'>ID</TableHead>
                <TableHead className='min-w-[280px]'>
                  {t('security_label8', '描述')}
                </TableHead>
                <TableHead className='w-44'>
                  {t('account_label10', '创建时间')}
                </TableHead>
                <TableHead className='w-40'>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 4 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className='h-4 w-full' />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : list.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className='h-40 text-center text-sm text-muted-foreground'
                  >
                    {t('subaccount_text55', '暂无信息')}
                  </TableCell>
                </TableRow>
              ) : (
                list.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className='text-sm'>{item.id}</TableCell>
                    <TableCell className='max-w-[520px] truncate text-sm'>
                      <span title={item.description}>{item.description}</span>
                    </TableCell>
                    <TableCell className='text-sm text-muted-foreground'>
                      {formatTimeFull(item.create_time)}
                    </TableCell>
                    <TableCell className='text-sm text-muted-foreground'>
                      {item.ip}
                    </TableCell>
                  </TableRow>
                ))
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
      </Card>
    </div>
  )
}
