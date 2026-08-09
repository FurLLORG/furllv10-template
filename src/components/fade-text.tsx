import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type FadeTextProps = {
  children: React.ReactNode
  className?: string
  contentClassName?: string
}

// 超出部分不做省略号、不换行：右侧透明度渐变到 0（mask 渐隐）
const FADE_MASK = {
  WebkitMaskImage: 'linear-gradient(to right, black 82%, transparent 100%)',
  maskImage: 'linear-gradient(to right, black 82%, transparent 100%)',
}

/**
 * 单行文本：内容超出容器宽度时右侧渐变渐隐（不换行、无省略号），
 * 鼠标悬浮显示完整内容（Tooltip）。未溢出时不加 mask，避免短文本尾部被误淡出。
 */
export function FadeText({
  children,
  className = '',
  contentClassName = '',
}: FadeTextProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const [isOverflown, setIsOverflown] = useState(false)

  // Use ref callback to check overflow when element is mounted
  const refCallback = (node: HTMLSpanElement | null) => {
    ref.current = node
    if (node && node.scrollWidth > node.clientWidth + 1) {
      queueMicrotask(() => setIsOverflown(true))
    }
  }

  const base = cn('block whitespace-nowrap', className)

  if (!isOverflown) {
    return (
      <span ref={refCallback} className={base}>
        {children}
      </span>
    )
  }

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            ref={refCallback}
            className={cn(base, 'cursor-help overflow-hidden')}
            style={FADE_MASK}
          >
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent side='top' align='start' className={cn('max-w-xs', contentClassName)}>
          <p className='break-words text-white'>{children}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
