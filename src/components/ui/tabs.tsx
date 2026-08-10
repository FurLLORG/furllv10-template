import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot='tabs'
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  const listRef = React.useRef<HTMLDivElement>(null)
  const [slider, setSlider] = React.useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  })

  // 滑块定位到当前激活的 trigger（Linear 风格：left/top/width/height 过渡实现滑动）。
  // 用 getBoundingClientRect 相对 list 计算，兼容 flex-wrap 换行（第二排 trigger 的 top 不再固定为 3）
  const updateSlider = React.useCallback(() => {
    const list = listRef.current
    if (!list) return
    const active = list.querySelector<HTMLElement>(
      '[data-slot="tabs-trigger"][data-state="active"]'
    )
    if (!active) return
    const listRect = list.getBoundingClientRect()
    const rect = active.getBoundingClientRect()
    setSlider({
      left: rect.left - listRect.left,
      top: rect.top - listRect.top,
      width: rect.width,
      height: rect.height - 6,
    })
  }, [])

  React.useEffect(() => {
    const list = listRef.current
    if (!list) return
    updateSlider()
    // Radix 通过 data-state 标记激活项，监听其切换以重算滑块位置
    const observer = new MutationObserver(updateSlider)
    observer.observe(list, {
      attributes: true,
      subtree: true,
      attributeFilter: ['data-state'],
    })
    // 容器尺寸变化（窗口缩放/字体加载）时重算；jsdom 无 ResizeObserver，需防御
    let resizeObserver: ResizeObserver | undefined
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateSlider)
      resizeObserver.observe(list)
    }
    return () => {
      observer.disconnect()
      resizeObserver?.disconnect()
    }
  }, [updateSlider])

  return (
    <TabsPrimitive.List
      ref={listRef}
      data-slot='tabs-list'
      className={cn(
        'relative inline-flex h-9 w-fit items-center justify-center rounded-lg bg-muted p-0.75 text-muted-foreground',
        className
      )}
      {...props}
    >
      {/* 激活滑块：先定位完成再显示，避免首帧从 0 滑动 */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute z-0 rounded-md border border-transparent bg-background shadow-sm transition-[left,top,width,height,opacity] duration-300 ease-out dark:border-input dark:bg-input/30',
          slider.width > 0 && slider.height > 0 ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          left: slider.left,
          top: slider.top,
          width: slider.width,
          height: slider.height,
        }}
      />
      {props.children}
    </TabsPrimitive.List>
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot='tabs-trigger'
      className={cn(
        "relative z-10 inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground transition-[color,box-shadow] duration-200 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 dark:text-muted-foreground data-[state=active]:text-foreground dark:data-[state=active]:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot='tabs-content'
      className={cn('flex-1 outline-none', className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
