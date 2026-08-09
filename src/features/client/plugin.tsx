import { Link, useParams } from '@tanstack/react-router'
import { AlertTriangle, Newspaper, Ticket as TicketIcon } from 'lucide-react'
import { useAddons } from '@/hooks/use-addons'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TicketCenterPage } from '@/features/client/ticket/ticket-center'
import { AddTicketPage } from '@/features/client/ticket/ticket-add'
import { ResourceCenterShell } from '@/features/client/news/resource-center-shell'
import { NewsDetailPage } from '@/features/client/news/news-detail'
import { AnnouncementCenterPage } from '@/features/client/news/announcement-center'
import { AnnouncementDetailPage } from '@/features/client/news/announcement-detail'
import { HelpTotalPage } from '@/features/client/news/help-total'
import { ChildAccountPage } from '@/features/client/sub-account/child-account'
import { AddChildAccountPage } from '@/features/client/sub-account/add-child-account'
import { CertificationSelectPage } from '@/features/client/certification/certification-select'
import { CertificationPersonPage } from '@/features/client/certification/certification-person'
import { CertificationCompanyPage } from '@/features/client/certification/certification-company'
import { CertificationThirdPage } from '@/features/client/certification/certification-third'
import { CertificationStatusPage } from '@/features/client/certification/certification-status'

/** 已适配插件标识（DB name 大小写不敏感匹配） */
const TICKET_PLUGIN_NAME = 'idcsmartticket'
const NEWS_PLUGIN_NAME = 'idcsmartnews'
const ANNOUNCEMENT_PLUGIN_NAME = 'idcsmartannouncement'
const HELP_PLUGIN_NAME = 'idcsmarthelp'
const DOWNLOAD_PLUGIN_NAME = 'idcsmartfiledownload'
const SUB_ACCOUNT_PLUGIN_NAME = 'idcsmartsubaccount'
const CERTIFICATION_PLUGIN_NAME = 'idcsmartcertification'

/**
 * 插件页面统一解析器（官方 clientarea 插件入口 /plugin/:plugin_id/:view.htm）。
 *
 * 插件 URL 中的 pluginId 是 idcsmart_plugin 表自增 id（随安装环境变化），无法硬编码。
 * 因此这里通过 /rtapi/addons.php（useAddons）拉取已安装插件，反查出各插件标识：
 * - 命中已适配插件（工单 idcsmart_ticket / 新闻 idcsmart_news）→ 渲染对应 React 界面
 * - 未适配插件 / 未知插件 → 提示插件标识，引导联系客服或模板提供商适配
 */
