import { cn } from '@/lib/utils'
import { extractPreviewCode } from '@/lib/preview'

/**
 * 配置概要 / 购物车 preview 行图标：按行名区分，从 value 首段提取
 * 国家码（"US 美国轻量区"）或系统名（"CentOS CentOS-7.6.1810-x64"），
 * 渲染国旗（/upload/common/country/{code}.png）或系统图标（官方 SVG）。
 * 国旗为 3:2 横版（h-3.5 w-5），系统图标为方形（h-4 w-4，不裁切）。
 */

const SYSTEM_ICON_DIR =
  '/plugins/reserver/mf_finance/template/clientarea/pc/default/img/remf_finance'

interface PreviewIconProps {
  /** preview 行名（"数据中心" / "操作系统"） */
  name?: string
  /** preview 行值（"US 美国轻量区" / "CentOS CentOS-7.6.1810-x64"） */
  value?: string
  className?: string
}

function isCountryName(name?: string): boolean {
  return name === '数据中心' || name === '地域'
}

function isSystemName(name?: string): boolean {
  return name === '操作系统' || name === '镜像'
}

export function PreviewIcon({ name, value, className }: PreviewIconProps) {
  const code = extractPreviewCode(value)
  if (!code) return null
  if (isCountryName(name)) {
    return (
      <img
        src={`/upload/common/country/${code}.png`}
        alt=''
        loading='lazy'
        onError={(e) => {
          e.currentTarget.style.display = 'none'
        }}
        className={cn('h-3.5 w-5 shrink-0 object-cover', className)}
      />
    )
  }
  if (isSystemName(name)) {
    return (
      <img
        src={`${SYSTEM_ICON_DIR}/${code}.svg`}
        alt=''
        loading='lazy'
        onError={(e) => {
          e.currentTarget.style.display = 'none'
        }}
        className={cn('h-4 w-4 shrink-0', className)}
      />
    )
  }
  return null
}
