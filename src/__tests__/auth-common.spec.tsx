// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  computeCaptchaRequired,
  computeDefaultLoginMode,
  checkStrongPassword,
} from '@/features/auth/auth-common'
import { ApiError, unwrap } from '@/lib/api'

describe('computeDefaultLoginMode（官方 getCommonSetting 首次加载默认登录方式）', () => {
  it('未开启手机验证码登录时只能密码登录', () => {
    const mode = computeDefaultLoginMode({ login_phone_verify: 0 } as never)
    expect(mode.passOrCode).toBe(true)
  })

  it('开启手机验证码 + 首选密码登录 + 密码方式可用 → 密码登录', () => {
    const mode = computeDefaultLoginMode({
      login_phone_verify: 1,
      first_login_method: 'password',
      login_phone_password: 1,
      login_email_password: 1,
    } as never)
    expect(mode.passOrCode).toBe(true)
  })

  it('开启手机验证码 + 首选验证码登录 → 验证码登录', () => {
    const mode = computeDefaultLoginMode({
      login_phone_verify: 1,
      first_login_method: 'code',
      login_phone_password: 1,
      login_email_password: 1,
    } as never)
    expect(mode.passOrCode).toBe(false)
  })

  it('密码登录时首选邮箱 → 邮箱账号', () => {
    const mode = computeDefaultLoginMode({
      login_phone_verify: 1,
      first_login_method: 'password',
      login_email_password: 1,
      login_phone_password: 1,
      first_password_login_method: 'email',
    } as never)
    expect(mode.passOrCode).toBe(true)
    expect(mode.emailOrPhone).toBe(true)
  })

  it('首选手机但手机密码未开 → 回退邮箱', () => {
    const mode = computeDefaultLoginMode({
      login_phone_verify: 1,
      first_login_method: 'password',
      login_email_password: 1,
      login_phone_password: 0,
      first_password_login_method: 'phone',
    } as never)
    expect(mode.passOrCode).toBe(true)
    expect(mode.emailOrPhone).toBe(true)
  })

  it('验证码登录时账号类型固定为手机', () => {
    const mode = computeDefaultLoginMode({
      login_phone_verify: 1,
      first_login_method: 'code',
      login_phone_password: 0,
      login_email_password: 1,
    } as never)
    expect(mode.passOrCode).toBe(false)
    expect(mode.emailOrPhone).toBe(false)
  })
})

describe('computeCaptchaRequired（登录图形验证码规则）', () => {
  it('开关关闭 → 不要求', () => {
    expect(
      computeCaptchaRequired({ captcha_client_login: 0 } as never)
    ).toBe(false)
  })

  it('开关开启且不按失败次数 → 要求', () => {
    expect(
      computeCaptchaRequired({
        captcha_client_login: 1,
        captcha_client_login_error: 0,
      } as never)
    ).toBe(true)
  })

  it('按失败次数但未失败 3 次 → 不要求', () => {
    expect(
      computeCaptchaRequired({
        captcha_client_login: 1,
        captcha_client_login_error: 1,
        captcha_client_login_error_3_times: 0,
      } as never)
    ).toBe(false)
  })

  it('按失败次数且已失败 3 次 → 要求', () => {
    expect(
      computeCaptchaRequired({
        captcha_client_login: 1,
        captcha_client_login_error: 1,
        captcha_client_login_error_3_times: 1,
      } as never)
    ).toBe(true)
  })
})

describe('checkStrongPassword（官方 IdcsmartPasswordStrength 强密码规则）', () => {
  it('弱密码（长度不足/无特殊字符/连续字符）不通过', () => {
    expect(checkStrongPassword('abc12345').valid).toBe(false)
    expect(checkStrongPassword('Password1').valid).toBe(false)
    expect(checkStrongPassword('aaa1234!').valid).toBe(false)
  })

  it('强密码通过（含数字+字母+特殊字符且无连续重复）', () => {
    const r = checkStrongPassword('B@x9kQz2!')
    expect(r.length).toBe(true)
    expect(r.composition).toBe(true)
    expect(r.sequence).toBe(true)
    expect(r.valid).toBe(true)
  })
})

describe('ApiError / unwrap（魔方 HTTP 200 + body.status 业务错误）', () => {
  it('status 非 200 抛 ApiError 且携带 msg/data', async () => {
    await expect(
      unwrap(Promise.resolve({ status: 400, msg: '需要验证码', data: { captcha: 1 } }))
    ).rejects.toMatchObject({
      msg: '需要验证码',
      status: 400,
      data: { captcha: 1 },
    })
  })

  it('status 200 返回 data', async () => {
    await expect(
      unwrap(Promise.resolve({ status: 200, msg: 'ok', data: { jwt: 'x' } }))
    ).resolves.toEqual({ jwt: 'x' })
  })

  it('ApiError 是 Error 子类且 message 与 msg 一致', () => {
    const e = new ApiError('bad', 400, { a: 1 })
    expect(e).toBeInstanceOf(Error)
    expect(e.message).toBe('bad')
    expect(e.msg).toBe('bad')
    expect(e.status).toBe(400)
    expect(e.data).toEqual({ a: 1 })
  })
})
