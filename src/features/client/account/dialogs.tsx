import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  codeUpdatePassword,
  sendEmailCode,
  sendPhoneCode,
  updateAccountPassword,
  updateEmail,
  updateOperationPassword,
  updatePhone,
  verifyOldEmail,
  verifyOldPhone,
  type AccountInfo,
} from '@/api'
import { getErrorMessage } from '@/lib/api'
import { useClientLang } from '@/hooks/use-client-lang'
import { cn } from '@/lib/utils'
import { CountdownButton } from '@/components/countdown-button'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PasswordInput } from '@/components/password-input'
import { useAuthStore } from '@/stores/auth-store'
import type {
  EmailEditState,
  PhoneEditState,
  SubmitWithSecurity,
} from './types'

interface DialogShellProps {
  open: boolean
  title: string
  children: React.ReactNode
  footer: React.ReactNode
  onClose: () => void
}

function DialogShell({ open, title, children, footer, onClose }: DialogShellProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {/* key 随 open 变化：重新打开时重建表单，重置内部状态 */}
        <div key={open ? 'open' : 'closed'} className='space-y-4'>
          {children}
        </div>
        <div className='flex justify-end gap-2 pt-2'>{footer}</div>
      </DialogContent>
    </Dialog>
  )
}

function CodeWithButton({
  value,
  onChange,
  onSend,
  loading,
  disabled,
  placeholder,
  inputMode,
}: {
  value: string
  onChange: (v: string) => void
  onSend: () => Promise<boolean | void>
  loading?: boolean
  disabled?: boolean
  placeholder?: string
  inputMode?: 'numeric'
}) {
  return (
    <div className='flex gap-2'>
      <Input
        inputMode={inputMode}
        maxLength={inputMode === 'numeric' ? 6 : undefined}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <CountdownButton onSend={onSend} loading={loading} disabled={disabled} />
    </div>
  )
}

function ErrorAlert({ text }: { text: string }) {
  if (!text) return null
  return (
    <div className='rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40'>
      {text}
    </div>
  )
}

// ---------- 更改密码 ----------

interface ChangePasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  submitWithSecurity: SubmitWithSecurity
  /** 点击「验证码修改」切换弹窗 */
  onSwitchToCode: () => void
}

export function ChangePasswordDialog({
  open,
  onOpenChange,
  submitWithSecurity,
  onSwitchToCode,
}: ChangePasswordDialogProps) {
  const { t } = useClientLang()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [rePassword, setRePassword] = useState('')
  const [errorText, setErrorText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    setErrorText('')
    setSubmitting(true)
    try {
      const res = await submitWithSecurity('update_password', (sec) =>
        updateAccountPassword({
          old_password: oldPassword,
          new_password: newPassword,
          repassword: rePassword,
          ...(sec ?? {}),
        })
      )
      if (res?.status === 200) {
        toast.success(t('account_tips32', '密码更改成功！请重新登录'))
        // 密码修改成功后 token 失效，清除登录态重新登录
        useAuthStore.getState().auth.reset()
        onOpenChange(false)
        window.location.href = '/login.htm'
      } else if (res) {
        setErrorText(res.msg)
      }
    } catch (err) {
      setErrorText(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogShell
      open={open}
      title={t('account_title2', '更改密码')}
      onClose={() => onOpenChange(false)}
      footer={
        <>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className='animate-spin' /> : null}
            {t('account_btn2', '提交')}
          </Button>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('account_btn3', '取消')}
          </Button>
        </>
      }
    >
      <div className='space-y-2'>
        <Label>{t('account_label11', '原始密码')}</Label>
        <PasswordInput
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          placeholder={t('account_tips1', '请输入原始密码')}
          autoComplete='current-password'
        />
        <div className='flex justify-end text-xs'>
          <button
            type='button'
            onClick={onSwitchToCode}
            className='text-primary hover:underline'
          >
            {t('account_tips5', '验证码修改')}
          </button>
        </div>
      </div>

      <div className='space-y-2'>
        <Label>{t('account_label12', '新密码')}</Label>
        <PasswordInput
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder={t('account_tips2', '请输入新密码')}
          autoComplete='new-password'
        />
      </div>

      <div className='space-y-2'>
        <Label>{t('account_label13', '确认密码')}</Label>
        <PasswordInput
          value={rePassword}
          onChange={(e) => setRePassword(e.target.value)}
          placeholder={t('account_tips3', '请确认密码')}
          autoComplete='new-password'
        />
      </div>
      <ErrorAlert text={errorText} />
    </DialogShell>
  )
}

