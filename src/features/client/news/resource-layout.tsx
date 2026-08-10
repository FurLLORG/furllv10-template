import { useLayoutEffect, useRef, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { BookOpen, FileText, Newspaper, Search, X } from 'lucide-react'
import { useAddons } from '@/hooks/use-addons'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export type ResourceTabKey = 'help' | 'news' | 'download'

/** 上一次激活 tab 的下标（模块级，跨 tab 路由重挂载保持，用于滑条过渡起始位） */
let lastResourceTabIndex: number | null = null

/**
 * 三个资源页共用的装饰背景图（同一文件名 source_back.png，不同插件目录）。
 * 切换帮助中心/新闻中心/文件下载 tab 时整页重挂载，图片会重新加载（闪烁）。
 * 这里在首个资源页挂载时一次性预加载进浏览器缓存，之后切换 tab 不再重新拉取。
 */
const RESOURCE_BACK_IMGS = [
  '/plugins/addon/idcsmart_help/template/clientarea/pc/default/img/source/source_back.png',
  '/plugins/addon/idcsmart_news/template/clientarea/pc/default/img/source/source_back.png',
  '/plugins/addon/idcsmart_file_download/template/clientarea/pc/default/img/source/source_back.png',
]
let resourceBackImgPreloaded = false
function preloadResourceBackImgs() {
  if (resourceBackImgPreloaded) return
  resourceBackImgPreloaded = true
  for (const url of RESOURCE_BACK_IMGS) {
    const img = new Image()
    img.src = url
    // 提前解码进解码器缓存，配合 <img decoding="sync"> 让重挂载时首帧即画出，不闪
    //（jsdom 无 decode，需判空）
    if (typeof img.decode === 'function') img.decode().catch(() => {})
  }
}

/** 三个资源中心 tab 的文案（各插件语言 key 不同，由页面自行取好传入） */
export interface ResourceTabLabels {
  help: string
  news: string
  download: string
}

/** 资源中心各 tab 内容体公共 props（搜索已提升到持久 header，各 body 只消费 appliedKeywords） */
export interface ResourceBodyProps {
  appliedKeywords: string
}

/** 资源中心三插件（idcsmart_help / idcsmart_news / idcsmart_file_download） */
const RESOURCE_PLUGIN_NAMES = {
  help: 'idcsmarthelp',
  news: 'idcsmartnews',
  download: 'idcsmartfiledownload',
} as const

/**
 * 资源中心顶部 tab 栏（官方 el-tabs 下划线风格）。
 * 点击 tab 在三个插件各自的 source.htm 间跳转（官方 handleClick：location.href 到对应插件 source.htm）。
 */
export function ResourceTabs({
  active,
  labels,
  onTabChange,
}: {
  active: ResourceTabKey
  labels: ResourceTabLabels
  /** 传了则在同页内切换（不整页跳转，header 保持挂载）；不传则跳对应插件 source.htm */
  onTabChange?: (key: ResourceTabKey) => void
}) {
  const navigate = useNavigate()
  const { addons } = useAddons()

  // 上一次激活 tab 的下标（模块级：三个 tab 是独立路由，切 tab 会整页重挂载，
  // 用模块变量记住旧位置，让新挂载的 tab 栏从旧 tab 平滑滑到新 tab）
  const containerRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const indicatorRef = useRef<HTMLSpanElement>(null)
  // 记录上一次渲染的 activeIndex，用于检测真实的 tab 切换并在同一次挂载内补滑动动画。
  // （壳组件在切 tab 时不会重挂载，只改 active 属性；旧版用 didPositionRef 只在挂载时
  // 定位一次，导致第二次及以后切 tab 指示条永远停在初始位置 → 动画不显示。）
  const prevActiveIndexRef = useRef<number | null>(null)

  const pluginId = (name: string) =>
    addons.find((a) => a.name.toLowerCase() === name)?.id

  const tabs: Array<{
    key: ResourceTabKey
    label: string
    icon: ReactNode
    id?: number
  }> = []
  if (pluginId(RESOURCE_PLUGIN_NAMES.help) != null) {
    tabs.push({
      key: 'help',
      label: labels.help,
      icon: <BookOpen className='h-4 w-4' />,
      id: pluginId(RESOURCE_PLUGIN_NAMES.help),
    })
  }
  if (pluginId(RESOURCE_PLUGIN_NAMES.news) != null) {
    tabs.push({
      key: 'news',
      label: labels.news,
      icon: <Newspaper className='h-4 w-4' />,
      id: pluginId(RESOURCE_PLUGIN_NAMES.news),
    })
  }
  if (pluginId(RESOURCE_PLUGIN_NAMES.download) != null) {
    tabs.push({
      key: 'download',
      label: labels.download,
      icon: <FileText className='h-4 w-4' />,
      id: pluginId(RESOURCE_PLUGIN_NAMES.download),
    })
  }

  const activeIndex = tabs.findIndex((tab) => tab.key === active)

  useLayoutEffect(() => {
    const activeBtn = tabRefs.current[activeIndex]
    const el = indicatorRef.current
    if (!activeBtn || !el) return

    // StrictMode（DEV 下 setup→cleanup→setup 均在 paint 前）时，第二次 setup 的
    // prevActiveIndexRef.current 已等于 activeIndex → fromIndex 与 activeIndex 相同，
    // prevBtn 为 null，直接定位不触发动画，安全。真正的 tab 切换（activeIndex 变化）
    // 才会从旧 tab 滑到新 tab。
    const prevActive = prevActiveIndexRef.current
    prevActiveIndexRef.current = activeIndex

    // 首次挂载 prevActive 为 null：若模块级记住了上一个资源 tab（跨页面再次进入资源中心），
    // 仍可从旧 tab 滑过来；否则直接定位到当前 tab。
    const fromIndex = prevActive ?? lastResourceTabIndex
    const prevBtn =
      fromIndex != null && fromIndex !== activeIndex
        ? tabRefs.current[fromIndex]
        : null
    lastResourceTabIndex = activeIndex

    const target = {
      left: activeBtn.offsetLeft,
      width: activeBtn.offsetWidth,
    }
    if (prevBtn) {
      // 从旧 tab 平滑滑到新 tab：先无过渡定位到旧位置，强制 reflow，
      // 让浏览器记录起始态，再开过渡移动到新位置 → 才会真的触发线性动画
      el.style.transition = 'none'
      el.style.left = `${prevBtn.offsetLeft}px`
      el.style.width = `${prevBtn.offsetWidth}px`
      void el.offsetWidth // force reflow
      el.style.transition =
        'left 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      el.style.left = `${target.left}px`
      el.style.width = `${target.width}px`
    } else {
      el.style.transition = 'none'
      el.style.left = `${target.left}px`
      el.style.width = `${target.width}px`
    }
  }, [activeIndex, tabs.length])

  return (
    <div className='border-b border-[#dcdfe6] px-4'>
      <div
        ref={containerRef}
        className='no-scrollbar relative flex items-center gap-8 overflow-x-auto'
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.key}
            ref={(el) => {
              tabRefs.current[index] = el
            }}
            type='button'
            onClick={() => {
              if (tab.key === active) return
              if (onTabChange) {
                onTabChange(tab.key)
              } else if (tab.id != null) {
                navigate({ href: `/plugin/${tab.id}/source.htm` })
              }
            }}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 pt-2 pb-3 text-sm font-medium whitespace-nowrap transition-colors',
              active === tab.key
                ? 'text-primary'
                : 'text-[#303133] hover:text-primary'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
        {/* 滑动的下划线指示条（从旧 tab 平滑过渡到新 tab） */}
        <span
          ref={indicatorRef}
          aria-hidden
          className='pointer-events-none absolute bottom-0 h-[2px] bg-primary'
          style={{ left: 0, width: 0 }}
        />
      </div>
    </div>
  )
}

