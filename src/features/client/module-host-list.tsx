import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  fetchCommon,
  fetchModuleHosts,
  fetchBatchRenewList,
  submitBatchRenew,
  fetchHostSpecificInfo,
  updateHostRenewAuto,
  fetchTrafficWarning,
  saveTrafficWarning,
  MODULE_LIST_NAMESPACE,
  type BatchRenewCycle,
  type BatchRenewItem,
  type CrossModuleHostItem,
  type ModuleDataCenterItem,
  type TrafficWarningData,
} from '@/api'
import {
  ArrowLeft,
  Bell,
  ChevronDown,
  ChevronUp,
  Copy,
  Loader2,
  Server,
  Search,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { installedAddons } from '@/lib/addons'
import { api, getErrorMessage } from '@/lib/api'
import {
  parseModuleFromContent,
  type ModuleHostRef,
} from '@/lib/module-content'
import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

/**
 * 模块菜单产品列表（product.htm?m=，需登录）
 *
 * 官方机制（10.7.x）：GET /console/v1/menu/:id/host 返回后端按菜单关联模块渲染的
 * Vue2 插件模板 HTML（dcimList.js 等），页面经 jQuery 注入并运行插件脚本。
 * 本组件改为 React 原生实现：仅从 content 解析出模块标识（见 lib/module-content.ts），
 * 直接用 React 调模块列表接口（GET /console/v1/mf_dcim）渲染，等价还原官方
 * dcimList 页面（Tab 计数/筛选/表格/分页/批量续费/流量预警/自动续费）。
 */

// ---------- 官方 dcimList.js / cloudList.js / common_product_list.js 常量（文案/配色/图标） ----------

/**
 * 官方状态映射（注意模块间文案差异：dcim 模块 Active 为「正常」，cloud/common 为「已开通」；
 * Failed 配色 dcim 蓝 / common 橙，见各模块 product_list 页面 js）
 */
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
}

/** 官方 cloudList.js / common_product_list.js（mf_cloud、idcsmart_common 及 remf 系列）状态映射 */
const HOST_STATUS_STYLE_CLOUD: Record<
  string,
  { text: string; color: string; bgColor: string }
> = {
  ...HOST_STATUS_STYLE,
  Active: { text: '已开通', color: '#1BC5BD', bgColor: '#C9F7F5' },
  Suspended: { text: '已暂停', color: '#F0142F', bgColor: '#FFE2E5' },
  Failed: { text: '开通失败', color: '#FFA800', bgColor: '#FFF4DE' },
}

const STATUS_OPTIONS = ['Unpaid', 'Pending', 'Active', 'Suspended', 'Deleted']

const TAB_OPTIONS = [
  { key: 'using', label: '使用中' },
  { key: 'expiring', label: '即将到期' },
  { key: 'overdue', label: '已逾期' },
  { key: 'deleted', label: '已删除' },
] as const

type TabKey = (typeof TAB_OPTIONS)[number]['key']

/** 官方 dcimList.js powerStatus：电源状态图标（/clientarea/template/pc/default/img/cloud/） */
const POWER_STATUS: Record<string, { text: string; icon: string }> = {
  on: { text: '开机', icon: 'on.png' },
  off: { text: '关机', icon: 'off.png' },
  operating: { text: '操作中', icon: 'operating.png' },
  fault: { text: '故障', icon: 'fault.png' },
  suspend: { text: '已暂停', icon: 'suspended.png' },
  pending: { text: '操作中', icon: 'operating.png' },
}

const POWER_ICON_BASE = '/clientarea/template/pc/default/img/cloud/'

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

function copyText(text: string): Promise<void> {
  return navigator.clipboard.writeText(text)
}

/**
 * 模块产品列表页（product.htm?m=）
 * content 为后端渲染的 HTML，此处仅解析模块标识并映射到 React 原生页面。
 */
export function ModuleHostListPage({
  content,
  menuId,
}: {
  content: string
  menuId: number
}) {
  const moduleRef = useMemo(() => parseModuleFromContent(content), [content])

  if (!moduleRef) {
    return (
      <div className='flex flex-col items-center gap-3 rounded-lg border bg-background py-20 text-center'>
        <p className='text-muted-foreground'>
          无法识别菜单模块，请检查菜单配置
        </p>
      </div>
    )
  }
  // 官方可渲染产品列表的模块（server：mf_cloud/mf_dcim/idcsmart_common；reserver：
  // idcsmart_common/mf_finance 系列）；第三方/未装模块无 API 命名空间 → 不支持提示
  if (!MODULE_LIST_NAMESPACE[moduleRef.kind]?.[moduleRef.module]) {
    return (
      <div className='flex flex-col items-center gap-3 rounded-lg border bg-background py-20 text-center'>
        <Server className='h-10 w-10 text-muted-foreground' />
        <p className='text-muted-foreground'>
          模块 {moduleRef.module} 的产品列表暂不支持原生渲染
        </p>
      </div>
    )
  }
  return <ModuleHostList moduleRef={moduleRef} menuId={menuId} />
}