// ---------- 更改操作密码 ----------

interface OperatePasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 是否已设置操作密码 */
  hasOperatePassword: boolean
  submitWithSecurity: SubmitWithSecurity
  onSuccess: () => void
}

export function OperatePasswordDialog({
  open,
  onOpenChange,
  hasOperatePassword,
  submitWithSecurity,
  onSuccess,
}: OperatePasswordDialogProps) {
  const { t } = useClientLang()
  const [operatePassword, setOperatePassword] = useState('')
  const [reOperatePassword, setReOperatePassword] = useState('')
  const [errorText, setErrorText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    setErrorText('')
    setSubmitting(true)
    try {
      const res = await submitWithSecurity('update_operate_password', (sec) =>
        updateOperationPassword({
          operate_password: operatePassword,
          re_operate_password: reOperatePassword,
          ...(sec ?? {}),
        })
      )
      if (res?.status === 200) {
        toast.success(res.msg || t('success_message', '提交成功'))
        onOpenChange(false)
        onSuccess()
      } else if (res) {
        setErrorText(res.msg)
      }
    } catch (err) {
      setErrorText(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogShell
      open={open}
      title={
        hasOperatePassword
          ? t('account_tips_text4', '更改操作密码')
          : t('account_tips_text5', '设置操作密码')
      }
      onClose={() => onOpenChange(false)}
      footer={
        <>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className='animate-spin' /> : null}
            {t('account_btn2', '提交')}
          </Button>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('account_btn3', '取消')}
          </Button>
        </>
      }
    >
      <div className='space-y-2'>
        <Label>{t('account_label12', '新密码')}</Label>
        <PasswordInput
          value={operatePassword}
          onChange={(e) => setOperatePassword(e.target.value)}
          placeholder={t('account_tips2', '请输入新密码')}
          autoComplete='new-password'
        />
      </div>
      <p className='text-sm text-muted-foreground'>
        <span className='mr-1 text-red-600'>*</span>
        {t('account_tips_text8', '请妥善保管密码，若遗忘密码请联系管理员处理')}
      </p>
      <div className='space-y-2'>
        <Label>{t('account_label13', '确认密码')}</Label>
        <PasswordInput
          value={reOperatePassword}
          onChange={(e) => setReOperatePassword(e.target.value)}
          placeholder={t('account_tips3', '请确认密码')}
          autoComplete='new-password'
        />
      </div>
      <ErrorAlert text={errorText} />
    </DialogShell>
  )
}

// ---------- 验证码修改密码（忘记密码） ----------

interface CodeResetPasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accountData: AccountInfo
  submitWithSecurity: SubmitWithSecurity
}

