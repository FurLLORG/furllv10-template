import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Search as SearchIcon } from 'lucide-react'
import { toast } from 'sonner'
import {
  deleteClientMails,
  fetchClientMails,
  readClientMails,
} from '@/api'
import { useAddons } from '@/hooks/use-addons'
import { useClientLang } from '@/hooks/use-client-lang'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const PAGE_SIZES = [20, 50, 100]

export function MsgTab() {
  const { t } = useClientLang()
  const { addons } = useAddons()
  const clientCarePluginId = useMemo(
    () => addons.find((a) => a.name.toLowerCase() === 'clientcare')?.id ?? null,
    [addons]
  )

  const [keyword, setKeyword] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [readFilter, setReadFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [jumpValue, setJumpValue] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const mailQuery = useQuery({
    queryKey: [
      'client-care-mails',
      page,
      limit,
      appliedKeyword,
      typeFilter,
      readFilter,
    ],
    queryFn: () =>
      fetchClientMails({
        page,
        limit,
        orderby: 'id',
        sort: 'desc',
        keywords: appliedKeyword,
        type: typeFilter,
        read: readFilter === '' ? undefined : Number(readFilter),
      }),
    retry: false,
  })

  const list = mailQuery.data?.data.list ?? []
  const typeOptions = useMemo(
    () => mailQuery.data?.data.type ?? [],
    [mailQuery.data]
  )
  const loading = mailQuery.isLoading

  function refresh() {
    mailQuery.refetch()
  }

  function applySearch() {
    setAppliedKeyword(keyword.trim())
    setPage(1)
    setSelectedIds(new Set())
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

  function changePage(next: number) {
    setPage(next)
    setSelectedIds(new Set())
  }

  const allChecked = list.length > 0 && list.every((item) => selectedIds.has(item.id))

  function toggleAll() {
    if (allChecked) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(list.map((item) => item.id)))
    }
  }

  function toggleOne(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function goMsgDetail(id: number) {
    if (clientCarePluginId) {
      window.open(`/plugin/${clientCarePluginId}/msgDetail.htm?id=${id}`, '_blank')
    }
  }

  function handleDelete() {
    if (selectedIds.size === 0) {
      toast.warning(t('subaccount_text68', '请先选择消息！'))
      return
    }
    deleteClientMails([...selectedIds])
      .then((res) => {
        if (res.status === 200) toast.success(res.msg)
        else toast.error(res.msg)
        setSelectedIds(new Set())
        refresh()
      })
      .catch(() => {})
  }

  function handleRead() {
    if (selectedIds.size === 0) {
      toast.warning(t('subaccount_text68', '请先选择消息！'))
      return
    }
    readClientMails({ id: [...selectedIds] })
      .then((res) => {
        if (res.status === 200) toast.success(res.msg)
        else toast.error(res.msg)
        setSelectedIds(new Set())
        refresh()
      })
      .catch(() => {})
  }

  function handleReadAll() {
    readClientMails({ all: 1 })
      .then((res) => {
        if (res.status === 200) toast.success(res.msg)
        else toast.error(res.msg)
        refresh()
      })
      .catch(() => {})
  }

  const typeName = useMemo(() => {
    const map: Record<string, string> = {}
    for (const item of typeOptions) {
      if (item.name) map[item.name] = item.name_lang ?? item.name
    }
    return map
  }, [typeOptions])

  const readOptions = [
    { value: '', label: t('subaccount_text65', '全部消息') },
    { value: '1', label: t('subaccount_text66', '已读') },
    { value: '0', label: t('subaccount_text67', '未读') },
  ]

  return (
    <Card className='p-5 sm:p-6'>
      {/* 操作栏 */}
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex items-center gap-2'>
          <Button variant='outline' onClick={handleDelete}>
            {t('subaccount_text61', '删除')}
          </Button>
          <Button variant='outline' onClick={handleRead}>
            {t('subaccount_text62', '标记为已读')}
          </Button>
          <Button variant='outline' onClick={handleReadAll}>
            {t('subaccount_text63', '全部标记为已读')}
          </Button>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <Select
            value={readFilter}
            onValueChange={(v) => {
              setReadFilter(v)
              setPage(1)
              setSelectedIds(new Set())
            }}
          >
            <SelectTrigger className='w-32'>
              <SelectValue placeholder={t('placeholder_pre2', '请选择')} />
            </SelectTrigger>
            <SelectContent>
              {readOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={typeFilter}
            onValueChange={(v) => {
              setTypeFilter(v)
              setPage(1)
              setSelectedIds(new Set())
            }}
          >
            <SelectTrigger className='w-32'>
              <SelectValue placeholder={t('placeholder_pre2', '请选择')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value=''>{t('subaccount_text65', '全部消息')}</SelectItem>
              {typeOptions.map((item, index) => (
                <SelectItem key={`${item.name}-${index}`} value={item.name ?? ''}>
                  {item.name_lang ?? item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className='relative'>
            <SearchIcon className='absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              value={keyword}
              placeholder={t('cloud_tip_2', '请输入你需要搜索的内容')}
              className='w-48 pl-8'
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applySearch()
              }}
            />
          </div>
          <Button onClick={applySearch}>{t('subaccount_text64', '查询')}</Button>
        </div>
      </div>

      {/* 表格 */}
      <div className='mt-4 overflow-hidden rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-12'>
                <Checkbox
                  checked={allChecked}
                  onCheckedChange={toggleAll}
                  aria-label='select all'
                />
              </TableHead>
              <TableHead className='min-w-[320px]'>
                {t('subaccount_text58', '消息内容')}
              </TableHead>
              <TableHead className='w-40'>{t('subaccount_text59', '接收时间')}</TableHead>
              <TableHead className='w-32'>{t('subaccount_text60', '消息子类型')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className='h-4 w-4' />
                  </TableCell>
                  <TableCell>
                    <Skeleton className='h-4 w-full' />
                  </TableCell>
                  <TableCell>
                    <Skeleton className='h-4 w-28' />
                  </TableCell>
                  <TableCell>
                    <Skeleton className='h-4 w-16' />
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
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={() => toggleOne(item.id)}
                      aria-label={`select ${item.id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <button
                      type='button'
                      className='flex cursor-pointer items-center gap-1 text-left'
                      onClick={() => goMsgDetail(item.id)}
                    >
                      <span
                        className={cn(
                          'shrink-0 text-sm',
                          item.read === 1 ? 'text-muted-foreground' : 'text-primary'
                        )}
                      >
                        【{item.read === 1 ? t('subaccount_text66', '已读') : t('subaccount_text67', '未读')}】
                      </span>
                      <span className='truncate text-sm text-foreground hover:text-primary hover:underline'>
                        {item.title}
                      </span>
                    </button>
                  </TableCell>
                  <TableCell className='text-sm text-muted-foreground'>
                    {formatTime(item.create_time)}
                  </TableCell>
                  <TableCell className='text-sm text-muted-foreground'>
                    {item.type ? (typeName[item.type] ?? item.type) : '--'}
                  </TableCell>
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
                setSelectedIds(new Set())
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
              onClick={() => changePage(page - 1)}
            >
              <ChevronLeft className='h-4 w-4' />
              <span className='sr-only'>上一页</span>
            </Button>
            <Button
              variant='outline'
              size='icon'
              className='size-8'
              disabled={list.length < limit}
              onClick={() => changePage(page + 1)}
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
