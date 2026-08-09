import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2, MoreHorizontal, Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  batchCreateSecurityGroupRules,
  createSecurityGroupRule,
  deleteSecurityGroupRule,
  fetchCommon,
  fetchHostList,
  fetchSecurityGroupHosts,
  fetchSecurityGroupRules,
  linkSecurityGroupHosts,
  unlinkSecurityGroupHost,
  updateSecurityGroupRule,
  type SecurityGroupRuleItem,
} from '@/api'
import { useClientLang, type ClientTranslator } from '@/hooks/use-client-lang'
import { getErrorMessage } from '@/lib/api'
import { PaginationBar } from '@/features/client/finance/pagination-bar'
import { formatTimeFull } from '@/features/client/finance/shared'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDeleteDialog } from './dialogs'

type TabKey = 'in' | 'out' | 'relation'

/** 协议选项（官方 group_rules.js protocol 数组，label=value 直接展示） */
const PROTOCOLS = [
  'all',
  'all_tcp',
  'all_udp',
  'tcp',
  'udp',
  'icmp',
  'ssh',
  'telnet',
  'http',
  'https',
  'mssql',
  'oracle',
  'mysql',
  'rdp',
  'postgresql',
  'redis',
]

/** 协议默认端口（官方 watch singleForm.protocol） */
const PROTOCOL_DEFAULT_PORT: Record<string, string> = {
  ssh: '22',
  telnet: '23',
  http: '80',
  https: '443',
  mssql: '1433',
  oracle: '1521',
  mysql: '3306',
  rdp: '3389',
  postgresql: '5432',
  redis: '6379',
  tcp: '',
  udp: '',
}

function validPort(v: string): boolean {
  return /^[0-9-]*$/.test(v)
}

/** 官方 validatIp：IPv4 或 IPv4/掩码（0-65535） */
function validIp(v: string): boolean {
  const parts = v.split('/')
  const base = /^((25[0-5]|2[0-4]\d|[01]?\d\d?)($|(?!\.$)\.)){4}$/
  if (parts.length === 1 && base.test(parts[0])) return true
  if (parts.length === 2 && base.test(parts[0])) {
    const mask = parseInt(parts[1], 10)
    if (!Number.isNaN(mask) && mask >= 0 && mask <= 65535) return true
  }
  return false
}

interface BatchChild {
  tit: string
  protocol: string
  port: number
  check: boolean
}

interface BatchGroup {
  tit: string
  check: boolean
  child: BatchChild[]
}

/** 批量添加协议组（官方 batchArr：远程登录和ping / Web服务 / 数据库） */
function buildBatchGroups(t: ClientTranslator): BatchGroup[] {
  return [
    {
      tit: t('remote_login', '远程登录和ping'),
      check: false,
      child: [
        { tit: 'SSH', protocol: 'ssh', port: 22, check: false },
        { tit: 'RDP', protocol: 'rdp', port: 3389, check: false },
        { tit: 'Telnet', protocol: 'telnet', port: 23, check: false },
        { tit: 'ICMP', protocol: 'icmp', port: 0, check: false },
      ],
    },
    {
      tit: t('web_server', 'Web服务'),
      check: false,
      child: [
        { tit: 'HTTP', protocol: 'http', port: 80, check: false },
        { tit: 'HTTPS', protocol: 'https', port: 443, check: false },
      ],
    },
    {
      tit: t('database', '数据库'),
      check: false,
      child: [
        { tit: 'MySQL', protocol: 'mysql', port: 3306, check: false },
        { tit: 'MS SQL', protocol: 'mssql', port: 1433, check: false },
        { tit: 'PostgreSQL', protocol: 'postgresql', port: 5432, check: false },
        { tit: 'Oracle', protocol: 'oracle', port: 1521, check: false },
        { tit: 'Redis', protocol: 'redis', port: 6379, check: false },
      ],
    },
  ]
}

function ErrorAlert({ text }: { text: string }) {
  if (!text) return null
  return (
    <div className='rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40'>
      {text}
    </div>
  )
}