/**
 * React 原生模块产品列表（官方 dcimList.js / cloudList.js / common_product_list.js 等价实现）。
 * 两种表格风格：
 * - cloud 风格（mf_cloud/mf_dcim/mf_finance 系列）：数据中心/电源/IP/OS 列
 * - common 风格（idcsmart_common，server+reserver）：价格周期列，无数据中心/电源/IP/OS
 */
function ModuleHostList({
  moduleRef,
  menuId,
}: {
  moduleRef: ModuleHostRef
  menuId: number
}) {
  const navigate = useNavigate()

  // 列表/批量操作 API 命名空间（官方 module-type：idcsmart_common / reidcsmart_common / remf_finance 等）
  const module = MODULE_LIST_NAMESPACE[moduleRef.kind][moduleRef.module]
  // idcsmart_common 通用独立服务器表格（common_product_list.js 布局）
  const isCommonStyle = moduleRef.module === 'idcsmart_common'
  // dcim 模块 Active 状态文案为「正常」，其余模块为「已开通」（官方 js status 映射）
  const statusStyle =
    moduleRef.module === 'mf_dcim' ? HOST_STATUS_STYLE : HOST_STATUS_STYLE_CLOUD

  // 官方 product-filter Tab（all → 请求 tab=''）
  const [tab, setTab] = useState<TabKey>('using')
  const [status, setStatus] = useState('')
  const [keyword, setKeyword] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [orderby, setOrderby] = useState('id')
  const [sort, setSort] = useState<'asc' | 'desc'>('desc')
  const [centerIndex, setCenterIndex] = useState('')
  const [centerFilter, setCenterFilter] = useState<{
    country_id?: number
    city?: string
    area?: string
  }>({})

  // 多选（官方 handleSelectionChange → batchRenewpage ids）
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  // 批量操作弹窗状态
  const [batchRenewOpen, setBatchRenewOpen] = useState(false)
  const [batchConfirm, setBatchConfirm] = useState<{
    action: 'on' | 'off' | 'reboot'
  } | null>(null)
  const [batchRePassOpen, setBatchRePassOpen] = useState(false)
  const [batchNoteOpen, setBatchNoteOpen] = useState(false)
  const [trafficOpen, setTrafficOpen] = useState(false)

  // 标题（官方 dcimList getCommon：站点名-产品列表）
  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  const commonData = commonQuery.data?.data
  useEffect(() => {
    const base = commonData?.website_name || 'FurLL'
    document.title = `${base} - 我的产品`
  }, [commonData])

  // 自动续费列是否展示（官方 mixin：addons 含 IdcsmartRenew 续费插件）
  const hasAutoRenew = useMemo(
    () => installedAddons().includes('IdcsmartRenew'),
    []
  )
  const hasPromoCode = useMemo(
    () => installedAddons().includes('PromoCode'),
    []
  )

  // 流量预警仅官方 mf_cloud/mf_dcim 列表页有（trafficWarning 组件），其余模块不渲染
  const hasTrafficWarning =
    moduleRef.kind === 'server' &&
    (moduleRef.module === 'mf_cloud' || moduleRef.module === 'mf_dcim')

  // 产品列表（官方 getCloudList：cloudList → GET /<module>）
  const hostsQuery = useQuery({
    queryKey: [
      'module-host-list',
      module,
      menuId,
      tab,
      status,
      appliedKeyword,
      centerFilter,
      page,
      limit,
      orderby,
      sort,
    ],
    queryFn: () =>
      fetchModuleHosts(module, {
        m: menuId,
        page,
        limit,
        tab,
        status: status || undefined,
        keywords: appliedKeyword || undefined,
        orderby,
        sort,
        ...centerFilter,
      }),
    enabled: menuId > 0,
    retry: false,
  })
  const data = hostsQuery.data?.data
  const hosts = data?.list ?? []

  // 列表字段：自定义字段列 + 数据中心的 label（官方 dcimList 拼 country_name-city-area）
  const selfDefinedFields = data?.self_defined_field ?? []
  const center = useMemo<ModuleDataCenterItem[]>(
    () =>
      (data?.data_center ?? []).map((item) => ({
        ...item,
        label:
          (item.country_name || '') +
          '-' +
          (item.customfield?.multi_language?.city || item.city) +
          '-' +
          (item.customfield?.multi_language?.area || item.area),
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

  function goDetail(host: CrossModuleHostItem) {
    navigate({ to: '/productdetail.htm', search: { id: host.id } })
  }

  const loading = hostsQuery.isLoading

  return (
    <div className='space-y-4'>
      {/* 页面标题（与 crossModule.htm 统一：返回首页 + 标题 + 右上搜索/功能按钮） */}
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
          {/* 流量预警（官方 trafficWarning 组件，仅 mf_cloud/mf_dcim 列表页有） */}
          {hasTrafficWarning && (
            <TrafficWarningButton
              module={module}
              open={trafficOpen}
              setOpen={setTrafficOpen}
            />
          )}
          {/* 批量操作（官方 batchRenewpage：续费/开机/关机/重启/重置密码/备注，deleted 不可操作） */}
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
                {BATCH_OPS[module]?.on && (
                  <DropdownMenuItem
                    onClick={() => setBatchConfirm({ action: 'on' })}
                  >
                    批量开机
                  </DropdownMenuItem>
                )}
                {BATCH_OPS[module]?.off && (
                  <DropdownMenuItem
                    onClick={() => setBatchConfirm({ action: 'off' })}
                  >
                    批量关机
                  </DropdownMenuItem>
                )}
                {BATCH_OPS[module]?.reboot && (
                  <DropdownMenuItem
                    onClick={() => setBatchConfirm({ action: 'reboot' })}
                  >
                    批量重启
                  </DropdownMenuItem>
                )}
                {BATCH_OPS[module]?.crack_pass && (
                  <DropdownMenuItem onClick={() => setBatchRePassOpen(true)}>
                    批量重置密码
                  </DropdownMenuItem>
                )}
                {BATCH_OPS[module]?.note && (
                  <DropdownMenuItem onClick={() => setBatchNoteOpen(true)}>
                    批量修改备注
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* 状态 Tab（与 crossModule 一致：using/expiring/overdue/deleted + 计数） */}
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
                    active
                      ? 'text-primary-foreground/80'
                      : 'text-muted-foreground'
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* 筛选栏：数据中心 / 状态 / 搜索（官方 cloudList 参数） */}
      <div className='flex flex-wrap items-center gap-2'>
        {!loading && center.length > 0 && (
          <Select value={centerIndex} onValueChange={onCenterChange}>
            <SelectTrigger className='w-64'>
              <SelectValue placeholder='数据中心筛选' />
            </SelectTrigger>
            <SelectContent>
              {center.map((item, index) => (
                <SelectItem key={index} value={String(index)}>
                  <span className='flex items-center gap-2'>
                    {item.country_code && (
                      <img
                        src={`/upload/common/country/${item.country_code}.png`}
                        alt=''
                        className='h-4 w-6 object-cover'
                      />
                    )}
                    {item.label}
                  </span>
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
                {statusStyle[item]?.text ?? item}
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

      {/* 表格（cloud 风格官方 dcimList/cloudList 模板列；common 风格官方 common_product_list 列） */}
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
              {!isCommonStyle && center.length > 0 && (
                <TableHead>区域</TableHead>
              )}
              <TableHead>商品名称</TableHead>
              {hasAutoRenew && <TableHead className='w-24'>自动续费</TableHead>}
              {!isCommonStyle && <TableHead>基础信息</TableHead>}
              {selfDefinedFields.map((field) => (
                <TableHead key={field.id}>
                  {field.field_name || `字段${field.id}`}
                </TableHead>
              ))}
              {!isCommonStyle && (
                <TableHead className='w-20'>电源状态</TableHead>
              )}
              {!isCommonStyle && <TableHead>IP</TableHead>}
              {!isCommonStyle && <TableHead className='w-16'>OS</TableHead>}
              {isCommonStyle && (
                <TableHead
                  className='w-40 cursor-pointer select-none'
                  onClick={() => toggleSort('due_time')}
                >
                  <span className='inline-flex items-center gap-1'>
                    价格/周期
                    {orderby === 'due_time' &&
                      (sort === 'asc' ? (
                        <ChevronUp className='h-3.5 w-3.5' />
                      ) : (
                        <ChevronDown className='h-3.5 w-3.5' />
                      ))}
                  </span>
                </TableHead>
              )}
              <TableHead
                className='w-40 cursor-pointer select-none'
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
                  <TableCell colSpan={14}>
                    <Skeleton className='h-8 w-full' />
                  </TableCell>
                </TableRow>
              ))
            ) : hostsQuery.error ? (
              <TableRow>
                <TableCell
                  colSpan={14}
                  className='h-40 text-center text-muted-foreground'
                >
                  产品列表加载失败：
                  {getErrorMessage(hostsQuery.error)}
                </TableCell>
              </TableRow>
            ) : hosts.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={14}
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
                const style = statusStyle[host.status ?? '']
                const power = POWER_STATUS[String(host.power_status ?? '')]
                const allIp = (host.dedicate_ip ?? '')
                  .split(',')
                  .filter(Boolean)
                  .concat(
                    (host.assign_ip ?? '')
                      .split(',')
                      .filter((item) => item.length > 0)
                  )
                // 镜像图标目录：reserver 模块（mf_finance 系列）官方图标在 img/mf_cloud/ 下
                const osIconDir =
                  moduleRef.kind === 'reserver' &&
                  moduleRef.module !== 'idcsmart_common'
                    ? 'mf_cloud'
                    : moduleRef.module
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
                    {!isCommonStyle && center.length > 0 && (
                      <TableCell className='text-xs'>
                        {host.country ? (
                          <span className='inline-flex items-center gap-1.5'>
                            {host.country_code && (
                              <img
                                src={`/upload/common/country/${host.country_code}.png`}
                                alt=''
                                className='h-4 w-6 object-cover'
                              />
                            )}
                            {host.country}-{host.city}-{host.area}
                          </span>
                        ) : (
                          '--'
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      <p className='font-medium'>{host.product_name || '--'}</p>
                      <p className='text-xs text-muted-foreground'>
                        {host.name}
                      </p>
                    </TableCell>
                    {hasAutoRenew && (
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
                    {!isCommonStyle && (
                      <TableCell className='max-w-40 truncate text-xs text-muted-foreground'>
                        {host.show_base_info === 1 && host.base_info
                          ? host.base_info
                          : '--'}
                      </TableCell>
                    )}
                    {selfDefinedFields.map((field) => (
                      <TableCell
                        key={field.id}
                        className={cn(
                          'max-w-40 text-xs text-muted-foreground',
                          field.field_type === 'textarea' &&
                            'whitespace-pre-wrap'
                        )}
                      >
                        {String(host.self_defined_field?.[field.id] ?? '--')}
                      </TableCell>
                    ))}
                    {!isCommonStyle && (
                      <TableCell>
                        {power ? (
                          <img
                            src={`${POWER_ICON_BASE}${power.icon}`}
                            alt={power.text}
                            title={power.text}
                            className='h-5 w-5'
                          />
                        ) : (
                          '--'
                        )}
                      </TableCell>
                    )}
                    {!isCommonStyle && (
                      <TableCell className='text-xs'>
                        {host.dedicate_ip && host.status !== 'Deleted' ? (
                          <span className='inline-flex items-center gap-1'>
                            <span>{host.dedicate_ip}</span>
                            {(host.ip_num ?? 0) > 1 && (
                              <span
                                className='cursor-pointer text-xs text-primary'
                                title={allIp.join('\n')}
                              >
                                ({host.ip_num})
                              </span>
                            )}
                            {(host.ip_num ?? 0) > 0 && (
                              <Copy
                                className='h-3.5 w-3.5 cursor-pointer text-primary'
                                onClick={(e) => {
                                  e.stopPropagation()
                                  copyText(allIp.join('\n'))
                                  toast.success('复制成功')
                                }}
                              />
                            )}
                          </span>
                        ) : (
                          '--'
                        )}
                      </TableCell>
                    )}
                    {!isCommonStyle && (
                      <TableCell>
                        {host.image_icon ? (
                          <img
                            src={`/plugins/${moduleRef.kind}/${moduleRef.module}/template/clientarea/pc/default/img/${osIconDir}/${host.image_icon}.svg`}
                            alt={host.image_name || 'OS'}
                            title={host.image_name}
                            className='h-6 w-6 object-contain'
                          />
                        ) : (
                          '--'
                        )}
                      </TableCell>
                    )}
                    {isCommonStyle && (
                      <TableCell className='text-xs text-muted-foreground'>
                        {host.billing_cycle ? (
                          <>
                            {String(commonData?.currency_prefix || '￥')}
                            {host.renew_amount}
                            <span className='text-muted-foreground'>
                              /{host.billing_cycle}
                            </span>
                          </>
                        ) : (
                          <>
                            {String(commonData?.currency_prefix || '￥')}
                            {host.first_payment_amount}/一次性
                          </>
                        )}
                      </TableCell>
                    )}
                    <TableCell className='text-xs text-muted-foreground'>
                      {formatTime(host.due_time)}
                    </TableCell>
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
                        (host.status ?? '--')
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

      {/* 分页（官方 pagination：20/50/100） */}
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

      {/* 批量操作弹窗（renew 弹窗 / on/off/reboot 确认 / note 输入） */}
      {batchRenewOpen && (
        <BatchRenewDialog
          open={batchRenewOpen}
          setOpen={setBatchRenewOpen}
          ids={selectedIds}
          hasPromoCode={hasPromoCode}
          currencyPrefix={String(commonData?.currency_prefix || '￥')}
          onSuccess={() => {
            setSelectedIds([])
            hostsQuery.refetch()
          }}
        />
      )}
      {batchConfirm && (
        <BatchOperateConfirm
          action={batchConfirm.action}
          module={module}
          ids={selectedIds}
          open={Boolean(batchConfirm)}
          setOpen={(open) => setBatchConfirm(open ? batchConfirm : null)}
          onSuccess={() => hostsQuery.refetch()}
        />
      )}
      {batchRePassOpen && (
        <BatchRePassDialog
          open={batchRePassOpen}
          setOpen={setBatchRePassOpen}
          module={module}
          ids={selectedIds}
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

// ---------- 自动续费开关（官方 autoRenew 组件） ----------

export function AutoRenewSwitch({
  hostId,
  isAutoRenew,
  onUpdated,
}: {
  hostId: number
  isAutoRenew: boolean
  onUpdated: () => void
}) {
  const [open, setOpen] = useState(false)
  const [pendingValue, setPendingValue] = useState(false)
  const [host, setHost] = useState<{
    id?: number
    name?: string
    country?: string
    city?: string
    area?: string
    dedicate_ip?: string
    ip_num?: number
    renew_amount?: string
    billing_cycle_name?: string
    due_time?: number
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  const currencyPrefix = String(commonQuery.data?.data.currency_prefix || '￥')

  // 打开确认弹窗：官方 autoRenewChange → getHostSpecific（GET /host/:id/specific_info）
  async function handleChange(value: boolean) {
    setPendingValue(value)
    setLoading(true)
    setOpen(true)
    try {
      const res = await fetchHostSpecificInfo(hostId)
      setHost(res.data)
    } catch {
      setHost(null)
    } finally {
      setLoading(false)
    }
  }

  async function submit() {
    setSubmitting(true)
    try {
      await updateHostRenewAuto(hostId, pendingValue ? 1 : 0)
      toast.success(pendingValue ? '开启自动续费成功' : '关闭自动续费成功')
      setOpen(false)
      onUpdated()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <span onClick={(e) => e.stopPropagation()} className='inline-flex'>
        <Switch
          checked={isAutoRenew}
          onCheckedChange={handleChange}
          aria-label='自动续费'
        />
      </span>
      <span onClick={(e) => e.stopPropagation()}>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className='sm:max-w-md'>
            <DialogHeader>
              <DialogTitle>
                请确认您将为以下产品{pendingValue ? '开启' : '关闭'}自动续费
              </DialogTitle>
              <DialogDescription>
                {loading && (
                  <span className='inline-flex items-center gap-2'>
                    <Loader2 className='h-4 w-4 animate-spin' />
                    加载产品信息...
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            {host && (
              <div className='space-y-2 text-sm'>
                <p className='flex justify-between'>
                  <span className='text-muted-foreground'>ID：</span>
                  <span>{host.id}</span>
                </p>
                <p className='flex justify-between'>
                  <span className='text-muted-foreground'>产品名称：</span>
                  <span>{host.name}</span>
                </p>
                {host.country && (
                  <p className='flex justify-between'>
                    <span className='text-muted-foreground'>区域：</span>
                    <span>
                      {host.country}-{host.city}-{host.area}
                    </span>
                  </p>
                )}
                {host.dedicate_ip && (
                  <p className='flex justify-between'>
                    <span className='text-muted-foreground'>IP：</span>
                    <span>
                      {host.dedicate_ip}
                      {(host.ip_num ?? 0) > 1 ? ` (${host.ip_num})` : ''}
                    </span>
                  </p>
                )}
                <p className='flex justify-between'>
                  <span className='text-muted-foreground'>续费金额/周期：</span>
                  <span>
                    {currencyPrefix}
                    {String(host.renew_amount)}/
                    {String(host.billing_cycle_name)}
                  </span>
                </p>
                <p className='flex justify-between'>
                  <span className='text-muted-foreground'>到期时间：</span>
                  <span>{formatTime(host.due_time)}</span>
                </p>
              </div>
            )}
            <DialogFooter>
              <Button onClick={submit} disabled={submitting || loading}>
                {submitting && (
                  <Loader2 className='mr-1 h-4 w-4 animate-spin' />
                )}
                确定
              </Button>
              <Button variant='outline' onClick={() => setOpen(false)}>
                取消
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </span>
    </>
  )
}

// ---------- 批量续费弹窗（官方 batchRenewpage renew 分支） ----------

const RENEW_CYCLE_LABEL = (cycle: BatchRenewCycle): string =>
  cycle.customfield?.multi_language?.billing_cycle || cycle.billing_cycle || ''

export function BatchRenewDialog({
  open,
  setOpen,
  ids,
  hasPromoCode,
  currencyPrefix,
  onSuccess,
}: {
  open: boolean
  setOpen: (open: boolean) => void
  ids: number[]
  hasPromoCode: boolean
  currencyPrefix: string
  onSuccess: () => void
}) {
  const [promoCode, setPromoCode] = useState('')
  const [appliedPromo, setAppliedPromo] = useState('')
  const [selections, setSelections] = useState<Record<number, number>>({})
  const [submitting, setSubmitting] = useState(false)

  // 官方 openDia → getRenewList：GET /host/renew/batch（ids + 优惠码）
  const listQuery = useQuery({
    queryKey: ['batch-renew-list', ids, appliedPromo],
    queryFn: () => fetchBatchRenewList(ids, appliedPromo),
    enabled: open && ids.length > 0,
    retry: false,
  })
  const items = listQuery.data?.data.list ?? []

  function changeCycle(id: number, cycleIndex: number) {
    setSelections((prev) => ({ ...prev, [id]: cycleIndex }))
  }
  const selectedCycle = (item: BatchRenewItem): BatchRenewCycle | undefined =>
    item.billing_cycles?.[selections[item.id] ?? item.select_cycles ?? 0]

  // 官方 calcDiscountPrice（折后合计=各选中周期 price 之和）/ calcTotalPrice（原价=current_base_price 之和）
  const totalPrice = items
    .reduce((sum, item) => sum + (selectedCycle(item)?.price ?? 0), 0)
    .toFixed(2)
  const totalBasePrice = items
    .reduce(
      (sum, item) => sum + (selectedCycle(item)?.current_base_price ?? 0),
      0
    )
    .toFixed(2)
  const hasDiscount =
    hasPromoCode &&
    items.some(
      (item) =>
        (item.billing_cycles?.[0]?.promo_code_discount ?? 0) > 0 ||
        (selectedCycle(item)?.price ?? 0) <
          (selectedCycle(item)?.current_base_price ?? 0)
    )

  async function submit() {
    if (items.length === 0) return
    setSubmitting(true)
    try {
      const billingCycles: Record<number, string> = {}
      items.forEach((item) => {
        const cycle = selectedCycle(item)
        if (cycle?.billing_cycle) {
          billingCycles[item.id] = cycle.billing_cycle
        }
      })
      const res = await submitBatchRenew({
        ids: items.map((item) => item.id),
        billing_cycles: billingCycles,
        promo_code: appliedPromo,
      })
      if (res.code === 'Unpaid') {
        toast.success(`订单已生成（订单号 ${res.data?.id}），请前往订单页支付`)
      } else {
        toast.success(res.msg || '续费成功')
      }
      setOpen(false)
      onSuccess()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>批量续费</DialogTitle>
          <DialogDescription>请为选中的产品选择续费周期</DialogDescription>
        </DialogHeader>
        {listQuery.isLoading ? (
          <div className='space-y-2'>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className='h-10 w-full' />
            ))}
          </div>
        ) : listQuery.error ? (
          <p className='py-8 text-center text-sm text-muted-foreground'>
            续费信息加载失败：{getErrorMessage(listQuery.error)}
          </p>
        ) : items.length === 0 ? (
          <p className='py-8 text-center text-sm text-muted-foreground'>
            暂无可选续费周期
          </p>
        ) : (
          <div className='max-h-[480px] space-y-3 overflow-y-auto pr-1'>
            {items.map((item) => {
              const cycle = selectedCycle(item)
              return (
                <div
                  key={item.id}
                  className='grid grid-cols-[80px_1fr_1fr_120px] items-center gap-3 rounded-lg border p-3 text-sm'
                >
                  <span className='text-muted-foreground'>{item.id}</span>
                  <span className='truncate'>{item.product_name || '--'}</span>
                  <Select
                    value={String(
                      selections[item.id] ?? item.select_cycles ?? 0
                    )}
                    onValueChange={(value) =>
                      changeCycle(item.id, Number(value))
                    }
                  >
                    <SelectTrigger className='h-8'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(item.billing_cycles ?? []).map((cycleItem, index) => (
                        <SelectItem key={index} value={String(index)}>
                          {currencyPrefix}
                          {cycleItem.price}/{RENEW_CYCLE_LABEL(cycleItem)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className='text-right font-medium'>
                    {currencyPrefix}
                    {(cycle?.price ?? 0).toFixed(2)}
                  </span>
                </div>
              )
            })}
            <div className='flex items-center justify-end gap-4 text-sm'>
              {hasDiscount && (
                <span className='text-muted-foreground line-through'>
                  {currencyPrefix}
                  {totalBasePrice}
                </span>
              )}
              <span>
                合计：
                <span className='text-lg font-bold'>
                  {currencyPrefix}
                  {totalPrice}
                </span>
              </span>
            </div>
            {hasPromoCode && (
              <div className='flex items-center gap-2'>
                <Input
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder='请输入优惠码'
                  maxLength={9}
                  className='h-8 w-40'
                />
                <Button
                  variant='outline'
                  size='sm'
                  disabled={!promoCode.trim()}
                  onClick={() => {
                    setAppliedPromo(promoCode.trim())
                    listQuery.refetch()
                  }}
                >
                  使用优惠码
                </Button>
                {appliedPromo && (
                  <button
                    className='text-xs text-primary hover:underline'
                    onClick={() => {
                      setAppliedPromo('')
                      setPromoCode('')
                      listQuery.refetch()
                    }}
                  >
                    移除优惠码 {appliedPromo}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button onClick={submit} disabled={submitting || items.length === 0}>
            {submitting && <Loader2 className='mr-1 h-4 w-4 animate-spin' />}
            确认
          </Button>
          <Button variant='outline' onClick={() => setOpen(false)}>
            取消
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------- 批量开机/关机/重启（官方 batchRenewpage → batchOperation） ----------

/**
 * 官方 batchRenewpage opList 按 module-type 分组还原：
 * - cloud 类（mf_cloud/remf_finance）：renew + on/off/reboot + note
 * - dcim 类（mf_dcim/remf_finance_dcim）：renew + on/off/reboot + note
 * - common 类（idcsmart_common）：renew + on/off/reboot + crack_pass（官方无批量备注）
 * - 其他（reidcsmart_common/remf_finance_common）：renew + note
 * （官方 allOpList 中的 hard_off/hard_reboot 暂未实现，与既有 mf_dcim 行为一致）
 */
const BATCH_OPS: Record<
  string,
  {
    on?: boolean
    off?: boolean
    reboot?: boolean
    crack_pass?: boolean
    note?: boolean
  }
> = {
  mf_cloud: { on: true, off: true, reboot: true, note: true },
  mf_dcim: { on: true, off: true, reboot: true, note: true },
  idcsmart_common: { on: true, off: true, reboot: true, crack_pass: true },
  remf_finance: { on: true, off: true, reboot: true, note: true },
  remf_finance_common: { note: true },
  remf_finance_dcim: { on: true, off: true, reboot: true, note: true },
  reidcsmart_common: { note: true },
}

const BATCH_ACTION_LABEL: Record<'on' | 'off' | 'reboot', string> = {
  on: '批量开机',
  off: '批量关机',
  reboot: '批量重启',
}

function BatchOperateConfirm({
  action,
  module,
  ids,
  open,
  setOpen,
  onSuccess,
}: {
  action: 'on' | 'off' | 'reboot'
  module: string
  ids: number[]
  open: boolean
  setOpen: (open: boolean) => void
  onSuccess: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<Array<{
    id: number
    msg: string
  }> | null>(null)

  async function submit() {
    setSubmitting(true)
    try {
      // 官方 handelOp：POST /<module>/batch_operate，返回 [{id, msg}]
      const { data } = await api.post(`/${module}/batch_operate`, {
        id: ids,
        action,
        client_operate_password: '',
        client_operate_methods: 'handelOp',
        remember_operate_password: 0,
      })
      setResults(data?.data ?? [])
      onSuccess()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            确认进行{BATCH_ACTION_LABEL[action]}？
          </AlertDialogTitle>
          <AlertDialogDescription>
            将对选中的 {ids.length} 个产品执行{BATCH_ACTION_LABEL[action]}操作。
            {results && (
              <span className='mt-2 block space-y-1'>
                {results.map((item) => (
                  <span key={item.id} className='block text-xs'>
                    ID：{item.id}：{item.msg}
                  </span>
                ))}
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setOpen(false)}>
            取消
          </AlertDialogCancel>
          <AlertDialogAction onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className='mr-1 h-4 w-4 animate-spin' />}
            确定
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ---------- 批量重置密码（官方 batchRenewpage crack_pass 分支 → batchOperation 带 password） ----------

function BatchRePassDialog({
  open,
  setOpen,
  module,
  ids,
  onSuccess,
}: {
  open: boolean
  setOpen: (open: boolean) => void
  module: string
  ids: number[]
  onSuccess: () => void
}) {
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<Array<{
    id: number
    msg: string
  }> | null>(null)

  async function submit() {
    if (!password.trim()) return
    setSubmitting(true)
    try {
      // 官方 rePassSub → handelOp：POST /<module>/batch_operate，action=crack_pass + password
      const { data } = await api.post(`/${module}/batch_operate`, {
        id: ids,
        action: 'crack_pass',
        password: password.trim(),
        client_operate_password: '',
        client_operate_methods: 'handelOp',
        remember_operate_password: 0,
      })
      setResults(data?.data ?? [])
      setPassword('')
      onSuccess()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>批量重置密码</DialogTitle>
          <DialogDescription>
            为选中的 {ids.length} 个产品重置管理密码
            {results && (
              <span className='mt-2 block space-y-1'>
                {results.map((item) => (
                  <span key={item.id} className='block text-xs'>
                    ID：{item.id}：{item.msg}
                  </span>
                ))}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-2'>
          <Label htmlFor='batch-repass'>请输入新密码</Label>
          <Input
            id='batch-repass'
            type='password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder='请输入新密码'
          />
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={submitting || !password.trim()}>
            {submitting && <Loader2 className='mr-1 h-4 w-4 animate-spin' />}
            确定
          </Button>
          <Button variant='outline' onClick={() => setOpen(false)}>
            取消
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------- 批量修改备注（官方 batchRenewpage note 分支 → PUT /host/notes/batch） ----------

export function BatchNoteDialog({
  open,
  setOpen,
  ids,
  onSuccess,
}: {
  open: boolean
  setOpen: (open: boolean) => void
  ids: number[]
  onSuccess: () => void
}) {
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    setSubmitting(true)
    try {
      const res = await api.put('/host/notes/batch', { ids, notes })
      toast.success(res.data.msg || '备注修改成功')
      setOpen(false)
      onSuccess()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>批量修改备注</DialogTitle>
          <DialogDescription>
            为选中的 {ids.length} 个产品设置备注
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-2'>
          <Label htmlFor='batch-notes'>请输入备注</Label>
          <Input
            id='batch-notes'
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder='请输入备注'
          />
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className='mr-1 h-4 w-4 animate-spin' />}
            确定
          </Button>
          <Button variant='outline' onClick={() => setOpen(false)}>
            取消
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------- 流量预警（官方 trafficWarning 组件：GET/PUT /account/traffic_warning） ----------

function TrafficWarningButton({
  module,
  open,
  setOpen,
}: {
  module: string
  open: boolean
  setOpen: (open: boolean) => void
}) {
  const [warningSwitch, setWarningSwitch] = useState(1)
  const [leavePercent, setLeavePercent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 官方 created → getWarningConfig，tempValue 页面加载即赋值（v-if="tempValue" 直接显示）
  const configQuery = useQuery({
    queryKey: ['traffic-warning', module],
    queryFn: () => fetchTrafficWarning(module),
    retry: false,
  })
  const tempValue = configQuery.data?.data?.leave_percent ?? 0

  function handleOpen() {
    const current = configQuery.data?.data
    setWarningSwitch(current?.warning_switch ?? 1)
    setLeavePercent(current?.leave_percent ? String(current.leave_percent) : '')
    setOpen(true)
  }

  async function submit() {
    setSubmitting(true)
    try {
      const params: TrafficWarningData = {
        module,
        warning_switch: warningSwitch,
        leave_percent: warningSwitch === 0 ? 0 : Number(leavePercent),
      }
      const res = await saveTrafficWarning(params)
      toast.success(res.msg || '保存成功')
      setOpen(false)
      configQuery.refetch()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button variant='outline' onClick={handleOpen}>
        <Bell className='mr-1 h-4 w-4' />
        流量预警配置
      </Button>
      {tempValue > 0 && (
        <span className='text-sm text-muted-foreground'>
          在流量剩余{tempValue}%时预警提醒
        </span>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>流量预警配置</DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <Label htmlFor='warning-switch'>预警开关</Label>
              <Switch
                id='warning-switch'
                checked={warningSwitch === 1}
                onCheckedChange={(value) => setWarningSwitch(value ? 1 : 0)}
              />
            </div>
            {warningSwitch === 1 && (
              <div className='flex items-center justify-between gap-4'>
                <Label>在流量剩余</Label>
                <Select value={leavePercent} onValueChange={setLeavePercent}>
                  <SelectTrigger className='w-32'>
                    <SelectValue placeholder='请选择' />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 10, 15, 20].map((item) => (
                      <SelectItem key={item} value={String(item)}>
                        {item}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Label>时通知我</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={submit}
              disabled={submitting || (warningSwitch === 1 && !leavePercent)}
            >
              {submitting && <Loader2 className='mr-1 h-4 w-4 animate-spin' />}
              确认
            </Button>
            <Button variant='outline' onClick={() => setOpen(false)}>
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
