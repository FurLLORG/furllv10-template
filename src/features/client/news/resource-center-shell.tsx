import { useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useNewsLang } from '@/hooks/use-news-lang'
import { useAddons } from '@/hooks/use-addons'
import {
  ResourceLayout,
  useHidePageScrollbar,
  type ResourceTabKey,
} from './resource-layout'
import { ResourceCenterBody } from './resource-center'
import { HelpCenterBody } from './help-center'
import { FileDownloadBody } from './file-download'

const RESOURCE_PLUGIN_NAMES = {
  help: 'idcsmarthelp',
  news: 'idcsmartnews',
  download: 'idcsmartfiledownload',
} as const

/** 持久 header 用一张装饰背景图（三个插件 source_back.png 视觉一致，已预加载） */
const SHELL_BACK_IMG =
  '/plugins/addon/idcsmart_news/template/clientarea/pc/default/img/source/source_back.png'

/**
 * 资源中心统一外壳：header（标题/搜索/背景图）+ tab 栏保持挂载，
 * 切换 tab 只替换下方内容体（help/news/download 各自独立路由 → 改为同页状态切换）。
 * 搜索状态提升到此层，切 tab 后搜索框/背景图不再重挂载（不闪）。
 */
export function ResourceCenterShell({
  initialActive = 'news',
}: {
  initialActive?: ResourceTabKey
}) {
  const { t } = useNewsLang()
  const { addons } = useAddons()
  const navigate = useNavigate()
  // 当前访问的插件 ID（plugin/<id>/source.htm；裸 /source.htm 无该参数）
  const params = useParams({ strict: false }) as Record<string, string>
  const currentPluginId = params.pluginId
  useHidePageScrollbar()

  // 各插件 ID（用于按 URL 反查当前激活 tab，以及切 tab 时跳对应插件 source.htm）
  const pluginId = (name: string) =>
    addons.find((a) => a.name.toLowerCase() === name)?.id

  const installed: ResourceTabKey[] = []
  if (pluginId(RESOURCE_PLUGIN_NAMES.help) != null) installed.push('help')
  if (pluginId(RESOURCE_PLUGIN_NAMES.news) != null) installed.push('news')
  if (pluginId(RESOURCE_PLUGIN_NAMES.download) != null)
    installed.push('download')

  // 激活 tab 优先级：当前 URL 插件 ID → 入口 initialActive → 第一个已安装资源 tab
  const activeFromUrl = (Object.keys(RESOURCE_PLUGIN_NAMES) as ResourceTabKey[]).find(
    (key) => String(pluginId(RESOURCE_PLUGIN_NAMES[key])) === String(currentPluginId)
  )
  const active: ResourceTabKey = activeFromUrl && installed.includes(activeFromUrl)
    ? activeFromUrl
    : installed.includes(initialActive)
      ? initialActive
      : (installed[0] ?? 'news')
  const [keywords, setKeywords] = useState('')
  const [appliedKeywords, setAppliedKeywords] = useState('')

  const handleTabChange = (key: ResourceTabKey) => {
    if (key === active) return
    const id = pluginId(RESOURCE_PLUGIN_NAMES[key])
    // 跳对应插件 source.htm：URL 变为 /plugin/<id>/source.htm（无 ?tab=）。
    // 壳组件类型不变，React 保持 header 挂载、只重渲染内容体。
    if (id != null) navigate({ href: `/plugin/${id}/source.htm` })
  }

  const labels = {
    help: t('news_text13', '帮助中心'),
    news: t('news_text14', '新闻中心'),
    download: t('news_text15', '文件下载'),
  }

  return (
    <ResourceLayout
      title={t('news_text11', '资源中心')}
      searchPlaceholder={t('news_text12', '请输入你需要搜索的内容')}
      searchValue={keywords}
      onSearchChange={setKeywords}
      onSearchClear={() => {
        setKeywords('')
        setAppliedKeywords('')
      }}
      onSearchSubmit={(e) => {
        e.preventDefault()
        setAppliedKeywords(keywords.trim())
      }}
      backImg={SHELL_BACK_IMG}
      active={active}
      labels={labels}
      onTabChange={handleTabChange}
    >
      {active === 'help' && <HelpCenterBody appliedKeywords={appliedKeywords} />}
      {active === 'news' && <ResourceCenterBody appliedKeywords={appliedKeywords} />}
      {active === 'download' && (
        <FileDownloadBody appliedKeywords={appliedKeywords} />
      )}
    </ResourceLayout>
  )
}
