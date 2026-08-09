import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Eye, ImagePlus, Loader2, Upload, X } from 'lucide-react'
import {
  uploadTicketFile,
  type CertificationCustomFieldItem,
} from '@/api'
import { useCertificationLang } from '@/hooks/use-certification-lang'
import { getErrorMessage } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { checkUploadFile } from './certification-utils'

/**
 * 证件照/营业执照单图上传（官方 el-upload list-type=picture-card + 进度）。
 * 上传成功回调拿到 save_name；图片预览用本地 objectURL（官方用 file.url 即时回显）。
 */
export function ImageUploadField({
  value,
  onChange,
  label,
  tip,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  tip?: string
  disabled?: boolean
}) {
  const { t } = useCertificationLang()
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || disabled) return
    const errorKey = checkUploadFile(file)
    if (errorKey) {
      toast.warning(t(errorKey))
      return
    }
    setUploading(true)
    setPreview(URL.createObjectURL(file))
    try {
      const res = await uploadTicketFile(file, (percent) => {
        // 进度由 loading 态覆盖即可，无需单独展示百分比
        void percent
      })
      if (res.status === 200 && res.data.save_name) {
        onChange(res.data.save_name)
      } else {
        setPreview('')
        toast.error(res.msg || '上传失败')
      }
    } catch (error) {
      setPreview('')
      toast.error(getErrorMessage(error, '上传失败'))
    } finally {
      setUploading(false)
    }
  }

  function handleRemove() {
    onChange('')
    setPreview('')
  }

  return (
    <div className='space-y-2'>
      <Label>{label}</Label>
      <div className='flex items-start gap-3'>
        {value ? (
          <div className='relative overflow-hidden rounded-md border'>
            {preview || value ? (
              <img
                src={preview}
                alt={label}
                className='h-24 w-36 object-cover'
                onError={(e) => {
                  // save_name 回填（如编辑回显）无本地预览时隐藏占位
                  ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                }}
              />
            ) : null}
            {!preview && (
              <div className='flex h-24 w-36 items-center justify-center text-xs text-muted-foreground'>
                {t('realname_text17', '上传文件')}
              </div>
            )}
            <div className='absolute inset-0 flex items-center justify-center gap-1 bg-black/30 opacity-0 transition-opacity hover:opacity-100'>
              {preview && (
                <button
                  type='button'
                  aria-label='预览'
                  className='rounded bg-white/20 p-1 text-white'
                  onClick={() => setPreviewOpen(true)}
                >
                  <Eye className='h-4 w-4' />
                </button>
              )}
              <button
                type='button'
                aria-label='移除'
                className='rounded bg-white/20 p-1 text-white'
                onClick={handleRemove}
              >
                <X className='h-4 w-4' />
              </button>
            </div>
          </div>
        ) : (
          <button
            type='button'
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
            className='flex h-24 w-36 flex-col items-center justify-center gap-1 rounded-md border border-dashed text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed'
          >
            {uploading ? (
              <>
                <Loader2 className='h-5 w-5 animate-spin' />
                {t('realname_text9', '上传中')}
              </>
            ) : (
              <>
                <ImagePlus className='h-5 w-5' />
                {t('realname_text17', '上传文件')}
              </>
            )}
          </button>
        )}
        <input
          ref={inputRef}
          type='file'
          hidden
          accept='.jpg,.gif,.jpeg,.png'
          onChange={handleFile}
        />
      </div>
      {tip && <p className='text-xs text-muted-foreground'>{tip}</p>}

      <Dialog open={previewOpen} onOpenChange={(open) => !open && setPreviewOpen(false)}>
        <DialogContent className='w-fit! max-w-[90vw]! border-0 bg-transparent p-0 shadow-none'>
          <DialogTitle className='sr-only'>{label}</DialogTitle>
          {preview && (
            <img
              src={preview}
              alt={label}
              className='max-h-[85vh] w-auto max-w-[85vw] rounded-lg object-contain'
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** 自定义文件上传（官方 el-upload limit=1 + list-type=picture-card，值存 save_name 数组） */
function CustomFileField({
  field: _field,
  value,
  onChange,
  disabled,
}: {
  field: string
  value: string[]
  onChange: (values: string[]) => void
  disabled?: boolean
}) {
  const { t } = useCertificationLang()
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || disabled) return
    const errorKey = checkUploadFile(file)
    if (errorKey) {
      toast.warning(t(errorKey))
      return
    }
    setUploading(true)
    try {
      const res = await uploadTicketFile(file)
      if (res.status === 200 && res.data.save_name) {
        onChange([...(value ?? []), res.data.save_name])
      } else {
        toast.error(res.msg || '上传失败')
      }
    } catch (error) {
      toast.error(getErrorMessage(error, '上传失败'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className='flex items-center gap-3'>
      {uploading ? (
        <span className='inline-flex items-center gap-1 text-xs text-muted-foreground'>
          <Loader2 className='h-3.5 w-3.5 animate-spin' />
          {t('realname_text9', '上传中')}
        </span>
      ) : (
        <>
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className='mr-1 h-3.5 w-3.5' />
            {t('realname_text17', '上传文件')}
          </Button>
          <input
            ref={inputRef}
            type='file'
            hidden
            accept='.jpg,.gif,.jpeg,.png'
            onChange={handleFile}
          />
        </>
      )}
      {(value ?? []).map((name, index) => (
        <div
          key={`${name}-${index}`}
          className='inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs'
        >
          {name}
          {!disabled && (
            <button
              type='button'
              aria-label='移除'
              className='text-muted-foreground hover:text-foreground'
              onClick={() => onChange((value ?? []).filter((v) => v !== name))}
            >
              <X className='h-3 w-3' />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * 实名认证自定义字段渲染（官方 custom_fieldsObj：text/select/file 三型）。
 * value 为 Record<field, string|string[]|number>，file 型存数组、其余存字符串。
 */
export function CustomFieldsForm({
  fields,
  values,
  onChange,
  disabled,
}: {
  fields: CertificationCustomFieldItem[]
  values: Record<string, string | string[] | number>
  onChange: (field: string, value: string | string[] | number) => void
  disabled?: boolean
}) {
  const { t } = useCertificationLang()

  return (
    <div className='space-y-4'>
      {fields.map((item) => (
        <div key={item.field} className='space-y-2'>
          <Label>
            {item.title}
            {item.required && <span className='ml-0.5 text-destructive'>*</span>}
          </Label>
          {item.type === 'text' && (
            <Input
              value={String(values[item.field] ?? '')}
              disabled={disabled}
              onChange={(e) => onChange(item.field, e.target.value)}
              placeholder={`${t('realname_text96', 'Please enter')} ${item.title}`}
            />
          )}
          {item.type === 'select' && (
            <Select
              value={String(values[item.field] ?? '')}
              disabled={disabled}
              onValueChange={(v) => onChange(item.field, v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={`${t('realname_text97', 'Please select')} ${item.title}`} />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(item.options ?? {}).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {item.type === 'file' && (
            <CustomFileField
              field={item.field}
              value={Array.isArray(values[item.field]) ? (values[item.field] as string[]) : []}
              onChange={(v) => onChange(item.field, v)}
              disabled={disabled}
            />
          )}
          {item.tip && <p className='text-xs text-muted-foreground'>{item.tip}</p>}
        </div>
      ))}
    </div>
  )
}
