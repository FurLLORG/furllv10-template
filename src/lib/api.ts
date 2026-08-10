import axios, {
  type AxiosError,
  type AxiosInstance,
} from 'axios'
import { useAuthStore } from '@/stores/auth-store'

export interface ApiResponse<T = unknown> {
  status: number
  msg: string
  data: T
  code?: string
}

function attachAuth(instance: AxiosInstance): AxiosInstance {
  instance.interceptors.request.use((config) => {
    const token = useAuthStore.getState().auth.accessToken
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  })

  instance.interceptors.response.use(
    (response) => {
      // 魔方 API 错误是 HTTP 200 + body.status：body.status === 401（token 失效/
      // 密码已修改需重新授权等）时清除登录态并回登录页。
      // 仅在有登录态时跳转：游客（未带 token）访问免登录页面命中需登录接口时
      // 返回 401 不应被强制踢到登录页，由页面自行展示游客态
      const body = response.data as { status?: number } | undefined
      if (
        body &&
        body.status === 401 &&
        useAuthStore.getState().auth.accessToken
      ) {
        useAuthStore.getState().auth.reset()
        if (window.location.pathname !== '/login.htm') {
          window.location.href = `/login.htm?redirect=${encodeURIComponent(
            window.location.pathname + window.location.search
          )}`
        }
      }
      return response
    },
    (error: AxiosError) => {
      if (
        error.response?.status === 401 &&
        useAuthStore.getState().auth.accessToken
      ) {
        useAuthStore.getState().auth.reset()
        if (window.location.pathname !== '/login.htm') {
          window.location.href = `/login.htm?redirect=${encodeURIComponent(
            window.location.pathname + window.location.search
          )}`
        }
      }
      return Promise.reject(error)
    }
  )

  return instance
}

/**
 * 魔方财务 /console/v1 API 客户端
 * - baseURL 用相对路径（生产同域部署）
 * - 开发环境由 vite proxy 转发到 VITE_API_PROXY_TARGET
 * - token 遵循官方约定：localStorage.jwt
 */
export const api = attachAuth(
  axios.create({
    baseURL: '/console/v1',
    timeout: 1000 * 60 * 10,
  })
)

/** 独立接口客户端（/rtapi/*，如账单月度统计），认证与 api 一致 */
export const rtapi = attachAuth(
  axios.create({
    baseURL: '/rtapi',
    timeout: 1000 * 60 * 10,
  })
)

export function getErrorMessage(error: unknown, fallback = '请求失败'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { msg?: string } | undefined
    if (data?.msg) return data.msg
    return error.message || fallback
  }
  if (error instanceof ApiError) return error.msg
  if (error instanceof Error && error.message) return error.message
  return fallback
}

/**
 * 魔方 API 业务错误（HTTP 200 + body.status !== 200）。
 * 与官方 Axios 拦截器一致：登录失败返回 data.captcha=1（需图形验证码）、
 * data.need_security_verify=true（异常登录安全验证）等结构化信息。
 */
export class ApiError extends Error {
  status: number
  data: unknown
  /** 业务错误信息（官方 err.data.msg 等价物） */
  msg: string

  constructor(msg: string, status: number, data?: unknown) {
    super(msg)
    this.name = 'ApiError'
    this.status = status
    this.data = data
    this.msg = msg
  }
}

/**
 * 解包魔方 API 响应：body.status !== 200 时抛 ApiError（携带 msg/data），
 * 否则返回 body.data。魔方业务错误走 HTTP 200 返回，不会触发 axios reject。
 */
export async function unwrap<T>(
  promise: Promise<ApiResponse<T>>
): Promise<T> {
  const res = await promise
  if (res.status !== 200) {
    throw new ApiError(res.msg || '请求失败', res.status, res.data)
  }
  return res.data
}
