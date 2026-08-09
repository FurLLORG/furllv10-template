import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import {
  fetchCertificationCustomFields,
  fetchCertificationInfo,
  submitCertificationCompany,
  uploadTicketFile,
  type CertificationCustomFieldItem,
  type CertificationInfoData,
} from '@/api'
import { useCertificationLang } from '@/hooks/use-certification-lang'
import { getErrorMessage } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
  CustomFieldsForm,
  ImageUploadField,
} from './certification-shared'
import { authTemplateOpen, needUploadImages } from './certification-utils'
import { useCertificationNav } from './nav'

interface CompanyForm {
  company: string
  company_organ_code: string
  legal_person_type: string
  auth_letter: string
  custom_fields: Record<string, string | string[] | number>
}

/** 企业认证资料填写页（authentication_company.htm?name=<实名接口>，官方 authenticationCompny.js） */
export function CertificationCompanyPage() {
  const navigate = useNavigate()
  const { t } = useCertificationLang()
  const { selectUrl, thirdUrl } = useCertificationNav()

  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const pluginName = params.get('name') ?? ''

  const [info, setInfo] = useState<CertificationInfoData | null>(null)
  const [customFields, setCustomFields] = useState<CertificationCustomFieldItem[]>([])
  const [form, setForm] = useState<CompanyForm>({
    company: '',
    company_organ_code: '',
    legal_person_type: '1',
    auth_letter: '',
    custom_fields: {},
  })
  const [imgThree, setImgThree] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const templateOpen = authTemplateOpen(info)
  const uploadOpen = needUploadImages(info)
  const showAuthLetter = templateOpen && form.legal_person_type === '2'

  useEffect(() => {
    let active = true
    fetchCertificationInfo()
      .then((res) => active && setInfo(res.data))
      .catch(() => {})
    if (pluginName) {
      fetchCertificationCustomFields({ name: pluginName, type: 'company' })
        .then((res) => {
          if (!active) return
          const fields = res.data.custom_fields ?? []
          setCustomFields(fields)
          const values: Record<string, string | string[] | number> = {}
          for (const item of fields) {
            if (item.type === 'file') values[item.field] = []
            else values[item.field] = ''
          }
          setForm((prev) => ({ ...prev, custom_fields: values }))
        })
        .catch(() => {})
    }
    return () => {
      active = false
    }
  }, [pluginName])

  function setField<K extends keyof CompanyForm>(key: K, value: CompanyForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  function setCustomField(field: string, value: string | string[] | number) {
    setForm((prev) => ({
      ...prev,
      custom_fields: { ...prev.custom_fields, [field]: value },
    }))
  }

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!form.company.trim()) next.company = t('realname_text3', '请输入企业全称')
    if (!form.company_organ_code.trim())
      next.company_organ_code = t('realname_text5', '请输入企业统一社会信用代码')
    if (showAuthLetter && !form.auth_letter) {
      next.auth_letter = t('realname_text94', '请上传授权委托书')
    }
    for (const item of customFields) {
      if (item.required) {
        const value = form.custom_fields[item.field]
        if (
          value == null ||
          value === '' ||
          (Array.isArray(value) && value.length === 0)
        ) {
          next[item.field] = t('realname_text73', '请填写带*的必填项后再提交!')
          break
        }
      }
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit() {
    if (!validate() || submitting) return
    if (uploadOpen && !imgThree) {
      toast.warning(t('realname_text74', '请上传营业执照'))
      return
    }
    setSubmitting(true)
    try {
      const res = await submitCertificationCompany({
        plugin_name: pluginName,
        // 官方企业表单不展示证件字段，按默认值提交（card_number 空则后端跳过他人占用校验）
        card_name: '',
        card_type: 1,
        card_number: '',
        phone: '',
        company: form.company.trim(),
        company_organ_code: form.company_organ_code.trim(),
        legal_person_type: Number(form.legal_person_type),
        auth_letter: showAuthLetter ? form.auth_letter : '',
        img_three: imgThree,
        custom_fields: form.custom_fields,
      })
      if (res.status === 200) {
        toast.success(res.msg)
        navigate({ to: thirdUrl, search: { type: '2' } })
      } else {
        toast.error(res.msg)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className='mx-auto max-w-3xl space-y-4'>
      <div className='flex items-center gap-3'>
        <Button
          variant='ghost'
          size='icon'
          className='size-9 shrink-0'
          onClick={() => navigate({ to: selectUrl })}
        >
          <ArrowLeft className='h-5 w-5 text-primary' />
        </Button>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>
            {t('realname_text1', '实名认证')}
          </h1>
          <div className='mt-1 text-sm text-muted-foreground'>
            {t('realname_text29', '企业认证')}
          </div>
        </div>
      </div>

      <Card className='p-5 sm:p-6'>
        <div className='space-y-4'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label>
                {t('realname_text2', '企业全称')}
                <span className='ml-0.5 text-destructive'>*</span>
              </Label>
              <Input
                value={form.company}
                placeholder={t('realname_text3', '请输入企业全称')}
                onChange={(e) => setField('company', e.target.value)}
              />
              {errors.company && (
                <p className='text-xs text-destructive'>{errors.company}</p>
              )}
            </div>

            <div className='space-y-2'>
              <Label>
                {t('realname_text4', '统一社会信用代码')}
                <span className='ml-0.5 text-destructive'>*</span>
              </Label>
              <Input
                value={form.company_organ_code}
                placeholder={t('realname_text5', '请输入企业统一社会信用代码')}
                onChange={(e) => setField('company_organ_code', e.target.value)}
              />
              {errors.company_organ_code && (
                <p className='text-xs text-destructive'>{errors.company_organ_code}</p>
              )}
            </div>
          </div>

          {templateOpen && (
            <>
              <div className='space-y-2 border-t pt-4'>
                <Label>
                  {t('realname_text89', '认证身份')}
                  <span className='ml-0.5 text-destructive'>*</span>
                </Label>
                <div className='flex flex-wrap gap-2'>
                  <button
                    type='button'
                    onClick={() => setField('legal_person_type', '1')}
                    className={cn(
                      'rounded-md border px-4 py-2 text-sm transition-colors',
                      form.legal_person_type === '1'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'hover:border-primary/50'
                    )}
                  >
                    {t('realname_text90', '法人')}
                  </button>
                  <button
                    type='button'
                    onClick={() => setField('legal_person_type', '2')}
                    className={cn(
                      'rounded-md border px-4 py-2 text-sm transition-colors',
                      form.legal_person_type === '2'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'hover:border-primary/50'
                    )}
                  >
                    {t('realname_text91', '法人代表')}
                  </button>
                </div>
              </div>

              {showAuthLetter && (
                <div className='space-y-2 border-t pt-4'>
                  <Label>
                    {t('realname_text92', '授权委托书')}
                    <span className='ml-0.5 text-destructive'>*</span>
                  </Label>
                  <div className='flex flex-wrap items-center gap-3'>
                    <AuthLetterUpload
                      value={form.auth_letter}
                      onChange={(v) => setField('auth_letter', v)}
                    />
                    {info?.certification_auth_template_url && (
                      <a
                        href={info.certification_auth_template_url}
                        target='_blank'
                        rel='noreferrer'
                        className='text-xs text-primary hover:underline'
                      >
                        {t('realname_text93', '点击下载授权模板')}
                      </a>
                    )}
                  </div>
                  {errors.auth_letter && (
                    <p className='text-xs text-destructive'>{errors.auth_letter}</p>
                  )}
                </div>
              )}
            </>
          )}

          {customFields.length > 0 && (
            <div className='border-t pt-4'>
              <CustomFieldsForm
                fields={customFields}
                values={form.custom_fields}
                onChange={setCustomField}
              />
            </div>
          )}

          {uploadOpen && (
            <div className='border-t pt-4'>
              <ImageUploadField
                value={imgThree}
                onChange={setImgThree}
                label={`${t('realname_text7', '营业执照(允许的后缀名: .jpg、.gif、.jpeg、png)')} *`}
              />
            </div>
          )}
        </div>

        <Separator className='my-5' />
        <div className='flex items-center justify-end gap-3'>
          <Button variant='outline' onClick={() => navigate({ to: selectUrl })}>
            {t('realname_text8', '上一步')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className='mr-1 h-4 w-4 animate-spin' />}
            {submitting
              ? t('realname_text9', '上传中')
              : t('realname_text10', '下一步')}
          </Button>
        </div>
      </Card>
    </div>
  )
}

/**
 * 授权委托书文件上传（官方 el-upload 普通文件按钮，无图片回显）。
 * 上传成功回填 save_name，移除可重新上传。
 */
function AuthLetterUpload({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const { t } = useCertificationLang()
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const errorKey = checkUploadFileLocal(file)
    if (errorKey) {
      toast.warning(t(errorKey))
      return
    }
    setUploading(true)
    try {
      const res = await uploadTicketFile(file)
      if (res.status === 200 && res.data?.save_name) {
        onChange(res.data.save_name)
      } else {
        toast.error(res.msg || '上传失败')
      }
    } catch (error) {
      toast.error(getErrorMessage(error, '上传失败'))
    } finally {
      setUploading(false)
    }
  }

  if (value) {
    return (
      <span className='inline-flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-xs'>
        {value}
        <button
          type='button'
          aria-label='移除'
          className='text-muted-foreground hover:text-foreground'
          onClick={() => onChange('')}
        >
          ✕
        </button>
      </span>
    )
  }

  return (
    <span>
      <Button
        type='button'
        variant='outline'
        size='sm'
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className='mr-1 h-3.5 w-3.5 animate-spin' />
        ) : (
          <Upload className='mr-1 h-3.5 w-3.5' />
        )}
        {uploading
          ? t('realname_text9', '上传中')
          : t('realname_text95', '上传授权委托书')}
      </Button>
      <input
        ref={inputRef}
        type='file'
        hidden
        accept='.jpg,.gif,.jpeg,.png'
        onChange={handleFile}
      />
    </span>
  )
}

function checkUploadFileLocal(file: File): string | null {
  if (/[!@^&"'/\\]/.test(file.name)) return 'realname_text87'
  if (file.size > 1024 * 1024 * 3) return 'realname_text86'
  return null
}
