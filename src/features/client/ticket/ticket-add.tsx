import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  createTicket,
  fetchCommon,
  fetchHostList,
  fetchTicketType,
  uploadTicketFile,
  type HostListItem,
} from '@/api'
import { useTicketLang } from '@/hooks/use-ticket-lang'
import { getErrorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { ArrowLeft, Check, ChevronsUpDown, FileText, Loader2, Paperclip, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

/**
 * 新建工单（addTicket.htm，需登录）
 * 官方 addTicket.js 表单：工单类型/标题/关联产品/详细描述/附件上传，
 * 提交后跳转 ticketDetails.htm?id=（官方 createTicket 返回 data.id）。
 */

/** 是否已到期（官方 calcShowRenew：due_time > 0 且已过当前时间） */
function isHostDue(dueTime: number): boolean {
  return dueTime > 0 && dueTime <= Math.floor(Date.now() / 1000)
}

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']
function extOf(url?: string): string {
  return (url ?? '').split(/[?#]/)[0].split('.').pop()?.toLowerCase() ?? ''
}
function isImageFile(url?: string, name?: string): boolean {
  return IMAGE_EXTS.includes(extOf(url)) || IMAGE_EXTS.includes(extOf(name))
}

export function AddTicketPage() {
  const navigate = useNavigate()
  const { t } = useTicketLang()

  const [ticketTypeId, setTicketTypeId] = useState<number>(0)
  const [title, setTitle] = useState('')
  const [hostIds, setHostIds] = useState<number[]>([])
  const [content, setContent] = useState('')
  const [pendingFiles, setPendingFiles] = useState<
    Array<{ save_name: string; name: string; url?: string }>
  >([])
  const [uploading, setUploading] = useState<
    Record<string, { name: string; percent: number }>
  >({})
  const [submitting, setSubmitting] = useState(false)
  const [productOpen, setProductOpen] = useState(false)
  const [hostKeyword, setHostKeyword] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  useEffect(() => {
    const base = commonQuery.data?.data.website_name || 'FurLL'
    document.title = `${base} - 新建工单`
  }, [commonQuery.data])

  const typeQuery = useQuery({
    queryKey: ['ticket-type'],
    queryFn: fetchTicketType,
    retry: false,
  })
  const types = typeQuery.data?.data.list ?? []

  // 官方 getHostList：GET /host（scene=ticket），过滤 Deleted，标记已到期
  const hostQuery = useQuery({
    queryKey: ['ticket-host-list'],
    queryFn: () => fetchHostList({ page: 1, limit: 1000, scene: 'ticket' }),
    retry: false,
  })
  const hosts = useMemo<HostListItem[]>(
    () =>
      (hostQuery.data?.data.list ?? [])
        .filter((item) => item.status !== 'Deleted')
        .map((item) => ({ ...item, isDue: isHostDue(item.due_time) })),
    [hostQuery.data]
  )

  function toggleHost(id: number) {
    setHostIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  async function uploadFiles(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      const key = `${file.name}-${file.size}-${Date.now()}`
      setUploading((prev) => ({ ...prev, [key]: { name: file.name, percent: 0 } }))
      try {
        const res = await uploadTicketFile(file, (percent) =>
          setUploading((prev) => ({ ...prev, [key]: { name: file.name, percent } }))
        )
        if (res.status === 200 && res.data.save_name) {
          setPendingFiles((prev) => [
            ...prev,
            {
              save_name: res.data.save_name,
              name: file.name,
              url: URL.createObjectURL(file),
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

  async function handleSubmit() {    if (submitting) return
    if (!title.trim()) {
      toast.warning(t('ticket_tips9', '请输入工单标题'))
      return
    }
    if (!ticketTypeId) {
      toast.warning(t('ticket_tips2', '请选择工单部门'))
      return
    }
    if (!content.trim()) {
      toast.warning(t('ticket_tips6', '请输入问题描述'))
      return
    }
    setSubmitting(true)
    try {
      const res = await createTicket({
        title: title.trim(),
        ticket_type_id: ticketTypeId,
        host_ids: hostIds,
        content: content.replace(/\n/g, '<br>'),
        attachment: pendingFiles.map((item) => item.save_name),
      })
      const id = res.data?.id
      if (id) {
        toast.success(res.msg || '创建成功')
        navigate({ to: '/ticketDetails.htm', search: { id } })
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className='mx-auto max-w-3xl space-y-4'>
      {/* 页面标题区 */}
      <div className='flex items-center gap-2'>
        <Button
          variant='ghost'
          size='sm'
          className='text-muted-foreground hover:text-foreground'
          onClick={() => navigate({ to: '/ticket.htm' })}
        >
          <ArrowLeft className='h-4 w-4' />
          返回工单
        </Button>
        <h1 className='text-2xl font-bold tracking-tight'>
          {t('ticket_title2', '新建工单')}
        </h1>
      </div>

      <div className='space-y-5 rounded-lg border bg-background p-5 sm:p-6'>
        {/* 工单类型 */}
        <div className='grid gap-2'>
          <Label>
            {t('ticket_label2', '工单部门')}
            <span className='ml-0.5 text-destructive'>*</span>
          </Label>
          <Select
            value={ticketTypeId ? String(ticketTypeId) : ''}
            onValueChange={(value) => setTicketTypeId(Number(value) || 0)}
          >
            <SelectTrigger className='w-full sm:max-w-xs'>
              <SelectValue placeholder={t('ticket_tips2', '请选择工单部门')} />
            </SelectTrigger>
            <SelectContent>
              {types.map((item) => (
                <SelectItem key={item.id} value={String(item.id)}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 标题 */}
        <div className='grid gap-2'>
          <Label>
            {t('ticket_label6', '工单标题')}
            <span className='ml-0.5 text-destructive'>*</span>
          </Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('ticket_tips9', '请输入工单标题')}
            maxLength={20}
          />
        </div>

        {/* 关联产品（可搜索多选） */}
        <div className='grid gap-2'>
          <Label>
            {t('ticket_label7', '关联产品')}
            {hostIds.length > 0 && (
              <span className='ml-1 text-xs font-normal text-muted-foreground'>
                已选 {hostIds.length} 项
              </span>
            )}
          </Label>
          <Popover open={productOpen} onOpenChange={setProductOpen}>
            <PopoverTrigger asChild>
              <Button
                type='button'
                variant='outline'
                role='combobox'
                aria-expanded={productOpen}
                className='h-auto min-h-9 w-full justify-between px-3 py-2'
              >
                <div className='flex max-h-20 min-h-9 w-full flex-wrap items-center gap-1 overflow-y-auto py-0.5'>
                  {hostIds.length === 0 ? (
                    <span className='text-muted-foreground'>
                      {t('ticket_tips_choose_product', '请选择关联产品')}
                    </span>
                  ) : (
                    hosts
                      .filter((host) => hostIds.includes(host.id))
                      .map((host) => (
                        <Badge
                          key={host.id}
                          variant='secondary'
                          className='gap-1 rounded-sm px-1.5 py-0.5 text-xs font-normal'
                        >
                          {host.product_name || '产品'} ({host.name || '--'})
                          <span
                            role='button'
                            tabIndex={-1}
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleHost(host.id)
                            }}
                            onMouseDown={(e) => e.preventDefault()}
                            className='ml-0.5 cursor-pointer text-muted-foreground hover:text-foreground'
                            aria-label='移除'
                          >
                            <X className='h-3 w-3' />
                          </span>
                        </Badge>
                      ))
                  )}
                </div>
                <ChevronsUpDown className='h-4 w-4 shrink-0 opacity-50' />
              </Button>
            </PopoverTrigger>
            <PopoverContent className='w-[--radix-popover-trigger-width] p-0' align='start'>
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder='搜索产品名称 / 标识'
                  value={hostKeyword}
                  onValueChange={setHostKeyword}
                />
                <CommandList>
                  {hosts.length === 0 ? (
                    <CommandEmpty>暂无可用产品</CommandEmpty>
                  ) : (
                    <CommandGroup>
                      {hosts
                        .filter((host) => {
                          const kw = hostKeyword.trim().toLowerCase()
                          if (!kw) return true
                          const text = `${host.product_name ?? ''} ${host.name ?? ''}`.toLowerCase()
                          return text.includes(kw)
                        })
                        .map((host) => {
                          const checked = hostIds.includes(host.id)
                          return (
                            <CommandItem
                              key={host.id}
                              value={String(host.id)}
                              onSelect={() => toggleHost(host.id)}
                            >
                              <div
                                className={cn(
                                  'flex size-4 items-center justify-center rounded-sm border border-primary',
                                  checked
                                    ? 'bg-primary text-primary-foreground'
                                    : 'opacity-50 [&_svg]:invisible'
                                )}
                              >
                                <Check className='h-4 w-4 text-background' />
                              </div>
                              <span className='min-w-0 flex-1 truncate'>
                                {host.product_name || '产品'} ({host.name || '--'})
                              </span>
                              {host.isDue && (
                                <Badge variant='outline' className='shrink-0 border-destructive/40 text-destructive'>
                                  {t('ticket_label21', '已到期')}
                                </Badge>
                              )}
                            </CommandItem>
                          )
                        })}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* 详细描述 */}
        <div className='grid gap-2'>
          <Label>
            {t('ticket_label8', '详细描述')}
            <span className='ml-0.5 text-destructive'>*</span>
          </Label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onPaste={handlePaste}
            placeholder={t('ticket_label12', '请输入内容')}
            maxLength={3000}
            rows={6}
            className='resize-none'
          />
          <p className='text-right text-xs text-muted-foreground'>
            {content.length}/3000
          </p>
        </div>

        {/* 附件上传 */}
        <div className='grid gap-2'>
          <Label>{t('ticket_label13', '上传文件')}</Label>
          <div className='flex flex-wrap gap-2'>
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
              variant='outline'
              size='sm'
              onClick={() => fileInputRef.current?.click()}
              disabled={Object.keys(uploading).length > 0}
            >
              <Paperclip className='mr-1 h-4 w-4' />
              选择文件
            </Button>
            {Object.entries(uploading).map(([key, item]) => (
              <span
                key={key}
                className='inline-flex max-w-56 items-center gap-2 rounded-md border bg-muted px-2 py-1 text-xs'
              >
                <FileText className='h-3.5 w-3.5 shrink-0' />
                <span className='truncate'>{item.name}</span>
                <span className='tabular-nums text-muted-foreground'>{item.percent}%</span>
              </span>
            ))}
            {pendingFiles.map((file) =>
              isImageFile(file.url, file.name) ? (
                <div
                  key={file.save_name}
                  className='group relative size-20 shrink-0 rounded-md border bg-muted'
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
                        prev.filter((item) => item.save_name !== file.save_name)
                      )
                    }
                    className='absolute -top-1.5 -right-1.5 z-10 rounded-full bg-background p-0.5 text-muted-foreground shadow-sm hover:bg-foreground hover:text-background'
                  >
                    <X className='h-3.5 w-3.5' />
                  </button>
                </div>
              ) : (
                <span
                  key={file.save_name}
                  className='inline-flex max-w-56 items-center gap-1 rounded-md border bg-muted px-2 py-1 text-xs'
                >
                  <FileText className='h-3.5 w-3.5 shrink-0' />
                  <span className='truncate'>{file.name}</span>
                  <button
                    type='button'
                    className='text-muted-foreground hover:text-foreground'
                    onClick={() =>
                      setPendingFiles((prev) =>
                        prev.filter((item) => item.save_name !== file.save_name)
                      )
                    }
                  >
                    <X className='h-3 w-3' />
                  </button>
                </span>
              )
            )}
          </div>
          <p className='text-xs text-muted-foreground'>支持粘贴图片直接上传</p>
        </div>

        {/* 提交 */}
        <div className='flex justify-end gap-2 border-t pt-4'>
          <Button variant='outline' onClick={() => navigate({ to: '/ticket.htm' })}>
            {t('ticket_btn9', '取消')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className='mr-1 h-4 w-4 animate-spin' />}
            {t('ticket_btn6', '确认')}
          </Button>
        </div>
      </div>
      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl('')}>
        <DialogContent className='w-fit! max-w-[90vw]! border-0 bg-transparent p-0 shadow-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-100 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-100'>
          {previewUrl && (
            <img
              src={previewUrl}
              alt='图片预览'
              className='max-h-[85vh] w-auto max-w-[90vw] rounded-lg object-contain'
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
