import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import {
  fetchCommon,
  fetchHostList,
  fetchTicketConfig,
  fetchTicketDetail,
  fetchTicketStatus,
  fetchTicketType,
  fetchTickets,
  replyTicket,
  urgeTicket,
  closeTicket,
  uploadTicketFile,
  type TicketReplyItem,
} from '@/api'
import { useTicketLang } from '@/hooks/use-ticket-lang'
import { useAddons } from '@/hooks/use-addons'
import { getErrorMessage } from '@/lib/api'
import { sanitizeHtml } from '@/lib/sanitize-html'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ArrowUp,
  FileText,
  Loader2,
  MessagesSquare,
  Paperclip,
  Plus,
  Search as SearchIcon,
  Send,
  Ticket as TicketIcon,
  X,
  XCircle,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'

/**
 * 工单中心（ticket.htm / ticketDetails.htm?id=，需登录）
 *
 * shadcn-admin /chats 双栏布局：左栏工单列表（搜索/类型/状态筛选/分页），
 * 右栏选中工单的对话线程（气泡/引用回复/附件预览下载/粘贴图片上传）+ 回复框。
 * 官方 idcsmart_ticket 插件接口：GET/POST /ticket、/ticket/:id/reply、/ticket/:id/urge|close。
 */

const IMAGE_EXTS = [
  'png',
  'jpg',
  'jpeg',
  'bmp',
  'webp',
  'gif',
  'svg',
  'avif',
  'ico',
  'tif',
  'tiff',
]
const VIDEO_EXTS = ['mp4', 'webm', 'ogg', 'ogv', 'mov', 'm4v', 'mkv', 'avi']

