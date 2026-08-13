import { useRef, useState } from 'react'
import {
  forgetPass,
  login,
  sendEmailCode,
  sendPhoneCode,
  type CountryItem,
} from '@/api'
import { Loader2, LockKeyhole } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { ApiError } from '@/lib/api'
import { encryptPassword } from '@/lib/crypto'
import { useClientLang } from '@/hooks/use-client-lang'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  CountdownButton,
  type CountdownButtonHandle,
} from '@/components/countdown-button'
import { PasswordInput } from '@/components/password-input'
import {
  asBool,
  afterLogin,
  checkStrongPassword,
  computeCaptchaRequired,
  type AuthCommonConfig,
} from '../../auth-common'
import { CaptchaDialog } from '../../components/captcha-dialog'
import { PhoneCodeInput } from '../../components/phone-code-input'

const EMAIL_RE =
  /^\w+((-\w+)|(\.\w+))*@[A-Za-z0-9]+((\.|-)[A-Za-z0-9]+)*\.[A-Za-z0-9]+$/
const CODE_RE = /^\d+$/

interface ForgetPasswordFormProps {
  common?: AuthCommonConfig
  countryList: CountryItem[]
}

/**
 * 忘记密码表单（官方 forget.php/forget.js 的 React 实现）。
 * - 邮箱/手机号 Tab 切换，验证码 action=password_reset；
 * - captcha_client_password_reset 开启时发送验证码前需过图形验证码；
 * - client_strong_password_rule 开启时展示强密码规则；
 * - 重置成功后自动登录（官方 handelLogin 行为）。
 */
