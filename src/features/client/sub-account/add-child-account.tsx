import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ChevronsUpDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  createSubAccount,
  updateSubAccount,
  fetchAuthList,
  fetchCountryList,
  fetchHostAll,
  fetchModuleList,
  fetchProjectList,
  fetchSubAccountDetail,
  type HostAllItem,
  type ModuleListItem,
  type ProjectItem,
  type SubAccountDetail,
} from '@/api'
import { useSubAccountLang } from '@/hooks/use-sub-account-lang'
import { useAddons } from '@/hooks/use-addons'
import { getErrorMessage } from '@/lib/api'
import {
  AuthTree,
} from './auth-tree'
import {
  collectActiveIds,
  findForceOutline,
  hydrateSelection,
  toggleLeafSelection,
} from './auth-logic'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

/** 通知类型（官方 notice 固定六个） */
const NOTICE_TYPES = [
  'product',
  'marketing',
  'ticket',
  'cost',
  'recommend',
  'system',
] as const

interface FormState {
  username: string
  email: string
  phone_code: string
  phone: string
  password: string
  project_id: number[]
  visible_product: 'module' | 'host'
  module: string[]
  host_id: number[]
  notice: string[]
}

const EMPTY_FORM: FormState = {
  username: '',
  email: '',
  phone_code: '',
  phone: '',
  password: '',
  project_id: [],
  visible_product: 'module',
  module: [],
  host_id: [],
  notice: [],
}

const EMAIL_RE = /^([a-zA-Z0-9_-])+@([a-zA-Z0-9_-])+(\.[a-zA-Z0-9_-])+/
/** 官方密码正则：6-32 位，无中文无空白 */
const PASSWORD_RE = /^[^\u4e00-\u9fa5\s]{6,32}$/

function parseQuery(searchStr: string): Record<string, string> {
  const params = new URLSearchParams(searchStr)
  const out: Record<string, string> = {}
  for (const [key, value] of params) out[key] = value
  return out
}