function DialogShell({
  open,
  title,
  children,
  footer,
  onClose,
}: {
  open: boolean
  title: string
  children: React.ReactNode
  footer: React.ReactNode
  onClose: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className='min-w-0 overflow-hidden sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div key={open ? 'open' : 'closed'} className='min-w-0 space-y-4'>
          {children}
        </div>
        <div className='flex justify-end gap-2 pt-2'>{footer}</div>
      </DialogContent>
    </Dialog>
  )
}

export function GroupRulesPage() {
  const { t } = useClientLang()
  const navigate = useNavigate()
  const searchStr = useLocation({ select: (location) => location.searchStr })
  const groupId = useMemo(
    () => Number(new URLSearchParams(searchStr).get('id') ?? '') || 0,
    [searchStr]
  )

  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  const commonData = commonQuery.data?.data as Record<string, unknown> | undefined
  useEffect(() => {
    const base = (commonData?.website_name as string) || 'FurLL'
    document.title = `${base} - ${t('security_group', '安全组')}`
  }, [commonData, t])

  // ---------- Tab 状态 ----------
  const [activeTab, setActiveTab] = useState<TabKey>('in')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  function handleTabChange(v: string) {
    setActiveTab(v as TabKey)
    setSelectedIds(new Set())
  }

  // ---------- 入/出方向规则列表 ----------
  const [inPage, setInPage] = useState(1)
  const [inLimit, setInLimit] = useState(20)
  const [outPage, setOutPage] = useState(1)
  const [outLimit, setOutLimit] = useState(20)

  const inQuery = useQuery({
    queryKey: ['client-security-group-in', groupId, inPage, inLimit],
    queryFn: () =>
      fetchSecurityGroupRules(groupId, {
        page: inPage,
        limit: inLimit,
        orderby: 'id',
        sort: 'desc',
        direction: 'in',
      }),
    enabled: groupId > 0 && activeTab === 'in',
    retry: false,
  })
  const outQuery = useQuery({
    queryKey: ['client-security-group-out', groupId, outPage, outLimit],
    queryFn: () =>
      fetchSecurityGroupRules(groupId, {
        page: outPage,
        limit: outLimit,
        orderby: 'id',
        sort: 'desc',
        direction: 'out',
      }),
    enabled: groupId > 0 && activeTab === 'out',
    retry: false,
  })

  // ---------- 关联实例列表 ----------
  const [relPage, setRelPage] = useState(1)
  const [relLimit, setRelLimit] = useState(20)
  const relationQuery = useQuery({
    queryKey: ['client-security-group-relation', groupId, relPage, relLimit],
    queryFn: () =>
      fetchSecurityGroupHosts(groupId, {
        page: relPage,
        limit: relLimit,
        orderby: 'id',
        sort: 'desc',
      }),
    enabled: groupId > 0 && activeTab === 'relation',
    retry: false,
  })

  // ---------- 单个规则 创建/编辑弹窗 ----------
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false)
  const [ruleMode, setRuleMode] = useState<'add' | 'update'>('add')
  const [ruleId, setRuleId] = useState(0)
  const [ruleForm, setRuleForm] = useState({
    protocol: '',
    port: '',
    ip: '',
    description: '',
  })
  const [ruleError, setRuleError] = useState('')
  const [ruleSubmitting, setRuleSubmitting] = useState(false)

  function openRuleCreate() {
    setRuleMode('add')
    setRuleId(0)
    setRuleForm({ protocol: 'tcp', port: '', ip: '', description: '' })
    setRuleError('')
    setRuleDialogOpen(true)
  }

  function openRuleEdit(row: SecurityGroupRuleItem) {
    setRuleMode('update')
    setRuleId(row.id)
    setRuleForm({
      protocol: row.protocol ?? '',
      port: String(row.port ?? ''),
      ip: row.ip ?? '',
      description: row.description ?? '',
    })
    setRuleError('')
    setRuleDialogOpen(true)
  }

  function handleProtocolChange(proto: string) {
    const def = PROTOCOL_DEFAULT_PORT[proto]
    setRuleForm((f) => ({
      ...f,
      protocol: proto,
      port: def !== undefined ? def : '1-65535',
    }))
  }

  function handleRuleSubmit() {
    if (!ruleForm.protocol) {
      setRuleError(`${t('placeholder_pre2', '请选择')}${t('protocol', '协议')}`)
      return
    }
    if (!ruleForm.port) {
      setRuleError(`${t('placeholder_pre1', '请输入')}${t('common_cloud_label13', '端口')}`)
      return
    }
    if (!validPort(ruleForm.port)) {
      setRuleError(
        `${t('placeholder_pre1', '请输入')}${t('security_tip8', '正确的')}${t('common_cloud_label13', '端口')}`
      )
      return
    }
    if (!ruleForm.ip) {
      setRuleError(`${t('placeholder_pre1', '请输入')}${t('auth_ip', '授权IP')}`)
      return
    }
    if (!validIp(ruleForm.ip)) {
      setRuleError(
        `${t('placeholder_pre1', '请输入')}${t('security_tip8', '正确的')}${t('auth_ip', '授权IP')}`
      )
      return
    }
    setRuleError('')
    setRuleSubmitting(true)
    const params = {
      id: ruleId,
      protocol: ruleForm.protocol,
      port: ruleForm.port,
      ip: ruleForm.ip,
      description: ruleForm.description,
      direction: activeTab as 'in' | 'out',
    }
    const run =
      ruleMode === 'add'
        ? createSecurityGroupRule(groupId, params)
        : updateSecurityGroupRule(ruleId, params)
    run
      .then((res) => {
        if (res.status === 200) {
          setRuleDialogOpen(false)
          toast.success(res.msg || t('success_message', '操作成功'))
          if (activeTab === 'in') inQuery.refetch()
          else outQuery.refetch()
        } else {
          setRuleError(res.msg)
        }
      })
      .catch((err) => setRuleError(getErrorMessage(err)))
      .finally(() => setRuleSubmitting(false))
  }

  // ---------- 批量添加规则弹窗 ----------
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchIp, setBatchIp] = useState('')
  const [batchDesc, setBatchDesc] = useState('')
  const [batchGroups, setBatchGroups] = useState<BatchGroup[]>([])
  const [batchError, setBatchError] = useState('')
  const [batchSubmitting, setBatchSubmitting] = useState(false)

  function openBatchCreate() {
    setBatchIp('0.0.0.0/0')
    setBatchDesc('')
    setBatchGroups(buildBatchGroups(t))
    setBatchError('')
    setBatchOpen(true)
  }

  function toggleBatchParent(groupIndex: number, checked: boolean) {
    setBatchGroups((groups) =>
      groups.map((g, i) =>
        i === groupIndex
          ? {
              ...g,
              check: checked,
              child: g.child.map((c) => ({ ...c, check: checked })),
            }
          : g
      )
    )
  }

  function toggleBatchChild(groupIndex: number, childIndex: number, checked: boolean) {
    setBatchGroups((groups) =>
      groups.map((g, i) => {
        if (i !== groupIndex) return g
        const child = g.child.map((c, j) =>
          j === childIndex ? { ...c, check: checked } : c
        )
        return {
          ...g,
          child,
          check: child.every((c) => c.check),
        }
      })
    )
  }

  function handleBatchSubmit() {
    if (!batchIp) {
      setBatchError(`${t('placeholder_pre1', '请输入')}${t('auth_ip', '授权IP')}`)
      return
    }
    if (!validIp(batchIp)) {
      setBatchError(
        `${t('placeholder_pre1', '请输入')}${t('security_tip8', '正确的')}${t('auth_ip', '授权IP')}`
      )
      return
    }
    const rules = batchGroups
      .flatMap((g) => g.child)
      .filter((c) => c.check)
      .map((c) => ({
        protocol: c.protocol,
        port: c.port,
        direction: activeTab as 'in' | 'out',
        ip: batchIp,
        description: batchDesc,
      }))
    if (rules.length === 0) {
      setBatchError(`${t('placeholder_pre2', '请选择')}${t('common_port', '常见协议端口')}`)
      return
    }
    setBatchError('')
    setBatchSubmitting(true)
    batchCreateSecurityGroupRules(groupId, { rule: rules })
      .then((res) => {
        if (res.status === 200) {
          setBatchOpen(false)
          toast.success(res.msg || t('success_message', '操作成功'))
          if (activeTab === 'in') inQuery.refetch()
          else outQuery.refetch()
        } else {
          setBatchError(res.msg)
        }
      })
      .catch((err) => setBatchError(getErrorMessage(err)))
      .finally(() => setBatchSubmitting(false))
  }

  // ---------- 关联实例弹窗 ----------
  const [relationOpen, setRelationOpen] = useState(false)
  const [relationIds, setRelationIds] = useState<number[]>([])
  const [relationError, setRelationError] = useState('')
  const [relationSubmitting, setRelationSubmitting] = useState(false)
  const cloudQuery = useQuery({
    queryKey: ['client-security-group-cloud'],
    queryFn: () =>
      fetchHostList({ status: 'Active', page: 1, limit: 10000, scene: 'security_group' }),
    enabled: relationOpen,
    retry: false,
  })
  const availableCloud = useMemo(() => {
    const list = [...(cloudQuery.data?.data.list ?? [])]
    return list.sort((a, b) => b.id - a.id)
  }, [cloudQuery.data])

  // 关联结果通知（官方 $notify，标题 lang.cart_tip_text25=结果）
  const [linkResultOpen, setLinkResultOpen] = useState(false)
  const [linkResults, setLinkResults] = useState<
    Array<{ name?: string; msg?: string }>
  >([])

  function openRelation() {
    setRelationIds([])
    setRelationError('')
    setRelationOpen(true)
  }

  function toggleRelationId(id: number) {
    setRelationIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
    )
  }

  function handleRelationSubmit() {
    if (relationIds.length === 0) {
      setRelationError(`${t('placeholder_pre2', '请选择')}${t('cloud_menu_1', '实例')}`)
      return
    }
    setRelationError('')
    setRelationSubmitting(true)
    linkSecurityGroupHosts(groupId, relationIds)
      .then((res) => {
        setRelationSubmitting(false)
        if (res.status === 200) {
          setRelationOpen(false)
          setLinkResults(res.data ?? [])
          setLinkResultOpen(true)
          relationQuery.refetch()
        } else {
          setRelationError(res.msg)
        }
      })
      .catch((err) => {
        setRelationSubmitting(false)
        setRelationError(getErrorMessage(err))
      })
  }

  // ---------- 删除 ----------
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTitle, setDeleteTitle] = useState('')
  const [deleteName, setDeleteName] = useState('')
  /** rule/batch=删除规则，relation=解绑实例 */
  const [deleteType, setDeleteType] = useState<'rule' | 'batch' | 'relation'>('rule')
  const [deleteIds, setDeleteIds] = useState<number[]>([])
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

  function openRuleDelete(row: SecurityGroupRuleItem) {
    setDeleteType('rule')
    setDeleteIds([row.id])
    setDeleteName('')
    setDeleteTitle(
      `${t('referral_title9', '删除')}${activeTab === 'in' ? t('in_rules', '入方向规则') : t('out_rules', '出方向规则')}`
    )
    setDeleteOpen(true)
  }

  function openBatchDelete() {
    if (selectedIds.size === 0) {
      toast.warning(`${t('placeholder_pre2', '请选择')}${t('rules', '规则')}`)
      return
    }
    setDeleteType('batch')
    setDeleteIds([...selectedIds])
    setDeleteName('')
    setDeleteTitle(
      `${t('batch_delete', '批量删除')}${activeTab === 'in' ? t('in_rules', '入方向规则') : t('out_rules', '出方向规则')}`
    )
    setDeleteOpen(true)
  }

  function openRelationDelete(row: { id: number; name?: string }) {
    setDeleteType('relation')
    setDeleteIds([row.id])
    setDeleteName(row.name ?? '')
    setDeleteTitle(`${t('referral_title9', '删除')}${row.name ?? ''}`)
    setDeleteOpen(true)
  }

  async function handleDeleteConfirm() {
    setDeleteSubmitting(true)
    try {
      if (deleteType === 'relation') {
        const res = await unlinkSecurityGroupHost(groupId, deleteIds[0])
        if (res.status === 200) {
          setDeleteOpen(false)
          toast.success(t('delete_cloud_success', '解绑安全组成功'))
          relationQuery.refetch()
        } else {
          toast.error(res.msg)
        }
      } else {
        const results = await Promise.all(
          deleteIds.map((id) => deleteSecurityGroupRule(id))
        )
        const failed = results.find((r) => r.status !== 200)
        if (failed) {
          toast.error(failed.msg)
        } else {
          setDeleteOpen(false)
          toast.success(t('referral_tips4', '删除成功！'))
          setSelectedIds(new Set())
          if (activeTab === 'in') inQuery.refetch()
          else outQuery.refetch()
        }
      }
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setDeleteSubmitting(false)
    }
  }

  // ---------- 渲染 ----------
  if (groupId <= 0) {
    return (
      <Card className='p-5 sm:p-6'>
        <div className='flex min-h-48 flex-col items-center justify-center gap-4 text-center'>
          <p className='text-sm text-muted-foreground'>参数错误</p>
          <Button variant='outline' size='sm' onClick={() => navigate({ to: '/security_group.htm' })}>
            返回安全组
          </Button>
        </div>
      </Card>
    )
  }

  const inList = inQuery.data?.data.list ?? []
  const inTotal = inQuery.data?.data.count ?? 0
  const outList = outQuery.data?.data.list ?? []
  const outTotal = outQuery.data?.data.count ?? 0
  const relationList = relationQuery.data?.data.list ?? []
  const relationTotal = relationQuery.data?.data.count ?? 0

  const rulesLoading = activeTab === 'in' ? inQuery.isLoading : outQuery.isLoading
  const rulesList = activeTab === 'in' ? inList : outList
  const rulesTotal = activeTab === 'in' ? inTotal : outTotal
  const rulesPage = activeTab === 'in' ? inPage : outPage
  const rulesLimit = activeTab === 'in' ? inLimit : outLimit
  const setRulesPage = activeTab === 'in' ? setInPage : setOutPage
  const setRulesLimit = activeTab === 'in' ? setInLimit : setOutLimit

  return (
    <div className='space-y-4'>
      <div className='mb-2 flex items-center gap-3'>
        <Button
          variant='ghost'
          size='icon'
          className='size-8 shrink-0'
          onClick={() => navigate({ to: '/security_group.htm' })}
          aria-label='返回'
        >
          <ArrowLeft className='h-5 w-5 text-primary' />
        </Button>
        <h1 className='text-2xl font-bold tracking-tight'>
          {t('security_title', '安全')}
        </h1>
      </div>

      <Card className='p-5 sm:p-6'>
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value='in'>{t('in_rules', '入方向规则')}</TabsTrigger>
            <TabsTrigger value='out'>{t('out_rules', '出方向规则')}</TabsTrigger>
            <TabsTrigger value='relation'>
              {t('relation_instance', '关联实例')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value='in' className='mt-4'>
            <div className='flex items-center gap-2'>
              <Button size='sm' onClick={openRuleCreate}>
                <Plus className='mr-1 h-4 w-4' />
                {t('com_config.add', '添加')}
                {t('rules', '规则')}
              </Button>
              <Button size='sm' variant='outline' onClick={openBatchCreate}>
                {t('batch_add', '批量添加')}
              </Button>
              <Button
                size='sm'
                variant='outline'
                disabled={selectedIds.size === 0}
                onClick={openBatchDelete}
              >
                {t('batch_delete', '批量删除')}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value='out' className='mt-4'>
            <div className='flex items-center gap-2'>
              <Button size='sm' onClick={openRuleCreate}>
                <Plus className='mr-1 h-4 w-4' />
                {t('com_config.add', '添加')}
                {t('rules', '规则')}
              </Button>
              <Button size='sm' variant='outline' onClick={openBatchCreate}>
                {t('batch_add', '批量添加')}
              </Button>
              <Button
                size='sm'
                variant='outline'
                disabled={selectedIds.size === 0}
                onClick={openBatchDelete}
              >
                {t('batch_delete', '批量删除')}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value='relation' className='mt-4'>
            <Button size='sm' onClick={openRelation}>
              <Plus className='mr-1 h-4 w-4' />
              {t('com_config.add', '添加')}
              {t('cloud_menu_1', '实例')}
            </Button>
          </TabsContent>
        </Tabs>

        {/* 入/出方向规则表 */}
        {activeTab === 'in' || activeTab === 'out' ? (
          <>
            <div className='mt-4 overflow-hidden rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-12' />
                    <TableHead className='w-20'>ID</TableHead>
                    <TableHead className='w-28'>{t('protocol', '协议')}</TableHead>
                    <TableHead className='w-36'>
                      {t('port_range', '端口范围')}
                    </TableHead>
                    <TableHead className='w-40'>{t('auth_ip', '授权IP')}</TableHead>
                    <TableHead className='min-w-[180px]'>
                      {t('account_label9', '描述')}
                    </TableHead>
                    <TableHead className='w-44'>
                      {t('account_label10', '创建时间')}
                    </TableHead>
                    <TableHead className='w-20 text-right'>
                      {t('security_label3', '操作')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rulesLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 8 }).map((__, j) => (
                          <TableCell key={j}>
                            <Skeleton className='h-4 w-full' />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : rulesList.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className='h-40 text-center text-sm text-muted-foreground'
                      >
                        {t('subaccount_text55', '暂无信息')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rulesList.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(item.id)}
                            onCheckedChange={(v) => {
                              setSelectedIds((ids) => {
                                const next = new Set(ids)
                                if (v === true) next.add(item.id)
                                else next.delete(item.id)
                                return next
                              })
                            }}
                          />
                        </TableCell>
                        <TableCell className='text-sm'>{item.id}</TableCell>
                        <TableCell className='text-sm'>{item.protocol}</TableCell>
                        <TableCell className='text-sm'>{item.port}</TableCell>
                        <TableCell className='text-sm'>{item.ip}</TableCell>
                        <TableCell className='max-w-[240px] truncate text-sm text-muted-foreground'>
                          <span title={item.description}>
                            {item.description || '--'}
                          </span>
                        </TableCell>
                        <TableCell className='text-sm text-muted-foreground'>
                          {formatTimeFull(item.create_time)}
                        </TableCell>
                        <TableCell className='text-right'>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant='ghost' size='icon' className='size-8'>
                                <MoreHorizontal className='h-4 w-4' />
                                <span className='sr-only'>操作</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align='end'>
                              <DropdownMenuItem onClick={() => openRuleEdit(item)}>
                                {t('edit', '编辑')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openRuleDelete(item)}>
                                {t('security_btn4', '删除')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <PaginationBar
              page={rulesPage}
              limit={rulesLimit}
              total={rulesTotal}
              onPageChange={setRulesPage}
              onLimitChange={(v) => {
                setRulesLimit(v)
                setRulesPage(1)
              }}
            />
          </>
        ) : null}

        {/* 关联实例表 */}
        {activeTab === 'relation' ? (
          <>
            <div className='mt-4 overflow-hidden rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='min-w-[240px]'>
                      {t('cloud_menu_1', '实例')}
                    </TableHead>
                    <TableHead className='min-w-[160px]'>IP</TableHead>
                    <TableHead className='w-20 text-right'>
                      {t('security_label3', '操作')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {relationQuery.isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 3 }).map((__, j) => (
                          <TableCell key={j}>
                            <Skeleton className='h-4 w-full' />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : relationList.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className='h-40 text-center text-sm text-muted-foreground'
                      >
                        {t('subaccount_text55', '暂无信息')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    relationList.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className='text-sm'>{item.name}</TableCell>
                        <TableCell className='text-sm text-muted-foreground'>
                          {item.ip || '--'}
                        </TableCell>
                        <TableCell className='text-right'>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant='ghost' size='icon' className='size-8'>
                                <MoreHorizontal className='h-4 w-4' />
                                <span className='sr-only'>操作</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align='end'>
                              <DropdownMenuItem
                                onClick={() => openRelationDelete(item)}
                              >
                                {t('unbind_safe', '解绑')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <PaginationBar
              page={relPage}
              limit={relLimit}
              total={relationTotal}
              onPageChange={setRelPage}
              onLimitChange={(v) => {
                setRelLimit(v)
                setRelPage(1)
              }}
            />
          </>
        ) : null}
      </Card>

      {/* 单个规则 创建/编辑弹窗 */}
      <DialogShell
        open={ruleDialogOpen}
        title={
          ruleMode === 'add'
            ? `${t('com_config.add', '添加')}${t('rules', '规则')}`
            : `${t('edit', '编辑')}${t('rules', '规则')}`
        }
        onClose={() => setRuleDialogOpen(false)}
        footer={
          <>
            <Button onClick={handleRuleSubmit} disabled={ruleSubmitting}>
              {ruleSubmitting ? <Loader2 className='animate-spin' /> : null}
              {t('referral_btn6', '确定')}
            </Button>
            <Button variant='outline' onClick={() => setRuleDialogOpen(false)}>
              {t('referral_btn7', '取消')}
            </Button>
          </>
        }
      >
        <div className='space-y-2'>
          <Label>{t('protocol', '协议')}</Label>
          <Select
            value={ruleForm.protocol}
            onValueChange={handleProtocolChange}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('protocol', '协议')} />
            </SelectTrigger>
            <SelectContent>
              {PROTOCOLS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='space-y-2'>
          <Label>{t('common_cloud_label13', '端口')}</Label>
          <Input
            value={ruleForm.port}
            disabled={ruleForm.protocol !== 'tcp' && ruleForm.protocol !== 'udp'}
            placeholder={t('security_tip2', '例如：22或者22-12345')}
            onChange={(e) => setRuleForm((f) => ({ ...f, port: e.target.value }))}
          />
        </div>
        <div className='space-y-2'>
          <Label>{t('auth_ip', '授权IP')}</Label>
          <Input
            value={ruleForm.ip}
            placeholder={t('auth_ip', '授权IP')}
            onChange={(e) => setRuleForm((f) => ({ ...f, ip: e.target.value }))}
          />
        </div>
        <div className='space-y-2'>
          <Label>{t('account_label9', '描述')}</Label>
          <Textarea
            rows={4}
            value={ruleForm.description}
            placeholder={t('account_label9', '描述')}
            onChange={(e) =>
              setRuleForm((f) => ({ ...f, description: e.target.value }))
            }
          />
        </div>
        <ErrorAlert text={ruleError} />
      </DialogShell>

      {/* 批量添加规则弹窗 */}
      <DialogShell
        open={batchOpen}
        title={t('batch_add_rules', '批量添加规则')}
        onClose={() => setBatchOpen(false)}
        footer={
          <>
            <Button onClick={handleBatchSubmit} disabled={batchSubmitting}>
              {batchSubmitting ? <Loader2 className='animate-spin' /> : null}
              {t('referral_btn6', '确定')}
            </Button>
            <Button variant='outline' onClick={() => setBatchOpen(false)}>
              {t('referral_btn7', '取消')}
            </Button>
          </>
        }
      >
        <div className='space-y-2'>
          <Label>
            <span className='mr-1 text-red-600'>*</span>
            {t('common_port', '常见协议端口')}
          </Label>
          <div className='space-y-3 rounded-md border p-3'>
            {batchGroups.map((group, gi) => (
              <div key={group.tit}>
                <label className='flex cursor-pointer items-center gap-2 text-sm font-medium'>
                  <Checkbox
                    checked={group.check}
                    onCheckedChange={(v) => toggleBatchParent(gi, v === true)}
                  />
                  {group.tit}
                </label>
                <div className='mt-2 flex flex-wrap gap-x-4 gap-y-2 pl-6'>
                  {group.child.map((child, ci) => (
                    <label
                      key={child.tit}
                      className='flex cursor-pointer items-center gap-1.5 text-sm'
                    >
                      <Checkbox
                        checked={child.check}
                        onCheckedChange={(v) =>
                          toggleBatchChild(gi, ci, v === true)
                        }
                      />
                      {child.tit}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className='space-y-2'>
          <Label>{t('auth_ip', '授权IP')}</Label>
          <Input
            value={batchIp}
            onChange={(e) => setBatchIp(e.target.value)}
          />
        </div>
        <div className='space-y-2'>
          <Label>{t('account_label9', '描述')}</Label>
          <Textarea
            rows={4}
            value={batchDesc}
            onChange={(e) => setBatchDesc(e.target.value)}
          />
        </div>
        <ErrorAlert text={batchError} />
      </DialogShell>

      {/* 关联实例弹窗 */}
      <DialogShell
        open={relationOpen}
        title={t('add_cloud_to_group', '添加实例至安全组')}
        onClose={() => setRelationOpen(false)}
        footer={
          <>
            <Button onClick={handleRelationSubmit} disabled={relationSubmitting}>
              {relationSubmitting ? <Loader2 className='animate-spin' /> : null}
              {t('referral_btn6', '确定')}
            </Button>
            <Button variant='outline' onClick={() => setRelationOpen(false)}>
              {t('referral_btn7', '取消')}
            </Button>
          </>
        }
      >
        <div className='rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300'>
          {t('security_tip3', '实例将从已有安全组移除并添加至本安全组')}
        </div>
        <div className='space-y-2'>
          <div className='flex items-center justify-between'>
            <Label>{t('cloud_menu_1', '实例')}</Label>
            <label className='flex cursor-pointer items-center gap-1.5 text-sm'>
              <Checkbox
                checked={
                  availableCloud.length > 0 &&
                  relationIds.length === availableCloud.length
                }
                onCheckedChange={(v) => {
                  setRelationIds(v === true ? availableCloud.map((c) => c.id) : [])
                }}
              />
              {t('shoppingCar_select_all', '全选')}
            </label>
          </div>
          <div className='max-h-64 space-y-1 overflow-auto rounded-md border p-2'>
            {cloudQuery.isLoading ? (
              <div className='space-y-2 p-2'>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className='h-5 w-full' />
                ))}
              </div>
            ) : availableCloud.length === 0 ? (
              <div className='py-6 text-center text-sm text-muted-foreground'>
                {t('subaccount_text55', '暂无信息')}
              </div>
            ) : (
              availableCloud.map((item) => (
                <label
                  key={item.id}
                  className='flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent'
                >
                  <Checkbox
                    checked={relationIds.includes(item.id)}
                    onCheckedChange={() => toggleRelationId(item.id)}
                  />
                  <span className='min-w-0 flex-1 truncate'>{item.name}</span>
                </label>
              ))
            )}
          </div>
        </div>
        <ErrorAlert text={relationError} />
      </DialogShell>

      {/* 关联结果通知 */}
      <DialogShell
        open={linkResultOpen}
        title={t('cart_tip_text25', '结果')}
        onClose={() => setLinkResultOpen(false)}
        footer={
          <>
            <Button variant='outline' onClick={() => setLinkResultOpen(false)}>
              {t('referral_btn6', '确定')}
            </Button>
          </>
        }
      >
        <div className='space-y-2 text-sm'>
          {linkResults.map((item, i) => (
            <div key={i}>
              {t('cloud_menu_1', '实例')}：{item.name}：{item.msg}
            </div>
          ))}
        </div>
      </DialogShell>

      {/* 删除/解绑弹窗 */}
      <ConfirmDeleteDialog
        open={deleteOpen}
        title={deleteTitle}
        name={deleteName}
        submitting={deleteSubmitting}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteOpen(false)}
      />
    </div>
  )
}
