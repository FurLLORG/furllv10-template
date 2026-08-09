import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useClientLang } from '@/hooks/use-client-lang'
import { formatTimeFull } from '@/features/client/finance/shared'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { CreateApiKeyResult } from '@/api'

function ErrorAlert({ text }: { text: string }) {
  if (!text) return null
  return (
    <div className='rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40'>
      {text}
    </div>
  )
}

function DialogShell({
  open,
  title,
  children,
  footer,
  onClose,
}: {
  open: boolean
  title: string
  children: React.ReactNode
  footer: React.ReactNode
  onClose: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      {/* overflow-hidden + 内部 grid item min-w-0：防止超长值把 auto 轨道撑出弹窗 */}
      <DialogContent className='min-w-0 overflow-hidden sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div key={open ? 'open' : 'closed'} className='min-w-0 space-y-4'>
          {children}
        </div>
        <div className='flex justify-end gap-2 pt-2'>{footer}</div>
      </DialogContent>
    </Dialog>
  )
}

function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(
      () => toast.success('复制成功'),
      () => legacyCopy(text)
    )
  } else {
    legacyCopy(text)
  }
}

function legacyCopy(text: string) {
  const el = document.createElement('textarea')
  el.value = text
  el.style.position = 'fixed'
  el.style.opacity = '0'
  document.body.appendChild(el)
  el.select()
  try {
    document.execCommand('copy')
    toast.success('复制成功')
  } catch {
    /* ignore */
  } finally {
    document.body.removeChild(el)
  }
}

// ---------- 通用删除确认弹窗 ----------

export function ConfirmDeleteDialog({
  open,
  title,
  name,
  submitting,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  name?: string
  submitting?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const { t } = useClientLang()
  return (
    <DialogShell
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onConfirm} disabled={submitting}>
            {submitting ? <Loader2 className='animate-spin' /> : null}
            {t('security_btn9', '确认删除')}
          </Button>
          <Button variant='outline' onClick={onClose}>
            {t('security_btn6', '取消')}
          </Button>
        </>
      }
    >
      <div className='text-sm text-muted-foreground'>
        {title}
        {name ? (
          <>
            :<span className='ml-1 font-medium text-foreground'>{name}</span>
          </>
        ) : null}
      </div>
    </DialogShell>
  )
}

// ---------- 创建 API 弹窗 ----------

export function CreateApiDialog({
  open,
  submitting,
  errorText,
  value,
  onChange,
  onSubmit,
  onClose,
}: {
  open: boolean
  submitting: boolean
  errorText: string
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  onClose: () => void
}) {
  const { t } = useClientLang()
  return (
    <DialogShell
      open={open}
      title={t('security_btn1', '创建API')}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting ? <Loader2 className='animate-spin' /> : null}
            {t('security_btn5', '提交')}
          </Button>
          <Button variant='outline' onClick={onClose}>
            {t('security_btn6', '取消')}
          </Button>
        </>
      }
    >
      <div className='space-y-2'>
        <Label>{t('security_label1', '名称')}</Label>
        <Input
          value={value}
          maxLength={10}
          placeholder={t('security_label1', '名称')}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmit()
          }}
        />
      </div>
      <ErrorAlert text={errorText} />
    </DialogShell>
  )
}

// ---------- 创建 API 成功弹窗（token/私钥仅展示一次） ----------