/** 可搜索多选下拉（官方 el-select multiple，shadcn Combobox + Checkbox） */
function MultiSelectCombobox({
  options,
  values,
  onChange,
  placeholder,
  disabled,
}: {
  options: Array<{ value: string; label: string }>
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const selectedOptions = options.filter((opt) => values.includes(opt.value))

  function toggle(value: string) {
    onChange(
      values.includes(value)
        ? values.filter((v) => v !== value)
        : [...values, value]
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          role='combobox'
          aria-expanded={open}
          disabled={disabled}
          className='h-9 w-full justify-between gap-1 font-normal'
        >
          <span className='line-clamp-1 flex-1 text-left'>
            {selectedOptions.length > 0
              ? selectedOptions.map((opt) => opt.label).join('、')
              : placeholder ?? '请选择'}
          </span>
          <ChevronsUpDown className='h-4 w-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-[--radix-popover-trigger-width] p-0' align='start'>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder='搜索'
            value={keyword}
            onValueChange={setKeyword}
          />
          <CommandList>
            {options.length === 0 ? (
              <CommandEmpty>暂无数据</CommandEmpty>
            ) : (
              <CommandGroup>
                {options
                  .filter((opt) =>
                    keyword
                      ? opt.label.toLowerCase().includes(keyword.trim().toLowerCase())
                      : true
                  )
                  .map((opt) => (
                    <CommandItem
                      key={opt.value}
                      value={opt.value}
                      onSelect={() => toggle(opt.value)}
                    >
                      <Checkbox
                        checked={values.includes(opt.value)}
                        className='mr-2'
                      />
                      <span className='min-w-0 flex-1 truncate'>{opt.label}</span>
                    </CommandItem>
                  ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/**
 * 新增/编辑/详情子账户（addChildAccount.htm?id=&type=edit，官方 IdcsmartSubAccount 插件）。
 * 官方 GET /auth 权限树（左=非产品权限，右=产品权限）、/module、/host/all、/project、/country；
 * 创建 POST /sub_account，编辑 PUT /sub_account/:id。
 */
export function AddChildAccountPage() {
  const navigate = useNavigate()
  const { t } = useSubAccountLang()

  const params = useMemo(() => parseQuery(window.location.search), [])
  const accountId = params.id ? Number(params.id) : 0
  const isEdit = accountId > 0 && params.type === 'edit'
  /** 详情模式：有 id 但非编辑（官方 isDetali），禁用所有输入 */
  const isView = accountId > 0 && !isEdit

  // 返回列表走官方插件入口 /plugin/<id>/childAccount.htm（与侧边栏 URL 一致）
  const { addons } = useAddons()
  const subAccountPluginId = useMemo(
    () => addons.find((a) => a.name.toLowerCase() === 'idcsmartsubaccount')?.id ?? null,
    [addons]
  )
  const childAccountUrl = useMemo(
    () =>
      subAccountPluginId
        ? `/plugin/${subAccountPluginId}/childAccount.htm`
        : '/childAccount.htm',
    [subAccountPluginId]
  )

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // 左右权限树选中集（只存叶子 id）
  const [leftSelected, setLeftSelected] = useState<Set<number>>(new Set())
  const [rightSelected, setRightSelected] = useState<Set<number>>(new Set())

  // ---------- 数据 ----------
  // 注意：官方 API 错误是 HTTP 200 + body.status（404 等），body 可能没有 data 字段，
  // 因此内层 data 也要可选链兜底，否则 `.list` 对 undefined 抛错（如 /project 未安装插件时）
  const countryQuery = useQuery({
    queryKey: ['client-country'],
    queryFn: () => fetchCountryList(),
    retry: false,
  })
  const countries = countryQuery.data?.data?.list ?? []

  const authQuery = useQuery({
    queryKey: ['client-sub-account-auth'],
    queryFn: fetchAuthList,
    retry: false,
  })
  const authList = useMemo(
    () => authQuery.data?.data?.list ?? [],
    [authQuery.data]
  )
  const leftNodes = useMemo(
    () => authList.filter((item) => item.title !== '产品权限'),
    [authList]
  )
  const rightNodes = useMemo(
    () => authList.filter((item) => item.title === '产品权限'),
    [authList]
  )

  const moduleQuery = useQuery({
    queryKey: ['client-sub-account-module'],
    queryFn: fetchModuleList,
    retry: false,
  })
  const moduleList = moduleQuery.data?.data?.list ?? []

  const hostQuery = useQuery({
    queryKey: ['client-sub-account-host-all'],
    queryFn: fetchHostAll,
    retry: false,
  })
  const hostList = hostQuery.data?.data?.list ?? []

  // IdcsmartProject 插件：项目列表接口可能 404（未安装），body 无 data 字段，静默降级为空
  const projectQuery = useQuery({
    queryKey: ['client-sub-account-project'],
    queryFn: fetchProjectList,
    retry: false,
  })
  const projectList = projectQuery.data?.data?.list ?? []
  const hasProject = projectList.length > 0

  // 详情回填
  const detailQuery = useQuery({
    queryKey: ['client-sub-account-detail', accountId],
    queryFn: () => fetchSubAccountDetail(accountId),
    enabled: accountId > 0,
    retry: false,
  })

  // 默认区号为中国（官方 getCountry 后取中国）；渲染期一次调整，落定后不再触发
  if (!form.phone_code && countries.length > 0) {
    const china = countries.find((c) => c.name_zh === '中国')
    if (china?.phone_code != null) {
      setForm((prev) =>
        prev.phone_code
          ? prev
          : { ...prev, phone_code: String(china.phone_code) }
      )
    }
  }

  // 「概要」强制勾选链（派生自权限树，无需 effect）
  const leftForced = useMemo(
    () => (authQuery.isLoading ? new Set<number>() : findForceOutline(leftNodes)),
    [authQuery.isLoading, leftNodes]
  )

  // 详情回填（渲染期状态调整，官方 React 模式；detail 变化时一次性重置表单）
  const [prevDetail, setPrevDetail] = useState<SubAccountDetail | null>(null)
  const detail = detailQuery.data?.data?.account
  if (detail && detail !== prevDetail && !detailQuery.isLoading) {
    setPrevDetail(detail)
    setForm((prev) => ({
      ...prev,
      username: detail.username ?? '',
      email: detail.email ?? '',
      phone_code: detail.phone_code != null ? String(detail.phone_code) : prev.phone_code,
      phone: detail.phone ?? '',
      project_id: detail.project_id ?? [],
      visible_product: detail.visible_product === 'host' ? 'host' : 'module',
      module: detail.module ?? [],
      host_id: (detail.host_id ?? []).map(Number),
      notice: detail.notice ?? [],
    }))
    setLeftSelected(hydrateSelection(leftNodes, detail.auth))
    setRightSelected(hydrateSelection(rightNodes, detail.auth))
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  // ---------- 校验 ----------
  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!form.username.trim()) {
      next.username = t('withdraw_placeholder4', '请输入姓名')
    } else if (form.username.trim().length < 3) {
      next.username = t('withdraw_tips4', '长度在至少为 3 个字符')
    }
    if (form.phone && !form.email && !form.phone_code) {
      next.phone_code = t('subaccount_text9', '请选择')
    }
    if (!form.phone && !form.email) {
      next.email = t('invoice_text125', '邮箱不能为空')
    } else if (form.email && !EMAIL_RE.test(form.email.trim())) {
      next.email = t('invoice_text126', '请输入正确的邮箱格式')
    }
    if (!isEdit && !isView) {
      if (!form.password) {
        next.password = t('subaccount_text15', '请输入密码')
      } else if (!PASSWORD_RE.test(form.password)) {
        next.password = t('subaccount_text42', '密码在至少为 6 个字符')
      }
    }
    if (!hasProject) {
      if (form.visible_product === 'module' && form.module.length === 0) {
        next.module = t('subaccount_text17', '请至少选择一个')
      }
      if (form.visible_product === 'host' && form.host_id.length === 0) {
        next.host_id = t('subaccount_text17', '请至少选择一个')
      }
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  // ---------- 保存 ----------
  async function handleSave() {
    if (!validate() || submitting) return
    setSubmitting(true)
    const auth = [
      ...collectActiveIds(leftNodes, leftSelected, leftForced),
      ...collectActiveIds(rightNodes, rightSelected, new Set()),
    ]
    const payload = {
      username: form.username.trim(),
      email: form.email.trim(),
      phone_code: form.phone_code,
      phone: form.phone,
      notice: form.notice,
      auth: [...new Set(auth)],
    }
    if (hasProject) {
      Object.assign(payload, { project_id: form.project_id })
    } else {
      Object.assign(payload, {
        visible_product: form.visible_product,
        module: form.visible_product === 'module' ? form.module : [],
        host_id: form.visible_product === 'host' ? form.host_id : [],
      })
    }
    if (!isEdit) Object.assign(payload, { password: form.password })
    try {
      const res = isEdit
        ? await updateSubAccount(accountId, payload)
        : await createSubAccount(payload)
      if (res.status === 200) {
        toast.success(
          isEdit
            ? t('subaccount_text44', '修改成功')
            : t('subaccount_text45', '创建成功')
        )
        navigate({ to: childAccountUrl })
      } else {
        toast.error(res.msg)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  function goBack() {
    navigate({ to: childAccountUrl })
  }

  const title = isEdit
    ? t('subaccount_text1', '编辑子账户')
    : isView
      ? t('subaccount_text2', '详情')
      : t('subaccount_text3', '新增子账户')

  const loading =
    authQuery.isLoading ||
    countryQuery.isLoading ||
    moduleQuery.isLoading ||
    hostQuery.isLoading ||
    (accountId > 0 && detailQuery.isLoading)

  return (
    <div className='space-y-4'>
      <div className='flex items-center gap-3'>
        <Button variant='ghost' size='icon' className='size-9 shrink-0' onClick={goBack}>
          <ArrowLeft className='h-5 w-5 text-primary' />
        </Button>
        <h1 className='text-2xl font-bold tracking-tight'>{title}</h1>
      </div>

      {loading ? (
        <Card>
          <CardContent className='flex min-h-72 items-center justify-center'>
            <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
          </CardContent>
        </Card>
      ) : (
        <Card className='p-5 sm:p-6'>
          {/* ===== 基本信息 ===== */}
          <div className='border-l-[3px] border-primary pl-2.5 text-sm font-medium leading-none'>
            {t('subaccount_text4', '基本信息')}
          </div>

          <div className='mt-5 grid gap-5 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label>{t('subaccount_text5', '账户')}</Label>
              <Input
                value={form.username}
                disabled={isView}
                placeholder={t('subaccount_text6', '请输入账户')}
                onChange={(e) => setField('username', e.target.value)}
              />
              {errors.username && (
                <p className='text-xs text-destructive'>{errors.username}</p>
              )}
            </div>

            <div className='space-y-2'>
              <Label>{t('subaccount_text14', '密码')}</Label>
              {isEdit || isView ? (
                <div className='flex h-9 items-center text-sm text-muted-foreground'>
                  ********
                </div>
              ) : (
                <Input
                  type='password'
                  value={form.password}
                  placeholder={t('subaccount_text15', '请输入密码')}
                  onChange={(e) => setField('password', e.target.value)}
                />
              )}
              {errors.password && (
                <p className='text-xs text-destructive'>{errors.password}</p>
              )}
            </div>

            <div className='space-y-2'>
              <Label>{t('subaccount_text7', '手机')}</Label>
              <div className='flex gap-2'>
                <Select
                  value={form.phone_code}
                  disabled={isView}
                  onValueChange={(v) => setField('phone_code', v)}
                >
                  <SelectTrigger className='w-28 shrink-0'>
                    <SelectValue placeholder='+44' />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((c) => (
                      <SelectItem key={c.name ?? c.id} value={String(c.phone_code)}>
                        {c.name_zh}+{c.phone_code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={form.phone}
                  disabled={isView}
                  placeholder={t('subaccount_text10', '请输入手机')}
                  onChange={(e) => setField('phone', e.target.value)}
                />
              </div>
              {errors.phone_code && (
                <p className='text-xs text-destructive'>{errors.phone_code}</p>
              )}
            </div>

            <div className='space-y-2'>
              <Label>{t('subaccount_text11', '邮箱')}</Label>
              <Input
                value={form.email}
                disabled={isView}
                placeholder={t('subaccount_text13', '请输入邮箱')}
                onChange={(e) => setField('email', e.target.value)}
              />
              {errors.email && (
                <p className='text-xs text-destructive'>{errors.email}</p>
              )}
            </div>
          </div>

          {/* ===== 所属项目 / 可见产品 ===== */}
          <Separator className='my-5' />
          {hasProject ? (
            <div className='grid gap-5 sm:grid-cols-1'>
              <div className='space-y-2'>
                <Label>{t('subaccount_text16', '所属项目')}</Label>
                <MultiSelectCombobox
                  options={projectList.map((p: ProjectItem) => ({
                    value: String(p.id),
                    label: p.name,
                  }))}
                  values={form.project_id.map(String)}
                  disabled={isView}
                  placeholder={t('subaccount_text9', '请选择')}
                  onChange={(values) =>
                    setField('project_id', values.map(Number))
                  }
                />
              </div>
            </div>
          ) : (
            <div className='space-y-4'>
              <div className='flex items-start justify-between gap-3'>
                <Label>{t('subaccount_text18', '可见产品')}</Label>
                <p className='max-w-md text-xs text-muted-foreground'>
                  {t('subaccount_text19', '选择产品类型后，新购买的产品默认可见选择具体产品后，')}
                  {t('subaccount_text20', '新购的产品默认不可见')}
                </p>
              </div>
              <div className='grid gap-5 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Select
                    value={form.visible_product}
                    disabled={isView}
                    onValueChange={(v) =>
                      setField('visible_product', v as 'module' | 'host')
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('subaccount_text21', '产品类型')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='module'>
                        {t('subaccount_text21', '产品类型')}
                      </SelectItem>
                      <SelectItem value='host'>
                        {t('subaccount_text22', '具体产品')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-2'>
                  {form.visible_product === 'module' ? (
                    <>
                      <MultiSelectCombobox
                        options={moduleList.map((m: ModuleListItem) => ({
                          value: m.name,
                          label: m.display_name || m.name,
                        }))}
                        values={form.module}
                        disabled={isView}
                        placeholder={t('subaccount_text9', '请选择')}
                        onChange={(values) => setField('module', values)}
                      />
                      {errors.module && (
                        <p className='text-xs text-destructive'>{errors.module}</p>
                      )}
                    </>
                  ) : (
                    <>
                      <MultiSelectCombobox
                        options={hostList.map((h: HostAllItem) => ({
                          value: String(h.id),
                          label: `${h.product_name ?? '产品'} (${h.name ?? '--'})`,
                        }))}
                        values={form.host_id.map(String)}
                        disabled={isView}
                        placeholder={t('subaccount_text9', '请选择')}
                        onChange={(values) =>
                          setField('host_id', values.map(Number))
                        }
                      />
                      {errors.host_id && (
                        <p className='text-xs text-destructive'>{errors.host_id}</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ===== 权限配置 ===== */}
          <Separator className='my-5' />
          <div className='border-l-[3px] border-primary pl-2.5 text-sm font-medium leading-none'>
            {t('subaccount_text23', '权限配置')}
          </div>

          <div className='mt-5 space-y-2'>
            <Label>{t('subaccount_text24', '通知')}</Label>
            <div className='flex flex-wrap items-center gap-x-5 gap-y-2'>
              {NOTICE_TYPES.map((type) => (
                <label key={type} className='flex cursor-pointer items-center gap-1.5 text-sm'>
                  <Checkbox
                    checked={form.notice.includes(type)}
                    disabled={isView}
                    onCheckedChange={(checked) => {
                      const next = checked
                        ? [...form.notice, type]
                        : form.notice.filter((v) => v !== type)
                      setField('notice', next)
                    }}
                  />
                  {type === 'product' && t('subaccount_text25', '产品通知')}
                  {type === 'marketing' && t('subaccount_text26', '营销通知')}
                  {type === 'ticket' && t('subaccount_text27', '工单通知')}
                  {type === 'cost' && t('subaccount_text28', '费用通知')}
                  {type === 'recommend' && t('subaccount_text29', '推介通知')}
                  {type === 'system' && t('subaccount_text30', '系统通知')}
                </label>
              ))}
            </div>
          </div>

          <div className='mt-5 space-y-2'>
            <Label>{t('subaccount_text73', '权限')}</Label>
            <div className='grid gap-4 lg:grid-cols-2'>
              <div className='rounded-md border p-3'>
                <AuthTree
                  nodes={leftNodes}
                  forced={leftForced}
                  selected={leftSelected}
                  onToggle={(node) =>
                    toggleLeafSelection(node, leftSelected, setLeftSelected)
                  }
                />
              </div>
              <div className='rounded-md border p-3'>
                <AuthTree
                  nodes={rightNodes}
                  selected={rightSelected}
                  onToggle={(node) =>
                    toggleLeafSelection(node, rightSelected, setRightSelected)
                  }
                />
              </div>
            </div>
          </div>

          {/* ===== 底部按钮 ===== */}
          {!isView && (
            <div className='mt-6 flex items-center justify-end gap-3'>
              <Button variant='outline' onClick={goBack}>
                {t('subaccount_text32', '取消')}
              </Button>
              <Button onClick={handleSave} disabled={submitting}>
                {submitting && <Loader2 className='mr-1 h-4 w-4 animate-spin' />}
                {t('subaccount_text31', '保存')}
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
