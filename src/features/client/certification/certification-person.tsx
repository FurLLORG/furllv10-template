import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  fetchCertificationCustomFields,
  fetchCertificationInfo,
  submitCertificationPerson,
  type CertificationCustomFieldItem,
  type CertificationInfoData,
} from '@/api'
import { useCertificationLang } from '@/hooks/use-certification-lang'
import { getErrorMessage } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CustomFieldsForm,
  ImageUploadField,
} from './certification-shared'
import { ID_CARD_TYPES, needUploadImages } from './certification-utils'
import { useCertificationNav } from './nav'

/** 个人认证资料填写页（authentication_person.htm?name=<实名接口>，官方 authenticationPerson.js） */
export function CertificationPersonPage() {
  const navigate = useNavigate()
  const { t } = useCertificationLang()
  const { selectUrl, thirdUrl } = useCertificationNav()

  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const pluginName = params.get('name') ?? ''

  const [info, setInfo] = useState<CertificationInfoData | null>(null)
  const [customFields, setCustomFields] = useState<CertificationCustomFieldItem[]>([])
  const [form, setForm] = useState<{
    card_name: string
    card_type: string
    card_number: string
    phone: string
    custom_fields: Record<string, string | string[] | number>
  }>({
    card_name: '',
    card_type: '1',
    card_number: '',
    phone: '',
    custom_fields: {},
  })
  const [imgOne, setImgOne] = useState('')
  const [imgTwo, setImgTwo] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    fetchCertificationInfo()
      .then((res) => active && setInfo(res.data))
      .catch(() => {})
    if (pluginName) {
      fetchCertificationCustomFields({ name: pluginName, type: 'person' })
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

  function setField(key: 'card_name' | 'card_type' | 'card_number' | 'phone', value: string) {
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
    if (!form.card_name.trim()) next.card_name = t('realname_text13', '请输入您的真实姓名')
    if (!form.card_type) next.card_type = t('realname_text66', '请选择证件类型')
    if (!form.card_number.trim()) next.card_number = t('realname_text67', '请输入证件号码')
    for (const item of customFields) {
      if (item.required) {
        const value = form.custom_fields[item.field]
        if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) {
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
    if (needUploadImages(info)) {
      if (!imgOne) {
        toast.warning(t('realname_text79', '请上传身份证人像页!'))
        return
      }
      if (!imgTwo) {
        toast.warning(t('realname_text80', '请上传身份证国徽页!'))
        return
      }
    }
    setSubmitting(true)
    try {
      const res = await submitCertificationPerson({
        plugin_name: pluginName,
        card_name: form.card_name.trim(),
        card_type: Number(form.card_type),
        card_number: form.card_number.trim(),
        phone: form.phone.trim(),
        img_one: imgOne,
        img_two: imgTwo,
        custom_fields: form.custom_fields,
      })
      if (res.status === 200) {
        toast.success(res.msg)
        navigate({ to: thirdUrl, search: { type: '1' } })
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
            {t('realname_text11', '实名认证')}
          </h1>
          <div className='mt-1 text-sm text-muted-foreground'>
            {t('realname_text25', '个人认证')}
          </div>
        </div>
      </div>

      <Card className='p-5 sm:p-6'>
        <div className='space-y-4'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label>
                {t('realname_text12', '姓名')}
                <span className='ml-0.5 text-destructive'>*</span>
              </Label>
              <Input
                value={form.card_name}
                placeholder={t('realname_text13', '请输入您的真实姓名')}
                onChange={(e) => setField('card_name', e.target.value)}
              />
              {errors.card_name && (
                <p className='text-xs text-destructive'>{errors.card_name}</p>
              )}
            </div>

            <div className='space-y-2'>
              <Label>{t('realname_text14', '手机号')}</Label>
              <Input
                value={form.phone}
                placeholder={t('realname_text15', '请输入您的手机号')}
                onChange={(e) => setField('phone', e.target.value)}
              />
            </div>

            <div className='space-y-2'>
              <Label>
                {t('realname_text16', '证件类型')}
                <span className='ml-0.5 text-destructive'>*</span>
              </Label>
              <Select
                value={form.card_type}
                onValueChange={(v) => setField('card_type', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('realname_text66', '请选择证件类型')} />
                </SelectTrigger>
                <SelectContent>
                  {ID_CARD_TYPES.map((item) => (
                    <SelectItem key={item.value} value={String(item.value)}>
                      {t(item.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.card_type && (
                <p className='text-xs text-destructive'>{errors.card_type}</p>
              )}
            </div>

            <div className='space-y-2'>
              <Label>
                {t('realname_text19', '证件号码')}
                <span className='ml-0.5 text-destructive'>*</span>
              </Label>
              <Input
                value={form.card_number}
                placeholder={t('realname_text18', '请输入您的证件号码')}
                onChange={(e) => setField('card_number', e.target.value)}
              />
              {errors.card_number && (
                <p className='text-xs text-destructive'>{errors.card_number}</p>
              )}
            </div>
          </div>

          {customFields.length > 0 && (
            <div className='border-t pt-4'>
              <CustomFieldsForm
                fields={customFields}
                values={form.custom_fields}
                onChange={setCustomField}
              />
              {errors.custom_fields && (
                <p className='text-xs text-destructive'>{errors.custom_fields}</p>
              )}
            </div>
          )}

          {needUploadImages(info) && (
            <div className='grid gap-4 border-t pt-4 sm:grid-cols-2'>
              <ImageUploadField
                value={imgOne}
                onChange={setImgOne}
                label={`${t('realname_text21', '上传证件照正面')} *`}
                tip={t('realname_text20', '证件照片(允许的后缀名: .jpg、.gif、.jpeg、png)')}
              />
              <ImageUploadField
                value={imgTwo}
                onChange={setImgTwo}
                label={`${t('realname_text22', '上传证件照背面')} *`}
              />
            </div>
          )}
        </div>

        <div className='mt-6 flex items-center justify-end gap-3'>
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
