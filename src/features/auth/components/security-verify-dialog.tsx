import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import {
  createLoginCertification,
  fetchLoginCertificationStatus,
  sendEmailCode,
  sendPhoneCode,
  type AvailableSecurityMethod,
} from '@/api'
import { ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/password-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CountdownButton, type CountdownButtonHandle } from '@/components/countdown-button'
import { CaptchaDialog } from './captcha-dialog'

export interface SecurityVerifyPayload {
  security_verify_method: string
  security_verify_value: string
  certify_id: string
  security_verify_token: string
}

interface SecurityVerifyDialogProps {
  open: boolean
  methods: AvailableSecurityMethod[]
  /** 安全校验是否开启图形验证码（/common 的 captcha_client_security_verify） */
  captchaRequired: boolean
  onClose: () => void
  onConfirm: (payload: SecurityVerifyPayload) => void
}

/**
 * 安全验证弹窗（官方 securityVerification 组件，actionType=exception_login）。
 * 登录接口返回 need_security_verify + available_methods 时弹出，验证通过后携带
 * security_verify_* 参数重试登录。
 */
export function SecurityVerifyDialog({
  open,
  methods,
  captchaRequired,
  onClose,
  onConfirm,
}: SecurityVerifyDialogProps) {
  const [methodId, setMethodId] = useState('')
  const [phoneCode, setPhoneCode] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [operatePassword, setOperatePassword] = useState('')
  const [phoneCodeLoading, setPhoneCodeLoading] = useState(false)
  const [emailCodeLoading, setEmailCodeLoading] = useState(false)
  const [error, setError] = useState('')

  // 实名验证
  const [certifyId, setCertifyId] = useState('')
  const [certifyUrl, setCertifyUrl] = useState('')
  const [certifyStatus, setCertifyStatus] = useState<'idle' | 'creating' | 'waiting' | 'passed' | 'failed'>('idle')
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 图形验证码
  const [showCaptcha, setShowCaptcha] = useState(false)
  // captcha/captchaToken 用 ref 存，供 CaptchaDialog onSuccess 同步调用的 doSendCode 读取
  const captchaRef = useRef('')
  const captchaTokenRef = useRef('')
  const codeActionRef = useRef<'phone' | 'email'>('phone')
  const phoneBtnRef = useRef<CountdownButtonHandle>(null)
  const emailBtnRef = useRef<CountdownButtonHandle>(null)

  const current = methods.find((m) => m.value === methodId)

  function stopPolling() {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current)
    pollTimerRef.current = null
    pollTimeoutRef.current = null
  }

  function startPolling(
    cid: string,
    account: string,
    phoneCodeStr: string,
    token: string
  ) {
    stopPolling()
    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await fetchLoginCertificationStatus({
          certify_id: cid,
          account,
          phone_code: phoneCodeStr,
          security_verify_token: token,
        })
        if (res.status !== 200) return
        if (res.data.verify_status === 1) {
          setCertifyStatus('passed')
          stopPolling()
          onConfirm({
            security_verify_method: 'certification',
            security_verify_value: cid,
            certify_id: cid,
            security_verify_token: token,
          })
        }
      } catch {
        setCertifyStatus('failed')
        stopPolling()
      }
    }, 3000)
    pollTimeoutRef.current = setTimeout(() => {
      stopPolling()
      setCertifyStatus((prev) => (prev === 'passed' ? prev : 'failed'))
    }, 300000)
  }

  // 打开/换方式集合时重建表单（render-phase 状态调整，官方 openDialog 重置语义）
  const methodsKey = methods.map((m) => m.value).join(',')
  const contentKey = `${open}-${methodsKey}`
  const [prevKey, setPrevKey] = useState<string | null>(null)
  if (prevKey !== contentKey) {
    setPrevKey(contentKey)
    const first = open ? (methods[0]?.value ?? '') : ''
    setMethodId(first)
    setPhoneCode('')
    setEmailCode('')
    setOperatePassword('')
    setError('')
    setCertifyId('')
    setCertifyUrl('')
    setCertifyStatus(first === 'certification' ? 'creating' : 'idle')
  }
  // 重建表单时清空验证码 ref（不能写进 render-phase，会触发 react-hooks/refs）
  useEffect(() => {
    captchaRef.current = ''
    captchaTokenRef.current = ''
  }, [contentKey])

  useEffect(() => {
    return () => stopPolling()
  }, [])

  // 切换实名验证方式时创建认证并轮询（状态重置走 render-phase，effect 只做异步）
  useEffect(() => {
    if (!open || methodId !== 'certification') {
      stopPolling()
      return
    }
    let cancelled = false
    const account = current?.account ?? ''
    const phoneCodeStr = current?.phone_code ?? ''
    const token = current?.security_verify_token ?? ''
    createLoginCertification({
      account,
      phone_code: phoneCodeStr,
      security_verify_token: token,
    })
      .then((res) => {
        if (cancelled) return
        if (res.status !== 200) throw new ApiError(res.msg, res.status, res.data)
        setCertifyId(res.data.certify_id)
        setCertifyUrl(res.data.certify_url)
        setCertifyStatus('waiting')
        startPolling(res.data.certify_id, account, phoneCodeStr, token)
      })
      .catch(() => {
        if (cancelled) return
        setCertifyStatus('failed')
      })
    return () => {
      cancelled = true
      stopPolling()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, methodId])

  function resetCaptcha() {
    captchaRef.current = ''
    captchaTokenRef.current = ''
  }

  async function doSendCode(action: 'phone' | 'email') {
    codeActionRef.current = action
    if (action === 'phone') {
      setPhoneCodeLoading(true)
      setError('')
      try {
        const res = await sendPhoneCode({
          action: 'exception_login',
          phone_code: current?.phone_code ?? '',
          phone: current?.account ?? '',
          token: captchaTokenRef.current,
          captcha: captchaRef.current,
        })
        if (res.status !== 200) {
          throw new ApiError(res.msg, res.status, res.data)
        }
      } catch (e) {
        const err = e instanceof ApiError ? e : null
        setError(err?.msg ?? '发送失败')
        resetCaptcha()
        return false
      } finally {
        setPhoneCodeLoading(false)
      }
      return true
    }
    setEmailCodeLoading(true)
    setError('')
    try {
      const res = await sendEmailCode({
        action: 'exception_login',
        email: current?.account ?? '',
        token: captchaTokenRef.current,
        captcha: captchaRef.current,
      })
      if (res.status !== 200) {
        throw new ApiError(res.msg, res.status, res.data)
      }
    } catch (e) {
      const err = e instanceof ApiError ? e : null
      setError(err?.msg ?? '发送失败')
      resetCaptcha()
      return false
    } finally {
      setEmailCodeLoading(false)
    }
    return true
  }

  function handleSendCode(action: 'phone' | 'email') {
    if (captchaRequired && !captchaRef.current) {
      codeActionRef.current = action
      setShowCaptcha(true)
      return false
    }
    return doSendCode(action)
  }

  function handleConfirm() {
    if (methodId === 'certification') {
      if (certifyStatus !== 'passed' || !certifyId) {
        setError('实名验证未通过，请先完成验证')
        return
      }
      onConfirm({
        security_verify_method: 'certification',
        security_verify_value: certifyId,
        certify_id: certifyId,
        security_verify_token: current?.security_verify_token ?? '',
      })
      return
    }
    const value = {
      phone_code: phoneCode,
      email_code: emailCode,
      operate_password: operatePassword,
      certification: certifyId,
    }[methodId]
    if (!value) {
      setError('请输入验证信息')
      return
    }
    onConfirm({
      security_verify_method: methodId,
      security_verify_value: value,
      certify_id: '',
      security_verify_token: current?.security_verify_token ?? '',
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className='max-w-sm'>
          <DialogHeader>
            <DialogTitle>安全验证</DialogTitle>
            <DialogDescription>检测到异地登录，请完成安全验证</DialogDescription>
          </DialogHeader>
          <div className='grid gap-3'>
            <div className='grid gap-1.5'>
              <Label>验证方式</Label>
              <Select value={methodId} onValueChange={setMethodId}>
                <SelectTrigger>
                  <SelectValue placeholder='请选择验证方式' />
                </SelectTrigger>
                <SelectContent>
                  {methods.map((m) => (
                    <SelectItem key={m.value} value={m.value ?? ''}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {methodId === 'phone_code' && (
              <div className='grid gap-1.5'>
                <Label>{current?.label}</Label>
                <div className='flex gap-2'>
                  <Input
                    value={phoneCode}
                    onChange={(e) => setPhoneCode(e.target.value)}
                    placeholder={current?.tip ?? '请输入短信验证码'}
                    inputMode='numeric'
                    maxLength={6}
                  />
                  <CountdownButton
                    ref={phoneBtnRef}
                    loading={phoneCodeLoading}
                    onSend={() => handleSendCode('phone')}
                  />
                </div>
              </div>
            )}
            {methodId === 'email_code' && (
              <div className='grid gap-1.5'>
                <Label>{current?.label}</Label>
                <div className='flex gap-2'>
                  <Input
                    value={emailCode}
                    onChange={(e) => setEmailCode(e.target.value)}
                    placeholder={current?.tip ?? '请输入邮箱验证码'}
                    inputMode='numeric'
                    maxLength={6}
                  />
                  <CountdownButton
                    ref={emailBtnRef}
                    loading={emailCodeLoading}
                    onSend={() => handleSendCode('email')}
                  />
                </div>
              </div>
            )}
            {methodId === 'operate_password' && (
              <div className='grid gap-1.5'>
                <Label>{current?.label}</Label>
                <PasswordInput
                  value={operatePassword}
                  onChange={(e) => setOperatePassword(e.target.value)}
                  placeholder={current?.placeholder ?? '请输入操作密码'}
                />
              </div>
            )}
            {methodId === 'certification' && (
              <div className='grid gap-2'>
                {certifyStatus === 'creating' && (
                  <div className='flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground'>
                    <Loader2 className='animate-spin' />
                    正在生成验证…
                  </div>
                )}
                {certifyStatus === 'waiting' && certifyUrl && (
                  <div className='grid gap-2'>
                    <div className='flex flex-col items-center gap-2 rounded-md border p-4'>
                      <p className='text-sm text-muted-foreground'>
                        请点击下方链接完成实名验证，验证通过后自动登录
                      </p>
                      <Button asChild variant='outline' size='sm'>
                        <a href={certifyUrl} target='_blank' rel='noreferrer'>
                          <ExternalLink />
                          打开验证页面
                        </a>
                      </Button>
                    </div>
                    <p className='text-center text-xs text-muted-foreground'>
                      等待验证结果…
                    </p>
                  </div>
                )}
                {certifyStatus === 'failed' && (
                  <p className='text-center text-sm text-destructive'>
                    验证失败，请重试
                  </p>
                )}
              </div>
            )}

            {error && (
              <p className='text-sm text-destructive'>{error}</p>
            )}

            <div className='flex justify-end gap-2 pt-2'>
              <Button variant='outline' onClick={onClose}>
                取消
              </Button>
              <Button onClick={handleConfirm}>
                确认
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CaptchaDialog
        open={showCaptcha}
        onSuccess={(code, token) => {
          captchaRef.current = code
          captchaTokenRef.current = token
          setShowCaptcha(false)
          void doSendCode(codeActionRef.current).then((ok) => {
            if (ok === true) {
              if (codeActionRef.current === 'phone') {
                phoneBtnRef.current?.startCountdown()
              } else {
                emailBtnRef.current?.startCountdown()
              }
            }
          })
        }}
        onClose={() => setShowCaptcha(false)}
      />
    </>
  )
}
