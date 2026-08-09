import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  BadgeCheck,
  Check,
  ChevronRight,
  ChevronsUpDown,
  Loader2,
  Pencil,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  cancelOauth,
  changeWxPushStatus,
  fetchCertificationInfo,
  fetchClientCustomFieldValue,
  fetchOauthUrl,
  fetchWxInfo,
  updateAccount,
  type AccountInfo,
  type AccountOauthItem,
  type ClientCustomFieldItem,
  type CountryItem,
  type WxConectInfo,
} from '@/api'
import { useAddons } from '@/hooks/use-addons'
import { useClientLang } from '@/hooks/use-client-lang'
import { getErrorMessage } from '@/lib/api'
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
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  ChangePasswordDialog,
  CodeResetPasswordDialog,
  OperatePasswordDialog,
  ReEmailDialog,
  RePhoneDialog,
  VerifyEmailDialog,
  VerifyPhoneDialog,
} from './dialogs'
import {
  initialEmailEditState,
  initialPhoneEditState,
  type EmailEditState,
  type PhoneEditState,
  type SubmitWithSecurity,
} from './types'
import unauthorizedImg from './assets/unauthorized.png'
import enterpriseImg from './assets/enterprise_certification.png'
import personalImg from './assets/personal_certification.png'

interface ProfileTabProps {
  account?: AccountInfo
  commonData?: Record<string, unknown>
  countryList: CountryItem[]
  hasCustomFieldPlugin: boolean
  hasCertificationPlugin: boolean
  hasWxPlugin: boolean
  submitWithSecurity: SubmitWithSecurity
  reloadAccount: () => void
}

interface AttestationInfo {
  status: number
  iconUrl: string
  text: string
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className='border-l-[3px] border-primary pl-2.5 text-sm font-medium leading-none'>
      {children}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className='mb-2 h-5 text-[13px] font-medium text-muted-foreground'>
      {children}
    </div>
  )
}

/** 只读账户信息行（带编辑图标） */
function ReadonlyRow({
  label,
  value,
  onEdit,
  canEdit,
  isPassword,
}: {
  label: string
  value: string
  onEdit?: () => void
  canEdit?: boolean
  isPassword?: boolean
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div
        className={cn(
          'flex items-center justify-between border-b border-border py-2',
          canEdit && onEdit && 'cursor-pointer'
        )}
        onClick={() => canEdit && onEdit?.()}
      >
        <span className='select-none text-sm text-foreground'>
          {isPassword ? '********' : value || '--'}
        </span>
        {canEdit && onEdit ? (
          <Pencil className='h-3.5 w-3.5 cursor-pointer text-muted-foreground hover:text-primary' />
        ) : null}
      </div>
    </div>
  )
}

