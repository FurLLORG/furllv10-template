import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  fetchAnnouncement,
  fetchCart,
  fetchIndex,
  fetchNews,
} from '@/api'
import { watchCartNumChanges } from '@/lib/cart-count'
import {
  AlertTriangle,
  Megaphone,
  Newspaper,
  PackagePlus,
  ShoppingCart,
  Ticket,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Header } from '@/components/layout/header'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { NewsDetailDialog } from '@/features/client/news-detail-dialog'

export function ClientHeader() {
  const [newsDialogId, setNewsDialogId] = useState<number | null>(null)
  const [newsDialogOpen, setNewsDialogOpen] = useState(false)
  const [newsDialogKind, setNewsDialogKind] = useState<'news' | 'announce'>(
    'news'
  )

  const indexQuery = useQuery({
    queryKey: ['client-index'],
    queryFn: fetchIndex,
    retry: false,
  })
  const account = indexQuery.data?.data.account
  const unpaidOrder = account ? Number(account.unpaid_order ?? 0) : 0
  const expiringCount = account?.expiring_count ?? 0

  // 最近公告（独立公告接口 /announcement，取最新一条）
  const announceQuery = useQuery({
    queryKey: ['client-announce-latest'],
    queryFn: () => fetchAnnouncement({ page: 1, limit: 1 }),
    retry: false,
  })
  const latestNews = announceQuery.data?.data.list?.[0]

  // 最近新闻（/news，取最新一条）
  const newsQuery = useQuery({
    queryKey: ['client-news-latest'],
    queryFn: () => fetchNews({ page: 1, limit: 1 }),
    retry: false,
  })
  const latestArticle = newsQuery.data?.data.list?.[0]

  // 购物车数量（官方 topMenu getCartList 同款：过滤域名商品后计数）。
  // 监听 setCartCount / 官方插件写入 cartNum / 其他标签页 storage，变化即刷新
  const cartQuery = useQuery({
    queryKey: ['cart'],
    queryFn: fetchCart,
    retry: false,
  })
  const { refetch: refetchCart } = cartQuery
  const cartCount =
    (cartQuery.data?.data.list ?? []).filter(
      (item) => (item.customfield as { is_domain?: number })?.is_domain !== 1
    ).length ?? 0
  useEffect(() => {
    return watchCartNumChanges(() => {
      refetchCart()
    })
  }, [refetchCart])

  return (
    <Header fixed>
      {/* 快捷操作：购物车 / 产品购买 / 工单 */}
      <div className='flex items-center gap-1'>
        <Button variant='ghost' size='icon' title='购物车' asChild>
          <Link to='/cart/shoppingCar.htm' className='relative'>
            <ShoppingCart className='h-4 w-4' />
            {cartCount > 0 && (
              <span className='absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-medium text-primary-foreground'>
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </Link>
        </Button>
        <Button variant='ghost' size='icon' title='产品购买' asChild>
          <Link to='/cart/goodsList.htm'>
            <PackagePlus className='h-4 w-4' />
          </Link>
        </Button>
        <Button variant='ghost' size='icon' title='提交工单' asChild>
          <Link to='/ticket.htm'>
            <Ticket className='h-4 w-4' />
          </Link>
        </Button>
      </div>

      {/* 最近公告 + 待办提醒（自适应高度，数据来自 /index 接口） */}
      <div className='flex items-center gap-2'>
        {announceQuery.isLoading ? (
          <Skeleton className='h-8 w-44 shrink-0 rounded-md' />
        ) : (
          latestNews && (
            <Button
              variant='outline'
              size='sm'
              title={`公告：${latestNews.title}`}
              className='h-8 max-w-[260px] shrink-0 justify-start gap-2 overflow-hidden border-primary/30 bg-primary/10 px-2.5 text-primary hover:bg-primary/15 hover:text-primary dark:bg-primary/15 dark:hover:bg-primary/25'
              onClick={() => {
                setNewsDialogId(latestNews.id)
                setNewsDialogKind('announce')
                setNewsDialogOpen(true)
              }}
            >
              <Megaphone className='h-3.5 w-3.5 shrink-0' />
              <span className='truncate text-xs font-medium'>
                {latestNews.title}
              </span>
            </Button>
          )
        )}
        {newsQuery.isLoading ? (
          <Skeleton className='h-8 w-44 shrink-0 rounded-md' />
        ) : (
          latestArticle && (
            <Button
              variant='outline'
              size='sm'
              title={`新闻：${latestArticle.title}`}
              className='h-8 max-w-[260px] shrink-0 justify-start gap-2 overflow-hidden border-primary/30 bg-primary/10 px-2.5 text-primary hover:bg-primary/15 hover:text-primary dark:bg-primary/15 dark:hover:bg-primary/25'
              onClick={() => {
                setNewsDialogId(latestArticle.id)
                setNewsDialogKind('news')
                setNewsDialogOpen(true)
              }}
            >
              <Newspaper className='h-3.5 w-3.5 shrink-0' />
              <span className='truncate text-xs font-medium'>
                {latestArticle.title}
              </span>
            </Button>
          )
        )}        {indexQuery.isLoading ? (
          <>
            <Skeleton className='h-8 w-28 shrink-0 rounded-md' />
            <Skeleton className='h-8 w-32 shrink-0 rounded-md' />
          </>
        ) : (
          <>
            {unpaidOrder > 0 && (
              <Button
                variant='outline'
                size='sm'
                title='待支付订单'
                className='h-8 shrink-0 border-amber-200 bg-amber-50 px-2.5 text-amber-700 hover:bg-amber-100 hover:text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20'
                asChild
              >
                <Link to='/finance.htm'>
                  <AlertTriangle className='h-3.5 w-3.5' />
                  {unpaidOrder} 笔订单待支付
                </Link>
              </Button>
            )}
            {expiringCount > 0 && (
              <Button
                variant='outline'
                size='sm'
                title='即将到期产品'
                className='h-8 shrink-0 border-amber-200 bg-amber-50 px-2.5 text-amber-700 hover:bg-amber-100 hover:text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20'
                asChild
              >
                <Link to='/productList.htm'>
                  <AlertTriangle className='h-3.5 w-3.5' />
                  {expiringCount} 个产品即将到期
                </Link>
              </Button>
            )}
          </>
        )}
      </div>

      <div className='ml-auto flex items-center gap-2'>
        <ProfileDropdown
          loading={indexQuery.isLoading}
          name={account?.username || '用户'}
          email={
            account?.email ||
            (account?.phone
              ? `+${account.phone_code ?? ''}${account.phone}`
              : '')
          }
        />
      </div>

      <NewsDetailDialog
        open={newsDialogOpen}
        onOpenChange={setNewsDialogOpen}
        newsId={newsDialogId}
        kind={newsDialogKind}
      />
    </Header>
  )
}
