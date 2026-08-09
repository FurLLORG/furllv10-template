import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import {
  fetchAnnouncement,
  fetchAnnouncementType,
  type NewsItem,
} from '@/api'
import { useAddons } from '@/hooks/use-addons'
import { useAnnouncementLang } from '@/hooks/use-announcement-lang'
import { getErrorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Clock, Megaphone, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { RetryButton } from './resource-layout'

/** 分类右侧数字标签配色（官方 news.js index%4：suc/war/error/def，公告与新闻同款） */
const FOLDER_TAG_CLASSES = [
  'bg-[#c9f7f5] text-[#00a870]', // suc 绿
  'bg-[#fff4de] text-[#ff9900]', // war 橙
  'bg-[#ffe2e5] text-[#f53f3f]', // error 红
  'bg-[#e1f0ff] text-[#245ff0]', // def 蓝
] as const

/** 无封面时的官方占位图（news_01~04.png，按列表顺序循环取，与官方 news.js 一致） */
const DEFAULT_IMG_BASE =
  '/plugins/addon/idcsmart_news/template/clientarea/pc/default/img/news_'
const DEFAULT_IMG_COUNT = 4

/** 无封面时按列表顺序取占位图：01→02→03→04 循环 */
function defaultImg(index: number): string {
  return `${DEFAULT_IMG_BASE}${((index % DEFAULT_IMG_COUNT) + 1)
    .toString()
    .padStart(2, '0')}.png`
}

/** 封面是插件自带三位占位图（news_001~004.png，指向不存在文件）时换两位占位图，真实上传封面原样使用 */
function newsCoverSrc(img: string | undefined, index: number): string {
  if (img && !/news_0\d{2}\.png/i.test(img)) return img
  return defaultImg(index)
}

function formatDate(ts?: number): string {
  if (!ts) return '--'
  const d = new Date(ts * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * 公告中心（idcsmart_announcement 插件 source.htm，需登录）
 *
 * 官方 IdcsmartAnnouncement 插件 source.html：左分类侧栏（全部+各分类计数）右公告列表+分页，
 * 数据走 /console/v1/announcement*（分类 announcement_num / 列表 addon_idcsmart_announcement_type_id）。
 * 详情跳转同插件 news_detail.htm?id=（插件模板视图名），行样式与新闻资源中心一致。
 */
export function AnnouncementCenterPage() {
  const params = useParams({ strict: false }) as Record<string, string>
  const currentPluginId = params.pluginId
  const { t } = useAnnouncementLang()
  const { addons } = useAddons()

  // 详情跳转目标插件 ID（优先当前插件，其次 addons 反查；均无则 null 走裸 /news_detail.htm）
  const detailPluginId = useMemo(() => {
    const id =
      currentPluginId ||
      String(
        addons.find((a) => a.name.toLowerCase() === 'idcsmartannouncement')
          ?.id ?? ''
      )
    return id || null
  }, [currentPluginId, addons])

  // ---------- 列表状态 ----------
  const [curTypeId, setCurTypeId] = useState<number>(0)
  const [curTit, setCurTit] = useState('')
  const [keyword, setKeyword] = useState('')
  const [appliedKeywords, setAppliedKeywords] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  useEffect(() => {
    document.title = '公告中心'
  }, [])

  // 分类（官方 getNews → /announcement/type）
  const typeQuery = useQuery({
    queryKey: ['announcement-type'],
    queryFn: fetchAnnouncementType,
    retry: false,
  })
  const folders = useMemo(
    () => typeQuery.data?.data.list ?? [],
    [typeQuery.data]
  )
  const folderNum = useMemo(
    () => folders.reduce((sum, item) => sum + (item.announcement_num || 0), 0),
    [folders]
  )

  // 公告列表（官方 getNewsList：addon_idcsmart_announcement_type_id + keywords + page/limit）
  const listQuery = useQuery({
    queryKey: ['announcement-list', page, limit, appliedKeywords, curTypeId],
    queryFn: () =>
      fetchAnnouncement({
        page,
        limit,
        keywords: appliedKeywords || undefined,
        addon_idcsmart_announcement_type_id: curTypeId || undefined,
        orderby: 'id',
        sort: 'desc',
      }),
    retry: false,
  })
  const list = listQuery.data?.data.list ?? []
  const totalCount = listQuery.data?.data.count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / limit))

  function selectFolder(id: number, name: string) {
    setCurTypeId(id)
    setCurTit(name)
    setPage(1)
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    setAppliedKeywords(keyword.trim())
    setPage(1)
  }

  const toDetail = (item: NewsItem) =>
    detailPluginId != null
      ? `/plugin/${detailPluginId}/news_detail.htm?id=${item.id}`
      : `/news_detail.htm?id=${item.id}`

  return (
    <Card className='overflow-hidden'>
      {/* 官方 main-card：标题 + 搜索 */}
      <div className='relative isolate overflow-hidden p-4 sm:p-6'>
        <h1 className='mb-6 flex items-center gap-2 text-[28px] font-semibold text-[#171725]'>
          <Megaphone className='h-7 w-7 text-primary' />
          公告中心
        </h1>
        <form onSubmit={submitSearch} className='relative w-full sm:w-[320px]'>
          <Search className='pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t('news_text12', '请输入你需要搜索的内容')}
            className='h-[46px] bg-background pr-10'
          />
          {keyword && (
            <button
              type='button'
              aria-label='清除搜索'
              onClick={() => {
                setKeyword('')
                setAppliedKeywords('')
              }}
              className='absolute top-1/2 right-8 -translate-y-1/2 text-muted-foreground hover:text-foreground'
            >
              <X className='h-4 w-4' />
            </button>
          )}
        </form>
      </div>

      {/* 官方 .box：分类侧栏(com-r-box 右) + 列表(com-l-box 左) */}
      <div className='flex min-h-[480px] flex-col border-t border-[#dcdfe6] md:flex-row'>
        {/* 分类侧栏（官方 com-r-box：float right + 阴影） */}
        <aside className='w-full shrink-0 border-b p-[30px] shadow-[0_3px_12px_rgba(0,0,0,0.1)] md:order-2 md:ml-[3px] md:w-[358px] md:border-b-0 md:shadow-none'>
          <p className='mb-[30px] text-[20px] leading-none text-[#171725]'>
            {t('news_text2', '分类')}
          </p>
          {/* 全部 */}
          <div
            className={cn(
              'mb-[20px] flex w-full cursor-pointer items-center justify-between pl-[20px] text-[16px] text-[#1e2736] transition-colors hover:text-primary',
              curTypeId === 0 && 'font-medium text-primary'
            )}
            onClick={() => selectFolder(0, '')}
          >
            <span>{t('news_text5', '全部')}</span>
            <span className='h-[20px] rounded-[3px] bg-[#e6e7eb] px-[5px] text-[13px] leading-[20px] text-[#4e5259]'>
              {folderNum}
            </span>
          </div>
          {/* 分类列表 */}
          <div className='space-y-[20px] pl-[10px]'>
            {typeQuery.isLoading ? (
              <div className='space-y-3 py-1'>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className='h-7 w-full' />
                ))}
              </div>
            ) : (
              folders.map((item, index) => {
                const active = curTypeId === item.id
                const tagClass =
                  FOLDER_TAG_CLASSES[index % FOLDER_TAG_CLASSES.length]
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'group relative flex cursor-pointer items-center justify-between pl-[15px] text-[16px] text-[#1e2736] transition-colors hover:text-primary',
                      // 官方 ::before 竖线指示（3px × 18px）
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
                      {item.announcement_num > 0 ? item.announcement_num : 0}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </aside>

        {/* 列表主区（官方 com-l-box：margin-right 让位右侧栏） */}
        <section className='min-w-0 flex-1 p-4 md:order-1 md:p-6 md:pr-0'>
          <div className='mb-[20px] flex items-center justify-between gap-2 pr-0 sm:pr-[40px]'>
            <h2 className='truncate text-[20px] leading-none font-medium text-[#171725]'>
              {curTit || t('news_text5', '全部')}
            </h2>
          </div>

          {listQuery.isLoading ? (
            <div className='space-y-[32px]'>
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className='h-[84px] w-full' />
              ))}
            </div>
          ) : listQuery.error ? (
            <div className='flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground'>
              <p>公告加载失败：{getErrorMessage(listQuery.error)}</p>
              <RetryButton onClick={() => listQuery.refetch()} />
            </div>
          ) : list.length === 0 ? (
            <div className='flex h-[60px] items-center justify-center py-10 text-center text-sm text-[#999]'>
              {t('news_text7', '暂无数据')}
            </div>
          ) : (
            <ul className='pr-0 sm:pr-[40px]'>
              {list.map((item, index) => (
                <li key={item.id}>
                  <Link
                    to={toDetail(item)}
                    className='group mt-[32px] flex flex-row items-center'
                  >
                    {/* 左：缩略图（官方 .item-left，宽 140px 高 84px，object-fit:scale-down） */}
                    <div className='mr-[20px] flex h-[84px] w-[140px] shrink-0 items-center justify-center'>
                      <img
                        src={newsCoverSrc(item.img, index)}
                        alt={item.title}
                        className='max-h-full max-w-full object-contain'
                      />
                    </div>
                    {/* 右：标题 + 时间（官方 .item-right，底部 1px 边框） */}
                    <div className='h-[84px] w-full border-b border-[#e6e7eb]'>
                      <p className='mb-[10px] truncate text-[16px] text-[#1e2736] transition-colors group-hover:text-primary'>
                        {item.title}
                      </p>
                      <p className='flex items-center gap-1 text-[13px] text-[#8692b0]'>
                        <Clock className='h-3.5 w-3.5' />
                        {formatDate(item.create_time)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {/* 分页 */}
          {!listQuery.isLoading && !listQuery.error && totalCount > 0 && (
            <div className='mt-5 flex flex-wrap items-center justify-between gap-2 pr-0 text-xs text-muted-foreground sm:pr-[40px]'>
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
    </Card>
  )
}
