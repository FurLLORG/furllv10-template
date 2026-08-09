import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addCloudNatAcl,
  addCloudNatWeb,
  addHostToSecurityGroup,
  changeSimulatePhysical,
  cloudPowerAction,
  createCloudBackup,
  createCloudSnapshot,
  createCloudUpgradeOrder,
  deleteCloudBackup,
  deleteCloudNatAcl,
  deleteCloudNatWeb,
  deleteCloudSnapshot,
  fetchCloudBackupList,
  fetchCloudChart,
  fetchCloudDetail,
  fetchCloudDiskList,
  fetchCloudFlow,
  fetchCloudIpDetails,
  fetchCloudIpList,
  fetchCloudLogList,
  fetchCloudNatAclList,
  fetchCloudNatWebList,
  fetchCloudRemoteInfo,
  fetchCloudRenewPage,
  fetchCloudStatus,
  fetchCloudUpgradeConfig,
  fetchCloudUpgradeProduct,
  fetchCloudVncUrl,
  fetchHostDetail,
  fetchHostPromoCode,
  fetchHostRenewAuto,
  fetchHostSpecificInfo,
  fetchProductConfig,
  fetchSecurityGroupList,
  restoreCloudBackup,
  restoreCloudSnapshot,
  submitCloudExitRescue,
  submitCloudReinstall,
  submitCloudRenew,
  submitCloudResetPassword,
  submitCloudRescue,
  syncCloudUpgradeConfigPrice,
  syncCloudUpgradeProductPrice,
  updateHostNotes,
  updateHostRenewAuto,
  type CloudBackupItem,
  type CloudApiNamespace,
  type CloudDetailData,
  type CloudFlowData,
  type CloudIpDetailsData,
  type CloudIpRow,
  type CloudNatItem,
  type CloudRenewCycle,
  type HostSpecificInfo,
  type CloudUpgradeConfigItem,
  type CloudUpgradeProductItem,
  type CommonConfig,
  type HostDetail,
  type RemfConfigOptionItem,
} from '@/api'
import {
  ArrowLeft,
  Check,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Power,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/api'
import { installedAddons } from '@/lib/addons'
import { cn } from '@/lib/utils'
import {
  detectTabsFromContent,
  type ProductDetailTab,
  type ProductModule,
} from '@/lib/remf-module'
import { useModuleLang, type ModuleTranslator } from '@/hooks/use-module-lang'
import { useClientLang } from '@/hooks/use-client-lang'
import { resolveDcimInfo } from '@/features/client/dcim-info'
import { resolveCloudInfo } from '@/features/client/cloud-info'
import { AutoDetailFields } from '@/features/client/dynamic-fields'
import { RefundPanel } from '@/features/client/refund-panel'
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
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  RANGE_TYPES,
  SYSTEM_TYPE,
  applyInitLimits,
  createRangeArray,
  handleOptionChange,
  type ConfigForm,
  type ConfigFormValue,
} from '@/features/cart/config-engine'
import { SystemIcon } from '@/features/cart/system-selector'

/** 主机状态（官方 hostStatus 组件；文案取自官方插件 lang/index.js） */
function hostStatusMap(
  t: ModuleTranslator
): Record<string, { text: string; color: string; bgColor: string }> {
  return {
    Unpaid: { text: t('order_text4'), color: '#F64E60', bgColor: '#FFE2E5' },
    Pending: {
      text: t('finance_text88'),
      color: '#3699FF',
      bgColor: '#E1F0FF',
    },
    Active: {
      text: t('finance_text142'),
      color: '#1BC5BD',
      bgColor: '#C9F7F5',
    },
    Suspended: {
      text: t('finance_text143'),
      color: '#F99600',
      bgColor: '#FFE2E5',
    },
    Deleted: {
      text: t('finance_text144'),
      color: '#9696A3',
      bgColor: '#F2F2F7',
    },
    Failed: {
      text: t('common_cloud_text93'),
      color: '#FFA800',
      bgColor: '#FFF4DE',
    },
  }
}

/** 官方电源状态图标目录（product_detail.html：/plugins/reserver/mf_finance/template/clientarea/pc/default/img/cloudDetail/${status}.png） */
const POWER_ICON_BASE =
  '/plugins/reserver/mf_finance/template/clientarea/pc/default/img/cloudDetail/'

/** 实例电源状态（官方 cloudStatus；文案取自官方插件 lang/index.js） */
function powerStatusMap(
  t: ModuleTranslator
): Record<string, { text: string; className: string; icon: string }> {
  return {
    on: {
      text: t('common_cloud_text10'),
      className: 'bg-emerald-100 text-emerald-700',
      icon: 'on.png',
    },
    off: {
      text: t('common_cloud_text11'),
      className: 'bg-muted text-muted-foreground',
      icon: 'off.png',
    },
    operating: {
      text: t('common_cloud_text12'),
      className: 'bg-blue-100 text-blue-700',
      icon: 'operating.png',
    },
    process: {
      text: t('common_cloud_text12'),
      className: 'bg-blue-100 text-blue-700',
      icon: 'process.png',
    },
    pending: {
      text: t('common_cloud_text12'),
      className: 'bg-blue-100 text-blue-700',
      icon: 'operating.png',
    },
    fault: {
      text: t('common_cloud_text86'),
      className: 'bg-red-100 text-red-700',
      icon: 'fault.png',
    },
    suspend: {
      text: t('common_cloud_text87'),
      className: 'bg-amber-100 text-amber-700',
      icon: 'suspend.png',
    },
  }
}

/** 电源操作选项（官方 powerList；文案取自官方插件 lang/index.js） */
function powerOptions(t: ModuleTranslator) {
  return [
    { id: 1, label: t('common_cloud_text10'), value: 'on' },
    { id: 2, label: t('common_cloud_text11'), value: 'off' },
    { id: 3, label: t('common_cloud_text13'), value: 'rebot' },
    { id: 4, label: t('common_cloud_text41'), value: 'hardRebot' },
    { id: 5, label: t('common_cloud_text42'), value: 'hardOff' },
  ] as const
}

const POWER_ACTION: Record<
  string,
  'on' | 'off' | 'reboot' | 'hard_off' | 'hard_reboot'
> = {
  on: 'on',
  off: 'off',
  rebot: 'reboot',
  hardRebot: 'hard_reboot',
  hardOff: 'hard_off',
}

const PROTOCOL_OPTIONS = [
  { value: 1, label: 'TCP' },
  { value: 2, label: 'UDP' },
  { value: 3, label: 'TCP+UDP' },
]

/** 图表时间范围（官方 getstarttime；文案取自官方插件 lang/index.js） */
function chartRanges(t: ModuleTranslator) {
  return [
    { value: '1', label: t('common_cloud_label15') },
    { value: '2', label: t('common_cloud_label16') },
    { value: '3', label: t('common_cloud_label17') },
  ]
}

