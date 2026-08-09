import type { CertificationInfoData } from '@/api'
import { cn } from '@/lib/utils'

/** 证件类型选项（官方 id_card_type：1身份证 2港澳通行证 3台湾通行证 4港澳居住证 5台湾居住证 6海外护照 7中国以外驾照 8其他） */
export const ID_CARD_TYPES: Array<{ labelKey: string; value: number }> = [
  { labelKey: 'realname_text68', value: 1 },
  { labelKey: 'realname_text70', value: 2 },
  { labelKey: 'realname_text72', value: 3 },
  { labelKey: 'realname_text69', value: 4 },
  { labelKey: 'realname_text71', value: 5 },
  { labelKey: 'realname_text76', value: 6 },
  { labelKey: 'realname_text77', value: 7 },
  { labelKey: 'realname_text78', value: 8 },
]

const FILE_NAME_RE = /[!@^&"'/\\]/

/** 通用前置校验（官方 onUpload/beforeUpload：文件名 + 3MB 限制） */
export function checkUploadFile(file: File): string | null {
  if (FILE_NAME_RE.test(file.name)) return 'realname_text87'
  if (file.size > 1024 * 1024 * 3) return 'realname_text86'
  return null
}

/** 认证信息里是否必须上传证件照（官方 certification_upload == 1） */
export function needUploadImages(info?: CertificationInfoData | null): boolean {
  return Number(info?.certification_upload ?? 0) === 1
}

/** 授权模板开关（官方 certification_auth_template_open == 1） */
export function authTemplateOpen(info?: CertificationInfoData | null): boolean {
  return Number(info?.certification_auth_template_open ?? 0) === 1
}

/** 单选卡片选中态样式 */
export function typeCardSelected(active: boolean): string {
  return cn(
    'cursor-pointer rounded-lg border p-4 transition-colors',
    active
      ? 'border-primary bg-primary/5 ring-1 ring-primary'
      : 'border-border hover:border-primary/50'
  )
}