/** 可搜索国家选择（官方 el-select filterable，shadcn Combobox） */
function CountryCombobox({
  value,
  onValueChange,
  countries,
  placeholder,
}: {
  value: string
  onValueChange: (v: string) => void
  countries: CountryItem[]
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const selected = countries.find((c) => String(c.id) === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          role='combobox'
          aria-expanded={open}
          className='w-full justify-between font-normal'
        >
          <span className='truncate'>{selected?.name_zh ?? placeholder ?? '请选择'}</span>
          <ChevronsUpDown className='h-4 w-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-[--radix-popover-trigger-width] p-0' align='start'>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder='搜索国家'
            value={keyword}
            onValueChange={setKeyword}
          />
          <CommandList>
            {countries.length === 0 ? (
              <CommandEmpty>暂无国家数据</CommandEmpty>
            ) : (
              <CommandGroup>
                {countries
                  .filter((c) => {
                    const kw = keyword.trim().toLowerCase()
                    if (!kw) return true
                    return `${c.name_zh ?? ''} ${c.name ?? ''}`
                      .toLowerCase()
                      .includes(kw)
                  })
                  .map((c) => (
                    <CommandItem
                      key={c.id ?? c.name_zh}
                      value={String(c.id)}
                      onSelect={() => {
                        onValueChange(String(c.id))
                        setOpen(false)
                        setKeyword('')
                      }}
                    >
                      <Check
                        className={cn(
                          'h-4 w-4',
                          String(c.id) === value ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <span className='min-w-0 flex-1 truncate'>{c.name_zh}</span>
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

/** 自定义字段输入（官方 el-select/el-checkbox/el-input/textarea 对应） */
function CustomFieldInput({
  item,
  value,
  onChange,
  disabled,
}: {
  item: ClientCustomFieldItem
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const options = Array.isArray(item.options) ? item.options : []
  const input = (
    <Input
      placeholder={item.description}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  )
  switch (item.type) {
    case 'dropdown':
      return (
        <Select value={value} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder={item.description} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt, idx) => (
              <SelectItem key={idx} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    case 'tickbox':
      return (
        <div className='flex items-center gap-2'>
          <Checkbox
            checked={value === '1'}
            disabled={disabled}
            onCheckedChange={(c) => onChange(c ? '1' : '0')}
          />
          <span className='text-sm text-muted-foreground'>{item.description}</span>
        </div>
      )
    case 'textarea':
      return (
        <Textarea
          placeholder={item.description}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case 'link':
      return input
    case 'password':
      return <Input type='password' placeholder={item.description} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    default:
      return input
  }
}

const URL_RE = /^(((ht|f)tps?):\/\/)?([^!@#$%^&*?.s-]([^!@#$%^&*?.s]{0,63}[^!@#$%^&*?.s])?.)+[a-z]{2,6}\/?$/

export function ProfileTab({
  account,
  commonData,
  countryList,
  hasCustomFieldPlugin,
  hasCertificationPlugin,
  hasWxPlugin,
  submitWithSecurity,
  reloadAccount,
}: ProfileTabProps) {
  const navigate = useNavigate()
  const { t } = useClientLang()
  const { addons } = useAddons()

  // ---------- 表单状态 ----------
  const [username, setUsername] = useState('')
  const [language, setLanguage] = useState('')
  const [noticeOpen, setNoticeOpen] = useState<number>(0)
  const [noticeMethod, setNoticeMethod] = useState('')
  const [company, setCompany] = useState('')
  const [countryId, setCountryId] = useState('')
  const [address, setAddress] = useState('')
  const [originLanguage, setOriginLanguage] = useState('')
  const [saving, setSaving] = useState(false)

  // 自定义字段
  const [customFieldList, setCustomFieldList] = useState<ClientCustomFieldItem[]>([])
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({})
  const [customFieldErrors, setCustomFieldErrors] = useState<Record<string, string>>({})

  // 三方登录 / 微信
  const [oauthList, setOauthList] = useState<AccountOauthItem[]>([])
  const [wxInfo, setWxInfo] = useState<WxConectInfo>({})
  const [unbindTarget, setUnbindTarget] = useState<AccountOauthItem | null>(null)

  // 认证状态
  const [attestation, setAttestation] = useState<AttestationInfo | null>(null)
  const [attestationCompanyOpen, setAttestationCompanyOpen] = useState(0)
  const [certificationOpen, setCertificationOpen] = useState(0)

  // 弹窗状态
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [showCodeReset, setShowCodeReset] = useState(false)
  const [showOperatePassword, setShowOperatePassword] = useState(false)
  const [phoneEdit, setPhoneEdit] = useState<PhoneEditState>(initialPhoneEditState)
  const [emailEdit, setEmailEdit] = useState<EmailEditState>(initialEmailEditState)

  const prohibitChanges = useMemo(() => {
    const list = commonData?.prohibit_user_information_changes
    return Array.isArray(list) ? list.map((v) => String(v)) : []
  }, [commonData])

  const langList = useMemo(() => {
    const list = commonData?.lang_list
    return Array.isArray(list) ? list : []
  }, [commonData])

  const clientLevel = useMemo(() => {
    const cf = account?.customfield
    if (cf && typeof cf === 'object' && 'idcsmart_client_level' in cf) {
      const level = (cf as Record<string, unknown>).idcsmart_client_level as
        | { id?: string; name?: string; background_color?: string }
        | undefined
      if (level && typeof level === 'object' && level.id) return level
    }
    return undefined
  }, [account])

  const certificationPluginId = useMemo(
    () =>
      addons.find((a) => a.name.toLowerCase() === 'idcsmartcertification')?.id ?? null,
    [addons]
  )

  // 语言回退：账户未设置语言时用系统前台默认语言
  const homeLang =
    typeof commonData?.lang_home === 'string' ? commonData.lang_home : ''

  // 同步账户数据到表单（render-phase 状态调整，账户 refetch 后重建表单）
  const [syncedAccount, setSyncedAccount] = useState<AccountInfo | undefined>()
  if (account && account !== syncedAccount) {
    setSyncedAccount(account)
    setUsername(account.username ?? '')
    setLanguage(account.language ?? '')
    setNoticeOpen(account.notice_open ?? 0)
    setNoticeMethod(account.notice_method ?? '')
    setCompany(account.company ?? '')
    setCountryId(account.country_id != null ? String(account.country_id) : '')
    setAddress(account.address ?? '')
    setOriginLanguage(account.language || homeLang || '')
    setOauthList(account.oauth ?? [])
  }

  const effectiveLanguage = language || homeLang || ''

  // 获取自定义字段
  useEffect(() => {
    if (!hasCustomFieldPlugin) return
    let active = true
    fetchClientCustomFieldValue()
      .then((res) => {
        if (res.status !== 200 || !active) return
        const list = res.data.list ?? []
        const values: Record<string, string> = {}
        for (const item of list) {
          if (item.type === 'dropdown_text') {
            const parts = (item.value ?? '').split('|')
            values[String(item.id)] = parts[1] ?? ''
            item.select_select = parts[0] ?? ''
          } else {
            values[String(item.id)] = item.value ?? ''
          }
        }
        setCustomFieldList(list)
        setCustomFieldValues(values)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [hasCustomFieldPlugin])

  // 获取微信推送信息
  useEffect(() => {
    if (!hasWxPlugin) return
    fetchWxInfo()
      .then((res) => {
        if (res.status === 200) setWxInfo(res.data ?? {})
      })
      .catch(() => {})
  }, [hasWxPlugin])

  // 获取认证状态
  useEffect(() => {
    if (!hasCertificationPlugin) return
    let active = true
    fetchCertificationInfo()
      .then((res) => {
        const data = res.data ?? {}
        if (!active) return
        setCertificationOpen(Number(data.certification_open ?? 0))
        setAttestationCompanyOpen(Number(data.certification_company_open ?? 0))
        if (Number(data.certification_open ?? 0) === 0) {
          setAttestation(null)
          return
        }
        const companyStatus = data.company?.status
        const personStatus = data.person?.status
        if (
          !data.is_certification ||
          (companyStatus !== 1 && personStatus !== 1)
        ) {
          let status = 0
          if (companyStatus === 3 || companyStatus === 4) {
            status = 25
          } else if (personStatus === 3 || personStatus === 4) {
            status = 15
          } else if (companyStatus === 2) {
            status = 40
          } else if (personStatus === 2) {
            status = 45
          }
          setAttestation({
            status,
            iconUrl: unauthorizedImg,
            text: t('account_tips12', '未认证'),
          })
          return
        }
        if (companyStatus === 1) {
          setAttestation({
            status: personStatus === 1 ? 30 : 20,
            iconUrl: enterpriseImg,
            text: t('account_tips13', '企业认证'),
          })
          return
        }
        if (personStatus === 1) {
          let status = 10
          if (companyStatus === 1) status = 30
          else if (companyStatus === 2 || companyStatus === 3) status = 26
          setAttestation({
            status,
            iconUrl: personalImg,
            text: t('account_tips14', '个人认证'),
          })
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCertificationPlugin])

  // ---------- 保存 ----------
  function validateCustomFields(): boolean {
    const errors: Record<string, string> = {}
    for (const item of customFieldList) {
      const required = item.required === 1 || item.before_settle === 1
      const value = customFieldValues[String(item.id)] ?? ''
      if (required && value === '') {
        errors[String(item.id)] = t('custom_goods_text1', '必填')
        continue
      }
      if (item.type === 'link' && value !== '' && !URL_RE.test(value)) {
        errors[String(item.id)] = t('custom_goods_text2', '格式错误')
        continue
      }
      if (item.type !== 'dropdown' && item.type !== 'tickbox' && item.regexpr && value !== '') {
        const src = item.regexpr.replace(/^\/|\/$/g, '')
        try {
          if (!new RegExp(src).test(value)) {
            errors[String(item.id)] = t('custom_goods_text2', '格式错误')
          }
        } catch {
          // 非法正则忽略
        }
      }
    }
    setCustomFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSave() {
    if (!account) return
    if (!validateCustomFields()) return
    setSaving(true)
    try {
      const addonClientCustomField: Record<string, string> = { ...customFieldValues }
      for (const item of customFieldList) {
        if (item.type === 'dropdown_text') {
          addonClientCustomField[String(item.id)] = `${item.select_select ?? ''}|${
            customFieldValues[String(item.id)] ?? ''
          }`
        }
      }
      const params = {
        ...account,
        username,
        company,
        country_id: countryId ? Number(countryId) : 0,
        address,
        language: effectiveLanguage,
        notice_open: noticeOpen,
        // 关闭通知时不传 notice_method（后端 require 校验非空）
        ...(noticeOpen === 1 ? { notice_method: noticeMethod } : {}),
        customfield: {
          addon_client_custom_field: addonClientCustomField,
        },
      }
      const res = await updateAccount(params)
      if (res.status === 200) {
        toast.success(res.msg || t('success_message', '提交成功'))
        if (originLanguage !== effectiveLanguage) {
          localStorage.setItem('lang', effectiveLanguage)
          sessionStorage.setItem('brow_lang', effectiveLanguage)
          window.location.reload()
          return
        }
        reloadAccount()
      } else {
        toast.error(res.msg)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  // ---------- 三方登录 ----------
  async function handleBindOauth(item: AccountOauthItem) {
    try {
      const res = await fetchOauthUrl(item.name ?? '')
      if (res.status !== 200) {
        toast.error(res.msg)
        return
      }
      const openWindow = window.open(res.data.url, 'oauth', 'width=800,height=800')
      if (!openWindow) {
        toast.error(t('jump_tip2', '请允许浏览器弹窗后重试'))
        return
      }
      const timer = setInterval(() => {
        if (openWindow.closed) {
          clearInterval(timer)
          reloadAccount()
        }
      }, 300)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function handleUnbindOauth() {
    if (!unbindTarget?.name) return
    try {
      const res = await cancelOauth(unbindTarget.name)
      if (res.status === 200) {
        toast.success(res.msg)
      } else {
        toast.error(res.msg)
      }
      setUnbindTarget(null)
      reloadAccount()
    } catch (error) {
      toast.error(getErrorMessage(error))
      setUnbindTarget(null)
    }
  }

  // ---------- 微信推送 ----------
  async function handleWxPushChange(checked: boolean) {
    const prev = wxInfo.accept_push
    setWxInfo((s) => ({ ...s, accept_push: checked ? 1 : 0 }))
    try {
      const res = await changeWxPushStatus({ status: checked ? 1 : 0 })
      if (res.status !== 200) {
        setWxInfo((s) => ({ ...s, accept_push: prev }))
        toast.error(res.msg)
      }
    } catch (error) {
      setWxInfo((s) => ({ ...s, accept_push: prev }))
      toast.error(getErrorMessage(error))
    }
  }

  // ---------- 认证跳转 ----------
  function handleAttestationClick() {
    if (!attestation || !certificationPluginId) return
    const status = attestation.status
    let url = ''
    if (status === 0) {
      url = `/plugin/${certificationPluginId}/authentication_select.htm`
    } else if ([20, 25, 26, 30, 40].includes(status)) {
      url = `/plugin/${certificationPluginId}/authentication_status.htm?type=2`
    } else if ([15, 45].includes(status)) {
      url = `/plugin/${certificationPluginId}/authentication_status.htm?type=1`
    } else if (status === 10 && attestationCompanyOpen === 1) {
      url = `/plugin/${certificationPluginId}/authentication_status.htm?type=3`
    }
    // SPA 内跳转（pluginRoute 动态段命中实名认证页面），避免整页刷新落到官方 Vue 插件模板
    if (url) navigate({ href: url })
  }

  const canEditPhone =
    !prohibitChanges.includes('phone') || account?.phone == null || account.phone === ''
  const canEditEmail =
    !prohibitChanges.includes('email') || account?.email == null || account.email === ''
  const canEditPassword = !prohibitChanges.includes('password')
  const canEditOperatePassword = !prohibitChanges.includes('operate_password')

  const oauthShowList = oauthList.map((item) => ({
    ...item,
    showStatus: item.link ? t('oauth_text6', '已关联') : t('oauth_text7', '未关联'),
  }))

  return (
    <Card className='p-5 sm:p-6'>
      {/* 头部：用户名 / 等级 / 国家 / 认证状态 */}
      <div className='flex flex-wrap items-center justify-between gap-3 border-b pb-5'>
        <div className='flex items-center gap-3'>
          <div>
            <div className='text-2xl font-bold text-foreground'>
              {username || '--'}
              {clientLevel ? (
                <span
                  className='ml-2 text-sm font-medium'
                  style={{ color: clientLevel.background_color || undefined }}
                >
                  ({clientLevel.name})
                </span>
              ) : null}
            </div>
          </div>
        </div>
        {certificationOpen === 1 && attestation ? (
          <button
            type='button'
            onClick={handleAttestationClick}
            className='inline-flex cursor-pointer items-center gap-2 text-sm text-foreground'
          >
            <img src={attestation.iconUrl} alt='' className='h-6 w-6' />
            {[0, 10, 15, 20, 25, 26, 30, 40, 45].includes(attestation.status) ? (
              <span>
                {attestation.status === 0 || attestation.status === 15 || attestation.status === 45
                  ? t('account_tips20', '未认证，前往')
                  : attestation.status === 10 || attestation.status === 26
                    ? t('account_tips22', '个人认证已完成，前往')
                    : t('account_tips24', '实名认证已完成')}
              </span>
            ) : null}
            {attestation.status !== 24 && attestation.status !== 30 ? (
              <span className='inline-flex items-center text-primary'>
                {attestation.status === 20 || attestation.status === 40
                  ? t('account_tips23', '企业认证')
                  : attestation.status === 0 || attestation.status === 15 || attestation.status === 45
                    ? t('account_tips21', '实名认证')
                    : t('account_tips23', '企业认证')}
                <ChevronRight className='ml-0.5 h-3.5 w-3.5' />
              </span>
            ) : (
              <BadgeCheck className='h-4 w-4 text-primary' />
            )}
          </button>
        ) : certificationOpen === 1 && !attestation ? (
          <Skeleton className='h-6 w-40' />
        ) : null}
      </div>

      {/* 基础资料 */}
      <div className='mt-8'>
        <SectionTitle>{t('account_menu3', '基础资料')}</SectionTitle>
        <div className='mt-6 grid gap-5 sm:grid-cols-3'>
          <div>
            <FieldLabel>{t('account_label1', '姓名')}</FieldLabel>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <FieldLabel>{t('account_label2', '语言')}</FieldLabel>
            <Select
              value={effectiveLanguage}
              onValueChange={setLanguage}
              disabled={Number(commonData?.lang_home_open ?? 1) === 0}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {langList.map((item: Record<string, unknown>, index: number) => (
                  <SelectItem
                    key={`${item.display_flag}-${index}`}
                    value={String(item.display_lang ?? '')}
                  >
                    {String(item.display_name ?? item.display_lang)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className='mb-2 flex h-5 items-center justify-between'>
              <span className='text-[13px] font-medium text-muted-foreground'>
                {t('account_tips_text9', '是否接收定时通知')}
              </span>
              <Switch
                checked={noticeOpen === 1}
                onCheckedChange={(c) => {
                  setNoticeOpen(c ? 1 : 0)
                  if (c && !noticeMethod) setNoticeMethod('all')
                }}
              />
            </div>
            <Select
              value={noticeMethod}
              onValueChange={setNoticeMethod}
              disabled={noticeOpen === 0}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>{t('account_tips_text12', '全部')}</SelectItem>
                <SelectItem value='email'>{t('account_tips_text11', '邮件')}</SelectItem>
                <SelectItem value='sms'>{t('account_tips_text10', '短信')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className='mt-5 grid gap-5 sm:grid-cols-3'>
          <div>
            <FieldLabel>{t('account_label3', '公司')}</FieldLabel>
            <Input value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>
          <div>
            <FieldLabel>{t('account_label4', '国家')}</FieldLabel>
            <CountryCombobox
              value={countryId}
              onValueChange={setCountryId}
              countries={countryList}
              placeholder={t('placeholder_pre2', '请选择')}
            />
          </div>
          <div>
            <FieldLabel>{t('account_label5', '地址')}</FieldLabel>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
        </div>
      </div>

      {/* 账户信息 */}
      <div className='mt-10'>
        <SectionTitle>{t('account_menu4', '账户信息')}</SectionTitle>
        <div className='mt-6 grid gap-5 sm:grid-cols-3'>
          <ReadonlyRow
            label={t('account_label6', '手机')}
            value={account?.phone ? `+${account.phone_code ?? ''} ${account.phone}` : ''}
            canEdit={canEditPhone}
            onEdit={() => {
              if (account?.phone) {
                setPhoneEdit((s) => ({ ...s, code: '', errorText: '', verifyOpen: true }))
              } else {
                setPhoneEdit((s) => ({ ...s, code: '', errorText: '', changeOpen: true }))
              }
            }}
          />
          <ReadonlyRow
            label={t('account_label7', '邮箱')}
            value={account?.email ?? ''}
            canEdit={canEditEmail}
            onEdit={() => {
              if (account?.email) {
                setEmailEdit((s) => ({ ...s, code: '', errorText: '', verifyOpen: true }))
              } else {
                setEmailEdit((s) => ({ ...s, code: '', errorText: '', changeOpen: true }))
              }
            }}
          />
          <ReadonlyRow
            label={t('account_label8', '密码')}
            value=''
            isPassword
            canEdit={canEditPassword}
            onEdit={() => setShowChangePassword(true)}
          />
        </div>
        <div className='mt-5 grid gap-5 sm:grid-cols-3'>
          <ReadonlyRow
            label={t('account_tips_text3', '操作密码')}
            value={account?.set_operate_password ? '********' : ''}
            canEdit={canEditOperatePassword}
            onEdit={() => setShowOperatePassword(true)}
          />
        </div>
      </div>

      {/* 自定义字段（ClientCustomField 插件） */}
      {hasCustomFieldPlugin && customFieldList.length > 0 ? (
        <div className='mt-8'>
          <div className='mt-6 grid gap-5 sm:grid-cols-3'>
            {customFieldList.map((item) => {
              const disabled = Boolean(
                item.value && prohibitChanges.includes(String(item.id))
              )
              return (
                <div key={item.id}>
                  <FieldLabel>
                    {item.name}
                    {(item.required === 1 || item.before_settle === 1) ? (
                      <span className='ml-0.5 text-red-600'>*</span>
                    ) : null}
                  </FieldLabel>
                  <CustomFieldInput
                    item={item}
                    value={customFieldValues[String(item.id)] ?? ''}
                    disabled={disabled}
                    onChange={(v) =>
                      setCustomFieldValues((s) => ({ ...s, [String(item.id)]: v }))
                    }
                  />
                  {customFieldErrors[String(item.id)] ? (
                    <p className='mt-1 text-xs text-red-600'>
                      {customFieldErrors[String(item.id)]}
                    </p>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {/* 三方登录 */}
      {oauthShowList.length > 0 ? (
        <div className='mt-10'>
          <SectionTitle>{t('oauth_text5', '三方登录')}</SectionTitle>
          <div className='mt-6 grid gap-5 sm:grid-cols-3'>
            {oauthShowList.map((item) => (
              <div key={item.name ?? item.title}>
                <FieldLabel>{item.title}</FieldLabel>
                <div className='flex items-center justify-between border-b border-border py-2'>
                  <span className='text-sm text-muted-foreground'>{item.showStatus}</span>
                  {item.link ? (
                    <button
                      type='button'
                      className='text-sm text-primary hover:underline'
                      onClick={() => setUnbindTarget(item)}
                    >
                      {t('oauth_text9', '取消关联')}
                    </button>
                  ) : (
                    <button
                      type='button'
                      className='text-sm text-primary hover:underline'
                      onClick={() => handleBindOauth(item)}
                    >
                      {t('oauth_text8', '关联')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* 微信推送（MpWeixinNotice 插件） */}
      {hasWxPlugin && wxInfo.is_subscribe === 1 ? (
        <div className='mt-10'>
          <SectionTitle>{t('wx_tip2', '微信公众号消息推送')}</SectionTitle>
          <div className='mt-6 flex items-center justify-between'>
            <span className='text-[13px] font-medium text-muted-foreground'>
              {t('wx_tip3', '允许公众号消息推送')}
            </span>
            <Switch
              checked={wxInfo.accept_push === 1}
              onCheckedChange={handleWxPushChange}
            />
          </div>
        </div>
      ) : null}

      {/* 保存 */}
      <div className='mt-10 flex justify-start'>
        <Button onClick={handleSave} disabled={saving || !account}>
          {saving ? <Loader2 className='animate-spin' /> : null}
          {t('account_btn1', '保存')}
        </Button>
      </div>

      {/* 弹窗们 */}
      <ChangePasswordDialog
        open={showChangePassword}
        onOpenChange={setShowChangePassword}
        submitWithSecurity={submitWithSecurity}
        onSwitchToCode={() => {
          setShowChangePassword(false)
          setShowCodeReset(true)
        }}
      />
      <CodeResetPasswordDialog
        open={showCodeReset}
        onOpenChange={setShowCodeReset}
        accountData={account ?? {}}
        submitWithSecurity={submitWithSecurity}
      />
      <OperatePasswordDialog
        open={showOperatePassword}
        onOpenChange={setShowOperatePassword}
        hasOperatePassword={account?.set_operate_password ?? false}
        submitWithSecurity={submitWithSecurity}
        onSuccess={reloadAccount}
      />
      <VerifyPhoneDialog
        state={phoneEdit}
        setState={setPhoneEdit}
        accountData={account ?? {}}
        onVerified={() =>
          setPhoneEdit((s) => ({ ...s, code: '', errorText: '', changeOpen: true }))
        }
      />
      <RePhoneDialog
        state={phoneEdit}
        setState={setPhoneEdit}
        countryList={countryList}
        onSuccess={reloadAccount}
      />
      <VerifyEmailDialog
        state={emailEdit}
        setState={setEmailEdit}
        accountData={account ?? {}}
        onVerified={() =>
          setEmailEdit((s) => ({ ...s, code: '', errorText: '', changeOpen: true }))
        }
      />
      <ReEmailDialog state={emailEdit} setState={setEmailEdit} onSuccess={reloadAccount} />

      {/* 取消关联确认 */}
      <AlertDialog open={unbindTarget !== null} onOpenChange={(v) => !v && setUnbindTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('oauth_text10', '确定取消关联?')}</AlertDialogTitle>
            <AlertDialogDescription>{unbindTarget?.title}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('account_btn3', '取消')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnbindOauth}>
              {t('finance_btn8', '确认')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
