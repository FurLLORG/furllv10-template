import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchFileDownloadUrl, fetchFileFolder, fetchFileList } from '@/api'
import { useDownloadLang } from '@/hooks/use-plugin-lang'
import { getErrorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Download, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { RetryButton, type ResourceBodyProps } from './resource-layout'

/** 分类右侧数字标签配色（官方 index%4：suc/war/error/def） */
const FOLDER_TAG_CLASSES = [
  'bg-[#c9f7f5] text-[#00a870]',
  'bg-[#fff4de] text-[#ff9900]',
  'bg-[#ffe2e5] text-[#f53f3f]',
  'bg-[#e1f0ff] text-[#245ff0]',
] as const

/** 官方 formateByte：<1MB 显示 KB，否则 MB */
function formatByte(size?: number): string {
  if (!size || size <= 0) return '--'
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)}KB`
  return `${(size / (1024 * 1024)).toFixed(2)}MB`
}

/**
 * 文件下载内容体（由 ResourceCenterShell 挂载，header/search/tab 在壳上保持不动）。
 *
 * 官方 IdcsmartFileDownload 插件 source.html 下载 tab：右侧文件夹栏（全部+各分类计数）+
 * 左侧文件表格（文件名/描述/类型/大小/操作下载）+ 分页。搜索关键词由壳层（appliedKeywords）传入。
 */
export function FileDownloadBody({ appliedKeywords }: ResourceBodyProps) {
  const { t } = useDownloadLang()

  // 搜索 / 列表状态
  const [curId, setCurId] = useState<number>(0)
  const [curTit, setCurTit] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [downloading, setDownloading] = useState<number | null>(null)

  // 文件夹（官方 getFileFolder → /file/folder）
  const folderQuery = useQuery({
    queryKey: ['file-folder'],
    queryFn: fetchFileFolder,
    retry: false,
  })
  const folders = folderQuery.data?.data.list ?? []
  const folderNum = useMemo(
    () =>
      (folderQuery.data?.data.list ?? []).reduce(
        (sum, item) => sum + (item.file_num || 0),
        0
      ),
    [folderQuery.data]
  )

  // 文件列表（官方 getFileList：addon_idcsmart_file_folder_id + keywords + page/limit）
  const listQuery = useQuery({
    queryKey: ['file-list', page, limit, appliedKeywords, curId],
    queryFn: () =>
      fetchFileList({
        page,
        limit,
        keywords: appliedKeywords || undefined,
        addon_idcsmart_file_folder_id: curId || undefined,
        orderby: 'id',
        sort: 'desc',
      }),
    retry: false,
  })
  const files = listQuery.data?.data.list ?? []
  const totalCount = listQuery.data?.data.count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / limit))

  function selectFolder(id: number, name: string) {
    setCurId(id)
    setCurTit(name)
    setPage(1)
  }

  // 下载（官方 downFile：GET /file/:id/download → window.open(url)）
  async function downFile(id: number) {
    if (downloading != null) return
    setDownloading(id)
    try {
      const res = await fetchFileDownloadUrl(id)
      const url = res.data?.url
      if (url) window.open(url, '_blank')
    } catch {
      // 下载失败：官方仅弹错误提示，这里静默忽略
    } finally {
      setDownloading(null)
    }
  }

  useEffect(() => {
    document.title = `${t('file_download', '文件下载')}`
  }, [t])

  return (
    <div>
      {/* 官方 .box：右侧文件夹栏(com-r-box) + 左侧文件表(com-l-box) */}
      <div className='flex min-h-[480px] flex-col md:flex-row'>
        {/* 右/文件夹栏 */}
        <aside className='w-full shrink-0 border-b p-[30px] shadow-[0_3px_12px_rgba(0,0,0,0.1)] md:order-2 md:ml-[3px] md:w-[358px] md:border-b-0 md:shadow-none'>
          <p className='mb-[30px] text-[20px] leading-none text-[#171725]'>
            {t('file_folder', '文件夹')}
          </p>
          {/* 全部 */}
          <div
            className={cn(
              'mb-[20px] flex w-full cursor-pointer items-center justify-between pl-[20px] text-[16px] text-[#1e2736] transition-colors hover:text-primary',
              curId === 0 && 'font-medium text-primary'
            )}
            onClick={() => selectFolder(0, '')}
          >
            <span>{t('file_all', '全部')}</span>
            <span className='h-[20px] rounded-[3px] bg-[#e6e7eb] px-[5px] text-[13px] leading-[20px] text-[#4e5259]'>
              {folderNum}
            </span>
          </div>
          {/* 文件夹列表 */}
          <div className='space-y-[20px] pl-[10px]'>
            {folderQuery.isLoading ? (
              <div className='space-y-3 py-1'>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className='h-7 w-full' />
                ))}
              </div>
            ) : (
              folders.map((item, index) => {
                const active = curId === item.id
                const tagClass = FOLDER_TAG_CLASSES[index % FOLDER_TAG_CLASSES.length]
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'group relative flex cursor-pointer items-center justify-between pl-[15px] text-[16px] text-[#1e2736] transition-colors hover:text-primary',
                      "before:absolute before:top-1/2 before:left-0 before:h-[18px] before:w-[3px] before:-translate-y-1/2 before:bg-[#e6e7eb] before:content-['']",
                      active && 'font-medium text-primary before:bg-primary'
                    )}
                    onClick={() => selectFolder(item.id, item.name)}
                  >
                    <span className='truncate'>{item.name}</span>
                    <span
                      className={cn(
                        'ml-2 h-[20px] rounded-[3px] px-[5px] text-[13px] leading-[20px]',
                        tagClass
                      )}
                    >
                      {item.file_num > 0 ? item.file_num : 0}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </aside>

        {/* 左/文件表格 */}
        <section className='min-w-0 flex-1 p-4 md:order-1 md:p-6'>
          <div className='mb-4 flex items-center justify-between gap-2 pr-0 sm:pr-[40px]'>
            <h2 className='truncate text-[20px] leading-none font-medium text-[#171725]'>
              {curTit || t('file_all', '全部')}
            </h2>
          </div>

          {listQuery.isLoading ? (
            <div className='space-y-2'>
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className='h-10 w-full' />
              ))}
            </div>
          ) : listQuery.error ? (
            <div className='flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground'>
              <p>文件列表加载失败：{getErrorMessage(listQuery.error)}</p>
              <RetryButton onClick={() => listQuery.refetch()} />
            </div>
          ) : files.length === 0 ? (
            <div className='flex h-[60px] items-center justify-center py-10 text-center text-sm text-[#999]'>
              暂无数据
            </div>
          ) : (
            <Table className='pr-0 sm:pr-[40px]'>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('file_name', '文件名')}</TableHead>
                  <TableHead className='hidden sm:table-cell'>
                    {t('file_des', '文件描述')}
                  </TableHead>
                  <TableHead className='w-24'>{t('file_type', '文件类型')}</TableHead>
                  <TableHead className='hidden w-28 sm:table-cell'>
                    {t('file_size', '大小')}
                  </TableHead>
                  <TableHead className='w-24'>{t('file_opt', '操作')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell>
                      <span className='flex min-w-0 items-center gap-1.5'>
                        <FileText className='h-4 w-4 shrink-0 text-muted-foreground' />
                        <span className='truncate'>{file.name}</span>
                      </span>
                    </TableCell>
                    <TableCell className='hidden max-w-[240px] truncate text-muted-foreground sm:table-cell'>
                      {file.description || '--'}
                    </TableCell>
                    <TableCell className='text-muted-foreground'>{file.filetype}</TableCell>
                    <TableCell className='hidden text-muted-foreground sm:table-cell'>
                      {formatByte(file.filesize)}
                    </TableCell>
                    <TableCell>
                      {downloading === file.id ? (
                        <span className='text-xs text-muted-foreground'>
                          {t('file_downloading', '文件下载中')}
                        </span>
                      ) : (
                        <Button
                          variant='ghost'
                          size='sm'
                          className='h-7 gap-1 px-2 text-primary'
                          onClick={() => downFile(file.id)}
                        >
                          <Download className='h-4 w-4' />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* 分页 */}
          {!listQuery.isLoading && !listQuery.error && totalCount > 0 && (
            <div className='mt-4 flex flex-wrap items-center justify-between gap-2 pr-0 text-xs text-muted-foreground sm:pr-[40px]'>
              <Select
                value={String(limit)}
                onValueChange={(v) => {
                  setLimit(Number(v))
                  setPage(1)
                }}
              >
                <SelectTrigger className='h-7 w-16 text-xs'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 50].map((item) => (
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
        </section>
      </div>
    </div>
  )
}
