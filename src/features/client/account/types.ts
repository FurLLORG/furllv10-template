import type { ApiResponse } from '@/lib/api'
import type { SecurityVerifyResult } from './security-verify-dialog'

/**
 * 带安全验证的提交流程：
 * 首次 doSubmit() 若不满足安全校验（need_security_verify），自动拉起安全验证弹窗，
 * 用户确认后携带 security_verify_* 字段重新执行 doSubmit()。
 */
export type SubmitWithSecurity<T = ApiResponse> = (
  actionType: string,
  doSubmit: (security?: SecurityVerifyResult) => Promise<T>
) => Promise<T | undefined>

/** 手机号验证/修改弹窗状态 */
export interface PhoneEditState {
  verifyOpen: boolean
  changeOpen: boolean
  code: string
  loading: boolean
  errorText: string
}

/** 邮箱验证/修改弹窗状态 */
export interface EmailEditState {
  verifyOpen: boolean
  changeOpen: boolean
  code: string
  loading: boolean
  errorText: string
}

export const initialPhoneEditState: PhoneEditState = {
  verifyOpen: false,
  changeOpen: false,
  code: '',
  loading: false,
  errorText: '',
}

export const initialEmailEditState: EmailEditState = {
  verifyOpen: false,
  changeOpen: false,
  code: '',
  loading: false,
  errorText: '',
}
