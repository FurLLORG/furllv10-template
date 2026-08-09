import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { sendEmailCode, sendPhoneCode, type AvailableSecurityMethod } from '@/api'
import { useClientLang } from '@/hooks/use-client-lang'
import { getErrorMessage } from '@/lib/api'
import { CountdownButton } from '@/components/countdown-button'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface SecurityVerifyResult {
  security_verify_method: string
  security_verify_value: string
  certify_id: string
  security_verify_token?: string
}

interface SecurityVerifyDialogProps {
  open: boolean
  availableMethods: AvailableSecurityMethod[]
  actionType: string
  onConfirm: (result: SecurityVerifyResult) => void
  onCancel: () => void
}

/**
 * 安全验证弹窗（官方 securityVerification 组件）。
 * 支持操作密码 / 手机验证码 / 邮箱验证码三种方式；实名验证（certification）
 * 方式提示引导至实名认证插件完成。
 */
export function SecurityVerifyDialog({
  open,
  availableMethods,
  actionType,
  onConfirm,
  onCancel,
}: SecurityVerifyDialogProps) {
  const { t } = useClientLang()
  const [methodId, setMethodId] = useState('')
  const [phoneCode, setPhoneCode] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [operatePassword, setOperatePassword] = useState('')
  const [codeLoading, setCodeLoading] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)

  // 打开/换方式集合时重建表单（render-phase 状态调整，官方 openDialog 重置语义）
  const contentKey = `${open}-${availableMethods.map((m) => m.value).join(',')}`
  const [prevKey, setPrevKey] = useState<string | null>(null)
  if (prevKey !== contentKey) {
    setPrevKey(contentKey)
    setMethodId(availableMethods[0]?.value ?? '')
    setPhoneCode('')
    setEmailCode('')
    setOperatePassword('')
    setCodeLoading(false)
    setConfirmLoading(false)
  }

  const currentMethod = useMemo(
    () => availableMethods.find((item) => item.value === methodId) ?? null,
    [availableMethods, methodId]
  )

  async function handleSendCode(): Promise<boolean> {
    if (!currentMethod?.account || codeLoading) return false
    setCodeLoading(true)
    try {
      const res =
        currentMethod.value === 'email_code'
          ? await sendEmailCode({
              action: actionType,
              email: currentMethod.account,
              token: '',
              captcha: '',
            })
          : await sendPhoneCode({
              action: actionType,
              phone_code: currentMethod.phone_code ?? '86',
              phone: currentMethod.account,
              token: '',
              captcha: '',
            })
      if (res.status === 200) {
        toast.success(res.msg)
        return true
      }
      toast.error(res.msg)
      return false
    } catch (err) {
      toast.error(getErrorMessage(err))
      return false
    } finally {
      setCodeLoading(false)
    }
  }

  function handleConfirm() {
    if (methodId === 'certification') {
      toast.error(t('security_verify_text11', '请进行实名验证'))
      return
    }
    const value =
      methodId === 'phone_code'
        ? phoneCode
        : methodId === 'email_code'
          ? emailCode
          : methodId === 'operate_password'
            ? operatePassword
            : ''
    if (!value) {
      toast.error(
        methodId === 'phone_code'
          ? t('security_verify_text8', '请输入手机验证码')
          : methodId === 'email_code'
            ? t('security_verify_text9', '请输入邮箱验证码')
            : t('security_verify_text10', '请输入操作密码')
      )
      return
    }
    setConfirmLoading(true)
    onConfirm({
      security_verify_method: methodId,
      security_verify_value: value,
      certify_id: '',
      security_verify_token: currentMethod?.security_verify_token ?? '',
    })
    setConfirmLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('security_verify_text1', '安全验证')}</DialogTitle>
          <DialogDescription>
            {t('security_verify_text7', '请选择验证方式')}
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label>{t('security_verify_text2', '验证方式')}</Label>
            <Select
              value={methodId}
              onValueChange={(v) => {
                setMethodId(v)
                setPhoneCode('')
                setEmailCode('')
                setOperatePassword('')
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('security_verify_text7', '请选择验证方式')} />
              </SelectTrigger>
              <SelectContent>
                {availableMethods.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label ?? item.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {currentMethod?.value === 'phone_code' ? (
            <div className='space-y-2'>
              <Label>{currentMethod.label}</Label>
              <div className='flex gap-2'>
                <Input
                  inputMode='numeric'
                  maxLength={6}
                  placeholder={currentMethod.tip ?? t('security_verify_text8', '请输入手机验证码')}
                  value={phoneCode}
                  onChange={(e) => setPhoneCode(e.target.value)}
                />
                <CountdownButton
                  onSend={handleSendCode}
                  loading={codeLoading}
                  disabled={!currentMethod.account}
                />
              </div>
            </div>
          ) : currentMethod?.value === 'email_code' ? (
            <div className='space-y-2'>
              <Label>{currentMethod.label}</Label>
              <div className='flex gap-2'>
                <Input
                  inputMode='numeric'
                  maxLength={6}
                  placeholder={currentMethod.tip ?? t('security_verify_text9', '请输入邮箱验证码')}
                  value={emailCode}
                  onChange={(e) => setEmailCode(e.target.value)}
                />
                <CountdownButton
                  onSend={handleSendCode}
                  loading={codeLoading}
                  disabled={!currentMethod.account}
                />
              </div>
            </div>
          ) : currentMethod?.value === 'operate_password' ? (
            <div className='space-y-2'>
              <Label>{currentMethod.label}</Label>
              <Input
                type='password'
                placeholder={currentMethod.placeholder ?? t('security_verify_text10', '请输入操作密码')}
                value={operatePassword}
                onChange={(e) => setOperatePassword(e.target.value)}
              />
            </div>
          ) : currentMethod?.value === 'certification' ? (
            <div className='space-y-2'>
              <Label>{currentMethod.label}</Label>
              <p className='text-sm text-muted-foreground'>
                {currentMethod.tip ?? t('security_verify_text11', '请进行实名验证')}
              </p>
            </div>
          ) : null}

          <div className='flex justify-end gap-2 pt-2'>
            <Button variant='outline' onClick={onCancel}>
              {t('finance_btn7', '取消')}
            </Button>
            <Button onClick={handleConfirm} disabled={confirmLoading}>
              {confirmLoading ? <Loader2 className='animate-spin' /> : null}
              {t('finance_btn8', '确认')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
