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
