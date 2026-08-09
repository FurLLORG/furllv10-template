import { useEffect, useMemo, useState, type ComponentType } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  fetchAccount,
  fetchAnnouncement,
  fetchCommon,
  fetchNews,
  fetchProductGroupFirst,
  fetchProductGroupSecond,
  fetchProductList,
  type NewsItem,
  type ProductListItem,
} from '@/api'
import {
  Activity,
  ArrowRight,
  Award,
  Boxes,
  ChevronDown,
  ChevronRight,
  Clock,
  Gauge,
  Factory,
  Gamepad2,
  Headphones,
  Headset,
  Home,
  Landmark,
  Menu,
  MonitorSmartphone,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  User,
  Users,
} from 'lucide-react'
import { getCachedLogo, cacheLogo } from '@/lib/logo-cache'
import { sanitizeHtml } from '@/lib/sanitize-html'
import { useAuthStore } from '@/stores/auth-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import AccordionGallery from './accordion-gallery'
import Strands from './strands'
import { MainLoading } from '@/features/auth/components/main-loading'
import { useFurllHome } from './furll-home'

const MARQUEE_KEYFRAMES = `
@keyframes nq-logo-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@keyframes nq-logo-marquee-rev { from { transform: translateX(-50%); } to { transform: translateX(0); } }
@keyframes nq-marquee-progress { from { width: 0; } to { width: 100%; } }
@keyframes nq-map-pulse {
  0% { transform: translate(-50%, -50%) scale(0.6); opacity: 0.9; }
  70%, 100% { transform: translate(-50%, -50%) scale(3.2); opacity: 0; }
}
@media (prefers-reduced-motion: no-preference) {
  .nq-map-pulse { animation: nq-map-pulse 2.4s cubic-bezier(0, 0, 0.2, 1) infinite; }
}
`

const PRODUCT_NAV = [
  {
    label: '产品中心',
    groups: [
      {
        title: '「双11特惠购」',
        badge: 'HOT',
        items: [
          '湖北襄阳8C-8G-30M · 69元/月起',
          '宁波电信8C-8C-20M · 69元/月起',
          '香港大宽带8C-8G-40M · 69元/月起',
        ],
      },
      {
        title: 'ECS弹性云服务器',
        items: [
          '宁波特惠云服务器 · 铂金8259CL',
          '大带宽限流型服务器 · 按量计费',
          '境外弹性服务器 · 全球布局',
        ],
      },
      {
        title: 'LH轻量云服务器',
        items: [
          '香港大埔 · 简单易上手',
          '香港将军澳 · 双向CN2GIA',
          '美国精品 · 极速回国线路',
          '深圳电信 · 智算中心',
          '四川移动 · 大带宽',
        ],
      },
      {
        title: 'EA边缘加速',
        items: ['安全高防盾-御 · 安全稳定', '独享高防盾-悦 · 资源独享'],
      },
      {
        title: 'GCC游戏云/云桌面',
        items: ['高频游戏云 · 只为性能而生', '蜂鸟云桌面 · 低成本开服'],
      },
      {
        title: 'PM物理服务器',
        items: [
          '襄阳40C-64G(BGP) · 200G防御',
          '镇江32/40C-64G(BGP) · 200G防御',
          '宁波电信（标准型） · 100G防御',
        ],
      },
      { title: 'IDC物理机托管', items: ['精选T3以上机房 · 骨干网络接入'] },
    ],
  },
]

const BANNERS: {
  img: string
  title: string
  desc: string
  cta: string
  label: string
  url: string
}[] = [
  {
    img: '/images/home/banners/banner-1.png',
    title: '高性能云服务器',
    desc: '优质稳定网络，满血性能释放，高防不惧攻击',
    cta: '立即购买',
    label: '高性能云',
    url: '',
  },
  {
    img: '/images/home/banners/banner-2.png',
    title: '锐驰带宽 轻装上阵',
    desc: '提供高性价比的大带宽云服务器解决方案',
    cta: '立即购买',
    label: '锐驰带宽',
    url: '',
  },
  {
    img: '/images/home/banners/banner-3.png',
    title: 'FurLL 易上云',
    desc: '简单易上手 高性价比的香港云服务器方案',
    cta: '快速上云',
    label: '易上云',
    url: '',
  },
  {
    img: '/images/home/banners/banner-4.png',
    title: 'AI 智防引擎',
    desc: '提供完善高性价比的安全边缘分发服务',
    cta: '立即体验',
    label: '智防引擎',
    url: '',
  },
]

// hero 右侧推荐标语（推荐产品）示例
const HERO_RECOMMENDS: {
  title: string
  desc: string
  tag: string
  price: string
  unit: string
  url: string
}[] = [
  {
    title: '海外加速白银版',
    desc: '网站类',
    tag: '限时推荐',
    price: '4.20',
    unit: '/ 月',
    url: '',
  },
  {
    title: '高质量云电脑 2核 2GB A型',
    desc: '可选 Windows / Linux',
    tag: '热卖',
    price: '3.60',
    unit: '/ 月',
    url: '',
  },
  {
    title: '香港精品CN2 2核 2GB',
    desc: '25Mbps · 双向500G',
    tag: '',
    price: '40.00',
    unit: '/ 月',
    url: '',
  },
  {
    title: '美国轻量云服务器 A型',
    desc: '不限流量 · 回国优化',
    tag: '',
    price: '16.00',
    unit: '/ 月',
    url: '',
  },
]

