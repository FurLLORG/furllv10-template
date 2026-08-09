import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  fetchClientHost,
  fetchCommon,
  type ClientHostItem,
} from '@/api'
import { getErrorMessage } from '@/lib/api'
import { toast } from 'sonner'
import { ArrowLeft, ChevronDown, ChevronUp, Copy, Search, Server, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { BatchNoteDialog, BatchRenewDialog } from './module-host-list'
import { installedAddons } from '@/lib/addons'

/**
 * 我已订购的产品（productList.htm，需登录）
 *
 * 官方 productList.php + js/productList.js 处理方式：
 * - 请求 GET /console/v1/client/host（全模块已购产品，含 Unpaid/Pending/Suspended/Deleted/Grace/Keep），
 *   返回 list + using_count/expiring_count/overdue_count/deleted_count/all_count 状态计数
 * - 产品筛选 Tab（productFilter 组件）：using 使用中 / expiring 即将到期 / overdue 已逾期 /
 *   deleted 已删除 / all 全部（URL ?tab= 可定位，点击 all 时接口传 tab=''）
 * - 批量操作（batchRenewpage module-type="all"）：仅 续费 / 修改备注（on/off/reboot 等
 *   走 /<module>/batch_operate 需模块命名空间，全局列表无该路由）
 * - 表格列：ID / 商品名称(product_name+name) / IP(复制) / 开通时间(create_time 可排序) /
 *   到期时间(due_time 可排序) / 状态 / 备注；行点击跳 productdetail.htm?id=
 */
export function ProductListPage() {
  const navigate = useNavigate()
  const searchStr = useLocation({ select: (location) => location.searchStr })
  const search = useMemo(() => new URLSearchParams(searchStr), [searchStr])

  // 筛选状态（官方 created() 从 URL 读 tab；默认 all）
  const [tab, setTab] = useState<'using' | 'expiring' | 'overdue' | 'deleted' | 'all'>(
    () => {
      const value = search.get('tab')
      return value === 'using' ||
        value === 'expiring' ||
        value === 'overdue' ||
        value === 'deleted'
        ? value
        : 'all'
    }
  )
  const [status, setStatus] = useState('')
  const [keyword, setKeyword] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [orderby, setOrderby] = useState('id')
  const [sort, setSort] = useState<'asc' | 'desc'>('desc')

  // 多选（官方 handleSelectionChange → batchRenewpage ids，module-type="all"）
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [batchRenewOpen, setBatchRenewOpen] = useState(false)
  const [batchNoteOpen, setBatchNoteOpen] = useState(false)

  // 优惠码（官方 batchRenewpage created 读 addons）
  const hasPromoCode = useMemo(() => installedAddons().includes('PromoCode'), [])

  // 官方 getCommon：站点名 + 标题「站点名-我已订购」
  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  useEffect(() => {
    const base = commonQuery.data?.data.website_name || 'FurLL'
    document.title = `${base} - 我已订购`
  }, [commonQuery.data])

  // 产品列表（官方 getCloudList：clientHost → GET /client/host）
  const hostsQuery = useQuery({
    queryKey: [
      'client-host-list',
      tab,
      status,
      appliedKeyword,
      page,
      limit,
      orderby,
      sort,
    ],
    queryFn: () =>
      fetchClientHost({
        page,
        limit,
        tab: tab === 'all' ? undefined : tab,
        status: status || undefined,
        keywords: appliedKeyword || undefined,
        orderby,
        sort,
      }),
    retry: false,
  })
  const data = hostsQuery.data?.data
  const hosts = data?.list ?? []

  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / limit))

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    setAppliedKeyword(keyword.trim())
    setPage(1)
  }

  function resetFilter() {
    setStatus('')
    setKeyword('')
    setAppliedKeyword('')
    setPage(1)
  }

  // 排序（官方 sortChange：orderby=prop, sort=asc/desc）
  function toggleSort(field: string) {
    if (orderby === field) {
      setSort(sort === 'asc' ? 'desc' : 'asc')
    } else {
      setOrderby(field)
      setSort('asc')
    }
    setPage(1)
  }

  function goDetail(host: ClientHostItem) {
    // 官方 toDetail：跳转产品详情页（SPA 内同页导航）
    navigate({ to: '/productdetail.htm', search: { id: host.id } })
  }

  // 行选择（官方 handleSelectionChange）
  function toggleSelect(id: number, checked: boolean) {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((item) => item !== id)
    )
  }
  const allChecked =
    hosts.length > 0 && hosts.every((item) => selectedIds.includes(item.id))
  function toggleSelectAll(checked: boolean) {
    setSelectedIds(checked ? hosts.map((item) => item.id) : [])
  }

  // 复制 IP（官方 copyIp：换行分隔复制）
  async function copyIp(ip: string) {
    try {
      await navigator.clipboard.writeText(ip.replace(/,/g, '\n'))
      toast.success('复制成功')
    } catch {
      toast.error('复制失败')
    }
  }

  const loading = hostsQuery.isLoading

  return (
    <div className='space-y-4'>
      {/* 页面标题区 + 搜索 + 批量操作（官方 batchRenewpage module-type="all"：续费/备注） */}
      <div className='mb-2 flex flex-wrap items-center justify-between gap-3'>
        <div className='flex items-center gap-2'>
          <Button
            variant='ghost'
            size='sm'
            className='text-muted-foreground hover:text-foreground'
            onClick={() => navigate({ to: '/home.htm' })}
          >
            <ArrowLeft className='h-4 w-4' />
            返回首页
          </Button>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>我已订购</h1>
          </div>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          {/* 批量操作（官方 batchRenewpage：续费/备注，deleted 不可操作） */}
          {tab !== 'deleted' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='outline' disabled={selectedIds.length === 0}>
                  {selectedIds.length > 0
                    ? `已选 ${selectedIds.length} 项`
                    : '请选择产品'}
                  <ChevronDown className='ml-1 h-4 w-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                <DropdownMenuItem onClick={() => setBatchRenewOpen(true)}>
                  批量续费
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setBatchNoteOpen(true)}>
                  批量修改备注
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <form onSubmit={submitSearch} className='relative w-full max-w-xs'>
            <Search className='pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder='搜索产品名称 / 标识 / IP'
              className='bg-background pr-8 pl-9'
            />
            {keyword && (
              <button
                type='button'
                onClick={() => {
                  setKeyword('')
                  setAppliedKeyword('')
                }}
                className='absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
                aria-label='清除搜索'
              >
                <X className='h-4 w-4' />
              </button>
            )}
          </form>
        </div>
      </div>

      {/* 状态 Tab（官方 productFilter：using/expiring/overdue/deleted/all + 计数） */}
      {loading ? (
        <div className='flex gap-2'>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className='h-9 w-24 rounded-full' />
          ))}
        </div>
      ) : (
        <div className='flex flex-wrap items-center gap-2'>
          {TAB_OPTIONS.map((option) => {
            const active = tab === option.key
            const count = countOf(data, `${option.key}_count`)
            return (
              <button
                key={option.key}
                onClick={() => {
                  setTab(option.key)
                  setPage(1)
                }}
                className={cn(
                  'cursor-pointer rounded-full border px-4 py-1.5 text-sm transition-colors',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                )}
              >
                {option.label}
                <span
                  className={cn(
                    'ml-1.5 text-xs',
                    active ? 'text-primary-foreground/80' : 'text-muted-foreground'
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* 筛选栏：状态 */}
      <div className='flex flex-wrap items-center gap-2'>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value)
            setPage(1)
          }}
        >
          <SelectTrigger className='w-40'>
            <SelectValue placeholder='产品状态' />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((item) => (
              <SelectItem key={item} value={item}>
                {HOST_STATUS_STYLE[item]?.text ?? item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(status || appliedKeyword) && (
          <Button variant='ghost' size='sm' onClick={resetFilter}>
            清除筛选
          </Button>
        )}
      </div>

      {/* 表格（官方 productList：ID/商品名称/IP/开通时间/到期时间/状态/备注） */}
      <div className='overflow-x-auto rounded-lg border bg-background'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-12'>
                <span onClick={(e) => e.stopPropagation()} className='inline-flex'>
                  <Checkbox
                    checked={allChecked}
                    onCheckedChange={(value) => toggleSelectAll(Boolean(value))}
                    aria-label='全选'
                  />
                </span>
              </TableHead>
              <TableHead className='w-20'>ID</TableHead>
              <TableHead>商品名称</TableHead>
              <TableHead>IP</TableHead>
              <TableHead
                className='w-44 cursor-pointer select-none'
                onClick={() => toggleSort('create_time')}
              >
                <span className='inline-flex items-center gap-1'>
                  开通时间
                  {orderby === 'create_time' &&
                    (sort === 'asc' ? (
                      <ChevronUp className='h-3.5 w-3.5' />
                    ) : (
                      <ChevronDown className='h-3.5 w-3.5' />
                    ))}
                </span>
              </TableHead>
              <TableHead
                className='w-44 cursor-pointer select-none'
                onClick={() => toggleSort('due_time')}
              >
                <span className='inline-flex items-center gap-1'>
                  到期时间
                  {orderby === 'due_time' &&
                    (sort === 'asc' ? (
                      <ChevronUp className='h-3.5 w-3.5' />
                    ) : (
                      <ChevronDown className='h-3.5 w-3.5' />
                    ))}
                </span>
              </TableHead>
              <TableHead>状态</TableHead>
              <TableHead>备注</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={9}>
                    <Skeleton className='h-8 w-full' />
                  </TableCell>
                </TableRow>
              ))
            ) : hostsQuery.error ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className='h-40 text-center text-muted-foreground'
                >
                  产品列表加载失败：
                  {getErrorMessage(hostsQuery.error)}
                </TableCell>
              </TableRow>
            ) : hosts.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className='h-40 text-center text-muted-foreground'
                >
                  <div className='flex flex-col items-center gap-2'>
                    <Server className='h-10 w-10 text-muted-foreground' />
                    暂无产品
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              hosts.map((host) => {
                const style = HOST_STATUS_STYLE[host.status ?? '']
                return (
                  <TableRow
                    key={host.id}
                    className='cursor-pointer'
                    onClick={() => goDetail(host)}
                  >
                    <TableCell>
                      <span
                        onClick={(e) => e.stopPropagation()}
                        className='inline-flex'
                      >
                        <Checkbox
                          checked={selectedIds.includes(host.id)}
                          onCheckedChange={(value) =>
                            toggleSelect(host.id, Boolean(value))
                          }
                          aria-label={`选择产品 ${host.id}`}
                        />
                      </span>
                    </TableCell>
                    <TableCell className='font-medium text-primary'>
                      {host.id}
                    </TableCell>
                    <TableCell>
                      <p className='font-medium'>{host.product_name || '--'}</p>
                      <p className='text-xs text-muted-foreground'>
                        {host.name}
                      </p>
                    </TableCell>
                    <TableCell className='text-xs'>
                      {host.ip && host.status !== 'Deleted' ? (
                        <span className='inline-flex items-center gap-1'>
                          <span>{host.ip}</span>
                          <Copy
                            className='h-3.5 w-3.5 cursor-pointer text-primary'
                            onClick={(e) => {
                              e.stopPropagation()
                              copyIp(host.ip)
                            }}
                          />
                        </span>
                      ) : (
                        '--'
                      )}
                    </TableCell>
                    <TableCell className='text-xs text-muted-foreground'>
                      {formatTime(host.create_time)}
                    </TableCell>
                    <TableCell className='text-xs text-muted-foreground'>
                      {formatTime(host.due_time)}
                    </TableCell>
                    <TableCell>
                      {style ? (
                        <Badge
                          className='border-transparent'
                          style={{ color: style.color, background: style.bgColor }}
                        >
                          {style.text}
                        </Badge>
                      ) : (
                        host.status
                      )}
                    </TableCell>
                    <TableCell className='max-w-32 truncate text-xs text-muted-foreground'>
                      {host.client_notes || '--'}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* 分页（官方 pagination：每页 20/50/100） */}
      {!loading && !hostsQuery.error && data && data.count > 0 && (
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <p className='text-sm text-muted-foreground'>
            共 {data.count} 个产品
          </p>
          <div className='flex items-center gap-2'>
            <Select
              value={String(limit)}
              onValueChange={(value) => {
                setLimit(Number(value))
                setPage(1)
              }}
            >
              <SelectTrigger className='w-24'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[20, 50, 100].map((item) => (
                  <SelectItem key={item} value={String(item)}>
                    {item} 条/页
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant='outline'
              size='sm'
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              上一页
            </Button>
            <span className='text-sm text-muted-foreground'>
              {page} / {totalPages}
            </span>
            <Button
              variant='outline'
              size='sm'
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              下一页
            </Button>
          </div>
        </div>
      )}

      {/* 批量操作弹窗（官方 batchRenewpage：renew / note） */}
      {batchRenewOpen && (
        <BatchRenewDialog
          open={batchRenewOpen}
          setOpen={setBatchRenewOpen}
          ids={selectedIds}
          hasPromoCode={hasPromoCode}
          currencyPrefix={String(commonQuery.data?.data.currency_prefix || '￥')}
          onSuccess={() => {
            setSelectedIds([])
            hostsQuery.refetch()
          }}
        />
      )}
      {batchNoteOpen && (
        <BatchNoteDialog
          open={batchNoteOpen}
          setOpen={setBatchNoteOpen}
          ids={selectedIds}
          onSuccess={() => {
            setSelectedIds([])
            hostsQuery.refetch()
          }}
        />
      )}
    </div>
  )
}

// ---------- 官方 productList.js 常量（状态配色/文案） ----------

const HOST_STATUS_STYLE: Record<
  string,
  { text: string; color: string; bgColor: string }
> = {
  Unpaid: { text: '未付款', color: '#F64E60', bgColor: '#FFE2E5' },
  Pending: { text: '开通中', color: '#3699FF', bgColor: '#E1F0FF' },
  Active: { text: '正常', color: '#1BC5BD', bgColor: '#C9F7F5' },
  Suspended: { text: '已暂停', color: '#F99600', bgColor: '#FFF4DE' },
  Deleted: { text: '已删除', color: '#9696A3', bgColor: '#F2F2F7' },
  Failed: { text: '开通失败', color: '#3699FF', bgColor: '#E1F0FF' },
  Grace: { text: '宽限', color: '#ffda16', bgColor: '#fff9d9' },
  Keep: { text: '保留', color: '#ffad16', bgColor: '#fff2d9' },
}

const STATUS_OPTIONS = [
  'Unpaid',
  'Pending',
  'Active',
  'Suspended',
  'Deleted',
  'Grace',
  'Keep',
]

const TAB_OPTIONS = [
  { key: 'using', label: '使用中' },
  { key: 'expiring', label: '即将到期' },
  { key: 'overdue', label: '已逾期' },
  { key: 'deleted', label: '已删除' },
  { key: 'all', label: '全部' },
] as const

function formatTime(ts?: number): string {
  if (!ts) return '--'
  const d = new Date(ts * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function countOf(data: object | undefined, key: string): number {
  const value = (data as Record<string, unknown> | undefined)?.[key]
  return typeof value === 'number' ? value : 0
}
