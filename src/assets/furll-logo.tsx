import { type SVGProps } from 'react'
import { cn } from '@/lib/utils'

/**
 * FurLL 站点 logo（圆角方块 + F 字标，品牌主色渐变）
 * 尺寸由外层 className 控制（如 size-8 / size-4）
 */
export function FurLLLogo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox='0 0 32 32'
      xmlns='http://www.w3.org/2000/svg'
      fill='none'
      className={cn('size-6', className)}
      {...props}
    >
      <defs>
        <linearGradient id='furll-logo-bg' x1='0' y1='0' x2='32' y2='32'>
          <stop offset='0' stopColor='hsl(221.2 83.2% 53.3%)' />
          <stop offset='1' stopColor='hsl(262.1 83.3% 57.8%)' />
        </linearGradient>
      </defs>
      <rect width='32' height='32' rx='8' fill='url(#furll-logo-bg)' />
      <path
        d='M10 8h13v3.5h-9v3.5h8v3.5h-8V24h-4V8z'
        fill='white'
      />
    </svg>
  )
}