/**
 * 资源中心页面公共壳（官方 source.html 的 main-card）：
 * 标题 + 搜索框 + 装饰背景图（back-img）+ 下划线 tab 栏 + 内容区。
 * 三个插件页（帮助中心/新闻中心/文件下载）共用，各自传入自己的标题/搜索/语言。
 */
export function ResourceLayout({
  title,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  onSearchSubmit,
  onSearchClear,
  backImg,
  active,
  labels,
  onTabChange,
  children,
}: {
  title: string
  searchPlaceholder: string
  searchValue: string
  onSearchChange: (value: string) => void
  onSearchSubmit: (e: FormEvent) => void
  onSearchClear?: () => void
  backImg: string
  active: ResourceTabKey
  labels: ResourceTabLabels
  /** 传了则在同页内切换内容（header 保持挂载）；不传则整页跳转 */
  onTabChange?: (key: ResourceTabKey) => void
  children: ReactNode
}) {
  preloadResourceBackImgs()

  return (
    <Card className='overflow-hidden'>
      {/* 官方 main-card：标题 + 搜索 + 装饰背景图（官方无分割线） */}
      <div className='relative isolate overflow-hidden p-4 sm:p-6'>
        <h1 className='mb-6 text-[28px] font-semibold text-[#171725]'>
          {title}
        </h1>
        <form onSubmit={onSearchSubmit} className='relative w-full sm:w-[320px]'>
          <Search className='pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className='h-[46px] bg-background pr-10'
          />
          {searchValue && (
            <button
              type='button'
              aria-label='清除搜索'
              onClick={onSearchClear}
              className='absolute top-1/2 right-8 -translate-y-1/2 text-muted-foreground hover:text-foreground'
            >
              <X className='h-4 w-4' />
            </button>
          )}
        </form>
        {/* 官方 .back-img 装饰图（绝对定位，位于标题/搜索后方） */}
        <img
          src={backImg}
          alt=''
          aria-hidden
          decoding='sync'
          loading='eager'
          className='pointer-events-none absolute top-1/2 right-8 -z-10 hidden w-[370px] -translate-y-1/2 select-none sm:block'
        />
      </div>

      <ResourceTabs active={active} labels={labels} onTabChange={onTabChange} />

      {children}
    </Card>
  )
}

/** 重试按钮（各资源页加载失败统一用） */
export function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant='outline' size='sm' onClick={onClick}>
      重试
    </Button>
  )
}
