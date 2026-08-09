import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  fetchCommonArea,
  fetchCommonDetail,
  fetchCommonLogList,
  fetchCountryList,
  fetchFinanceCommonDetail,
  fetchHostDetail,
  submitCommonChart,
  submitCommonProvision,
  type CommonApiNamespace,
  type CommonConfig,
  type CommonDetailData,
  type CountryItem,
  type HostDetail,
} from '@/api'
import { getErrorMessage } from '@/lib/api'
import type { ProductModule } from '@/lib/remf-module'
import { useModuleLang } from '@/hooks/use-module-lang'
import { AutoDetailFields } from '@/features/client/dynamic-fields'
import {
  buildPanelIframeDoc,
  extractBodyHtml,
  extractPanelJumpUrl,
  hasPanelContent,
  parseCustomPanel,
  parsePanelHtml,
  shouldUseIframe,
  type CustomPanelContent,
} from '@/lib/panel-html'
import { ArrowLeft, Copy, ExternalLink, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'

/**
 * 独立资源（idcsmart_common）产品详情页原生实现（官方 common_product_detail.js 等价）。
 *
 * 与云产品详情（CloudDetailPage）不同：实例信息来自配置项
 * GET /console/v1/:ns/host/:host_id/configoption（configoptions + self_defined_field +
 * chart 定义 + client_area + client_button + os），管理操作走
 * GET /console/v1/:ns/host/:host_id/provision/:func。
 *
 * 选项卡：基础信息 / 统计图表 / 管理 / 客户自定义区域(client_area) / 日志
 */

interface CommonDetailPageProps {
  hostId: number
  commonData?: CommonConfig
  /** 独立资源模块（idcsmart_common / reidcsmart_common） */
  module: ProductModule
  /** 后端模块页 HTML（兼容入参；独立资源页按 configoption 渲染，暂未使用） */
  content?: string
}

/** host_data 已显式渲染或内部字段（AutoDetailFields 自动渲染器跳过这些） */
const COMMON_HOST_EXCLUDED = new Set([
  // 头部/付款信息卡已展示
  'dedicatedip', 'create_time', 'due_time', 'billing_cycle',
  'billing_cycle_name', 'renew_amount', 'first_payment_amount',
  // 密码不自动明文展示（配置项 password 字段另有打码+复制处理）
  'password',
])

function formatTime(ts?: number | string): string {
  if (!ts) return '--'
  const d = new Date(Number(ts) * 1000)
  if (Number.isNaN(d.getTime())) return '--'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function formatMoney(value: number | string | undefined): string {
  if (value === undefined || value === null || value === '') return '--'
  const n = Number(value)
  return Number.isNaN(n) ? String(value) : n.toFixed(2)
}

async function copyText(text: string): Promise<void> {
  await navigator.clipboard?.writeText(text)
}

/** 随机 n 个大写字母（官方 util.js randomCoding 等价） */
function randomCoding(n: number): string {
  const arr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  let s = ''
  for (let i = 0; i < n; i++) s += arr[Math.floor(Math.random() * arr.length)]
  return s
}

/**
 * 按规则生成随机码（官方 util.js genEnCode 等价）：
 * length/num/char/symbol 各是否启用，caseSense=1 时不强制大小写。
 */
function genEnCode(
  length: number,
  hasNum: number,
  hasChar: number,
  hasSymbol: number,
  caseSense: number,
  lowerCase: number
): string {
  let m = ''
  if (hasNum === 0 && hasChar === 0 && hasSymbol === 0) return m
  for (let i = length; i > 0; i--) {
    const num = Math.floor(Math.random() * 94 + 33)
    if (
      (hasNum === 0 && num >= 48 && num <= 57) ||
      (hasChar === 0 &&
        ((num >= 65 && num <= 90) || (num >= 97 && num <= 122))) ||
      (hasSymbol === 0 &&
        ((num >= 33 && num <= 47) ||
          (num >= 58 && num <= 64) ||
          (num >= 91 && num <= 96) ||
          (num >= 123 && num <= 127)))
    ) {
      i++
      continue
    }
    m += String.fromCharCode(num)
  }
  if (caseSense === 0) {
    m = lowerCase === 0 ? m.toUpperCase() : m.toLowerCase()
  }
  return m
}

/** 重置密码随机密码（官方 cloudDetail.js autoPass 等价） */
function generateRandomPassword(): string {
  return randomCoding(1) + '0' + genEnCode(9, 1, 1, 0, 1, 0)
}

export function CommonDetailPage({
  hostId,
  commonData,
  module,
}: CommonDetailPageProps) {
  const ns = module.apiNamespace as CommonApiNamespace
  const { t, lang } = useModuleLang(module)
  const currencyPrefix =
    (commonData?.currency_prefix as string | undefined) ?? '¥'

  // 产品基础数据（官方 hostDetail → GET /host/:id）
  const hostQuery = useQuery({
    queryKey: ['common-detail-host', hostId],
    queryFn: () => fetchHostDetail(hostId),
    enabled: hostId > 0,
    retry: false,
  })
  const host = hostQuery.data?.data.host as HostDetail | undefined

  // 实例配置项/图表/按钮（官方 getCommonListDetail → GET /:ns/host/:id/configoption；
  // mf_finance_common 族走 /:ns/:id 并归一化）
  const isFinanceCommon = module.module === 'mf_finance_common'
  const detailQuery = useQuery({
    queryKey: ['common-detail-config', ns, hostId, isFinanceCommon],
    queryFn: () =>
      isFinanceCommon
        ? fetchFinanceCommonDetail(ns, hostId)
        : fetchCommonDetail(ns, hostId),
    enabled: hostId > 0,
    retry: false,
  })
  const detail = detailQuery.data?.data as CommonDetailData | undefined

  // 国家列表（官方 getCountryList，area 配置项把 iso 映射为中文名）
  const countryQuery = useQuery({
    queryKey: ['common-country'],
    queryFn: () => fetchCountryList(),
    enabled: hostId > 0,
    retry: false,
    staleTime: Infinity,
  })
  const countryMap = useMemo(() => {
    const map: Record<string, CountryItem> = {}
    for (const item of countryQuery.data?.data?.list ?? []) {
      if (item.iso) map[item.iso] = item
    }
    return map
  }, [countryQuery.data])

  const configoptions = detail?.configoptions ?? []
  const selfDefinedFields = detail?.self_defined_field ?? []
  const chartDefs = detail?.chart ?? []
  const clientAreas = detail?.client_area ?? []
  // 官方 mf_finance_common cloudDetail.js：把 module_button 的 crack_pass/reinstall/
  // vnc 归入 console 按钮（弹窗交互，如重置密码需带密码），其余归 power 下拉
  // （确定后执行，如开关机）。否则 control 里的 crack_pass 会被当下拉提交且不带密码，
  // 后端报"密码不能为空"。
  const CONSOLE_FUNCS = ['crack_pass', 'reinstall', 'vnc']
  const rawControl = detail?.client_button?.control ?? []
  const rawConsole = detail?.client_button?.console ?? []
  const controlList = rawControl.filter(
    (item) => !CONSOLE_FUNCS.includes(item.func ?? '')
  )
  const consoleList = [
    ...rawConsole,
    ...rawControl.filter((item) => CONSOLE_FUNCS.includes(item.func ?? '')),
  ]
  const osGroups = Array.isArray(detail?.os) ? detail.os : []

  // 页面标题（官方 getCommonData）
  useEffect(() => {
    const base = commonData?.website_name || 'FurLL'
    document.title = host?.product_name
      ? `${host.product_name} - ${base}`
      : `${base} - ${t('common_cloud_text43', '产品详情')}`
  }, [host?.product_name, commonData, t])

  // 管理选项卡状态
  const [activeTab, setActiveTab] = useState('info')
  const [powerStatus, setPowerStatus] = useState('')
  const [powerDialog, setPowerDialog] = useState(false)
  const [powerSubmitting, setPowerSubmitting] = useState(false)
  const [repassDialog, setRepassDialog] = useState(false)
  const [repassPassword, setRepassPassword] = useState('')
  const [repassSubmitting, setRepassSubmitting] = useState(false)
  const [reinstallDialog, setReinstallDialog] = useState(false)
  const [osGroupId, setOsGroupId] = useState('')
  const [osVersionId, setOsVersionId] = useState('')
  const [reinstallSubmitting, setReinstallSubmitting] = useState(false)
  const [vncLoading, setVncLoading] = useState(false)
  const [areaContents, setAreaContents] = useState<Record<string, string>>({})
  const [areaLoadingKey, setAreaLoadingKey] = useState('')

  const osGroup = osGroups.find((item) => String(item.id) === osGroupId)
  const osVersions = osGroup?.subs?.flatMap((sub) =>
    (sub.version ?? []).map((v) => ({
      ...v,
      option_param: sub.os,
      option_name: v.option_name,
    }))
  ) ?? []
  const osVersion = osVersions.find((item) => String(item.id) === osVersionId)

  // 电源操作（官方 powerList = client_button.control，默认第一个；
  // 在渲染期派生，避免 effect 内 setState）
  const effectivePowerStatus =
    controlList.length > 0 &&
    !controlList.some((c) => c.func === powerStatus)
      ? (controlList[0].func ?? '')
      : powerStatus

  // 管理操作（官方 provision → POST /:ns/host/:id/provision/:func；
  // mf_finance_common 族 → POST /:ns/:id/:func）
  async function runProvision(
    func: string,
    extra?: Record<string, unknown>
  ) {
    const res = await submitCommonProvision(
      ns,
      hostId,
      func,
      {
        client_operate_password: '',
        client_operate_methods: 'toChangePower',
        remember_operate_password: 0,
        ...extra,
      },
      isFinanceCommon
    )
    if (res.status === 200) {
      toast.success(res.msg || t('appstore_text359'))
      detailQuery.refetch()
      return true
    }
    toast.error(res.msg || getErrorMessage(res))
    return false
  }

  async function submitPower() {
    if (!effectivePowerStatus) return
    setPowerDialog(false)
    setPowerSubmitting(true)
    try {
      await runProvision(effectivePowerStatus)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setPowerSubmitting(false)
    }
  }

  /** 控制台按钮（官方 handelConsole：crack_pass/reinstall/vnc） */
  function handleConsole(func?: string) {
    if (func === 'crack_pass') {
      setRepassPassword('')
      setRepassDialog(true)
    } else if (func === 'reinstall') {
      const firstGroup = osGroups[0]
      setOsGroupId(String(firstGroup?.id ?? ''))
      const firstVersion =
        firstGroup?.subs?.[0]?.version?.[0]
      setOsVersionId(String(firstVersion?.id ?? ''))
      setReinstallDialog(true)
    } else if (func === 'vnc') {
      openVnc()
    } else if (func) {
      // 其他自定义 func 直接提交（官方 consoleList 仅上述三类，兜底调用）
      runProvision(func).catch(() => {})
    }
  }

  /** 控制台（官方 doGetVncUrl：func=vnc 返回 url） */
  async function openVnc() {
    setVncLoading(true)
    try {
      const res = await submitCommonProvision(
        ns,
        hostId,
        'vnc',
        {
          client_operate_password: '',
          client_operate_methods: 'doGetVncUrl',
          remember_operate_password: 0,
        },
        isFinanceCommon
      )
      const url = (res as { data?: { url?: string } }).data?.url
      if (res.status === 200 && url) {
        window.open(url, '_blank')
      } else {
        toast.error(res.msg || '获取控制台失败')
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setVncLoading(false)
    }
  }

  /** 重置密码（官方 crack_pass：func=crack_pass + password） */
  async function submitRepass() {
    if (!repassPassword) {
      toast.error(t('common_cloud_text61', '请输入新密码'))
      return
    }
    setRepassSubmitting(true)
    try {
      const ok = await runProvision('crack_pass', {
        password: repassPassword,
        client_operate_methods: 'rePassSub',
      })
      if (ok) setRepassDialog(false)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setRepassSubmitting(false)
    }
  }

  /** 重装系统（官方 doReinstall：func=reinstall + option_id/sub_id/os/os_name） */
  async function submitReinstall() {
    if (!osVersion) {
      toast.error(t('common_cloud_text45', '请选择系统'))
      return
    }
    setReinstallSubmitting(true)
    try {
      const ok = await runProvision('reinstall', {
        option_id: Number(osGroupId),
        sub_id: Number(osVersionId),
        os: osVersion.option_param ?? osVersion.option_name,
        os_name: osVersion.option_name,
        client_operate_methods: 'doReinstall',
      })
      if (ok) setReinstallDialog(false)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setReinstallSubmitting(false)
    }
  }

  // 客户自定义区域（官方 client_area tab：GET /:ns/host/:id/configoption/area?key=；
  // mf_finance_common 族 GET /:ns/:id/custom/content?id=&key=，返回完整 HTML 文档）
  function openArea(key: string) {
    if (areaContents[key] !== undefined) return
    setAreaLoadingKey(key)
    fetchCommonArea(ns, hostId, key, isFinanceCommon)
      .then((res) => {
        const html = res.data?.content
        if (res.status === 200 && html) {
          // 存完整 HTML（含 <head> 样式与 </html> 后尾随资产），由 PanelContentView 按需解析
          setAreaContents((prev) => ({
            ...prev,
            [key]: html,
          }))
        } else {
          setAreaContents((prev) => ({ ...prev, [key]: '' }))
        }
      })
      .catch(() => setAreaContents((prev) => ({ ...prev, [key]: '' })))
      .finally(() => setAreaLoadingKey(''))
  }

  const loading = hostQuery.isLoading || detailQuery.isLoading
  const hostData = detail?.host ?? {}

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
      ) : hostQuery.error || detailQuery.error ? (
        <Card className='flex flex-col items-center gap-3 py-16 text-center'>
          <p className='text-muted-foreground'>
            产品详情加载失败：
            {getErrorMessage(hostQuery.error ?? detailQuery.error)}
          </p>
          <Button
            variant='outline'
            onClick={() => {
              hostQuery.refetch()
              detailQuery.refetch()
            }}
          >
            重试
          </Button>
        </Card>
      ) : (
        <>
          {/* 头部：返回箭头 + 产品名/状态 + 实例名/IP（对齐官方排版） */}
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
              {String(host?.status_name ?? '') && (
                <span className='mb-0.5 rounded-[3px] bg-muted px-2 py-0.5 text-[13px] font-medium text-muted-foreground'>
                  {String(host?.status_name)}
                </span>
              )}
            </div>
            <div className='mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 pl-7 text-[16px] text-[#8692B0] dark:text-muted-foreground'>
              {host?.name && <span>{host.name}</span>}
              {hostData.dedicatedip && (
                <span className='flex items-center gap-1.5'>
                  {hostData.dedicatedip}
                  <button
                    type='button'
                    aria-label='复制IP'
                    className='cursor-pointer text-primary hover:opacity-80'
                    onClick={() =>
                      copyText(String(hostData.dedicatedip)).then(() =>
                        toast.success(t('index_text32'))
                      )
                    }
                  >
                    <Copy className='h-4 w-4' />
                  </button>
                </span>
              )}
            </div>
          </div>

          {/* 实例信息 / 付款信息（官方 msg-l / msg-r 双卡） */}
          <div className='grid gap-4 lg:grid-cols-2'>
            <div className='rounded-[3px] border border-[#E6E7EB] px-4 pt-3 pb-4 dark:border-border'>
              <h3 className='text-lg text-[#1E2736] dark:text-foreground'>
                {t('appstore_text301', '实例信息')}
              </h3>
              <div className='mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm'>
                {configoptions.map((item) => (
                  <div key={item.id} className='flex min-w-0 gap-2'>
                    <span
                      className='w-20 shrink-0 truncate text-left text-[#1E2736] dark:text-foreground'
                      title={item.option_name}
                    >
                      {item.option_name}：
                    </span>
                    <span className='min-w-0 flex-1 break-all text-[#1E2736] dark:text-foreground'>
                      {item.option_type === 'cascade'
                        ? (item.cascade_path ?? '--')
                        : item.option_type === 'quantity' ||
                            item.option_type === 'quantity_range'
                          ? `${item.qty ?? '--'}${item.unit ?? ''}`
                          : (item.subs ?? [])
                              .map((el) =>
                                item.option_type === 'area'
                                  ? `${countryMap[el.country ?? '']?.name_zh ?? el.country ?? ''} - ${el.option_name}`
                                  : el.option_name
                              )
                              .join('、') || '--'}
                    </span>
                  </div>
                ))}
                {selfDefinedFields.map((field) => (
                  <div key={field.id} className='flex min-w-0 gap-2'>
                    <span
                      className='w-20 shrink-0 truncate text-left text-[#1E2736] dark:text-foreground'
                      title={field.field_name}
                    >
                      {field.field_name}：
                    </span>
                    <span className='flex min-w-0 items-center gap-1.5'>
                      <span className='min-w-0 flex-1 break-all text-[#1E2736] dark:text-foreground'>
                        {field.field_type === 'password'
                          ? '********'
                          : String(field.value || '--')}
                      </span>
                      {field.field_type === 'password' && field.value && (
                        <PasswordCopy value={field.value} />
                      )}
                    </span>
                  </div>
                ))}
                {/* mf_finance_common：host_data 是完整 WHMCS host 数组，只展示
                    官方面板信息行（用户名/端口/密码），不自动 dump 全量字段 */}
                {isFinanceCommon &&
                  (() => {
                    const hd = hostData as Record<string, unknown>
                    const rows: Array<{ label: string; value?: unknown }> = [
                      { label: t('common_cloud_label14'), value: hd.username },
                      { label: t('common_cloud_label13'), value: hd.port },
                      { label: t('login_pass'), value: hd.password },
                    ].filter((r) => r.value !== undefined && r.value !== '')
                    return (
                      <>
                        {rows.map((row, i) => (
                          <div
                            key={i}
                            className='flex min-w-0 items-center gap-2'
                          >
                            <span className='w-20 shrink-0 truncate text-left text-[#1E2736] dark:text-foreground'>
                              {row.label}：
                            </span>
                            {row.label === t('login_pass') ? (
                              <PasswordCopy value={String(row.value)} />
                            ) : (
                              <span className='min-w-0 flex-1 break-all text-[#1E2736] dark:text-foreground'>
                                {String(row.value)}
                              </span>
                            )}
                          </div>
                        ))}
                      </>
                    )
                  })()}
                {/* 未显式适配的 host 字段自动展示（避免后续手动适配）；mf_finance_common
                    的 host_data 为 WHMCS host 数组（内部字段非业务信息），跳过 */}
                {!isFinanceCommon && (
                  <AutoDetailFields
                    data={hostData}
                    exclude={COMMON_HOST_EXCLUDED}
                    lang={lang}
                    labelOf={(key) => {
                      switch (key) {
                        case 'username':
                          return t('common_cloud_label14')
                        case 'os':
                        return t('cloud_os')
                      case 'assignedips':
                        return t('common_cloud_label21')
                      case 'bwlimit':
                        return t('common_cloud_label24')
                      case 'bwusage':
                        return t('common_cloud_label25')
                    default:
                      return undefined
                    }
                  }}
                  />
                )}
                {configoptions.length === 0 &&
                  selfDefinedFields.length === 0 && (
                    <span className='text-muted-foreground'>--</span>
                  )}
              </div>
            </div>

            <div className='rounded-[3px] border border-[#E6E7EB] px-4 pt-3 pb-4 dark:border-border'>
              <h3 className='text-lg text-[#1E2736] dark:text-foreground'>
                {t('cloud_pay_title', '付款信息')}
              </h3>
              <div className='mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm'>
                <div className='flex items-center gap-2'>
                  <span className='shrink-0 text-[#1E2736] dark:text-foreground'>
                    {t('cloud_due_time', '到期时间')}：
                  </span>
                  <span>{formatTime(host?.due_time)}</span>
                </div>
                <div className='flex items-center gap-2'>
                  <span className='shrink-0 text-[#1E2736] dark:text-foreground'>
                    {t('cloud_creat_time', '订购时间')}：
                  </span>
                  <span>{formatTime(host?.active_time)}</span>
                </div>
                <div className='flex items-center gap-2'>
                  <span className='shrink-0 text-[#1E2736] dark:text-foreground'>
                    {t('cloud_pay_style', '付款方式')}：
                  </span>
                  <span>
                    {(host?.billing_cycle_name as string) ||
                      (host?.billing_cycle as string) ||
                      '--'}
                  </span>
                </div>
                <div className='flex items-center gap-2'>
                  <span className='shrink-0 text-[#1E2736] dark:text-foreground'>
                    {t('cloud_first_pay', '首付金额')}：
                  </span>
                  <span>
                    {currencyPrefix}
                    {formatMoney(host?.first_payment_amount)}
                  </span>
                </div>
                <div className='flex items-center gap-2'>
                  <span className='shrink-0 text-[#1E2736] dark:text-foreground'>
                    {t('cloud_re_text', '续费金额')}：
                  </span>
                  <span>
                    {currencyPrefix}
                    {formatMoney(host?.renew_amount)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 选项卡（官方 .tabs） */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className='mt-14 gap-3'
          >
            <TabsList className='h-auto flex-wrap'>
              <TabsTrigger value='info'>
                {t('common_cloud_text227', '基础信息')}
              </TabsTrigger>
              <TabsTrigger value='chart'>
                {t('common_cloud_tab1', '统计图表')}
              </TabsTrigger>
              <TabsTrigger value='manage'>
                {t('common_cloud_tab2', '管理')}
              </TabsTrigger>
              {clientAreas.map((area) => (
                <TabsTrigger
                  key={area.key}
                  value={`area-${area.key}`}
                  onClick={() => openArea(area.key ?? '')}
                >
                  {area.name}
                </TabsTrigger>
              ))}
              <TabsTrigger value='log'>{t('common_cloud_tab6', '日志')}</TabsTrigger>
            </TabsList>

            <TabsContent value='info'>
              <InfoTab
                configoptions={configoptions}
                selfDefinedFields={selfDefinedFields}
                countryMap={countryMap}
              />
            </TabsContent>
            <TabsContent value='chart'>
              <ChartTab
                ns={ns}
                hostId={hostId}
                chartDefs={chartDefs}
                isFinanceCommon={isFinanceCommon}
              />
            </TabsContent>
            <TabsContent value='manage'>
              <Card className='p-4 sm:p-5'>
                <div className='space-y-4'>
                  {controlList.length > 0 && (
                    <div className='flex items-center gap-3'>
                      <Select
                        value={effectivePowerStatus}
                        onValueChange={setPowerStatus}
                      >
                        <SelectTrigger className='w-48'>
                          <SelectValue placeholder='选择操作' />
                        </SelectTrigger>
                        <SelectContent>
                          {controlList.map((item) => (
                            <SelectItem
                              key={item.func}
                              value={item.func ?? ''}
                            >
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        disabled={!effectivePowerStatus}
                        onClick={() => setPowerDialog(true)}
                      >
                        {t('common_cloud_btn10', '确定')}
                      </Button>
                    </div>
                  )}
                  {consoleList.length > 0 && (
                    <div className='flex flex-wrap gap-3'>
                      {consoleList.map((item) => (
                        <Button
                          key={item.func}
                          variant='outline'
                          disabled={vncLoading && item.func === 'vnc'}
                          onClick={() => handleConsole(item.func)}
                        >
                          {vncLoading && item.func === 'vnc' && (
                            <Loader2 className='mr-1 h-4 w-4 animate-spin' />
                          )}
                          {item.name}
                        </Button>
                      ))}
                    </div>
                  )}
                  {controlList.length === 0 && consoleList.length === 0 && (
                    <p className='py-8 text-center text-sm text-muted-foreground'>
                      暂无可用操作
                    </p>
                  )}
                </div>
              </Card>
            </TabsContent>
            {clientAreas.map((area) => (
              <TabsContent key={area.key} value={`area-${area.key}`}>
                {areaLoadingKey === area.key ? (
                  <div className='flex items-center justify-center gap-2 py-10 text-muted-foreground'>
                    <Loader2 className='h-4 w-4 animate-spin' />
                    加载中...
                  </div>
                ) : areaContents[area.key ?? ''] ? (
                  <PanelContentView html={areaContents[area.key ?? ''] ?? ''} />
                ) : (
                  <p className='py-8 text-center text-sm text-muted-foreground'>
                    面板内容暂不可用
                  </p>
                )}
              </TabsContent>
            ))}
            <TabsContent value='log'>
              <LogTab ns={ns} hostId={hostId} module={module} />
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* 电源操作确认弹窗 */}
      <Dialog open={powerDialog} onOpenChange={setPowerDialog}>
        <DialogContent className='sm:max-w-sm'>
          <DialogHeader>
            <DialogTitle>
              {t('common_cloud_text9', '确定执行')}{' '}
              {controlList.find((c) => c.func === effectivePowerStatus)?.name ?? ''}？
            </DialogTitle>
            <DialogDescription>
              {t('common_cloud_text9', '确定执行')}对实例「{host?.name}」执行
              {controlList.find((c) => c.func === effectivePowerStatus)?.name ?? ''}
              操作？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button disabled={powerSubmitting} onClick={submitPower}>
              {powerSubmitting && (
                <Loader2 className='mr-1 h-4 w-4 animate-spin' />
              )}
              {t('common_cloud_btn10', '确定')}
            </Button>
            <Button variant='outline' onClick={() => setPowerDialog(false)}>
              {t('common_cloud_btn29', '取消')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重置密码弹窗 */}
      <Dialog open={repassDialog} onOpenChange={setRepassDialog}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>
              {t('common_cloud_title13', '重置密码')}
              <span className='ml-2 text-xs font-normal text-muted-foreground'>
                {t('common_cloud_text23', '如您忘记密码，可直接输入新密码进行破解')}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className='space-y-3'>
            <Label>{t('common_cloud_label7', '密码')}</Label>
            <div className='flex gap-2'>
              <Input
                value={repassPassword}
                onChange={(e) => setRepassPassword(e.target.value)}
                placeholder={t('ticket_label12', '请输入内容')}
              />
              <Button
                type='button'
                variant='outline'
                onClick={() => setRepassPassword(generateRandomPassword())}
              >
                {t('common_cloud_btn1', '随机生成')}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button disabled={repassSubmitting} onClick={submitRepass}>
              {repassSubmitting && (
                <Loader2 className='mr-1 h-4 w-4 animate-spin' />
              )}
              {t('common_cloud_btn28', '提交')}
            </Button>
            <Button variant='outline' onClick={() => setRepassDialog(false)}>
              {t('common_cloud_btn29', '取消')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重装系统弹窗 */}
      <Dialog open={reinstallDialog} onOpenChange={setReinstallDialog}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>{t('common_cloud_title2', '重装系统')}</DialogTitle>
          </DialogHeader>
          <div className='space-y-3'>
            <div>
              <Label>{t('common_cloud_label11', '系统')}</Label>
              <Select value={osGroupId} onValueChange={setOsGroupId}>
                <SelectTrigger className='mt-1 w-full'>
                  <SelectValue placeholder='选择系统' />
                </SelectTrigger>
                <SelectContent>
                  {osGroups.map((group) => (
                    <SelectItem key={group.id} value={String(group.id)}>
                      {group.option_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {osVersions.length > 0 && (
              <div>
                <Label>{t('common_cloud_label12', '版本')}</Label>
                <Select value={osVersionId} onValueChange={setOsVersionId}>
                  <SelectTrigger className='mt-1 w-full'>
                    <SelectValue placeholder='选择版本' />
                  </SelectTrigger>
                  <SelectContent>
                    {osVersions.map((v) => (
                      <SelectItem key={v.id} value={String(v.id)}>
                        {v.option_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button disabled={reinstallSubmitting} onClick={submitReinstall}>
              {reinstallSubmitting && (
                <Loader2 className='mr-1 h-4 w-4 animate-spin' />
              )}
              {t('common_cloud_btn28', '提交')}
            </Button>
            <Button variant='outline' onClick={() => setReinstallDialog(false)}>
              {t('common_cloud_btn29', '取消')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 基础信息（官方 tab name="0"：配置项 + 自定义字段）
// ---------------------------------------------------------------------------

function PasswordCopy({ value }: { value: string }) {
  const [show, setShow] = useState(false)
  return (
    <span className='flex shrink-0 items-center gap-1'>
      <button
        type='button'
        aria-label={show ? '隐藏密码' : '显示密码'}
        className='text-muted-foreground hover:text-primary'
        onClick={() => setShow((prev) => !prev)}
      >
        {show ? <EyeOff className='h-3.5 w-3.5' /> : <Eye className='h-3.5 w-3.5' />}
      </button>
      <button
        type='button'
        aria-label='复制密码'
        className='text-muted-foreground hover:text-primary'
        onClick={() =>
          copyText(value).then(() => toast.success('已复制'))
        }
      >
        <Copy className='h-3.5 w-3.5' />
      </button>
    </span>
  )
}

function InfoTab({
  configoptions,
  selfDefinedFields,
  countryMap,
}: {
  configoptions: NonNullable<CommonDetailData['configoptions']>
  selfDefinedFields: NonNullable<CommonDetailData['self_defined_field']>
  countryMap: Record<string, CountryItem>
}) {
  return (
    <Card className='p-4 sm:p-5'>
      <div className='grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2'>
        {configoptions.map((item) => (
          <div key={item.id} className='flex min-w-0 items-start gap-2'>
            <span className='w-24 shrink-0 truncate text-sm text-muted-foreground'>
              {item.option_name}：
            </span>
            <span className='min-w-0 flex-1 break-all text-sm text-foreground'>
              {item.option_type === 'cascade'
                ? (item.cascade_path ?? '--')
                : item.option_type === 'quantity' ||
                    item.option_type === 'quantity_range'
                  ? `${item.qty ?? '--'}${item.unit ?? ''}`
                  : (item.subs ?? [])
                      .map((el) =>
                        item.option_type === 'area'
                          ? `${countryMap[el.country ?? '']?.name_zh ?? el.country ?? ''} - ${el.option_name}`
                          : el.option_name
                      )
                      .join('、') || '--'}
            </span>
          </div>
        ))}
        {selfDefinedFields.map((field) => (
          <div key={field.id} className='flex min-w-0 items-start gap-2'>
            <span className='w-24 shrink-0 truncate text-sm text-muted-foreground'>
              {field.field_name}：
            </span>
            <span className='flex min-w-0 flex-1 items-center gap-1.5'>
              <span className='break-all text-sm text-foreground'>
                {field.field_type === 'password'
                  ? '********'
                  : String(field.value || '--')}
              </span>
              {field.field_type === 'password' && field.value && (
                <PasswordCopy value={field.value} />
              )}
            </span>
          </div>
        ))}
        {configoptions.length === 0 && selfDefinedFields.length === 0 && (
          <p className='py-8 text-center text-sm text-muted-foreground'>
            暂无配置信息
          </p>
        )}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// 面板内容（官方 custom/content 返回的完整 HTML，解析为结构化卡片渲染）
// ---------------------------------------------------------------------------

function PanelContentView({ html }: { html: string }) {
  const custom = useMemo(() => parseCustomPanel(html), [html])
  const content = useMemo(() => parsePanelHtml(html), [html])

  // 自定义面板（tianqi-cdnfly 等，识别 class 签名）
  // 命中但解析为空（标题/卡片/按钮/提示全无 → 结构变了）→ 不显示空面板，走默认 iframe
  if (custom && (hasPanelContent(custom) || custom.title)) {
    // 含依赖脚本的按钮（href 为空，靠面板 <script> 生成 token 跳转）
    const needsScript = custom.actions.some((a) => !a.href)
    if (!needsScript) return <CustomPanelView content={custom} />
    // 沙箱执行面板脚本抓取跳转 URL → 结构化显示 + 按钮可点
    const jumpUrl = extractPanelJumpUrl(html)
    if (jumpUrl) {
      return <CustomPanelView content={custom} jumpUrl={jumpUrl} />
    }
    // 抓不到跳转 URL → 退回 iframe 保留脚本交互
    return <PanelIframe html={html} />
  }


  // 富交互面板（带 script/button 或解析不出卡片）→ srcDoc iframe 保留脚本与按钮
  if (shouldUseIframe(html, content)) {
    return <PanelIframe html={html} />
  }

  // 解析不到结构化内容时，回退到原生注入（仅注入 body 内容，避免整份文档污染页面）
  if (!hasPanelContent(content)) {
    return (
      <div
        className='client-area-content'
        dangerouslySetInnerHTML={{ __html: extractBodyHtml(html) }}
      />
    )
  }

  return (
    <div className='space-y-4'>
      {content.cards.length > 0 && (
        <div className='grid gap-3 sm:grid-cols-2'>
          {content.cards.map((card, i) => (
            <div key={i} className='rounded-lg border bg-card p-4'>
              <p className='text-xs font-medium text-muted-foreground'>
                {card.label || '信息'}
              </p>
              <p className='mt-1 break-all font-medium text-foreground'>
                {card.value || '--'}
              </p>
            </div>
          ))}
        </div>
      )}
      {content.actions.length > 0 && (
        <div className='flex flex-wrap gap-3'>
          {content.actions.map((action, i) => (
            <a
              key={i}
              href={action.href}
              target='_blank'
              rel='noreferrer'
              className='inline-flex'
            >
              <Button>
                {action.text || '打开面板'}
                <ExternalLink className='ml-1 h-4 w-4' />
              </Button>
            </a>
          ))}
        </div>
      )}
      {content.notes.length > 0 && (
        <div className='space-y-1'>
          {content.notes.map((note, i) => (
            <p key={i} className='text-sm text-muted-foreground'>
              {note.text}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 自定义面板（tianqi-cdnfly 等，结构化 shadcn 卡片渲染）
// ---------------------------------------------------------------------------

function CustomPanelView({
  content,
  jumpUrl,
}: {
  content: CustomPanelContent
  jumpUrl?: string
}) {
  return (
    <div className='space-y-4'>
      {content.title && (
        <h4 className='text-lg font-semibold'>{content.title}</h4>
      )}
      {content.cards.length > 0 && (
        <div className='grid gap-3 sm:grid-cols-2'>
          {content.cards.map((card, i) => (
            <div key={i} className='rounded-lg border bg-card p-4'>
              <p className='text-xs font-medium text-muted-foreground'>
                {card.label || '信息'}
              </p>
              <p className='mt-1 break-all font-medium text-foreground'>
                {card.value || '--'}
              </p>
            </div>
          ))}
        </div>
      )}
      {content.actions.length > 0 && (
        <div className='flex flex-wrap gap-3'>
          {content.actions.map((action, i) =>
            action.href ? (
              <a
                key={i}
                href={action.href}
                target='_blank'
                rel='noreferrer'
                className='inline-flex'
              >
                <Button>
                  {action.text}
                  <ExternalLink className='ml-1 h-4 w-4' />
                </Button>
              </a>
            ) : (
              <Button
                key={i}
                variant='outline'
                disabled={!jumpUrl}
                onClick={() => jumpUrl && window.open(jumpUrl, '_blank')}
              >
                {action.text}
              </Button>
            )
          )}
        </div>
      )}
      {content.notes.length > 0 && (
        <div className='space-y-1'>
          {content.notes.map((note, i) => (
            <p key={i} className='text-sm text-muted-foreground'>
              {note.text}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 富交互面板（srcDoc iframe，保留脚本/按钮，自动高度）
// ---------------------------------------------------------------------------

function PanelIframe({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(240)

  const syncHeight = useCallback(() => {
    const doc = ref.current?.contentDocument
    if (!doc?.body) return
    const h = Math.max(
      doc.body.scrollHeight,
      doc.documentElement.scrollHeight
    )
    setHeight(Math.max(120, h + 8))
  }, [])

  useEffect(() => {
    // 加载后（脚本可能异步渲染/撑开内容）轮询一次校准高度
    let timer = 0
    const tick = () => {
      syncHeight()
      timer = window.setTimeout(tick, 300)
    }
    tick()
    window.addEventListener('resize', syncHeight)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', syncHeight)
    }
  }, [syncHeight])

  return (
    <iframe
      ref={ref}
      title='面板内容'
      srcDoc={buildPanelIframeDoc(html)}
      onLoad={syncHeight}
      style={{ height }}
      className='w-full overflow-hidden border-0'
      sandbox='allow-scripts allow-same-origin allow-popups'
    />
  )
}

// ---------------------------------------------------------------------------
// 统计图表（官方 tab name="1"：chart 列表，POST /configoption/chart）
// ---------------------------------------------------------------------------

function ChartTab({
  ns,
  hostId,
  chartDefs,
  isFinanceCommon = false,
}: {
  ns: CommonApiNamespace
  hostId: number
  chartDefs: NonNullable<CommonDetailData['chart']>
  isFinanceCommon?: boolean
}) {
  const { t } = useModuleLang()
  const [range, setRange] = useState('1')
  const [selects, setSelects] = useState<Record<number, string>>({})

  // selects 整对象已在 key 中，索引读取只用于拼请求参数
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  const chartQuery = useQuery({
    queryKey: ['common-chart', ns, hostId, range, chartDefs, selects, isFinanceCommon],
    queryFn: async () => {
      const seconds =
        range === '1' ? 24 * 3600 : range === '2' ? 3 * 86400 : 7 * 86400
      const res = await submitCommonChart(
        ns,
        hostId,
        {
          chart: chartDefs.map((def, index) => ({
            start: Date.now() / 1000 - seconds,
            type: def.type ?? '',
            select: selects[index] ?? '',
          })),
        },
        isFinanceCommon
      )
      return res.data as {
        list?: Array<Array<{ time?: string; value?: number }>>
        label?: string[]
      } | null
    },
    enabled: hostId > 0 && chartDefs.length > 0,
    retry: false,
  })

  if (chartDefs.length === 0) {
    return (
      <Card className='p-4 sm:p-5'>
        <p className='py-8 text-center text-sm text-muted-foreground'>
          暂无图表数据
        </p>
      </Card>
    )
  }

  const series = chartQuery.data?.list ?? []
  const labels = chartQuery.data?.label ?? []

  return (
    <Card className='space-y-4 p-4 sm:p-5'>
      <div className='flex items-center justify-between'>
        <h3 className='font-bold text-foreground'>
          {t('common_cloud_tab1', '统计图表')}
        </h3>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className='w-28'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='1'>{t('common_cloud_label15', '过去24H')}</SelectItem>
            <SelectItem value='2'>{t('common_cloud_label16', '过去3天')}</SelectItem>
            <SelectItem value='3'>{t('common_cloud_label17', '过去7天')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {chartQuery.isLoading ? (
        <div className='space-y-2'>
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className='h-40 w-full' />
          ))}
        </div>
      ) : chartQuery.error ? (
        <p className='py-6 text-center text-sm text-muted-foreground'>
          图表加载失败：{getErrorMessage(chartQuery.error)}
        </p>
      ) : (
        chartDefs.map((def, index) => (
          <div key={index} className='space-y-2'>
            {def.select && def.select.length > 0 && (
              <Select
                value={selects[index] ?? ''}
                onValueChange={(v) =>
                  setSelects((prev) => ({ ...prev, [index]: v }))
                }
              >
                <SelectTrigger className='w-48'>
                  <SelectValue placeholder='选择' />
                </SelectTrigger>
                <SelectContent>
                  {def.select.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value ?? ''}>
                      {opt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <ChartItem
              title={def.title ?? ''}
              series={series[index]}
              labels={labels}
            />
          </div>
        ))
      )}
    </Card>
  )
}

function ChartItem({
  title,
  series,
  labels,
}: {
  title: string
  series?: Array<{ time?: string; value?: number }>
  labels: string[]
}) {
  const data = series ?? []
  const max = Math.max(1, ...data.map((p) => Number(p.value) || 0))
  return (
    <div className='rounded-[3px] border border-[#E6E7EB] p-3 dark:border-border'>
      <p className='mb-2 text-sm font-medium text-foreground'>{title}</p>
      {data.length === 0 ? (
        <p className='py-8 text-center text-sm text-muted-foreground'>
          暂无数据
        </p>
      ) : (
        <div className='flex h-32 items-end gap-[2px]'>
          {data.map((point, i) => (
            <div
              key={i}
              className='min-w-[2px] flex-1 rounded-t bg-primary/70'
              style={{ height: `${Math.max(4, (Number(point.value) || 0) / max * 100)}%` }}
              title={`${point.time ?? ''} ${point.value ?? ''}`}
            />
          ))}
        </div>
      )}
      <p className='mt-1 text-xs text-muted-foreground'>
        {labels.join(' / ')}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 日志（官方 tab name="log"）
// ---------------------------------------------------------------------------

function LogTab({
  ns,
  hostId,
  module,
}: {
  ns: CommonApiNamespace
  hostId: number
  module: ProductModule
}) {
  const { t } = useModuleLang(module)
  const [page, setPage] = useState(1)
  const limit = 20
  const logQuery = useQuery({
    queryKey: ['common-log', ns, hostId, page, limit],
    queryFn: () =>
      fetchCommonLogList(ns, hostId, {
        page,
        limit,
        orderby: 'id',
        sort: 'desc',
      }),
    enabled: hostId > 0,
    retry: false,
  })
  const logs = logQuery.data?.data?.list ?? []
  const total = Number(logQuery.data?.data?.count ?? 0)
  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <Card className='p-4 sm:p-5'>
      <h3 className='mb-3 font-bold text-foreground'>
        {t('common_cloud_tab6', '日志')}
      </h3>
      <div className='overflow-x-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-20'>
                {t('common_cloud_label32', 'ID')}
              </TableHead>
              <TableHead className='w-44'>
                {t('common_cloud_label33', '时间')}
              </TableHead>
              <TableHead>{t('common_cloud_label34', '描述')}</TableHead>
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
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{log.id}</TableCell>
                  <TableCell className='whitespace-nowrap'>
                    {formatTime(log.create_time)}
                  </TableCell>
                  <TableCell className='break-all'>
                    {log.description ?? '--'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {totalPages > 1 && (
        <div className='mt-3 flex items-center justify-end gap-2'>
          <Button
            size='sm'
            variant='outline'
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            上一页
          </Button>
          <span className='text-sm text-muted-foreground'>
            {page}/{totalPages}
          </span>
          <Button
            size='sm'
            variant='outline'
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            下一页
          </Button>
        </div>
      )}
    </Card>
  )
}

// 供 product-detail 类型引用
export type { CommonDetailPageProps }
