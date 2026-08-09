import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchCommon,
  fetchCommonWithAccount,
  fetchCountryList,
  type CommonConfig,
  type CountryItem,
} from '@/api'
import { unwrap } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

/**
 * 登录/注册页公共配置类型。官方 login.js/regist.js 依据 /common 返回的
 * 开关字段决定支持哪些登录方式、是否需要图形验证码、注册方式等（接口可能返回不同，
 * 全部以 /common 实际返回为准，不硬编码）。
 */
export interface AuthCommonConfig extends CommonConfig {
  /** 手机号短信验证码登录开关 1开 0关 */
  login_phone_verify?: string | number
  /** 邮箱密码登录开关 1开 0关 */
  login_email_password?: string | number
  /** 手机密码登录开关 1开 0关 */
  login_phone_password?: string | number
  /** 首选登录方式（password/code） */
  first_login_method?: string
  /** 首选密码登录账号类型（email/phone） */
  first_password_login_method?: string
  /** 邮箱注册开关 1开 0关 */
  register_email?: string | number
  /** 手机注册开关 1开 0关 */
  register_phone?: string | number
  /** 邮箱注册需验证码 1开 0关 */
  code_client_email_register?: string | number
  /** 手机注册需验证码 1开 0关 */
  code_client_phone_register?: string | number
  /** 注册图形验证码开关 1开 0关 */
  captcha_client_register?: string | number
  /** 登录图形验证码开关 1开 0关 */
  captcha_client_login?: string | number
  /** 登录失败图形验证码开关 1开 0关 */
  captcha_client_login_error?: string | number
  /** 登录失败 3 次（由 /common?account= 动态返回） */
  captcha_client_login_error_3_times?: string | number
  /** 安全校验图形验证码开关 1开 0关 */
  captcha_client_security_verify?: string | number
  /** 三方登录列表 [{name,title,img,url}] */
  oauth?: Array<{ name?: string; title?: string; img?: string; url?: string }>
  plugin_configuration?: Record<string, Record<string, unknown>>
  login_register_redirect_show?: string | number
  login_register_redirect_url?: string
  login_register_redirect_text?: string
  login_register_redirect_blank?: string | number
  client_strong_password_rule?: string | number
  first_login_type?: string
}

export function asBool(v: unknown): boolean {
  return v === 1 || v === '1' || v === true
}

/** 官方 getCommonSetting 首次加载：默认登录方式（密码/验证码 + 邮箱/手机号） */
export function computeDefaultLoginMode(
  common?: AuthCommonConfig
): { passOrCode: boolean; emailOrPhone: boolean } {
  const passOrCode =
    !asBool(common?.login_phone_verify) ||
    (common?.first_login_method === 'password' &&
      (asBool(common?.login_phone_password) ||
        asBool(common?.login_email_password)))
  let emailOrPhone = false
  if (passOrCode) {
    emailOrPhone =
      (common?.first_password_login_method === 'email' &&
        asBool(common?.login_email_password)) ||
      (common?.first_password_login_method === 'phone' &&
        !asBool(common?.login_phone_password))
  }
  return { passOrCode, emailOrPhone }
}

/** 登录是否必须过图形验证码（captcha_client_login + 失败次数规则） */
export function computeCaptchaRequired(
  common?: AuthCommonConfig
): boolean {
  const captchaError = asBool(common?.captcha_client_login_error)
  const threeTimes = asBool(common?.captcha_client_login_error_3_times)
  return (
    asBool(common?.captcha_client_login) && (!captchaError || threeTimes)
  )
}

/** 登录/注册页公共数据（/common + /country，并行获取） */
export function useAuthCommon(): {
  common?: AuthCommonConfig
  countryList: CountryItem[]
  isLoading: boolean
  error: Error | null
  /** 按账号重新拉取 /common（登录失败后刷新验证码 3 次状态等） */
  refetch: (account?: string) => Promise<void>
} {
  const commonQuery = useQuery({
    queryKey: ['auth-common'],
    queryFn: async () => unwrap(fetchCommon()),
    staleTime: Infinity,
    retry: false,
  })
  const countryQuery = useQuery({
    queryKey: ['auth-country'],
    queryFn: async () => unwrap(fetchCountryList()),
    staleTime: Infinity,
    retry: false,
  })
  const queryClient = useQueryClient()

  const refetch = useMemo(
    () => async (account?: string) => {
      // /common?account= 动态返回 captcha_client_login_error_3_times，
      // 登录失败后带账号重新拉取（官方 getCommonSetting(account) 行为）
      const res = await unwrap(fetchCommonWithAccount(account))
      queryClient.setQueryData(['auth-common'], res)
    },
    [queryClient]
  )

  return {
    common: commonQuery.data,
    countryList: countryQuery.data?.list ?? [],
    isLoading: commonQuery.isLoading || countryQuery.isLoading,
    error: commonQuery.error ?? countryQuery.error ?? null,
    refetch,
  }
}

