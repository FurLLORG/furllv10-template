import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface CountdownButtonHandle {
  /** 手动触发倒计时（发送验证码被图形验证码弹窗延迟时，验证通过后再启动） */
  startCountdown: () => void
}

interface CountdownButtonProps
  extends Omit<
    React.ComponentProps<typeof Button>,
    'onClick' | 'children' | 'loading'
  > {
  /** 发送验证码；返回 false 表示失败（不进入倒计时） */
  onSend: () => Promise<boolean | void> | boolean | void
  /** 倒计时秒数，默认 60 */
  seconds?: number
  loading?: boolean
}

/**
 * 发送验证码倒计时按钮（官方 countDownButton 组件）。
 * 点击 onSend 成功（未返回 false）后开始 60s 倒计时。
 * 发送流程被图形验证码延迟时（onSend 返回 false），验证通过后可用 ref 手动 startCountdown()。
 */
export const CountdownButton = forwardRef<
  CountdownButtonHandle,
  CountdownButtonProps
>(function CountdownButton(
  { onSend, seconds = 60, loading, className, disabled, ...props },
  ref
) {
  const [count, setCount] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  useImperativeHandle(ref, () => ({
    startCountdown: () => {
      stopTimer()
      setCount(seconds)
    },
  }))

  useEffect(() => {
    return stopTimer
  }, [])

  useEffect(() => {
    if (count <= 0) {
      stopTimer()
      return
    }
    timerRef.current = setInterval(() => {
      setCount((prev) => {
        if (prev <= 1) {
          stopTimer()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return stopTimer
  }, [count])

  const isCounting = count > 0

  return (
    <Button
      type='button'
      variant='ghost'
      size='sm'
      className={cn(
        'shrink-0 rounded-md bg-primary/10 px-3 text-primary hover:bg-primary/15 hover:text-primary',
        className
      )}
      disabled={disabled || isCounting || loading}
      onClick={async () => {
        const ok = await onSend()
        if (ok !== false) setCount(seconds)
      }}
      {...props}
    >
      {loading ? (
        <Loader2 className='animate-spin' />
      ) : isCounting ? (
        `${count}s`
      ) : (
        '获取验证码'
      )}
    </Button>
  )
})
