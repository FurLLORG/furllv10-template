import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  fetchClientHost,
  fetchCommon,
  fetchIndex,
  fetchIndexHost,
  fetchTickets,
} from '@/api'
import {
  ArrowUpRight,
  CircleDollarSign,
  CreditCard,
  Ticket,
  Eye,
  EyeOff,
  Package,
  PlusCircle,
  ReceiptText,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { BillMonthlyChart } from '@/features/client/bill-monthly-chart'
import { PieStatusChart } from '@/features/client/pie-status-chart'

const HOST_STATUS: Record<string, { label: string; color: string }> = {
  Unpaid: { label: '未付款', color: 'text-amber-600' },
  Pending: { label: '开通中', color: 'text-blue-600' },
  Active: { label: '已开通', color: 'text-green-600' },
  Suspended: { label: '已暂停', color: 'text-orange-600' },
  Deleted: { label: '已删除', color: 'text-gray-500' },
}

const STATUS_COLORS: Record<string, string> = {
  Active: '#10b981',
  Suspended: '#f97316',
  Pending: '#3b82f6',
  Unpaid: '#f59e0b',
  Deleted: '#9ca3af',
}

const STATUS_ORDER = ['Active', 'Pending', 'Suspended', 'Unpaid', 'Deleted']

function formatDate(ts?: number): string {
  if (!ts) return '--'
  const d = new Date(ts * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function formatMonthDay(ts?: number): string {
  if (!ts) return '--'
  const d = new Date(ts * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function daysUntil(ts: number): number {
  return Math.max(0, Math.ceil((ts * 1000 - Date.now()) / 86400000))
}

function MetricCard({
  title,
  icon: Icon,
  value,
  hint,
  loading,
}: {
  title: string
  icon: React.ElementType
  value: string
  hint?: string
  loading?: boolean
}) {
  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>{title}</CardTitle>
        <Icon className='h-4 w-4 text-muted-foreground' />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className='h-7 w-24' />
        ) : (
          <div className='text-2xl font-bold'>{value}</div>
        )}
        {hint ? <p className='text-xs text-muted-foreground'>{hint}</p> : null}
      </CardContent>
    </Card>
  )
}

export function HomePage() {
  const indexQuery = useQuery({
    queryKey: ['client-index'],
    queryFn: fetchIndex,
    retry: false,
  })
  const hostQuery = useQuery({
    queryKey: ['client-index-host'],
    queryFn: () => fetchIndexHost({ page: 1, limit: 5 }),
    retry: false,
  })
  const allHostsQuery = useQuery({
    queryKey: ['client-host-all'],
    queryFn: () => fetchClientHost({ page: 1, limit: 200 }),
    retry: false,
  })
  const expiringQuery = useQuery({
    queryKey: ['client-host-expiring'],
    queryFn: () =>
      fetchClientHost({
        tab: 'expiring',
        orderby: 'due_time',
        sort: 'asc',
        page: 1,
        limit: 5,
      }),
    retry: false,
  })
  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  const ticketsQuery = useQuery({
    queryKey: ['client-tickets'],
    queryFn: () => fetchTickets({ page: 1, limit: 5 }),
    retry: false,
  })

  // 产品状态分布：支持点击图例隐藏/恢复某个状态
  const [hiddenStatuses, setHiddenStatuses] = useState<Set<string>>(new Set())
  function toggleStatus(status: string) {
    setHiddenStatuses((prev) => {
      const next = new Set(prev)
      if (next.has(status)) {
        next.delete(status)
      } else {
        next.add(status)
      }
      return next
    })
  }

  const account = indexQuery.data?.data.account
  const hosts = hostQuery.data?.data.list ?? []
  const allHosts = allHostsQuery.data?.data.list ?? []
  const websiteName = commonQuery.data?.data.website_name ?? 'FurLL 客户中心'
  // 页面标题（官方 account.js 同款：站点名-首页），覆盖 goodsList/goods 页设置的标题
  useEffect(() => {
    document.title = `${commonQuery.data?.data.website_name ?? 'FurLL'} - 首页`
  }, [commonQuery.data])
  const unpaidOrder = account ? Number(account.unpaid_order ?? 0) : 0
  const monthPercent = account?.this_month_consume_percent ?? '0'
  const percentNum = Number(monthPercent)
  const monthUp = percentNum >= 0
  const loading = indexQuery.isLoading

  // 产品状态分布（饼图数据，全状态）
  const statusCounts = STATUS_ORDER.map((status) => ({
    name: HOST_STATUS[status]?.label ?? status,
    value: allHosts.filter((h) => h.status === status).length,
    status,
  })).filter((d) => d.value > 0)
  const allHostsCount = statusCounts.reduce((sum, d) => sum + d.value, 0)
  // 图例数据：始终展示全部有数量的状态（含已隐藏项，供恢复）
  const legendData = statusCounts.map((d) => ({
    ...d,
    pct: allHostsCount > 0 ? Math.round((d.value / allHostsCount) * 100) : 0,
  }))
  // 饼图数据：排除已隐藏的状态，百分比基于可见部分重算
  const visibleCounts = statusCounts.filter(
    (d) => !hiddenStatuses.has(d.status)
  )
  const totalHosts = visibleCounts.reduce((sum, d) => sum + d.value, 0)
  // 注意：自定义百分比字段名用 pct，避免与 recharts label props 的 percent 冲突
  const pieData = visibleCounts.map((d) => ({
    ...d,
    pct: totalHosts > 0 ? Math.round((d.value / totalHosts) * 100) : 0,
  }))

  const recentHosts = hosts.slice(0, 3)
  const tickets = ticketsQuery.data?.data.list ?? []
  const ticketCount = ticketsQuery.data?.data.count
  const expiringHosts = expiringQuery.data?.data.list ?? []
  const expiringCount =
    expiringQuery.data?.data.expiring_count ?? account?.expiring_count ?? 0
  const renewalDays = Number(
    commonQuery.data?.data.cron_due_renewal_first_day ?? 30
  )

  return (
    <div className='space-y-4'>
      {/* 页面标题区 */}
      <div className='mb-2 flex flex-wrap items-center justify-between gap-2'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>
            {loading ? (
              <Skeleton className='h-8 w-56' />
            ) : (
              `你好，${account?.username ?? '用户'} 👋`
            )}
          </h1>
          <div className='text-sm text-muted-foreground'>
            {loading ? (
              <Skeleton className='mt-1.5 h-4 w-80' />
            ) : (
              <>
                {websiteName} · ID: {account?.id ?? '--'}
                {account?.email ? ` · ${account.email}` : ''}
              </>
            )}
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <Button variant='outline' asChild>
            <Link to='/finance.htm'>
              <Wallet />
              充值
            </Link>
          </Button>
          <Button asChild>
            <Link to='/cart/goodsList.htm'>
              <PlusCircle />
              购买产品
            </Link>
          </Button>
        </div>
      </div>

      {/* 快捷操作 */}
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {[
          {
            title: '购买产品',
            desc: '云服务器 / 域名 / SSL',
            to: '/cart/goodsList.htm' as const,
            icon: PlusCircle,
            badge: undefined as number | undefined,
            badgeLoading: false,
          },
          {
            title: '账户充值',
            desc: '为账户余额充值',
            to: '/finance.htm' as const,
            icon: CreditCard,
            badge: undefined as number | undefined,
            badgeLoading: false,
          },
          {
            title: '我的产品',
            desc: '管理全部产品',
            to: '/productList.htm' as const,
            icon: Package,
            badge: undefined as number | undefined,
            badgeLoading: false,
          },
          {
            title: '提交工单',
            desc: '获取技术支持',
            to: '/ticket.htm' as const,
            icon: Ticket,
            badge: ticketCount,
            badgeLoading: ticketsQuery.isLoading,
          },
        ].map((action) => (
          <Button
            key={action.title}
            variant='outline'
            className='h-auto flex-col items-start gap-1 p-4'
            asChild
          >
            <Link to={action.to}>
              <span className='flex w-full items-center gap-2 font-medium'>
                <action.icon className='h-4 w-4' />
                {action.title}
                {action.badgeLoading ? (
                  <Skeleton className='h-5 w-12 rounded-full' />
                ) : (
                  action.badge != null && (
                    <Badge
                      variant='secondary'
                      className='ml-auto rounded-full px-1.5 py-0.5 text-xs font-medium'
                    >
                      {action.badge} 个
                    </Badge>
                  )
                )}
              </span>
              <span className='text-xs font-normal text-muted-foreground'>
                {action.desc}
              </span>
            </Link>
          </Button>
        ))}
      </div>
      {/* 4 个指标卡 */}
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <MetricCard
          title='账户余额'
          icon={Wallet}
          value={account ? `¥${account.credit}` : '--'}
          loading={loading}
          hint='可用于支付订单与续费'
        />
        <MetricCard
          title='未支付订单'
          icon={CreditCard}
          value={account ? String(unpaidOrder) : '--'}
          loading={loading}
          hint='待完成支付'
        />
        <MetricCard
          title='累计消费'
          icon={CircleDollarSign}
          value={account ? `¥${account.consume}` : '--'}
          loading={loading}
        />
        <MetricCard
          title='本月消费'
          icon={ReceiptText}
          value={account ? `¥${account.this_month_consume}` : '--'}
          loading={loading}
          hint={`较上月 ${monthUp ? '+' : ''}${monthPercent}%`}
        />
      </div>

      {/* 图表区 */}
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
        {/* 左列：产品状态分布 / 账单记录 */}
        <div className='col-span-1 flex flex-col gap-4 lg:col-span-4'>
          <Card>
            <CardHeader>
              <CardTitle>产品状态分布</CardTitle>
              <CardDescription>
                共 {account?.host_num ?? '--'} 个产品
                {account?.host_active_num != null
                  ? ` · 已激活 ${account.host_active_num}`
                  : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className='ps-2'>
              {allHostsQuery.isLoading ? (
                <Skeleton className='h-64 w-full' />
              ) : statusCounts.length === 0 ? (
                <p className='flex h-64 items-center justify-center text-sm text-muted-foreground'>
                  暂无产品数据
                </p>
              ) : pieData.length === 0 ? (
                <div className='flex h-64 flex-col items-center justify-center gap-3'>
                  <p className='text-sm text-muted-foreground'>
                    已隐藏全部状态
                  </p>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setHiddenStatuses(new Set())}
                  >
                    全部恢复
                  </Button>
                </div>
              ) : (
                <div className='flex flex-col items-center gap-4 sm:flex-row'>
                  <PieStatusChart data={pieData} total={totalHosts} />
                  <div className='w-full space-y-2.5 sm:w-44'>
                    {legendData.map((entry) => {
                      const hidden = hiddenStatuses.has(entry.status)
                      return (
                        <button
                          key={entry.status}
                          type='button'
                          onClick={() => toggleStatus(entry.status)}
                          title={hidden ? '点击恢复显示' : '点击隐藏'}
                          className={cn(
                            'group flex w-full items-center gap-2 rounded px-1 py-0.5 text-sm transition-colors hover:bg-muted/50',
                            hidden && 'opacity-40'
                          )}
                        >
                          <span className='flex items-center gap-2'>
                            <span
                              className='h-2.5 w-2.5 rounded-full'
                              style={{
                                background: STATUS_COLORS[entry.status],
                              }}
                            />
                            {entry.name}
                          </span>
                          <span className='flex items-baseline gap-1.5'>
                            <span className='font-medium'>{entry.value}</span>
                            <span className='text-xs text-muted-foreground'>
                              {entry.pct}%
                            </span>
                          </span>
                          {hidden ? (
                            <EyeOff className='h-3.5 w-3.5 shrink-0 text-muted-foreground' />
                          ) : (
                            <Eye className='h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-60' />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className='flex flex-1 flex-col'>
            <CardHeader>
              <CardTitle>账单记录</CardTitle>
              <CardDescription>最近 12 个月账单金额</CardDescription>
            </CardHeader>
            <CardContent className='flex-1'>
              <BillMonthlyChart />
            </CardContent>
          </Card>
        </div>

        {/* 最近工单 / 最近产品 / 即将到期 */}
        <div className='col-span-1 flex flex-col gap-4 lg:col-span-3'>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0'>
              <div>
                <CardTitle>最近工单</CardTitle>
                <CardDescription>最近提交的工单</CardDescription>
              </div>
              <Button variant='ghost' size='sm' asChild>
                <Link to='/ticket.htm'>
                  全部
                  <ArrowUpRight />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {ticketsQuery.isLoading ? (
                <div className='min-h-[168px] space-y-3'>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className='h-12 w-full' />
                  ))}
                </div>
              ) : tickets.length === 0 ? (
                <p className='flex min-h-[168px] items-center justify-center text-center text-sm text-muted-foreground'>
                  暂无工单
                </p>
              ) : (
                <div className='min-h-[168px] space-y-3'>
                  {tickets.map((ticket) => (
                    <Link
                      key={ticket.id}
                      to='/ticket.htm'
                      className='flex items-center gap-3'
                    >
                      <span
                        className='inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-xs font-medium text-white'
                        style={{
                          background: ticket.color || '#94a3b8',
                        }}
                      >
                        {ticket.status}
                      </span>
                      <div className='min-w-0 flex-1'>
                        <p className='truncate text-sm font-medium'>
                          #{ticket.ticket_num} - {ticket.title}
                        </p>
                        <p className='truncate text-xs text-muted-foreground'>
                          {ticket.name}
                        </p>
                      </div>
                      <p className='shrink-0 text-xs text-muted-foreground'>
                        {formatMonthDay(ticket.post_time)}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0'>
              <div>
                <CardTitle>最近产品</CardTitle>
                <CardDescription>最近添加的产品</CardDescription>
              </div>
              <Button variant='ghost' size='sm' asChild>
                <Link to='/productList.htm'>
                  全部
                  <ArrowUpRight />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {hostQuery.isLoading ? (
                <div className='min-h-[168px] space-y-3'>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className='h-12 w-full' />
                  ))}
                </div>
              ) : recentHosts.length === 0 ? (
                <p className='flex min-h-[168px] items-center justify-center text-center text-sm text-muted-foreground'>
                  暂无产品，去购买第一个产品吧
                </p>
              ) : (
                <div className='min-h-[168px] space-y-3'>
                  {recentHosts.map((host) => {
                    const status = HOST_STATUS[host.status]
                    return (
                      <div key={host.id} className='flex items-center gap-3'>
                        <div className='min-w-0 flex-1'>
                          <p className='truncate text-sm font-medium'>
                            {host.product_name}
                          </p>
                          <p className='truncate text-xs text-muted-foreground'>
                            {host.name}
                            {host.ip ? ` · ${host.ip}` : ''}
                          </p>
                          {host.client_notes ? (
                            <p className='truncate text-xs text-muted-foreground'>
                              备注：{host.client_notes}
                            </p>
                          ) : null}
                        </div>
                        <div className='text-right'>
                          <Badge
                            variant='outline'
                            className={cn('border-transparent', status?.color)}
                          >
                            {status?.label ?? host.status}
                          </Badge>
                          <p className='mt-0.5 text-xs text-muted-foreground'>
                            {formatDate(host.due_time)} 到期
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className='flex flex-1 flex-col'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0'>
              <div>
                <CardTitle>即将到期产品</CardTitle>
                <CardDescription>{renewalDays} 天内到期</CardDescription>
              </div>
              <div className='flex items-center gap-1'>
                <Badge variant='secondary' className='rounded-full'>
                  {expiringQuery.isLoading ? '--' : `${expiringCount} 个`}
                </Badge>
                <Button variant='ghost' size='sm' asChild>
                  <Link to='/productList.htm'>
                    全部
                    <ArrowUpRight />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className='flex-1'>
              {expiringQuery.isLoading ? (
                <div className='min-h-[168px] space-y-3'>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className='h-12 w-full' />
                  ))}
                </div>
              ) : expiringHosts.length === 0 ? (
                <p className='flex min-h-[168px] items-center justify-center text-center text-sm text-muted-foreground'>
                  暂无即将到期产品
                </p>
              ) : (
                <div className='min-h-[168px] space-y-3'>
                  {expiringHosts.map((host) => {
                    const left = daysUntil(host.due_time)
                    return (
                      <div key={host.id} className='flex items-center gap-3'>
                        <Package className='h-4 w-4 shrink-0 text-muted-foreground' />
                        <div className='min-w-0 flex-1'>
                          <p className='truncate text-sm font-medium'>
                            {host.product_name}
                          </p>
                          <p className='truncate text-xs text-muted-foreground'>
                            {host.name}
                            {host.ip ? ` · ${host.ip}` : ''}
                          </p>
                        </div>
                        <div className='text-right'>
                          <Badge
                            variant='outline'
                            className={cn(
                              'border-transparent',
                              left <= 3
                                ? 'text-red-600'
                                : left <= 7
                                  ? 'text-amber-600'
                                  : 'text-muted-foreground'
                            )}
                          >
                            {left === 0 ? '今天到期' : `${left} 天后到期`}
                          </Badge>
                          <p className='mt-0.5 text-xs text-muted-foreground'>
                            {formatDate(host.due_time)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
