import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from '@tanstack/react-router'
import { fetchHelpIndex, fetchHelpList } from '@/api'
import { useAddons } from '@/hooks/use-addons'
import { useHelpLang } from '@/hooks/use-plugin-lang'
import { getErrorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { RetryButton, type ResourceBodyProps } from './resource-layout'

/** 官方分类图标（idcsmart_help img/source/img1~6.png，按列表顺序循环取） */
const HELP_ICON_BASE =
  '/plugins/addon/idcsmart_help/template/clientarea/pc/default/img/source/img'
const HELP_ICON_COUNT = 6

function helpIcon(index: number): string {
  return `${HELP_ICON_BASE}${(index % HELP_ICON_COUNT) + 1}.png`
}

/**
 * 帮助中心首页内容体（由 ResourceCenterShell 挂载，header/search/tab 在壳上保持不动）。
 *
 * 官方 IdcsmartHelp 插件 source.html 帮助 tab：首页/所有文档子导航 + 分类图标网格
 * （每类展示若干文档 + 查看更多按钮）。搜索关键词由壳层（appliedKeywords）传入。
 */
export function HelpCenterBody({ appliedKeywords }: ResourceBodyProps) {
  const navigate = useNavigate()
  const params = useParams({ strict: false }) as Record<string, string>
  const currentPluginId = params.pluginId
  const { t } = useHelpLang()
  const { addons } = useAddons()

  const helpPluginId = useMemo(
    () =>
      currentPluginId ||
      String(addons.find((a) => a.name.toLowerCase() === 'idcsmarthelp')?.id ?? ''),
    [currentPluginId, addons]
  )

  // 详情跳转目标（官方 toHelpTotal：location.href = 'helpTotal.htm'，相对当前插件路由）
  const toHelpTotal = () => {
    if (helpPluginId) navigate({ href: `/plugin/${helpPluginId}/helpTotal.htm` })
  }
  const toDetail = (id: number) => {
    if (helpPluginId)
      navigate({ href: `/plugin/${helpPluginId}/helpTotal.htm?id=${id}` })
  }

  // 首页分组数据（官方 getHelpIndex → /help/index）
  const indexQuery = useQuery({
    queryKey: ['help-index'],
    queryFn: fetchHelpIndex,
    retry: false,
  })
  const groups = indexQuery.data?.data.index ?? []

  // 搜索（官方 inputChange：helpList({keywords}) 命中 helps.search 则跳详情，Enter 触发）
  // 关键词由壳层 header 输入后提交，经 appliedKeywords 传入；为空时不发起查询
  const searchQuery = useQuery({
    queryKey: ['help-search', appliedKeywords],
    queryFn: () => fetchHelpList({ keywords: appliedKeywords }),
    enabled: appliedKeywords.length > 0,
    retry: false,
  })
  // 命中搜索的文档 id（官方：list 各分组 helps 中 search=true 的项）
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

  // 命中搜索 → 跳详情（官方 location.href = helpTotal.htm?id=）
  useEffect(() => {
    if (searchHitId != null) toDetail(searchHitId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchHitId])

  useEffect(() => {
    document.title = '帮助中心'
  }, [])

  return (
    <div className='p-4 sm:p-6'>
        {/* 子导航：首页 / 所有文档（官方 top-menu，左边框指示条） */}
        <div className='mb-[20px] flex items-end justify-between'>
          <ul className='space-y-[20px]'>
            <li className='cursor-pointer border-l-[3px] border-primary pl-[11px] text-[16px] leading-none text-primary'>
              {t('source_title1', '首页')}
            </li>
            <li
              className='cursor-pointer border-l-[3px] border-[#e6e7eb] pl-[11px] text-[16px] leading-none text-[#1e2736]'
              onClick={toHelpTotal}
            >
              {t('source_title2', '所有文档')}
            </li>
          </ul>
        </div>

        {searchEmpty && (
          <p className='mb-4 text-center text-sm text-warning'>
            {t('help_search_empty', '查询结果为空！')}
          </p>
        )}

        {indexQuery.isLoading ? (
          <div className='grid grid-cols-1 gap-[30px] sm:grid-cols-2 lg:grid-cols-4'>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className='h-44 w-full' />
            ))}
          </div>
        ) : indexQuery.error ? (
          <div className='flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground'>
            <p>帮助中心加载失败：{getErrorMessage(indexQuery.error)}</p>
            <RetryButton onClick={() => indexQuery.refetch()} />
          </div>
        ) : groups.length === 0 ? (
          <div className='py-12 text-center text-sm text-muted-foreground'>
            暂无数据
          </div>
        ) : (
          /* 分类图标网格（官方 main-card-content：4 列网格） */
          <div className='grid grid-cols-1 gap-[30px] sm:grid-cols-2 lg:grid-cols-4'>
            {groups.map((group, index) => (
              <div
                key={group.id}
                className='relative rounded-[3px] border border-[#e6e7eb] bg-white pb-[72px]'
              >
                {/* 分类标题：图标 + 名称 */}
                <div className='mt-[30px] ml-[30px] flex items-center text-[20px] leading-[25px] text-[#171725]'>
                  <img src={helpIcon(index)} alt='' className='mr-[10px] w-6' />
                  <span className='truncate'>{group.name}</span>
                </div>
                {/* 文档列表 */}
                <div className='mt-[10px] ml-[30px]'>
                  {(group.helps ?? []).map((help) => (
                    <div
                      key={help.id}
                      title={help.title}
                      onClick={() => toDetail(help.id)}
                      className={cn(
                        'relative mt-[10px] cursor-pointer truncate pl-[12px] text-[14px] leading-[25px] text-[#1e2736]',
                        // 官方 ::after 圆点
                        "after:absolute after:top-1/2 after:left-0 after:h-[4px] after:w-[4px] after:-translate-y-1/2 after:rounded-full after:bg-[#8692b0] after:content-['']",
                        'transition-colors hover:text-primary'
                      )}
                    >
                      {help.title}
                    </div>
                  ))}
                </div>
                {/* 查看更多 */}
                <div
                  onClick={toHelpTotal}
                  className='absolute bottom-[24px] left-[30px] flex h-6 w-16 cursor-pointer items-center justify-center rounded-[3px] bg-primary text-xs text-white'
                >
                  {t('source_btn1', '查看更多')}
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