function formatTime(ts?: number): string {
  if (!ts) return '--'
  const d = new Date(ts * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatDay(ts: number): string {
  const d = new Date(ts * 1000)
  const now = new Date()
  const startOfDay = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const diffDays = Math.round(
    (startOfDay(now) - startOfDay(d)) / 86400000
  )
  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 官方 hexToRgb：状态色 12% 透明度底色 */
function hexToRgba(color?: string): string | undefined {
  if (!color) return undefined
  let r = 0
  let g = 0
  let b = 0
  if (color.startsWith('#')) {
    const hex = color.slice(1)
    if (hex.length >= 6) {
      r = parseInt(hex.slice(0, 2), 16)
      g = parseInt(hex.slice(2, 4), 16)
      b = parseInt(hex.slice(4, 6), 16)
    }
  } else if (color.startsWith('rgb')) {
    const matches = color.match(/\d+/g)?.map(Number) ?? []
    r = matches[0] ?? 0
    g = matches[1] ?? 0
    b = matches[2] ?? 0
  }
  return `rgba(${r},${g},${b},0.12)`
}

function extOf(urlOrName?: string): string {
  return (urlOrName ?? '').split('?')[0].split('.').pop()?.toLowerCase() ?? ''
}

/** 是否图片附件：OSS 签名 URL 无扩展名（/console/v1/resource?fid=），故同时匹配文件名 */
function isImageFile(url?: string, name?: string): boolean {
  return IMAGE_EXTS.includes(extOf(url)) || IMAGE_EXTS.includes(extOf(name ?? ''))
}

/** 是否视频附件 */
function isVideoFile(url: string, name?: string): boolean {
  return VIDEO_EXTS.includes(extOf(url)) || VIDEO_EXTS.includes(extOf(name ?? ''))
}

/** 最近 15 分钟内是否已催单（官方 ticket_urge_time_limit_15_m 缓存） */
function isUrgedRecently(lastUrgeTime: number): boolean {
  return (
    lastUrgeTime > 0 && Date.now() - lastUrgeTime * 1000 < 15 * 60 * 1000
  )
}

function downloadUrl(url: string, name: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function TicketCenterPage() {
  const navigate = useNavigate()
  const searchStr = useLocation({ select: (location) => location.searchStr })
  const deepLinkId = useMemo(
    () => Number(new URLSearchParams(searchStr).get('id') ?? '') || 0,
    [searchStr]
  )
  const { t } = useTicketLang()

  // 工单插件 id（FurllHome 插件接口反查），新建工单跳官方插件入口 /plugin/<id>/addTicket.htm
  const { addons } = useAddons()
  const ticketPluginId = useMemo(
    () =>
      addons.find((a) => a.name.toLowerCase() === 'idcsmartticket')?.id ??
      null,
    [addons]
  )
  const addTicketUrl = useMemo(
    () =>
      ticketPluginId
        ? `/plugin/${ticketPluginId}/addTicket.htm`
        : '/addTicket.htm',
    [ticketPluginId]
  )

  // ---------- 列表状态 ----------
  // 深度链接（ticketDetails.htm?id=）：直接打开选中工单的对话（仅初始化，路由切换即重挂载）
  const [selectedId, setSelectedId] = useState<number>(deepLinkId)
  const [mobileSelected, setMobileSelected] = useState(!!deepLinkId)
  const [keyword, setKeyword] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [typeFilter, setTypeFilter] = useState<number>(0)
  /** null=未选（默认未关闭） */
  const [statusIds, setStatusIds] = useState<number[] | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  // ---------- 回复框状态 ----------
  const [replyContent, setReplyContent] = useState('')
  const [pendingFiles, setPendingFiles] = useState<
    Array<{ save_name: string; name: string; url?: string }>
  >([])
  const [uploading, setUploading] = useState<
    Record<string, { name: string; percent: number }>
  >({})
  const [quoteReply, setQuoteReply] = useState<TicketReplyItem | null>(null)
  const [sending, setSending] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ---------- 弹窗/预览 ----------
  const [closeOpen, setCloseOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [urging, setUrging] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')

  // ---------- 数据查询 ----------
  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  useEffect(() => {
    const base = commonQuery.data?.data.website_name || 'FurLL'
    document.title = `${base} - 工单系统`
  }, [commonQuery.data])

  const statusQuery = useQuery({
    queryKey: ['ticket-status'],
    queryFn: fetchTicketStatus,
    retry: false,
  })
  const statuses = useMemo(
    () => statusQuery.data?.data.list ?? [],
    [statusQuery.data]
  )
  // 官方默认筛选：已回复(3) + 全部未完结状态
  const defaultStatusIds = useMemo(() => {
    const ids = new Set<number>([3])
    statuses
      .filter((item) => item.status === 0)
      .forEach((item) => ids.add(item.id))
    return [...ids]
  }, [statuses])

  const typeQuery = useQuery({
    queryKey: ['ticket-type'],
    queryFn: fetchTicketType,
    retry: false,
  })
  const types = useMemo(
    () => typeQuery.data?.data.list ?? [],
    [typeQuery.data]
  )

  const configQuery = useQuery({
    queryKey: ['ticket-config'],
    queryFn: fetchTicketConfig,
    retry: false,
  })
  const notice = configQuery.data?.data

  const listQuery = useQuery({
    queryKey: [
      'ticket-list',
      page,
      limit,
      appliedKeyword,
      typeFilter,
      statusIds ?? defaultStatusIds,
    ],
    queryFn: () =>
      fetchTickets({
        page,
        limit,
        keywords: appliedKeyword || undefined,
        ticket_type_id: typeFilter || undefined,
        status: (statusIds ?? defaultStatusIds).length
          ? (statusIds ?? defaultStatusIds)
          : undefined,
        orderby: 'id',
        sort: 'desc',
      }),
    retry: false,
  })
  const tickets = listQuery.data?.data.list ?? []
  const totalCount = listQuery.data?.data.count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / limit))

  // 关联产品（详情页 host 标签映射）
  const hostQuery = useQuery({
    queryKey: ['ticket-host-list'],
    queryFn: () => fetchHostList({ page: 1, limit: 1000 }),
    retry: false,
  })
  const hostMap = useMemo(() => {
    const map = new Map<number, string>()
    for (const host of hostQuery.data?.data.list ?? []) {
      map.set(host.id, `${host.product_name || '产品'} (${host.name || '--'})`)
    }
    return map
  }, [hostQuery.data])

  // 选中工单详情（官方 60s 自动刷新）
  const detailQuery = useQuery({
    queryKey: ['ticket-detail', selectedId],
    queryFn: () => fetchTicketDetail(selectedId),
    enabled: selectedId > 0,
    refetchInterval: 60_000,
    retry: false,
  })
  const detail = detailQuery.data?.data.ticket

  // 切换工单时清空回复框（渲染期状态调整，官方 React 模式，替代 effect 内 setState）
  const [prevSelectedId, setPrevSelectedId] = useState(selectedId)
  if (prevSelectedId !== selectedId) {
    setPrevSelectedId(selectedId)
    setReplyContent('')
    setPendingFiles([])
    setQuoteReply(null)
  }

  // ---------- 操作 ----------
  function selectTicket(id: number) {
    setSelectedId(id)
    setMobileSelected(true)
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    setAppliedKeyword(keyword.trim())
    setPage(1)
  }

  const closedTexts = [
    t('ticket_text5', '已关闭'),
    '已關閉',
    'Close',
    'Closed',
  ]
  const isClosed = detail ? closedTexts.includes(detail.status) : false
  const canOperate = detail ? detail.can_operate !== 0 && !isClosed : false

  const selectedTicket = tickets.find((item) => item.id === selectedId)
  const urgedRecently = isUrgedRecently(selectedTicket?.last_urge_time ?? 0)

  async function handleUrge() {
    if (!selectedId || urging) return
    if (urgedRecently) {
      toast.info(t('ticket_label16', '已收到您的催单通知，我们将尽快处理您的工单'))
      return
    }
    setUrging(true)
    try {
      const res = await urgeTicket(selectedId)
      toast.success(res.msg || '催单成功')
      listQuery.refetch()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setUrging(false)
    }
  }

  async function handleClose() {
    if (!selectedId || closing) return
    setClosing(true)
    try {
      const res = await closeTicket(selectedId)
      toast.success(res.msg || '关闭成功')
      setCloseOpen(false)
      detailQuery.refetch()
      listQuery.refetch()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setClosing(false)
    }
  }

  // 附件上传（选择文件 / 粘贴图片）
  async function uploadFiles(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      const key = `${file.name}-${file.size}-${Date.now()}`
      setUploading((prev) => ({ ...prev, [key]: { name: file.name, percent: 0 } }))
      try {
        const res = await uploadTicketFile(file, (percent) =>
          setUploading((prev) => ({ ...prev, [key]: { name: file.name, percent } }))
        )
        if (res.status === 200 && res.data.save_name) {
          const preview =
            res.data.image_url || res.data.image_base64 || URL.createObjectURL(file)
          setPendingFiles((prev) => [
            ...prev,
            {
              save_name: res.data.save_name,
              name: file.name,
              url: preview,
            },
          ])
        } else {
          toast.error(res.msg || '上传失败')
        }
      } catch (error) {
        toast.error(getErrorMessage(error, '上传失败'))
      } finally {
        setUploading((prev) => {
          const next = { ...prev }
          delete next[key]
          return next
        })
      }
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items
    if (!items) return
    const images: File[] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.kind !== 'file') continue
      const file = item.getAsFile()
      if (file && (item.type.startsWith('image/') || file.type.startsWith('image/'))) {
        images.push(file)
      }
    }
    if (images.length === 0) return
    e.preventDefault()
    uploadFiles(images)
  }

  async function handleReply() {
    const content = replyContent.trim()
    if (!content || sending || !selectedId) return
    setSending(true)
    try {
      const res = await replyTicket(selectedId, {
        content: content.replace(/\n/g, '<br>'),
        attachment: pendingFiles.map((item) => item.save_name),
        quote_reply_id: quoteReply?.id ?? 0,
      })
      toast.success(res.msg || '回复成功')
      setReplyContent('')
      setPendingFiles([])
      setQuoteReply(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      detailQuery.refetch()
      listQuery.refetch()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSending(false)
    }
  }

  function startQuote(reply: TicketReplyItem) {
    setQuoteReply(reply)
    // 滚动到底部回复框
    requestAnimationFrame(() => {
      document
        .querySelector('[data-ticket-composer]')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  function scrollToReply(replyId: number) {
    const el = document.querySelector<HTMLElement>(`[data-reply-id="${replyId}"]`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('highlight-flash')
    setTimeout(() => el.classList.remove('highlight-flash'), 2000)
  }

  function handleContentClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement
    if (target.tagName === 'IMG') {
      const img = target as HTMLImageElement
      setPreviewUrl(img.currentSrc || img.src)
    }
  }

  // 对话按日期分组（replies 新→旧，展示倒序）
  const replies = useMemo(() => [...(detail?.replies ?? [])].reverse(), [detail])
  const groupedReplies = useMemo(() => {
    const groups: Array<[string, TicketReplyItem[]]> = []
    for (const reply of replies) {
      const key = formatDay(reply.create_time)
      const last = groups[groups.length - 1]
      if (last && last[0] === key) {
        last[1].push(reply)
      } else {
        groups.push([key, [reply]])
      }
    }
    return groups
  }, [replies])

  const selectedType = types.find((item) => item.id === detail?.ticket_type_id)

  const leftHidden = mobileSelected && !!selectedId

  return (
    <div className='flex h-full min-h-[480px] flex-col gap-3'>
      {/* 工单通知（官方 ticket_notice_open 提示条） */}
      {notice?.ticket_notice_open && notice.ticket_notice_description ? (
        <div
          className='rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground [&_p]:m-0 [&_img]:max-w-full'
          dangerouslySetInnerHTML={{
            __html: sanitizeHtml(notice.ticket_notice_description),
          }}
        />
      ) : null}

      <section className='flex min-h-0 flex-1 gap-4'>
        {/* ===== 左栏：工单列表（/chats inbox 风格） ===== */}
        <div
          className={cn(
            'flex min-h-0 w-full shrink-0 flex-col overflow-hidden rounded-lg border bg-background',
            'sm:w-72 lg:w-80 xl:w-96',
            leftHidden && 'hidden sm:flex'
          )}
        >
          <div className='flex items-center justify-between gap-2 border-b px-3 py-2.5'>
            <h1 className='flex items-center gap-2 text-base font-bold'>
              {t('ticket_title', '工单系统')}
              <TicketIcon className='h-4 w-4 text-muted-foreground' />
            </h1>
            <Button size='icon' variant='ghost' title={t('ticket_btn1', '新建工单')} asChild>
              <Link to={addTicketUrl}>
                <Plus className='h-5 w-5' />
              </Link>
            </Button>
          </div>

          <div className='space-y-2 border-b p-3'>
            <form onSubmit={submitSearch} className='relative'>
              <SearchIcon className='pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder={t('ticket_tips1', '请输入工单编号或标题')}
                className='h-9 bg-background pr-7 pl-8'
              />
              {keyword && (
                <button
                  type='button'
                  aria-label='清除搜索'
                  onClick={() => {
                    setKeyword('')
                    setAppliedKeyword('')
                    setPage(1)
                  }}
                  className='absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
                >
                  <X className='h-4 w-4' />
                </button>
              )}
            </form>
            {/* 工单类型 + 状态 同一行 */}
            <div className='flex flex-wrap items-center gap-2'>
              {types.length > 0 && (
                <Select
                  value={typeFilter ? String(typeFilter) : 'all'}
                  onValueChange={(value) => {
                    setTypeFilter(value === 'all' ? 0 : (Number(value) || 0))
                    setPage(1)
                  }}
                >
                  <SelectTrigger className='w-40'>
                    <SelectValue placeholder={t('ticket_tips2', '请选择工单部门')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>全部类型</SelectItem>
                    {types.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {/* 状态筛选（默认=未关闭，官方默认筛选） */}
              <Select
                value={
                  statusIds === null
                    ? 'open'
                    : statusIds.length === 0
                      ? 'all'
                      : String(statusIds[0])
                }
                onValueChange={(value) => {
                  if (value === 'all') setStatusIds([])
                  else if (value === 'open') setStatusIds(null)
                  else setStatusIds([Number(value) || 0])
                  setPage(1)
                }}
              >
                <SelectTrigger className='w-40'>
                  <SelectValue
                    placeholder={t('ticket_tips2', '请选择工单状态')}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>全部</SelectItem>
                  <SelectItem value='open'>未关闭</SelectItem>
                  {statuses.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <ScrollArea className='min-h-0 flex-1'>
            <div className='p-2'>
              {listQuery.isLoading ? (
                <div className='space-y-2 p-2'>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className='h-16 w-full' />
                  ))}
                </div>
              ) : listQuery.error ? (
                <div className='p-6 text-center text-sm text-muted-foreground'>
                  工单加载失败：
                  {getErrorMessage(listQuery.error)}
                </div>
              ) : tickets.length === 0 ? (
                <div className='flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground'>
                  <MessagesSquare className='h-8 w-8' />
                  <p>暂无工单</p>
                  <Button variant='outline' size='sm' asChild>
                    <Link to={addTicketUrl}>{t('ticket_btn1', '新建工单')}</Link>
                  </Button>
                </div>
              ) : (
                tickets.map((ticket) => {
                  const active = ticket.id === selectedId
                  return (
                    <div key={ticket.id}>
                      <button
                        type='button'
                        onClick={() => selectTicket(ticket.id)}
                        className={cn(
                          'flex w-full items-start gap-2 rounded-md px-2 py-2.5 text-start text-sm transition-colors',
                          'hover:bg-accent hover:text-accent-foreground',
                          active && 'bg-muted'
                        )}
                      >
                        <div className='min-w-0 flex-1'>
                          <p className='truncate font-medium'>
                            #{ticket.ticket_num} - {ticket.title}
                          </p>
                          <p className='mt-0.5 truncate text-xs text-muted-foreground'>
                            {ticket.name || '--'}
                            <span className='mx-1'>·</span>
                            {formatTime(ticket.last_reply_time || ticket.post_time)}
                          </p>
                        </div>
                        <span
                          className='mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-medium'
                          style={{
                            color: ticket.color,
                            background: hexToRgba(ticket.color),
                          }}
                        >
                          {ticket.status}
                        </span>
                      </button>
                      <Separator className='my-1' />
                    </div>
                  )
                })
              )}
            </div>
          </ScrollArea>

          {/* 分页（官方 pagination：20/50/100） */}
          {!listQuery.isLoading && !listQuery.error && totalCount > 0 && (
            <div className='flex flex-wrap items-center justify-between gap-2 border-t p-2 text-xs text-muted-foreground'>
              <Select
                value={String(limit)}
                onValueChange={(value) => {
                  setLimit(Number(value))
                  setPage(1)
                }}
              >
                <SelectTrigger className='h-7 w-16 text-xs'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[20, 50, 100].map((item) => (
                    <SelectItem key={item} value={String(item)}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className='flex items-center gap-1'>
                <Button
                  variant='outline'
                  size='sm'
                  className='h-7 px-2'
                  disabled={page <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                >
                  上一页
                </Button>
                <span className='px-1'>
                  {page}/{totalPages}
                </span>
                <Button
                  variant='outline'
                  size='sm'
                  className='h-7 px-2'
                  disabled={page >= totalPages}
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ===== 右栏：对话线程（/chats conversation 风格） ===== */}
        <div
          className={cn(
            'absolute inset-0 start-full z-50 hidden min-h-0 w-full flex-1 flex-col overflow-hidden rounded-lg border bg-background shadow-xs sm:static sm:z-auto sm:flex',
            leftHidden && 'inset-s-0 flex'
          )}
        >
          {selectedId && detail ? (
            <>
              {/* 头部 */}
              <div className='flex flex-none flex-wrap items-center justify-between gap-2 rounded-t-lg border-b bg-card p-3 sm:rounded-t-lg'>
                <div className='flex min-w-0 items-center gap-2'>
                  <Button
                    size='icon'
                    variant='ghost'
                    className='h-8 w-8 shrink-0 sm:hidden'
                    onClick={() => setMobileSelected(false)}
                  >
                    <ArrowLeft className='h-4 w-4' />
                  </Button>
                  <div className='min-w-0'>
                    <div className='flex items-center gap-2'>
                      <h2 className='truncate text-sm font-bold sm:text-base'>
                        #{detail.ticket_num} - {detail.title}
                      </h2>
                      <Badge
                        className='shrink-0 border-transparent text-xs font-medium'
                        style={{
                          color: detail.color,
                          background: hexToRgba(detail.color),
                        }}
                      >
                        {detail.status}
                      </Badge>
                    </div>
                    <div className='mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground'>
                      <span>{selectedType?.name || '--'}</span>
                      <span>·</span>
                      <span>提交于 {formatTime(detail.create_time)}</span>
                      {detail.host_ids && detail.host_ids.length > 0 && (
                        <>
                          <span>·</span>
                          <span className='flex flex-wrap items-center gap-x-1.5'>
                            关联产品：
                            {detail.host_ids.map((hostId) => (
                              <button
                                key={hostId}
                                type='button'
                                className='cursor-pointer text-primary hover:underline'
                                onClick={() =>
                                  navigate({
                                    to: '/productdetail.htm',
                                    search: { id: hostId },
                                  })
                                }
                              >
                                {hostMap.get(hostId) || `产品 #${hostId}`}
                              </button>
                            ))}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className='flex shrink-0 items-center gap-1.5'>
                  {!isClosed && detail.can_operate !== 0 && (
                    <Button
                      variant='outline'
                      size='sm'
                      disabled={urging}
                      onClick={handleUrge}
                    >
                      {urging && <Loader2 className='mr-1 h-3.5 w-3.5 animate-spin' />}
                      {t('ticket_btn4', '催单')}
                    </Button>
                  )}
                  {!isClosed && detail.can_operate !== 0 && (
                    <Button
                      variant='outline'
                      size='sm'
                      className='border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive'
                      onClick={() => setCloseOpen(true)}
                    >
                      {t('ticket_btn7', '关闭工单')}
                    </Button>
                  )}
                </div>
              </div>

              {/* 对话线程 */}
              <ScrollArea className='min-h-0 flex-1'>
                <div className='chat-text-container flex flex-col gap-3 px-4 py-4'>
                  {detailQuery.isLoading ? (
                    <div className='space-y-3'>
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className='h-16 w-3/4' />
                      ))}
                    </div>
                  ) : detailQuery.error ? (
                    <div className='flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground'>
                      <XCircle className='h-8 w-8' />
                      <p>工单详情加载失败：{getErrorMessage(detailQuery.error)}</p>
                      <Button variant='outline' size='sm' onClick={() => detailQuery.refetch()}>
                        重试
                      </Button>
                    </div>
                  ) : groupedReplies.length === 0 ? (
                    <p className='py-10 text-center text-sm text-muted-foreground'>暂无沟通记录</p>
                  ) : (
                    groupedReplies.map(([day, items]) => (
                      <div key={day} className='flex flex-col gap-3'>
                        <div className='text-center text-xs text-muted-foreground'>{day}</div>
                        {items.map((reply) => (
                          <ReplyBubble
                            key={`${reply.id}-${reply.create_time}`}
                            reply={reply}
                            onQuote={startQuote}
                            onImagePreview={setPreviewUrl}
                            onGotoQuote={scrollToReply}
                            onContentClick={handleContentClick}
                          />
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>

              {/* 回复区 */}
              <div data-ticket-composer className='flex flex-none flex-col gap-2 border-t bg-card p-3'>
                {quoteReply && (
                  <div className='flex items-center justify-between gap-2 rounded-md border bg-muted/60 px-3 py-2'>
                    <div className='min-w-0'>
                      <p className='text-xs font-medium text-primary'>
                        {t('quote_reply_title', '正在引用回复')}
                      </p>
                      <p className='line-clamp-1 text-xs text-muted-foreground'>
                        {quoteReply.type === 'Client'
                          ? quoteReply.client_name
                          : quoteReply.admin_name}
                        ：{quoteReply.content?.replace(/<[^>]+>/g, '') || ''}
                      </p>
                    </div>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-6 w-6 shrink-0'
                      onClick={() => setQuoteReply(null)}
                    >
                      <X className='h-3.5 w-3.5' />
                    </Button>
                  </div>
                )}

                {canOperate ? (
                  <>
                    <Textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      onPaste={handlePaste}
                      placeholder={t('ticket_label12', '请输入内容')}
                      maxLength={3000}
                      rows={4}
                      className='resize-none'
                    />
                    {(pendingFiles.length > 0 || Object.keys(uploading).length > 0) && (
                      <div className='flex flex-wrap gap-2'>
                        {Object.entries(uploading).map(([key, item]) => (
                          <span
                            key={key}
                            className='inline-flex max-w-52 items-center gap-1.5 rounded-md border bg-muted px-2 py-1 text-xs'
                          >
                            <FileText className='h-3.5 w-3.5 shrink-0' />
                            <span className='truncate'>{item.name}</span>
                            <span className='tabular-nums text-muted-foreground'>
                              {item.percent}%
                            </span>
                          </span>
                        ))}
                        {pendingFiles.map((file) =>
                          isImageFile(file.url, file.name) ? (
                            <div
                              key={file.save_name}
                              className='group relative size-16 shrink-0 rounded-md border bg-muted'
                            >
                              <button
                                type='button'
                                onClick={() => file.url && setPreviewUrl(file.url)}
                                className='block size-full cursor-zoom-in overflow-hidden rounded-[inherit]'
                                title='点击放大'
                              >
                                <img
                                  src={file.url}
                                  alt={file.name}
                                  className='size-full object-cover transition-opacity group-hover:opacity-90'
                                />
                              </button>
                              <button
                                type='button'
                                aria-label='移除'
                                onClick={() =>
                                  setPendingFiles((prev) =>
                                    prev.filter(
                                      (item) => item.save_name !== file.save_name
                                    )
                                  )
                                }
                                className='absolute -top-1.5 -right-1.5 z-10 rounded-full bg-background p-0.5 text-muted-foreground shadow-sm hover:bg-foreground hover:text-background'
                              >
                                <X className='h-3 w-3' />
                              </button>
                            </div>
                          ) : (
                            <span
                              key={file.save_name}
                              className='inline-flex max-w-52 items-center gap-1 rounded-md border bg-muted px-2 py-1 text-xs'
                            >
                              <FileText className='h-3.5 w-3.5 shrink-0' />
                              <span className='truncate'>{file.name}</span>
                              <button
                                type='button'
                                className='text-muted-foreground hover:text-foreground'
                                onClick={() =>
                                  setPendingFiles((prev) =>
                                    prev.filter(
                                      (item) => item.save_name !== file.save_name
                                    )
                                  )
                                }
                              >
                                <X className='h-3 w-3' />
                              </button>
                            </span>
                          )
                        )}
                      </div>
                    )}
                    <div className='flex items-center justify-between gap-2'>
                      <input
                        ref={fileInputRef}
                        type='file'
                        multiple
                        hidden
                        onChange={(e) => {
                          if (e.target.files) uploadFiles(e.target.files)
                          e.target.value = ''
                        }}
                      />
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Paperclip className='h-4 w-4' />
                        {t('ticket_label13', '上传文件')}
                      </Button>
                      <Button
                        size='sm'
                        disabled={sending || !replyContent.trim()}
                        onClick={handleReply}
                      >
                        {sending && <Loader2 className='mr-1 h-4 w-4 animate-spin' />}
                        <Send className='mr-1 h-4 w-4' />
                        {t('ticket_btn8', '发送')}
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className='py-3 text-center text-sm text-muted-foreground'>
                    {isClosed ? '工单已关闭，不能回复' : '当前工单不可回复'}
                  </p>
                )}
              </div>
            </>
          ) : detailQuery.isLoading && selectedId ? (
            <div className='flex items-center justify-center py-20'>
              <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
            </div>
          ) : detailQuery.error && selectedId ? (
            <div className='flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground'>
              <XCircle className='h-8 w-8' />
              <p>工单详情加载失败：{getErrorMessage(detailQuery.error)}</p>
              <Button variant='outline' size='sm' onClick={() => detailQuery.refetch()}>
                重试
              </Button>
            </div>
          ) : (
            /* 空状态（/chats "Your messages" 风格） */
            <div className='flex flex-1 flex-col items-center justify-center gap-4 p-6'>
              <MessagesSquare className='size-10 text-muted-foreground' />
              <div className='space-y-1 text-center'>
                <h2 className='text-base font-semibold'>
                  {t('ticket_title', '工单系统')}
                </h2>
                <p className='text-sm text-muted-foreground'>
                  选择左侧工单查看沟通记录，或新建工单提交问题
                </p>
              </div>
              <Button asChild>
                <Link to={addTicketUrl}>
                  <Plus className='mr-1 h-4 w-4' />
                  {t('ticket_btn1', '新建工单')}
                </Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* 关闭确认弹窗 */}
      <AlertDialog open={closeOpen} onOpenChange={setCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('ticket_title6', '关闭工单')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('ticket_tips11', '您将关闭工单')}「{detail?.title ?? ''}」，{t('ticket_tips12', '是否继续')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('ticket_btn9', '取消')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleClose} disabled={closing}>
              {closing && <Loader2 className='mr-1 h-4 w-4 animate-spin' />}
              {t('ticket_btn6', '确认')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 图片预览 */}
      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl('')}>
        <DialogContent className='w-fit! max-w-[90vw]! border-0 bg-transparent p-0 shadow-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-100 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-100'>
          {previewUrl && (
            <img
              src={previewUrl}
              alt='预览'
              className='max-h-[85vh] w-auto max-w-[85vw] rounded-lg object-contain'
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ReplyBubble({
  reply,
  onQuote,
  onImagePreview,
  onGotoQuote,
  onContentClick,
}: {
  reply: TicketReplyItem
  onQuote: (reply: TicketReplyItem) => void
  onImagePreview: (url: string) => void
  onGotoQuote: (replyId: number) => void
  onContentClick: (e: React.MouseEvent) => void
}) {
  const { t } = useTicketLang()
  const isClient = reply.type === 'Client'
  const sender = isClient ? reply.client_name : reply.admin_name
  const quote = reply.quote_info && !reply.quote_info.is_deleted ? reply.quote_info : null
  const attachments = reply.attachment ?? []

  return (
    <div
      data-reply-id={reply.id}
      className={cn(
        'group flex flex-col gap-1.5',
        isClient ? 'items-end' : 'items-start'
      )}
    >
      <div
        className={cn(
          'flex items-baseline gap-2 text-xs',
          isClient && 'flex-row-reverse'
        )}
      >
        <span className='font-medium text-foreground'>{sender || (isClient ? '我' : '管理员')}</span>
        <span className='text-muted-foreground'>{formatTime(reply.create_time)}</span>
      </div>

      {quote && (
        <div
          className={cn(
            'max-w-[85%] cursor-pointer rounded-md border-l-2 border-primary/60 bg-muted/70 px-2 py-1.5 text-xs md:max-w-[70%]',
            isClient ? 'mr-1' : 'ml-1'
          )}
          onClick={() => onGotoQuote(quote.id)}
          title={t('quote_goto_original', '跳转到原消息')}
        >
          <div className='flex items-center gap-1.5 text-muted-foreground'>
            <span className='font-medium text-primary'>{quote.sender_name}</span>
            <span>{formatTime(quote.create_time)}</span>
            <ArrowUp className='h-3 w-3' />
          </div>
          <div
            className='line-clamp-2 opacity-80 [&_img]:max-h-8 [&_img]:rounded [&_img]:object-contain'
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(quote.content) }}
          />
        </div>
      )}

      <div
        className={cn(
          'max-w-[85%] break-words px-3 py-2 text-sm shadow-sm md:max-w-[70%]',
          isClient
            ? 'rounded-[16px_16px_0_16px] bg-primary text-primary-foreground'
            : 'rounded-[16px_16px_16px_0] bg-muted text-foreground',
          '[&_img]:max-h-60 [&_img]:max-w-full [&_img]:cursor-zoom-in [&_img]:rounded-md [&_img]:object-contain',
          '[&_p]:m-0 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_table]:w-full',
          isClient && '[&_a]:text-primary-foreground'
        )}
        onClick={(e) => onContentClick(e)}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(reply.content) }}
      />

      {attachments.length > 0 && (
        <div
          className={cn(
            'flex flex-wrap items-start gap-1.5',
            isClient ? 'justify-end' : 'justify-start'
          )}
        >
          {attachments.map((file, index) =>
            isImageFile(file.url, file.name) ? (
              <button
                key={index}
                type='button'
                onClick={() => onImagePreview(file.url)}
                title={file.name}
                className='cursor-pointer overflow-hidden rounded-md border border-border bg-card'
              >
                <img
                  src={file.url}
                  alt={file.name}
                  className='max-h-48 w-auto max-w-56 object-cover transition-opacity hover:opacity-90'
                />
              </button>
            ) : isVideoFile(file.url, file.name) ? (
              <video
                key={index}
                src={file.url}
                controls
                playsInline
                preload='metadata'
                title={file.name}
                className='max-h-56 max-w-64 rounded-md border border-border bg-black'
              />
            ) : (
              <button
                key={index}
                type='button'
                onClick={() => downloadUrl(file.url, file.name)}
                className='inline-flex max-w-56 cursor-pointer items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground'
                title={file.name}
              >
                <FileText className='h-3.5 w-3.5 shrink-0' />
                <span className='truncate'>{file.name}</span>
              </button>
            )
          )}
        </div>
      )}

      {reply.id !== 0 && (
        <button
          type='button'
          onClick={() => onQuote(reply)}
          className={cn(
            'flex items-center gap-1 text-xs text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100',
            isClient ? 'flex-row-reverse' : 'flex-row'
          )}
        >
          {t('quote_reply_button', '引用回复')}
        </button>
      )}
    </div>
  )
}
