import { useEffect, useRef, useState } from 'react'
import { Loader2, UserPlus } from 'lucide-react'
import {
  fetchRegistCustomField,
  register,
  sendEmailCode,
  sendPhoneCode,
  type ClientCustomFieldItem,
  type CountryItem,
} from '@/api'
import { ApiError } from '@/lib/api'
import { useClientLang } from '@/hooks/use-client-lang'
import { useAuthStore } from '@/stores/auth-store'
import { installedAddons } from '@/lib/addons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PasswordInput } from '@/components/password-input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  CountdownButton,
  type CountdownButtonHandle,
} from '@/components/countdown-button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PhoneCodeInput } from '../../components/phone-code-input'
import { CaptchaDialog } from '../../components/captcha-dialog'
import {
  asBool,
  afterLogin,
  checkStrongPassword,
  type AuthCommonConfig,
} from '../../auth-common'

const EMAIL_RE = /^\w+((-\w+)|(\.\w+))*@[A-Za-z0-9]+((\.|-)[A-Za-z0-9]+)*\.[A-Za-z0-9]+$/
const CODE_RE = /^\d+$/

function fieldOptions(item: ClientCustomFieldItem): string[] {
  const options = item.options as unknown as string[] | string | undefined
  if (Array.isArray(options)) return options
  if (typeof options === 'string' && options) return options.split(',')
  return []
}

interface SignUpFormProps {
  common?: AuthCommonConfig
  countryList: CountryItem[]
}

