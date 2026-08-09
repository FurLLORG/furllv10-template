import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate, useParams } from '@tanstack/react-router'
import {
  fetchCommon,
  fetchHelpDetail,
  fetchHelpList,
  type HelpDetail,
  type HelpGroupItem,
} from '@/api'
import { useAddons } from '@/hooks/use-addons'
import { useHelpLang } from '@/hooks/use-plugin-lang'
import { getErrorMessage } from '@/lib/api'
import { sanitizeHtml } from '@/lib/sanitize-html'
import { cn } from '@/lib/utils'
import { ArrowLeft, ArrowRight, ChevronDown } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ResourceLayout, RetryButton } from './resource-layout'

const HELP_BACK_IMG =
  '/plugins/addon/idcsmart_help/template/clientarea/pc/default/img/source/source_back.png'

function formatDate(ts?: number): string {
  if (!ts) return '--'
  const d = new Date(ts * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * 帮助中心所有文档/详情（/plugin/:pluginId/helpTotal.htm?id=，需登录）
 *
 * 官方 IdcsmartHelp 插件 helpTotal.html：左侧文档目录（分组+子项，点击加载详情）+
 * 右侧详情（标题/更新时间/关键字/内容/附件）+ 上/下一篇。数据走 /help + /help/:id。
 */
export function HelpTotalPage() {
  const navigate = useNavigate()
  const params = useParams({ strict: false }) as Record<string, string>
  const currentPluginId = params.pluginId
  const searchStr = useLocation({ select: (location) => location.searchStr })
  const newsId = useMemo(
    () => Number(new URLSearchParams(searchStr).get('id') ?? '') || 0,
    [searchStr]
  )
  const { t } = useHelpLang()
  const { addons } = useAddons()

  const helpPluginId = useMemo(
    () =>
      currentPluginId ||
      String(addons.find((a) => a.name.toLowerCase() === 'idcsmarthelp')?.id ?? ''),
    [currentPluginId, addons]
  )

  // 左侧文档目录（官方 getHelpList → /help）
  const listQuery = useQuery({
    queryKey: ['help-list'],
    queryFn: () => fetchHelpList({}),
    retry: false,
  })
  const groups = listQuery.data?.data.list ?? []

  // 当前激活文档 id + 详情（官方 itemClick → /help/:id；URL 带 id 时默认加载该文档）
  const [activeId, setActiveId] = useState<number | null>(
    newsId > 0 ? newsId : null
  )
  const detailQuery = useQuery({
    queryKey: ['help-detail', activeId],
    queryFn: () => fetchHelpDetail(activeId!),
    enabled: activeId != null,
    retry: false,
  })
  const detail = detailQuery.data?.data.help

  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const toggleGroup = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  useEffect(() => {
    const base = commonQuery.data?.data.website_name || 'FurLL'
    document.title = `${base} - 帮助中心`
  }, [commonQuery.data])

  const toSource = () => {
    if (helpPluginId) navigate({ href: `/plugin/${helpPluginId}/source.htm` })
  }
  const selectDoc = (id: number) => setActiveId(id)

  // 搜索（官方 inputChange：helpList({keywords}) 命中 helps.search 则打开该文档）
  const [keywords, setKeywords] = useState('')
  const [submitted, setSubmitted] = useState('')
  const searchQuery = useQuery({
    queryKey: ['help-search', submitted],
    queryFn: () => fetchHelpList({ keywords: submitted }),
    enabled: submitted.length > 0,
    retry: false,
  })
  const searchHitId = useMemo(() => {
    if (!searchQuery.data) return undefined
    for (const group of searchQuery.data?.data.list ?? []) {
      const hit = group.helps?.find((item) => item.search)
      if (hit) return hit.id
    }
    return undefined
  }, [searchQuery.data])
  const searchEmpty =
    searchQuery.isSuccess && !searchQuery.isLoading && searchHitId == null
  // 命中搜索 → 打开该文档（异步查询结果驱动的选中，属合法副作用）
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (searchHitId != null) selectDoc(searchHitId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchHitId])

  return (
    <ResourceLayout
      title={t('source_title', '资源中心')}
      searchPlaceholder={t('cloud_tip_2', '请输入你需要搜索的内容')}
      searchValue={keywords}
      onSearchChange={setKeywords}
      onSearchClear={() => {
        setKeywords('')
        setSubmitted('')
      }}
      onSearchSubmit={(e) => {
        e.preventDefault()
        setSubmitted(keywords.trim())
      }}
      backImg={HELP_BACK_IMG}
      active='help'
      labels={{
        help: t('source_tab1', '帮助中心'),
        news: t('source_tab2', '新闻中心'),
        download: t('source_tab3', '文件下载'),
      }}
    >
      <div className='p-4 sm:p-6'>
        {/* 子导航：首页 / 所有文档（官方 top-menu） */}
        <div className='mb-[20px]'>
          <ul className='space-y-[20px]'>
            <li
              className='cursor-pointer border-l-[3px] border-[#e6e7eb] pl-[11px] text-[16px] leading-none text-[#1e2736]'
              onClick={toSource}
            >
              {t('source_title1', '首页')}
            </li>
            <li className='cursor-pointer border-l-[3px] border-primary pl-[11px] text-[16px] leading-none text-primary'>
              {t('source_title2', '所有文档')}
            </li>
          </ul>
        </div>

        {searchEmpty && (
          <p className='mb-4 text-center text-sm text-warning'>
            {t('help_search_empty', '查询结果为空！')}
          </p>
        )}

        {/* 主体：左目录 + 右详情（官方 main-card-content flex） */}
        <div className='flex flex-col gap-6 lg:flex-row lg:items-start'>
          {/* 左：文档目录 */}
          <aside className='w-full shrink-0 rounded-[3px] border border-[#e6e7eb] lg:w-[337px]'>
            <div className='h-[57px] rounded-t-[3px] bg-[#f7f7f7] pt-[25px] pl-[20px] text-[24px] leading-[30px] text-[#1e2736]'>
              {t('source_title3', '文档目录')}
            </div>
            <div className='p-2'>
              {listQuery.isLoading ? (
                <div className='space-y-2 p-2'>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className='h-8 w-full' />
                  ))}
                </div>
              ) : listQuery.error ? (
                <div className='flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground'>
                  <p>目录加载失败：{getErrorMessage(listQuery.error)}</p>
                  <RetryButton onClick={() => listQuery.refetch()} />
                </div>
              ) : groups.length === 0 ? (
                <div className='py-8 text-center text-sm text-muted-foreground'>
                  暂无数据
                </div>
              ) : (
                groups.map((group) => (
                  <HelpGroup
                    key={group.id}
                    group={group}
                    activeId={activeId}
                    expanded={expanded.has(group.id)}
                    onToggle={() => toggleGroup(group.id)}
                    onSelect={selectDoc}
                  />
                ))
              )}
            </div>
          </aside>

          {/* 右：详情 */}
          <section className='min-w-0 flex-1 overflow-x-auto'>
            {detailQuery.isLoading ? (
              <div className='space-y-3 border border-[#e6e7eb] p-[30px]'>
                <Skeleton className='h-7 w-2/3' />
                <Skeleton className='h-4 w-48' />
                <div className='space-y-2 pt-4'>
                  <Skeleton className='h-4 w-full' />
                  <Skeleton className='h-4 w-full' />
                  <Skeleton className='h-4 w-5/6' />
                </div>
              </div>
            ) : detailQuery.error ? (
              <div className='flex flex-col items-center gap-3 border border-[#e6e7eb] py-16 text-center text-sm text-muted-foreground'>
                <p>文档详情加载失败：{getErrorMessage(detailQuery.error)}</p>
                <RetryButton onClick={() => detailQuery.refetch()} />
              </div>
            ) : !detail ? (
              <div className='flex h-64 items-center justify-center border border-[#e6e7eb] text-sm text-muted-foreground'>
                请选择左侧文档查看详情
              </div>
            ) : (
              <HelpDetailView detail={detail} onSelect={selectDoc} />
            )}
          </section>
        </div>
      </div>
    </ResourceLayout>
  )
}