export function ForgetPasswordForm({
  common,
  countryList,
}: ForgetPasswordFormProps) {
  const { t } = useClientLang()

  const [isEmailOrPhone, setIsEmailOrPhone] = useState(true)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [phoneCode, setPhoneCode] = useState('')
  const [password, setPassword] = useState('')
  const [rePassword, setRePassword] = useState('')
  const [countryCode, setCountryCode] = useState('86')
  const [checked, setChecked] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [resetting, setResetting] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [codeLoading, setCodeLoading] = useState(false)

  // 图形验证码（发送重置验证码或重置后自动登录被要求时）
  const [showCaptcha, setShowCaptcha] = useState(false)
  const captchaRef = useRef('')
  const captchaTokenRef = useRef('')
  const codeActionRef = useRef<'email' | 'phone' | 'login'>('email')
  const codeBtnRef = useRef<CountdownButtonHandle>(null)

  const showStrongPasswordRule = asBool(common?.client_strong_password_rule)
  const passwordStatus = checkStrongPassword(password)

  function resetCaptcha() {
    captchaRef.current = ''
    captchaTokenRef.current = ''
  }

  function changeType(flag: boolean) {
    setIsEmailOrPhone(flag)
    resetCaptcha()
  }

  /** 打开图形验证码弹窗，成功后继续指定动作（官方 getData 回调） */
  function promptCaptcha(action: 'email' | 'phone' | 'login') {
    captchaRef.current = ''
    captchaTokenRef.current = ''
    codeActionRef.current = action
    setShowCaptcha(true)
    return false
  }

  async function sendCode() {
    if (codeLoading) return false
    if (isEmailOrPhone) {
      if (!email) {
        setErrorText(t('ali_tips1', '请输入邮箱'))
        return false
      }
      if (!EMAIL_RE.test(email)) {
        setErrorText(t('account_tips40', '邮箱格式不正确'))
        return false
      }
      if (
        asBool(common?.captcha_client_password_reset) &&
        !captchaRef.current
      ) {
        return promptCaptcha('email')
      }
      setErrorText('')
      setCodeLoading(true)
      try {
        const res = await sendEmailCode({
          action: 'password_reset',
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
      setErrorText(t('account_tips43', '请输入手机号码'))
      return false
    }
    if (countryCode === '86' && !CODE_RE.test(phone)) {
      setErrorText(t('account_tips44', '请输入正确的手机号'))
      return false
    }
    if (asBool(common?.captcha_client_password_reset) && !captchaRef.current) {
      return promptCaptcha('phone')
    }
    setErrorText('')
    setCodeLoading(true)
    try {
      const res = await sendPhoneCode({
        action: 'password_reset',
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
    if (codeActionRef.current === 'login') {
      setErrorText('')
      void performLogin()
      return
    }
    void sendCode().then((ok) => {
      if (ok === true) codeBtnRef.current?.startCountdown()
    })
  }

  async function doResetPass() {
    let isPass = true
    let err = ''
    if (isEmailOrPhone) {
      if (!email) {
        err = t('ali_tips1', '请输入邮箱')
        isPass = false
      } else if (!EMAIL_RE.test(email)) {
        err = t('account_tips40', '邮箱格式不正确')
        isPass = false
      }
      if (!emailCode) {
        err = t('account_tips41', '请输入邮箱验证码')
        isPass = false
      } else if (emailCode.length !== 6) {
        err = t('account_tips42', '邮箱验证码应为6位')
        isPass = false
      }
    } else {
      if (!phone) {
        err = t('account_tips43', '请输入手机号码')
        isPass = false
      } else if (countryCode === '86' && !CODE_RE.test(phone)) {
        err = t('account_tips44', '请输入正确的手机号')
        isPass = false
      }
      if (!phoneCode) {
        err = t('account_tips45', '请输入手机验证码')
        isPass = false
      } else if (phoneCode.length !== 6) {
        err = t('account_tips46', '手机验证码应为6位')
        isPass = false
      }
    }
    if (!password) {
      err = t('account_tips47', '请输入密码')
      isPass = false
    } else if (password.length > 32 || password.length < 6) {
      err = t('account_tips52', '密码应该在6~32位')
      isPass = false
    } else if (showStrongPasswordRule && !passwordStatus.valid) {
      err = t('password_strong_rule_error', '密码不满足强密码规则')
      isPass = false
    }
    if (!rePassword) {
      err = t('account_tips48', '请再次输入密码')
      isPass = false
    } else if (password !== rePassword) {
      err = t('account_tips49', '两次密码不一致')
      isPass = false
    }
    if (!checked) {
      err = t('account_tips51', '请勾选服务协议书！')
      isPass = false
    }

    if (!isPass) {
      setErrorText(err)
      return
    }

    setErrorText('')
    setResetting(true)
    try {
      const code = isEmailOrPhone ? emailCode : phoneCode
      const account = isEmailOrPhone ? email.trim() : phone.trim()
      const res = await forgetPass({
        type: isEmailOrPhone ? 'email' : 'phone',
        account,
        phone_code: countryCode.toString(),
        code,
        password,
        re_password: rePassword,
      })
      if (res.status !== 200) {
        throw new ApiError(res.msg, res.status, res.data)
      }
      // 官方 forget.js：重置成功后 $message.success 再调用登录接口自动登录
      toast.success(res.msg)
      doLogin()
    } catch (e) {
      setErrorText(e instanceof ApiError ? e.msg : '重置失败')
    } finally {
      setResetting(false)
    }
  }

  /** 重置成功后自动登录（官方 handelLogin 的密码登录分支） */
  function doLogin() {
    if (computeCaptchaRequired(common) && !captchaRef.current) {
      setErrorText('')
      promptCaptcha('login')
      return
    }
    setErrorText('')
    performLogin()
  }

  async function performLogin() {
    const account = isEmailOrPhone ? email.trim() : phone.trim()
    setResetting(true)
    try {
      const res = await login({
        type: 'password',
        account,
        phone_code: countryCode.toString(),
        code: '',
        password: encryptPassword(password),
        remember_password: 0,
        captcha: captchaRef.current,
        token: captchaTokenRef.current,
      })
      if (res.status !== 200) {
        throw new ApiError(res.msg, res.status, res.data)
      }
      useAuthStore.getState().auth.setAccessToken(res.data.jwt)
      await afterLogin(common)
    } catch (e) {
      const err = e instanceof ApiError ? e : null
      const data = (err?.data ?? {}) as { captcha?: number }
      if (data?.captcha === 1) {
        resetCaptcha()
        promptCaptcha('login')
        return
      }
      setErrorText(err?.msg ?? '登录失败')
    } finally {
      setResetting(false)
    }
  }

  const codeInput = isEmailOrPhone ? emailCode : phoneCode

  return (
    <div className='grid gap-4'>
      <div className='grid gap-3'>
        {/* 账号类型切换（官方 login-top） */}
        <div className='flex border-b text-sm'>
          <button
            type='button'
            className={`border-b-2 px-4 py-2 ${isEmailOrPhone ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground'}`}
            onClick={() => changeType(true)}
          >
            {t('login_email', '邮箱')}
          </button>
          <button
            type='button'
            className={`border-b-2 px-4 py-2 ${!isEmailOrPhone ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground'}`}
            onClick={() => changeType(false)}
          >
            {t('login_phone', '手机号')}
          </button>
        </div>

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

        <div className='flex gap-2'>
          <Input
            value={codeInput}
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

        {/* 新密码 */}
        <div className='relative'>
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('tip1', '密码 (6~32位)')}
            autoComplete='new-password'
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
          />
          {showStrongPasswordRule && passwordFocused && (
            <div className='absolute inset-x-0 top-full z-10 mt-1 rounded-md border bg-background p-3 text-sm shadow-md'>
              <p className='mb-1 font-medium'>
                {t('password_rule_title', '密码需满足以下要求：')}
              </p>
              <ul className='space-y-1 text-xs'>
                <li
                  className={
                    passwordStatus.length
                      ? 'text-emerald-600'
                      : 'text-muted-foreground'
                  }
                >
                  {passwordStatus.length ? '✓' : '○'}{' '}
                  {t('password_rule_length', '至少 8 个字符')}
                </li>
                <li
                  className={
                    passwordStatus.composition
                      ? 'text-emerald-600'
                      : 'text-muted-foreground'
                  }
                >
                  {passwordStatus.composition ? '✓' : '○'}{' '}
                  {t(
                    'password_rule_composition',
                    '需同时包含数字、字母以及特殊符号'
                  )}
                </li>
                <li
                  className={
                    passwordStatus.sequence
                      ? 'text-emerald-600'
                      : 'text-muted-foreground'
                  }
                >
                  {passwordStatus.sequence ? '✓' : '○'}{' '}
                  {t('password_rule_sequence', '不使用连续或重复字符')}
                </li>
              </ul>
            </div>
          )}
        </div>

        <PasswordInput
          value={rePassword}
          onChange={(e) => setRePassword(e.target.value)}
          placeholder={t('tip2', '再次确认密码')}
          autoComplete='new-password'
        />

        {/* 协议（官方 read-item） */}
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
            {t('login_read', '阅读并同意')}
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

        <Button onClick={doResetPass} disabled={resetting}>
          {resetting ? <Loader2 className='animate-spin' /> : <LockKeyhole />}
          {t('regist_to_login', '确认并登录')}
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
