import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { Toaster } from '@/components/ui/sonner'
import { ClientLayout } from '@/components/layout/client-layout'
import { NavigationProgress } from '@/components/navigation-progress'
import { LoginPage } from '@/features/auth/login'
import { SignUp } from '@/features/auth/sign-up'
import { GoodsListPage } from '@/features/cart/goods-list'
import { ShoppingCarPage } from '@/features/cart/shopping-car'
import { GoodsPage } from '@/features/cart/goods'
import { SettlementPage } from '@/features/cart/settlement'
import { HomePage } from '@/features/client/home'
import { ProductPage } from '@/features/client/product'
import { ProductDetailPage } from '@/features/client/product-detail'
import { CrossModulePage } from '@/features/client/cross-module'
import { ProductListPage } from '@/features/client/product-list'
import { AccountPage } from '@/features/client/account/account'
import { FinancePage } from '@/features/client/finance/finance'
import { WithdrawalPage } from '@/features/client/finance/withdrawal'
import { OrderDetailPage } from '@/features/client/finance/order-detail'
import { PlaceholderPage } from '@/features/client/placeholder'
import { TicketCenterPage } from '@/features/client/ticket/ticket-center'
import { AddTicketPage } from '@/features/client/ticket/ticket-add'
import { PluginPage } from '@/features/client/plugin'
import { ChildAccountPage } from '@/features/client/sub-account/child-account'
import { AddChildAccountPage } from '@/features/client/sub-account/add-child-account'
import { CertificationSelectPage } from '@/features/client/certification/certification-select'
import { CertificationPersonPage } from '@/features/client/certification/certification-person'
import { CertificationCompanyPage } from '@/features/client/certification/certification-company'
import { CertificationThirdPage } from '@/features/client/certification/certification-third'
import { CertificationStatusPage } from '@/features/client/certification/certification-status'
import { ResourceCenterShell } from '@/features/client/news/resource-center-shell'
import { NewsDetailPage } from '@/features/client/news/news-detail'
import { SecurityPage } from '@/features/client/security/security'
import { SshKeyPage } from '@/features/client/security/ssh-key'
import { SecurityLogPage } from '@/features/client/security/security-log'
import { SecurityGroupPage } from '@/features/client/security/security-group'
import { GroupRulesPage } from '@/features/client/security/group-rules'
import { TransferPage } from '@/features/client/transfer'
import { GeneralError } from '@/features/errors/general-error'
import { NotFoundError } from '@/features/errors/not-found-error'
import { WebIndexPage } from '@/features/web'

const rootRoute = createRootRoute({
  component: () => {
    return (
      <>
        <NavigationProgress />
        <Outlet />
        <Toaster duration={5000} />
      </>
    )
  },
  notFoundComponent: NotFoundError,
  errorComponent: GeneralError,
})

const clientRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'client',
  beforeLoad: () => {
    const token = useAuthStore.getState().auth.accessToken
    if (!token) {
      throw redirect({
        href: `/login.htm?redirect=${encodeURIComponent(window.location.pathname)}`,
      })
    }
  },
  component: ClientLayout,
})

// 免登录公共布局（官方 /cart/goodsList.htm 不强制登录，游客仅可浏览产品）：
// 复用 ClientLayout（游客态下跳过登录接口，侧边栏/顶栏显示登录入口），但不做登录跳转
const publicClientRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'public-client',
  component: ClientLayout,
})

const homeRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'home.htm',
  component: HomePage,
})

// 账户中心（官方 /account.htm，个人资料/操作日志/站内信）
const accountRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'account.htm',
  component: AccountPage,
})

// 财务中心（官方 /finance.htm，订单/交易/余额/代金券/电子合同/信用额/平台币）
const financeRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'finance.htm',
  component: FinancePage,
})

// 提现记录（官方 /withdrawal.htm，GET /console/v1/withdraw 列表）
const withdrawalRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'withdrawal.htm',
  component: WithdrawalPage,
})

