import { useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Loader2, LogIn, QrCode } from 'lucide-react'
import { login, type AvailableSecurityMethod, type CountryItem } from '@/api'
import { ApiError } from '@/lib/api'
import { encryptPassword } from '@/lib/crypto'
import { useClientLang } from '@/hooks/use-client-lang'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  CountdownButton,
  type CountdownButtonHandle,
} from '@/components/countdown-button'
import { installedAddons } from '@/lib/addons'
import { PhoneCodeInput } from './phone-code-input'
import { CaptchaDialog } from './captcha-dialog'
import {
  SecurityVerifyDialog,
  type SecurityVerifyPayload,
} from './security-verify-dialog'
import { WxQrLogin } from './wx-qr-login'
import {
  asBool,
  afterLogin,
  computeCaptchaRequired,
  computeDefaultLoginMode,
  readRemember,
  saveRemember,
  type AuthCommonConfig,
} from '../auth-common'

const EMAIL_RE = /^\w+((-\w+)|(\.\w+))*@[A-Za-z0-9]+((\.|-)[A-Za-z0-9]+)*\.[A-Za-z0-9]+$/
const CODE_RE = /^\d+$/

interface UserAuthFormProps {
  common?: AuthCommonConfig
  countryList: CountryItem[]
  onRefetchCommon: (account?: string) => Promise<void>
}