const PRODUCT_TABS = [
  {
    key: 'hot',
    label: '热门',
    products: [
      {
        title: '云服务器 ECS',
        desc: '高性能、高可用的云服务器，支持弹性扩展，适合各种业务场景，提供稳定可靠的计算能力',
        tag: 'HOT',
      },
      {
        title: '对象存储 OSS',
        desc: '海量、安全、低成本的云存储服务，支持多种存储类型，提供99.9%的数据可靠性',
      },
      {
        title: '物理服务器 PM',
        desc: '高性能、独享的物理服务器，高效应对海量业务请求，全链路可观测与告警联动',
      },
      {
        title: '边缘加速 EA',
        desc: '全球分布式CDN节点，加速内容分发，降低访问延迟，提升用户体验',
      },
    ],
  },
  {
    key: 'cn',
    label: '中国',
    products: [
      {
        title: '大带宽限流型云服务器',
        desc: '节点遍布全国 高性价比带宽 流量按量计费 业务弹性缩放自如',
      },
      {
        title: 'GC高频游戏云',
        desc: 'Platinum 8259L/8252C/Ryzen 9950X 多种CPU可选 只为性能而生',
      },
      {
        title: 'PM物理服务器',
        desc: '精选优质网络资源，高性能、独享的物理服务器，保障关键交易与访问不掉线',
      },
      {
        title: 'IDC物理机托管',
        desc: '精选T3以上机房，骨干网络接入，保障您的托管业务永续运行',
      },
    ],
  },
  {
    key: 'global',
    label: '境外',
    products: [
      { title: '香港', desc: '部署于多个数据中心，满足您的各种上云需求' },
      { title: '美国', desc: '高防与优化线路任您选择，业务上云无忧' },
      { title: '日本', desc: '精品网大带宽服务器 助你在亚太高效部署业务' },
      { title: '韩国', desc: '补充亚太地区节点需求 满足您亚太地区全面覆盖' },
    ],
  },
]

const WHY_ITEMS = [
  {
    icon: Gauge,
    title: '弹性计算',
    desc: '您可以在几分钟之内快速根据业务需求，可弹性创建与释放云服务器，轻松应对业务的快速变化。',
    tags: ['快速部署', '成本优化', '业务弹性'],
  },
  {
    icon: SlidersHorizontal,
    title: '多样化配置',
    desc: '提供多种类型的实例、操作系统和软件包。各实例中的 CPU、内存、硬盘和带宽可以灵活调整。',
    tags: ['灵活选择', '定制化服务', '多系统支持'],
  },
  {
    icon: ShieldCheck,
    title: '安全的网络',
    desc: '通过云控制台，切实保证您云上资源的安全性。您还可以完全掌控您的私有网络环境配置等。',
    tags: ['数据保护', '网络隔离', '访问管理', '安全加固'],
  },
  {
    icon: MonitorSmartphone,
    title: '管理简单',
    desc: '可以使用云控制台、进行重启等重要操作，这样管理实例就像管理操作您的计算机一样简单方便。',
    tags: ['一键操作', '直观界面', '管理便捷', '高效运维', '实时监控'],
  },
]

const MOBILE_STATS = [
  { data: '2800', suffix: '+', title: '全球覆盖节点' },
  { data: '0.01', suffix: 's', title: '平均响应时间' },
  { data: '70', suffix: '+', title: '覆盖国家' },
  { data: '130', suffix: 'T', title: '输出带宽' },
]

const SAMPLE_NEWS: NewsItem[] = [
  {
    id: 1,
    title: 'FurLL 全新一代高性能云服务器正式上线',
    type: '官方公告',
    create_time: 1751952000,
  },
  {
    id: 2,
    title: '关于香港节点网络线路优化的通知',
    type: '网维通知',
    create_time: 1751443200,
  },
  {
    id: 3,
    title: '数据中心机房扩容升级公告',
    type: '官方公告',
    create_time: 1751011200,
  },
  {
    id: 4,
    title: '轻量云服务器新春特惠活动开启',
    type: '业界新闻',
    create_time: 1750492800,
  },
  {
    id: 5,
    title: '安全防护体系全面升级，DDoS 防护能力再提升',
    type: '官方公告',
    create_time: 1749897600,
  },
]