export function CreateApiSuccessDialog({
  open,
  data,
  checked,
  errorText,
  onCheckedChange,
  onSubmit,
  onClose,
}: {
  open: boolean
  data: CreateApiKeyResult | null
  checked: boolean
  errorText: string
  onCheckedChange: (v: boolean) => void
  onSubmit: () => void
  onClose: () => void
}) {
  const { t } = useClientLang()
  if (!data) return null

  const items = [
    { label: t('security_label1', '名称'), value: data.name },
    { label: 'ID', value: `${data.id}` },
    { label: t('security_api_adrress', 'API接口地址'), value: data.api_url },
    { label: 'Token', value: data.token, copyable: true },
    { label: t('security_label9', '私钥'), value: data.private_key, copyable: true },
    {
      label: t('security_label4', '创建时间'),
      value: formatTimeFull(data.create_time),
    },
  ]

  return (
    <DialogShell
      open={open}
      title={t('security_created_api', 'API已创建')}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onSubmit}>{t('security_btn8', '我已保存')}</Button>
        </>
      }
    >
      <div className='rounded-md border p-3'>
        <div className='space-y-2'>
          {items.map((item) => (
            <div
              key={item.label}
              className='flex min-w-0 max-w-full items-center gap-2 text-sm text-muted-foreground'
            >
              <span className='w-24 shrink-0'>{item.label}:</span>
              {/* 超长值：右侧渐变淡出，避免溢出弹窗 */}
              <div className='relative min-w-0 max-w-full flex-1 self-stretch overflow-hidden'>
                <span className='block truncate' title={item.value}>
                  {item.value}
                </span>
                <div className='pointer-events-none absolute inset-y-0 right-0 w-14 bg-linear-to-r from-transparent to-background' />
              </div>
              {item.copyable ? (
                <Button
                  variant='ghost'
                  size='sm'
                  className='h-6 shrink-0 px-2 text-xs text-primary'
                  onClick={() => copyText(item.value)}
                >
                  {t('security_btn11', '全部复制')}
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      <label className='flex cursor-pointer items-start gap-2 text-sm'>
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => onCheckedChange(v === true)}
          className='mt-0.5'
        />
        <span>
          {t('security_tips', '为了保证数据安全，')}
          <span className='text-yellow-600'>
            {t('security_tips2', '以上信息仅在创建时候显示一次，请务必妥善保存。')}
          </span>
        </span>
      </label>
      <ErrorAlert text={errorText} />
    </DialogShell>
  )
}

// ---------- IP 白名单设置弹窗 ----------

export function WhiteListDialog({
  open,
  status,
  ip,
  errorText,
  submitting,
  onChange,
  onSubmit,
  onClose,
}: {
  open: boolean
  status: 0 | 1
  ip: string
  errorText: string
  submitting: boolean
  onChange: (patch: { status?: 0 | 1; ip?: string }) => void
  onSubmit: () => void
  onClose: () => void
}) {
  const { t } = useClientLang()
  return (
    <DialogShell
      open={open}
      title={t('security_title4', 'IP白名单设置')}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting ? <Loader2 className='animate-spin' /> : null}
            {t('security_btn5', '提交')}
          </Button>
          <Button variant='outline' onClick={onClose}>
            {t('security_btn6', '取消')}
          </Button>
        </>
      }
    >
      <div className='rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300'>
        {t('security_tips3', 'IP白名单功能可以指定IP地址进行API调用，以保证密钥安全')}
      </div>
      <div className='flex items-center justify-between'>
        <Label>{t('security_label5', '开启状态')}</Label>
        <Switch
          checked={status === 1}
          onCheckedChange={(v) => onChange({ status: v ? 1 : 0 })}
        />
      </div>
      <p className='text-sm text-muted-foreground'>
        {t('security_tips4', '开启后可指定IP地址进行API调用')}
      </p>
      {status === 1 ? (
        <div className='space-y-2'>
          <Label>{t('security_label6', '允许访问的IP')}</Label>
          <Textarea
            rows={4}
            placeholder={`${t('security_tips5', '请输入IP地址,每行一段，如：')}\n1.1.1.1\n1.1.1.1-2.2.2.2`}
            value={ip}
            onChange={(e) => onChange({ ip: e.target.value })}
          />
        </div>
      ) : null}
      <ErrorAlert text={errorText} />
    </DialogShell>
  )
}

// ---------- SSH 密钥 创建/编辑弹窗 ----------

export function SshKeyDialog({
  open,
  title,
  name,
  publicKey,
  errorText,
  submitting,
  onChange,
  onSubmit,
  onClose,
}: {
  open: boolean
  title: string
  name: string
  publicKey: string
  errorText: string
  submitting: boolean
  onChange: (patch: { name?: string; public_key?: string }) => void
  onSubmit: () => void
  onClose: () => void
}) {
  const { t } = useClientLang()
  return (
    <DialogShell
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting ? <Loader2 className='animate-spin' /> : null}
            {t('security_btn5', '提交')}
          </Button>
          <Button variant='outline' onClick={onClose}>
            {t('security_btn6', '取消')}
          </Button>
        </>
      }
    >
      <div className='space-y-2'>
        <Label>{t('security_label1', '名称')}</Label>
        <Input
          value={name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={t('security_label1', '名称')}
        />
      </div>
      <div className='space-y-2'>
        <Label>{t('security_label7', '公钥')}</Label>
        <Textarea
          rows={4}
          value={publicKey}
          onChange={(e) => onChange({ public_key: e.target.value })}
          placeholder={t('security_label7', '公钥')}
        />
      </div>
      <ErrorAlert text={errorText} />
    </DialogShell>
  )
}

// ---------- 安全组 创建/编辑弹窗 ----------

export function SecurityGroupDialog({
  open,
  title,
  name,
  description,
  errorText,
  submitting,
  onChange,
  onSubmit,
  onClose,
}: {
  open: boolean
  title: string
  name: string
  description: string
  errorText: string
  submitting: boolean
  onChange: (patch: { name?: string; description?: string }) => void
  onSubmit: () => void
  onClose: () => void
}) {
  const { t } = useClientLang()
  return (
    <DialogShell
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting ? <Loader2 className='animate-spin' /> : null}
            {t('security_btn5', '提交')}
          </Button>
          <Button variant='outline' onClick={onClose}>
            {t('security_btn6', '取消')}
          </Button>
        </>
      }
    >
      <div className='space-y-2'>
        <Label>{t('security_label1', '名称')}</Label>
        <Input
          value={name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={t('security_label1', '名称')}
        />
      </div>
      <div className='space-y-2'>
        <Label>{t('account_label9', '描述')}</Label>
        <Textarea
          rows={4}
          value={description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder={t('account_label9', '描述')}
        />
      </div>
      <ErrorAlert text={errorText} />
    </DialogShell>
  )
}