export function UserAuthForm({
  common,
  countryList,
  onRefetchCommon,
}: UserAuthFormProps) {
  const { t } = useClientLang()
  const remember = readRemember()

  // 官方 getCommonSetting 首次加载：按配置确定默认登录方式（/common 已就绪后渲染，可直接惰性初始化）
  const [initMode] = useState(() => computeDefaultLoginMode(common))
  // 登录方式：true 密码登录 / false 验证码登录
  const [isPassOrCode, setIsPassOrCode] = useState(initMode.passOrCode)
  // 账号类型：true 邮箱 / false 手机号
  const [isEmailOrPhone, setIsEmailOrPhone] = useState(initMode.emailOrPhone)
  const [email, setEmail] = useState(remember.email || '')
  const [phone, setPhone] = useState(remember.phone || '')
  const [password, setPassword] = useState(remember.password || '')
  const [phoneCode, setPhoneCode] = useState('')
  const [countryCode, setCountryCode] = useState('86')
  const [checked, setChecked] = useState(remember.checked)
  const [errorText, setErrorText] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [phoneCodeLoading, setPhoneCodeLoading] = useState(false)

  // 图形验证码（人机验证）：开关开启且「不按失败次数」或「失败 3 次」
  const [isCaptcha, setIsCaptcha] = useState(() =>
    computeCaptchaRequired(common)
  )
  const [showCaptcha, setShowCaptcha] = useState(false)
  // captcha/captchaToken 用 ref 存，供 CaptchaDialog onSuccess 同步调用的 doLogin/
  // sendPhoneCode 读取（React setState 异步，闭包里读到的是旧值，会误触发再次弹图形
  // 验证码 → 空白弹窗卡死）
  const captchaRef = useRef('')
  const captchaTokenRef = useRef('')

  // 异常登录安全验证
  const [showSecurityVerify, setShowSecurityVerify] = useState(false)
  const [securityMethods, setSecurityMethods] = useState<
    AvailableSecurityMethod[]
  >([])
  const securityRef = useRef<SecurityVerifyPayload | null>(null)

  // 微信扫码登录（首选登录方式为微信扫码时默认展示）
  const [showQr, setShowQr] = useState(
    () =>
      common?.first_login_type === 'mp_weixin_notice' &&
      installedAddons().some((n) => n.toLowerCase() === 'mpweixinnotice')
  )
  const codeBtnRef = useRef<CountdownButtonHandle>(null)

  const commonRef = useRef(common)
  commonRef.current = common

  const isShowPhoneType =
    (asBool(common?.login_phone_verify) && !isPassOrCode) ||
    (asBool(common?.login_phone_password) && isPassOrCode)
  const isShowChangeTpyeBtn =
    asBool(common?.login_phone_verify) &&
    (asBool(common?.login_phone_password) ||
      asBool(common?.login_email_password))
  const isShowPassLogin =
    isPassOrCode &&
    (asBool(common?.login_email_password) ||
      asBool(common?.login_phone_password))
  const isShowCodeLogin = !isPassOrCode && asBool(common?.login_phone_verify)
  const isShowEmailTab =
    isPassOrCode && asBool(common?.login_email_password)
  const isShowWxScanLogin =
    installedAddons().some((n) => n.toLowerCase() === 'mpweixinnotice') &&
    asBool(
      (common?.plugin_configuration?.mp_weixin_notice as Record<string, unknown>)
        ?.scan_login
    )
  const oauthList = common?.oauth ?? []

  function resetCaptcha() {
    captchaRef.current = ''
    captchaTokenRef.current = ''
  }

  function changeLoginType() {
    setIsPassOrCode((prev) => {
      const next = !prev
      if (next) {
        setIsEmailOrPhone(
          (common?.first_password_login_method === 'email' &&
            asBool(common?.login_email_password)) ||
            (common?.first_password_login_method === 'phone' &&
              !asBool(common?.login_phone_password))
        )
      } else {
        setIsEmailOrPhone(false)
      }
      return next
    })
    resetCaptcha()
  }

  async function sendPhoneCode() {
    if (phoneCodeLoading) return false
    const { sendPhoneCode: sendPhoneCodeApi } = await import('@/api')
    if (!phone) {
      setErrorText(t('login_text6', '请输入手机号码'))
      return false
    }
    if (asBool(common?.captcha_client_login) && !captchaRef.current) {
      // 登录场景发短信需先过图形验证码（官方 sendPhoneCode isAuto=false 分支）
      setErrorText('')
      return await promptCaptcha('phoneCode')
    }
    setPhoneCodeLoading(true)
    setErrorText('')
    try {
      const res = await sendPhoneCodeApi({
        action: 'login',
        phone_code: countryCode,
        phone,
        token: captchaTokenRef.current,
        captcha: captchaRef.current,
      })
      if (res.status !== 200) throw new ApiError(res.msg, res.status, res.data)
      return true
    } catch (e) {
      setErrorText(e instanceof ApiError ? e.msg : '发送失败')
      resetCaptcha()
      return false
    } finally {
      setPhoneCodeLoading(false)
    }
  }

  /** 打开图形验证码弹窗，成功后继续指定动作 */
  function promptCaptcha(action: 'login' | 'phoneCode') {
    captchaRef.current = ''
    captchaTokenRef.current = ''
    codeActionRef.current = action
    setShowCaptcha(true)
    return false
  }
  const codeActionRef = useRef<'login' | 'phoneCode'>('login')

  function onCaptchaSuccess(code: string, token: string) {
    captchaRef.current = code
    captchaTokenRef.current = token
    setShowCaptcha(false)
    if (codeActionRef.current === 'login') {
      setIsCaptcha(false)
      void doLogin()
    } else {
      void sendPhoneCode().then((ok) => {
        if (ok === true) codeBtnRef.current?.startCountdown()
      })
    }
  }

  function doLogin() {
    let isPass = true
    let err = ''
    if (isEmailOrPhone) {
      if (!email) {
        err = t('login_text1', '请输入邮箱')
        isPass = false
      } else if (!EMAIL_RE.test(email)) {
        err = t('login_text2', '邮箱格式不正确')
        isPass = false
      }
      // 验证码登录仅支持手机号（官方 emailCode 分支已注释）
      if (isPassOrCode && !password) {
        err = t('login_text3', '请输入密码')
        isPass = false
      }
    } else {
      if (!phone) {
        err = t('login_text6', '请输入手机号码')
        isPass = false
      } else if (countryCode === '86' && !CODE_RE.test(phone)) {
        err = t('login_text7', '请输入正确的手机号')
        isPass = false
      }
      if (isPassOrCode) {
        if (!password) {
          err = t('login_text3', '请输入密码')
          isPass = false
        }
      } else {
        if (!phoneCode) {
          err = t('account_tips45', '请输入手机验证码')
          isPass = false
        } else if (phoneCode.length !== 6) {
          err = t('account_tips46', '手机验证码应为6位')
          isPass = false
        }
      }
    }
    if (!checked) {
      err = t('account_tips51', '请阅读并同意服务协议')
      isPass = false
    }
    if (!isPass) {
      setErrorText(err)
      return
    }
    if (isCaptcha && !captchaRef.current) {
      setErrorText('')
      promptCaptcha('login')
      return
    }
    setErrorText('')
    void performLogin()
  }

  async function performLogin() {
    setLoginLoading(true)
    try {
      const code = isPassOrCode ? '' : phoneCode
      const account = isEmailOrPhone ? email.trim() : phone.trim()
      const res = await login({
        type: isPassOrCode ? 'password' : 'code',
        account,
        phone_code: countryCode.toString(),
        code,
        password: isPassOrCode ? encryptPassword(password) : '',
        remember_password: 0,
        captcha: captchaRef.current,
        token: captchaTokenRef.current,
        security_verify_method: securityRef.current?.security_verify_method,
        security_verify_value: securityRef.current?.security_verify_value,
        certify_id: securityRef.current?.certify_id,
        security_verify_token: securityRef.current?.security_verify_token,
      })
      if (res.status !== 200) {
        throw new ApiError(res.msg, res.status, res.data)
      }
      useAuthStore.getState().auth.setAccessToken(res.data.jwt)
      saveRemember({
        email,
        phone,
        password,
        isRemember: false,
        checked,
        isEmailOrPhone,
        isPassOrCode,
      })
      await afterLogin(commonRef.current)
    } catch (e) {
      const err = e instanceof ApiError ? e : null
      const data = (err?.data ?? {}) as {
        captcha?: number
        need_security_verify?: boolean
        available_methods?: AvailableSecurityMethod[]
      }
      if (data?.captcha === 1) {
        resetCaptcha()
        setIsCaptcha(true)
        promptCaptcha('login')
        return
      }
      if (data?.need_security_verify === true && data?.available_methods?.length) {
        setSecurityMethods(data.available_methods)
        setShowSecurityVerify(true)
        setErrorText(err?.msg ?? '')
        return
      }
      setErrorText(err?.msg ?? '登录失败')
      void onRefetchCommon(isEmailOrPhone ? email.trim() : phone.trim())
    } finally {
      setLoginLoading(false)
    }
  }

  function onSecurityConfirm(payload: SecurityVerifyPayload) {
    securityRef.current = payload
    setShowSecurityVerify(false)
    setErrorText('')
    void doLogin()
  }

  function oauthLogin(item: { name?: string }) {
    if (!item.name) return
    void import('@/api').then(({ fetchOauthUrl }) =>
      fetchOauthUrl(item.name!).then((res) => {
        if (res.status !== 200) {
          setErrorText(res.msg)
          return
        }
        oauthLoginPopup(res.data.url)
      })
    )
  }

  function oauthLoginPopup(url: string) {
    const popup = window.open(url, 'oauth', 'width=800,height=800')
    const timer = window.setInterval(async () => {
      if (popup?.closed) {
        window.clearInterval(timer)
        const { fetchOauthToken } = await import('@/api')
        const res = await fetchOauthToken()
        if (res.status !== 200 || !res.data) return
        if (res.data.jwt) {
          localStorage.setItem('jwt', res.data.jwt)
          void afterLogin(commonRef.current)
        } else if (res.data.url) {
          window.location.href = res.data.url
        }
      }
    }, 300)
  }

  return (
    <div className='grid gap-4'>
      {showQr && isShowWxScanLogin ? (
        <div className='grid gap-4'>
          <WxQrLogin common={common} />
          <Button
            variant='ghost'
            onClick={() => setShowQr(false)}
            className='w-full'
          >
            使用账号密码登录
          </Button>
        </div>
      ) : (
        <div className='grid gap-3'>
          {/* 登录方式切换 */}
          <div className='flex border-b text-sm'>
            {isShowEmailTab && (
              <button
                type='button'
                className={`border-b-2 px-4 py-2 ${isEmailOrPhone ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground'}`}
                onClick={() => {
                  setIsEmailOrPhone(true)
                  resetCaptcha()
                }}
              >
                {t('login_email', '邮箱')}
              </button>
            )}
            {isShowPhoneType && (
              <button
                type='button'
                className={`border-b-2 px-4 py-2 ${!isEmailOrPhone ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground'}`}
                onClick={() => {
                  setIsEmailOrPhone(false)
                  resetCaptcha()
                }}
              >
                {t('login_phone', '手机号')}
              </button>
            )}
          </div>

          {isEmailOrPhone ? (
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={`${t('login_placeholder_pre', '请输入')}${t('login_email', '邮箱')}`}
              autoComplete='username'
            />
          ) : (
            <PhoneCodeInput
              value={phone}
              onChange={setPhone}
              countryCode={countryCode}
              onCountryCodeChange={setCountryCode}
              countryList={countryList}
              placeholder={`${t('login_placeholder_pre', '请输入')}${t('login_phone', '手机号')}`}
              autoComplete='username'
            />
          )}

          {isShowPassLogin && (
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('login_pass', '密码')}
              autoComplete='current-password'
            />
          )}

          {isShowCodeLogin && (
            <div className='flex gap-2'>
              <Input
                value={phoneCode}
                onChange={(e) => setPhoneCode(e.target.value)}
                placeholder={t('login_phone_code', '手机验证码')}
                inputMode='numeric'
                maxLength={6}
              />
              <CountdownButton
                ref={codeBtnRef}
                loading={phoneCodeLoading}
                onSend={sendPhoneCode}
              />
            </div>
          )}

          {/* 忘记密码 */}
          <div className='flex justify-end'>
            <Link
              to='/forget.htm'
              className='whitespace-nowrap text-sm text-muted-foreground hover:text-primary'
            >
              {t('login_forget', '忘记密码？')}
            </Link>
          </div>

          {/* 协议 */}
          <div
            className='flex cursor-pointer items-start gap-1.5 text-sm text-muted-foreground'
            onClick={() => setChecked((v) => !v)}
          >
            <Checkbox
              checked={checked}
              onCheckedChange={(c) => setChecked(Boolean(c))}
              onClick={(e) => e.stopPropagation()}
              className='mt-[3px] shrink-0'
            />
            <span className='min-w-0 leading-relaxed'>
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

          <Button onClick={doLogin} disabled={loginLoading}>
            {loginLoading ? <Loader2 className='animate-spin' /> : <LogIn />}
            {t('login', '登录')}
          </Button>

          {isShowChangeTpyeBtn && (
            <Button variant='ghost' onClick={changeLoginType}>
              {isPassOrCode
                ? t('login_code_login', '验证码登录')
                : t('login_pass_login', '密码登录')}
            </Button>
          )}

          {oauthList.length > 0 && (
            <>
              <div className='relative my-1'>
                <div className='absolute inset-0 flex items-center'>
                  <span className='w-full border-t' />
                </div>
                <div className='relative flex justify-center text-xs text-muted-foreground'>
                  <span className='bg-background px-2'>or</span>
                </div>
              </div>
              <div className='flex justify-center gap-4'>
                {oauthList.map((item) => (
                  <button
                    key={item.name ?? item.title}
                    type='button'
                    onClick={() => oauthLogin(item)}
                    className='rounded-full border p-2 hover:bg-muted'
                    title={item.title}
                  >
                    {item.img ? (
                      <img src={item.img} alt={item.title ?? item.name} className='h-6 w-6' />
                    ) : (
                      <span className='text-sm'>{item.title ?? item.name}</span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* 微信扫码登录入口 */}
      {isShowWxScanLogin && !(showQr && isShowWxScanLogin) && (
        <div className='flex justify-end'>
          <button
            type='button'
            className='inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary'
            onClick={() => setShowQr(true)}
          >
            <QrCode className='size-4' />
            微信扫码登录
          </button>
        </div>
      )}

      <CaptchaDialog
        open={showCaptcha}
        onSuccess={onCaptchaSuccess}
        onClose={() => setShowCaptcha(false)}
      />
      <SecurityVerifyDialog
        open={showSecurityVerify}
        methods={securityMethods}
        captchaRequired={asBool(common?.captcha_client_security_verify)}
        onClose={() => setShowSecurityVerify(false)}
        onConfirm={onSecurityConfirm}
      />
    </div>
  )
}