export function PluginPage() {
  // path 'plugin/$pluginId/$view.htm' 中 .htm 属于路径段，动态参数名实际为 view.htm
  const params = useParams({ strict: false }) as Record<string, string>
  const pluginId = params.pluginId
  const view = (params['view.htm'] ?? '').replace(/\.htm$/, '')
  const { addons, isLoading } = useAddons()

  const ticketPlugin = addons.find(
    (a) => a.name.toLowerCase() === TICKET_PLUGIN_NAME
  )
  const isTicket = String(ticketPlugin?.id) === String(pluginId)

  const newsPlugin = addons.find(
    (a) => a.name.toLowerCase() === NEWS_PLUGIN_NAME
  )
  const isNews = String(newsPlugin?.id) === String(pluginId)

  const announcementPlugin = addons.find(
    (a) => a.name.toLowerCase() === ANNOUNCEMENT_PLUGIN_NAME
  )
  const isAnnouncement = String(announcementPlugin?.id) === String(pluginId)

  const helpPlugin = addons.find(
    (a) => a.name.toLowerCase() === HELP_PLUGIN_NAME
  )
  const isHelp = String(helpPlugin?.id) === String(pluginId)

  const downloadPlugin = addons.find(
    (a) => a.name.toLowerCase() === DOWNLOAD_PLUGIN_NAME
  )
  const isDownload = String(downloadPlugin?.id) === String(pluginId)

  const subAccountPlugin = addons.find(
    (a) => a.name.toLowerCase() === SUB_ACCOUNT_PLUGIN_NAME
  )
  const isSubAccount = String(subAccountPlugin?.id) === String(pluginId)

  const certificationPlugin = addons.find(
    (a) => a.name.toLowerCase() === CERTIFICATION_PLUGIN_NAME
  )
  const isCertification = String(certificationPlugin?.id) === String(pluginId)

  // 加载中：插件 id 未反查出结果前不闪跳
  if (isLoading) {
    return (
      <Card>
        <CardContent className='flex min-h-72 flex-col items-center justify-center gap-4 p-8'>
          <Skeleton className='h-8 w-32' />
          <Skeleton className='h-4 w-56' />
        </CardContent>
      </Card>
    )
  }

  if (isTicket) {
    if (view === 'addTicket') return <AddTicketPage />
    // ticket / ticketDetails / 其他视图统一进工单中心（详情由 ?id= 驱动）
    return <TicketCenterPage />
  }

  if (isNews) {
    // 新闻详情（官方 news_detail.html，?id= 驱动）
    if (view === 'news_detail') return <NewsDetailPage />
    // source（资源中心）/ news / 其他视图统一进资源中心外壳（默认激活新闻 tab）
    return <ResourceCenterShell initialActive='news' />
  }

  if (isAnnouncement) {
    // 公告中心（官方 source.html + news_detail.html，模板视图名与新闻插件一致）：
    // news_detail（公告详情，?id= 驱动）/ 其他视图（source、announcement 等）统一进公告中心
    if (view === 'news_detail') return <AnnouncementDetailPage />
    return <AnnouncementCenterPage />
  }

  if (isHelp) {
    // 帮助中心：helpTotal.htm 所有文档/详情（?id= 驱动），source.htm 及其他视图进外壳（默认激活帮助 tab）
    if (view === 'helpTotal') return <HelpTotalPage />
    return <ResourceCenterShell initialActive='help' />
  }

  if (isDownload) {
    // 文件下载：source.htm 及其他视图统一进外壳（默认激活下载 tab）
    return <ResourceCenterShell initialActive='download' />
  }

  if (isSubAccount) {
    // 子账户管理：childAccount（列表）/ addChildAccount（新增/编辑/详情，?id=&type= 驱动）
    if (view === 'addChildAccount') return <AddChildAccountPage />
    return <ChildAccountPage />
  }

  if (isCertification) {
    // 实名认证：authentication_select（选择类型）/ person / company / thrid（三方验证）/ status（状态）
    if (view === 'authentication_person') return <CertificationPersonPage />
    if (view === 'authentication_company') return <CertificationCompanyPage />
    if (view === 'authentication_status') return <CertificationStatusPage />
    if (view === 'authentication_thrid') return <CertificationThirdPage />
    return <CertificationSelectPage />
  }

  // 未适配：显示插件标识，引导联系客服/模板提供商
  const unknownPlugin = addons.find((a) => String(a.id) === String(pluginId))
  const identifier = unknownPlugin?.name ?? pluginId

  return (
    <Card>
      <CardContent className='flex min-h-72 flex-col items-center justify-center gap-4 p-8 text-center'>
        <AlertTriangle className='h-10 w-10 text-amber-500' />
        <div>
          <p className='text-base font-medium'>插件暂未适配</p>
          <p className='mt-1 text-sm text-muted-foreground'>
            插件标识：<span className='font-mono'>{identifier}</span>
          </p>
          <p className='mt-3 max-w-md text-sm text-muted-foreground'>
            该功能暂未在当前模板中适配，请联系客服或模板提供商完成适配。
          </p>
        </div>
        <div className='flex gap-2'>
          {ticketPlugin && (
            <Button variant='outline' size='sm' asChild>
              <Link to='/ticket.htm'>
                <TicketIcon className='mr-1 h-4 w-4' />
                前往工单中心
              </Link>
            </Button>
          )}
          {newsPlugin && (
            <Button variant='outline' size='sm' asChild>
              <Link to={`/plugin/${newsPlugin.id}/source.htm`}>
                <Newspaper className='mr-1 h-4 w-4' />
                前往资源中心
              </Link>
            </Button>
          )}
          <Button variant='outline' size='sm' asChild>
            <Link to='/home.htm'>返回首页</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