// ---------- 记住密码（官方 cookie 约定：email/phone/password/isRemember/checked/isEmailOrPhone/isPassOrCode） ----------

const COOKIE_KEYS = [
  'email',
  'phone',
  'password',
  'isRemember',
  'checked',
  'isEmailOrPhone',
  'isPassOrCode',
] as const

function setCookie(name: string, value: string, days: number): void {
  const expires = new Date()
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/`
}

function getCookie(name: string): string {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return m ? decodeURIComponent(m[1]) : ''
}

function delCookie(name: string): void {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
}

export interface RememberState {
  email: string
  phone: string
  password: string
  isRemember: boolean
  checked: boolean
  isEmailOrPhone: boolean
  isPassOrCode: boolean
}

export function readRemember(): RememberState {
  return {
    email: getCookie('email'),
    phone: getCookie('phone'),
    password: getCookie('password'),
    isRemember: getCookie('isRemember') === '1',
    checked: getCookie('checked') === '1',
    isEmailOrPhone: getCookie('isEmailOrPhone') === '1',
    isPassOrCode: getCookie('isPassOrCode') === '1',
  }
}

export function saveRemember(
  params: Omit<RememberState, 'isRemember'> & { isRemember: boolean }
): void {
  if (!params.isRemember) {
    COOKIE_KEYS.forEach(delCookie)
    return
  }
  const days = 30
  if (params.isEmailOrPhone) {
    setCookie('email', params.email, days)
  } else {
    setCookie('phone', params.phone, days)
  }
  setCookie('password', params.password, days)
  setCookie('isRemember', '1', days)
  setCookie('checked', params.checked ? '1' : '0', days)
  setCookie('isEmailOrPhone', params.isEmailOrPhone ? '1' : '0', days)
  setCookie('isPassOrCode', params.isPassOrCode ? '1' : '0', days)
}

// ---------- 登录成功公共流程（官方 loginSuccess） ----------

function resolveRedirect(): string {
  const session = sessionStorage.getItem('redirectUrl')
  if (session) {
    sessionStorage.removeItem('redirectUrl')
    return session
  }
  const url = new URLSearchParams(window.location.search).get('redirect')
  if (url && url.startsWith('/') && !url.startsWith('//')) return url
  return '/home.htm'
}

/**
 * 登录/注册成功后：存 lang → 拉取前台菜单缓存 frontMenus → 跳转。
 * 与官方 loginSuccess 一致。
 */
export async function afterLogin(
  common: AuthCommonConfig | undefined,
  selectedLang?: string
): Promise<void> {
  const langHome = common?.lang_home || 'zh-cn'
  const lang =
    asBool(common?.lang_home_open) && selectedLang ? selectedLang : langHome
  window.localStorage.setItem('lang', lang)
  try {
    const { fetchMenu } = await import('@/api')
    const menuRes = await unwrap(fetchMenu())
    if (menuRes?.menu) {
      window.localStorage.setItem('frontMenus', JSON.stringify(menuRes.menu))
    }
  } catch {
    // 菜单拉取失败不阻塞跳转
  }
  window.location.href = resolveRedirect()
}

// ---------- 三方登录（官方 oauthLogin + getOauthToken） ----------

/** 首次进入登录页时检查当前是否已登录（官方 created 里 location.href = home.htm） */
export function isLoggedIn(): boolean {
  return Boolean(useAuthStore.getState().auth.accessToken)
}

/** 登录页应用名（官方从 /common 取 website_name，未取到用 .env 的 VITE_APP_SITE_NAME 兜底） */
export function siteName(common?: AuthCommonConfig): string {
  return common?.website_name || import.meta.env.VITE_APP_SITE_NAME || 'FurLL 客户中心'
}

// ---------- 强密码规则（官方 /common/passwordStrength.js 的 IdcsmartPasswordStrength） ----------

const SPECIAL_CHARS = "]!@#$%^&*()-_=+[{}|;:'\",./<>?`~\\"

export function checkStrongPassword(password: string): {
  length: boolean
  composition: boolean
  sequence: boolean
  valid: boolean
} {
  const pwd = typeof password === 'string' ? password : ''
  const hasSpecial = pwd.split('').some((c) => SPECIAL_CHARS.includes(c))
  let hasSequence = false
  for (let i = 0; i <= pwd.length - 3; i++) {
    const c1 = pwd.charCodeAt(i)
    const c2 = pwd.charCodeAt(i + 1)
    const c3 = pwd.charCodeAt(i + 2)
    if (c1 === c2 && c2 === c3) hasSequence = true
    if (c2 - c1 === 1 && c3 - c2 === 1) hasSequence = true
    if (c1 - c2 === 1 && c2 - c3 === 1) hasSequence = true
  }
  const result = {
    length: pwd.length >= 8,
    composition:
      /\d/.test(pwd) && /[a-zA-Z]/.test(pwd) && hasSpecial,
    sequence: !hasSequence,
  }
  return { ...result, valid: result.length && result.composition && result.sequence }
}