function formatTime(ts?: number | string): string {
  const num = Number(ts)
  if (!num || Number.isNaN(num)) return '--'
  const d = new Date(num * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * 图表时间标签（官方 API 直接返回 "YYYY-MM-DD HH:mm:ss" 字符串）
 * - 字符串原样返回；数字（秒级时间戳）转格式化字符串
 * - 若把所有点格式化成同一值（如解析失败返回 '--'），recharts category 轴去重后只剩 1 个点，
 *   hover 永远匹配首条数据（value 常为 0）→ tooltip 恒显示 0
 */
function formatChartTime(ts?: number | string): string {
  if (typeof ts === 'string') {
    const trimmed = ts.trim()
    return trimmed || '--'
  }
  const num = Number(ts)
  if (!num || Number.isNaN(num)) return '--'
  const d = new Date(num * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 从 recharts tooltip payload 里取已格式化的时间标签 */
function tooltipTime(payload?: unknown): string {
  const entry = (Array.isArray(payload) ? payload[0] : undefined) as
    | { payload?: { time?: unknown } }
    | undefined
  const time = entry?.payload?.time
  return typeof time === 'string' ? time : ''
}

function formatMoney(value: number | string | undefined): string {
  const num = Number(value)
  if (Number.isNaN(num) || num < 0) return '0.00'
  return num.toFixed(2)
}

function copyText(text: string): Promise<void> {
  return navigator.clipboard.writeText(text)
}

function isOperating(status?: string): boolean {
  return status === 'operating' || status === 'process' || status === 'pending'
}

/** 到期时间是否在十天内（官方 isRead） */
function dueSoonTime(due?: number): boolean {
  const num = Number(due)
  if (!num || Number.isNaN(num)) return false
  return (num * 1000 - Date.now()) / (24 * 60 * 60 * 1000) <= 10
}

/** 图表起始时间（官方 getstarttime：1=24小时 2=3天 3=7天） */
function chartStartTime(range: string): number {
  const now = Date.now()
  const hours = range === '1' ? 24 : range === '2' ? 72 : 168
  return now - hours * 60 * 60 * 1000
}

// ---------------------------------------------------------------------------
// 主页面
// ---------------------------------------------------------------------------

interface CloudDetailPageProps {
  hostId: number
  commonData?: CommonConfig
  /** 产品模块（默认 mf_finance/reserver；命名空间与能力集决定 API 与选项卡） */
  module?: ProductModule
  /** 后端渲染的模块页 HTML（/host/:id/view content），用于动态解析选项卡集合 */
  content?: string
}

/** 实例详情已显式渲染或内部字段（AutoDetailFields 自动渲染器跳过这些） */
const CLOUD_DETAIL_EXCLUDED = new Set([
  // 已显式渲染（resolveCloudInfo / resolveDcimInfo + 卡片 JSX）
  'cpu', 'gpu', 'memory', 'ipv6_num', 'panel_pass', 'username', 'password',
  'port', 'bw', 'flow', 'peak_defence', 'ip_num', 'ssh_key', 'image',
  'security_group',
  // 结构化对象/控制字段（对象值本身会被跳过，这里显式兜底）
  'host_data', 'config', 'custom_show', 'self_defined_field', 'config_options',
  'data_center', 'line', 'model_config', 'recommend_config', 'system_button',
  'cloud_os', 'cloud_os_group', 'dcimcloud', 'system_disk', 'data_disk',
  // 内部 / 其他 tab 已展示字段
  'type', 'order_id', 'ip', 'backup_num', 'snap_num', 'power_status',
  'support_apply_for_suspend', 'nat_acl_limit', 'nat_web_limit',
  'nat_acl_num', 'nat_web_num', 'duration', 'backup_cart_url', 'backup_mode',
  // 布尔控制开关（官方 lang 无对应标签，纯内部开关）
  'module_power_status', 'reinstall_format_data_disk',
])

/** 默认模块：mf_finance（reserver 财务云产品，remf_finance 命名空间） */
const DEFAULT_MODULE: ProductModule = {
  module: 'mf_finance',
  type: 'reserver',
  apiNamespace: 'remf_finance',
  kind: 'cloud',
  features: {
    monitor: true,
    manage: true,
    disk: true,
    network: true,
    nat: true,
    backup: true,
    upgrade: true,
  },
  langUrl:
    '/plugins/reserver/mf_finance/template/clientarea/pc/default/lang/index.js',
}

/**
 * 云产品详情页原生实现（官方各模块插件 cloudDetail.js 等价，命名空间按模块切换）：
 * - GET /host/:id 产品基础信息 + GET /:ns/:id 实例详情
 * - GET /:ns/:id/status 电源状态（操作中自动轮询）
 * - GET /:ns/:id/remote_info 救援模式状态 + GET /host/:id/ip IP 详情
 * - 监控/管理/网络(NAT)/备份快照/日志 选项卡（按模块能力集门控）+ 全部操作弹窗
 */
export function CloudDetailPage({
  hostId,
  commonData,
  module = DEFAULT_MODULE,
  content,
}: CloudDetailPageProps) {
  const queryClient = useQueryClient()
  const ns = module.apiNamespace as CloudApiNamespace
  const { t, lang } = useModuleLang(module)

  // 动态选项卡集合（官方模板 el-tab-pane，按 content 解析而非 features 猜测）
  const tabs = useMemo(() => detectTabsFromContent(content ?? ''), [content])
  // content 缺失（加载中/兜底渲染）时回退模块能力集，避免选项卡闪没
  const hasTab = (tab: ProductDetailTab): boolean => {
    if (content) return tabs.has(tab)
    if (tab === 'log') return true
    return module.features[tab] === true
  }

  const currencyPrefix =
    (commonData?.currency_prefix as string | undefined) ?? '¥'

  // 产品基础数据（官方 hostDetail）
  const hostQuery = useQuery({
    queryKey: ['cloud-detail-host', hostId],
    queryFn: () => fetchHostDetail(hostId),
    enabled: hostId > 0,
    retry: false,
  })
  const host = hostQuery.data?.data.host as HostDetail | undefined
  const selfDefinedFields = hostQuery.data?.data.self_defined_field as
    | Array<{
        id: number
        field_name?: string
        field_type?: string
        value?: string
      }>
    | undefined

  // 实例详情（官方 cloudDetail）
  const cloudQuery = useQuery({
    queryKey: ['cloud-detail-data', ns, hostId],
    queryFn: () => fetchCloudDetail(ns, hostId),
    enabled: hostId > 0,
    retry: false,
  })
  const cloudData = cloudQuery.data?.data as CloudDetailData | undefined

  // 实例电源状态（操作中每 5s 轮询，官方 getCloudStatus 递归）
  const statusQuery = useQuery({
    queryKey: ['cloud-detail-status', ns, hostId],
    queryFn: () => fetchCloudStatus(ns, hostId),
    enabled: hostId > 0,
    retry: false,
    refetchInterval: (query) =>
      isOperating(query.state.data?.data?.status) ? 5000 : false,
  })
  const status = statusQuery.data?.data?.status

  // 救援模式状态（官方 getRemoteInfo）
  const remoteQuery = useQuery({
    queryKey: ['cloud-detail-remote', ns, hostId],
    queryFn: () => fetchCloudRemoteInfo(ns, hostId),
    enabled: hostId > 0,
    retry: false,
  })
  const isRescue = remoteQuery.data?.data?.rescue === 1
  // DCIM 登录信息（官方 dcimDetail rescueStatusData：username/password/port/ip_num）
  const remoteInfo = remoteQuery.data?.data

  // IP 详情（官方 getIpDetail）
  const ipQuery = useQuery({
    queryKey: ['cloud-detail-ip', hostId],
    queryFn: () => fetchCloudIpDetails(hostId),
    enabled: hostId > 0,
    retry: false,
  })
  const ipDetails = useMemo(
    () => (ipQuery.data?.data ?? {}) as CloudIpDetailsData,
    [ipQuery.data]
  )
  const allIp = useMemo(
    () => (ipDetails.dedicate_ip || '') + ',' + (ipDetails.assign_ip || ''),
    [ipDetails.dedicate_ip, ipDetails.assign_ip]
  )
  const ipList = useMemo(
    () =>
      allIp
        .split(',')
        .map((ip) => ip.trim())
        .filter(Boolean),
    [allIp]
  )

  // 自动续费状态（官方 getRenewStatus，仅 IdcsmartRenew 插件开启时）
  const addons = useMemo(() => installedAddons(), [])
  const hasRenewAddon = addons.includes('IdcsmartRenew')
  const hasRefundAddon = addons.includes('IdcsmartRefund')
  const renewAutoQuery = useQuery({
    queryKey: ['cloud-detail-renew-auto', hostId],
    queryFn: () => fetchHostRenewAuto(hostId),
    enabled: hasRenewAddon && hostId > 0,
    retry: false,
  })
  const isAutoRenew = renewAutoQuery.data?.data?.status === 1

  // DCIM 实例信息（官方 msg-l + 冗余多源兜底：model_config/base_info/addition/remote_info）
  const dcimInfo = useMemo(
    () =>
      module.kind === 'dcim'
        ? resolveDcimInfo({
            cloudData,
            host,
            remoteInfo,
            ipDetails,
          })
        : null,
    [module.kind, cloudData, host, remoteInfo, ipDetails]
  )

  // mf_cloud 云产品（官方 cloudDetail msg-l：cpu/memory/image/line/bw/peak_defence + rescueStatusData）
  const isMfCloud = module.module === 'mf_cloud'
  const productConfigQuery = useQuery({
    queryKey: ['product-config', host?.product_id, ns],
    queryFn: () => fetchProductConfig(host?.product_id ?? 0, ns),
    enabled: isMfCloud && hostId > 0 && !!host?.product_id,
    retry: false,
  })
  const cloudInfo = useMemo(
    () =>
      isMfCloud
        ? resolveCloudInfo({
            cloudData,
            host,
            remoteInfo,
            ipDetails,
            memoryUnit: productConfigQuery.data?.data?.config?.memory_unit,
          })
        : null,
    [isMfCloud, cloudData, host, remoteInfo, ipDetails, productConfigQuery.data]
  )

  // 手动资源自定义展示字段（官方 cloudData.custom_show 动态渲染，不依赖固定结构）
  const customShow = useMemo(
    () =>
      (cloudData?.custom_show ?? []) as Array<{
        name?: string
        value?: string
        type?: string
      }>,
    [cloudData]
  )
  /** password 型字段默认打码，按索引记录已明文的项 */
  const [customShowReveal, setCustomShowReveal] = useState<Set<number>>(
    new Set()
  )
  function toggleCustomShowReveal(index: number) {
    setCustomShowReveal((set) => {
      const next = new Set(set)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const [physicalDialog, setPhysicalDialog] = useState(false)
  const [physicalAgree, setPhysicalAgree] = useState(false)
  const [physicalSubmitting, setPhysicalSubmitting] = useState(false)
  /** 模拟物理机运行开关（官方 physicalChange/handlePhysical） */
  async function toggleSimulatePhysical() {
    if (!cloudInfo) return
    if (!physicalAgree && status === 'off') return
    setPhysicalSubmitting(true)
    try {
      const res = await changeSimulatePhysical(
        ns,
        hostId,
        cloudInfo.simulatePhysicalMachine ? 0 : 1
      )
      toast.success(res.msg || t('appstore_text359'))
      setPhysicalDialog(false)
      remoteQuery.refetch()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setPhysicalSubmitting(false)
    }
  }

  // 优惠码（官方 getPromoCode，PromoCode 插件开启时）
  const hasPromoAddon = addons.includes('PromoCode')
  const promoCodeQuery = useQuery({
    queryKey: ['host-promo-code', hostId],
    queryFn: () => fetchHostPromoCode(hostId),
    enabled: hasPromoAddon && hostId > 0,
    retry: false,
  })
  const promoCodeString = useMemo(() => {
    const codes = promoCodeQuery.data?.data?.promo_code
    if (!Array.isArray(codes) || codes.length === 0) return ''
    return codes.join(',')
  }, [promoCodeQuery.data])

  // 续费价格（官方 showRenewPrice：同周期取 renew_amount 与列表价格中的较大值）
  const renewPriceQuery = useQuery({
    queryKey: ['cloud-renew-page', hostId],
    queryFn: () => fetchCloudRenewPage(hostId),
    enabled: hostId > 0,
    retry: false,
  })
  const showRenewPrice = useMemo(() => {
    const base = Number(host?.renew_amount)
    let price = Number.isNaN(base) ? 0 : base
    const cycles = renewPriceQuery.data?.data?.host
    if (Array.isArray(cycles)) {
      const current = cycles.find(
        (item) =>
          item.billing_cycle === host?.billing_cycle_name ||
          item.billing_cycle === host?.billing_cycle
      )
      if (current && Number(current.price) > price) price = Number(current.price)
    }
    return price
  }, [
    host?.renew_amount,
    host?.billing_cycle_name,
    host?.billing_cycle,
    renewPriceQuery.data,
  ])

  // 页面状态
  const [activeTab, setActiveTab] = useState('manage')
  const [notesDialog, setNotesDialog] = useState(false)
  const [notesValue, setNotesValue] = useState('')
  const [renewDialog, setRenewDialog] = useState(false)
  const [powerDialog, setPowerDialog] = useState(false)
  const [repassDialog, setRepassDialog] = useState(false)
  const [rescueDialog, setRescueDialog] = useState(false)
  const [quitRescueDialog, setQuitRescueDialog] = useState(false)
  const [reinstallDialog, setReinstallDialog] = useState(false)
  const [upgradeDialog, setUpgradeDialog] = useState(false)
  const [autoRenewDialog, setAutoRenewDialog] = useState(false)

  // 电源操作（官方 powerStatus：按当前实例状态生成可选列表）
  const powerList = useMemo(() => {
    const options = powerOptions(t)
    if (status === 'on') {
      return options.filter((o) =>
        ['off', 'hardOff', 'rebot', 'hardRebot'].includes(o.value)
      )
    }
    if (status === 'off') {
      return options.filter((o) =>
        ['on', 'rebot', 'hardRebot'].includes(o.value)
      )
    }
    return [...options]
  }, [status, t])
  const [powerStatus, setPowerStatus] = useState('on')
  // 按当前实例状态同步默认电源操作（官方 getCloudStatus 生成 powerList 后设置 powerStatus）
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (status === 'on') setPowerStatus('off')
    else if (status === 'off') setPowerStatus('on')
    else setPowerStatus('on')
  }, [status])

  // 配置详情（官方 configDetails = config_options）
  const configDetails = useMemo(() => {
    return (cloudData?.config_options ?? []).map((item) => ({
      ...item,
      show: false,
    }))
  }, [cloudData])
  const systemConfig = configDetails.find((item) => item.option_type === 12)
  const systemIcon = systemConfig?.code
  const countryName = systemConfig?.sub_name

  // 到期时间十天内标红（官方 isRead）
  const isDueSoon = dueSoonTime(host?.due_time)

  // 页面标题（官方 getCommonData）
  useEffect(() => {
    const base = commonData?.website_name || 'FurLL'
    document.title = host?.product_name
      ? `${host.product_name} - ${base}`
      : `${base} - 产品详情`
  }, [host?.product_name, commonData])

  function refreshAll() {
    queryClient.invalidateQueries({ queryKey: ['cloud-detail-host', hostId] })
    queryClient.invalidateQueries({ queryKey: ['cloud-detail-data', ns, hostId] })
    queryClient.invalidateQueries({ queryKey: ['cloud-detail-remote', ns, hostId] })
    statusQuery.refetch()
  }

  /** 电源动作执行（官方 doPowerOn/doPowerOff/...） */
  async function runPowerAction() {
    const action = POWER_ACTION[powerStatus]
    if (!action) return
    setPowerDialog(false)
    try {
      const res = await cloudPowerAction(ns, hostId, action)
      if (res.status === 200) {
        // 官方成功提示按动作区分（common_cloud_text49~53）
        const successKey =
          action === 'on'
            ? 'common_cloud_text49'
            : action === 'off'
              ? 'common_cloud_text50'
              : action === 'reboot'
                ? 'common_cloud_text51'
                : action === 'hard_reboot'
                  ? 'common_cloud_text52'
                  : 'common_cloud_text53'
        toast.success(res.msg || t(successKey))
        statusQuery.refetch()
      } else {
        toast.error(res.msg)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  /** 控制台（官方 getVncUrl） */
  async function openVnc() {
    try {
      const res = await fetchCloudVncUrl(ns, hostId)
      if (res.status === 200 && res.data?.url) {
        window.open(res.data.url, '_blank')
      } else {
        toast.error(res.msg || '获取控制台失败')
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  /** 修改备注提交（官方 subNotes） */
  async function submitNotes() {
    try {
      const res = await updateHostNotes(hostId, notesValue)
      if (res.status === 200) {
        toast.success(res.msg || t('appstore_text359'))
        setNotesDialog(false)
        hostQuery.refetch()
      } else {
        toast.error(res.msg)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  /** 自动续费开关（官方 autoRenew 组件：先 GET /host/:id/specific_info 再弹确认框） */
  async function submitAutoRenew() {
    try {
      const res = await updateHostRenewAuto(hostId, isAutoRenew ? 0 : 1)
      if (res.status === 200) {
        toast.success(res.msg || t('appstore_text359'))
        setAutoRenewDialog(false)
        renewAutoQuery.refetch()
      } else {
        toast.error(res.msg)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  // 自动续费弹窗信息（官方 autoRenewChange：打开弹窗时请求 specific_info）
  const [autoRenewInfo, setAutoRenewInfo] = useState<HostSpecificInfo | null>(null)
  const [autoRenewLoading, setAutoRenewLoading] = useState(false)
  const { t: tBase } = useClientLang()
  async function openAutoRenewDialog() {
    setAutoRenewDialog(true)
    setAutoRenewLoading(true)
    setAutoRenewInfo(null)
    try {
      const res = await fetchHostSpecificInfo(hostId)
      if (res.status === 200) {
        setAutoRenewInfo(res.data ?? null)
      } else {
        toast.error(res.msg)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setAutoRenewLoading(false)
    }
  }

  const loading = hostQuery.isLoading || cloudQuery.isLoading

  // 升降级展示（官方 system_button.upgrade_option；模块不支持时隐藏）
  const showProUpdate = useMemo(() => {
    if (!module.features.upgrade) return false
    const btn = cloudData?.system_button?.upgrade
    return btn ? !btn.disabled : false
  }, [cloudData, module.features.upgrade])
  const showOptionUpdate = useMemo(() => {
    if (!module.features.upgrade) return false
    const btn = cloudData?.system_button?.upgrade_option
    return btn ? !btn.disabled : false
  }, [cloudData, module.features.upgrade])

  return (
    <div className='space-y-4'>
      {loading ? (
        <Card className='p-6'>
          <Skeleton className='h-6 w-2/5' />
          <div className='mt-4 flex gap-6'>
            <div className='flex-1 space-y-4'>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className='h-5 w-full' />
              ))}
            </div>
            <Skeleton className='hidden w-64 sm:block' />
          </div>
        </Card>
      ) : hostQuery.error || cloudQuery.error ? (
        <Card className='flex flex-col items-center gap-3 py-16 text-center'>
          <p className='text-muted-foreground'>
            产品详情加载失败：
            {getErrorMessage(hostQuery.error ?? cloudQuery.error)}
          </p>
          <Button
            variant='outline'
            onClick={() => {
              hostQuery.refetch()
              cloudQuery.refetch()
            }}
          >
            重试
          </Button>
        </Card>
      ) : (
        <>
          {/* 头部：返回箭头 + 产品名/状态/国家 + 实例名/IP + 备注（对齐官方 cloudTop 排版） */}
          <div>
            <div className='flex flex-wrap items-end gap-x-2.5 gap-y-1'>
              <button
                type='button'
                aria-label={t('common_cloud_text43', '返回')}
                className='cursor-pointer text-primary hover:opacity-80'
                onClick={() => window.history.back()}
              >
                <ArrowLeft className='h-6 w-6' />
              </button>
              <span className='text-[28px] leading-tight font-bold text-[#171725] dark:text-foreground'>
                {host?.product_name}
              </span>
              {host?.status && hostStatusMap(t)[host.status] && (
                <span
                  className='mb-0.5 rounded-[3px] px-2 py-0.5 text-[13px] font-medium'
                  style={{
                    color: hostStatusMap(t)[host.status].color,
                    backgroundColor: hostStatusMap(t)[host.status].bgColor,
                  }}
                >
                  {hostStatusMap(t)[host.status].text}
                </span>
              )}
              {module.kind === 'dcim' && cloudData?.data_center?.country_name ? (
                <span className='mb-1 flex items-center gap-1 text-[15px] text-[#1E2736] dark:text-foreground'>
                  {cloudData.data_center.iso && (
                    <img
                      src={`/upload/common/country/${cloudData.data_center.iso}.png`}
                      alt=''
                      className='h-[14px] w-[22px] object-cover'
                    />
                  )}
                  {cloudData.data_center.country_name}
                  {cloudData.data_center.city
                    ? `-${cloudData.data_center.city}`
                    : ''}
                </span>
              ) : (
                systemIcon && (
                  <span className='mb-1 flex items-center gap-1 text-[15px] text-[#1E2736] dark:text-foreground'>
                    <img
                      src={`/upload/common/country/${systemIcon}.png`}
                      alt=''
                      className='h-[14px] w-[22px] object-cover'
                    />
                    {countryName}
                  </span>
                )
              )}
            </div>

            <div className='mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pl-7'>
              <div className='flex items-center text-[16px] text-[#8692B0] dark:text-muted-foreground'>
                {host?.name && (
                  <span className='border-r border-[#E6E7EB] pr-[21px] dark:border-border'>
                    {host?.name}
                  </span>
                )}
                {ipList.length > 0 && (
                  <span className='ml-5 flex items-center gap-1.5'>
                    <span>{ipList[0]}</span>
                    {ipDetails.ip_num && ipDetails.ip_num > 1 ? (
                      <span className='text-primary'>({ipDetails.ip_num})</span>
                    ) : null}
                    <button
                      type='button'
                      aria-label='复制IP'
                      className='cursor-pointer text-primary hover:opacity-80'
                      onClick={() =>
                        copyText(ipList.join('\n')).then(() =>
                          toast.success(t('index_text32'))
                        )
                      }
                    >
                      <Copy className='h-4 w-4' />
                    </button>
                  </span>
                )}
              </div>
              <span className='flex items-center gap-2'>
                <span className='text-xs text-[#8692B0] dark:text-muted-foreground'>
                  电源状态：
                </span>
                <span className='flex items-center gap-1'>
                  {powerStatusMap(t)[status ?? '']?.icon && (
                    <img
                      src={`${POWER_ICON_BASE}${powerStatusMap(t)[status ?? '']?.icon}`}
                      alt=''
                      className='h-[18px] w-[18px]'
                    />
                  )}
                  <span
                    className={cn(
                      'rounded px-2 py-0.5 text-xs font-medium',
                      powerStatusMap(t)[status ?? '']?.className ??
                        'bg-muted text-muted-foreground'
                    )}
                  >
                    {powerStatusMap(t)[status ?? '']?.text ?? '--'}
                  </span>
                </span>
              </span>
              {/* 退订（官方 unsubscribe 组件，IdcsmartRefund 插件） */}
              {hasRefundAddon && host?.status === 'Active' && (
                <RefundPanel
                  hostId={hostId}
                  host={host}
                  currencyPrefix={currencyPrefix}
                />
              )}
            </div>

            {/* 备注 */}
            <button
              type='button'
              onClick={() => {
                setNotesValue((host?.notes as string) ?? '')
                setNotesDialog(true)
              }}
              className='mt-2 flex cursor-pointer items-center gap-1.5 pl-7 text-sm text-primary hover:opacity-80'
            >
              <Pencil className='h-3.5 w-3.5' />
              {(host?.notes as string) || `${t('cloud_add_notes')} +`}
            </button>
          </div>

          {/* 实例信息 / 付款信息（官方 msg-l / msg-r 细边框卡，紧凑两列排布对齐高度） */}
          <div className='grid gap-4 lg:grid-cols-2'>
            <div className='rounded-[3px] border border-[#E6E7EB] px-4 pt-3 pb-4 dark:border-border'>
              <div className='flex items-center justify-between gap-2'>
                <h3 className='text-lg text-[#1E2736] dark:text-foreground'>
                  {t('appstore_text301')}
                </h3>
                <div className='flex flex-wrap items-center gap-3'>
                  {/* 复制登录信息（官方 copyLoginInfo，有用户名时展示） */}
                  {(module.kind === 'dcim' || isMfCloud) &&
                    ((module.kind === 'dcim' &&
                      dcimInfo?.username &&
                      dcimInfo.username !== '--') ||
                      (isMfCloud && cloudInfo?.username)) && (
                      <button
                        type='button'
                        className='flex cursor-pointer items-center gap-1 text-xs text-primary hover:opacity-80'
                        onClick={() => {
                          const info =
                            module.kind === 'dcim' ? dcimInfo : cloudInfo
                          const lines = [
                            `${t('common_cloud_label14')}：${info?.username ?? ''}`,
                            `${t('login_pass')}：${info?.password ?? ''}`,
                            ...(ipList.length > 0
                              ? [`IP：${ipList.join('\n')}`]
                              : []),
                            `${t('common_cloud_label13')}：${info?.port ?? ''}`,
                          ]
                          copyText(lines.join('\n')).then(() =>
                            toast.success(t('index_text32'))
                          )
                        }}
                      >
                        <Copy className='h-3 w-3' />
                        {t('copy_login_info')}
                      </button>
                    )}
                  {/* 模拟物理机运行（官方 r-t-r，manual_manage=0 且开关开启时展示） */}
                  {isMfCloud && cloudInfo?.showSimulatePhysical && (
                    <label className='flex items-center gap-1.5 text-xs text-[#1E2736] dark:text-foreground'>
                      {t('simulate_physical')}：
                      <Switch
                        checked={cloudInfo.simulatePhysicalMachine}
                        onCheckedChange={() => {
                          setPhysicalAgree(false)
                          setPhysicalDialog(true)
                        }}
                      />
                      <span
                        className='flex h-4 w-4 cursor-help items-center justify-center rounded-full border text-[10px] leading-none text-muted-foreground'
                        title={t('simulate_physical_tip')}
                      >
                        ?
                      </span>
                    </label>
                  )}
                </div>
              </div>
              <div className='mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm'>
                {configDetails.map((item) => (
                  <div key={item.id} className='flex min-w-0 gap-2'>
                    <span
                      className='w-20 shrink-0 truncate text-left text-[#1E2736] dark:text-foreground'
                      title={item.name}
                    >
                      {item.name}：
                    </span>
                    <span className='min-w-0 flex-1 break-all text-[#1E2736] dark:text-foreground'>
                      {item.sub_name ?? '--'}
                    </span>
                  </div>
                ))}
                {/* mf_finance 族：未显式适配的字段自动展示（避免后续手动适配） */}
                {!isMfCloud && module.kind !== 'dcim' && (
                  <AutoDetailFields
                    data={cloudData ?? {}}
                    exclude={CLOUD_DETAIL_EXCLUDED}
                    lang={lang}
                  />
                )}
                {/* mf_cloud 云产品实例信息（官方 cloudDetail msg-l 全字段列表，字段缺失回 --/无） */}
                {isMfCloud && cloudInfo && (
                  <>
                    <div className='flex min-w-0 gap-2'>
                      <span className='w-20 shrink-0 text-left text-[#1E2736] dark:text-foreground'>
                        CPU:
                      </span>
                      <span className='min-w-0 flex-1 break-all text-[#1E2736] dark:text-foreground'>
                        {cloudInfo.cpu}
                        {cloudInfo.cpu !== '--' ? t('common_cloud_text30') : ''}
                      </span>
                    </div>
                    <div className='flex min-w-0 gap-2'>
                      <span className='w-20 shrink-0 text-left text-[#1E2736] dark:text-foreground'>
                        GPU:
                      </span>
                      <span className='min-w-0 flex-1 break-all text-[#1E2736] dark:text-foreground'>
                        {cloudInfo.gpu}
                      </span>
                    </div>
                    <div className='flex min-w-0 gap-2'>
                      <span className='w-20 shrink-0 text-left text-[#1E2736] dark:text-foreground'>
                        {t('common_cloud_label14')}：
                      </span>
                      <span className='min-w-0 flex-1 truncate text-[#1E2736] dark:text-foreground'>
                        {cloudInfo.username || '--'}
                      </span>
                    </div>
                    <div className='flex min-w-0 gap-2'>
                      <span className='w-20 shrink-0 text-left text-[#1E2736] dark:text-foreground'>
                        {t('common_cloud_text31')}：
                      </span>
                      <span className='min-w-0 flex-1 break-all text-[#1E2736] dark:text-foreground'>
                        {cloudInfo.memory}
                      </span>
                    </div>
                    <div className='flex min-w-0 gap-2'>
                      <span className='w-20 shrink-0 text-left text-[#1E2736] dark:text-foreground'>
                        {t('cloud_os')}：
                      </span>
                      <span className='min-w-0 flex-1 break-all text-[#1E2736] dark:text-foreground'>
                        {cloudInfo.os}
                      </span>
                    </div>
                    {/* SSH 密钥或密码（官方 v-if ssh_key.id>0 || password） */}
                    {(cloudInfo.sshKeyId > 0 || cloudInfo.password) && (
                      <div className='flex min-w-0 gap-2'>
                        <span className='w-20 shrink-0 truncate text-left text-[#1E2736] dark:text-foreground'>
                          {cloudInfo.sshKeyId > 0
                            ? `${t('security_tab1')}：`
                            : `${t('common_cloud_label7')}：`}
                        </span>
                        <span className='min-w-0 flex-1 text-[#1E2736] dark:text-foreground'>
                          {cloudInfo.sshKeyId > 0 ? (
                            <span className='text-primary'>
                              {cloudInfo.sshKeyName || '--'}
                            </span>
                          ) : (
                            <HostPassword
                              value={cloudInfo.password}
                              onCopy={() =>
                                copyText(cloudInfo.password).then(() =>
                                  toast.success(t('index_text32'))
                                )
                              }
                            />
                          )}
                        </span>
                      </div>
                    )}
                    {/* 流量或带宽（官方 bill_type 分支） */}
                    {cloudInfo.billType === 'flow' ? (
                      <div className='flex min-w-0 gap-2'>
                        <span className='w-20 shrink-0 text-left text-[#1E2736] dark:text-foreground'>
                          {t('mf_flow')}：
                        </span>
                        <span className='min-w-0 flex-1 break-all text-[#1E2736] dark:text-foreground'>
                          {cloudInfo.flow || t('mf_tip28')}
                        </span>
                      </div>
                    ) : (
                      <div className='flex min-w-0 gap-2'>
                        <span className='w-20 shrink-0 text-left text-[#1E2736] dark:text-foreground'>
                          {t('mf_bw')}：
                        </span>
                        <span className='min-w-0 flex-1 break-all text-[#1E2736] dark:text-foreground'>
                          {cloudInfo.bw
                            ? `${cloudInfo.bw}Mbps`
                            : t('not_limited')}
                        </span>
                      </div>
                    )}
                    <div className='flex min-w-0 gap-2'>
                      <span className='w-20 shrink-0 text-left text-[#1E2736] dark:text-foreground'>
                        {t('common_cloud_label13')}：
                      </span>
                      <span className='min-w-0 flex-1 text-[#1E2736] dark:text-foreground'>
                        {cloudInfo.port}
                      </span>
                    </div>
                    {cloudInfo.hasDefenceRow && (
                      <div className='flex min-w-0 gap-2'>
                        <span className='w-20 shrink-0 text-left text-[#1E2736] dark:text-foreground'>
                          {t('peak_defence')}：
                        </span>
                        <span className='min-w-0 flex-1 break-all text-[#1E2736] dark:text-foreground'>
                          {cloudInfo.peakDefence
                            ? `${cloudInfo.peakDefence}G`
                            : t('no_defense')}
                        </span>
                      </div>
                    )}
                    <div className='flex min-w-0 gap-2'>
                      <span className='w-20 shrink-0 text-left text-[#1E2736] dark:text-foreground'>
                        IPv4{t('shoppingCar_goodsNums')}：
                      </span>
                      <span className='min-w-0 flex-1 text-[#1E2736] dark:text-foreground'>
                        {cloudInfo.ipv4Num
                          ? `${cloudInfo.ipv4Num}${t('mf_one')}`
                          : t('mf_none')}
                      </span>
                    </div>
                    <div className='flex min-w-0 gap-2'>
                      <span className='w-20 shrink-0 text-left text-[#1E2736] dark:text-foreground'>
                        IPv6{t('shoppingCar_goodsNums')}：
                      </span>
                      <span className='min-w-0 flex-1 text-[#1E2736] dark:text-foreground'>
                        {cloudInfo.ipv6Num
                          ? `${cloudInfo.ipv6Num}${t('mf_one')}`
                          : t('mf_none')}
                      </span>
                    </div>
                    {/* 面板密码（官方 show_panel_password_enable） */}
                    {cloudInfo.showPanelPassword && (
                      <div className='flex min-w-0 gap-2'>
                        <span className='w-20 shrink-0 text-left text-[#1E2736] dark:text-foreground'>
                          {t('panel_password')}：
                        </span>
                        <span className='min-w-0 flex-1 text-[#1E2736] dark:text-foreground'>
                          {cloudInfo.panelPass ? (
                            <HostPassword
                              value={cloudInfo.panelPass}
                              onCopy={() =>
                                copyText(cloudInfo.panelPass).then(() =>
                                  toast.success(t('index_text32'))
                                )
                              }
                            />
                          ) : (
                            '--'
                          )}
                        </span>
                      </div>
                    )}
                    {/* 未显式适配的字段自动展示（官方返回啥渲染啥，避免后续手动适配） */}
                    <AutoDetailFields
                      data={cloudData ?? {}}
                      exclude={CLOUD_DETAIL_EXCLUDED}
                      lang={lang}
                      valueFormat={(key, value) => {
                        if (key === 'network_type') {
                          return value === 'vpc'
                            ? t('mf_vpc', 'VPC')
                            : t('mf_normal', '经典网络')
                        }
                        return undefined
                      }}
                    />
                  </>
                )}
                {/* DCIM 实例信息（官方 dcimDetail msg-l；resolveDcimInfo 多源冗余兜底） */}
                {module.kind === 'dcim' && dcimInfo && (
                  <>
                    <div className='flex min-w-0 gap-2'>
                      <span className='w-20 shrink-0 text-left text-[#1E2736] dark:text-foreground'>
                        CPU:
                      </span>
                      <span className='min-w-0 flex-1 break-all text-[#1E2736] dark:text-foreground'>
                        {dcimInfo.cpu}
                      </span>
                    </div>
                    {dcimInfo.hasDefenceRow && (
                      <div className='flex min-w-0 gap-2'>
                        <span className='w-20 shrink-0 text-left text-[#1E2736] dark:text-foreground'>
                          {t('peak_defence')}：
                        </span>
                        <span className='min-w-0 flex-1 break-all text-[#1E2736] dark:text-foreground'>
                          {dcimInfo.peakDefence
                            ? `${dcimInfo.peakDefence}G`
                            : t('no_defense')}
                        </span>
                      </div>
                    )}
                    <div className='flex min-w-0 gap-2'>
                      <span className='w-20 shrink-0 text-left text-[#1E2736] dark:text-foreground'>
                        {t('common_cloud_label14')}：
                      </span>
                      <span className='min-w-0 flex-1 truncate text-[#1E2736] dark:text-foreground'>
                        {dcimInfo.username}
                      </span>
                    </div>
                    <div className='flex min-w-0 gap-2'>
                      <span className='w-20 shrink-0 text-left text-[#1E2736] dark:text-foreground'>
                        {t('common_cloud_text31')}：
                      </span>
                      <span className='min-w-0 flex-1 break-all text-[#1E2736] dark:text-foreground'>
                        {dcimInfo.memory}
                      </span>
                    </div>
                    <div className='flex min-w-0 gap-2'>
                      <span className='w-20 shrink-0 text-left text-[#1E2736] dark:text-foreground'>
                        {t('cloud_os')}：
                      </span>
                      <span className='min-w-0 flex-1 break-all text-[#1E2736] dark:text-foreground'>
                        {dcimInfo.os}
                      </span>
                    </div>
                    {dcimInfo.password && (
                      <div className='flex min-w-0 gap-2'>
                        <span className='w-20 shrink-0 text-left text-[#1E2736] dark:text-foreground'>
                          {t('login_pass')}：
                        </span>
                        <HostPassword
                          value={dcimInfo.password}
                          onCopy={() =>
                            copyText(dcimInfo.password).then(() =>
                              toast.success(t('index_text32'))
                            )
                          }
                        />
                      </div>
                    )}
                    <div className='flex min-w-0 gap-2'>
                      <span className='w-20 shrink-0 text-left text-[#1E2736] dark:text-foreground'>
                        {t('mf_disk')}：
                      </span>
                      <span className='min-w-0 flex-1 break-all text-[#1E2736] dark:text-foreground'>
                        {dcimInfo.disk}
                      </span>
                    </div>
                    {dcimInfo.billType === 'flow' ? (
                      <div className='flex min-w-0 gap-2'>
                        <span className='w-20 shrink-0 text-left text-[#1E2736] dark:text-foreground'>
                          {t('mf_flow')}：
                        </span>
                        <span className='min-w-0 flex-1 break-all text-[#1E2736] dark:text-foreground'>
                          {Number(cloudData?.flow)
                            ? `${cloudData?.flow}G`
                            : t('mf_tip28')}
                        </span>
                      </div>
                    ) : (
                      <div className='flex min-w-0 gap-2'>
                        <span className='w-20 shrink-0 text-left text-[#1E2736] dark:text-foreground'>
                          {t('mf_bw')}：
                        </span>
                        <span className='min-w-0 flex-1 break-all text-[#1E2736] dark:text-foreground'>
                          {dcimInfo.bw === 'NC'
                            ? t('actual_bw')
                            : dcimInfo.bw !== '--'
                              ? `${dcimInfo.bw}Mbps`
                              : '--'}
                        </span>
                      </div>
                    )}
                    <div className='flex min-w-0 gap-2'>
                      <span className='w-20 shrink-0 text-left text-[#1E2736] dark:text-foreground'>
                        {t('common_cloud_label13')}：
                      </span>
                      <span className='min-w-0 flex-1 text-[#1E2736] dark:text-foreground'>
                        {dcimInfo.port}
                      </span>
                    </div>
                    <div className='flex min-w-0 gap-2'>
                      <span className='w-20 shrink-0 text-left text-[#1E2736] dark:text-foreground'>
                        {t('mf_gpu')}：
                      </span>
                      <span className='min-w-0 flex-1 break-all text-[#1E2736] dark:text-foreground'>
                        {dcimInfo.gpu}
                      </span>
                    </div>
                    {dcimInfo.ipNum !== '--' && (
                      <div className='flex min-w-0 gap-2'>
                        <span className='w-20 shrink-0 text-left text-[#1E2736] dark:text-foreground'>
                          {t('common_cloud_title15')}：
                        </span>
                        <span className='min-w-0 flex-1 text-[#1E2736] dark:text-foreground'>
                          {dcimInfo.ipNum}
                          {t('common_cloud_title43')}
                        </span>
                      </div>
                    )}
                    {/* 未显式适配的字段自动展示（官方返回啥渲染啥，避免后续手动适配） */}
                    <AutoDetailFields
                      data={cloudData ?? {}}
                      exclude={CLOUD_DETAIL_EXCLUDED}
                      lang={lang}
                    />
                  </>
                )}
                {cloudData?.host_data?.username && (
                  <div className='flex min-w-0 gap-2'>
                    <span className='w-20 shrink-0 text-left text-[#1E2736] dark:text-foreground'>
                      {t('common_cloud_label14')}：
                    </span>
                    <span className='min-w-0 flex-1 truncate text-[#1E2736] dark:text-foreground'>
                      {cloudData.host_data.username}
                    </span>
                  </div>
                )}
                {cloudData?.host_data?.port != null && (
                  <div className='flex min-w-0 gap-2'>
                    <span className='w-20 shrink-0 text-left text-[#1E2736] dark:text-foreground'>
                      {t('common_cloud_label13')}：
                    </span>
                    <span className='min-w-0 flex-1 text-[#1E2736] dark:text-foreground'>
                      {String(cloudData.host_data.port)}
                    </span>
                  </div>
                )}
                {cloudData?.host_data?.password && (
                  <div className='flex min-w-0 gap-2'>
                    <span className='w-20 shrink-0 text-left text-[#1E2736] dark:text-foreground'>
                      {t('login_pass')}：
                    </span>
                    <HostPassword
                      value={cloudData.host_data.password}
                      onCopy={() =>
                        copyText(cloudData.host_data?.password ?? '').then(() =>
                          toast.success(t('index_text32'))
                        )
                      }
                    />
                  </div>
                )}
                {(selfDefinedFields ?? []).map((field) => (
                  <div key={field.id} className='flex min-w-0 gap-2'>
                    <span
                      className='w-20 shrink-0 truncate text-left text-[#1E2736] dark:text-foreground'
                      title={field.field_name}
                    >
                      {field.field_name}：
                    </span>
                    <span className='min-w-0 flex-1 break-all text-[#1E2736] dark:text-foreground'>
                      {field.field_type === 'password'
                        ? '********'
                        : field.value || '--'}
                    </span>
                  </div>
                ))}
                {/* 手动资源自定义展示字段（官方 custom_show 动态解析，type=password 打码+眼睛+复制） */}
                {customShow.map((item, index) => (
                  <div key={`cus-${index}`} className='flex min-w-0 items-center gap-2'>
                    <span
                      className='w-20 shrink-0 truncate text-left text-[#1E2736] dark:text-foreground'
                      title={item.name}
                    >
                      {item.name}：
                    </span>
                    <span className='min-w-0 flex-1 break-all text-[#1E2736] dark:text-foreground'>
                      {item.type === 'password' && item.value
                        ? customShowReveal.has(index)
                          ? item.value
                          : '********'
                        : item.value || '--'}
                    </span>
                    {item.type === 'password' && item.value ? (
                      <button
                        type='button'
                        aria-label='切换显示'
                        className='shrink-0 text-muted-foreground hover:text-primary'
                        onClick={() => toggleCustomShowReveal(index)}
                      >
                        {customShowReveal.has(index) ? (
                          <EyeOff className='h-4 w-4' />
                        ) : (
                          <Eye className='h-4 w-4' />
                        )}
                      </button>
                    ) : null}
                    {item.value ? (
                      <button
                        type='button'
                        aria-label='复制'
                        className='shrink-0 text-primary'
                        onClick={() =>
                          copyText(item.value ?? '').then(() =>
                            toast.success(t('index_text32'))
                          )
                        }
                      >
                        <Copy className='h-4 w-4' />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className='rounded-[3px] border border-[#E6E7EB] px-4 pt-3 pb-4 dark:border-border'>
              <div className='flex items-center justify-between'>
                <h3 className='text-lg text-[#1E2736] dark:text-foreground'>
                  {t('cloud_pay_title')}
                </h3>
                {hasRenewAddon &&
                  host?.status === 'Active' &&
                  host.billing_cycle !== 'onetime' &&
                  host.billing_cycle !== 'free' && (
                    <label className='flex items-center gap-2 text-sm text-[#1E2736] dark:text-foreground'>
                      {t('auto_renew')}
                      <Switch
                        checked={isAutoRenew}
                        onCheckedChange={openAutoRenewDialog}
                      />
                    </label>
                  )}
              </div>
              <div className='mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm'>
                <div className='flex items-center gap-2'>
                  <span className='shrink-0 text-[#1E2736] dark:text-foreground'>
                    {t('cloud_due_time')}：
                  </span>
                  <span className={cn(isDueSoon && 'text-destructive')}>
                    {formatTime(host?.due_time)}
                  </span>
                </div>
                <div className='flex items-center gap-2'>
                  <span className='shrink-0 text-[#1E2736] dark:text-foreground'>
                    {t('cloud_creat_time')}：
                  </span>
                  <span>{formatTime(host?.active_time)}</span>
                </div>
                <div className='flex items-center gap-2'>
                  <span className='shrink-0 text-[#1E2736] dark:text-foreground'>
                    {t('cloud_pay_style')}：
                  </span>
                  <span>
                    {(host?.billing_cycle_name as string) ||
                      (host?.billing_cycle as string) ||
                      '--'}
                  </span>
                </div>
                <div className='flex items-center gap-2'>
                  <span className='shrink-0 text-[#1E2736] dark:text-foreground'>
                    {t('cloud_first_pay')}：
                  </span>
                  <span>
                    {currencyPrefix}
                    {formatMoney(host?.first_payment_amount)}
                  </span>
                </div>
                <div className='flex items-center gap-2'>
                  <span className='shrink-0 text-[#1E2736] dark:text-foreground'>
                    {t('cloud_re_text')}：
                  </span>
                  <span>
                    {currencyPrefix}
                    {showRenewPrice ? formatMoney(showRenewPrice) : formatMoney(host?.renew_amount)}
                  </span>
                  {host?.status === 'Active' &&
                    host.billing_cycle !== 'onetime' &&
                    host.billing_cycle !== 'free' && (
                      <Button
                        size='sm'
                        className='ml-1 h-6 rounded-[5px] px-2 text-xs'
                        onClick={() => setRenewDialog(true)}
                      >
                        {t('cloud_re_btn')}
                      </Button>
                    )}
                </div>
                <div className='flex items-center gap-2'>
                  <span className='shrink-0 text-[#1E2736] dark:text-foreground'>
                    {t('cloud_code')}：
                  </span>
                  <span className='min-w-0 truncate' title={promoCodeString}>
                    {promoCodeString || '--'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 选项卡（官方 .tabs margin-top .6rem；tab 集合按 content 动态解析，
              与官方各模块 product_detail.html 一致，而非 features 注册表） */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className='mt-14 gap-3'
          >
            <TabsList className='h-auto flex-wrap'>
              {hasTab('monitor') && (
                <TabsTrigger value='monitor'>
                  {t('common_cloud_tab1')}
                </TabsTrigger>
              )}
              {hasTab('manage') && (
                <TabsTrigger value='manage'>
                  {t('common_cloud_tab2')}
                </TabsTrigger>
              )}
              {hasTab('disk') && (
                <TabsTrigger value='disk'>{t('common_cloud_tab3')}</TabsTrigger>
              )}
              {hasTab('network') && (
                <TabsTrigger value='network'>
                  {t('common_cloud_tab4')}
                </TabsTrigger>
              )}
              {hasTab('backup') && (
                <TabsTrigger value='backup'>
                  {t('common_cloud_tab5')}
                </TabsTrigger>
              )}
              {hasTab('log') && (
                <TabsTrigger value='log'>{t('common_cloud_tab6')}</TabsTrigger>
              )}
            </TabsList>

            {hasTab('monitor') && (
              <TabsContent value='monitor'>
                <MonitorTab hostId={hostId} ns={ns} module={module} />
              </TabsContent>
            )}
            {hasTab('manage') && (
              <TabsContent value='manage'>
                <ManageTab
                  hostId={hostId}
                  module={module}
                  status={status}
                  powerList={powerList}
                  powerStatus={powerStatus}
                  setPowerStatus={setPowerStatus}
                  isRescue={isRescue}
                  showProUpdate={showProUpdate}
                  showOptionUpdate={showOptionUpdate}
                  onPowerDialog={() => setPowerDialog(true)}
                  onVnc={openVnc}
                  onRepass={() => setRepassDialog(true)}
                  onRescue={() => setRescueDialog(true)}
                  onQuitRescue={() => setQuitRescueDialog(true)}
                  onReinstall={() => setReinstallDialog(true)}
                  onUpgrade={() => setUpgradeDialog(true)}
                />
              </TabsContent>
            )}
            {hasTab('disk') && (
              <TabsContent value='disk'>
                <DiskTab hostId={hostId} ns={ns} module={module} />
              </TabsContent>
            )}
            {hasTab('network') && (
              <TabsContent value='network'>
                <NetworkTab
                  hostId={hostId}
                  ns={ns}
                  module={module}
                  cloudData={cloudData}
                />
              </TabsContent>
            )}
            {hasTab('backup') && (
              <TabsContent value='backup'>
                <BackupTab
                  hostId={hostId}
                  ns={ns}
                  module={module}
                  hostName={host?.name}
                />
              </TabsContent>
            )}
            {hasTab('log') && (
              <TabsContent value='log'>
                <LogTab hostId={hostId} ns={ns} module={module} />
              </TabsContent>
            )}
          </Tabs>
        </>
      )}

      {/* 备注弹窗 */}
      <Dialog open={notesDialog} onOpenChange={setNotesDialog}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>
              {host?.notes
                ? t('common_cloud_title7')
                : t('common_cloud_title8')}
            </DialogTitle>
          </DialogHeader>
          <Input
            value={notesValue}
            onChange={(e) => setNotesValue(e.target.value)}
            placeholder={t('placeholder_pre1')}
          />
          <DialogFooter>
            <Button onClick={submitNotes}>{t('common_cloud_btn28')}</Button>
            <Button variant='outline' onClick={() => setNotesDialog(false)}>
              {t('common_cloud_btn29')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 自动续费确认（官方 autoRenew 组件：先请求 specific_info 再弹窗） */}
      <Dialog open={autoRenewDialog} onOpenChange={setAutoRenewDialog}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>
              {tBase('auto_renew_tip1')}
              {isAutoRenew
                ? tBase('auto_renew_tip3')
                : tBase('auto_renew_tip2')}
            </DialogTitle>
          </DialogHeader>
          <div className='space-y-2 text-sm'>
            {autoRenewLoading ? (
              <div className='flex h-24 items-center justify-center text-muted-foreground'>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              </div>
            ) : autoRenewInfo ? (
              <>
                <p className='flex gap-2'>
                  <span className='w-28 shrink-0 text-muted-foreground'>
                    ID：
                  </span>
                  <span>{autoRenewInfo.id}</span>
                </p>
                <p className='flex gap-2'>
                  <span className='w-28 shrink-0 text-muted-foreground'>
                    {tBase('auto_renew_name')}：
                  </span>
                  <span className='min-w-0 break-all'>
                    {autoRenewInfo.name}
                  </span>
                </p>
                {autoRenewInfo.area && (
                  <p className='flex gap-2'>
                    <span className='w-28 shrink-0 text-muted-foreground'>
                      {tBase('auto_renew_area')}：
                    </span>
                    <span>
                      {autoRenewInfo.country}-{autoRenewInfo.city}-
                      {autoRenewInfo.area}
                    </span>
                  </p>
                )}
                {autoRenewInfo.dedicate_ip && (
                  <p className='flex gap-2'>
                    <span className='w-28 shrink-0 text-muted-foreground'>
                      IP：
                    </span>
                    <span className='flex items-center gap-1.5'>
                      {autoRenewInfo.dedicate_ip}
                      {Number(autoRenewInfo.ip_num) > 1 && (
                        <span className='text-primary'>
                          ({autoRenewInfo.ip_num})
                        </span>
                      )}
                    </span>
                  </p>
                )}
                <p className='flex gap-2'>
                  <span className='w-28 shrink-0 text-muted-foreground'>
                    {tBase('auto_renew_cycle')}：
                  </span>
                  <span>
                    {currencyPrefix}
                    {formatMoney(autoRenewInfo.renew_amount)}/
                    {autoRenewInfo.billing_cycle_name}
                  </span>
                </p>
                <p className='flex gap-2'>
                  <span className='w-28 shrink-0 text-muted-foreground'>
                    {tBase('auto_renew_due')}：
                  </span>
                  <span>{formatTime(autoRenewInfo.due_time)}</span>
                </p>
              </>
            ) : (
              <div className='h-8 text-muted-foreground'>--</div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={submitAutoRenew}>
              {tBase('auto_renew_sure')}
            </Button>
            <Button variant='outline' onClick={() => setAutoRenewDialog(false)}>
              {tBase('auto_renew_cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 模拟物理机运行确认（官方 physicalChange/handlePhysical，关机状态需勾选同意强制关机） */}
      <Dialog open={physicalDialog} onOpenChange={setPhysicalDialog}>
        <DialogContent className='sm:max-w-sm'>
          <DialogHeader>
            <DialogTitle>
              {cloudInfo?.simulatePhysicalMachine
                ? `${t('mf_close')}${t('simulate_physical')}`
                : `${t('mf_open')}${t('simulate_physical')}`}
            </DialogTitle>
            {status === 'off' && (
              <label className='flex items-center gap-2 text-sm'>
                <Checkbox
                  checked={physicalAgree}
                  onCheckedChange={(v) => setPhysicalAgree(Boolean(v))}
                />
                {t('common_cloud_text24')}
              </label>
            )}
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={toggleSimulatePhysical}
              disabled={physicalSubmitting || (status === 'off' && !physicalAgree)}
            >
              {physicalSubmitting && (
                <Loader2 className='mr-1 h-4 w-4 animate-spin' />
              )}
              {t('common_cloud_btn10')}
            </Button>
            <Button variant='outline' onClick={() => setPhysicalDialog(false)}>
              {t('common_cloud_btn29')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 续费弹窗 */}
      <RenewDialog
        open={renewDialog}
        setOpen={setRenewDialog}
        hostId={hostId}
        module={module}
        currencyPrefix={currencyPrefix}
        onSuccess={() => hostQuery.refetch()}
      />

      {/* 电源操作确认弹窗 */}
      <Dialog open={powerDialog} onOpenChange={setPowerDialog}>
        <DialogContent className='sm:max-w-sm'>
          <DialogHeader>
            <DialogTitle>
              {t('common_cloud_text9')}
              {powerList.find((o) => o.value === powerStatus)?.label ?? ''}
            </DialogTitle>
            <DialogDescription>
              {t('common_cloud_text9')}对实例「{host?.name}」执行
              {powerList.find((o) => o.value === powerStatus)?.label ?? ''}
              操作？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={runPowerAction}>{t('common_cloud_btn10')}</Button>
            <Button variant='outline' onClick={() => setPowerDialog(false)}>
              {t('common_cloud_btn29')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重置密码弹窗 */}
      <RePassDialog
        open={repassDialog}
        setOpen={setRepassDialog}
        hostId={hostId}
        ns={ns}
        module={module}
        powerStatus={powerStatus}
        onSuccess={() => statusQuery.refetch()}
      />

      {/* 救援模式弹窗 */}
      <RescueDialog
        open={rescueDialog}
        setOpen={setRescueDialog}
        hostId={hostId}
        ns={ns}
        module={module}
        onSuccess={() => statusQuery.refetch()}
      />

      {/* 退出救援模式确认弹窗 */}
      <AlertDialog open={quitRescueDialog} onOpenChange={setQuitRescueDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common_cloud_btn14')}</AlertDialogTitle>
            <AlertDialogDescription>
              确认退出实例「{host?.name}」的救援模式？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common_cloud_btn29')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  const res = await submitCloudExitRescue(ns, hostId)
                  if (res.status === 200) {
                    toast.success(res.msg || t('common_cloud_text66'))
                    setQuitRescueDialog(false)
                    statusQuery.refetch()
                  } else {
                    toast.error(res.msg)
                  }
                } catch (error) {
                  toast.error(getErrorMessage(error))
                }
              }}
            >
              {t('common_cloud_btn10')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 重装系统弹窗 */}
      <ReinstallDialog
        open={reinstallDialog}
        setOpen={setReinstallDialog}
        hostId={hostId}
        ns={ns}
        module={module}
        cloudData={cloudData}
        onSuccess={() => statusQuery.refetch()}
      />

      {/* 升降级弹窗 */}
      <UpgradeDialog
        open={upgradeDialog}
        setOpen={setUpgradeDialog}
        hostId={hostId}
        ns={ns}
        module={module}
        currencyPrefix={currencyPrefix}
        showProUpdate={showProUpdate}
        showOptionUpdate={showOptionUpdate}
        onSuccess={refreshAll}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// 实例密码（掩码 + 显示/隐藏 + 复制）
// ---------------------------------------------------------------------------

function HostPassword({
  value,
  onCopy,
}: {
  value: string
  onCopy: () => void
}) {
  const [show, setShow] = useState(false)
  return (
    <span className='flex items-center gap-1.5'>
      <span className='text-foreground'>{show ? value : '********'}</span>
      <button
        type='button'
        aria-label={show ? '隐藏密码' : '显示密码'}
        className='text-muted-foreground hover:text-primary'
        onClick={() => setShow((prev) => !prev)}
      >
        {show ? (
          <EyeOff className='h-3.5 w-3.5' />
        ) : (
          <Eye className='h-3.5 w-3.5' />
        )}
      </button>
      <button
        type='button'
        aria-label='复制密码'
        className='text-muted-foreground hover:text-primary'
        onClick={onCopy}
      >
        <Copy className='h-3.5 w-3.5' />
      </button>
    </span>
  )
}

// ---------------------------------------------------------------------------
// 监控选项卡（官方 tab1：CPU/硬盘IO/内存/网卡 图表）
// ---------------------------------------------------------------------------

function MonitorTab({
  hostId,
  ns,
  module,
}: {
  hostId: number
  ns: CloudApiNamespace
  module: ProductModule
}) {
  const { t } = useModuleLang(module)
  const [range, setRange] = useState('1')
  const isDcim = module.kind === 'dcim'

  // 注意：start/end 必须在 queryFn 内计算（Date.now() 随渲染变化，
  // 若放进 queryKey 会导致每次渲染 key 都变 → react-query 无限重发请求）
  const useChartQuery = (type: string, enabled = true) =>
    useQuery({
      queryKey: ['cloud-chart', ns, hostId, type, range],
      queryFn: () =>
        fetchCloudChart(ns, hostId, {
          start: chartStartTime(range),
          end: Date.now(),
          type,
        }),
      enabled: enabled && hostId > 0,
      retry: false,
    })
  // DCIM 官方监控页只有网络带宽图（getBwList，type=bw），其余模块四图齐全
  const cpu = useChartQuery('cpu', !isDcim)
  const disk = useChartQuery('disk', !isDcim)
  const memory = useChartQuery('memory', !isDcim)
  const flow = useChartQuery(isDcim ? 'bw' : 'flow')

  const cpuData = cpu.data?.data?.list?.[0] ?? []
  const diskData0 = disk.data?.data?.list?.[0] ?? []
  const diskData1 = disk.data?.data?.list?.[1] ?? []
  const flowData0 = flow.data?.data?.list?.[0] ?? []
  const flowData1 = flow.data?.data?.list?.[1] ?? []
  const memoryLabel = memory.data?.data?.label ?? ['', '']

  // 内存图：剩余（灰底）+ 用量（彩色）叠加 = 总量
  const memoryChart = useMemo(() => {
    const memoryData0 = memory.data?.data?.list?.[0] ?? []
    const memoryData1 = memory.data?.data?.list?.[1] ?? []
    return memoryData0.map((item, index) => {
      const total = Number(memoryData0[index]?.value ?? 0)
      const usage = Number(memoryData1[index]?.value ?? 0)
      return {
        time: formatChartTime(item.time),
        usage,
        left: Math.max(0, total - usage),
      }
    })
  }, [memory.data])

  const lineChartData = (
    list0: Array<{ time?: number | string; value?: number }>,
    list1: Array<{ time?: number | string; value?: number }> = []
  ) =>
    list0.map((item, index) => ({
      time: formatChartTime(item.time),
      a: Number(item.value ?? 0),
      b: Number(list1[index]?.value ?? 0),
    }))

  // shadcn chart 主题配置：CPU/读/内存用量/网卡进统一蓝色，写/网卡出绿色，内存剩余灰色
  const CPU_COLOR = '#3b82f6'
  const DISK_WRITE_COLOR = '#10b981'
  const FLOW_OUT_COLOR = '#10b981'
  const MEMORY_LEFT_COLOR = 'var(--muted)'

  const cpuConfig = {
    a: { label: t('common_cloud_text74'), color: CPU_COLOR },
  } satisfies ChartConfig

  const diskConfig = {
    a: { label: t('common_cloud_text290'), color: CPU_COLOR },
    b: { label: t('common_cloud_text291'), color: DISK_WRITE_COLOR },
  } satisfies ChartConfig

  const memoryConfig = {
    usage: { label: memoryLabel[1] || '用量', color: CPU_COLOR },
    left: { label: memoryLabel[0] || '剩余', color: MEMORY_LEFT_COLOR },
  } satisfies ChartConfig

  const flowConfig = isDcim
    ? {
        a: { label: t('common_cloud_text76'), color: CPU_COLOR },
        b: { label: t('common_cloud_text77'), color: FLOW_OUT_COLOR },
      }
    : {
        a: { label: t('common_cloud_text293'), color: CPU_COLOR },
        b: { label: t('common_cloud_text294'), color: FLOW_OUT_COLOR },
      } satisfies ChartConfig

  return (
    <Card className='p-4 sm:p-5'>
      <div className='flex items-center justify-between'>
        <h3 className='font-bold text-foreground'>{t('common_cloud_tab1')}</h3>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className='h-8 w-28'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {chartRanges(t).map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 宽屏（xl+）一行两个，窄屏单列；DCIM 官方仅网络带宽一张图 */}
      <div className='mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2'>
        {!isDcim && (
          <>
            <ChartCard
              title={t('common_cloud_text73')}
              loading={cpu.isLoading}
              render={() => (
            <ChartContainer config={cpuConfig} className='h-[220px] w-full'>
              <LineChart data={lineChartData(cpuData)}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey='time'
                  tickLine={false}
                  tickMargin={8}
                  axisLine={false}
                  minTickGap={32}
                  tickFormatter={(value: string) => value.slice(5, 16)}
                />
                <YAxis tickLine={false} axisLine={false} width={44} />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      indicator='line'
                      labelFormatter={(_, payload) => tooltipTime(payload)}
                    />
                  }
                />
                <Line
                  type='monotone'
                  dataKey='a'
                  stroke='var(--color-a)'
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          )}
        />

        <ChartCard
          title={t('common_cloud_text289')}
          loading={disk.isLoading}
          render={() => (
            <ChartContainer config={diskConfig} className='h-[220px] w-full'>
              <LineChart data={lineChartData(diskData0, diskData1)}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey='time'
                  tickLine={false}
                  tickMargin={8}
                  axisLine={false}
                  minTickGap={32}
                  tickFormatter={(value: string) => value.slice(5, 16)}
                />
                <YAxis tickLine={false} axisLine={false} width={44} />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_, payload) => tooltipTime(payload)}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Line
                  type='monotone'
                  dataKey='a'
                  stroke='var(--color-a)'
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type='monotone'
                  dataKey='b'
                  stroke='var(--color-b)'
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          )}
        />

        <ChartCard
          title={t('common_cloud_text83')}
          loading={memory.isLoading}
          render={() => (
            <ChartContainer config={memoryConfig} className='h-[220px] w-full'>
              <BarChart data={memoryChart}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey='time'
                  tickLine={false}
                  tickMargin={8}
                  axisLine={false}
                  minTickGap={32}
                  tickFormatter={(value: string) => value.slice(5, 16)}
                />
                <YAxis tickLine={false} axisLine={false} width={44} />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_, payload) => tooltipTime(payload)}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar
                  stackId='mem'
                  dataKey='usage'
                  fill='var(--color-usage)'
                />
                <Bar
                  stackId='mem'
                  dataKey='left'
                  fill='var(--color-left)'
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          )}
        />
          </>
        )}

        <ChartCard
          title={isDcim ? t('common_cloud_text75') : t('common_cloud_text292')}
          loading={flow.isLoading}
          render={() => (
            <ChartContainer config={flowConfig} className='h-[220px] w-full'>
              <LineChart data={lineChartData(flowData0, flowData1)}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey='time'
                  tickLine={false}
                  tickMargin={8}
                  axisLine={false}
                  minTickGap={32}
                  tickFormatter={(value: string) => value.slice(5, 16)}
                />
                <YAxis tickLine={false} axisLine={false} width={44} />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_, payload) => tooltipTime(payload)}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Line
                  type='monotone'
                  dataKey='a'
                  stroke='var(--color-a)'
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type='monotone'
                  dataKey='b'
                  stroke='var(--color-b)'
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          )}
        />
      </div>
    </Card>
  )
}

function ChartCard({
  title,
  loading,
  render,
}: {
  title: string
  loading: boolean
  render: () => React.ReactElement
}) {
  return (
    <div>
      <h4 className='mb-2 text-sm font-semibold text-foreground'>{title}</h4>
      {loading ? (
        <div className='flex h-[220px] items-center justify-center'>
          <Loader2 className='h-5 w-5 animate-spin text-primary' />
        </div>
      ) : (
        render()
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 管理选项卡（官方 tab2：开关机/控制台/重置密码/救援/重装/升降级）
// ---------------------------------------------------------------------------

interface ManageTabProps {
  hostId: number
  module: ProductModule
  status?: string
  powerList: Array<{ id: number; label: string; value: string }>
  powerStatus: string
  setPowerStatus: (value: string) => void
  isRescue: boolean
  showProUpdate: boolean
  showOptionUpdate: boolean
  onPowerDialog: () => void
  onVnc: () => void
  onRepass: () => void
  onRescue: () => void
  onQuitRescue: () => void
  onReinstall: () => void
  onUpgrade: () => void
}

/** 操作卡片配置（官方 manage-item；按钮文案/描述/禁用条件全部动态计算） */
interface ManageCardItem {
  id: string
  label: string
  tips: string[]
  disabled: boolean
  action?: () => void
  variant?: 'default' | 'outline'
  icon?: ReactNode
}

function ManageTab({
  module,
  status,
  powerList,
  powerStatus,
  setPowerStatus,
  isRescue,
  showProUpdate,
  showOptionUpdate,
  onPowerDialog,
  onVnc,
  onRepass,
  onRescue,
  onQuitRescue,
  onReinstall,
  onUpgrade,
}: ManageTabProps) {
  const { t } = useModuleLang(module)
  const enabled = status === 'on' || status === 'off'

  // 官方卡片数据驱动：按钮文字/描述来自语言包，可用性按实例状态与 API 数据动态计算
  const cards = useMemo<ManageCardItem[]>(() => {
    return [
      {
        id: 'console',
        label: t('common_cloud_btn11'),
        tips: [t('common_cloud_tip17'), t('common_cloud_tip18')],
        disabled: !enabled,
        action: onVnc,
        icon: <Power className='mr-1 h-3.5 w-3.5' />,
      },
      {
        id: 'repass',
        label: t('common_cloud_btn12'),
        tips: [t('common_cloud_tip19'), t('common_cloud_tip20')],
        disabled: !enabled,
        action: onRepass,
      },
      {
        id: 'rescue',
        label: isRescue ? t('common_cloud_btn14') : t('common_cloud_btn13'),
        tips: [t('common_cloud_tip21'), t('common_cloud_tip22')],
        disabled: !enabled,
        action: isRescue ? onQuitRescue : onRescue,
        variant: isRescue ? 'outline' : 'default',
      },
      {
        id: 'reinstall',
        label: t('common_cloud_btn15'),
        tips: [t('common_cloud_tip23')],
        disabled: !enabled,
        action: onReinstall,
      },
      {
        id: 'upgrade',
        label: t('common_cloud_btn16'),
        tips: [t('common_cloud_tip24')],
        disabled: !enabled || (!showProUpdate && !showOptionUpdate),
        action: onUpgrade,
      },
      {
        id: 'boot',
        label: t('common_cloud_btn17'),
        tips: [t('common_cloud_tip25')],
        disabled: true,
      },
      {
        id: 'iso',
        label: t('common_cloud_btn18'),
        tips: [t('common_cloud_tip26')],
        disabled: true,
      },
      {
        id: 'delete',
        label: t('common_cloud_btn19'),
        tips: [t('common_cloud_tip27')],
        disabled: true,
      },
    ]
  }, [
    t,
    enabled,
    isRescue,
    showProUpdate,
    showOptionUpdate,
    onVnc,
    onRepass,
    onRescue,
    onQuitRescue,
    onReinstall,
    onUpgrade,
  ])

  return (
    <Card className='p-4 sm:p-5'>
      <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
        {/* 电源操作（官方第一张卡片：状态下拉 + 确认，powerList 按实例状态动态生成） */}
        <div className='rounded-lg border p-4'>
          <div className='flex items-center gap-2'>
            <Select value={powerStatus} onValueChange={setPowerStatus}>
              <SelectTrigger className='h-9 flex-1'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {powerList.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size='sm' disabled={!enabled} onClick={onPowerDialog}>
              {t('common_cloud_btn10')}
            </Button>
          </div>
          <p className='mt-3 text-xs text-muted-foreground'>
            {t('common_cloud_tip16')}
          </p>
        </div>

        {cards.map((card) => (
          <div key={card.id} className='rounded-lg border p-4'>
            <Button
              size='sm'
              variant={card.variant}
              disabled={card.disabled}
              onClick={card.action}
              className={
                card.disabled
                  ? 'cursor-not-allowed bg-muted text-muted-foreground'
                  : undefined
              }
            >
              {card.icon}
              {card.label}
            </Button>
            <p className='mt-3 text-xs text-muted-foreground'>
              {card.tips.filter(Boolean).map((tip, i) => (
                <span key={i}>
                  {i > 0 && <br />}
                  {tip}
                </span>
              ))}
            </p>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// 网络选项卡（官方 tab4：IP/流量/NAT/VPC）
// ---------------------------------------------------------------------------

function NetworkTab({
  hostId,
  ns,
  module,
  cloudData,
}: {
  hostId: number
  ns: CloudApiNamespace
  module: ProductModule
  cloudData?: CloudDetailData
}) {
  const { t } = useModuleLang(module)
  const queryClient = useQueryClient()
  const hostData = cloudData?.host_data ?? {}
  const showNat = module.features.nat
  const isDcim = module.kind === 'dcim'

  // DCIM IP 列表（官方 dcimDetail getIpList：GET /:ns/:id/ip 分页）
  const ipListQuery = useQuery({
    queryKey: ['cloud-ip-list', ns, hostId],
    queryFn: () => fetchCloudIpList(ns, hostId),
    enabled: isDcim && hostId > 0,
    retry: false,
  })

  // DCIM 流量（官方 dcimDetail getFlow：GET /:ns/:id/flow → total/leave/reset_flow_date）
  const flowQuery = useQuery({
    queryKey: ['cloud-flow', ns, hostId],
    queryFn: () => fetchCloudFlow(ns, hostId),
    enabled: isDcim && hostId > 0,
    retry: false,
  })
  const flowData: CloudFlowData = flowQuery.data?.data ?? {}

  // IP 列表（云产品从 host_data.dedicatedip + assignedips 组装；
  // 注意上游 reserver 的 assignedips 是数组，需兼容字符串；DCIM 走 ipList API）
  const netDataList = useMemo(() => {
    if (isDcim) {
      return (ipListQuery.data?.data?.list ?? []) as CloudIpRow[]
    }
    const ips: string[] = []
    const dedicated = hostData.dedicatedip
    if (dedicated) ips.push(String(dedicated))
    const assigned = hostData.assignedips
    if (Array.isArray(assigned)) {
      ips.push(...assigned.map((ip) => String(ip).trim()).filter(Boolean))
    } else if (assigned) {
      ips.push(
        ...String(assigned)
          .split(/[\s,]+/)
          .map((ip) => ip.trim())
          .filter(Boolean)
      )
    }
    return ips.map((ip) => ({ ip, gateway: '--', subnet_mask: '--' }))
  }, [isDcim, ipListQuery.data, hostData.dedicatedip, hostData.assignedips])

  // 流量（官方 cloudData.host_data.bwlimit/bwusage，NaN 防御显示 --）
  const rawBwlimit = hostData.bwlimit
  const rawBwusage = hostData.bwusage
  const bwlimit = Number(rawBwlimit)
  const bwusage = Number(rawBwusage)
  const flowUnlimited =
    rawBwlimit === undefined || rawBwlimit === '' || bwlimit === 0
  const flowText = (value: number): string =>
    Number.isNaN(value) ? '--' : `${value.toFixed(2)}GB`

  // NAT 开关（官方 natAclEnabled/natWebEnabled；仅 NAT 能力模块展示）
  const dcimcloud = cloudData?.dcimcloud ?? {}
  const natAclLimit = Number(
    cloudData?.nat_acl_limit ??
      dcimcloud.nat_acl_limit ??
      dcimcloud.nat_acl_num ??
      0
  )
  const natWebLimit = Number(
    cloudData?.nat_web_limit ??
      dcimcloud.nat_web_limit ??
      dcimcloud.nat_web_num ??
      0
  )
  const natAclEnabled = natAclLimit > 0 || !!dcimcloud.nat_acl
  const natWebEnabled = natWebLimit > 0 || !!dcimcloud.nat_web
  const showNatSection = showNat && (natAclEnabled || natWebEnabled)

  // NAT 列表
  const aclQuery = useQuery({
    queryKey: ['cloud-nat-acl', ns, hostId],
    queryFn: () => fetchCloudNatAclList(ns, hostId),
    enabled: showNatSection && hostId > 0,
    retry: false,
  })
  const webQuery = useQuery({
    queryKey: ['cloud-nat-web', ns, hostId],
    queryFn: () => fetchCloudNatWebList(ns, hostId),
    enabled: showNatSection && hostId > 0,
    retry: false,
  })
  const aclList = aclQuery.data?.data?.list ?? []
  const webList = webQuery.data?.data?.list ?? []

  const [natDialog, setNatDialog] = useState(false)
  const [natType, setNatType] = useState<'acl' | 'web'>('acl')
  const [natForm, setNatForm] = useState({
    name: '',
    domain: '',
    int_port: '',
    ext_port: '',
    protocol: '1',
  })
  const [natSubmitting, setNatSubmitting] = useState(false)
  const [deleteNat, setDeleteNat] = useState<CloudNatItem | null>(null)
  const [deleteKind, setDeleteKind] = useState<'acl' | 'web'>('acl')

  // 安全组（官方 cloudDetail security_group：id>0 已加入 → 管理，否则 → 加入安全组）
  const isMfCloud = module.module === 'mf_cloud'
  const navigate = useNavigate()
  const sg = (cloudData?.security_group ?? {}) as {
    id?: number
    name?: string
  }
  const securityGroupId = Number(sg.id ?? 0)
  const securityGroupName = String(sg.name ?? '')
  const [safeDialogOpen, setSafeDialogOpen] = useState(false)
  const [safeID, setSafeID] = useState(0)
  const [safeSubmitting, setSafeSubmitting] = useState(false)
  const [safeError, setSafeError] = useState('')
  const safeQuery = useQuery({
    queryKey: ['cloud-detail-security-groups'],
    queryFn: () => fetchSecurityGroupList({ page: 1, limit: 9999 }),
    enabled: safeDialogOpen,
    retry: false,
  })
  const safeOptions = safeQuery.data?.data.list ?? []

  function goSecurityPage() {
    navigate({ to: '/security_group.htm' })
  }

  function openSafeDialog() {
    setSafeID(0)
    setSafeError('')
    setSafeDialogOpen(true)
  }

  async function subAddSafe() {
    if (safeID === 0) {
      setSafeError(t('mf_tip31', '请选择安全组！'))
      return
    }
    setSafeError('')
    setSafeSubmitting(true)
    try {
      const res = await addHostToSecurityGroup(safeID, hostId)
      if (res.status === 200) {
        setSafeDialogOpen(false)
        toast.success(res.msg || '操作成功')
        queryClient.refetchQueries({ queryKey: ['cloud-detail-data', ns, hostId] })
      } else {
        setSafeError(res.msg)
      }
    } catch (err) {
      setSafeError(getErrorMessage(err))
    } finally {
      setSafeSubmitting(false)
    }
  }

  function openNatDialog(type: 'acl' | 'web') {
    setNatType(type)
    setNatForm({
      name: '',
      domain: '',
      int_port: '',
      ext_port: '',
      protocol: '1',
    })
    setNatDialog(true)
  }

  async function submitNat() {
    const intPort = Number(natForm.int_port)
    if (!intPort || intPort < 1 || intPort > 65535) {
      toast.error('请输入正确的内部端口(1-65535)')
      return
    }
    if (natType === 'acl' && !natForm.name.trim()) {
      toast.error(t('appstore_text160'))
      return
    }
    if (natType === 'web' && !natForm.domain.trim()) {
      toast.error(t('appstore_text160'))
      return
    }
    setNatSubmitting(true)
    try {
      const res =
        natType === 'acl'
          ? await addCloudNatAcl(ns, hostId, {
              name: natForm.name.trim(),
              int_port: intPort,
              ext_port: natForm.ext_port ? Number(natForm.ext_port) : undefined,
              protocol: Number(natForm.protocol),
            })
          : await addCloudNatWeb(ns, hostId, {
              domain: natForm.domain.trim(),
              int_port: intPort,
            })
      if (res.status === 200) {
        toast.success(res.msg || t('common_cloud_text44'))
        setNatDialog(false)
        queryClient.invalidateQueries({ queryKey: ['cloud-nat-acl', ns, hostId] })
        queryClient.invalidateQueries({ queryKey: ['cloud-nat-web', ns, hostId] })
      } else {
        toast.error(res.msg)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setNatSubmitting(false)
    }
  }

  async function confirmDeleteNat() {
    if (!deleteNat) return
    try {
      const res =
        deleteKind === 'acl'
          ? await deleteCloudNatAcl(ns, hostId, deleteNat.id)
          : await deleteCloudNatWeb(ns, hostId, deleteNat.id)
      if (res.status === 200) {
        toast.success(res.msg || t('common_cloud_text44'))
        queryClient.invalidateQueries({ queryKey: ['cloud-nat-acl', ns, hostId] })
        queryClient.invalidateQueries({ queryKey: ['cloud-nat-web', ns, hostId] })
      } else {
        toast.error(res.msg)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setDeleteNat(null)
    }
  }

  return (
    <div className='space-y-4'>
      <Card className='p-4 sm:p-5'>
        <h3 className='mb-3 font-bold text-foreground'>
          {t('common_cloud_title3')}
        </h3>
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common_cloud_label21')}</TableHead>
                <TableHead>{t('common_cloud_label22')}</TableHead>
                <TableHead>{t('common_cloud_label23')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {netDataList.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className='py-8 text-center text-muted-foreground'
                  >
                    暂无 IP 信息
                  </TableCell>
                </TableRow>
              ) : (
                netDataList.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{item.ip}</TableCell>
                    <TableCell>{item.gateway}</TableCell>
                    <TableCell>{item.subnet_mask}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card className='p-4 sm:p-5'>
        <h3 className='mb-3 font-bold text-foreground'>
          {t('common_cloud_title4')}
        </h3>
        {isDcim ? (
          <div className='flex flex-wrap gap-8 text-sm'>
            <div className='flex gap-2'>
              <span className='text-muted-foreground'>
                {t('common_cloud_label24')}：
              </span>
              <span className='font-medium'>{flowData.total || '--'}</span>
            </div>
            <div className='flex gap-2'>
              <span className='text-muted-foreground'>
                {t('common_cloud_label25')}：
              </span>
              <span className='font-medium'>{flowData.leave || '--'}</span>
            </div>
            {flowData.reset_flow_date != null && (
              <div className='flex gap-2'>
                <span className='text-muted-foreground'>
                  {t('common_cloud_label26')}：
                </span>
                <span className='font-medium'>{flowData.reset_flow_date}</span>
              </div>
            )}
          </div>
        ) : (
          <div className='flex flex-wrap gap-8 text-sm'>
            <div className='flex gap-2'>
              <span className='text-muted-foreground'>
                {t('common_cloud_label24')}：
              </span>
              <span className='font-medium'>
                {flowUnlimited ? t('common_cloud_title46') : flowText(bwlimit)}
              </span>
            </div>
            <div className='flex gap-2'>
              <span className='text-muted-foreground'>已用：</span>
              <span className='font-medium'>
                {flowUnlimited ? '-' : flowText(bwusage)}
              </span>
            </div>
            <div className='flex gap-2'>
              <span className='text-muted-foreground'>
                {t('common_cloud_label25')}：
              </span>
              <span className='font-medium'>
                {flowUnlimited
                  ? '-'
                  : Number.isNaN(bwlimit) || Number.isNaN(bwusage)
                    ? '--'
                    : flowText(Math.max(0, bwlimit - bwusage))}
              </span>
            </div>
          </div>
        )}
      </Card>

      {showNat && (
        <Card className='space-y-5 p-4 sm:p-5'>
          {natAclEnabled && (
            <div>
              <div className='mb-3 flex items-center justify-between'>
                <h3 className='font-bold text-foreground'>
                  NAT{t('nat_acl')} ({aclList.length}
                  {natAclLimit > 0 ? `/${natAclLimit}` : ''})
                </h3>
                <Button
                  size='sm'
                  variant='outline'
                  disabled={natAclLimit > 0 && aclList.length >= natAclLimit}
                  onClick={() => openNatDialog('acl')}
                >
                  {t('invoice_text47')}
                  {t('nat_acl')}
                </Button>
              </div>
              <div className='overflow-x-auto'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>{t('security_label1')}</TableHead>
                      <TableHead>{t('forward_ip_port')}</TableHead>
                      <TableHead>{t('int_port')}</TableHead>
                      <TableHead>{t('protocol')}</TableHead>
                      <TableHead>{t('common_cloud_label30')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aclList.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className='py-6 text-center text-muted-foreground'
                        >
                          暂无 NAT 转发规则
                        </TableCell>
                      </TableRow>
                    ) : (
                      aclList.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.id}</TableCell>
                          <TableCell>{item.name ?? '--'}</TableCell>
                          <TableCell className='flex items-center gap-1.5'>
                            {item.ip ?? '--'}
                            {item.ip && (
                              <button
                                type='button'
                                aria-label='复制IP'
                                className='text-muted-foreground hover:text-primary'
                                onClick={() =>
                                  copyText(item.ip ?? '').then(() =>
                                    toast.success(t('index_text32'))
                                  )
                                }
                              >
                                <Copy className='h-3 w-3' />
                              </button>
                            )}
                          </TableCell>
                          <TableCell>{item.int_port ?? '--'}</TableCell>
                          <TableCell>
                            {PROTOCOL_OPTIONS.find(
                              (p) => p.value === Number(item.protocol)
                            )?.label ?? '--'}
                          </TableCell>
                          <TableCell>
                            <button
                              type='button'
                              className='text-xs text-primary hover:underline'
                              onClick={() => {
                                setDeleteKind('acl')
                                setDeleteNat(item)
                              }}
                            >
                              {t('common_cloud_title25')}
                            </button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {natWebEnabled && (
            <div>
              <div className='mb-3 flex items-center justify-between'>
                <h3 className='font-bold text-foreground'>
                  NAT{t('nat_web')} ({webList.length}
                  {natWebLimit > 0 ? `/${natWebLimit}` : ''})
                </h3>
                <Button
                  size='sm'
                  variant='outline'
                  disabled={natWebLimit > 0 && webList.length >= natWebLimit}
                  onClick={() => openNatDialog('web')}
                >
                  {t('invoice_text47')}
                  {t('nat_web')}
                </Button>
              </div>
              <div className='overflow-x-auto'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>{t('domain')}</TableHead>
                      <TableHead>{t('ext_port')}</TableHead>
                      <TableHead>{t('int_port')}</TableHead>
                      <TableHead>{t('common_cloud_label30')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {webList.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className='py-6 text-center text-muted-foreground'
                        >
                          暂无 NAT 建站规则
                        </TableCell>
                      </TableRow>
                    ) : (
                      webList.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.id}</TableCell>
                          <TableCell>{item.domain ?? '--'}</TableCell>
                          <TableCell>{item.ext_port ?? '--'}</TableCell>
                          <TableCell>{item.int_port ?? '--'}</TableCell>
                          <TableCell>
                            <button
                              type='button'
                              className='text-xs text-primary hover:underline'
                              onClick={() => {
                                setDeleteKind('web')
                                setDeleteNat(item)
                              }}
                            >
                              {t('common_cloud_title25')}
                            </button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* 安全组（官方 cloudDetail security_group 动态解析：id!==0 已加入 → 管理，否则 → 加入安全组） */}
      {isMfCloud && (
        <Card className='p-4 sm:p-5'>
          <h3 className='mb-3 font-bold text-foreground'>
            {t('common_cloud_title26', '安全组')}
          </h3>
          <div className='flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2'>
            <span className='min-w-0 flex-1 truncate text-sm text-[#1E2736] dark:text-foreground'>
              {securityGroupId > 0 ? (
                <>
                  {t('common_cloud_title27', '实例位于')}
                  <span className='text-primary'>
                    {securityGroupName || '--'}
                  </span>
                </>
              ) : (
                t('common_cloud_title29', '尚未加入安全组')
              )}
            </span>
            <Button
              size='sm'
              variant={securityGroupId > 0 ? 'outline' : 'default'}
              onClick={
                securityGroupId > 0 ? goSecurityPage : openSafeDialog
              }
            >
              {securityGroupId > 0
                ? t('common_cloud_title28', '管理')
                : t('common_cloud_title30', '加入安全组')}
            </Button>
          </div>
        </Card>
      )}

      {/* 新增 NAT 弹窗 */}
      <Dialog open={natDialog} onOpenChange={setNatDialog}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>
              {t('invoice_text47')}
              {natType === 'acl' ? t('nat_acl') : t('nat_web')}
            </DialogTitle>
          </DialogHeader>
          <div className='space-y-3'>
            {natType === 'acl' ? (
              <div className='space-y-3'>
                <div className='flex items-center gap-3'>
                  <span className='w-16 shrink-0 text-sm text-muted-foreground'>
                    {t('security_label1')}
                  </span>
                  <Input
                    value={natForm.name}
                    onChange={(e) =>
                      setNatForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder={t('appstore_text160')}
                  />
                </div>
                <div className='flex items-center gap-3'>
                  <span className='w-16 shrink-0 text-sm text-muted-foreground'>
                    {t('int_port')}
                  </span>
                  <Input
                    type='number'
                    min={1}
                    max={65535}
                    value={natForm.int_port}
                    onChange={(e) =>
                      setNatForm((prev) => ({
                        ...prev,
                        int_port: e.target.value,
                      }))
                    }
                    placeholder='1-65535'
                  />
                </div>
                <div className='flex items-center gap-3'>
                  <span className='w-16 shrink-0 text-sm text-muted-foreground'>
                    {t('ext_port')}
                  </span>
                  <Input
                    type='number'
                    min={0}
                    max={65535}
                    value={natForm.ext_port}
                    onChange={(e) =>
                      setNatForm((prev) => ({
                        ...prev,
                        ext_port: e.target.value,
                      }))
                    }
                    placeholder={t('nat_tip1')}
                  />
                </div>
                <div className='flex items-center gap-3'>
                  <span className='w-16 shrink-0 text-sm text-muted-foreground'>
                    {t('protocol')}
                  </span>
                  <Select
                    value={natForm.protocol}
                    onValueChange={(v) =>
                      setNatForm((prev) => ({ ...prev, protocol: v }))
                    }
                  >
                    <SelectTrigger className='flex-1'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROTOCOL_OPTIONS.map((item) => (
                        <SelectItem key={item.value} value={String(item.value)}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className='space-y-3'>
                <div className='flex items-center gap-3'>
                  <span className='w-16 shrink-0 text-sm text-muted-foreground'>
                    {t('domain')}
                  </span>
                  <Input
                    value={natForm.domain}
                    onChange={(e) =>
                      setNatForm((prev) => ({
                        ...prev,
                        domain: e.target.value,
                      }))
                    }
                    placeholder={t('placeholder_pre1')}
                  />
                </div>
                <div className='flex items-center gap-3'>
                  <span className='w-16 shrink-0 text-sm text-muted-foreground'>
                    {t('int_port')}
                  </span>
                  <Input
                    type='number'
                    min={1}
                    max={65535}
                    value={natForm.int_port}
                    onChange={(e) =>
                      setNatForm((prev) => ({
                        ...prev,
                        int_port: e.target.value,
                      }))
                    }
                    placeholder='1-65535'
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={submitNat} disabled={natSubmitting}>
              {natSubmitting && (
                <Loader2 className='mr-1 h-4 w-4 animate-spin' />
              )}
              {t('ticket_btn6')}
            </Button>
            <Button variant='outline' onClick={() => setNatDialog(false)}>
              {t('ticket_btn9')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除 NAT 确认弹窗 */}
      <AlertDialog
        open={deleteNat !== null}
        onOpenChange={(open) => !open && setDeleteNat(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('security_btn9')}？</AlertDialogTitle>
            <AlertDialogDescription>
              确认删除该{deleteKind === 'acl' ? t('nat_acl') : t('nat_web')}
              规则（
              {deleteKind === 'acl'
                ? deleteNat?.name || deleteNat?.id
                : deleteNat?.domain || deleteNat?.id}
              ）？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('ticket_btn9')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteNat}>
              {t('common_cloud_title25')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 加入安全组（官方 handelSafeOpen/subAddSafe，POST /security_group/:id/host/:host_id） */}
      <Dialog open={safeDialogOpen} onOpenChange={setSafeDialogOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>{t('add_to_group', '加入安全组')}</DialogTitle>
          </DialogHeader>
          <div className='space-y-2'>
            <Label>{t('choose_group', '选择安全组')}</Label>
            <Select
              value={safeID > 0 ? `${safeID}` : ''}
              onValueChange={(v) => setSafeID(Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('choose_group', '选择安全组')} />
              </SelectTrigger>
              <SelectContent>
                {safeOptions.map((g) => (
                  <SelectItem key={g.id} value={`${g.id}`}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {safeError ? (
            <div className='rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40'>
              {safeError}
            </div>
          ) : null}
          <DialogFooter>
            <Button onClick={subAddSafe} disabled={safeSubmitting}>
              {safeSubmitting && (
                <Loader2 className='mr-1 h-4 w-4 animate-spin' />
              )}
              {t('finance_text70', '保存')}
            </Button>
            <Button variant='outline' onClick={() => setSafeDialogOpen(false)}>
              {t('finance_text71', '取消')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 备份与快照选项卡（官方 tab5）
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 磁盘选项卡（官方 tab3，仅 mf_cloud 有；官方该 tab 有
// cloudConfig.manual_manage===0 数据条件，此处列表 + 只读展示，动作后续补充）
// ---------------------------------------------------------------------------

function DiskTab({
  hostId,
  ns,
  module,
}: {
  hostId: number
  ns: CloudApiNamespace
  module: ProductModule
}) {
  const { t } = useModuleLang(module)
  const diskQuery = useQuery({
    queryKey: ['cloud-disk', ns, hostId],
    queryFn: () => fetchCloudDiskList(ns, hostId),
    enabled: hostId > 0,
    retry: false,
  })
  const list = diskQuery.data?.data?.list ?? []

  return (
    <Card className='p-4 sm:p-5'>
      <div className='mb-3 flex items-center justify-between'>
        <h3 className='font-bold text-foreground'>
          {t('common_cloud_tab3')}（{list.length}）
        </h3>
      </div>
      {list.length === 0 ? (
        <p className='py-6 text-center text-sm text-muted-foreground'>
          暂无磁盘
        </p>
      ) : (
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common_cloud_label18')}</TableHead>
                <TableHead>{t('common_cloud_label20')}</TableHead>
                <TableHead>{t('common_cloud_label28')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.name ?? `磁盘${item.id}`}</TableCell>
                  <TableCell>
                    {item.size != null ? `${item.size}G` : '--'}
                  </TableCell>
                  <TableCell>{formatTime(item.create_time)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  )
}

function BackupTab({
  hostId,
  ns,
  module,
  hostName,
}: {
  hostId: number
  ns: CloudApiNamespace
  module: ProductModule
  hostName?: string
}) {
  const { t } = useModuleLang(module)
  const backupQuery = useQuery({
    queryKey: ['cloud-backup', ns, hostId],
    queryFn: () => fetchCloudBackupList(ns, hostId, { page: 1, limit: 100 }),
    enabled: hostId > 0,
    retry: false,
  })
  const data = backupQuery.data?.data
  const backupNum = data?.backup_num ?? -1
  const snapNum = data?.snap_num ?? -1
  const backupList = (data?.list ?? []).filter((item) => item.type === 'backup')
  const snapshotList = (data?.list ?? []).filter((item) => item.type === 'snap')
  const diskList = data?.disk ?? []

  const [createType, setCreateType] = useState<'backup' | 'snap'>('backup')
  const [createDialog, setCreateDialog] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDisk, setCreateDisk] = useState('')
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [restoreItem, setRestoreItem] = useState<CloudBackupItem | null>(null)
  const [deleteItem, setDeleteItem] = useState<CloudBackupItem | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  function refresh() {
    backupQuery.refetch()
  }

  function openCreate(type: 'backup' | 'snap') {
    setCreateType(type)
    setCreateName('')
    setCreateDisk(String(diskList[0]?.id ?? ''))
    setCreateDialog(true)
  }

  async function submitCreate() {
    if (!createName.trim()) {
      toast.error(t('appstore_text160'))
      return
    }
    if (!createDisk) {
      toast.error(t('common_cloud_text70'))
      return
    }
    setCreateSubmitting(true)
    try {
      const res =
        createType === 'backup'
          ? await createCloudBackup(ns, hostId, {
              name: createName.trim(),
              disk_id: Number(createDisk),
            })
          : await createCloudSnapshot(ns, hostId, {
              name: createName.trim(),
              disk_id: Number(createDisk),
            })
      if (res.status === 200) {
        toast.success(
          res.msg ||
            t(
              createType === 'backup'
                ? 'common_cloud_text71'
                : 'common_cloud_text72'
            )
        )
        setCreateDialog(false)
        refresh()
      } else {
        toast.error(res.msg)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setCreateSubmitting(false)
    }
  }

  async function confirmRestore() {
    if (!restoreItem) return
    setActionLoading(true)
    try {
      const res =
        restoreItem.type === 'backup'
          ? await restoreCloudBackup(ns, hostId, restoreItem.id)
          : await restoreCloudSnapshot(ns, hostId, restoreItem.id)
      if (res.status === 200) {
        toast.success(res.msg || t('common_cloud_text44'))
        setRestoreItem(null)
      } else {
        toast.error(res.msg)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setActionLoading(false)
    }
  }

  async function confirmDelete() {
    if (!deleteItem) return
    setActionLoading(true)
    try {
      const res =
        deleteItem.type === 'backup'
          ? await deleteCloudBackup(ns, hostId, deleteItem.id)
          : await deleteCloudSnapshot(ns, hostId, deleteItem.id)
      if (res.status === 200) {
        toast.success(res.msg || t('common_cloud_text44'))
        setDeleteItem(null)
        refresh()
      } else {
        toast.error(res.msg)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className='space-y-4'>
      <BackupSection
        title={t('common_cloud_title5')}
        createTitle={t('common_cloud_btn23')}
        notEnabled={t('common_cloud_text20')}
        nameLabel={t('common_cloud_label27')}
        items={backupList}
        num={backupNum}
        loading={backupQuery.isLoading}
        module={module}
        onCreate={() => openCreate('backup')}
        onRestore={(item) => setRestoreItem(item)}
        onDelete={(item) => setDeleteItem(item)}
      />
      <BackupSection
        title={t('common_cloud_title6')}
        createTitle={t('common_cloud_btn27')}
        notEnabled={t('common_cloud_text21')}
        nameLabel={t('common_cloud_label31')}
        items={snapshotList}
        num={snapNum}
        loading={backupQuery.isLoading}
        module={module}
        onCreate={() => openCreate('snap')}
        onRestore={(item) => setRestoreItem(item)}
        onDelete={(item) => setDeleteItem(item)}
      />

      {/* 创建备份/快照弹窗 */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>
              {t(
                createType === 'backup'
                  ? 'common_cloud_btn45'
                  : 'common_cloud_btn46'
              )}
            </DialogTitle>
            <DialogDescription>
              {t('common_cloud_btn47')}
              {t('common_cloud_btn48')}
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-3'>
            <div className='flex items-center gap-3'>
              <span className='w-16 shrink-0 text-sm text-muted-foreground'>
                {t('common_cloud_btn40')}
              </span>
              <Select value={createDisk} onValueChange={setCreateDisk}>
                <SelectTrigger className='flex-1'>
                  <SelectValue placeholder={t('common_cloud_text70')} />
                </SelectTrigger>
                <SelectContent>
                  {diskList.map((disk) => (
                    <SelectItem key={disk.id} value={String(disk.id)}>
                      {disk.name ?? `磁盘${disk.id}`}
                      {disk.size != null ? ` (${disk.size}G)` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='flex items-center gap-3'>
              <span className='w-16 shrink-0 text-sm text-muted-foreground'>
                {t('security_label1')}
              </span>
              <Input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder={t('appstore_text160')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submitCreate} disabled={createSubmitting}>
              {createSubmitting && (
                <Loader2 className='mr-1 h-4 w-4 animate-spin' />
              )}
              {t('common_cloud_btn28')}
            </Button>
            <Button variant='outline' onClick={() => setCreateDialog(false)}>
              {t('common_cloud_btn29')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 还原确认弹窗 */}
      <AlertDialog
        open={restoreItem !== null}
        onOpenChange={(open) => !open && setRestoreItem(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common_cloud_btn56')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('common_cloud_btn50')}
              {hostName ?? '实例'}
              {t('common_cloud_btn51')}
              {t('common_cloud_btn52')}
              {restoreItem?.type === 'backup'
                ? t('common_cloud_btn53')
                : t('common_cloud_btn54')}
              「{restoreItem?.name ?? ''}」(
              {formatTime(restoreItem?.create_time)})，
              {t('common_cloud_btn55')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common_cloud_btn29')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRestore}
              disabled={actionLoading}
            >
              {actionLoading && (
                <Loader2 className='mr-1 h-4 w-4 animate-spin' />
              )}
              {t('common_cloud_btn56')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 删除确认弹窗 */}
      <AlertDialog
        open={deleteItem !== null}
        onOpenChange={(open) => !open && setDeleteItem(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(
                deleteItem?.type === 'backup'
                  ? 'common_cloud_btn57'
                  : 'common_cloud_btn58'
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('common_cloud_btn59')}
              {deleteItem?.type === 'backup'
                ? t('common_cloud_btn53')
                : t('common_cloud_btn54')}
              「{deleteItem?.name ?? ''}」？删除后不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common_cloud_btn29')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={actionLoading}>
              {actionLoading && (
                <Loader2 className='mr-1 h-4 w-4 animate-spin' />
              )}
              {t('common_cloud_btn61')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function BackupSection({
  title,
  createTitle,
  notEnabled,
  nameLabel,
  items,
  num,
  loading,
  module,
  onCreate,
  onRestore,
  onDelete,
}: {
  title: string
  createTitle: string
  notEnabled: string
  nameLabel: string
  items: CloudBackupItem[]
  num: number
  /** 列表请求尚未返回；此时 num 借位 -1，需显示加载动画而非"不支持" */
  loading?: boolean
  module: ProductModule
  onCreate: () => void
  onRestore: (item: CloudBackupItem) => void
  onDelete: (item: CloudBackupItem) => void
}) {
  const { t } = useModuleLang(module)
  return (
    <Card className='p-4 sm:p-5'>
      <div className='mb-3 flex items-center justify-between'>
        <h3 className='font-bold text-foreground'>
          {title} ({items.length}
          {num >= 0 ? `/${num === 0 ? t('common_cloud_title46') : num}` : ''})
        </h3>
        <Button
          size='sm'
          variant='outline'
          disabled={num !== -1 && num > 0 && items.length >= num}
          onClick={onCreate}
        >
          {createTitle}
        </Button>
      </div>
      {loading ? (
        <div className='flex items-center justify-center gap-2 py-6 text-muted-foreground'>
          <Loader2 className='h-4 w-4 animate-spin' />
          加载中...
        </div>
      ) : num === -1 ? (
        <p className='py-6 text-center text-sm text-muted-foreground'>
          {notEnabled}
        </p>
      ) : items.length === 0 ? (
        <p className='py-6 text-center text-sm text-muted-foreground'>
          暂无{title}
        </p>
      ) : (
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{nameLabel}</TableHead>
                <TableHead>{t('common_cloud_label28')}</TableHead>
                <TableHead>{t('common_cloud_label29')}</TableHead>
                <TableHead>{t('common_cloud_label30')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.name ?? '--'}</TableCell>
                  <TableCell>{formatTime(item.create_time)}</TableCell>
                  <TableCell>{item.remarks ?? '--'}</TableCell>
                  <TableCell>
                    {Number(item.status) === 1 ? (
                      <span className='space-x-3'>
                        <button
                          type='button'
                          className='text-xs text-primary hover:underline'
                          onClick={() => onRestore(item)}
                        >
                          {t('common_cloud_btn24')}
                        </button>
                        <button
                          type='button'
                          className='text-xs text-destructive hover:underline'
                          onClick={() => onDelete(item)}
                        >
                          {t('common_cloud_btn25')}
                        </button>
                      </span>
                    ) : (
                      <span className='inline-flex items-center gap-1 text-muted-foreground'>
                        <Loader2 className='h-3 w-3 animate-spin' />
                        {t('common_cloud_title31')}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// 日志选项卡（官方 tab6）
// ---------------------------------------------------------------------------

function LogTab({
  hostId,
  ns,
  module,
}: {
  hostId: number
  ns: CloudApiNamespace
  module: ProductModule
}) {
  const { t } = useModuleLang(module)
  const [page, setPage] = useState(1)
  const limit = 20
  const logQuery = useQuery({
    queryKey: ['cloud-log', ns, hostId, page, limit],
    queryFn: () =>
      fetchCloudLogList(ns, hostId, { page, limit, orderby: 'id', sort: 'desc' }),
    enabled: hostId > 0,
    retry: false,
  })
  const logs = logQuery.data?.data?.list ?? []
  const total = Number(logQuery.data?.data?.count ?? 0)
  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <Card className='p-4 sm:p-5'>
      <h3 className='mb-3 font-bold text-foreground'>
        {t('common_cloud_tab6')}
      </h3>
      <div className='overflow-x-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-20'>
                {t('common_cloud_label32')}
              </TableHead>
              <TableHead className='w-44'>
                {t('common_cloud_label33')}
              </TableHead>
              <TableHead>{t('common_cloud_label34')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={3} className='py-8 text-center'>
                  <Loader2 className='mx-auto h-5 w-5 animate-spin text-primary' />
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className='py-8 text-center text-muted-foreground'
                >
                  暂无日志
                </TableCell>
              </TableRow>
            ) : (
              logs.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.id ?? '--'}</TableCell>
                  <TableCell>{formatTime(item.create_time)}</TableCell>
                  <TableCell>{item.description ?? '--'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {total > limit && (
        <div className='mt-4 flex items-center justify-between text-sm'>
          <span className='text-muted-foreground'>
            共 {total} 条，第 {page}/{totalPages} 页
          </span>
          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              上一页
            </Button>
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
    </Card>
  )
}

// ---------------------------------------------------------------------------
// 续费弹窗（官方 renewDialog 组件简化版）
// ---------------------------------------------------------------------------

function RenewDialog({
  open,
  setOpen,
  hostId,
  module,
  currencyPrefix,
  onSuccess,
}: {
  open: boolean
  setOpen: (open: boolean) => void
  hostId: number
  module: ProductModule
  currencyPrefix: string
  onSuccess: () => void
}) {
  const { t } = useModuleLang(module)
  const renewQuery = useQuery({
    queryKey: ['cloud-renew-page', hostId],
    queryFn: () => fetchCloudRenewPage(hostId),
    enabled: open && hostId > 0,
    retry: false,
  })
  const cycles = renewQuery.data?.data?.host ?? []
  const [activeIndex, setActiveIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  // 弹窗打开时重置选中周期（官方 renewItemChange 默认第一个）
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setActiveIndex(0)
  }, [open])

  const active = cycles[activeIndex] as CloudRenewCycle | undefined

  async function submit() {
    if (!active?.billing_cycle) return
    setSubmitting(true)
    try {
      const res = await submitCloudRenew(hostId, {
        billing_cycle: active.billing_cycle,
        customfield: { promo_code: '' },
      })
      if (res.code === 'Paid') {
        toast.success(res.msg || '续费成功')
      } else {
        toast.success(
          `订单已生成（订单号 ${res.data?.id ?? ''}），请前往订单页支付`
        )
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
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('common_cloud_title10')}</DialogTitle>
        </DialogHeader>
        {renewQuery.isLoading ? (
          <div className='space-y-2 py-4'>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className='h-12 w-full' />
            ))}
          </div>
        ) : renewQuery.error ? (
          <p className='py-6 text-center text-sm text-muted-foreground'>
            续费信息加载失败：{getErrorMessage(renewQuery.error)}
          </p>
        ) : cycles.length === 0 ? (
          <p className='py-6 text-center text-sm text-muted-foreground'>
            暂无可续费周期
          </p>
        ) : (
          <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
            {cycles.map((item, index) => {
              const activeItem = index === activeIndex
              return (
                <button
                  key={item.billing_cycle ?? index}
                  type='button'
                  onClick={() => setActiveIndex(index)}
                  className={cn(
                    'relative rounded-lg border p-3 text-center transition-colors',
                    activeItem
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40'
                  )}
                >
                  <p className='text-sm font-medium'>
                    {item.billing_cycle_name ?? item.billing_cycle}
                  </p>
                  <p className='mt-1 text-primary'>
                    {currencyPrefix}
                    {formatMoney(item.price)}
                  </p>
                  {activeItem && (
                    <Check className='absolute top-1.5 right-1.5 h-3.5 w-3.5 text-primary' />
                  )}
                </button>
              )
            })}
          </div>
        )}
        <DialogFooter>
          <Button
            onClick={submit}
            disabled={submitting || !active?.billing_cycle}
          >
            {submitting && <Loader2 className='mr-1 h-4 w-4 animate-spin' />}
            {t('common_cloud_btn30')}
          </Button>
          <Button variant='outline' onClick={() => setOpen(false)}>
            {t('common_cloud_btn29')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// 重置密码弹窗（官方 rePassSub）
// ---------------------------------------------------------------------------

function RePassDialog({
  open,
  setOpen,
  hostId,
  ns,
  module,
  powerStatus,
  onSuccess,
}: {
  open: boolean
  setOpen: (open: boolean) => void
  hostId: number
  ns: CloudApiNamespace
  module: ProductModule
  powerStatus: string
  onSuccess: () => void
}) {
  const { t } = useModuleLang(module)
  const [password, setPassword] = useState('')
  const [checked, setChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errText, setErrText] = useState('')

  // 弹窗打开时重置表单（官方 showRePass 清空）
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPassword('')
      setChecked(false)
      setErrText('')
    }
  }, [open])

  async function submit() {
    if (!password) {
      setErrText(t('common_cloud_text61'))
      return
    }
    if (powerStatus === 'off' && !checked) {
      setErrText(t('common_cloud_text62'))
      return
    }
    setSubmitting(true)
    setErrText('')
    try {
      const res = await submitCloudResetPassword(ns, hostId, password)
      if (res.status === 200) {
        toast.success(res.msg || t('common_cloud_text63'))
        setOpen(false)
        onSuccess()
      } else {
        setErrText(res.msg)
      }
    } catch (error) {
      setErrText(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('common_cloud_title13')}</DialogTitle>
          <DialogDescription>{t('common_cloud_text23')}</DialogDescription>
        </DialogHeader>
        <div className='space-y-3'>
          <Input
            type='text'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('common_cloud_text61')}
          />
          {powerStatus === 'off' && (
            <div className='rounded-md bg-amber-50 p-3 text-xs text-amber-700'>
              <p className='mb-1 font-medium'>{t('common_cloud_tip30')}</p>
              <p>1. {t('common_cloud_tip31')}</p>
              <p>2. {t('common_cloud_tip32')}</p>
              <label className='mt-2 flex cursor-pointer items-center gap-2'>
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => setChecked(v === true)}
                />
                {t('common_cloud_text24')}
              </label>
            </div>
          )}
          {errText && <p className='text-sm text-destructive'>{errText}</p>}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className='mr-1 h-4 w-4 animate-spin' />}
            {t('common_cloud_btn28')}
          </Button>
          <Button variant='outline' onClick={() => setOpen(false)}>
            {t('common_cloud_btn29')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// 救援模式弹窗（官方 rescueSub）
// ---------------------------------------------------------------------------

function RescueDialog({
  open,
  setOpen,
  hostId,
  ns,
  module,
  onSuccess,
}: {
  open: boolean
  setOpen: (open: boolean) => void
  hostId: number
  ns: CloudApiNamespace
  module: ProductModule
  onSuccess: () => void
}) {
  const { t } = useModuleLang(module)
  const [type, setType] = useState('1')
  const [tempPass, setTempPass] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errText, setErrText] = useState('')

  // 弹窗打开时重置表单（官方 showRescueDialog 清空）
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setType('1')
      setTempPass('')
      setErrText('')
    }
  }, [open])

  async function submit() {
    if (!type) {
      setErrText(t('common_cloud_text64'))
      return
    }
    if (!tempPass) {
      setErrText(t('common_cloud_text65'))
      return
    }
    setSubmitting(true)
    setErrText('')
    try {
      const res = await submitCloudRescue(ns, hostId, { type, temp_pass: tempPass })
      if (res.status === 200) {
        toast.success(res.msg || t('common_cloud_text66'))
        setOpen(false)
        onSuccess()
      } else {
        setErrText(res.msg)
      }
    } catch (error) {
      setErrText(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('common_cloud_tab7')}</DialogTitle>
          <DialogDescription>{t('common_cloud_tip34')}</DialogDescription>
        </DialogHeader>
        <div className='space-y-3'>
          <div className='flex items-center gap-3'>
            <span className='w-16 shrink-0 text-sm text-muted-foreground'>
              {t('common_cloud_tab8')}
            </span>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className='flex-1'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='1'>Windows</SelectItem>
                <SelectItem value='2'>Linux</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className='flex items-center gap-3'>
            <span className='w-16 shrink-0 text-sm text-muted-foreground'>
              {t('common_cloud_tab9')}
            </span>
            <Input
              value={tempPass}
              onChange={(e) => setTempPass(e.target.value)}
              placeholder={t('common_cloud_text65')}
            />
          </div>
          {errText && <p className='text-sm text-destructive'>{errText}</p>}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className='mr-1 h-4 w-4 animate-spin' />}
            {t('withdraw_btn1')}
          </Button>
          <Button variant='outline' onClick={() => setOpen(false)}>
            {t('withdraw_btn2')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// 重装系统弹窗（官方 doReinstall）
// ---------------------------------------------------------------------------

function ReinstallDialog({
  open,
  setOpen,
  hostId,
  ns,
  module,
  cloudData,
  onSuccess,
}: {
  open: boolean
  setOpen: (open: boolean) => void
  hostId: number
  ns: CloudApiNamespace
  module: ProductModule
  cloudData?: CloudDetailData
  onSuccess: () => void
}) {
  const { t } = useModuleLang(module)
  const osGroups = useMemo(() => cloudData?.cloud_os_group ?? [], [cloudData])
  const osList = useMemo(() => cloudData?.cloud_os ?? [], [cloudData])
  const [osGroupId, setOsGroupId] = useState('')
  const [osId, setOsId] = useState('')
  const [port, setPort] = useState('')
  const [formatDataDisk, setFormatDataDisk] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errText, setErrText] = useState('')

  const group = osGroups.find((item) => String(item.id) === osGroupId)
  const versions = osList.filter((item) => String(item.group) === osGroupId)

  // 随机生成端口（官方 autoPort：3 位数字，首位不为 0 → 100~999）
  function autoPort() {
    const temp = Array.from({ length: 3 }, () =>
      Math.floor(Math.random() * 10).toString()
    ).join('')
    setPort(
      temp[0] === '0' ? `${Math.ceil(Math.random() * 9)}${temp.slice(1)}` : temp
    )
  }

  // 弹窗打开时重置表单并默认第一个系统组（官方 showReinstall 清空 + getCloudDetail 默认 osData[0]）
  useEffect(() => {
    if (open) {
      const firstId = String(osGroups[0]?.id ?? '')
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOsGroupId(firstId)
      setOsId(
        String(osList.find((item) => String(item.group) === firstId)?.id ?? '')
      )
      setPort('')
      setFormatDataDisk(false)
      setErrText('')
    }
  }, [open, osGroups, osList])

  async function submit() {
    if (!osId) {
      setErrText(t('common_cloud_text45'))
      return
    }
    if (!port) {
      setErrText(t('common_cloud_text46'))
      return
    }
    setSubmitting(true)
    setErrText('')
    try {
      const res = await submitCloudReinstall(ns, hostId, {
        os: Number(osId),
        port: Number(port),
        format_data_disk: formatDataDisk ? 1 : 0,
      })
      if (res.status === 200) {
        toast.success(res.msg || t('common_cloud_text44'))
        setOpen(false)
        onSuccess()
      } else {
        setErrText(res.msg)
      }
    } catch (error) {
      setErrText(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('common_cloud_title9')}</DialogTitle>
          <DialogDescription>重新安装操作系统，请谨慎操作</DialogDescription>
        </DialogHeader>
        <div className='space-y-3'>
          <div className='flex items-center gap-3'>
            <span className='w-16 shrink-0 text-sm text-muted-foreground'>
              {t('common_cloud_label6')}
            </span>
            <Select
              value={osGroupId}
              onValueChange={(value) => {
                setOsGroupId(value)
                // 切换系统组后默认选中该组第一个版本（官方 osSelectGroupChange）
                const first = osList.find((item) => String(item.group) === value)
                setOsId(String(first?.id ?? ''))
              }}
            >
              <SelectTrigger className='flex-1'>
                <SelectValue placeholder={t('com_config.please_select')} />
              </SelectTrigger>
              <SelectContent>
                {osGroups.map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    <span className='flex items-center gap-2'>
                      <SystemIcon value={item.name ?? ''} className='h-4 w-4' />
                      {item.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='flex items-center gap-3'>
            <span className='w-16 shrink-0 text-sm text-muted-foreground'>
              版本
            </span>
            <Select value={osId} onValueChange={setOsId}>
              <SelectTrigger className='flex-1'>
                <SelectValue placeholder={t('com_config.please_select')} />
              </SelectTrigger>
              <SelectContent>
                {versions.map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.name ?? item.version ?? `系统${item.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='flex items-center gap-3'>
            <span className='w-16 shrink-0 text-sm text-muted-foreground'>
              {t('common_cloud_label13')}
            </span>
            <div className='flex flex-1 gap-2'>
              <Input
                type='number'
                min={1}
                max={65535}
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder={t('common_cloud_text46')}
              />
              <Button
                type='button'
                variant='outline'
                className='shrink-0'
                onClick={autoPort}
              >
                {t('common_cloud_btn1')}
              </Button>
            </div>
          </div>
          <label className='flex cursor-pointer items-center gap-2 text-sm'>
            <Checkbox
              checked={formatDataDisk}
              onCheckedChange={(v) => setFormatDataDisk(v === true)}
            />
            {t('format_data_disk')}
          </label>
          <p className='text-xs text-muted-foreground'>
            当前镜像：{group?.name ?? '--'}（{versions.length} 个版本）
          </p>
          {errText && <p className='text-sm text-destructive'>{errText}</p>}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className='mr-1 h-4 w-4 animate-spin' />}
            {t('common_cloud_btn28')}
          </Button>
          <Button variant='outline' onClick={() => setOpen(false)}>
            {t('common_cloud_btn29')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// 升降级弹窗（官方 handelUpLicense：产品升降级 + 配置升降级）
// ---------------------------------------------------------------------------

function UpgradeDialog({
  open,
  setOpen,
  hostId,
  ns,
  module,
  currencyPrefix,
  showProUpdate,
  showOptionUpdate,
  onSuccess,
}: {
  open: boolean
  setOpen: (open: boolean) => void
  hostId: number
  ns: CloudApiNamespace
  module: ProductModule
  currencyPrefix: string
  showProUpdate: boolean
  showOptionUpdate: boolean
  onSuccess: () => void
}) {
  const { t } = useModuleLang(module)
  const [tab, setTab] = useState<'product' | 'config'>('product')

  // 产品升降级
  const productQuery = useQuery({
    queryKey: ['cloud-upgrade-product', ns, hostId],
    queryFn: () => fetchCloudUpgradeProduct(ns, hostId),
    enabled: open && showProUpdate && tab === 'product',
    retry: false,
  })
  const upgradeProducts = productQuery.data?.data?.host ?? []
  const [selectIndex, setSelectIndex] = useState(0)
  const [cycleIndex, setCycleIndex] = useState(0)
  const currentProduct = upgradeProducts[selectIndex] as
    | CloudUpgradeProductItem
    | undefined
  const currentCycle = currentProduct?.cycle?.[cycleIndex]

  // 配置升降级
  const configQuery = useQuery({
    queryKey: ['cloud-upgrade-config', ns, hostId],
    queryFn: () => fetchCloudUpgradeConfig(ns, hostId),
    enabled: open && showOptionUpdate && tab === 'config',
    retry: false,
  })
  const [options, setOptions] = useState<RemfConfigOptionItem[]>([])
  const [form, setForm] = useState<ConfigForm>({})
  const [curSystem, setCurSystem] = useState('')
  const initRef = useRef(false)

  const [price, setPrice] = useState(0)
  const [priceLoading, setPriceLoading] = useState(false)
  const priceSeqRef = useRef(0)

  // 弹窗打开时重置（官方 handelUpLicense：切换标签 + 重置选中项）
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTab(showProUpdate ? 'product' : 'config')
      setSelectIndex(0)
      setCycleIndex(0)
      setPrice(0)
      setPriceLoading(false)
    }
  }, [open, showProUpdate])

  // 初始化配置升降级（官方 getConfig tab=2）
  useEffect(() => {
    if (!open || tab !== 'config' || initRef.current) return
    const items = configQuery.data?.data?.host
    if (!items) return
    initRef.current = true
    const prepared = prepareUpgradeOptions(items)
    const defaults: ConfigForm = {}
    let system = ''
    for (const item of prepared) {
      if (RANGE_TYPES.includes(item.option_type)) {
        defaults[item.id] = Number(
          (item as { qty?: number }).qty ?? item.qty_minimum ?? 0
        )
      } else if (item.option_type === SYSTEM_TYPE) {
        const group = item.sub as Record<
          string,
          { child: Array<{ id: number }> }
        >
        system = Object.keys(group)[0] ?? ''
        defaults[item.id] =
          (item as { subid?: number }).subid ??
          group[system]?.child[0]?.id ??
          ''
      } else {
        defaults[item.id] = (item as { subid?: number }).subid ?? ''
      }
    }
    const applied = applyInitLimits(
      items as unknown as RemfConfigOptionItem[],
      prepared,
      defaults,
      configQuery.data?.data?.links ?? []
    )
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOptions(applied.options)
    setForm(applied.form)
    setCurSystem(system)
  }, [open, tab, configQuery.data])

  useEffect(() => {
    if (!open || tab !== 'config') return
    initRef.current = false
  }, [open, tab])

  // 算价（官方 changeConfig）
  useEffect(() => {
    if (!open) return
    if (tab === 'product') {
      if (!currentProduct || !currentCycle?.billingcycle) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPrice(0)
        return
      }
      const seq = ++priceSeqRef.current
      setPriceLoading(true)
      syncCloudUpgradeProductPrice(ns, hostId, {
        product_id: Number(currentProduct.pid ?? currentProduct.id),
        cycle: currentCycle.billingcycle,
      })
        .then((res) => {
          if (seq !== priceSeqRef.current) return
          setPrice(Math.max(0, Number(res.data?.price ?? 0)))
        })
        .catch(() => {
          if (seq === priceSeqRef.current) setPrice(0)
        })
        .finally(() => {
          if (seq === priceSeqRef.current) setPriceLoading(false)
        })
    } else {
      const seq = ++priceSeqRef.current
      setPriceLoading(true)
      syncCloudUpgradeConfigPrice(ns, hostId, { configoption: { ...form } })
        .then((res) => {
          if (seq !== priceSeqRef.current) return
          setPrice(Math.max(0, Number(res.data?.price ?? 0)))
        })
        .catch(() => {
          if (seq === priceSeqRef.current) setPrice(0)
        })
        .finally(() => {
          if (seq === priceSeqRef.current) setPriceLoading(false)
        })
    }
  }, [
    open,
    tab,
    selectIndex,
    cycleIndex,
    form,
    currentProduct,
    currentCycle,
    hostId,
    ns,
  ])

  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    setSubmitting(true)
    try {
      // 官方 upgradeSub：配置由 sync_upgrade_config_price 提交缓存，订单仅传 id + 优惠码
      const res = await createCloudUpgradeOrder(
        ns,
        hostId,
        tab === 'product' ? 'upgrade_product' : 'upgrade_config',
        {}
      )
      if (res.status === 200) {
        toast.success(
          `订单已生成（订单号 ${res.data?.id ?? ''}），请前往订单页支付`
        )
        setOpen(false)
        onSuccess()
      } else {
        toast.error(res.msg)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  function onOptionChange(item: RemfConfigOptionItem, value: ConfigFormValue) {
    if (value === form[item.id]) return
    const result = handleOptionChange({
      origin: (configQuery.data?.data?.host ??
        []) as unknown as RemfConfigOptionItem[],
      options,
      form,
      limit: configQuery.data?.data?.links ?? [],
      causeId: item.id,
      value,
    })
    setOptions(result.options)
    setForm(result.form)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className='sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>{t('common_cloud_btn16')}</DialogTitle>
        </DialogHeader>

        {showProUpdate && showOptionUpdate && (
          <div className='flex gap-1 rounded-lg bg-muted p-1'>
            <button
              type='button'
              onClick={() => setTab('product')}
              className={cn(
                'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                tab === 'product'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t('common_cloud_text230')}
            </button>
            <button
              type='button'
              onClick={() => setTab('config')}
              className={cn(
                'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                tab === 'config'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t('common_cloud_text231')}
            </button>
          </div>
        )}

        {tab === 'product' && (
          <div className='space-y-4'>
            {productQuery.isLoading ? (
              <div className='space-y-2'>
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className='h-10 w-full' />
                ))}
              </div>
            ) : upgradeProducts.length === 0 ? (
              <p className='py-6 text-center text-sm text-muted-foreground'>
                暂无可升级产品
              </p>
            ) : (
              <>
                <div className='flex flex-wrap gap-2'>
                  {upgradeProducts.map((item, index) => (
                    <button
                      key={item.id}
                      type='button'
                      onClick={() => {
                        setSelectIndex(index)
                        setCycleIndex(0)
                      }}
                      className={cn(
                        'rounded-md border px-3 py-1.5 text-sm transition-colors',
                        index === selectIndex
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-foreground hover:border-primary/50'
                      )}
                    >
                      {item.host ?? `产品${item.id}`}
                    </button>
                  ))}
                </div>
                {(currentProduct?.cycle ?? []).length > 0 && (
                  <div className='flex flex-wrap gap-2'>
                    {(currentProduct?.cycle ?? []).map((item, index) => (
                      <button
                        key={item.billingcycle ?? index}
                        type='button'
                        onClick={() => setCycleIndex(index)}
                        className={cn(
                          'relative rounded-md border px-3 py-1.5 text-sm transition-colors',
                          index === cycleIndex
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-foreground hover:border-primary/50'
                        )}
                      >
                        <p>{item.billingcycle_zh ?? item.billingcycle}</p>
                        <p>
                          {currencyPrefix}
                          {formatMoney(item.price)}
                        </p>
                        {index === cycleIndex && (
                          <Check className='absolute top-1 right-1 h-3 w-3' />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'config' && (
          <div className='max-h-96 space-y-4 overflow-y-auto pr-1'>
            {configQuery.isLoading ? (
              <div className='space-y-2'>
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className='h-10 w-full' />
                ))}
              </div>
            ) : options.length === 0 ? (
              <p className='py-6 text-center text-sm text-muted-foreground'>
                暂无可升级配置
              </p>
            ) : (
              options.map((item) => (
                <UpgradeConfigRow
                  key={item.id}
                  item={item}
                  module={module}
                  value={form[item.id]}
                  systemValue={curSystem}
                  onSystemChange={(system) => {
                    setCurSystem(system)
                    const group = item.sub as Record<
                      string,
                      { child: Array<{ id: number }> }
                    >
                    const firstId = group[system]?.child[0]?.id
                    if (firstId !== undefined) onOptionChange(item, firstId)
                  }}
                  onValueChange={(value) => onOptionChange(item, value)}
                />
              ))
            )}
          </div>
        )}

        <div className='flex items-center justify-between border-t pt-3'>
          <div className='flex items-center gap-2'>
            <span className='text-sm text-muted-foreground'>
              {t('common_cloud_btn37')}：
            </span>
            <span className='text-xl font-bold text-primary'>
              {currencyPrefix}
              {priceLoading ? (
                <Loader2 className='inline h-4 w-4 animate-spin' />
              ) : (
                formatMoney(price)
              )}
            </span>
          </div>
          <div className='flex gap-2'>
            <Button onClick={submit} disabled={submitting}>
              {submitting && <Loader2 className='mr-1 h-4 w-4 animate-spin' />}
              {t('finance_btn6')}
            </Button>
            <Button variant='outline' onClick={() => setOpen(false)}>
              {t('finance_btn7')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** 配置升降级配置项（官方 getConfig 后的 configoptions，option_type 为数字） */
function prepareUpgradeOptions(
  items: CloudUpgradeConfigItem[]
): RemfConfigOptionItem[] {
  return items.map((item) => {
    const next = { ...item } as RemfConfigOptionItem
    if (RANGE_TYPES.includes(item.option_type)) {
      const ranges = (
        item.sub as Array<{ qty_minimum: number; qty_maximum: number }>
      ).map(
        (sub) =>
          [Number(sub.qty_minimum), Number(sub.qty_maximum)] as [number, number]
      )
      const qtyRange = ranges.flatMap(createRangeArray)
      next.qty_range = qtyRange
      next.qty_minimum = qtyRange[0] ?? 0
      next.qty_maximum = qtyRange[qtyRange.length - 1] ?? 0
    }
    if (item.option_type === SYSTEM_TYPE) {
      const group = item.sub as Record<string, { child: Array<{ id: number }> }>
      next.systemArr = Object.keys(group).map((value) => ({
        value,
        label: value,
      }))
    }
    return next
  })
}

function UpgradeConfigRow({
  item,
  module,
  value,
  systemValue,
  onSystemChange,
  onValueChange,
}: {
  item: RemfConfigOptionItem
  module: ProductModule
  value: ConfigFormValue
  systemValue: string
  onSystemChange: (system: string) => void
  onValueChange: (value: ConfigFormValue) => void
}) {
  const { t } = useModuleLang(module)
  const type = item.option_type
  const pleaseSelect = t('com_config.please_select')

  if (type === 1) {
    const subs = item.sub as Array<{ id: number; option_name: string }>
    return (
      <ConfigRow label={item.option_name ?? ''}>
        <Select
          value={String(value)}
          onValueChange={(v) => onValueChange(Number(v))}
        >
          <SelectTrigger className='w-full sm:w-56'>
            <SelectValue placeholder={pleaseSelect} />
          </SelectTrigger>
          <SelectContent>
            {subs.map((sub) => (
              <SelectItem key={sub.id} value={String(sub.id)}>
                {sub.option_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ConfigRow>
    )
  }

  if (type === 3) {
    const subs = item.sub as Array<{ id: number }>
    const activeValue = subs[0]?.id ?? 0
    return (
      <ConfigRow label={item.option_name ?? ''}>
        <Switch
          checked={value === activeValue}
          disabled={item.disabled}
          onCheckedChange={(checked) =>
            onValueChange(checked ? activeValue : 0)
          }
        />
      </ConfigRow>
    )
  }

  if (RANGE_TYPES.includes(type)) {
    const min = Number(item.qty_minimum ?? 0)
    const max = Number(item.qty_maximum ?? 0)
    return (
      <ConfigRow label={item.option_name ?? ''}>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-xs text-muted-foreground'>{min}</span>
          <input
            type='range'
            className='h-2 w-36 cursor-pointer appearance-none rounded-full bg-muted accent-primary'
            min={min}
            max={max}
            step={1}
            value={Number(value)}
            onChange={(e) => onValueChange(Number(e.target.value))}
          />
          <span className='text-xs text-muted-foreground'>{max}</span>
          <Input
            type='number'
            className='[field-sizing:content] h-8 w-16'
            min={min}
            max={max}
            value={Number(value)}
            onChange={(e) => {
              const num = Number(e.target.value)
              const clamped = Math.min(max, Math.max(min, num))
              onValueChange(Number.isNaN(num) ? min : clamped)
            }}
          />
          {item.unit && (
            <span className='text-xs text-muted-foreground'>{item.unit}</span>
          )}
        </div>
      </ConfigRow>
    )
  }

  if ([2, 6, 8, 10, 13].includes(type)) {
    const subs = item.sub as Array<{ id: number; option_name: string }>
    return (
      <ConfigRow label={item.option_name ?? ''}>
        <div className='flex flex-wrap gap-2'>
          {subs.map((sub) => (
            <button
              key={sub.id}
              type='button'
              onClick={() => onValueChange(sub.id)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-sm transition-colors',
                sub.id === value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-foreground hover:border-primary/50'
              )}
            >
              {sub.option_name}
            </button>
          ))}
          {item.unit && (
            <span className='self-center text-xs text-muted-foreground'>
              {item.unit}
            </span>
          )}
        </div>
      </ConfigRow>
    )
  }

  if (type === SYSTEM_TYPE) {
    const group = item.sub as Record<
      string,
      { child: Array<{ id: number; version: string }> }
    >
    const systemArr =
      item.systemArr ?? Object.keys(group).map((v) => ({ value: v, label: v }))
    const child = group[systemValue]?.child ?? []
    return (
      <ConfigRow label={item.option_name ?? ''}>
        <div className='flex flex-wrap items-center gap-2'>
          <Select value={systemValue} onValueChange={onSystemChange}>
            <SelectTrigger className='w-36'>
              <SelectValue placeholder={pleaseSelect} />
            </SelectTrigger>
            <SelectContent>
              {systemArr.map((sys) => (
                <SelectItem key={sys.value} value={sys.value}>
                  <span className='flex items-center gap-2'>
                    <SystemIcon value={sys.value} className='h-4 w-4' />
                    {sys.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(value)}
            onValueChange={(v) => onValueChange(Number(v))}
          >
            <SelectTrigger className='w-52'>
              <SelectValue placeholder={pleaseSelect} />
            </SelectTrigger>
            <SelectContent>
              {child.map((ver) => (
                <SelectItem key={ver.id} value={String(ver.id)}>
                  {ver.version}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </ConfigRow>
    )
  }

  if (type === 12) {
    const subs = item.sub as Array<{
      id: number
      option_name: string
      country_code?: string
      area: Array<{ id: number }>
    }>
    return (
      <ConfigRow label={item.option_name ?? ''}>
        <div className='flex flex-wrap gap-2'>
          {subs.map((sub) => {
            const areaId = sub.area[0]?.id
            return (
              <button
                key={sub.id}
                type='button'
                onClick={() => onValueChange(areaId)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors',
                  areaId === value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-foreground hover:border-primary/50'
                )}
              >
                {sub.country_code && (
                  <img
                    src={`/upload/common/country/${sub.country_code}.png`}
                    alt=''
                    className='h-3.5 w-5 object-cover'
                  />
                )}
                {sub.option_name}
                {areaId === value && <Check className='h-3.5 w-3.5 shrink-0' />}
              </button>
            )
          })}
        </div>
      </ConfigRow>
    )
  }

  return null
}

function ConfigRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className='flex items-start gap-3'>
      <div className='w-24 shrink-0 pt-2 text-sm font-medium text-foreground'>
        {label}
      </div>
      <div className='min-w-0 flex-1'>{children}</div>
    </div>
  )
}
