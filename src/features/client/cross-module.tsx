import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  fetchCommon,
  fetchCrossModuleHosts,
  type CrossModuleDataCenter,
  type CrossModuleHostItem,
} from '@/api'
import { getErrorMessage } from '@/lib/api'
import { ArrowLeft, ChevronDown, Search, Server, X } from 'lucide-react'
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
import {
  AutoRenewSwitch,
  BatchNoteDialog,
  BatchRenewDialog,
} from './module-host-list'
import { installedAddons } from '@/lib/addons'

// 官方 crossModule.js 状态配色（status → color/bgColor）
const HOST_STATUS_STYLE: Record<
  string,
  { text: string; color: string; bgColor: string }
> = {
  Unpaid: { text: '未付款', color: '#F64E60', bgColor: '#FFE2E5' },
  Pending: { text: '开通中', color: '#3699FF', bgColor: '#E1F0FF' },
  Active: { text: '已开通', color: '#1BC5BD', bgColor: '#C9F7F5' },
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
] as const

type TabKey = (typeof TAB_OPTIONS)[number]['key']

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

/**
 * 跨模块产品列表页（crossModule.htm?m=，需登录）
 *
 * 官方 crossModule.php + js/crossModule.js 处理方式：
 * - m 为 /menu 导航中 menu_type=module 且 is_cross_module=1 的菜单 ID
 *   （MenuModel 拼装 crossModule.htm?m=<menu_id>）
 * - 请求 GET /console/v1/home/host 传 m/page/limit/tab/status/keywords/country_id/city/area，
 *   后端按菜单关联的 product_id/模块过滤产品，返回 list + 各状态计数 + data_center/select_field
 * - 前端表格列按 select_field 控制显隐；行点击跳 productdetail.htm?id=<host_id>
 */
