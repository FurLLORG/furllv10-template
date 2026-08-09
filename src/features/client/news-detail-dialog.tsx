import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  fetchAnnouncementDetail,
  fetchNewsDetail,
  type NewsDetail,
} from '@/api'
import { useAddons } from '@/hooks/use-addons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'

const ANNOUNCEMENT_PLUGIN_NAME = 'idcsmartannouncement'
const NEWS_PLUGIN_NAME = 'idcsmartnews'

function formatDate(ts?: number): string {
  if (!ts) return '--'
  const d = new Date(ts * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * 新闻/公告详情弹窗
 * - 顶栏公告 → kind='announce'（/announcement/:id），新闻 → kind='news'（/news/:id）
 * - 弹窗内提供「查看全部新闻」入口（列表页尚未开发，先提示）
 */
export function NewsDetailDialog({
  open,
  onOpenChange,
  newsId,
  kind = 'news',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  newsId: number | null
  kind?: 'news' | 'announce'
}) {
  const query = useQuery({
    queryKey: ['client-news-detail', kind, newsId],
    queryFn: async () =>
      kind === 'announce'
        ? fetchAnnouncementDetail(newsId!)
        : fetchNewsDetail(newsId!),
    enabled: open && newsId != null,
    retry: false,
  })

  const raw = query.data?.data as { news?: NewsDetail; announcement?: NewsDetail }
  const news = kind === 'announce' ? (raw?.announcement ?? raw?.news) : raw?.news
  const loading = query.isLoading

  const { addons } = useAddons()
  const announcePluginId = addons.find(
    (a) => a.name.toLowerCase() === ANNOUNCEMENT_PLUGIN_NAME
  )?.id
  const newsPluginId = addons.find(
    (a) => a.name.toLowerCase() === NEWS_PLUGIN_NAME
  )?.id
  const allTarget =
    kind === 'announce'
      ? `/plugin/${announcePluginId}/source.htm`
      : `/plugin/${newsPluginId}/source.htm`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[85vh] flex-col gap-4 overflow-hidden sm:max-w-2xl'>
        <DialogHeader>
          {loading || !news ? (
            <div className='space-y-3'>
              <div className='flex items-center gap-2'>
                <Skeleton className='h-5 w-16 rounded-full' />
                <Skeleton className='h-4 w-24' />
              </div>
              <Skeleton className='h-7 w-3/4' />
            </div>
          ) : (
            <>
              <div className='flex items-center gap-2'>
                {news.type && <Badge variant='secondary'>{news.type}</Badge>}
                <span className='text-xs text-muted-foreground'>
                  {formatDate(news.create_time)}
                </span>
              </div>
              <DialogTitle className='text-lg leading-snug'>
                {news.title}
              </DialogTitle>
            </>
          )}
        </DialogHeader>

        {loading ? (
          <div className='space-y-3'>
            <Skeleton className='h-4 w-full' />
            <Skeleton className='h-4 w-full' />
            <Skeleton className='h-4 w-5/6' />
            <Skeleton className='h-4 w-2/3' />
          </div>
        ) : !news ? (
          <p className='flex h-32 items-center justify-center text-sm text-muted-foreground'>
            {query.isError ? '加载失败，请稍后重试' : '暂无公告内容'}
          </p>
        ) : (
          <>
            <ScrollArea className='min-h-0 flex-1'>
              <div className='pr-4'>
                <div
                  className='text-sm leading-7 text-foreground [&_a]:text-primary [&_img]:max-w-full [&_img]:rounded-md'
                  dangerouslySetInnerHTML={{ __html: news.content }}
                />
                {news.attachment?.length > 0 && (
                  <div className='mt-4 space-y-2'>
                    <p className='text-xs font-medium text-muted-foreground'>
                      附件
                    </p>
                    {news.attachment.map((item, index) => (
                      <a
                        key={`${item.url}-${index}`}
                        href={item.url}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='block max-w-full truncate text-sm text-primary hover:underline'
                      >
                        {item.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant='outline' asChild>
                <Link to={allTarget} onClick={() => onOpenChange(false)}>
                  {kind === 'announce' ? '前往全部公告' : '前往全部新闻'}
                </Link>
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