function NavProductDropdown() {
  const [activeFirst, setActiveFirst] = useState<number>()
  const [activeSecond, setActiveSecond] = useState<number>()

  const firstQuery = useQuery({
    queryKey: ['web-pg-first'],
    queryFn: fetchProductGroupFirst,
    retry: false,
  })
  const firstGroups = firstQuery.data?.data?.list ?? []
  const first = activeFirst ?? firstGroups[0]?.id

  const secondQuery = useQuery({
    queryKey: ['web-pg-second', first],
    queryFn: () => fetchProductGroupSecond(Number(first)),
    enabled: !!first,
    retry: false,
  })
  const secondGroups = secondQuery.data?.data?.list ?? []
  const second = activeSecond ?? secondGroups[0]?.id

  const productQuery = useQuery({
    queryKey: ['web-pg-products', second],
    queryFn: () => fetchProductList({ id: Number(second) }),
    enabled: !!second,
    retry: false,
  })
  const products = productQuery.data?.data?.list ?? []

  return (
    <div className='invisible absolute top-full left-0 z-50 w-[760px] opacity-0 shadow-xl transition-all duration-200 group-hover:visible group-hover:opacity-100'>
      <div className='mt-2 grid max-h-[min(70vh,560px)] grid-cols-[200px_1fr] overflow-hidden rounded-xl border bg-card shadow-lg'>
        <div className='border-r bg-muted/50 py-4'>
          <div className='px-5 pb-2 text-sm font-semibold text-foreground'>
            产品列表
          </div>
          <div className='max-h-[calc(min(70vh,560px)-3rem)] overflow-y-auto'>
            {firstGroups.map((g) => (
              <button
                key={g.id}
                type='button'
                onMouseEnter={() => {
                  setActiveFirst(g.id)
                  setActiveSecond(undefined)
                }}
                className={`flex w-full items-center justify-between rounded-md px-5 py-2 text-sm transition-colors ${
                  first === g.id
                    ? 'bg-background font-medium text-primary'
                    : 'text-foreground/70 hover:bg-background hover:text-primary'
                }`}
              >
                <span className='truncate'>{g.name}</span>
                {first === g.id && (
                  <ChevronRight className='size-3.5 shrink-0' />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className='flex min-w-0 flex-col p-5'>
          <div className='relative mb-4 shrink-0'>
            <Search className='absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              className='h-9 bg-muted/50 pl-9'
              placeholder='快速找到您需要的产品和服务'
            />
          </div>

          <div className='min-h-0 overflow-y-auto pr-1'>
            {secondGroups.map((g) => {
              const groupProducts = second === g.id ? products : []
              const visible = groupProducts.slice(0, 6)
              const hasMore = groupProducts.length > 6
              return (
                <div key={g.id} className='mb-4 last:mb-0'>
                  <div className='mb-1.5 px-2 text-xs font-medium text-muted-foreground'>
                    {g.name}
                  </div>
                  <div className='grid grid-cols-2 gap-2'>
                    {visible.map((p) => (
                      <a
                        key={p.id}
                        href={`/cart/goods.htm?id=${p.id}`}
                        onMouseEnter={() => setActiveSecond(g.id)}
                        className='group flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-foreground/70 transition-colors hover:bg-muted hover:text-primary'
                      >
                        <span className='truncate'>{p.name}</span>
                        {p.recommend_text && (
                          <Badge className='ml-1 shrink-0 rounded-full bg-primary/10 text-primary hover:bg-primary/10'>
                            {p.recommend_text}
                          </Badge>
                        )}
                      </a>
                    ))}
                    {second === g.id && products.length === 0 && (
                      <p className='col-span-2 px-2 py-1 text-xs text-muted-foreground'>
                        {productQuery.isLoading ? '加载中...' : '该分类暂无产品'}
                      </p>
                    )}
                    {second === g.id && hasMore && (
                      <a
                        href={`/cart/goodsList.htm?fpg_id=${first}&spg_id=${g.id}`}
                        className='col-span-2 flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-muted'
                      >
                        查看更多
                        <ArrowRight className='size-3' />
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
            {secondGroups.length === 0 && (
              <p className='py-6 text-center text-xs text-muted-foreground'>
                暂无可选分类
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Nav() {
  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  const systemLogo = commonQuery.data?.data.system_logo

  // logo 缓存：接口未返回时先用上次缓存的链接占位，返回后 url 变化则更新缓存（与会员中心侧边栏共用缓存）
  const [cachedLogo, setCachedLogo] = useState(() => getCachedLogo())
  if (systemLogo && systemLogo !== cachedLogo) {
    cacheLogo(systemLogo)
    setCachedLogo(systemLogo)
  }
  const logoUrl = systemLogo || cachedLogo || undefined

  const accessToken = useAuthStore((s) => s.auth.accessToken)
  const accountQuery = useQuery({
    queryKey: ['web-nav-account'],
    queryFn: fetchAccount,
    enabled: !!accessToken,
    retry: false,
  })
  const accountName =
    accountQuery.data?.data.account?.username ||
    accountQuery.data?.data.account?.company ||
    accountQuery.data?.data.account?.phone

  return (
    <header className='sticky top-0 z-50 border-b bg-background/85 backdrop-blur'>
      <div className='mx-auto flex h-16 max-w-[1200px] items-center gap-6 px-4 sm:px-6'>
        <a href='/' className='flex shrink-0 items-center gap-2'>
          {logoUrl ? (
            <img src={logoUrl} alt='FurLL' className='h-9 w-auto' />
          ) : (
            <img
              src='/images/home/logo.png'
              alt='FurLL'
              className='h-9 w-auto'
            />
          )}
        </a>

        <nav className='hidden flex-1 items-center gap-1 lg:flex'>
          {PRODUCT_NAV.map((item) => (
            <div key={item.label} className='group relative'>
              <a
                href={item.groups ? '/#' : '#/'}
                className='flex items-center gap-1 rounded-md px-3 py-2 text-sm text-foreground/70 transition-colors hover:bg-muted hover:text-foreground'
              >
                {item.label}
                {item.groups && <ChevronDown className='size-3.5' />}
              </a>
              {item.groups && <NavProductDropdown />}
            </div>
          ))}
        </nav>

        <div className='hidden shrink-0 items-center gap-2 xl:flex'>
          <div className='relative'>
            <Search className='absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              className='h-9 w-44 bg-muted/50 pl-9'
              placeholder='搜索产品或服务...'
            />
          </div>
          <a
            href='/#'
            className='px-2 text-sm whitespace-nowrap text-foreground/70 transition-colors hover:text-foreground'
          >
            联系我们
          </a>
          <a
            href='/plugin/26/source.htm'
            className='px-2 text-sm whitespace-nowrap text-foreground/70 transition-colors hover:text-foreground'
          >
            帮助中心
          </a>
          {accessToken ? (
            <>
              <Link
                to='/home.htm'
                className='px-2 text-sm whitespace-nowrap text-foreground/70 transition-colors hover:text-foreground'
              >
                控制台
              </Link>
              <Link
                to='/home.htm'
                className='flex max-w-36 items-center gap-1.5 rounded-full border px-3 py-1 text-sm text-foreground/80 transition-colors hover:border-primary hover:text-primary'
              >
                <User className='size-3.5 shrink-0' />
                <span className='truncate'>{accountName || '用户中心'}</span>
              </Link>
            </>
          ) : (
            <Link
              to='/login.htm'
              className='px-2 text-sm whitespace-nowrap text-foreground/70 transition-colors hover:text-foreground'
            >
              登录
            </Link>
          )}
        </div>

        {!accessToken && (
          <div className='ml-auto hidden shrink-0 md:block xl:ml-0'>
            <Link to='/regist.htm'>
              <Button className='h-9 bg-primary px-5 text-sm text-primary-foreground hover:bg-primary/90'>
                免费注册
              </Button>
            </Link>
          </div>
        )}

        <button
          className='ml-auto flex size-9 items-center justify-center rounded-md text-foreground lg:hidden'
          aria-label='菜单'
        >
          <Menu className='size-5' />
        </button>
      </div>
    </header>
  )
}

function Banner() {
  const [index, setIndex] = useState(0)
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  )

  const { config, isAvailable } = useFurllHome()
  const failed = !isAvailable

  // 轮播图：获取失败仅显示第一张默认轮播图；成功时插件配置优先，空则回退内置静态数据
  const banners = useMemo(() => {
    if (failed) return BANNERS.slice(0, 1)
    if (config.banners.length > 0) {
      return config.banners.map((b) => ({
        img: b.image,
        title: b.title,
        desc: b.description,
        cta: b.button_text,
        label: b.label,
        url: b.url,
      }))
    }
    return BANNERS
  }, [config.banners, failed])

  // 推荐产品：获取失败不显示；成功时开关关闭不显示；配置有数据用配置，否则回退内置
  const recommends = useMemo(() => {
    if (failed) return []
    if (!config.recommendEnabled) return []
    if (config.recommends.length > 0) {
      return config.recommends.map((r) => ({
        title: r.name,
        desc: r.description,
        tag: r.tag,
        price: r.price,
        unit: r.unit,
        url: r.url,
      }))
    }
    return HERO_RECOMMENDS
  }, [config.recommendEnabled, config.recommends, failed])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = () => setReduced(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (reduced) return
    const t = setInterval(
      () => setIndex((i) => (i + 1) % banners.length),
      5000
    )
    return () => clearInterval(t)
  }, [reduced, banners.length])

  const current = banners[index]

  return (
    <section className='relative'>
      {failed && (
        <div className='absolute top-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-red-500/90 px-4 py-1 text-sm text-white shadow-lg'>
          信息获取失败
        </div>
      )}
      <div className='relative h-[480px] w-full overflow-hidden bg-foreground md:h-[600px] lg:h-[720px]'>
        {banners.map((b, i) => (
          <div
            key={b.title}
            className={`absolute inset-0 transition-opacity duration-700 ${i === index ? 'opacity-100' : 'opacity-0'}`}
          >
            <img
              src={b.img}
              alt={b.title}
              className='h-full w-full object-cover'
            />
            <div className='absolute inset-0 bg-gradient-to-r from-black/50 via-black/15 to-transparent' />
          </div>
        ))}
        {current && (
          <div className='absolute top-1/2 left-[6%] max-w-[720px] -translate-y-1/2 text-white md:left-[12%]'>
            <h1 className='text-3xl font-bold tracking-tight md:text-[40px] md:leading-tight'>
              {current.title}
            </h1>
            <p className='mt-4 text-base leading-relaxed font-normal text-white/85 md:text-lg'>
              {current.desc}
            </p>
            {current.url ? (
              <a href={current.url}>
                <Button
                  size='lg'
                  className='mt-6 bg-white px-6 text-sm font-medium text-foreground transition-transform hover:scale-[1.02] hover:bg-white/90'
                >
                  {current.cta}
                  <ArrowRight className='size-4' />
                </Button>
              </a>
            ) : (
              <Button
                size='lg'
                className='mt-6 bg-white px-6 text-sm font-medium text-foreground transition-transform hover:scale-[1.02] hover:bg-white/90'
                onClick={() => {}}
              >
                {current.cta}
                <ArrowRight className='size-4' />
              </Button>
            )}
          </div>
        )}

        <div className='absolute top-1/2 right-[6%] hidden w-64 -translate-y-1/2 flex-col gap-5 lg:flex'>
          {banners.map((b, i) => (
            <button
              key={b.label}
              onClick={() => setIndex(i)}
              className='group text-left'
              aria-label={`第 ${i + 1} 张轮播图`}
            >
              <div
                className={`text-base ${i === index ? 'font-semibold text-white' : 'text-white/55 transition-colors hover:text-white'}`}
              >
                {b.label}
              </div>
              <div className='mt-1 line-clamp-1 text-xs text-white/40'>
                {b.title}
              </div>
              <div className='mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-white/30'>
                <div
                  className={`h-full rounded-full bg-white transition-all duration-5000 ${i === index ? 'w-full' : 'w-0'}`}
                  style={
                    i === index && !reduced
                      ? { animation: 'nq-marquee-progress 5s linear forwards' }
                      : undefined
                  }
                />
              </div>
            </button>
          ))}

          {recommends.length > 0 && (
            <div className='mt-2 overflow-hidden rounded-xl border border-white/20 bg-white/10 backdrop-blur-md'>
              <div className='flex items-center justify-between px-4 py-2.5'>
                <span className='text-xs font-medium text-white'>推荐产品</span>
                <span className='flex items-center gap-1 text-[11px] text-[#fe5f47]'>
                  <Sparkles className='size-3' />
                  精选
                </span>
              </div>
              <ul className='divide-y divide-white/10'>
                {recommends.map((r) => (
                  <li key={r.title}>
                    <a
                      href={r.url || '/#'}
                      className='group flex items-center justify-between gap-2 px-4 py-2.5 transition-colors hover:bg-white/10'
                    >
                      <div className='min-w-0'>
                        <div className='flex items-center gap-1.5'>
                          <span className='truncate text-xs font-medium text-white'>
                            {r.title}
                          </span>
                          {r.tag && (
                            <Badge className='shrink-0 rounded-sm bg-[#fe5f47] px-1.5 py-0 text-[10px] font-normal text-white hover:bg-[#fe5f47]'>
                              {r.tag}
                            </Badge>
                          )}
                        </div>
                        <div className='mt-0.5 truncate text-[11px] text-white/50'>
                          {r.desc}
                        </div>
                      </div>
                      <div className='flex shrink-0 items-baseline text-white'>
                        <span className='text-sm font-semibold'>¥{r.price}</span>
                        <span className='text-[10px] text-white/50'>
                          {r.unit}
                        </span>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className='absolute bottom-5 left-[6%] flex gap-6 md:left-[12%] lg:hidden'>
          {banners.map((b, i) => (
            <button
              key={b.label}
              onClick={() => setIndex(i)}
              className='group w-20 text-left'
              aria-label={`第 ${i + 1} 张轮播图`}
            >
              <div
                className={`text-sm ${i === index ? 'font-semibold text-white' : 'text-white/55 transition-colors hover:text-white'}`}
              >
                {b.label}
              </div>
              <div className='mt-1 h-[3px] w-full overflow-hidden rounded-full bg-white/30'>
                <div
                  className={`h-full rounded-full bg-white transition-all duration-5000 ${i === index ? 'w-full' : 'w-0'}`}
                  style={
                    i === index && !reduced
                      ? { animation: 'nq-marquee-progress 5s linear forwards' }
                      : undefined
                  }
                />
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

function SectionHead({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className='text-center'>
      <h3 className='text-[30px] font-semibold tracking-tight text-[#1a1a1a]'>
        {title}
      </h3>
      {desc && (
        <p className='mx-auto mt-3 max-w-[1000px] text-base leading-relaxed text-[#717278]'>
          {desc}
        </p>
      )}
    </div>
  )
}

function Products() {
  // 一级分组 → 二级分组（tab）→ 组内产品，全部走 /console/v1/product 接口
  const firstQuery = useQuery({
    queryKey: ['web-pg-first'],
    queryFn: fetchProductGroupFirst,
    retry: false,
  })
  const firstGroups = firstQuery.data?.data?.list ?? []

  const secondQueries = useQueries({
    queries: firstGroups.map((g) => ({
      queryKey: ['web-pg-second', g.id],
      queryFn: () => fetchProductGroupSecond(g.id),
      retry: false,
    })),
  })
  const secondGroups = secondQueries.flatMap((q) => q.data?.data?.list ?? [])

  // 接口未返回任何二级分组（未授权/失败）时回退静态数据
  const hasApi = secondGroups.length > 0

  return (
    <section className='bg-[#f6f8fb] py-20'>
      <div className='mx-auto max-w-[1200px] px-4 sm:px-6'>
        <SectionHead
          title='提供企业一站式产品与服务'
          desc='携手三大公有云，提供快速、稳定、安全的全方位需求服务，帮助企业获得高效的动能'
        />

        {hasApi ? (
          <ApiProducts groups={secondGroups} />
        ) : (
          <Tabs defaultValue='hot' className='mt-10'>
            <TabsList className='h-10 bg-transparent px-1'>
              {PRODUCT_TABS.map((t) => (
                <TabsTrigger key={t.key} value={t.key} className='px-6'>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {PRODUCT_TABS.map((t) => (
              <TabsContent
                key={t.key}
                value={t.key}
                className='mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'
              >
                {t.products.map((p) => (
                  <a
                    key={p.title}
                    href='/#'
                    className='group relative flex flex-col justify-between rounded-[4px] border border-[#fff] bg-white p-7 shadow-[0_2px_10px_rgba(64,66,67,0.16)] transition-all hover:-translate-y-1 hover:border-[#0e52ff] hover:shadow-lg'
                  >
                    {p.tag && (
                      <Badge className='absolute top-3 right-3 rounded-sm bg-[#fe5f47] px-2 py-0.5 text-xs font-normal text-white hover:bg-[#fe5f47]'>
                        {p.tag}
                      </Badge>
                    )}
                    <div>
                      <h4 className='pr-10 font-medium text-foreground'>
                        {p.title}
                      </h4>
                      <p className='mt-2 text-sm leading-relaxed text-[#717278]'>
                        {p.desc}
                      </p>
                    </div>
                    <span className='mt-5 inline-flex items-center gap-1 text-sm font-medium text-[#0e52ff] transition-transform group-hover:translate-x-1'>
                      了解详情
                      <ArrowRight className='size-3.5' />
                    </span>
                  </a>
                ))}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </section>
  )
}

function ApiProducts({ groups }: { groups: { id: number; name: string }[] }) {
  const [active, setActive] = useState(() => String(groups[0]?.id ?? ''))

  // 每个二级分组的产品列表按需获取：仅当切换到对应 tab 时才请求
  // （react-query 缓存命中后，来回切换不会重复请求）
  const productQueries = useQueries({
    queries: groups.map((g) => ({
      queryKey: ['web-pg-products', g.id],
      queryFn: () => fetchProductList({ id: g.id }),
      enabled: String(g.id) === active,
      retry: false,
    })),
  })

  function renderProducts(products: ProductListItem[]) {
    if (!products.length) {
      return (
        <p className='col-span-full py-12 text-center text-sm text-[#717278]'>
          该分类暂无产品
        </p>
      )
    }
    return products.map((p) => (
      <a
        key={p.id}
        href='/#'
        className='group relative flex flex-col justify-between rounded-[4px] border border-[#fff] bg-white p-7 shadow-[0_2px_10px_rgba(64,66,67,0.16)] transition-all hover:-translate-y-1 hover:border-[#0e52ff] hover:shadow-lg'
      >
        {p.recommend_text && (
          <Badge className='absolute top-3 right-3 rounded-sm bg-[#fe5f47] px-2 py-0.5 text-xs font-normal text-white hover:bg-[#fe5f47]'>
            {p.recommend_text}
          </Badge>
        )}
        <div>
          <h4 className='pr-10 font-medium text-foreground'>{p.name}</h4>
          {p.description ? (
            <p
              className='prose-sm mt-2 line-clamp-3 text-sm leading-relaxed text-[#717278] [&_a]:text-[#0e52ff]'
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(p.description) }}
            />
          ) : null}
        </div>
        <span className='mt-5 inline-flex items-center gap-1 text-sm font-medium text-[#0e52ff] transition-transform group-hover:translate-x-1'>
          了解详情
          <ArrowRight className='size-3.5' />
        </span>
      </a>
    ))
  }

  return (
    <Tabs value={active} onValueChange={setActive} className='mt-10'>
      <TabsList className='h-10 flex-wrap bg-transparent px-1'>
        {groups.map((g) => (
          <TabsTrigger key={g.id} value={String(g.id)} className='px-6'>
            {g.name}
          </TabsTrigger>
        ))}
      </TabsList>

      {groups.map((g, i) => (
        <TabsContent
          key={g.id}
          value={String(g.id)}
          className='mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'
        >
          {productQueries[i]?.isPending || productQueries[i]?.isLoading ? (
            <>
              {Array.from({ length: 4 }).map((_, j) => (
                <div
                  key={j}
                  className='rounded-[4px] border border-white bg-white p-7 shadow-[0_2px_10px_rgba(64,66,67,0.16)]'
                >
                  <Skeleton className='h-5 w-3/4' />
                  <Skeleton className='mt-3 h-4 w-full' />
                  <Skeleton className='mt-2 h-4 w-2/3' />
                </div>
              ))}
            </>
          ) : (
            renderProducts(productQueries[i]?.data?.data?.list ?? [])
          )}
        </TabsContent>
      ))}
    </Tabs>
  )
}

type SolutionTab = {
  id: number
  icon: ComponentType<{ className?: string }>
  name: string
  title: string
  image: string
  features: string[]
}

const SOLUTION_TABS: SolutionTab[] = [
  {
    id: 1,
    icon: MonitorSmartphone,
    name: '音视频通信',
    title: '音视频通信',
    image: '/images/home/banners/banner-2.png',
    features: [
      'FurLL 多年音视频领域技术沉淀开放',
      '依托全球加速网络，实现低时延互通',
      '全终端 SDK，云端一体方案，最快 1 天接入',
    ],
  },
  {
    id: 2,
    icon: Gamepad2,
    name: '游戏云',
    title: '游戏云',
    image: '/images/home/banners/banner-1.png',
    features: [
      '高频 CPU 与高速内存，只为性能而生',
      'DDoS 高防盾，轻松应对恶意攻击',
      '全球节点就近接入，玩家体验丝滑',
    ],
  },
  {
    id: 3,
    icon: Landmark,
    name: '金融',
    title: '金融',
    image: '/images/home/banners/banner-4.png',
    features: [
      '等保合规，多重安全防护体系',
      '两地三中心高可用架构',
      '全链路审计，保障数据安全合规',
    ],
  },
  {
    id: 4,
    icon: Factory,
    name: '制造业',
    title: '制造业',
    image: '/images/home/banners/banner-3.png',
    features: [
      '工业互联网平台支撑，设备上云',
      '边缘计算就近处理，降低时延',
      '弹性扩容，从容应对生产高峰',
    ],
  },
]

const LOGO_WALLS: { name: string; img: string; url: string }[][] = [
  [
    { name: 'FurTech', img: '/images/home/partners/67a8c647a0e80.png', url: '' },
    { name: 'FurBank', img: '/images/home/partners/67a8c6adc83e1.png', url: '' },
    { name: 'FurLive', img: '/images/home/partners/67a8ca1cc67e8.png', url: '' },
    { name: 'FurGame', img: '/images/home/partners/68a43e33e650a.png', url: '' },
    { name: 'FurMeet', img: '/images/home/partners/68da0a4a45ed7.png', url: '' },
  ],
  [
    { name: 'FurShop', img: '/images/home/partners/67a8c647a0e80.png', url: '' },
    { name: 'FurCloud', img: '/images/home/partners/67a8c6adc83e1.png', url: '' },
    { name: 'FurSec', img: '/images/home/partners/67a8ca1cc67e8.png', url: '' },
    { name: 'FurAI', img: '/images/home/partners/68a43e33e650a.png', url: '' },
    { name: 'FurEdu', img: '/images/home/partners/68da0a4a45ed7.png', url: '' },
  ],
]

function Solutions() {
  const { config } = useFurllHome()

  // 合作伙伴 Logo：插件配置优先，按 wall 分组为两行，空则回退内置静态数据
  const logoWalls = useMemo(() => {
    if (config.partners.length > 0) {
      const walls: { name: string; img: string; url: string }[][] = [[], []]
      config.partners.forEach((p) => {
        const idx = Number(p.wall) === 2 ? 1 : 0
        walls[idx].push({ name: p.name, img: p.image, url: p.url })
      })
      const nonEmpty = walls.filter((w) => w.length > 0)
      return nonEmpty.length > 0 ? nonEmpty : LOGO_WALLS
    }
    return LOGO_WALLS
  }, [config.partners])

  return (
    <section className='bg-[#fafafa] py-20'>
      <div className='mx-auto max-w-[1200px] px-4 sm:px-6'>
        <div className='flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center'>
          <div className='flex flex-col gap-3'>
            <span className='text-sm font-medium text-[#0e52ff]'>客户案例</span>
            <h2 className='text-[30px] leading-tight font-semibold tracking-tight text-[#1a1a1a] sm:text-[36px]'>
              行业领先的解决方案，助力您的企业安全高效上云
            </h2>
          </div>
        </div>

        {/* AccordionGallery */}
        <div className='mt-10'>
          <AccordionGallery
            items={SOLUTION_TABS.map((t) => ({
              image: t.image,
              label: t.name,
              alt: t.title,
              description: t.features,
            }))}
            defaultIndex={0}
            height={460}
            accentColor='#0e52ff'
            overlayColor='#0a1328'
            textColor='#ffffff'
            trigger='hover'
          />
        </div>

        {/* Partner logo wall */}
        <div className='mt-4 flex flex-col items-center pt-10'>
          <div className='flex w-full items-center gap-6'>
            <span className='hidden h-px flex-1 bg-[#e5e5e5] sm:block' />
            <div className='text-center text-lg font-medium text-[#1a1a1a]'>
              与全球伙伴携手，深入产业
              <a href='/#' className='text-[#0e52ff]'>
                共创价值
              </a>
            </div>
            <span className='hidden h-px flex-1 bg-[#e5e5e5] sm:block' />
          </div>

          <div className='mt-10 w-full space-y-8'>
            {logoWalls.map((row, i) => {
              // 数量少时不做跑马灯，居中静态展示，避免稀疏难看
              if (row.length < 4) {
                return (
                  <div
                    key={i}
                    className='flex flex-wrap items-center justify-center gap-8'
                  >
                    {row.map((logo) => (
                      <a
                        key={logo.name}
                        href={logo.url || '/#'}
                        className='flex h-16 w-40 items-center justify-center rounded-lg border border-[#e5e5e5] bg-white grayscale transition-all hover:border-[#0e52ff] hover:grayscale-0'
                      >
                        <img
                          src={logo.img}
                          alt={logo.name}
                          loading='lazy'
                          className='max-h-9 max-w-[7rem] object-contain'
                        />
                      </a>
                    ))}
                  </div>
                )
              }
              // 跑马灯：按卡片数补足重复次数，保证滚动时左右始终铺满无空白
              // 卡片 w-40=160px + gap-8=32px，目标铺满宽度取 1600px（> 容器 1200px）
              const rowW = row.length * 192
              const copies = Math.max(2, Math.ceil(1600 / rowW))
              const group = Array.from({ length: copies }).flatMap(() => row)
              return (
                <div key={i} className='relative overflow-hidden'>
                  <div className='flex w-max items-center gap-8 lg:w-full'>
                    <div
                      className='flex w-max items-center gap-8 pr-8'
                      style={{
                        animation: `nq-logo-marquee ${(30 + i * 5) * copies}s linear infinite`,
                      }}
                    >
                      {[...group, ...group].map((logo, j) => (
                        <a
                          key={`${logo.name}-${j}`}
                          href={logo.url || '/#'}
                          className='flex h-16 w-40 items-center justify-center rounded-lg border border-[#e5e5e5] bg-white grayscale transition-all hover:border-[#0e52ff] hover:grayscale-0'
                        >
                          <img
                            src={logo.img}
                            alt={logo.name}
                            loading='lazy'
                            className='max-h-9 max-w-[7rem] object-contain'
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

function WhyChoose() {
  return (
    <section className='bg-white py-20'>
      <div className='mx-auto max-w-[1200px] px-4 sm:px-6'>
        <SectionHead
          title='为什么选择我们'
          desc='提供极致体验的企业上云服务，拥有安全有效的解决方案，为您云上旅程保驾护航'
        />

        <div className='mt-10 grid grid-cols-1 gap-5 lg:grid-cols-2'>
          {WHY_ITEMS.map((item) => (
            <div
              key={item.title}
              className='group flex items-center justify-between gap-6 rounded-[4px] border border-white bg-white p-[30px_34px] shadow-[0_2px_10px_rgba(64,66,67,0.16)] transition-all hover:border-[#0e52ff] hover:shadow-lg'
            >
              <div className='min-w-0'>
                <h4 className='text-lg font-medium text-[#040613] transition-colors group-hover:text-[#0e52ff]'>
                  {item.title}
                </h4>
                <p className='mt-2 text-sm leading-relaxed text-[#717278]'>
                  {item.desc}
                </p>
                <div className='mt-4 flex flex-wrap gap-2'>
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className='rounded-sm bg-[#f0f4ff] px-3 py-1 text-xs text-[#0e52ff]'
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className='flex shrink-0 text-[#0e52ff] transition-colors group-hover:text-[#0e52ff]'>
                <item.icon className='size-8' />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function DataCenter() {
  return (
    <section className='bg-gradient-to-b from-white to-[#f6f8fb] py-20'>
      <div className='relative mx-auto max-w-[1200px] px-4 sm:px-6'>
        <div className='text-center'>
          <h3 className='text-[30px] font-semibold tracking-tight text-[#1a1a1a]'>
            畅享云端，连接未来
          </h3>
          <p className='mx-auto mt-3 max-w-[1000px] text-base leading-relaxed text-[#717278]'>
            FurLL 携手三大公有云，无论用户身在何处，均能获得灵活流畅的体验
          </p>
        </div>

        <div className='relative mt-10 aspect-[16/10] min-h-[260px] w-full sm:aspect-[5/2]'>
          <Strands
            colors={['#0e52ff', '#7C3AED', '#06B6D4', '#e05252']}
            count={5}
            speed={0.45}
            amplitude={1.1}
            waviness={1.1}
            thickness={0.7}
            glow={2.6}
            taper={2.5}
            spread={1}
            intensity={0.85}
            saturation={1.5}
            opacity={1}
            scale={1.4}
          />
          <div className='pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white to-transparent' />
          <div className='pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#f6f8fb] to-transparent' />
        </div>

        <div className='mx-auto mt-12 grid max-w-[900px] grid-cols-2 gap-8 lg:grid-cols-4'>
          {MOBILE_STATS.map((s) => (
            <div key={s.title} className='text-center'>
              <p className='text-3xl font-bold text-[#0e52ff]'>
                {s.data}
                <span className='text-xl text-[#0e52ff]'>{s.suffix}</span>
              </p>
              <h5 className='mt-1 text-sm text-[#717278]'>{s.title}</h5>
            </div>
          ))}
        </div>

        <div className='mt-12 text-center'>
          <a href='/#'>
            <Button
              variant='outline'
              className='h-10 rounded-[4px] border-[#0e52ff] px-8 text-[#0e52ff] hover:bg-[#0e52ff] hover:text-white'
            >
              了解更多
              <ArrowRight className='size-4' />
            </Button>
          </a>
        </div>
      </div>
    </section>
  )
}

function NewsListBody({
  list,
  loading,
}: {
  list: NewsItem[]
  loading: boolean
}) {
  function formatDate(ts: number) {
    const d = new Date(ts * 1000)
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  }

  if (loading) {
    return (
      <ul className='divide-y divide-[#f0f0f0]'>
        {Array.from({ length: 5 }).map((_, i) => (
          <li
            key={i}
            className='flex items-center justify-between gap-4 px-6 py-4'
          >
            <div className='flex flex-1 items-center gap-3'>
              <Skeleton className='h-4 w-4 shrink-0 rounded-sm' />
              <Skeleton className='h-4 flex-1' />
            </div>
            <Skeleton className='h-4 w-20' />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <ul className='divide-y divide-[#f0f0f0]'>
      {list.map((item, i) => (
        <li
          key={item.id}
          className='group px-6 py-4 transition-colors hover:bg-[#fafbff]'
        >
          <a
            href={`/news_detail.htm?id=${item.id}`}
            className='flex items-center gap-3'
          >
            <span className='w-5 shrink-0 text-sm text-[#aab4c6]'>{i + 1}</span>
            <h5 className='flex-1 truncate text-base text-[#2c3e50] transition-colors group-hover:text-[#0e52ff]'>
              {item.title}
            </h5>
            <span className='shrink-0 text-sm text-[#7a8ba6]'>
              {formatDate(item.create_time)}
            </span>
          </a>
        </li>
      ))}
    </ul>
  )
}

function NewsSection() {
  // 公告走独立接口 /announcement，新闻走 /news，内容天然不同
  const announceQuery = useQuery({
    queryKey: ['web-home-announce'],
    queryFn: () => fetchAnnouncement({ page: 1, limit: 5 }),
    retry: false,
    staleTime: Infinity,
  })
  const newsQuery = useQuery({
    queryKey: ['web-home-news'],
    queryFn: () => fetchNews({ page: 1, limit: 5 }),
    retry: false,
    staleTime: Infinity,
  })

  const tabs = [
    {
      key: 'announce' as const,
      label: '公告',
      list: announceQuery.data?.data?.list?.length
        ? announceQuery.data.data.list
        : SAMPLE_NEWS,
    },
    {
      key: 'news' as const,
      label: '新闻资讯',
      list: newsQuery.data?.data?.list?.length
        ? newsQuery.data.data.list
        : SAMPLE_NEWS,
    },
  ]

  const [tabKey, setTabKey] = useState<'announce' | 'news'>('announce')
  const active = tabs.find((t) => t.key === tabKey) ?? tabs[0]
  const loading = announceQuery.isLoading || newsQuery.isLoading

  return (
    <section className='bg-[#f6f8fb] py-20'>
      <div className='mx-auto max-w-[1200px] px-4 sm:px-6'>
        <div className='grid gap-8 lg:grid-cols-[400px_1fr]'>
          <div className='relative h-[402px] overflow-hidden rounded-lg'>
            <img
              src='/images/home/banners/banner-1.png'
              alt='资讯公告'
              className='absolute inset-0 h-full w-full object-cover'
              loading='lazy'
            />
            <div className='absolute inset-0 bg-gradient-to-t from-black/40 to-black/10' />
            <div className='absolute top-10 left-[5.5%] w-[88.5%] bg-white/90 p-5 backdrop-blur'>
              <h5 className='text-lg leading-relaxed font-medium text-[#2c3e50]'>
                【FurLL】资讯公告、产品发布，汇聚前沿的云计算技术
              </h5>
            </div>
          </div>

          <div className='rounded-lg bg-white shadow-[0_2px_10px_rgba(64,66,67,0.16)]'>
            <div className='flex items-center justify-between border-b border-[#f0f0f0] px-6 py-4'>
              <div className='flex items-center gap-1 rounded-md bg-[#f0f3f8] p-1'>
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    type='button'
                    onClick={() => setTabKey(t.key)}
                    className={`rounded-md px-4 py-1.5 text-sm transition-colors ${
                      tabKey === t.key
                        ? 'bg-white font-medium text-[#0e52ff] shadow-sm'
                        : 'text-[#6b7688] hover:text-[#0e52ff]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <a
                href='/source.htm'
                className='inline-flex items-center gap-1 text-sm text-[#0e52ff] transition-colors hover:text-[#0080ff]'
              >
                更多
                <ArrowRight className='size-3.5' />
              </a>
            </div>
            <NewsListBody list={active.list} loading={loading} />
          </div>
        </div>
      </div>
    </section>
  )
}

const FOOTER_STATS = [
  { data: '500+', suffix: '', label: '项 AI 产品及方案' },
  { data: '1000', suffix: '万+', label: '的生态合作伙伴' },
]

const FOOTER_TRUST = [
  { icon: Award, label: '可靠的 SLA 保障承诺' },
  { icon: Headphones, label: '资深工程师专业支持' },
  { icon: Clock, label: '乐享会员优先响应' },
  { icon: Users, label: '大客户 1V1 专享服务' },
  { icon: Activity, label: '服务可用性' },
]

function Footer() {
  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  const common = commonQuery.data?.data
  const beianItems = [
    { label: '隐私政策', href: common?.terms_privacy_url },
    { label: '用户服务协议', href: common?.terms_service_url },
  ]
  const icpItems = [
    common?.icp_info && { text: common.icp_info, href: common?.icp_info_link },
    common?.public_security_network_preparation && {
      text: common.public_security_network_preparation,
      href: common?.public_security_network_preparation_link,
    },
    common?.telecom_appreciation && { text: common.telecom_appreciation, href: '#' },
  ].filter(Boolean) as { text: string; href?: string }[]

  return (
    <footer className='overflow-hidden bg-[#0c1a36] text-[#8a96ab]'>
      {/* 顶部数据条 + CTA */}
      <div className='mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-6 border-b border-white/10 px-4 py-10 sm:px-6 lg:flex-row lg:items-center'>
        <div className='flex flex-wrap items-center gap-x-8 gap-y-4'>
          {FOOTER_STATS.map((s) => (
            <p key={s.label} className='flex items-baseline gap-2'>
              <span className='font-mono text-4xl leading-none font-bold text-[#5b8cff]'>
                {s.data}
                <span className='text-2xl'>{s.suffix}</span>
              </span>
              <span className='text-base text-white'>{s.label}</span>
            </p>
          ))}
        </div>
        <a
          href='/#'
          className='group inline-flex items-center gap-2 rounded-[4px] bg-[#0e52ff] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[#0a3fcc]'
        >
          全栈赋能，立即咨询
          <ArrowRight className='size-4 transition-transform group-hover:translate-x-0.5' />
        </a>
      </div>

      {/* 信任徽章 */}
      <div className='mx-auto max-w-[1200px] border-t border-white/10 px-4 py-8 sm:px-6'>
        <div className='grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-6'>
          {FOOTER_TRUST.map((t) => (
            <div key={t.label} className='flex items-center gap-2.5'>
              <t.icon className='size-5 shrink-0 text-[#5b8cff]' />
              <span className='text-xs leading-snug'>{t.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 底部版权 + 备案 */}
      <div className='border-t border-white/10'>
        <div className='mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-4 px-4 py-6 text-sm sm:px-6 lg:flex-row lg:items-center'>
          <p className='flex flex-wrap items-center gap-3'>
            <span>
              {common?.copyright_info || `版权所有 © ${new Date().getFullYear()} FurLL`}
            </span>
            {beianItems.map(
              (b) =>
                b.href && (
                  <a
                    key={b.label}
                    href={b.href}
                    target='_blank'
                    rel='noreferrer'
                    className='transition-colors hover:text-white'
                  >
                    {b.label}
                  </a>
                ),
            )}
          </p>
          <p className='flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5f6d85]'>
            {icpItems.map((item) =>
              item.href ? (
                <a
                  key={item.text}
                  href={item.href}
                  target='_blank'
                  rel='noreferrer'
                  className='transition-colors hover:text-white'
                >
                  {item.text}
                </a>
              ) : (
                <span key={item.text}>{item.text}</span>
              ),
            )}
          </p>
        </div>
      </div>
    </footer>
  )
}

function MobileBottomNav() {
  const items = [
    { icon: Home, label: '首页', href: '/' },
    { icon: Boxes, label: '产品中心', href: '/#' },
    { icon: Headset, label: '了解我们', href: '/#' },
    { icon: User, label: '个人中心', href: '/home.htm' },
  ]
  return (
    <nav className='fixed right-0 bottom-0 left-0 z-40 flex justify-around border-t bg-white py-3 shadow-[0_-2px_10px_rgba(0,0,0,0.1)] lg:hidden'>
      {items.map((item) => (
        <a
          key={item.label}
          href={item.href}
          className='flex flex-col items-center gap-1 text-xs text-[#666] transition-colors hover:text-[#0e52ff] active:text-[#0e52ff]'
        >
          <item.icon className='size-5' />
          <span>{item.label}</span>
        </a>
      ))}
    </nav>
  )
}

export function WebIndexPage() {
  const { isReady } = useFurllHome()

  // 首页配置（FurllHome 插件）未获取完成前，显示与登录页一致的加载动画
  if (!isReady) {
    return <MainLoading text='正在加载首页配置…' />
  }

  return (
    <div className='flex min-h-svh flex-col bg-background font-sans text-foreground antialiased'>
      <style>{MARQUEE_KEYFRAMES}</style>
      <Nav />
      <main className='flex-1'>
        <Banner />
        <Products />
        <Solutions />
        <WhyChoose />
        <DataCenter />
        <NewsSection />
      </main>
      <Footer />
      <MobileBottomNav />
      <div className='h-16 lg:hidden' aria-hidden='true' />
    </div>
  )
}