export function CrossModulePage() {
  const navigate = useNavigate()
  const searchStr = useLocation({ select: (location) => location.searchStr })
  const search = useMemo(() => new URLSearchParams(searchStr), [searchStr])
  const menuId = Number(search.get('m') ?? '') || 0

  // 筛选状态（官方 created() 从 URL 读 tab；m 恒为菜单 ID）
  const [tab, setTab] = useState<TabKey>('using')
  const [status, setStatus] = useState('')
  const [keyword, setKeyword] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  // 多选（官方 handleSelectionChange → batchRenewpage ids，module-type="all"）
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [batchRenewOpen, setBatchRenewOpen] = useState(false)
  const [batchNoteOpen, setBatchNoteOpen] = useState(false)

  // 自动续费列（官方 mixin hasAutoRenew && hasSelectField('is_auto_renew')）
  const hasAutoRenew = useMemo(() => installedAddons().includes('IdcsmartRenew'), [])
  const hasPromoCode = useMemo(() => installedAddons().includes('PromoCode'), [])

  // 官方 getCommon：站点名 + 标题「站点名-我的产品」
  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  useEffect(() => {
    const base = commonQuery.data?.data.website_name || 'FurLL'
    document.title = `${base} - 我的产品`
  }, [commonQuery.data])

  // 数据中心筛选项（官方 centerSelectChange → country_id/city/area）
  // 选项列表随响应刷新，选中值单独存 state（避免查询回调引用查询结果造成循环依赖）
  const [centerIndex, setCenterIndex] = useState('')
  const [centerFilter, setCenterFilter] = useState<{
    country_id?: number
    city?: string
    area?: string
  }>({})

  // 产品列表（官方 getCloudList：apiCrossModuleList → GET /home/host）
  const hostsQuery = useQuery({
    queryKey: [
      'cross-module-hosts',
      menuId,
      tab,
      status,
      appliedKeyword,
      centerFilter,
      page,
      limit,
    ],
    queryFn: () =>
      fetchCrossModuleHosts({
        m: menuId,
        page,
        limit,
        tab,
        status: status || undefined,
        keywords: appliedKeyword || undefined,
        ...centerFilter,
      }),
    enabled: menuId > 0,
    retry: false,
  })
  const data = hostsQuery.data?.data
  const hosts = data?.list ?? []
  const selectField = useMemo(() => new Set(data?.select_field ?? []), [data])
  const hasField = (field: string) => selectField.has(field)

  const center = useMemo<CrossModuleDataCenter[]>(
    () =>
      (data?.data_center ?? []).map((item) => ({
        ...item,
        label:
          (item.country_name || '') +
          '-' +
          (item.city || '') +
          '-' +
          (item.area || ''),
      })),
    [data]
  )

  function onCenterChange(value: string) {
    const item = center[Number(value) || 0]
    setCenterIndex(value)
    setCenterFilter({
      country_id: item?.country_id,
      city: item?.city,
      area: item?.area,
    })
    setPage(1)
  }

  // 分页切换（官方 sizeChange/currentChange 后重新拉取）
  function changePage(next: number) {
    if (next < 1 || next > totalPages) return
    setPage(next)
  }

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
    setCenterIndex('')
    setCenterFilter({})
    setPage(1)
  }

  function goDetail(host: CrossModuleHostItem) {
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
            <h1 className='text-2xl font-bold tracking-tight'>我的产品</h1>
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

      {/* 状态 Tab（官方 product-filter：using/expiring/overdue/deleted + 计数） */}
      {loading ? (
        <div className='flex gap-2'>
          {Array.from({ length: 4 }).map((_, i) => (
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

      {/* 筛选栏：数据中心 / 状态 */}
      <div className='flex flex-wrap items-center gap-2'>
        {!loading && center.length > 0 && hasField('area') && (
          <Select
            value={centerIndex}
            onValueChange={onCenterChange}
          >
            <SelectTrigger className='w-64'>
              <SelectValue placeholder='数据中心筛选' />
            </SelectTrigger>
            <SelectContent>
              {center.map((item, index) => (
                <SelectItem key={index} value={String(index)}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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
        {(status || appliedKeyword || centerIndex) && (
          <Button variant='ghost' size='sm' onClick={resetFilter}>
            清除筛选
          </Button>
        )}
      </div>

      {/* 表格 */}
      <div className='overflow-x-auto rounded-lg border bg-background'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-12'>
                <span
                  onClick={(e) => e.stopPropagation()}
                  className='inline-flex'
                >
                  <Checkbox
                    checked={allChecked}
                    onCheckedChange={(value) => toggleSelectAll(Boolean(value))}
                    aria-label='全选'
                  />
                </span>
              </TableHead>
              <TableHead className='w-20'>ID</TableHead>
              {hasField('area') && center.length > 0 && (
                <TableHead>区域</TableHead>
              )}
              {hasField('product_name') && <TableHead>产品名称</TableHead>}
              {hasField('billing_cycle') && <TableHead>计费方式</TableHead>}
              {hasAutoRenew && hasField('is_auto_renew') && (
                <TableHead className='w-24'>自动续费</TableHead>
              )}
              {hasField('base_info') && <TableHead>基础信息</TableHead>}
              {hasField('ip') && <TableHead>IP</TableHead>}
              {hasField('os') && <TableHead>OS</TableHead>}
              {hasField('active_time') && <TableHead>开通时间</TableHead>}
              {hasField('due_time') && <TableHead>到期时间</TableHead>}
              {hasField('status') && <TableHead>产品状态</TableHead>}
              {hasField('notes') && <TableHead>备注</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={13}>
                    <Skeleton className='h-8 w-full' />
                  </TableCell>
                </TableRow>
              ))
            ) : hostsQuery.error ? (
              <TableRow>
                <TableCell
                  colSpan={13}
                  className='h-40 text-center text-muted-foreground'
                >
                  产品数据加载失败：
                  {getErrorMessage(hostsQuery.error)}
                </TableCell>
              </TableRow>
            ) : hosts.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={13}
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
                const demand =
                  host.billing_cycle === 'on_demand' ||
                  host.billing_cycle === 'recurring_prepayment_on_demand'
                const ipText =
                  (host.ip_num ?? 0) > 0
                    ? [host.dedicate_ip, host.assign_ip]
                        .filter(Boolean)
                        .join(', ')
                    : ''
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
                    {hasField('area') && center.length > 0 && (
                      <TableCell>
                        {host.country
                          ? `${host.country}-${host.city}-${host.area}`
                          : '--'}
                      </TableCell>
                    )}
                    {hasField('product_name') && (
                      <TableCell>
                        <p className='font-medium'>{host.product_name}</p>
                        <p className='text-xs text-muted-foreground'>
                          {host.name}
                        </p>
                      </TableCell>
                    )}
                    {hasField('billing_cycle') && (
                      <TableCell className='text-xs text-muted-foreground'>
                        {demand
                          ? '按需计费'
                          : (host.billing_cycle_name ?? '包年包月')}
                      </TableCell>
                    )}
                    {hasAutoRenew && hasField('is_auto_renew') && (
                      <TableCell>
                        {host.status === 'Active' ? (
                          <AutoRenewSwitch
                            hostId={host.id}
                            isAutoRenew={host.is_auto_renew === 1}
                            onUpdated={() => hostsQuery.refetch()}
                          />
                        ) : (
                          '--'
                        )}
                      </TableCell>
                    )}
                    {hasField('base_info') && (
                      <TableCell className='max-w-40 truncate text-xs text-muted-foreground'>
                        {host.show_base_info === 1 && host.base_info
                          ? host.base_info
                          : '--'}
                      </TableCell>
                    )}
                    {hasField('ip') && (
                      <TableCell className='text-xs'>{ipText || '--'}</TableCell>
                    )}
                    {hasField('os') && (
                      <TableCell>
                        {host.image_icon ? (
                          <img
                            src={`/plugins/server/mf_cloud/template/clientarea/pc/default/img/mf_cloud/${host.image_icon}.svg`}
                            alt={host.image_name || 'OS'}
                            title={host.image_name}
                            className='h-6 w-6 object-contain'
                          />
                        ) : (
                          '--'
                        )}
                      </TableCell>
                    )}
                    {hasField('active_time') && (
                      <TableCell className='text-xs text-muted-foreground'>
                        {formatTime(host.active_time)}
                      </TableCell>
                    )}
                    {hasField('due_time') && (
                      <TableCell className='text-xs text-muted-foreground'>
                        {formatTime(host.due_time)}
                      </TableCell>
                    )}
                    {hasField('status') && (
                      <TableCell>
                        {style ? (
                          <Badge
                            className='border-transparent'
                            style={{
                              color: style.color,
                              background: style.bgColor,
                            }}
                          >
                            {style.text}
                          </Badge>
                        ) : (
                          host.status
                        )}
                      </TableCell>
                    )}
                    {hasField('notes') && (
                      <TableCell className='max-w-32 truncate text-xs text-muted-foreground'>
                        {host.client_notes || '--'}
                      </TableCell>
                    )}
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
              onClick={() => changePage(page - 1)}
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
              onClick={() => changePage(page + 1)}
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
