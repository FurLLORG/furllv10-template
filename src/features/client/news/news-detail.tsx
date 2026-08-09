import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useParams } from '@tanstack/react-router'
import { fetchCommon, fetchNewsDetail } from '@/api'
import { useAddons } from '@/hooks/use-addons'
import { useNewsLang } from '@/hooks/use-news-lang'
import { getErrorMessage } from '@/lib/api'
import { sanitizeHtml } from '@/lib/sanitize-html'
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  Newspaper,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

function formatDate(ts?: number): string {
  if (!ts) return '--'
  const d = new Date(ts * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * 新闻详情（/plugin/:pluginId/news_detail.htm?id=，需登录）
 *
 * 官方 IdcsmartNews 插件 news_detail.html：返回按钮 + 标题/发布时间/关键字 +
 * 内容（shadowContent 渲染 HTML）+ 附件下载 + 上/下一篇。数据走 /console/v1/news/:id
 * （content 为 HTML，attachment 为 getOssUrl 产物 [{url,name,save_name}]）。
 */
export function NewsDetailPage() {
  const navigate = useNavigate()
  const params = useParams({ strict: false }) as Record<string, string>
  const currentPluginId = params.pluginId
  const searchStr = useLocation({ select: (location) => location.searchStr })
  const newsId = useMemo(
    () => Number(new URLSearchParams(searchStr).get('id') ?? '') || 0,
    [searchStr]
  )
  const { t } = useNewsLang()
  const { addons } = useAddons()

  const newsPluginId = useMemo(
    () =>
      addons.find((a) => a.name.toLowerCase() === 'idcsmartnews')?.id ?? null,
    [addons]
  )
  // 官方 back()：location.href = "source.htm"（相对当前插件路由）
  const sourceUrl = useMemo(
    () =>
      currentPluginId
        ? `/plugin/${currentPluginId}/source.htm`
        : newsPluginId
          ? `/plugin/${newsPluginId}/source.htm`
          : '/source.htm',
    [currentPluginId, newsPluginId]
  )

  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  useEffect(() => {
    const base = commonQuery.data?.data.website_name || 'FurLL'
    document.title = `${base} - ${t('news_text4', '新闻详情')}`
  }, [commonQuery.data, t])

  const detailQuery = useQuery({
    queryKey: ['news-detail', newsId],
    queryFn: () => fetchNewsDetail(newsId),
    enabled: newsId > 0,
    retry: false,
  })
  const news = detailQuery.data?.data.news

  function goDetail(id?: number) {
    if (!id) return
    const pluginId = currentPluginId || newsPluginId
    navigate({
      href: pluginId
        ? `/plugin/${pluginId}/news_detail.htm?id=${id}`
        : `/news_detail.htm?id=${id}`,
    })
  }

  const hasPrev = news?.prev && typeof news.prev.id === 'number'
  const hasNext = news?.next && typeof news.next.id === 'number'

  return (
    <Card className='overflow-hidden'>
      {/* 官方 main-card-title：返回图标 + 新闻中心 */}
      <div className='border-b p-4 sm:p-6'>
        <Link
          to={sourceUrl}
          className='inline-flex cursor-pointer items-center gap-2 text-[28px] text-[#171725]'
        >
          <ChevronLeft className='h-6 w-6 text-primary' />
          {t('news_text1', '新闻中心')}
        </Link>
      </div>

      <CardContent className='p-4 sm:p-6'>
        {detailQuery.isLoading ? (
          <div className='space-y-3'>
            <Skeleton className='h-8 w-2/3' />
            <Skeleton className='h-4 w-48' />
            <div className='space-y-2 pt-4'>
              <Skeleton className='h-4 w-full' />
              <Skeleton className='h-4 w-full' />
              <Skeleton className='h-4 w-5/6' />
              <Skeleton className='h-4 w-2/3' />
            </div>
          </div>
        ) : detailQuery.error ? (
          <div className='flex flex-col items-center gap-3 py-16 text-center text-sm text-muted-foreground'>
            <Newspaper className='h-8 w-8' />
            <p>新闻详情加载失败：{getErrorMessage(detailQuery.error)}</p>
            <Button variant='outline' size='sm' onClick={() => detailQuery.refetch()}>
              重试
            </Button>
          </div>
        ) : !news ? (
          <div className='py-16 text-center text-sm text-muted-foreground'>
            {t('news_text7', '暂无数据')}
          </div>
        ) : (
          /* 官方 new-box：居中带边框内容卡（宽 1033px） */
          <div className='mx-auto w-full max-w-[1033px] border border-[#e6e7eb] px-[30px] py-[40px] sm:px-[50px]'>
            {/* 标题 */}
            <h1 className='mb-[14px] text-[28px] leading-[1.2] text-[#1e2736]'>
              {news.title}
            </h1>
            {/* 时间 + 关键字（官方 .time） */}
            <p className='mb-[40px] text-[14px] text-[#8692b0]'>
              {t('news_text16', '发布时间')}：
              {formatDate((news.create_time as number) || news.update_time)}
              {news.keywords && (
                <>
                  <span className='mx-2' />
                  {t('news_text3', '关键字')}：{news.keywords}
                </>
              )}
            </p>

            {/* 内容（官方 shadowContent 渲染 HTML，img max-width:100%） */}
            <div
              className='text-sm leading-7 break-all [&_p]:m-0 [&_a]:text-primary [&_img]:mx-auto [&_img]:h-auto [&_img]:w-auto [&_img]:max-w-full [&_table]:w-full [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5'
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(news.content) }}
            />

            {/* 附件（官方 news_annex） */}
            {Array.isArray(news.attachment) && news.attachment.length > 0 && (
              <div className='mt-[30px] text-[14px] leading-[24px]'>
                <p className='font-medium'>{t('news_text8', '附件')}：</p>
                {news.attachment.map((item, index) => (
                  <p key={`${item.url}-${index}`}>
                    <a
                      href={item.url}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-[#333] underline-offset-4 hover:text-primary hover:underline'
                    >
                      {item.name}
                    </a>
                  </p>
                ))}
              </div>
            )}

            {/* 上/下一篇（官方 .page .link，左右各 50%） */}
            <div className='mt-[30px] overflow-hidden border-t pt-[30px]'>
              <div className='float-left w-1/2 pr-2'>
                {hasPrev && (
                  <button
                    type='button'
                    onClick={() => goDetail(news.prev!.id)}
                    className='flex w-full min-w-0 items-center gap-1.5 text-start text-[14px] text-[#4e5259]'
                  >
                    <ArrowLeft className='h-4 w-4 shrink-0 text-[#8692b0]' />
                    <span className='min-w-0 truncate'>
                      <span className='text-[#8692b0]'>
                        {t('news_text9', '上一篇')}：
                      </span>
                      {news.prev!.title}
                    </span>
                  </button>
                )}
              </div>
              <div className='float-left w-1/2 pl-2 text-right'>
                {hasNext && (
                  <button
                    type='button'
                    onClick={() => goDetail(news.next!.id)}
                    className='flex w-full min-w-0 items-center justify-end gap-1.5 text-start text-[14px] text-[#4e5259]'
                  >
                    <span className='min-w-0 truncate'>
                      <span className='text-[#8692b0]'>
                        {t('news_text10', '下一篇')}：
                      </span>
                      {news.next!.title}
                    </span>
                    <ArrowRight className='h-4 w-4 shrink-0 text-[#8692b0]' />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
