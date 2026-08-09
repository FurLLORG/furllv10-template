import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

/** 时间戳（秒）→ YYYY-MM-DD HH:mm，0/缺省 → '--'（官方 formateTime filter） */
export function formatTime(ts?: number | string): string {
  const num = Number(ts)
  if (!num || Number.isNaN(num)) return '--'
  const d = new Date(num * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 时间戳（秒）→ YYYY-MM-DD HH:mm:ss（官方 formateTime1 filter） */
export function formatTimeFull(ts?: number | string): string {
  const num = Number(ts)
  if (!num || Number.isNaN(num)) return '--'
  const d = new Date(num * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 时间戳（秒）→ YYYY-MM-DD（官方 formateDate2 filter） */
export function formatDateYmd(ts?: number | string): string {
  const num = Number(ts)
  if (!num || Number.isNaN(num)) return '--'
  const d = new Date(num * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 金额格式化（保留两位小数），空 → '--' */
export function formatMoney(v?: number | string): string {
  const num = Number(v)
  if (v == null || v === '' || Number.isNaN(num)) return '--'
  return num.toFixed(2)
}

/** 整页跳转（react-hooks/immutability 规则禁止在组件内直接赋值 window.location.href） */
export function navigateHref(href: string): void {
  window.location.href = href
}

export interface PageData {
  page: number
  limit: number
  total: number
}

const PAGE_SIZES = [20, 50, 100]

/**
 * 通用分页条（官方 pagination 组件等价物）。
 * 仅受控展示：page/limit/total + 上一页/下一页/每页条数。
 */
export function PaginationBar({
  page,
  limit,
  total,
  onPageChange,
  onLimitChange,
  className,
}: {
  page: number
  limit: number
  total: number
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
  className?: string
}) {
  const pages = Math.max(1, Math.ceil(total / limit))
  const safePage = Math.min(Math.max(1, page), pages)
  const from = total === 0 ? 0 : (safePage - 1) * limit + 1
  const to = Math.min(safePage * limit, total)

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-2 px-1 pt-3',
        className
      )}
    >
      <div className='text-xs text-muted-foreground'>
        {total > 0 ? `${from}-${to} / 共 ${total} 条` : '共 0 条'}
      </div>
      <div className='flex items-center gap-2'>
        <Select
          value={String(limit)}
          onValueChange={(v) => onLimitChange(Number(v))}
        >
          <SelectTrigger className='h-8 w-[86px]'>
            <SelectValue placeholder={String(limit)} />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size} / 页
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant='outline'
          size='icon'
          className='h-8 w-8'
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          aria-label='上一页'
        >
          <ChevronLeft className='h-4 w-4' />
        </Button>
        <span className='min-w-[64px] text-center text-sm tabular-nums'>
          {safePage} / {pages}
        </span>
        <Button
          variant='outline'
          size='icon'
          className='h-8 w-8'
          disabled={safePage >= pages}
          onClick={() => onPageChange(safePage + 1)}
          aria-label='下一页'
        >
          <ChevronRight className='h-4 w-4' />
        </Button>
      </div>
    </div>
  )
}