export function SignUpForm({ common, countryList }: SignUpFormProps) {
  const { t } = useClientLang()

  // 官方 getCommonSetting：注册方式优先级 phone→email（两者都开时 email 胜出）
  const [isEmailOrPhone, setIsEmailOrPhone] = useState(() => {
    if (asBool(common?.register_phone)) return false
    if (asBool(common?.register_email)) return true
    return true
  })
  // URL 携带销售编号直接勾选并填充
  const initialSale = (() => {
    const saleNo = new URLSearchParams(window.location.search).get('sale_number')
    return saleNo
      ? { checked1: true, saleNumber: saleNo }
      : { checked1: false, saleNumber: '' }
  })()
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [phoneCode, setPhoneCode] = useState('')
  const [password, setPassword] = useState('')
  const [rePassword, setRePassword] = useState('')
  const [countryCode, setCountryCode] = useState('86')
  const [checked, setChecked] = useState(false)
  const [checked1, setChecked1] = useState(initialSale.checked1)
  const [saleNumber, setSaleNumber] = useState(initialSale.saleNumber)
  const [errorText, setErrorText] = useState('')
  const [registering, setRegistering] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [codeLoading, setCodeLoading] = useState(false)

  // 图形验证码
  const [showCaptcha, setShowCaptcha] = useState(false)
  // captcha/captchaToken 用 ref 存，供 CaptchaDialog onSuccess 同步调用的 sendCode 读取
  const captchaRef = useRef('')
  const captchaTokenRef = useRef('')
  const codeActionRef = useRef<'email' | 'phone'>('email')
  const codeBtnRef = useRef<CountdownButtonHandle>(null)

  // 用户自定义字段（ClientCustomField 插件）
  const [customFieldList, setCustomFieldList] = useState<
    ClientCustomFieldItem[]
  >([])
  const [ruleForm, setRuleForm] = useState<Record<string, string>>({})

  const commonRef = useRef(common)
  commonRef.current = common

  const hasCustomFieldPlugin = installedAddons().some((n) =>
    n.toLowerCase() === 'clientcustomfield'
  )
  const hasSalePlugin = installedAddons().some(
    (n) => n.toLowerCase() === 'idcsmartsale'
  )
  const saleConfig = (common?.plugin_configuration?.['idcsmart_sale'] ??
    {}) as Record<string, unknown>
  const showSale = hasSalePlugin && saleConfig.register_hide_sale == 0
  const registerSelectSale = saleConfig.register_select_sale
  const salesList = Array.isArray(saleConfig.sales)
    ? (saleConfig.sales as Array<{ name?: string; sale_number?: string }>)
    : []

  // 加载注册自定义字段（插件未安装时静默跳过）
  useEffect(() => {
    if (!hasCustomFieldPlugin) return
    let cancelled = false
    fetchRegistCustomField()
      .then((res) => {
        if (cancelled || res.status !== 200) return
        const list = res.data.list ?? []
        const obj: Record<string, string> = {}
        list.forEach((item) => {
          const key = String(item.id)
          obj[key] = item.type === 'tickbox' ? '0' : ''
          if (item.type === 'dropdown_text') {
            item.select_select = fieldOptions(item)[0] ?? ''
          }
        })
        setCustomFieldList(list)
        setRuleForm(obj)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [hasCustomFieldPlugin])

  const showStrongPasswordRule = asBool(common?.client_strong_password_rule)
  const passwordStatus = checkStrongPassword(password)

  function changeType(flag: boolean) {
    setIsEmailOrPhone(flag)
    resetCaptcha()
  }

  function resetCaptcha() {
    captchaRef.current = ''
    captchaTokenRef.current = ''
  }

  async function sendCode() {
    if (codeLoading) return false
    if (isEmailOrPhone) {
      if (!email) {
        setErrorText(t('login_text1', '请输入邮箱'))
        return false
      }
      if (!EMAIL_RE.test(email)) {
        setErrorText(t('login_text2', '邮箱格式不正确'))
        return false
      }
      if (asBool(common?.captcha_client_register) && !captchaRef.current) {
        codeActionRef.current = 'email'
        setShowCaptcha(true)
        return false
      }
      setErrorText('')
      setCodeLoading(true)
      try {
        const res = await sendEmailCode({
          action: 'register',
          email,
          token: captchaTokenRef.current,
          captcha: captchaRef.current,
        })
        if (res.status !== 200) {
          throw new ApiError(res.msg, res.status, res.data)
        }
        return true
      } catch (e) {
        setErrorText(e instanceof ApiError ? e.msg : '发送失败')
        resetCaptcha()
        return false
      } finally {
        setCodeLoading(false)
      }
    }
    if (!phone) {
      setErrorText(t('login_text6', '请输入手机号码'))
      return false
    }
    if (countryCode === '86' && !CODE_RE.test(phone)) {
      setErrorText(t('login_text7', '请输入正确的手机号'))
      return false
    }
    if (asBool(common?.captcha_client_register) && !captchaRef.current) {
      codeActionRef.current = 'phone'
      setShowCaptcha(true)
      return false
    }
    setErrorText('')
    setCodeLoading(true)
    try {
      const res = await sendPhoneCode({
        action: 'register',
        phone_code: countryCode,
        phone,
        token: captchaTokenRef.current,
        captcha: captchaRef.current,
      })
      if (res.status !== 200) {
        throw new ApiError(res.msg, res.status, res.data)
      }
      return true
    } catch (e) {
      setErrorText(e instanceof ApiError ? e.msg : '发送失败')
      resetCaptcha()
      return false
    } finally {
      setCodeLoading(false)
    }
  }

  function onCaptchaSuccess(code: string, token: string) {
    captchaRef.current = code
    captchaTokenRef.current = token
    setShowCaptcha(false)
    void sendCode().then((ok) => {
      if (ok === true) codeBtnRef.current?.startCountdown()
    })
  }

  function validateCustomFields(): string {
    for (const item of customFieldList) {
      const key = String(item.id)
      const value = ruleForm[key] ?? ''
      if (item.required === 1 && value === '') {
        return t('custom_goods_text1', '此项为必填项')
      }
      if (value !== '' && item.regexpr) {
        const pattern = item.regexpr.replace(/^\/|\/$/g, '')
        try {
          if (!new RegExp(pattern).test(value)) {
            return t('custom_goods_text2', '格式不正确')
          }
        } catch {
          // 非法正则跳过
        }
      }
    }
    return ''
  }

  async function doRegist() {
    let isPass = true
    let err = ''

    if (checked1 && !saleNumber) {
      err = t('account_tips53', '请输入销售编号')
      isPass = false
    }
    if (!checked) {
      err = t('account_tips51', '请阅读并同意服务协议')
      isPass = false
    }
    if (!password) {
      err = t('account_tips47', '请输入密码')
      isPass = false
    } else if (password.length > 32 || password.length < 6) {
      err = t('account_tips52', '密码长度应为6-32位')
      isPass = false
    } else if (showStrongPasswordRule && !passwordStatus.valid) {
      err = t('password_strong_rule_error', '密码不满足强密码规则')
      isPass = false
    }
    if (!rePassword) {
      err = t('account_tips48', '请再次输入密码')
      isPass = false
    } else if (password !== rePassword) {
      err = t('account_tips49', '两次输入的密码不一致')
      isPass = false
    }
    if (isEmailOrPhone) {
      if (!email) {
        err = t('login_text1', '请输入邮箱')
        isPass = false
      } else if (!EMAIL_RE.test(email)) {
        err = t('login_text2', '邮箱格式不正确')
        isPass = false
      }
      if (asBool(common?.code_client_email_register)) {
        if (!emailCode) {
          err = t('login_text4', '请输入邮箱验证码')
          isPass = false
        } else if (emailCode.length !== 6) {
          err = t('login_text5', '邮箱验证码应为6位')
          isPass = false
        }
      }
    } else {
      if (!phone) {
        err = t('login_text6', '请输入手机号码')
        isPass = false
      } else if (countryCode === '86' && !CODE_RE.test(phone)) {
        err = t('login_text7', '请输入正确的手机号')
        isPass = false
      }
      if (asBool(common?.code_client_phone_register)) {
        if (!phoneCode) {
          err = t('account_tips45', '请输入手机验证码')
          isPass = false
        } else if (phoneCode.length !== 6) {
          err = t('account_tips46', '手机验证码应为6位')
          isPass = false
        }
      }
    }
    const customFieldErr = validateCustomFields()
    if (customFieldErr) {
      err = customFieldErr
      isPass = false
    }

    if (!isPass) {
      setErrorText(err)
      return
    }

    setErrorText('')
    setRegistering(true)
    try {
      const code = isEmailOrPhone ? emailCode : phoneCode
      const params: Parameters<typeof register>[0] = {
        type: isEmailOrPhone ? 'email' : 'phone',
        account: isEmailOrPhone ? email.trim() : phone.trim(),
        phone_code: countryCode.toString(),
        code,
        username: '',
        password,
        re_password: rePassword,
        customfield: {},
      }
      if (checked1 && saleNumber) {
        params.customfield!.sale_number = saleNumber
      }
      if (customFieldList.length > 0) {
        const addon = { ...ruleForm }
        customFieldList.forEach((item) => {
          if (item.type === 'dropdown_text') {
            addon[String(item.id)] =
              (item.select_select ?? '') + '|' + (ruleForm[String(item.id)] ?? '')
          }
        })
        params.customfield!.addon_client_custom_field = addon
      }
      const res = await register(params)
      if (res.status !== 200) {
        throw new ApiError(res.msg, res.status, res.data)
      }
      useAuthStore.getState().auth.setAccessToken(res.data.jwt)
      await afterLogin(commonRef.current)
    } catch (e) {
      setErrorText(e instanceof ApiError ? e.msg : '注册失败')
    } finally {
      setRegistering(false)
    }
  }

  const emailTabShow = asBool(common?.register_email)
  const phoneTabShow = asBool(common?.register_phone)
  const registerOpen = emailTabShow || phoneTabShow

  if (!registerOpen) {
    return (
      <p className='text-sm text-muted-foreground'>注册功能暂未开启</p>
    )
  }

  return (
    <div className='grid gap-4'>
      <div className='grid gap-3'>
        {/* 注册方式切换 */}
        {(emailTabShow || phoneTabShow) && (
          <div className='flex border-b text-sm'>
            {emailTabShow && (
              <button
                type='button'
                className={`border-b-2 px-4 py-2 ${isEmailOrPhone ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground'}`}
                onClick={() => changeType(true)}
              >
                {t('login_email', '邮箱')}
              </button>
            )}
            {phoneTabShow && (
              <button
                type='button'
                className={`border-b-2 px-4 py-2 ${!isEmailOrPhone ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground'}`}
                onClick={() => changeType(false)}
              >
                {t('login_phone', '手机号')}
              </button>
            )}
          </div>
        )}

        {isEmailOrPhone ? (
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('login_email', '邮箱')}
            autoComplete='username'
          />
        ) : (
          <PhoneCodeInput
            value={phone}
            onChange={setPhone}
            countryCode={countryCode}
            onCountryCodeChange={setCountryCode}
            countryList={countryList}
            placeholder={t('login_phone', '手机号')}
            autoComplete='username'
          />
        )}

        {(asBool(common?.code_client_email_register) && isEmailOrPhone) ||
        (asBool(common?.code_client_phone_register) && !isEmailOrPhone) ? (
          <div className='flex gap-2'>
            <Input
              value={isEmailOrPhone ? emailCode : phoneCode}
              onChange={(e) =>
                isEmailOrPhone
                  ? setEmailCode(e.target.value)
                  : setPhoneCode(e.target.value)
              }
              placeholder={
                isEmailOrPhone
                  ? t('email_code', '邮箱验证码')
                  : t('login_phone_code', '手机验证码')
              }
              inputMode='numeric'
              maxLength={6}
            />
            <CountdownButton
              ref={codeBtnRef}
              loading={codeLoading}
              onSend={sendCode}
            />
          </div>
        ) : null}

        <div className='relative'>
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('tip1', '请输入密码')}
            autoComplete='new-password'
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
          />
          {showStrongPasswordRule && passwordFocused && password && (
            <div className='absolute inset-x-0 top-full z-10 mt-1 rounded-md border bg-background p-3 text-sm shadow-md'>
              <p className='mb-1 font-medium'>{t('password_rule_title', '密码需满足以下要求：')}</p>
              <ul className='space-y-1 text-xs'>
                <li className={passwordStatus.length ? 'text-emerald-600' : 'text-muted-foreground'}>
                  {passwordStatus.length ? '✓' : '○'} {t('password_rule_length', '至少 8 个字符')}
                </li>
                <li className={passwordStatus.composition ? 'text-emerald-600' : 'text-muted-foreground'}>
                  {passwordStatus.composition ? '✓' : '○'} {t('password_rule_composition', '需同时包含数字、字母以及特殊符号')}
                </li>
                <li className={passwordStatus.sequence ? 'text-emerald-600' : 'text-muted-foreground'}>
                  {passwordStatus.sequence ? '✓' : '○'} {t('password_rule_sequence', '不使用连续或重复字符')}
                </li>
              </ul>
            </div>
          )}
        </div>
        <PasswordInput
          value={rePassword}
          onChange={(e) => setRePassword(e.target.value)}
          placeholder={t('tip2', '请再次输入密码')}
          autoComplete='new-password'
        />

        {/* 用户自定义字段 */}
        {customFieldList.map((item) => {
          const key = String(item.id)
          const value = ruleForm[key] ?? ''
          const options = fieldOptions(item)
          return (
            <div key={item.id} className='grid gap-1.5'>
              <label className='text-sm font-medium'>
                {item.name}
                {item.required === 1 && <span className='text-destructive'> *</span>}
              </label>
              {item.type === 'dropdown' && (
                <Select
                  value={value}
                  onValueChange={(v) =>
                    setRuleForm((prev) => ({ ...prev, [key]: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={item.description || item.name} />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {item.type === 'tickbox' && (
                <div className='flex items-center gap-2'>
                  <Checkbox
                    checked={value === '1'}
                    onCheckedChange={(c) =>
                      setRuleForm((prev) => ({
                        ...prev,
                        [key]: c ? '1' : '0',
                      }))
                    }
                    id={`cf-${item.id}`}
                  />
                  <label htmlFor={`cf-${item.id}`} className='text-sm'>
                    {item.description || item.name}
                  </label>
                </div>
              )}
              {item.type === 'dropdown_text' && (
                <div className='flex gap-0 overflow-hidden rounded-md border'>
                  <Select
                    value={item.select_select ?? ''}
                    onValueChange={(v) => {
                      const next = customFieldList.map((x) =>
                        x.id === item.id ? { ...x, select_select: v } : x
                      )
                      setCustomFieldList(next)
                    }}
                  >
                    <SelectTrigger className='w-28 rounded-none border-0 bg-muted/50'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className='rounded-none border-0 shadow-none focus-visible:ring-0'
                    value={value}
                    onChange={(e) =>
                      setRuleForm((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    placeholder={item.description || item.name}
                  />
                </div>
              )}
              {item.type === 'textarea' && (
                <Textarea
                  value={value}
                  onChange={(e) =>
                    setRuleForm((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  placeholder={item.description || item.name}
                />
              )}
              {!['dropdown', 'tickbox', 'dropdown_text', 'textarea'].includes(
                item.type ?? ''
              ) && (
                <Input
                  value={value}
                  onChange={(e) =>
                    setRuleForm((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  placeholder={item.description || item.name}
                />
              )}
            </div>
          )
        })}

        {/* 销售编号（IdcsmartSale 插件） */}
        {showSale && (
          <div className='grid gap-2'>
            <div className='flex items-center gap-2'>
              <Checkbox
                checked={checked1}
                onCheckedChange={(c) => setChecked1(Boolean(c))}
                id='sale-agree'
              />
              <label htmlFor='sale-agree' className='text-sm'>
                {t('tip4', '我有销售编号')}
              </label>
            </div>
            {checked1 &&
              (registerSelectSale == 1 ? (
                <Select value={saleNumber} onValueChange={setSaleNumber}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('tip5', '请选择销售')} />
                  </SelectTrigger>
                  <SelectContent>
                    {salesList.map((s) => (
                      <SelectItem key={s.sale_number} value={String(s.sale_number)}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={saleNumber}
                  onChange={(e) => setSaleNumber(e.target.value)}
                  placeholder={t('tip5', '请输入销售编号')}
                />
              ))}
          </div>
        )}

        {/* 协议 */}
        <div
          className='flex cursor-pointer items-start gap-1.5 text-sm leading-relaxed text-muted-foreground'
          onClick={() => setChecked((v) => !v)}
        >
          <Checkbox
            checked={checked}
            onCheckedChange={(c) => setChecked(Boolean(c))}
            onClick={(e) => e.stopPropagation()}
            className='mt-[3px] shrink-0'
          />
          <span className='min-w-0'>
            {t('tip3', '阅读并同意')}
            <a
              className='text-primary underline underline-offset-4'
              onClick={(e) => {
                e.preventDefault()
                window.open(common?.terms_service_url, '_blank')
              }}
            >
              {t('read_service', '《服务协议》')}
            </a>
            {t('read_and', '和')}
            <a
              className='text-primary underline underline-offset-4'
              onClick={(e) => {
                e.preventDefault()
                window.open(common?.terms_privacy_url, '_blank')
              }}
            >
              {t('read_privacy', '《隐私协议》')}
            </a>
          </span>
        </div>

        {errorText && (
          <p className='rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive'>
            {errorText}
          </p>
        )}

        <Button onClick={doRegist} disabled={registering}>
          {registering ? <Loader2 className='animate-spin' /> : <UserPlus />}
          注册
        </Button>
      </div>

      <CaptchaDialog
        open={showCaptcha}
        onSuccess={onCaptchaSuccess}
        onClose={() => setShowCaptcha(false)}
      />
    </div>
  )
}