// 订单详情（官方 /orderDetail.htm?id=，GET /console/v1/order/:id + transaction_record）
const orderDetailRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'orderDetail.htm',
  component: OrderDetailPage,
})

// 模块菜单商品页（官方 /product.htm?m=，m 为 /menu 导航中 menu_type=module 的菜单 ID）
const productRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'product.htm',
  component: ProductPage,
})

// 跨模块产品列表页（官方 /crossModule.htm?m=，is_cross_module=1 的模块菜单）
const crossModuleRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'crossModule.htm',
  component: CrossModulePage,
})

// 我已订购的产品（官方 /productList.htm，GET /console/v1/client/host 全模块列表）
const productListRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'productList.htm',
  component: ProductListPage,
})

// 产品详情页（官方 /productdetail.htm?id=，id 为已购产品 host ID）
const productDetailRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'productdetail.htm',
  component: ProductDetailPage,
})

// 工单中心（双栏聊天式，官方 idcsmart_ticket 插件 ticket.html / ticketDetails.html）
const ticketRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'ticket.htm',
  component: TicketCenterPage,
})

// 工单中心别名：侧边栏 /menu 返回的插件菜单 url 为裸 'ticket'（官方 sidebar_clientarea.php）
const ticketBareRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'ticket',
  component: TicketCenterPage,
})

// 工单详情深链（官方 /ticketDetails.html?id=，直接打开选中工单的对话）
const ticketDetailsRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'ticketDetails.htm',
  component: TicketCenterPage,
})

// 新建工单（官方 /addTicket.html）
const addTicketRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'addTicket.htm',
  component: AddTicketPage,
})

// 子账户列表（官方 IdcsmartSubAccount 插件 childAccount.html；侧边栏经 plugin/<id>/childAccount.htm 进入）
const childAccountRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'childAccount.htm',
  component: ChildAccountPage,
})

// 子账户列表裸别名（官方 sidebar_clientarea.php url='childAccount'）
const childAccountBareRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'childAccount',
  component: ChildAccountPage,
})

// 新增/编辑子账户（官方 /addChildAccount.html?id=&type=edit）
const addChildAccountRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'addChildAccount.htm',
  component: AddChildAccountPage,
})

// 官方 clientarea 插件模板统一入口 /plugin/:plugin_id/:view_html.htm（route/home.php）：
// 插件导航 url 被 createPluginNav 转换为 plugin/<插件ID>/<view>.htm（插件ID 随安装环境变化）。
// 用动态段注册，插件ID 通过 /rtapi/addons.php 反查：命中已适配插件（工单/新闻）渲染对应界面，
// 未适配插件提示标识并引导联系客服/模板提供商
const pluginRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'plugin/$pluginId/$view.htm',
  component: PluginPage,
})

// 实名认证裸别名（官方 IdcsmartCertification 插件 authentication_select.htm 等；
// 插件 URL 走 pluginRoute，直链/兜底用裸路径，deploy 已生成 php 壳）
const certificationSelectRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'authentication_select.htm',
  component: CertificationSelectPage,
})

const certificationPersonRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'authentication_person.htm',
  component: CertificationPersonPage,
})

const certificationCompanyRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'authentication_company.htm',
  component: CertificationCompanyPage,
})

const certificationThirdRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'authentication_thrid.htm',
  component: CertificationThirdPage,
})

const certificationStatusRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'authentication_status.htm',
  component: CertificationStatusPage,
})

// 资源中心裸别名（官方 /source.htm，news 插件入口；news_detail.htm?id= 为新闻详情，需登录）
const sourceRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'source.htm',
  component: ResourceCenterShell,
})

const newsDetailRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'news_detail.htm',
  component: NewsDetailPage,
})

// 安全中心（官方 /security.htm，API密钥管理；子账户按权限控制 tab 显示）
const securityRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'security.htm',
  component: SecurityPage,
})