export function CodeResetPasswordDialog({
  open,
  onOpenChange,
  accountData,
  submitWithSecurity,
}: CodeResetPasswordDialogProps) {
  const { t } = useClientLang()
  const [isEmail, setIsEmail] = useState(true)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [rePassword, setRePassword] = useState('')
  const [errorText, setErrorText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [codeLoading, setCodeLoading] = useState(false)

  async function handleSendCode(): Promise<boolean> {
    if (codeLoading) return false
    setCodeLoading(true)
    try {
      const res = isEmail
        ? await sendEmailCode({
            action: 'password_reset',
            email: accountData.email ?? '',
          })
        : await sendPhoneCode({
            action: 'password_reset',
            phone_code: String(accountData.phone_code ?? '86'),
            phone: accountData.phone ?? '',
          })
      if (res.status === 200) {
        return true
      }
      setErrorText(res.msg)
      return false
    } catch (err) {
      setErrorText(getErrorMessage(err))
      return false
    } finally {
      setCodeLoading(false)
    }
  }

  async function handleSubmit() {
    let error = ''
    if (isEmail) {
      if (!code) {
        error = t('account_tips41', '请输入邮箱验证码')
      } else if (code.length !== 6) {
        error = t('account_tips42', '邮箱验证码应为6位')
      }
    } else {
      if (!code) {
        error = t('account_tips45', '请输入手机验证码')
      } else if (code.length !== 6) {
        error = t('account_tips46', '手机验证码应为6位')
      }
    }
    if (error) {
      setErrorText(error)
      return
    }
    setErrorText('')
    setSubmitting(true)
    try {
      const res = await submitWithSecurity('password_reset', (sec) =>
        codeUpdatePassword({
          type: isEmail ? 'email' : 'phone',
          account: isEmail ? (accountData.email ?? '') : (accountData.phone ?? ''),
          phone_code: isEmail ? undefined : String(accountData.phone_code ?? '86'),
          code,
          password,
          re_password: rePassword,
          ...(sec ?? {}),
        })
      )
      if (res?.status === 200) {
        toast.success(res.msg || t('success_message', '提交成功'))
        // 修改密码成功后 token 失效，清除登录态重新登录
        useAuthStore.getState().auth.reset()
        onOpenChange(false)
        window.location.href = '/login.htm'
      } else if (res) {
        setErrorText(res.msg)
      }
    } catch (err) {
      setErrorText(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const accountText = isEmail
    ? accountData.email
    : `${accountData.phone_code ?? ''}${accountData.phone ?? ''}`

  return (
    <DialogShell
      open={open}
      title={t('account_title2', '更改密码')}
      onClose={() => onOpenChange(false)}
      footer={
        <>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className='animate-spin' /> : null}
            {t('account_btn2', '提交')}
          </Button>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('account_btn3', '取消')}
          </Button>
        </>
      }
    >
      <div className='flex gap-6 text-sm'>
        <button
          type='button'
          className={cn(
            'pb-2',
            isEmail ? 'border-b-2 border-primary font-medium text-primary' : 'text-muted-foreground'
          )}
          onClick={() => {
            setIsEmail(true)
            setCode('')
          }}
        >
          {t('account_label14', '电子邮件')}
        </button>
        <button
          type='button'
          className={cn(
            'pb-2',
            !isEmail ? 'border-b-2 border-primary font-medium text-primary' : 'text-muted-foreground'
          )}
          onClick={() => {
            setIsEmail(false)
            setCode('')
          }}
        >
          {t('account_label15', '手机号码')}
        </button>
      </div>

      <div className='space-y-2'>
        <Label>{isEmail ? t('account_label7', '邮箱') : t('account_label6', '手机')}</Label>
        <Input disabled value={accountText || '--'} />
      </div>
      <div className='space-y-2'>
        <Label>{t('account_label16', '验证码')}</Label>
        <CodeWithButton
          value={code}
          onChange={setCode}
          onSend={handleSendCode}
          loading={codeLoading}
          inputMode='numeric'
          placeholder={isEmail ? t('account_tips8', '邮箱验证码') : t('account_tips9', '手机验证码')}
        />
      </div>
      <div className='space-y-2'>
        <Label>{t('account_label12', '新密码')}</Label>
        <PasswordInput
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('tip1', '密码')}
          autoComplete='new-password'
        />
      </div>
      <div className='space-y-2'>
        <Label>{t('account_label13', '确认密码')}</Label>
        <PasswordInput
          value={rePassword}
          onChange={(e) => setRePassword(e.target.value)}
          placeholder={t('tip2', '再次确认密码')}
          autoComplete='new-password'
        />
      </div>
      <ErrorAlert text={errorText} />
    </DialogShell>
  )
}

// ---------- 手机号 / 邮箱 验证与修改 ----------

interface VerifyPhoneDialogProps {
  state: PhoneEditState
  setState: React.Dispatch<React.SetStateAction<PhoneEditState>>
  accountData: AccountInfo
  onVerified: () => void
}

export function VerifyPhoneDialog({
  state,
  setState,
  accountData,
  onVerified,
}: VerifyPhoneDialogProps) {
  const { t } = useClientLang()

  async function handleSendCode(): Promise<boolean> {
    if (state.loading) return false
    setState((s) => ({ ...s, loading: true }))
    try {
      const res = await sendPhoneCode({
        action: 'verify',
        phone_code: String(accountData.phone_code ?? '86'),
        phone: accountData.phone ?? '',
      })
      if (res.status === 200) {
        return true
      }
      setState((s) => ({ ...s, errorText: res.msg }))
      return false
    } catch (err) {
      setState((s) => ({ ...s, errorText: getErrorMessage(err) }))
      return false
    } finally {
      setState((s) => ({ ...s, loading: false }))
    }
  }

  async function handleSubmit() {
    let error = ''
    if (!state.code) {
      error = t('account_tips33', '请输入验证码')
    } else if (state.code.length !== 6) {
      error = t('account_tips34', '请输入6位数验证码')
    }
    if (error) {
      setState((s) => ({ ...s, errorText: error }))
      return
    }
    setState((s) => ({ ...s, errorText: '' }))
    try {
      const res = await verifyOldPhone({ code: state.code })
      if (res.status === 200) {
        toast.success(t('account_tips35', '手机号验证成功'))
        setState((s) => ({ ...s, verifyOpen: false, code: '' }))
        onVerified()
      } else {
        setState((s) => ({ ...s, errorText: res.msg }))
      }
    } catch (err) {
      setState((s) => ({ ...s, errorText: getErrorMessage(err) }))
    }
  }

  return (
    <DialogShell
      open={state.verifyOpen}
      title={t('account_title3', '验证手机号')}
      onClose={() => setState((s) => ({ ...s, verifyOpen: false }))}
      footer={
        <>
          <Button onClick={handleSubmit}>{t('account_btn4', '验证')}</Button>
          <Button variant='outline' onClick={() => setState((s) => ({ ...s, verifyOpen: false }))}>
            {t('account_btn3', '取消')}
          </Button>
        </>
      }
    >
      <div className='space-y-2'>
        <Label>{t('account_label15', '手机号码')}</Label>
        <Input disabled value={`${accountData.phone_code ?? ''} ${accountData.phone ?? ''}`} />
      </div>
      <div className='space-y-2'>
        <Label>{t('account_label16', '验证码')}</Label>
        <CodeWithButton
          value={state.code}
          onChange={(v) => setState((s) => ({ ...s, code: v }))}
          onSend={handleSendCode}
          loading={state.loading}
          inputMode='numeric'
          placeholder={t('account_tips9', '手机验证码')}
        />
      </div>
      <ErrorAlert text={state.errorText} />
    </DialogShell>
  )
}

interface RePhoneDialogProps {
  state: PhoneEditState
  setState: React.Dispatch<React.SetStateAction<PhoneEditState>>
  countryList: Array<{ phone_code?: number | string; name_zh?: string }>
  onSuccess: () => void
}

export function RePhoneDialog({
  state,
  setState,
  countryList,
  onSuccess,
}: RePhoneDialogProps) {
  const { t } = useClientLang()
  const [phone, setPhone] = useState('')
  const [countryCode, setCountryCode] = useState('86')

  async function handleSendCode(): Promise<boolean> {
    if (state.loading) return false
    if (!phone) {
      setState((s) => ({ ...s, errorText: t('account_tips43', '请输入手机号码') }))
      return false
    }
    setState((s) => ({ ...s, loading: true }))
    try {
      const res = await sendPhoneCode({
        action: 'update',
        phone_code: countryCode,
        phone,
      })
      if (res.status === 200) {
        return true
      }
      setState((s) => ({ ...s, errorText: res.msg }))
      return false
    } catch (err) {
      setState((s) => ({ ...s, errorText: getErrorMessage(err) }))
      return false
    } finally {
      setState((s) => ({ ...s, loading: false }))
    }
  }

  async function handleSubmit() {
    let error = ''
    if (!phone) {
      error = t('account_tips36', '请输入新手机号')
    } else if (phone.length !== 11) {
      error = t('account_tips37', '请输入11位手机号')
    } else if (!state.code) {
      error = t('account_tips33', '请输入验证码')
    } else if (state.code.length !== 6) {
      error = t('account_tips34', '请输入6位数验证码')
    }
    if (error) {
      setState((s) => ({ ...s, errorText: error }))
      return
    }
    setState((s) => ({ ...s, errorText: '' }))
    try {
      const res = await updatePhone({
        phone_code: countryCode,
        phone,
        code: state.code,
      })
      if (res.status === 200) {
        toast.success(t('account_tips38', '恭喜您,手机号修改成功'))
        setState((s) => ({ ...s, changeOpen: false, code: '' }))
        onSuccess()
      } else {
        setState((s) => ({ ...s, errorText: res.msg }))
      }
    } catch (err) {
      setState((s) => ({ ...s, errorText: getErrorMessage(err) }))
    }
  }

  return (
    <DialogShell
      open={state.changeOpen}
      title={t('account_title5', '绑定手机号')}
      onClose={() => setState((s) => ({ ...s, changeOpen: false }))}
      footer={
        <>
          <Button onClick={handleSubmit}>{t('account_btn4', '验证')}</Button>
          <Button variant='outline' onClick={() => setState((s) => ({ ...s, changeOpen: false }))}>
            {t('account_btn3', '取消')}
          </Button>
        </>
      }
    >
      <div className='space-y-2'>
        <Label>{t('account_label15', '手机号码')}</Label>
        <div className='flex gap-2'>
          <Select value={countryCode} onValueChange={setCountryCode}>
            <SelectTrigger className='w-28 shrink-0'>
              <SelectValue>+{countryCode}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {countryList.map((item, index) => (
                <SelectItem key={`${item.phone_code}-${index}`} value={String(item.phone_code ?? '')}>
                  +{item.phone_code} {item.name_zh}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            inputMode='numeric'
            maxLength={11}
            placeholder={t('account_tips16', '请输入新手机号')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
      </div>
      <div className='space-y-2'>
        <Label>{t('account_label16', '验证码')}</Label>
        <CodeWithButton
          value={state.code}
          onChange={(v) => setState((s) => ({ ...s, code: v }))}
          onSend={handleSendCode}
          loading={state.loading}
          inputMode='numeric'
          placeholder={t('account_tips9', '手机验证码')}
        />
      </div>
      <ErrorAlert text={state.errorText} />
    </DialogShell>
  )
}

interface VerifyEmailDialogProps {
  state: EmailEditState
  setState: React.Dispatch<React.SetStateAction<EmailEditState>>
  accountData: AccountInfo
  onVerified: () => void
}

export function VerifyEmailDialog({
  state,
  setState,
  accountData,
  onVerified,
}: VerifyEmailDialogProps) {
  const { t } = useClientLang()

  async function handleSendCode(): Promise<boolean> {
    if (state.loading) return false
    setState((s) => ({ ...s, loading: true }))
    try {
      const res = await sendEmailCode({
        action: 'verify',
        email: accountData.email ?? '',
      })
      if (res.status === 200) {
        return true
      }
      setState((s) => ({ ...s, errorText: res.msg }))
      return false
    } catch (err) {
      setState((s) => ({ ...s, errorText: getErrorMessage(err) }))
      return false
    } finally {
      setState((s) => ({ ...s, loading: false }))
    }
  }

  async function handleSubmit() {
    let error = ''
    if (!state.code) {
      error = t('account_tips33', '请输入验证码')
    } else if (state.code.length !== 6) {
      error = t('account_tips34', '请输入6位数验证码')
    }
    if (error) {
      setState((s) => ({ ...s, errorText: error }))
      return
    }
    setState((s) => ({ ...s, errorText: '' }))
    try {
      const res = await verifyOldEmail({ code: state.code })
      if (res.status === 200) {
        toast.success(t('account_tips39', '邮箱验证成功'))
        setState((s) => ({ ...s, verifyOpen: false, code: '' }))
        onVerified()
      } else {
        setState((s) => ({ ...s, errorText: res.msg }))
      }
    } catch (err) {
      setState((s) => ({ ...s, errorText: getErrorMessage(err) }))
    }
  }

  return (
    <DialogShell
      open={state.verifyOpen}
      title={t('account_title6', '验证邮箱')}
      onClose={() => setState((s) => ({ ...s, verifyOpen: false }))}
      footer={
        <>
          <Button onClick={handleSubmit}>{t('account_btn4', '验证')}</Button>
          <Button variant='outline' onClick={() => setState((s) => ({ ...s, verifyOpen: false }))}>
            {t('account_btn3', '取消')}
          </Button>
        </>
      }
    >
      <div className='space-y-2'>
        <Label>{t('account_label7', '邮箱')}</Label>
        <Input disabled value={accountData.email || '--'} />
      </div>
      <div className='space-y-2'>
        <Label>{t('account_label16', '验证码')}</Label>
        <CodeWithButton
          value={state.code}
          onChange={(v) => setState((s) => ({ ...s, code: v }))}
          onSend={handleSendCode}
          loading={state.loading}
          inputMode='numeric'
          placeholder={t('account_tips8', '邮箱验证码')}
        />
      </div>
      <ErrorAlert text={state.errorText} />
    </DialogShell>
  )
}

interface ReEmailDialogProps {
  state: EmailEditState
  setState: React.Dispatch<React.SetStateAction<EmailEditState>>
  onSuccess: () => void
}

export function ReEmailDialog({ state, setState, onSuccess }: ReEmailDialogProps) {
  const { t } = useClientLang()
  const [email, setEmail] = useState('')

  async function handleSendCode(): Promise<boolean> {
    if (state.loading) return false
    setState((s) => ({ ...s, loading: true }))
    try {
      const res = await sendEmailCode({ action: 'update', email })
      if (res.status === 200) {
        return true
      }
      setState((s) => ({ ...s, errorText: res.msg }))
      return false
    } catch (err) {
      setState((s) => ({ ...s, errorText: getErrorMessage(err) }))
      return false
    } finally {
      setState((s) => ({ ...s, loading: false }))
    }
  }

  async function handleSubmit() {
    let error = ''
    if (!state.code) {
      error = t('account_tips33', '请输入验证码')
    } else if (state.code.length !== 6) {
      error = t('account_tips34', '请输入6位数验证码')
    } else if (!email) {
      error = t('account_tips19', '请输入新邮箱')
    }
    if (error) {
      setState((s) => ({ ...s, errorText: error }))
      return
    }
    setState((s) => ({ ...s, errorText: '' }))
    try {
      const res = await updateEmail({ email, code: state.code })
      if (res.status === 200) {
        toast.success(t('account_tips39', '邮箱验证成功'))
        setState((s) => ({ ...s, changeOpen: false, code: '' }))
        onSuccess()
      } else {
        setState((s) => ({ ...s, errorText: res.msg }))
      }
    } catch (err) {
      setState((s) => ({ ...s, errorText: getErrorMessage(err) }))
    }
  }

  return (
    <DialogShell
      open={state.changeOpen}
      title={t('account_title8', '绑定邮箱')}
      onClose={() => setState((s) => ({ ...s, changeOpen: false }))}
      footer={
        <>
          <Button onClick={handleSubmit}>{t('account_btn4', '验证')}</Button>
          <Button variant='outline' onClick={() => setState((s) => ({ ...s, changeOpen: false }))}>
            {t('account_btn3', '取消')}
          </Button>
        </>
      }
    >
      <div className='space-y-2'>
        <Label>{t('account_label7', '邮箱')}</Label>
        <Input
          type='email'
          placeholder={t('account_tips19', '请输入新邮箱')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className='space-y-2'>
        <Label>{t('account_label16', '验证码')}</Label>
        <CodeWithButton
          value={state.code}
          onChange={(v) => setState((s) => ({ ...s, code: v }))}
          onSend={handleSendCode}
          loading={state.loading}
          inputMode='numeric'
          placeholder={t('account_tips8', '邮箱验证码')}
        />
      </div>
      <ErrorAlert text={state.errorText} />
    </DialogShell>
  )
}