/** 左侧目录分组（官方 el-menu 子菜单，可折叠） */
function HelpGroup({
  group,
  activeId,
  expanded,
  onToggle,
  onSelect,
}: {
  group: HelpGroupItem
  activeId: number | null
  expanded: boolean
  onToggle: () => void
  onSelect: (id: number) => void
}) {
  return (
    <div className='mb-1'>
      <button
        type='button'
        onClick={onToggle}
        className='flex w-full cursor-pointer items-center justify-between truncate rounded-md px-3 py-2 text-start text-sm text-[#1e2736] transition-colors hover:bg-accent'
      >
        <span className='truncate font-medium'>{group.name}</span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 transition-transform', expanded && 'rotate-180')}
        />
      </button>
      {expanded && (
        <div className='mb-1 ml-2 space-y-0.5 border-l pl-2'>
          {(group.helps ?? []).map((help) => (
            <button
              key={help.id}
              type='button'
              title={help.title}
              onClick={() => onSelect(help.id)}
              className={cn(
                'w-full cursor-pointer truncate rounded px-2 py-1.5 text-start text-sm transition-colors hover:bg-accent',
                activeId === help.id ? 'font-medium text-primary' : 'text-[#1e2736]'
              )}
            >
              {help.title}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** 右侧详情（官方 content-right） */
function HelpDetailView({
  detail,
  onSelect,
}: {
  detail: HelpDetail
  onSelect: (id: number) => void
}) {
  const { t } = useHelpLang()
  const hasPrev = detail.prev && typeof detail.prev.id === 'number'
  const hasNext = detail.next && typeof detail.next.id === 'number'

  return (
    <div>
      <div className='rounded-[3px] border border-[#e6e7eb] px-[30px] py-[24px]'>
        {/* 标题 */}
        <h1 className='text-[28px] leading-[28px] font-bold text-[#1e2736]'>
          {detail.title}
        </h1>
        {/* 更新时间 + 关键字 */}
        <div className='mt-[14px] flex flex-wrap items-center gap-x-[20px] text-[14px] text-[#8692b0]'>
          <span>
            {t('source_text1', '更新时间')}：
            {formatDate((detail.update_time as number) || detail.create_time)}
          </span>
          {detail.keywords && (
            <span>
              {t('source_text2', '关键字')}：{detail.keywords}
            </span>
          )}
        </div>
        {/* 内容 */}
        <div
          className='mt-[42px] text-sm leading-7 break-words [&_p]:m-0 [&_a]:text-primary [&_img]:mx-auto [&_img]:h-auto [&_img]:w-auto [&_img]:max-w-full [&_table]:w-full [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5'
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(detail.content) }}
        />
        {/* 附件 */}
        {Array.isArray(detail.attachment) && detail.attachment.length > 0 && (
          <div className='mt-[42px] flex flex-wrap items-center gap-[20px] text-sm'>
            <span className='font-medium'>
              {t('source_text3', '附件')}：
            </span>
            {detail.attachment.map((item, index) => (
              <a
                key={`${item.url}-${index}`}
                href={item.url}
                download={item.name}
                className='cursor-pointer text-primary hover:underline'
              >
                {item.name}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* 上/下一篇 */}
      <div className='mt-[20px] flex justify-between text-[14px]'>
        {hasPrev ? (
          <button
            type='button'
            onClick={() => hasPrev && onSelect(detail.prev!.id as number)}
            className='flex min-w-0 cursor-pointer items-center gap-1 text-[#4e5259] transition-colors hover:text-primary'
          >
            <ArrowLeft className='h-4 w-4 shrink-0' />
            <span className='truncate'>
              {t('source_text4', '上一篇：')}
              {detail.prev!.title}
            </span>
          </button>
        ) : (
          <span />
        )}
        {hasNext ? (
          <button
            type='button'
            onClick={() => hasNext && onSelect(detail.next!.id as number)}
            className='flex min-w-0 cursor-pointer items-center gap-1 text-[#4e5259] transition-colors hover:text-primary'
          >
            <span className='truncate'>
              {t('source_text5', '下一篇：')}
              {detail.next!.title}
            </span>
            <ArrowRight className='h-4 w-4 shrink-0' />
          </button>
        ) : (
          <span />
        )}
      </div>
    </div>
  )
}
