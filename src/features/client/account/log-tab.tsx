import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Search as SearchIcon } from 'lucide-react'
import { fetchAccountLog } from '@/api'
import { useClientLang } from '@/hooks/use-client-lang'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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

function formatTime(ts?: number): string {
  if (!ts || ts === 0) return '--'
  const d = new Date(ts * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const PAGE_SIZES = [20, 50, 100]

export function LogTab() {
  const { t } = useClientLang()
  const [keyword, setKeyword] = useState('')
  // 回车/清空后才应用搜索词（官方 @keypress.enter.native）
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [jumpValue, setJumpValue] = useState('')

  const logQuery = useQuery({
    queryKey: ['client-account-log', page, limit, appliedKeyword],
    queryFn: () =>
      fetchAccountLog({
        page,
        limit,
        orderby: 'id',
        sort: 'desc',
        keywords: appliedKeyword,
        type: 'system',
      }),
    retry: false,
  })

  const list = logQuery.data?.data.list ?? []
  const loading = logQuery.isLoading

  function applySearch() {
    setAppliedKeyword(keyword.trim())
    setPage(1)
  }

  // 前往指定页（接口 total 不可靠，仅限制最小页数）
  function handleJump() {
    const target = Number(jumpValue)
    if (!Number.isFinite(target) || target < 1) {
      setJumpValue(String(page))
      return
    }
    setPage(Math.floor(target))
    setJumpValue('')
  }

  return (
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
              <TableHead className='min-w-[300px]'>
                {t('account_label9', '描述')}
              </TableHead>
              <TableHead className='w-40'>{t('account_label10', '创建时间')}</TableHead>
              <TableHead className='w-32'>IP</TableHead>
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
                    <Skeleton className='h-4 w-full' />
                  </TableCell>
                  <TableCell>
                    <Skeleton className='h-4 w-28' />
                  </TableCell>
                  <TableCell>
                    <Skeleton className='h-4 w-20' />
                  </TableCell>
                </TableRow>
              ))
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className='h-40 text-center text-sm text-muted-foreground'>
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
                    {formatTime(item.create_time)}
                  </TableCell>
                  <TableCell className='text-sm text-muted-foreground'>{item.ip}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 分页 */}
      {list.length > 0 ? (
        <div className='mt-4 flex flex-wrap items-center justify-end gap-3'>
          <div className='flex items-center gap-2'>
            <Select
              value={`${limit}`}
              onValueChange={(v) => {
                setLimit(Number(v))
                setPage(1)
              }}
            >
              <SelectTrigger className='h-8 w-20'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent side='top'>
                {PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={`${size}`}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className='text-sm text-muted-foreground'>条/每页</span>
          </div>
          <div className='flex items-center gap-2'>
            <span className='text-sm text-muted-foreground'>前往</span>
            <Input
              type='number'
              min={1}
              className='h-8 w-16'
              value={jumpValue}
              onChange={(e) => setJumpValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleJump()
              }}
            />
            <span className='text-sm text-muted-foreground'>页</span>
            <Button variant='outline' size='sm' className='h-8' onClick={handleJump}>
              确定
            </Button>
          </div>
          <div className='flex items-center gap-1'>
            <Button
              variant='outline'
              size='icon'
              className='size-8'
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className='h-4 w-4' />
              <span className='sr-only'>上一页</span>
            </Button>
            <Button
              variant='outline'
              size='icon'
              className='size-8'
              disabled={list.length < limit}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className='h-4 w-4' />
              <span className='sr-only'>下一页</span>
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  )
}