// SSH密钥（官方 /security_ssh.htm，IdcsmartSshKey 插件）
const securitySshRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'security_ssh.htm',
  component: SshKeyPage,
})

// API日志（官方 /security_log.htm，GET /console/v1/log?type=api）
const securityLogRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'security_log.htm',
  component: SecurityLogPage,
})

// 安全组（官方 /security_group.htm，IdcsmartCloud 插件，GET /console/v1/security_group）
const securityGroupRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'security_group.htm',
  component: SecurityGroupPage,
})

// 安全组规则/关联实例（官方 /group_rules.htm?id=，groupId 为安全组 ID）
const groupRulesRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'group_rules.htm',
  component: GroupRulesPage,
})

// 二次提醒中转页（官方 /transfer.htm?target=，外链菜单 second_reminder=1 先经此确认再访问）
const transferRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'transfer.htm',
  component: TransferPage,
})

// 购物车商品货架页（官方 /cart/goodsList.htm，唯一免登录页面：游客可浏览产品，下单/其他页面需登录）
const goodsListRoute = createRoute({
  getParentRoute: () => publicClientRoute,
  path: 'cart/goodsList.htm',
  component: GoodsListPage,
})

// 商品配置页（需登录；?id=商品ID，?change=true&name= 为购物车编辑回填）
const goodsRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'cart/goods.htm',
  component: GoodsPage,
})

// 购物车页（需登录）
const shoppingCarRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'cart/shoppingCar.htm',
  component: ShoppingCarPage,
})

// 结算页（嵌入会员中心布局，需登录；?cart=1 从购物车结算，否则为商品直接购买结算）
const settlementRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'cart/settlement.htm',
  component: SettlementPage,
})

const webIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: WebIndexPage,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'login.htm',
  beforeLoad: () => {
    const token = useAuthStore.getState().auth.accessToken
    if (token) {
      throw redirect({
        href: '/home.htm',
      })
    }
  },
  component: LoginPage,
})

const placeholderRoutes = ['transaction'].map((page) =>
  createRoute({
    getParentRoute: () => clientRoute,
    path: `${page}.htm`,
    component: () => <PlaceholderPage title={page} />,
  })
)

const registRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'regist.htm',
  beforeLoad: () => {
    const token = useAuthStore.getState().auth.accessToken
    if (token) {
      throw redirect({
        href: '/home.htm',
      })
    }
  },
  component: SignUp,
})

const publicRoutes = ['forget', 'agreement', 'oauth'].map((page) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path: `${page}.htm`,
    component: () => <PlaceholderPage title={page} />,
  })
)

const routeTree = rootRoute.addChildren([
  webIndexRoute,
  clientRoute.addChildren([
    homeRoute,
    accountRoute,
    financeRoute,
    withdrawalRoute,
    orderDetailRoute,
    productRoute,
    crossModuleRoute,
    productListRoute,
    productDetailRoute,
    ticketRoute,
    ticketBareRoute,
    ticketDetailsRoute,
    addTicketRoute,
    childAccountRoute,
    childAccountBareRoute,
    addChildAccountRoute,
    pluginRoute,
    certificationSelectRoute,
    certificationPersonRoute,
    certificationCompanyRoute,
    certificationThirdRoute,
    certificationStatusRoute,
    sourceRoute,
    newsDetailRoute,
    securityRoute,
    securitySshRoute,
    securityLogRoute,
    securityGroupRoute,
    groupRulesRoute,
    transferRoute,
    settlementRoute,
    goodsRoute,
    shoppingCarRoute,
    ...placeholderRoutes,
  ]),
  publicClientRoute.addChildren([goodsListRoute]),
  loginRoute,
  registRoute,
  ...publicRoutes,
])

export const router = createRouter({
  routeTree,
  defaultPreload: false,
  defaultPreloadStaleTime: 0,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
