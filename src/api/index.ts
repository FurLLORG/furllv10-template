import { ApiError, api, type ApiResponse } from '@/lib/api'
import { REMF_API_BASE, type RemfModule } from '@/lib/remf-module'

export interface AccountSummary {
  id: number
  username: string
  email: string
  phone: string
  phone_code: string
  credit: string
  host_num: string
  host_active_num: string
  expiring_count: number
  unpaid_order: string
  consume: string
  this_month_consume: string
  this_month_consume_percent: string
}

export interface HomeHost {
  id: number
  product_id: number
  product_name: string
  name: string
  due_time: number
  status: string
  client_notes: string
  type: string
  ip: string
}

export interface IndexData {
  account: AccountSummary
}

export interface IndexHostData {
  list: HomeHost[]
  count: number
  expiring_count: number
}

export interface LoginParams {
  type: 'password' | 'code'
  account: string
  phone_code?: string
  code?: string
  password?: string
  remember_password?: number
  captcha?: string
  token?: string
  /** 异常登录安全验证（官方 handleSecurityVerify 参数） */
  security_verify_method?: string
  security_verify_value?: string
  certify_id?: string
  security_verify_token?: string
  customfield?: Record<string, unknown>
}

export interface LoginResult {
  jwt: string
  client_id: number
  need_security_verify?: boolean
  available_methods?: AvailableSecurityMethod[]
}

export async function login(
  params: LoginParams
): Promise<ApiResponse<LoginResult>> {
  const { data } = await api.post('/login', params)
  return data
}

/** 图形验证码（官方 GET /console/v1/captcha，返回插件渲染的 html 文档） */
export async function fetchCaptcha(): Promise<ApiResponse<{ html: string }>> {
  const { data } = await api.get('/captcha')
  return data
}

/** 三方登录回跳后轮询取 jwt（官方 GET /console/v1/oauth/token） */
export async function fetchOauthToken(): Promise<
  ApiResponse<{ jwt?: string; url?: string }>
> {
  const { data } = await api.get('/oauth/token')
  return data
}

/** 注册页用户自定义字段（官方 GET /console/v1/register/custom_field，ClientCustomField 插件提供） */
export async function fetchRegistCustomField(): Promise<
  ApiResponse<{ list: ClientCustomFieldItem[] }>
> {
  const { data } = await api.get('/register/custom_field')
  return data
}

export async function logout(): Promise<ApiResponse> {
  const { data } = await api.post('/logout')
  return data
}

/** 发送邮箱验证码（action: register 为注册场景） */
export async function sendEmailCode(params: {
  action: string
  email: string
  token?: string
  captcha?: string
}): Promise<ApiResponse> {
  const { data } = await api.post('/email/code', params)
  return data
}

/** 发送手机验证码（action: register 为注册场景） */
export async function sendPhoneCode(params: {
  action: string
  phone: string
  phone_code: string
  token?: string
  captcha?: string
}): Promise<ApiResponse> {
  const { data } = await api.post('/phone/code', params)
  return data
}

export interface RegisterParams {
  type: 'phone' | 'email'
  account: string
  phone_code?: string
  code: string
  username?: string
  password: string
  re_password: string
  customfield?: Record<string, unknown>
}

export async function register(
  params: RegisterParams
): Promise<ApiResponse<LoginResult>> {
  const { data } = await api.post('/register', params)
  return data
}

export async function fetchIndex(): Promise<ApiResponse<IndexData>> {
  const { data } = await api.get('/index')
  return data
}

export async function fetchIndexHost(params?: {
  page?: number
  limit?: number
}): Promise<ApiResponse<IndexHostData>> {
  const { data } = await api.get('/index/host', { params })
  return data
}

export interface CommonConfig {
  lang_list: Array<{
    display_name: string
    display_flag: string
    display_img: string
    display_lang: string
  }>
  lang_home: string
  maintenance_mode: string
  maintenance_mode_message: string
  website_name: string
  website_url: string
  system_logo?: string
  official_website_logo?: string
  copyright_info?: string
  icp_info?: string
  icp_info_link?: string
  public_security_network_preparation?: string
  public_security_network_preparation_link?: string
  telecom_appreciation?: string
  terms_service_url?: string
  terms_privacy_url?: string
  online_customer_service_link?: string
  enterprise_name?: string
  enterprise_telephone?: string
  enterprise_mailbox?: string
  enterprise_qrcode?: string
  [key: string]: unknown
}

export async function fetchCommon(): Promise<ApiResponse<CommonConfig>> {
  const { data } = await api.get('/common')
  return data
}

/** 带账号的公共配置（官方 getCommon({ account })，登录失败后刷新验证码 3 次状态） */
export async function fetchCommonWithAccount(
  account?: string
): Promise<ApiResponse<CommonConfig>> {
  const { data } = await api.get('/common', { params: { account } })
  return data
}

export interface ClientHostItem extends HomeHost {
  create_time: number
}

export interface ClientHostData {
  list: ClientHostItem[]
  count: number
  using_count: number
  expiring_count: number
  overdue_count: number
  deleted_count: number
  all_count: number
}

/** 会员中心已订购产品列表（全状态，含 Unpaid/Pending/Suspended/Deleted） */
export async function fetchClientHost(params?: {
  page?: number
  limit?: number
  status?: string
  tab?: string
  keywords?: string
  orderby?: string
  sort?: string
}): Promise<ApiResponse<ClientHostData>> {
  const { data } = await api.get('/client/host', { params })
  return data
}

export interface HostListItem extends HomeHost {
  due_time: number
  billing_cycle?: string
  renewal_first_day_time?: number
  parent_host_id?: number
  isDue?: boolean
  [key: string]: unknown
}

/** 产品列表（官方 GET /console/v1/host，只返回 Active 状态；工单关联产品选择 scene=ticket） */
export async function fetchHostList(params?: {
  page?: number
  limit?: number
  keywords?: string
  status?: string
  orderby?: string
  sort?: string
  scene?: string
}): Promise<ApiResponse<{ list: HostListItem[]; count: number }>> {
  const { data } = await api.get('/host', { params })
  return data
}

export interface TicketItem {
  id: number
  ticket_num: string
  title: string
  name: string
  status: string
  status_id?: number
  color?: string
  post_time: number
  last_reply_time?: number
  /** 上次催单时间戳 0=未催单（官方 cache，列表接口返回） */
  last_urge_time?: number
  [key: string]: unknown
}

/** 工单列表（官方 GET /console/v1/ticket；status 为状态ID数组，默认 [3]+未完结状态） */
export async function fetchTickets(params?: {
  page?: number
  limit?: number
  keywords?: string
  ticket_type_id?: number
  status?: number[] | string
  orderby?: string
  sort?: string
}): Promise<ApiResponse<{ list: TicketItem[]; count: number }>> {
  const { data } = await api.get('/ticket', { params })
  return data
}

// ---------- 工单中心（idcsmart_ticket 插件，/console/v1/ticket） ----------

export interface TicketStatusItem {
  id: number
  name: string
  color: string
  /** 完结状态 1完结 0未完结 */
  status: number
  /** 是否默认状态 0否 1是（不可修改删除） */
  default: number
}

/** 工单状态列表（官方 GET /console/v1/ticket/status） */
export async function fetchTicketStatus(): Promise<
  ApiResponse<{ list: TicketStatusItem[] }>
> {
  const { data } = await api.get('/ticket/status')
  return data
}

export interface TicketTypeItem {
  id: number
  name: string
  [key: string]: unknown
}

/** 工单类型列表（官方 GET /console/v1/ticket/type） */
export async function fetchTicketType(): Promise<
  ApiResponse<{ list: TicketTypeItem[] }>
> {
  const { data } = await api.get('/ticket/type')
  return data
}

/** 工单统计（官方 GET /console/v1/ticket/statistic，data 键为状态ID字符串：1待接单/2待回复/3已回复/5处理中） */
export async function fetchTicketStatistic(): Promise<
  ApiResponse<Record<string, number>>
> {
  const { data } = await api.get('/ticket/statistic')
  return data
}

export interface TicketConfigData {
  ticket_notice_open: number
  ticket_notice_description: string
}

/** 工单通知设置（官方 GET /console/v1/ticket/config） */
export async function fetchTicketConfig(): Promise<
  ApiResponse<TicketConfigData>
> {
  const { data } = await api.get('/ticket/config')
  return data
}

export interface TicketAttachment {
  url: string
  name: string
  save_name?: string
  [key: string]: unknown
}

export interface TicketQuoteInfo {
  id: number
  content: string
  type: 'Client' | 'Admin'
  sender_name: string
  create_time: number
  is_deleted: number
  [key: string]: unknown
}

export interface TicketReplyItem {
  id: number
  content: string
  /** 附件访问地址数组（getOssUrl：{url,name,save_name}） */
  attachment?: TicketAttachment[]
  create_time: number
  /** Client 用户回复 / Admin 管理员回复 */
  type: 'Client' | 'Admin'
  client_name?: string
  admin_name?: string
  client_id?: number
  quote_reply_id?: number
  quote_info?: TicketQuoteInfo | null
  [key: string]: unknown
}

export interface TicketDetail {
  id: number
  ticket_num: string
  client_id?: number
  title: string
  content: string
  ticket_type_id: number
  status: string
  color: string
  create_time: number
  /** 工单附件（getOssUrl 对象数组） */
  attachment?: TicketAttachment[]
  last_reply_time: number
  username?: string
  host_ids?: number[]
  /** 是否可操作（下游传递关闭时为 0） */
  can_operate?: number
  /** 沟通记录（新→旧，页面需倒序渲染；id=0 为工单原文） */
  replies: TicketReplyItem[]
  [key: string]: unknown
}

/** 工单详情（官方 GET /console/v1/ticket/:id） */
export async function fetchTicketDetail(
  id: number | string
): Promise<ApiResponse<{ ticket: TicketDetail }>> {
  const { data } = await api.get(`/ticket/${id}`)
  return data
}

export interface CreateTicketParams {
  title: string
  ticket_type_id: number
  host_ids?: number[]
  content?: string
  /** 附件数组（/console/v1/upload 返回的 save_name） */
  attachment?: string[]
}

/** 创建工单（官方 POST /console/v1/ticket） */
export async function createTicket(
  params: CreateTicketParams
): Promise<ApiResponse<{ id: number }>> {
  const { data } = await api.post('/ticket', params)
  return data
}

export interface ReplyTicketParams {
  content: string
  attachment?: string[]
  quote_reply_id?: number
}

/** 回复工单（官方 POST /console/v1/ticket/:id/reply） */
export async function replyTicket(
  id: number,
  params: ReplyTicketParams
): Promise<ApiResponse<{ ticket_reply_id: number }>> {
  const { data } = await api.post(`/ticket/${id}/reply`, {
    id,
    ...params,
  })
  return data
}

/** 催单（官方 PUT /console/v1/ticket/:id/urge，15 分钟限制） */
export async function urgeTicket(id: number): Promise<ApiResponse> {
  const { data } = await api.put(`/ticket/${id}/urge`, { id })
  return data
}

/** 关闭工单（官方 PUT /console/v1/ticket/:id/close） */
export async function closeTicket(id: number): Promise<ApiResponse> {
  const { data } = await api.put(`/ticket/${id}/close`, { id })
  return data
}

export interface UploadResult {
  save_name: string
  image_url?: string
  image_base64?: string
}

/** 附件上传（官方 POST /console/v1/upload，multipart file 字段） */
export async function uploadTicketFile(
  file: File,
  onProgress?: (percent: number) => void
): Promise<ApiResponse<UploadResult>> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post('/upload', formData, {
    onUploadProgress: (e) => {
      if (e.total) onProgress?.(Math.min(100, Math.round((e.loaded / e.total) * 100)))
    },
  })
  return data
}

export interface BillMonthlyItem {
  month: string
  paid: string
  unpaid: string
}

export interface BillMonthlyData {
  client_id: number
  client_name: string
  months: BillMonthlyItem[]
}

export interface MenuItem {
  id: number
  name: string
  url?: string
  icon?: string
  parent_id?: number
  menu_type?: string
  second_reminder?: number
  select_field?: string[]
  child?: MenuItem[]
  [key: string]: unknown
}

/** 前台导航菜单（type=home，树形，name=分隔符 为分组分隔） */
export async function fetchMenu(): Promise<ApiResponse<{ menu: MenuItem[] }>> {
  const { data } = await api.get('/menu')
  return data
}

export interface NewsItem {
  id: number
  title: string
  img?: string
  type?: string
  create_time: number
  update_time?: number
  [key: string]: unknown
}

/** 新闻/公告列表（idcsmart_news 插件），默认按置顶+创建时间倒序 */
export async function fetchNews(params?: {
  page?: number
  limit?: number
  keywords?: string
  addon_idcsmart_news_type_id?: number | string
  orderby?: string
  sort?: string
}): Promise<ApiResponse<{ list: NewsItem[]; count: number }>> {
  const { data } = await api.get('/news', { params })
  return data
}

/** 公告列表（独立公告接口 /console/v1/announcement，字段与新闻一致；type_id 为 addon_idcsmart_announcement_type_id） */
export async function fetchAnnouncement(params?: {
  page?: number
  limit?: number
  keywords?: string
  addon_idcsmart_announcement_type_id?: number | string
  orderby?: string
  sort?: string
}): Promise<ApiResponse<{ list: NewsItem[]; count: number }>> {
  const { data } = await api.get('/announcement', { params })
  return data
}

/** 公告分类（idcsmart_announcement 插件 /announcement/type，count 为全部公告数量） */
export interface AnnouncementTypeItem {
  id: number
  name: string
  announcement_num: number
}

export async function fetchAnnouncementType(): Promise<
  ApiResponse<{ list: AnnouncementTypeItem[]; count: number }>
> {
  const { data } = await api.get('/announcement/type')
  return data
}

/** 官网首页配置（FurllHome 插件 /furll_home/home，FurLLV10 官网首页轮播图/推荐产品/合作伙伴 Logo） */
export interface FurllHomeBanner {
  id: number
  title: string
  label: string
  description: string
  image: string
  url: string
  button_text: string
}

export interface FurllHomeRecommend {
  id: number
  product_id: number
  name: string
  description: string
  tag: string
  price: string
  unit: string
  url: string
}

export interface FurllHomePartner {
  id: number
  name: string
  image: string
  url: string
  wall: number
}

export interface FurllHomeData {
  banners: FurllHomeBanner[]
  recommend_enabled: string
  recommends: FurllHomeRecommend[]
  partners: FurllHomePartner[]
}

/** 官网首页配置（FurllHome 插件，需已安装；未安装时接口返回 status 404 或网络错误） */
export async function fetchFurllHome(): Promise<ApiResponse<FurllHomeData>> {
  const { data } = await api.get('/furll_home/home')
  return data
}

/** 新闻分类（idcsmart_news 插件 /news/type，count 为全部新闻数量） */
export interface NewsTypeItem {
  id: number
  name: string
  news_num: number
}

export async function fetchNewsType(): Promise<
  ApiResponse<{ list: NewsTypeItem[]; count: number }>
> {
  const { data } = await api.get('/news/type')
  return data
}

/** 新闻附件（官方 getOssUrl 产物：url/name/save_name） */
export interface NewsAttachment {
  url: string
  name: string
  save_name?: string
}

/** 上/下一条新闻（无则为 {}） */
export interface NewsSibling {
  id?: number
  title?: string
}

export interface NewsDetail extends NewsItem {
  content: string
  keywords?: string
  attachment: NewsAttachment[]
  prev?: NewsSibling
  next?: NewsSibling
}

/** 新闻/公告详情（idcsmart_news 插件，content 为 HTML） */
export async function fetchNewsDetail(
  id: number | string
): Promise<ApiResponse<{ news: NewsDetail }>> {
  const { data } = await api.get(`/news/${id}`)
  return data
}

/** 公告详情（独立公告接口 /announcement/:id，content 为 HTML） */
export async function fetchAnnouncementDetail(
  id: number | string
): Promise<ApiResponse<{ announcement?: NewsDetail; news?: NewsDetail }>> {
  const { data } = await api.get(`/announcement/${id}`)
  return data
}

// ---------- idcsmart_help 帮助中心 ----------

/** 帮助中心分组下的单篇文档（title 用于列表项展示） */
export interface HelpDocItem {
  id: number
  title: string
  search?: boolean
}

/** 帮助中心分组（首页 index / 文档列表 list 同构） */
export interface HelpGroupItem {
  id: number
  name: string
  helps: HelpDocItem[]
}

/** 帮助中心首页（官方 /help/index，index 为分组列表） */
export async function fetchHelpIndex(): Promise<
  ApiResponse<{ index: HelpGroupItem[] }>
> {
  const { data } = await api.get('/help/index')
  return data
}

/** 帮助文档列表（官方 /help，keywords 搜索时逐条命中 helps.search） */
export async function fetchHelpList(params?: {
  keywords?: string
  page?: number
  limit?: number
}): Promise<ApiResponse<{ list: HelpGroupItem[] }>> {
  const { data } = await api.get('/help', { params })
  return data
}

/** 帮助文档详情（官方 /help/:id，content 为 HTML，attachment 同新闻附件结构） */
export interface HelpDetail extends HelpDocItem {
  keywords?: string
  content: string
  attachment: NewsAttachment[]
  prev?: NewsSibling
  next?: NewsSibling
  create_time: number
  update_time?: number
}

export async function fetchHelpDetail(
  id: number | string
): Promise<ApiResponse<{ help: HelpDetail }>> {
  const { data } = await api.get(`/help/${id}`)
  return data
}

// ---------- idcsmart_file_download 文件下载 ----------

/** 文件下载文件夹 */
export interface FileFolderItem {
  id: number
  name: string
  file_num: number
}

/** 文件列表项 */
export interface FileItem {
  id: number
  name: string
  description?: string
  filetype: string
  filesize: number
}

/** 文件下载文件夹列表（官方 /file/folder） */
export async function fetchFileFolder(): Promise<
  ApiResponse<{ list: FileFolderItem[] }>
> {
  const { data } = await api.get('/file/folder')
  return data
}

/** 文件列表（官方 /file，addon_idcsmart_file_folder_id 按文件夹过滤） */
export async function fetchFileList(params?: {
  page?: number
  limit?: number
  keywords?: string
  addon_idcsmart_file_folder_id?: number | string
  orderby?: string
  sort?: string
}): Promise<ApiResponse<{ list: FileItem[]; count: number }>> {
  const { data } = await api.get('/file', { params })
  return data
}

/** 文件下载地址（官方 /file/:id/download，返回直链 url） */
export async function fetchFileDownloadUrl(
  id: number | string
): Promise<ApiResponse<{ url: string }>> {
  const { data } = await api.get(`/file/${id}/download`)
  return data
}

/** 账单月度统计（FurllHome 插件 /furll_home/bill_monthly） */
export async function fetchBillMonthly(): Promise<
  ApiResponse<BillMonthlyData>
> {
  const { data } = await api.post('/furll_home/bill_monthly')
  return data
}

export interface AddonItem {
  id: number
  name: string
  title: string
  url: string
}

export interface AddonsData {
  client_id: number
  client_name?: string
  addons: AddonItem[]
  count: number
}

/** 已安装扩展列表（FurllHome 插件 /console/v1/furll_home/addons，无需认证） */
export async function fetchAddons(): Promise<ApiResponse<AddonsData>> {
  const { data } = await api.get('/furll_home/addons')
  return data
}

export interface ProductGroupFirstItem {
  id: number
  name: string
  hidden?: number
  type?: string
  [key: string]: unknown
}

export interface ProductGroupSecondItem {
  id: number
  name: string
  parent_id: number
  hidden?: number
  type?: string
  description?: string
  [key: string]: unknown
}

export interface ProductListItem {
  id: number
  name: string
  description: string
  stock_control: number
  qty: number
  pay_type: string
  price: string
  cycle: string
  module?: string
  product_group_name_second?: string
  product_group_id_second?: number
  product_group_name_first?: string
  product_group_id_first?: number
  pay_ontrial?: unknown
  recommend?: number
  recommend_text?: string
  [key: string]: unknown
}

/** 商品一级分组（官方接口 /console/v1/product/group/first） */
export async function fetchProductGroupFirst(): Promise<
  ApiResponse<{ list: ProductGroupFirstItem[]; count: number }>
> {
  const { data } = await api.get('/product/group/first')
  return data
}

/** 商品二级分组（官方接口 /console/v1/product/group/second?id=） */
export async function fetchProductGroupSecond(
  id: number
): Promise<ApiResponse<{ list: ProductGroupSecondItem[]; count: number }>> {
  const { data } = await api.get('/product/group/second', { params: { id } })
  return data
}

/** 商品列表（官方接口 /console/v1/product，id 为二级分组ID，keywords 全局搜索） */
export async function fetchProductList(params?: {
  id?: number
  keywords?: string
  page?: number
  limit?: number
}): Promise<ApiResponse<{ list: ProductListItem[]; count: number }>> {
  const { data } = await api.get('/product', {
    params: { page: 1, limit: 1000, ...params },
  })
  return data
}

export interface ProductDetailItem {
  id: number
  name: string
  pay_type: string
  price: string
  cycle: string
  product_group_id?: number
  product_group_id_first?: number
  product_group_name_first?: string
  module?: string
  hidden?: number
  stock_control?: number
  qty?: number
  [key: string]: unknown
}

/** 商品详情（官方接口 GET /console/v1/product/:id，home 端只返回基础字段+分组） */
export async function fetchProductDetail(
  id: number
): Promise<ApiResponse<{ product: ProductDetailItem }>> {
  const { data } = await api.get(`/product/${id}`)
  if (data.status !== 200) {
    throw new ApiError(data.msg || '商品信息获取失败', data.status, data.data)
  }
  return data
}

export interface ProductConfigOptionData {
  product_name: string
  content: string
}

/**
 * 商品配置页面（官方接口 GET /console/v1/product/:id/config_option）
 * content 为后端按模块渲染的配置页 HTML（Vue 模板+插件脚本），由 goods 页宿主注入执行
 */
export async function fetchProductConfigOption(
  id: number,
  flag = false
): Promise<ApiResponse<ProductConfigOptionData>> {
  const { data } = await api.get(`/product/${id}/config_option`, {
    params: { flag },
  })
  if (data.status !== 200) {
    throw new ApiError(data.msg || '商品配置获取失败', data.status, data.data)
  }
  return data
}

export interface CartItem {
  product_id: number
  qty: number
  config_options: Record<string, unknown>
  customfield: Record<string, unknown>
  self_defined_field: Record<string, unknown>
  name: string
  description: string
  stock_control: number
  stock_qty: number
}

export interface CartData {
  list: CartItem[]
}

/** 购物车列表（官方接口 /console/v1/cart，position 为数组下标） */
export async function fetchCart(): Promise<ApiResponse<CartData>> {
  const { data } = await api.get('/cart')
  return data
}

/** 修改购物车商品数量（官方接口 PUT /console/v1/cart/:position/qty） */
export async function updateCartQty(
  position: number,
  qty: number
): Promise<ApiResponse> {
  const { data } = await api.put(`/cart/${position}/qty`, { qty })
  return data
}

/** 批量删除购物车商品（官方接口 DELETE /console/v1/cart/batch，positions 为位置数组） */
export async function deleteCartItems(
  positions: number[]
): Promise<ApiResponse> {
  const { data } = await api.delete('/cart/batch', { data: { positions } })
  return data
}

/** 更新购物车商品（优惠码/活动/配置变更，官方接口 PUT /console/v1/cart/:position） */
export async function updateCartItem(params: {
  position: number
  product_id: number
  config_options?: Record<string, unknown>
  qty?: number
  customfield?: Record<string, unknown>
  self_defined_field?: Record<string, unknown>
}): Promise<ApiResponse> {
  const { data } = await api.put(`/cart/${params.position}`, params)
  return data
}

/** 结算购物车（官方 POST /console/v1/cart/settle，positions 为购物车位置数组） */
export interface CartSettleResult {
  order_id: number
  amount: number
  host_ids?: number[]
  customfields?: Record<string, unknown>
}

export async function settleCart(params: {
  positions: number[]
  customfield?: Record<string, unknown>
}): Promise<ApiResponse<CartSettleResult>> {
  const { data } = await api.post('/cart/settle', params)
  return data
}

export interface ProductSettleParams {
  product_id: number
  config_options: Record<string, unknown>
  customfield?: Record<string, unknown>
  self_defined_field?: Record<string, unknown>
  qty: number
}

/** 结算商品（官方 POST /console/v1/product/settle，直接购买从商品配置页结算） */
export async function settleProduct(
  params: ProductSettleParams
): Promise<ApiResponse<CartSettleResult>> {
  const { data } = await api.post('/product/settle', params)
  return data
}

/** 商品活动促销项（官方 GET /console/v1/event_promotion/product/:id/event_promotion） */
export interface EventPromotionItem {
  id: number
  type: 'percent' | 'reduce' | 'no'
  value: number
  full: number
}

export async function fetchEventPromotion(params: {
  id: number
  qty: number
  amount: number
  billing_cycle_time: number | string
}): Promise<
  ApiResponse<{
    list: EventPromotionItem[]
    addon_event_promotion_does_not_participate?: string
  }>
> {
  const { data } = await api.get(
    `/event_promotion/product/${params.id}/event_promotion`,
    { params }
  )
  return data
}

export interface ProductPreviewItem {
  name?: string
  value?: string
  price?: string
}

export interface ProductPriceData {
  price: string
  price_total: string
  base_price: string
  base_renew_price?: string
  renew_price?: string
  renew_price_total?: string
  billing_cycle?: string
  host_billing_cycle?: string
  duration?: string
  preview: ProductPreviewItem[]
  other?: { son_previews?: ProductPreviewItem[][] }
  sub_host?: Array<{ preview: ProductPreviewItem[] }>
  price_client_level_discount?: string
  price_promo_code_discount?: string
  price_event_promotion_discount?: string
  discount?: string
  [key: string]: unknown
}

/** 商品配置价格计算（官方接口 POST /console/v1/product/:id/config_option） */
export async function fetchProductPrice(
  id: number,
  params: {
    config_options?: Record<string, unknown>
    qty?: number
  }
): Promise<ApiResponse<ProductPriceData>> {
  const { data } = await api.post(`/product/${id}/config_option`, params)
  return data
}

// ---------- 通用商品（mf_finance）配置页原生渲染 ----------

export interface RemfConfigRangeSub {
  id: number
  config_id: number
  qty_minimum: number
  qty_maximum: number
  option_name: string
  option_name_first?: string
  pricing?: string
  qty_stage?: number
}

export interface RemfConfigAreaSub {
  id: number
  option_name: string
  option_name_first?: string
  country_code?: string
  area: Array<{ id: number; pricing?: string; area?: string; area_zh?: string }>
}

export interface RemfConfigSystemVersion {
  id: number
  version: string
  pricing?: string
  show_pricing?: string
}

export interface RemfConfigSystemGroup {
  [system: string]: {
    child: RemfConfigSystemVersion[]
    ico_url?: string
    qty_stage?: number
  }
}

export type RemfConfigSub =
  | Array<RemfConfigRangeSub | RemfConfigAreaSub | { id: number; option_name: string; pricing?: string }>
  | RemfConfigSystemGroup

/** 通用商品配置项（order_page.option，option_type 与官方 remf_finance 模块一致） */
export interface RemfConfigOptionItem {
  id: number
  pid?: number
  option_name?: string
  option_type: number
  notes?: string
  qty_minimum: number
  qty_maximum: number
  upgrade?: number
  is_discount?: number
  qty_stage?: number
  unit?: string
  description?: string
  disabled?: boolean
  sub: RemfConfigSub
  /** option_type=5 操作系统组（运行时派生） */
  systemArr?: Array<{ value: string; label: string }>
  /** 数量拖动类可选范围（运行时派生） */
  qty_range?: number[]
  /** 级联子项数据（option_type=20，运行时拉取） */
  sonData?: RemfConfigSonItem[]
}

export interface RemfConfigSonItem {
  id: number
  option_name?: string
  checkSubId?: number | string
  sub?: RemfConfigSonItem[]
}

export interface RemfConfigLinkResult {
  config_id: number
  relation: 'seq' | 'sneq'
  sub_id: Record<string, { qty_minimum?: number; qty_maximum?: number }>
}

export interface RemfConfigLink {
  config_id: number
  relation: 'seq' | 'sneq'
  sub_id: Record<string, { qty_minimum?: number; qty_maximum?: number }>
  result: RemfConfigLinkResult[]
}

export interface RemfConfigCycle {
  billingcycle: string
  billingcycle_zh: string
}

export interface RemfCustomFieldItem {
  id: number
  field_name: string
  field_type: 'text' | 'textarea' | 'tickbox' | 'link' | 'dropdown' | 'password'
  is_required: 0 | 1
  description?: string
  regexpr?: string
  field_option?: string
}

/** 通用商品订单页数据（官方 GET /console/v1/product/:id/remf_finance/order_page，响应体无 data 包装） */
export interface RemfOrderPageData {
  status: number
  msg: string
  product: {
    id: number
    name: string
    description?: string
    host: {
      show: string
      modify?: number
      prefix?: string
      rule: { upper: string; lower: string; num: string; len_num: string }
      host: string
    }
    password: {
      show: string
      modify?: number
      rule: { len_num: string; upper: string; lower: string; num: string; special: string }
      password: string
    }
    allow_qty: number
    stock_control: number
    qty: number
    cycle: RemfConfigCycle[]
  }
  option: RemfConfigOptionItem[]
  links: RemfConfigLink[]
  custom_fields: RemfCustomFieldItem[]
  allow_qty: number
}

/** 通用商品订单页数据（官方 GET /console/v1/product/:id/{remf_finance|remf_finance_common|remf_finance_dcim}/order_page，响应体无 data 包装） */
export async function fetchRemfFinanceOrderPage(
  id: number,
  module: RemfModule = 'mf_finance'
): Promise<RemfOrderPageData> {
  const { data } = await api.get(`/product/${id}/${REMF_API_BASE[module]}/order_page`)
  return data
}

/** 订单页自定义字段（官方 GET /console/v1/product/:id/self_defined_field/order_page） */
export async function fetchRemfCustomFields(
  id: number
): Promise<ApiResponse<{ data: RemfCustomFieldItem[] }>> {
  const { data } = await api.get(`/product/${id}/self_defined_field/order_page`)
  return data
}

/** 级联数据（官方 GET /console/v1/product/:id/{remf_finance|remf_finance_dcim}/link，mf_finance_common 无此路由） */
export async function fetchRemfCascader(
  id: number,
  params: { cid: number; sub_id: number | string },
  module: RemfModule = 'mf_finance'
): Promise<ApiResponse<Array<{ son?: RemfConfigSonItem[] }>>> {
  const { data } = await api.get(`/product/${id}/${REMF_API_BASE[module]}/link`, { params })
  return data
}

export interface AddCartParams {
  product_id: number
  config_options: {
    configoption: Record<string, unknown>
    cycle: string
    host?: string
    password?: string
  }
  qty: number
  customfield: Record<string, unknown>
  self_defined_field: Record<string, unknown>
  position?: number
}

/** 加入购物车（官方 POST /console/v1/cart） */
export async function addCartItem(params: AddCartParams): Promise<ApiResponse> {
  const { data } = await api.post('/cart', params)
  return data
}

// ---------- 产品管理（product.htm?m= / productdetail.htm?id=） ----------

/** 模块菜单产品列表（官方 GET /console/v1/menu/:id/host，content 为后端按模块渲染的 HTML） */
export async function fetchMenuHostContent(
  menuId: number
): Promise<ApiResponse<{ content: string }>> {
  const { data } = await api.get(`/menu/${menuId}/host`)
  return data
}

export interface HostDetail {
  id: number
  product_id?: number
  product_name?: string
  name?: string
  status?: string
  active_time?: number
  due_time?: number
  billing_cycle?: string
  first_payment_amount?: string
  renew_amount?: string
  ip?: string
  client_notes?: string
  type?: string
  [key: string]: unknown
}

/** 产品详情（官方 GET /console/v1/host/:id，host 为基础字段+自定义字段） */
export async function fetchHostDetail(
  id: number
): Promise<ApiResponse<{ host: HostDetail; self_defined_field?: unknown[] }>> {
  const { data } = await api.get(`/host/${id}`)
  return data
}

/** 产品内页模块（官方 GET /console/v1/host/:id/view，content 为后端按模块渲染的 HTML） */
export async function fetchHostView(
  id: number
): Promise<ApiResponse<{ content: string }>> {
  const { data } = await api.get(`/host/${id}/view`)
  return data
}

export interface CrossModuleHostItem {
  id: number
  product_id: number
  product_name?: string
  name?: string
  status?: string
  active_time?: number
  due_time?: number
  client_notes?: string
  billing_cycle?: string
  billing_cycle_name?: string
  renew_forbidden?: number
  renew_amount?: string
  country?: string
  country_code?: string
  city?: string
  area?: string
  ip_num?: number
  dedicate_ip?: string
  assign_ip?: string
  base_info?: string
  show_base_info?: number
  image_name?: string
  image_icon?: string
  is_auto_renew?: number
  self_defined_field?: Record<string, unknown>
  [key: string]: unknown
}

export interface CrossModuleDataCenter {
  country_id: number
  city: string
  area: string
  country_name: string
  country_code?: string
  label?: string
  [key: string]: unknown
}

export interface CrossModuleHostData {
  list: CrossModuleHostItem[]
  count: number
  using_count: number
  expiring_count: number
  overdue_count: number
  deleted_count: number
  all_count: number
  data_center: CrossModuleDataCenter[]
  self_defined_field?: unknown[]
  select_field?: string[]
}

/** 前台产品列表(跨模块)（官方 GET /console/v1/home/host，m 为菜单 ID） */
export async function fetchCrossModuleHosts(params?: {
  m?: number
  page?: number
  limit?: number
  tab?: string
  status?: string
  keywords?: string
  orderby?: string
  sort?: string
  country_id?: number
  city?: string
  area?: string
}): Promise<ApiResponse<CrossModuleHostData>> {
  const { data } = await api.get('/home/host', { params })
  return data
}

// ---------- 模块菜单产品列表（product.htm?m=，React 原生实现） ----------

/**
 * 模块列表接口命名空间（官方各模块 route.php 对照，HostModel::menuHostList 渲染的
 * content 路径区分 server/reserver 插件；模块同名（idcsmart_common）时 API 命名空间不同：
 * server → idcsmart_common，reserver（代理商品）→ reidcsmart_common）：
 * - mf_cloud/mf_dcim        → GET /console/v1/mf_cloud、/mf_dcim
 * - idcsmart_common(server) → GET /console/v1/idcsmart_common/host（reidcsmart_common 同构）
 * - mf_finance 系列(reserver)→ GET /console/v1/remf_finance、/remf_finance_common、/remf_finance_dcim
 */
export const MODULE_LIST_NAMESPACE: Record<
  'server' | 'reserver',
  Record<string, string>
> = {
  server: {
    mf_cloud: 'mf_cloud',
    mf_dcim: 'mf_dcim',
    idcsmart_common: 'idcsmart_common',
  },
  reserver: {
    idcsmart_common: 'reidcsmart_common',
    mf_finance: 'remf_finance',
    mf_finance_common: 'remf_finance_common',
    mf_finance_dcim: 'remf_finance_dcim',
  },
}

/** 模块列表接口 URL（idcsmart_common 系带 /host 后缀，其余直接为命名空间） */
export function moduleListUrl(apiKey: string): string {
  return apiKey === 'idcsmart_common' || apiKey === 'reidcsmart_common'
    ? `${apiKey}/host`
    : apiKey
}

/** 模块菜单 host 列表返回中 data_center 项（官方 dcimList.js 拼 label：country_name-city-area） */
export interface ModuleDataCenterItem extends CrossModuleDataCenter {
  customfield?: {
    multi_language?: { city?: string; area?: string }
  }
}

export interface ModuleHostListData {
  list: CrossModuleHostItem[]
  count: number
  using_count: number
  expiring_count: number
  overdue_count: number
  deleted_count: number
  all_count: number
  data_center?: ModuleDataCenterItem[]
  self_defined_field?: Array<{
    id: number
    field_name?: string
    field_type?: string
    [key: string]: unknown
  }>
}

/**
 * 模块产品列表（官方各模块插件列表接口：mf_dcim → GET /console/v1/mf_dcim，
 * idcsmart_common → GET /console/v1/idcsmart_common/host，mf_finance 系列 →
 * GET /console/v1/remf_finance 等；apiKey 取 MODULE_LIST_NAMESPACE 映射值）
 */
export async function fetchModuleHosts(
  apiKey: string,
  params?: {
    m?: number
    page?: number
    limit?: number
    tab?: string
    status?: string
    keywords?: string
    orderby?: string
    sort?: string
    country_id?: number
    city?: string
    area?: string
  }
): Promise<ApiResponse<ModuleHostListData>> {
  const { data } = await api.get(`/${moduleListUrl(apiKey)}`, { params })
  return data
}

/** 自动续费弹窗产品信息（官方 GET /console/v1/host/:id/specific_info，autoRenew 组件） */
export interface HostSpecificInfo {
  id?: number
  name?: string
  renew_amount?: string
  billing_cycle_name?: string
  due_time?: number
  ip_num?: number
  dedicate_ip?: string
  assign_ip?: string
  country?: string
  country_code?: string
  country_id?: number
  city?: string
  area?: string
  [key: string]: unknown
}

/** 产品信息（自动续费弹窗用，官方 GET /console/v1/host/:id/specific_info） */
export async function fetchHostSpecificInfo(
  id: number
): Promise<ApiResponse<HostSpecificInfo>> {
  const { data } = await api.get(`/host/${id}/specific_info`)
  return data
}

/** 自动续费开关（官方 PUT /console/v1/host/:id/renew/auto） */
export async function updateHostRenewAuto(
  id: number,
  status: number
): Promise<ApiResponse> {
  const { data } = await api.put(`/host/${id}/renew/auto`, { id, status })
  return data
}

export interface BatchRenewCycle {
  billing_cycle?: string
  billing_cycle_name?: string
  price?: number
  current_base_price?: number
  promo_code_discount?: number
  manual_promo_code_success?: number
  promo_code_exclude_client_level?: number
  customfield?: {
    multi_language?: { billing_cycle?: string }
  }
  [key: string]: unknown
}

export interface BatchRenewItem {
  id: number
  product_name?: string
  name?: string
  billing_cycles?: BatchRenewCycle[]
  select_cycles?: number
  [key: string]: unknown
}

/** 批量续费可选周期列表（官方 GET /console/v1/host/renew/batch） */
export async function fetchBatchRenewList(
  ids: number[],
  promoCode?: string
): Promise<ApiResponse<{ list: BatchRenewItem[] }>> {
  const { data } = await api.get('/host/renew/batch', {
    params: { ids, 'customfield[promo_code]': promoCode ?? '' },
  })
  return data
}

/** 批量续费提交（官方 POST /console/v1/host/renew/batch；返回 code=Unpaid 表示生成订单需支付） */
export async function submitBatchRenew(params: {
  ids: number[]
  billing_cycles: Record<number, string>
  promo_code?: string
}): Promise<{ code?: string; data?: { id: number }; msg?: string }> {
  const { data } = await api.post('/host/renew/batch', {
    ids: params.ids,
    billing_cycles: params.billing_cycles,
    customfield: { promo_code: params.promo_code ?? '' },
  })
  return data
}

export interface TrafficWarningData {
  module?: string
  warning_switch?: number
  leave_percent?: number
  [key: string]: unknown
}

/** 流量预警配置（官方 GET /console/v1/account/traffic_warning，module 为 mf_dcim/mf_cloud） */
export async function fetchTrafficWarning(
  module: string
): Promise<ApiResponse<TrafficWarningData>> {
  const { data } = await api.get('/account/traffic_warning', {
    params: { module },
  })
  return data
}

/** 保存流量预警配置（官方 PUT /console/v1/account/traffic_warning） */
export async function saveTrafficWarning(
  params: TrafficWarningData
): Promise<ApiResponse> {
  const { data } = await api.put('/account/traffic_warning', params)
  return data
}

// ---------- 云产品详情（productdetail.htm?id=，mf_finance reserver 模块） ----------

/** 实例配置项（cloudDetail.config_options，option_type 与订单页一致） */
export interface CloudConfigOptionItem {
  id: number
  option_type?: number
  name?: string
  sub_name?: string
  code?: string
  unit?: string
  [key: string]: unknown
}

/**
 * 云产品模块 API 命名空间（官方各模块 route.php 对照，模块详情页 /host/:id/view
 * 渲染的插件模板决定用哪个命名空间）。由 detectProductModule 通用推导：
 * - server 模块 → 模块名（mf_cloud / mf_dcim / idcsmart_common）
 * - reserver 模块 → `re`+模块名（remf_finance / remf_cloud / reidcsmart_common ...）
 * 已知值：
 * - remf_finance / remf_finance_common / remf_finance_dcim（reserver 财务商品）
 * - remf_cloud / mf_cloud（代理/自营云）
 * - remf_dcim / mf_dcim（代理/自营 DCIM）
 * 放宽为 string 以支持未登记的新模块命名空间。
 */
export type CloudApiNamespace = string

/** 实例详情（官方 GET /console/v1/remf_finance/:id） */
export interface CloudDetailData {
  host_data?: {
    dedicatedip?: string
    assignedips?: string
    username?: string
    password?: string
    port?: number | string
    bwlimit?: number | string
    bwusage?: number | string
    [key: string]: unknown
  }
  config_options?: CloudConfigOptionItem[]
  self_defined_field?: Array<{
    id: number
    field_name?: string
    field_type?: string
    value?: string
    [key: string]: unknown
  }>
  data_center?: { id?: number; iso?: string; country_name?: string; city?: string }
  /** DCIM 机型配置（官方 dcimDetail：model_config.cpu/memory/disk/gpu） */
  model_config?: {
    cpu?: string
    memory?: string
    disk?: string
    gpu?: string
    [key: string]: unknown
  }
  /** DCIM 操作系统镜像 */
  image?: { name?: string; [key: string]: unknown }
  /** DCIM 防御峰值（G） */
  peak_defence?: number | string
  /** DCIM 带宽（'NC'=真实带宽） */
  bw?: string | number
  /** DCIM 真实带宽展示值（bw==='NC' 时显示） */
  bw_show?: string
  /** DCIM 流量包（G，0=无限） */
  flow?: number | string
  /** mf_cloud 云产品（官方 cloudDetail）：cpu/memory 数字 + image/line/bw/peak_defence */
  cpu?: number | string
  memory?: number | string
  gpu?: string
  ipv6_num?: number | string
  ssh_key?: { id?: number; name?: string; [key: string]: unknown }
  /** 云产品所属安全组（官方 cloudDetail.security_group，id>0 已加入） */
  security_group?: { id?: number; name?: string; [key: string]: unknown }
  custom_show?: Array<{
    name?: string
    type?: string
    value?: string
    [key: string]: unknown
  }>
  config?: {
    reinstall_sms_verify?: number
    reset_password_sms_verify?: number
    manual_manage?: number
    simulate_physical_machine_enable?: number
    show_panel_password_enable?: number
    manual_resource_control_mode?: string
    [key: string]: unknown
  }
  duration?: string
  line?: {
    id?: number
    /** 0=有防御行展示（官方 sync_firewall_rule==0 显示防御峰值） */
    sync_firewall_rule?: number
    /** 'flow'=按流量计费，其余按带宽 */
    bill_type?: string
  }
  cloud_os_group?: Array<{ id: number; name?: string }>
  cloud_os?: Array<{ id: number; group?: number; name?: string; version?: string }>
  system_button?: {
    upgrade?: { disabled?: boolean }
    upgrade_option?: { disabled?: boolean }
  }
  nat_acl_limit?: number | string
  nat_web_limit?: number | string
  network_type?: string
  dcimcloud?: {
    nat_acl_limit?: number | string
    nat_acl_num?: number | string
    nat_acl?: boolean
    nat_web_limit?: number | string
    nat_web_num?: number | string
    nat_web?: boolean
    [key: string]: unknown
  }
  [key: string]: unknown
}

/** 实例状态（官方 GET /console/v1/remf_finance/:id/status） */
export interface CloudStatusData {
  status: string
  desc: string
}

/** 救援模式/登录信息（官方 GET /console/v1/:ns/:id/remote_info，DCIM 的 rescueStatusData） */
export interface CloudRemoteInfoData {
  rescue?: number
  username?: string
  password?: string
  port?: number | string
  ip_num?: number
  /** mf_cloud 面板密码（show_panel_password_enable=1 时展示） */
  panel_pass?: string
  /** mf_cloud 模拟物理机运行开关 */
  simulate_physical_machine?: number
  [key: string]: unknown
}

/** 实例 IP 列表项（官方 GET /console/v1/:ns/:id/ip，DCIM 分页 ipList） */
export interface CloudIpRow {
  ip?: string
  gateway?: string
  subnet_mask?: string
  [key: string]: unknown
}

export interface CloudIpListData {
  list?: CloudIpRow[]
  count?: number
}

/** DCIM 流量（官方 GET /console/v1/:ns/:id/flow：total/leave/reset_flow_date） */
export interface CloudFlowData {
  total?: string | number
  leave?: string | number
  reset_flow_date?: string
  [key: string]: unknown
}

/** 实例 IP 详情（官方 GET /console/v1/host/:id/ip） */
export interface CloudIpDetailsData {
  dedicate_ip?: string
  assign_ip?: string
  ip_num?: number
}

/** 磁盘项（官方 GET /console/v1/remf_finance/:id/disk） */
export interface CloudDiskItem {
  id: number
  name?: string
  size?: number | string
  type?: string
  type2?: string
  status?: number | string
  create_time?: string | number
  [key: string]: unknown
}

/** 日志项（官方 GET /console/v1/remf_finance/:id/log） */
export interface CloudLogItem {
  id?: number
  description?: string
  create_time?: string | number
  [key: string]: unknown
}

/** 备份/快照项（官方 GET /console/v1/remf_finance/:id/backup） */
export interface CloudBackupItem {
  id: number
  type?: 'backup' | 'snap'
  name?: string
  create_time?: string | number
  remarks?: string
  status?: number | string
  [key: string]: unknown
}

export interface CloudBackupListData {
  list?: CloudBackupItem[]
  count?: number
  backup_num?: number
  snap_num?: number
  disk?: CloudDiskItem[]
}

/** NAT 转发/建站项（官方 GET /console/v1/remf_finance/:id/nat_acl|nat_web） */
export interface CloudNatItem {
  id: number
  name?: string
  ip?: string
  int_port?: number | string
  ext_port?: number | string
  protocol?: number | string
  domain?: string
  [key: string]: unknown
}

/** 统计图表（官方 GET /console/v1/remf_finance/:id/chart） */
export interface CloudChartPoint {
  time?: string | number
  value?: number
}
export interface CloudChartData {
  list?: CloudChartPoint[][]
  label?: string[]
}

/** 续费页数据（官方 GET /console/v1/host/:id/renew） */
export interface CloudRenewCycle {
  billing_cycle?: string
  billing_cycle_name?: string
  duration?: string | number
  price?: number
  base_price?: number
  [key: string]: unknown
}
export interface CloudRenewPageData {
  host?: CloudRenewCycle[]
  [key: string]: unknown
}

/** 产品升降级页（官方 GET /console/v1/remf_finance/:id/upgrade_product） */
export interface CloudUpgradeProductItem {
  id: number
  pid?: number
  host?: string
  cycle?: Array<{
    billingcycle?: string
    billingcycle_zh?: string
    price?: number
    [key: string]: unknown
  }>
  [key: string]: unknown
}

/** 配置升降级项（官方 GET /console/v1/remf_finance/:id/upgrade_config，host 列表即配置项） */
export type CloudUpgradeConfigItem = Omit<
  RemfConfigOptionItem,
  'option_name' | 'sub' | 'qty_minimum' | 'qty_maximum'
> & {
  option_name?: string
  sub?: RemfConfigSub
  qty_minimum?: number
  qty_maximum?: number
  qty?: number
  subid?: number
  suboption_name?: string
  unit?: string
  [key: string]: unknown
}

/** 实例详情（官方 GET /console/v1/:ns/:id） */
export async function fetchCloudDetail(
  ns: CloudApiNamespace,
  id: number
): Promise<ApiResponse<CloudDetailData>> {
  const { data } = await api.get(`/${ns}/${id}`)
  return data
}

/** 实例状态（官方 GET /console/v1/:ns/:id/status） */
export async function fetchCloudStatus(
  ns: CloudApiNamespace,
  id: number
): Promise<ApiResponse<CloudStatusData>> {
  const { data } = await api.get(`/${ns}/${id}/status`)
  return data
}

/** 救援模式状态（官方 GET /console/v1/:ns/:id/remote_info） */
export async function fetchCloudRemoteInfo(
  ns: CloudApiNamespace,
  id: number
): Promise<ApiResponse<CloudRemoteInfoData>> {
  const { data } = await api.get(`/${ns}/${id}/remote_info`)
  return data
}

/** 产品订购页配置（官方 GET /console/v1/product/:productId/:ns/config，memory_unit 等） */
export async function fetchProductConfig(
  productId: number,
  ns: CloudApiNamespace
): Promise<
  ApiResponse<{
    config?: {
      memory_unit?: string
      manual_manage?: number
      simulate_physical_machine_enable?: number
      show_panel_password_enable?: number
      [key: string]: unknown
    }
    [key: string]: unknown
  }>
> {
  const { data } = await api.get(`/product/${productId}/${ns}/config`)
  return data
}

/** 模拟物理机运行开关（官方 POST /console/v1/:ns/:id/simulate_physical_machine） */
export async function changeSimulatePhysical(
  ns: CloudApiNamespace,
  id: number,
  simulate_physical_machine: number
): Promise<ApiResponse> {
  const { data } = await api.post(`/${ns}/${id}/simulate_physical_machine`, {
    simulate_physical_machine,
  })
  return data
}

/** DCIM IP 列表（官方 GET /console/v1/:ns/:id/ip，分页） */
export async function fetchCloudIpList(
  ns: CloudApiNamespace,
  id: number
): Promise<ApiResponse<CloudIpListData>> {
  const { data } = await api.get(`/${ns}/${id}/ip`)
  return data
}

/** DCIM 网络流量（官方 GET /console/v1/:ns/:id/flow） */
export async function fetchCloudFlow(
  ns: CloudApiNamespace,
  id: number
): Promise<ApiResponse<CloudFlowData>> {
  const { data } = await api.get(`/${ns}/${id}/flow`)
  return data
}

/** 实例 IP 详情（官方 GET /console/v1/host/:id/ip） */
export async function fetchCloudIpDetails(
  id: number
): Promise<ApiResponse<CloudIpDetailsData>> {
  const { data } = await api.get(`/host/${id}/ip`)
  return data
}

/** 修改产品备注（官方 PUT /console/v1/host/:id/notes） */
export async function updateHostNotes(
  id: number,
  notes: string
): Promise<ApiResponse> {
  const { data } = await api.put(`/host/${id}/notes`, { id, notes })
  return data
}

/** 自动续费状态（官方 GET /console/v1/host/:id/renew/auto） */
export async function fetchHostRenewAuto(
  id: number
): Promise<ApiResponse<{ status?: number }>> {
  const { data } = await api.get(`/host/${id}/renew/auto`)
  return data
}

/** 产品停用/退款信息（官方 GET /console/v1/refund/host/:id/refund，data.refund 可能为 null） */
export interface RefundInfo {
  id?: number
  amount?: number | string
  suspend_reason?: string
  type?: 'Expire' | 'Immediate'
  status?:
    | 'Pending'
    | 'Suspending'
    | 'Suspend'
    | 'Suspended'
    | 'Refund'
    | 'Reject'
    | 'Cancelled'
  reject_reason?: string
  create_time?: number | string
  [key: string]: unknown
}

export async function fetchHostRefundInfo(
  id: number
): Promise<ApiResponse<{ refund?: RefundInfo | null }>> {
  const { data } = await api.get(`/refund/host/${id}/refund`)
  return data
}

/** 停用页面配置（官方 GET /console/v1/refund?host_id=） */
export interface RefundPageData {
  allow_refund?: number
  reason_custom?: number
  reasons?: Array<{ id: number; content: string }>
  host?: {
    create_time?: number | string
    first_payment_amount?: number | string
    base_amount?: number | string
    service_fee?: number | string
    amount?: number | string
    [key: string]: unknown
  }
  show_refund_method?: number
  refund_method_default?: string
  gateway_name?: string
  need_security_verify?: boolean
  available_methods?: Array<Record<string, unknown>>
  [key: string]: unknown
}

export async function fetchRefundPage(
  hostId: number
): Promise<ApiResponse<RefundPageData>> {
  const { data } = await api.get(`/refund`, { params: { host_id: hostId } })
  return data
}

/** 申请停用/退款（官方 POST /console/v1/refund） */
export async function submitHostRefund(params: {
  host_id: number
  suspend_reason: number[] | string
  type: string
  refund_method?: string
}): Promise<ApiResponse> {
  const { data } = await api.post(`/refund`, params)
  return data
}

/** 取消停用/退款（官方 PUT /console/v1/refund/:id/cancel） */
export async function cancelHostRefund(id: number): Promise<ApiResponse> {
  const { data } = await api.put(`/refund/${id}/cancel`)
  return data
}

/** 产品内页优惠码（官方 GET /console/v1/promo_code/host/:id/promo_code） */
export async function fetchHostPromoCode(
  id: number
): Promise<ApiResponse<{ promo_code?: string[] }>> {
  const { data } = await api.get(`/promo_code/host/${id}/promo_code`)
  return data
}

/** 磁盘列表（官方 GET /console/v1/:ns/:id/disk） */
export async function fetchCloudDiskList(
  ns: CloudApiNamespace,
  id: number
): Promise<ApiResponse<{ list: CloudDiskItem[] }>> {
  const { data } = await api.get(`/${ns}/${id}/disk`)
  return data
}

/** 挂载磁盘（官方 POST /console/v1/:ns/:id/disk/:disk_id/mount） */
export async function mountCloudDisk(
  ns: CloudApiNamespace,
  id: number,
  diskId: number
): Promise<ApiResponse<null>> {
  const { data } = await api.post(`/${ns}/${id}/disk/${diskId}/mount`)
  return data
}

/** 卸载磁盘（官方 POST /console/v1/:ns/:id/disk/:disk_id/unmount） */
export async function unmountCloudDisk(
  ns: CloudApiNamespace,
  id: number,
  diskId: number
): Promise<ApiResponse<null>> {
  const { data } = await api.post(`/${ns}/${id}/disk/${diskId}/unmount`)
  return data
}

/** 日志列表（官方 GET /console/v1/:ns/:id/log） */
export async function fetchCloudLogList(
  ns: CloudApiNamespace,
  id: number,
  params?: { page?: number; limit?: number; orderby?: string; sort?: string }
): Promise<ApiResponse<{ list: CloudLogItem[]; count?: number }>> {
  const { data } = await api.get(`/${ns}/${id}/log`, { params })
  return data
}

/** 备份/快照列表（官方 GET /console/v1/:ns/:id/backup） */
export async function fetchCloudBackupList(
  ns: CloudApiNamespace,
  id: number,
  params?: { page?: number; limit?: number }
): Promise<ApiResponse<CloudBackupListData>> {
  const { data } = await api.get(`/${ns}/${id}/backup`, { params })
  return data
}

/** NAT 转发列表（官方 GET /console/v1/:ns/:id/nat_acl） */
export async function fetchCloudNatAclList(
  ns: CloudApiNamespace,
  id: number
): Promise<ApiResponse<{ list: CloudNatItem[] }>> {
  const { data } = await api.get(`/${ns}/${id}/nat_acl`)
  return data
}

/** NAT 建站列表（官方 GET /console/v1/:ns/:id/nat_web） */
export async function fetchCloudNatWebList(
  ns: CloudApiNamespace,
  id: number
): Promise<ApiResponse<{ list: CloudNatItem[] }>> {
  const { data } = await api.get(`/${ns}/${id}/nat_web`)
  return data
}

/** 新增 NAT 转发（官方 POST /console/v1/:ns/:id/nat_acl） */
export async function addCloudNatAcl(
  ns: CloudApiNamespace,
  id: number,
  params: { name: string; int_port: number; ext_port?: number; protocol: number }
): Promise<ApiResponse> {
  const { data } = await api.post(`/${ns}/${id}/nat_acl`, {
    id,
    ...params,
  })
  return data
}

/** 新增 NAT 建站（官方 POST /console/v1/:ns/:id/nat_web） */
export async function addCloudNatWeb(
  ns: CloudApiNamespace,
  id: number,
  params: { domain: string; int_port: number }
): Promise<ApiResponse> {
  const { data } = await api.post(`/${ns}/${id}/nat_web`, {
    id,
    domain: params.domain,
    int_port: params.int_port,
    ext_port: 80,
  })
  return data
}

/** 删除 NAT 转发（官方 DELETE /console/v1/:ns/:id/nat_acl） */
export async function deleteCloudNatAcl(
  ns: CloudApiNamespace,
  id: number,
  natAclId: number
): Promise<ApiResponse> {
  const { data } = await api.delete(`/${ns}/${id}/nat_acl`, {
    data: { id, nat_acl_id: natAclId },
  })
  return data
}

/** 删除 NAT 建站（官方 DELETE /console/v1/:ns/:id/nat_web） */
export async function deleteCloudNatWeb(
  ns: CloudApiNamespace,
  id: number,
  natWebId: number
): Promise<ApiResponse> {
  const { data } = await api.delete(`/${ns}/${id}/nat_web`, {
    data: { id, nat_web_id: natWebId },
  })
  return data
}

/** 统计图表（官方 GET /console/v1/:ns/:id/chart，type 为 cpu/disk/memory/flow） */
export async function fetchCloudChart(
  ns: CloudApiNamespace,
  id: number,
  params: { start: number; end: number; type: string }
): Promise<ApiResponse<CloudChartData>> {
  const { data } = await api.get(`/${ns}/${id}/chart`, { params })
  return data
}

/** 续费页数据（官方 GET /console/v1/host/:id/renew） */
export async function fetchCloudRenewPage(
  id: number
): Promise<ApiResponse<CloudRenewPageData>> {
  const { data } = await api.get(`/host/${id}/renew`)
  return data
}

/** 提交续费（官方 POST /console/v1/host/:id/renew；Unpaid 返回订单需支付） */
export async function submitCloudRenew(
  id: number,
  params: {
    billing_cycle: string
    customfield?: Record<string, unknown>
  }
): Promise<ApiResponse<{ id?: number }>> {
  const { data } = await api.post(`/host/${id}/renew`, { id, ...params })
  return data
}

/** 开关机/重启动作（官方 POST /console/v1/:ns/:id/on|off|reboot|hard_off|hard_reboot） */
export async function cloudPowerAction(
  ns: CloudApiNamespace,
  id: number,
  action: 'on' | 'off' | 'reboot' | 'hard_off' | 'hard_reboot'
): Promise<ApiResponse> {
  const { data } = await api.post(`/${ns}/${id}/${action}`, {
    id,
    client_operate_password: '',
    client_operate_methods: 'doPower',
    remember_operate_password: 0,
  })
  return data
}

/** 获取控制台地址（官方 POST /console/v1/:ns/:id/vnc） */
export async function fetchCloudVncUrl(
  ns: CloudApiNamespace,
  id: number
): Promise<ApiResponse<{ url?: string }>> {
  const { data } = await api.post(`/${ns}/${id}/vnc`, {
    id,
    client_operate_password: '',
    client_operate_methods: 'doGetVncUrl',
    remember_operate_password: 0,
  })
  return data
}

/** 进入救援模式（官方 POST /console/v1/:ns/:id/rescue） */
export async function submitCloudRescue(
  ns: CloudApiNamespace,
  id: number,
  params: { type: string; temp_pass: string }
): Promise<ApiResponse> {
  const { data } = await api.post(`/${ns}/${id}/rescue`, {
    id,
    type: params.type,
    temp_pass: params.temp_pass,
    client_operate_password: '',
    client_operate_methods: 'rescueSub',
    remember_operate_password: 0,
  })
  return data
}

/** 退出救援模式（官方 POST /console/v1/:ns/:id/exit_rescue） */
export async function submitCloudExitRescue(
  ns: CloudApiNamespace,
  id: number
): Promise<ApiResponse> {
  const { data } = await api.post(`/${ns}/${id}/exit_rescue`, {
    id,
    client_operate_password: '',
    client_operate_methods: 'reQuitSub',
    remember_operate_password: 0,
  })
  return data
}

/** 重置密码（官方 POST /console/v1/:ns/:id/reset_password） */
export async function submitCloudResetPassword(
  ns: CloudApiNamespace,
  id: number,
  password: string
): Promise<ApiResponse> {
  const { data } = await api.post(`/${ns}/${id}/reset_password`, {
    id,
    password,
    client_operate_password: '',
    client_operate_methods: 'rePassSub',
    remember_operate_password: 0,
  })
  return data
}

/** 重装系统（官方 POST /console/v1/:ns/:id/reinstall） */
export async function submitCloudReinstall(
  ns: CloudApiNamespace,
  id: number,
  params: { os: number; port?: number; format_data_disk?: number }
): Promise<ApiResponse> {
  const { data } = await api.post(`/${ns}/${id}/reinstall`, {
    id,
    os: params.os,
    ...(params.port ? { port: params.port } : {}),
    ...(params.format_data_disk !== undefined
      ? { format_data_disk: params.format_data_disk }
      : {}),
    client_operate_password: '',
    client_operate_methods: 'doReinstall',
    remember_operate_password: 0,
  })
  return data
}

/** 创建备份（官方 POST /console/v1/:ns/:id/backup） */
export async function createCloudBackup(
  ns: CloudApiNamespace,
  id: number,
  params: { name: string; disk_id: number }
): Promise<ApiResponse> {
  const { data } = await api.post(`/${ns}/${id}/backup`, {
    id,
    name: params.name,
    disk_id: params.disk_id,
  })
  return data
}

/** 创建快照（官方 POST /console/v1/:ns/:id/snapshot） */
export async function createCloudSnapshot(
  ns: CloudApiNamespace,
  id: number,
  params: { name: string; disk_id: number }
): Promise<ApiResponse> {
  const { data } = await api.post(`/${ns}/${id}/snapshot`, {
    id,
    name: params.name,
    disk_id: params.disk_id,
  })
  return data
}

/** 还原备份（官方 POST /console/v1/:ns/:id/backup/restore） */
export async function restoreCloudBackup(
  ns: CloudApiNamespace,
  id: number,
  backupId: number
): Promise<ApiResponse> {
  const { data } = await api.post(`/${ns}/${id}/backup/restore`, {
    id,
    backup_id: backupId,
  })
  return data
}

/** 还原快照（官方 POST /console/v1/:ns/:id/snapshot/restore） */
export async function restoreCloudSnapshot(
  ns: CloudApiNamespace,
  id: number,
  snapshotId: number
): Promise<ApiResponse> {
  const { data } = await api.post(`/${ns}/${id}/snapshot/restore`, {
    id,
    snapshot_id: snapshotId,
  })
  return data
}

/** 删除备份（官方 DELETE /console/v1/:ns/:id/backup/:backup_id） */
export async function deleteCloudBackup(
  ns: CloudApiNamespace,
  id: number,
  backupId: number
): Promise<ApiResponse> {
  const { data } = await api.delete(`/${ns}/${id}/backup/${backupId}`, {
    data: { id },
  })
  return data
}

/** 删除快照（官方 DELETE /console/v1/:ns/:id/snapshot/:snapshot_id） */
export async function deleteCloudSnapshot(
  ns: CloudApiNamespace,
  id: number,
  snapshotId: number
): Promise<ApiResponse> {
  const { data } = await api.delete(
    `/${ns}/${id}/snapshot/${snapshotId}`,
    { data: { id } }
  )
  return data
}

/** 产品升降级页（官方 GET /console/v1/:ns/:id/upgrade_product） */
export async function fetchCloudUpgradeProduct(
  ns: CloudApiNamespace,
  id: number
): Promise<ApiResponse<{ host?: CloudUpgradeProductItem[] }>> {
  const { data } = await api.get(`/${ns}/${id}/upgrade_product`)
  return data
}

/** 配置升降级页（官方 GET /console/v1/:ns/:id/upgrade_config） */
export async function fetchCloudUpgradeConfig(
  ns: CloudApiNamespace,
  id: number
): Promise<ApiResponse<{ host?: CloudUpgradeConfigItem[]; links?: RemfConfigLink[] }>> {
  const { data } = await api.get(`/${ns}/${id}/upgrade_config`)
  return data
}

/** 产品升降级算价（官方 POST /console/v1/:ns/:id/sync_upgrade_product_price） */
export async function syncCloudUpgradeProductPrice(
  ns: CloudApiNamespace,
  id: number,
  params: { product_id: number; cycle: string }
): Promise<ApiResponse<{ price?: number }>> {
  const { data } = await api.post(`/${ns}/${id}/sync_upgrade_product_price`, {
    id,
    product_id: params.product_id,
    cycle: params.cycle,
  })
  return data
}

/** 配置升降级算价（官方 POST /console/v1/:ns/:id/sync_upgrade_config_price） */
export async function syncCloudUpgradeConfigPrice(
  ns: CloudApiNamespace,
  id: number,
  params: { configoption: Record<string, unknown> }
): Promise<ApiResponse<{ price?: number }>> {
  const { data } = await api.post(`/${ns}/${id}/sync_upgrade_config_price`, {
    id,
    configoption: params.configoption,
  })
  return data
}

/** 生成升降级订单（官方 POST /console/v1/:ns/:id/upgrade_product|upgrade_config） */
export async function createCloudUpgradeOrder(
  ns: CloudApiNamespace,
  id: number,
  type: 'upgrade_product' | 'upgrade_config',
  params: Record<string, unknown>
): Promise<ApiResponse<{ id?: number }>> {
  const { data } = await api.post(`/${ns}/${id}/${type}`, {
    id,
    customfield: { promo_code: '' },
    ...params,
  })
  return data
}

// ---------- 独立资源模块详情（idcsmart_common / reidcsmart_common） ----------

/**
 * 独立资源模块 API 命名空间（官方 server/reserver 插件路由）：
 * - server（自营）  → idcsmart_common
 * - reserver（代理）→ reidcsmart_common
 */
/** 独立资源模块命名空间（idcsmart_common / reidcsmart_common，及同族的 mf_finance_common / remf_finance_common） */
export type CommonApiNamespace = string

/** 独立资源详情（官方 GET /console/v1/:ns/host/:host_id/configoption） */
export interface CommonDetailData {
  host?: {
    create_time?: number
    due_time?: number
    billing_cycle?: string
    billing_cycle_name?: string
    renew_amount?: number | string
    first_payment_amount?: number | string
    dedicatedip?: string
    username?: string
    password?: string
    os?: string
    assignedips?: string
    bwlimit?: number | string
    bwusage?: number | string
    [key: string]: unknown
  }
  configoptions?: Array<{
    id: number
    option_name?: string
    option_type?: string
    cascade_path?: string
    unit?: string
    qty?: number | string
    subs?: Array<{
      option_name?: string
      country?: string
      [key: string]: unknown
    }>
    [key: string]: unknown
  }>
  self_defined_field?: Array<{
    id: number
    field_name?: string
    field_type?: string
    value?: string
    [key: string]: unknown
  }>
  chart?: Array<{
    title?: string
    type?: string
    select?: Array<{ name?: string; value?: string; [key: string]: unknown }>
    [key: string]: unknown
  }>
  client_area?: Array<{ key?: string; name?: string; [key: string]: unknown }>
  client_button?: {
    console?: Array<{ func?: string; name?: string; type?: string; [key: string]: unknown }>
    control?: Array<{ func?: string; name?: string; type?: string; [key: string]: unknown }>
    [key: string]: unknown
  }
  os?: Array<{
    id: number
    option_name?: string
    subs?: Array<{ os?: string; version?: Array<{ id: number; option_name?: string }> }>
    [key: string]: unknown
  }>
  [key: string]: unknown
}

/** 独立资源详情（官方 GET /console/v1/:ns/host/:host_id/configoption） */
export async function fetchCommonDetail(
  ns: CommonApiNamespace,
  hostId: number
): Promise<ApiResponse<CommonDetailData>> {
  const { data } = await api.get(`/${ns}/host/${hostId}/configoption`)
  return data
}

/**
 * 独立资源详情（mf_finance_common 族，官方 GET /console/v1/:ns/:id，返回
 * host_data/config_options/module_chart/module_client_area/module_button）。
 * 与 idcsmart_common 的 configoption 结构同族，此处归一化为 CommonDetailData。
 * - config_options 用 name/sub_name（如 CDN 套餐：name=套餐选择 sub_name=亚太CDN白银版）
 *   → 归一化为 option_name/subs
 * - host_data 为完整 WHMCS host 数组，host 字段仅暴露面板展示所需
 */
export async function fetchFinanceCommonDetail(
  ns: CommonApiNamespace,
  id: number
): Promise<ApiResponse<CommonDetailData>> {
  const { data } = await api.get(`/${ns}/${id}`)
  const raw = (data?.data ?? {}) as Record<string, unknown>
  const hostData = (raw.host_data ?? {}) as Record<string, unknown>
  const normalized: CommonDetailData = {
    host: hostData,
    configoptions: (
      (raw.config_options as Array<Record<string, unknown>>) ?? []
    ).map(
      (item): NonNullable<CommonDetailData['configoptions']>[number] => ({
        id: Number(item.id ?? 0),
        option_name: (item.option_name as string) ?? (item.name as string) ?? '',
        option_type: (item.option_type as string) ?? undefined,
        ...(item.subs
          ? { subs: item.subs as NonNullable<CommonDetailData['configoptions']>[number]['subs'] }
          : item.sub_name
            ? { subs: [{ option_name: (item.sub_name as string) ?? '' }] }
            : {}),
      })
    ),
    self_defined_field:
      (raw.self_defined_field as CommonDetailData['self_defined_field']) ?? [],
    chart: (raw.module_chart as CommonDetailData['chart']) ?? [],
    client_area:
      (raw.module_client_area as CommonDetailData['client_area']) ?? [],
    client_button:
      (raw.module_button as CommonDetailData['client_button']) ?? {
        console: [],
        control: [],
      },
    os: (raw.os as CommonDetailData['os']) ?? [],
  }
  return { ...data, data: normalized }
}

/** 独立资源图表（官方 POST /console/v1/:ns/host/:host_id/configoption/chart；
 * mf_finance_common 族为 POST /console/v1/:ns/:id/chart） */
export async function submitCommonChart(
  ns: CommonApiNamespace,
  hostId: number,
  params: {
    chart: Array<{ start: number; type: string; select: string }>
  },
  financeCommon = false
): Promise<ApiResponse<Record<string, unknown>>> {
  const { data } = financeCommon
    ? await api.post(`/${ns}/${hostId}/chart`, { ...params })
    : await api.post(`/${ns}/host/${hostId}/configoption/chart`, {
        ...params,
      })
  return data
}

/** 独立资源自定义区域（官方 GET /console/v1/:ns/host/:host_id/configoption/area；
 * mf_finance_common 族为 GET /console/v1/:ns/:id/custom/content?id=&key=） */
export async function fetchCommonArea(
  ns: CommonApiNamespace,
  hostId: number,
  key: string,
  financeCommon = false
): Promise<ApiResponse<{ content?: string }>> {
  const { data } = financeCommon
    ? await api.get(`/${ns}/${hostId}/custom/content`, {
        params: { id: hostId, key },
      })
    : await api.get(`/${ns}/host/${hostId}/configoption/area`, {
        params: { key },
      })
  return data
}

/** 独立资源管理操作（官方 POST /console/v1/:ns/host/:host_id/provision/:func；
 * mf_finance_common 族为 POST /console/v1/:ns/:id/:func） */
export async function submitCommonProvision(
  ns: CommonApiNamespace,
  hostId: number,
  func: string,
  params?: Record<string, unknown>,
  financeCommon = false
): Promise<ApiResponse> {
  const body = { id: hostId, func, ...params }
  const { data } = financeCommon
    ? await api.post(`/${ns}/${hostId}/${func}`, body)
    : await api.post(`/${ns}/host/${hostId}/provision/${func}`, body)
  return data
}

/** 独立资源日志（官方 GET /console/v1/:ns/:id/log） */
export async function fetchCommonLogList(
  ns: CommonApiNamespace,
  id: number,
  params?: { page?: number; limit?: number; orderby?: string; sort?: string }
): Promise<ApiResponse<{ list: CloudLogItem[]; count?: number }>> {
  const { data } = await api.get(`/${ns}/${id}/log`, { params })
  return data
}

/** 国家列表（官方 GET /console/v1/country） */
export interface CountryItem {
  id?: number
  name?: string
  name_zh?: string
  phone_code?: number | string
  iso?: string
}

export async function fetchCountryList(params?: {
  keywords?: string
}): Promise<ApiResponse<{ list: CountryItem[] }>> {
  const { data } = await api.get('/country', { params })
  return data
}

// ---------- 账户中心（account.htm，官方 AccountController / 插件 API） ----------

export interface AccountOauthItem {
  name?: string
  title?: string
  url?: string
  /** true 已绑定 false 未绑定 */
  link?: boolean
  img?: string
  img_unbound?: string
  [key: string]: unknown
}

export interface AccountInfo {
  id?: number
  username?: string
  email?: string
  phone_code?: string
  phone?: string
  company?: string
  country_id?: number | string
  address?: string
  language?: string
  notes?: string
  credit?: string
  total_credit?: string
  freeze_credit?: string
  set_operate_password?: boolean
  customfield?: Record<string, unknown>
  currency_prefix?: string
  notice_open?: number
  notice_method?: string
  oauth?: AccountOauthItem[]
  [key: string]: unknown
}

/** 账户详情（官方 GET /console/v1/account） */
export async function fetchAccount(): Promise<
  ApiResponse<{ account: AccountInfo }>
> {
  const { data } = await api.get('/account')
  return data
}

export interface UpdateAccountParams {
  username?: string
  company?: string
  country_id?: number | string
  address?: string
  notes?: string
  language?: string
  notice_open?: number
  notice_method?: string
  customfield?: Record<string, unknown>
  [key: string]: unknown
}

/** 编辑账户（官方 PUT /console/v1/account） */
export async function updateAccount(
  params: UpdateAccountParams
): Promise<ApiResponse> {
  const { data } = await api.put('/account', params)
  return data
}

/** 安全验证可用方式（官方 SecurityVerifyLogic::checkMethodAvailable 返回项） */
export interface AvailableSecurityMethod {
  value: 'operate_password' | 'email_code' | 'phone_code' | 'certification'
  label?: string
  tip?: string
  placeholder?: string
  account?: string
  phone_code?: string
  security_verify_token?: string
  [key: string]: unknown
}

/** 修改密码（官方 PUT /console/v1/account/password） */
export async function updateAccountPassword(params: {
  old_password: string
  new_password: string
  repassword: string
  security_verify_method?: string
  security_verify_value?: string
  certify_id?: string
}): Promise<ApiResponse> {
  const { data } = await api.put('/account/password', params)
  return data
}

/** 验证码修改密码（官方 PUT /console/v1/account/password/code） */
export async function codeUpdatePassword(params: {
  type: 'email' | 'phone'
  account: string
  phone_code?: string
  code: string
  password: string
  re_password: string
}): Promise<ApiResponse> {
  const { data } = await api.put('/account/password/code', params)
  return data
}

/** 忘记密码（官方 POST /console/v1/account/password_reset） */
export async function forgetPass(params: {
  type: 'email' | 'phone'
  account: string
  phone_code?: string
  code: string
  password: string
  re_password: string
}): Promise<ApiResponse> {
  const { data } = await api.post('/account/password_reset', params)
  return data
}

/** 修改操作密码（官方 PUT /console/v1/account/operate_password） */
export async function updateOperationPassword(params: {
  origin_operate_password?: string
  operate_password: string
  re_operate_password: string
  security_verify_method?: string
  security_verify_value?: string
  certify_id?: string
}): Promise<ApiResponse> {
  const { data } = await api.put('/account/operate_password', params)
  return data
}

/** 验证原手机（官方 PUT /console/v1/account/phone/old） */
export async function verifyOldPhone(params: { code: string }): Promise<ApiResponse> {
  const { data } = await api.put('/account/phone/old', params)
  return data
}

/** 修改/绑定手机（官方 PUT /console/v1/account/phone） */
export async function updatePhone(params: {
  phone_code: number | string
  phone: string
  code: string
}): Promise<ApiResponse> {
  const { data } = await api.put('/account/phone', params)
  return data
}

/** 验证原邮箱（官方 PUT /console/v1/account/email/old） */
export async function verifyOldEmail(params: { code: string }): Promise<ApiResponse> {
  const { data } = await api.put('/account/email/old', params)
  return data
}

/** 修改/绑定邮箱（官方 PUT /console/v1/account/email） */
export async function updateEmail(params: {
  email: string
  code: string
}): Promise<ApiResponse> {
  const { data } = await api.put('/account/email', params)
  return data
}

export interface AccountLogItem {
  id?: number
  description?: string
  create_time?: number
  ip?: string
  [key: string]: unknown
}

/** 账户操作日志（官方 GET /console/v1/log?type=system） */
export async function fetchAccountLog(params?: {
  page?: number
  limit?: number
  orderby?: string
  sort?: string
  keywords?: string
  type?: string
}): Promise<ApiResponse<{ list: AccountLogItem[]; count: number }>> {
  const { data } = await api.get('/log', { params })
  return data
}

/** 三方登录授权链接（官方 GET /console/v1/oauth/:name） */
export async function fetchOauthUrl(
  name: string
): Promise<ApiResponse<{ url: string }>> {
  const { data } = await api.get(`/oauth/${name}`)
  return data
}

/** 异常登录创建实名认证（官方 POST /console/v1/login/exception/certification/create） */
export async function createLoginCertification(params: {
  account?: string
  phone_code?: string
  security_verify_token?: string
}): Promise<ApiResponse<{ certify_id: string; certify_url: string }>> {
  const { data } = await api.post('/login/exception/certification/create', params)
  return data
}

/** 异常登录查询实名认证状态（官方 GET /console/v1/login/exception/certification/status） */
export async function fetchLoginCertificationStatus(params: {
  certify_id: string
  account?: string
  phone_code?: string
  security_verify_token?: string
}): Promise<ApiResponse<{ verify_status: number }>> {
  const { data } = await api.get('/login/exception/certification/status', {
    params,
  })
  return data
}

// ---------- 微信公众号扫码登录（官方 mp_weixin_notice 插件） ----------

export interface WxQrCodeData {
  ticket?: string
  token?: string
  img_url?: string
  expire_time?: number
  status?: string
  /** 过期后是否显示刷新 */
  is_refresh?: boolean
}

/** 生成微信登录二维码（官方 GET /console/v1/mp_weixin_notice/qrcode） */
export async function fetchWxQrCode(): Promise<
  ApiResponse<WxQrCodeData>
> {
  const { data } = await api.get('/mp_weixin_notice/qrcode')
  return data
}

/** 微信二维码登录状态（官方 GET /console/v1/mp_weixin_notice/qrcode/status） */
export async function fetchWxQrCodeStatus(params: {
  ticket?: string
  token?: string
}): Promise<
  ApiResponse<
    WxQrCodeData & {
      jwt?: string
      client?: Array<{ id: number; username: string; status?: number }>
    }
  >
> {
  const { data } = await api.get('/mp_weixin_notice/qrcode/status', { params })
  return data
}

/** 微信扫码选择用户登录（官方 POST /console/v1/mp_weixin_notice/qrcode/select_client_login） */
export async function selectWxClientLogin(params: {
  ticket?: string
  token?: string
  client_id?: string | number
}): Promise<ApiResponse<{ jwt: string }>> {
  const { data } = await api.post('/mp_weixin_notice/qrcode/select_client_login', params)
  return data
}

/** 取消三方登录关联（官方 POST /console/v1/oauth/unbind/:name） */
export async function cancelOauth(name: string): Promise<ApiResponse> {
  const { data } = await api.post(`/oauth/unbind/${name}`)
  return data
}

export interface ClientCustomFieldItem {
  id: number
  name?: string
  description?: string
  type?: string
  options?: string[]
  value?: string
  required?: number
  before_settle?: number
  regexpr?: string
  /** dropdown_text 前缀选项（官方运行时拆分） */
  select_select?: string
  [key: string]: unknown
}

/** 用户自定义字段和值（官方 GET /console/v1/client_custom_field_value） */
export async function fetchClientCustomFieldValue(): Promise<
  ApiResponse<{ list: ClientCustomFieldItem[] }>
> {
  const { data } = await api.get('/client_custom_field_value')
  return data
}

/** 微信公众号用户关联信息（官方 GET /console/v1/mp_weixin_notice/client） */
export interface WxConectInfo {
  is_subscribe?: number
  accept_push?: number
  [key: string]: unknown
}

export async function fetchWxInfo(): Promise<ApiResponse<WxConectInfo>> {
  const { data } = await api.get('/mp_weixin_notice/client')
  return data
}

/** 修改公众号消息推送开关（官方 PUT /console/v1/mp_weixin_notice/accept_push） */
export async function changeWxPushStatus(params: {
  status: number
}): Promise<ApiResponse> {
  const { data } = await api.put('/mp_weixin_notice/accept_push', params)
  return data
}

/** 个人认证信息（官方 /certification/info 的 person 对象，card_* 已脱敏带星号） */
export interface CertificationPersonInfo {
  username?: string
  company?: string
  card_name?: string
  card_number?: string
  /** 1已认证 2未通过 3待审核 4已提交资料 */
  status?: number
  create_time?: number
  certify_id?: string
  auth_fail?: string
  [key: string]: unknown
}

/** 企业认证信息（官方 /certification/info 的 company 对象） */
export interface CertificationCompanyInfo extends CertificationPersonInfo {
  certification_company?: string
  company_organ_code?: string
  legal_person_type?: number
}

/** 实名认证信息（官方 GET /console/v1/certification/info，IdcsmartCertification 插件） */
export interface CertificationInfoData {
  certification_open?: number
  certification_company_open?: number
  certification_upload?: number
  certification_uncertified_cannot_buy_product?: number
  certification_show_certify_id?: number
  certification_company_need_person?: number
  certification_auth_template_open?: number
  certification_auth_template_url?: string
  is_certification?: number
  person?: CertificationPersonInfo | null
  company?: CertificationCompanyInfo | null
  [key: string]: unknown
}

export async function fetchCertificationInfo(): Promise<
  ApiResponse<CertificationInfoData>
> {
  const { data } = await api.get('/certification/info')
  return data
}

/** 实名认证接口项（GET /console/v1/certification/plugin 返回的 list 元素） */
export interface CertificationPluginItem {
  id: number
  title: string
  name: string
  url?: string
  img?: string
  certification_type: string[]
}

/** 实名认证接口列表（官方 GET /console/v1/certification/plugin） */
export async function fetchCertificationPlugins(): Promise<
  ApiResponse<{ list: CertificationPluginItem[]; count: number }>
> {
  const { data } = await api.get('/certification/plugin')
  return data
}

/** 实名认证自定义字段（官方 GET /console/v1/certification/custom_fields） */
export interface CertificationCustomFieldItem {
  title: string
  /** text文本 select下拉 file文件 */
  type: 'text' | 'select' | 'file'
  /** select 选项：值是选项显示文案，键是提交值 */
  options?: Record<string, string>
  tip?: string
  required: boolean
  field: string
}

export async function fetchCertificationCustomFields(params: {
  name: string
  type: 'person' | 'company'
}): Promise<ApiResponse<{ custom_fields: CertificationCustomFieldItem[] }>> {
  const { data } = await api.get('/certification/custom_fields', { params })
  return data
}

/** 个人认证（官方 POST /console/v1/certification/person） */
export async function submitCertificationPerson(
  params: Record<string, unknown>
): Promise<ApiResponse> {
  const { data } = await api.post('/certification/person', params)
  return data
}

/** 企业认证（官方 POST /console/v1/certification/company） */
export async function submitCertificationCompany(
  params: Record<string, unknown>
): Promise<ApiResponse> {
  const { data } = await api.post('/certification/company', params)
  return data
}

/** 实名认证验证页（官方 GET /console/v1/certification/auth）：
 * status 200 → data.html 为实名接口的验证文档；status 400 → data.code：
 * 10000 重定向提交资料页，10001 跳状态页 */
export interface CertificationAuthData {
  html?: string
  code?: number
}

export async function fetchCertificationAuth(): Promise<
  ApiResponse<CertificationAuthData>
> {
  const { data } = await api.get('/certification/auth')
  return data
}

/** 实名认证状态（官方 GET /console/v1/certification/status，验证页轮询）：
 * status 200 → data.code：1通过 2未通过 3待审核 4提交资料；code=2 且 refresh=0 时继续轮询 */
export interface CertificationStatusData {
  code: number
  refresh: number
}

export async function fetchCertificationStatus(): Promise<
  ApiResponse<CertificationStatusData>
> {
  const { data } = await api.get('/certification/status')
  return data
}

/** 实名认证接口配置（官方 GET /console/v1/certification/plugin/config） */
export interface CertificationOrderInfo {
  id: number
  status: string
  url?: string
  amount?: number
  return_url?: string
}

export interface CertificationConfigData {
  free: number
  amount: number
  /** 是否需要支付：1是 0否 */
  pay: number
  order?: CertificationOrderInfo | null
}

export async function fetchCertificationConfig(params: {
  name: string
  type: 'person' | 'company'
}): Promise<ApiResponse<CertificationConfigData>> {
  const { data } = await api.get('/certification/plugin/config', { params })
  return data
}

/** 生成实名认证订单（官方 POST /console/v1/certification/plugin/order） */
export async function createCertificationOrder(params: {
  name: string
  type: 'person' | 'company'
}): Promise<ApiResponse<{ order_id: number }>> {
  const { data } = await api.post('/certification/plugin/order', params)
  return data
}

/** 子账户权限（官方 GET /console/v1/sub_account/:id/auth） */
export async function fetchSubAccountAuth(
  id: number
): Promise<ApiResponse<{ rule?: string[] }>> {
  const { data } = await api.get(`/sub_account/${id}/auth`)
  return data
}

// ---------- 子账户管理（IdcsmartSubAccount 插件，/console/v1/sub_account） ----------

/** 子账户列表项（官方 home 端不返回 email/phone_code/phone） */
export interface SubAccountItem {
  id: number
  /** 状态 0禁用 1启用 */
  status: 0 | 1
  username: string
  /** 上次使用时间（秒） */
  last_action_time?: number
  email?: string
  phone_code?: string
  phone?: string
  [key: string]: unknown
}

/** 子账户详情（官方 GET /console/v1/sub_account/:id → data.account） */
export interface SubAccountDetail {
  id: number
  username: string
  email?: string
  phone_code?: string | number
  phone?: string
  /** 权限ID数组 */
  auth?: number[]
  /** 通知 product产品 marketing营销 ticket工单 cost费用 recommend推介 system系统 */
  notice?: string[]
  /** 项目ID数组（IdcsmartProject 插件） */
  project_id?: number[]
  /** 可见产品 module模块 host具体产品 */
  visible_product?: string
  /** 模块名数组 */
  module?: string[]
  /** 产品ID数组 */
  host_id?: number[]
  [key: string]: unknown
}

/** 创建/编辑子账户参数 */
export interface SubAccountParams {
  username?: string
  email?: string
  phone_code?: string | number
  phone?: string
  password?: string
  project_id?: number[]
  visible_product?: string
  module?: string[]
  host_id?: number[]
  auth?: number[]
  notice?: string[]
}

/** 子账户列表（官方 GET /console/v1/sub_account） */
export async function fetchSubAccounts(params?: {
  page?: number
  limit?: number
  orderby?: string
  sort?: string
  keywords?: string
}): Promise<ApiResponse<{ list: SubAccountItem[]; count: number }>> {
  const { data } = await api.get('/sub_account', { params })
  return data
}

/** 子账户详情（官方 GET /console/v1/sub_account/:id） */
export async function fetchSubAccountDetail(
  id: number
): Promise<ApiResponse<{ account: SubAccountDetail }>> {
  const { data } = await api.get(`/sub_account/${id}`)
  return data
}

/** 创建子账户（官方 POST /console/v1/sub_account，password 明文） */
export async function createSubAccount(
  params: SubAccountParams
): Promise<ApiResponse> {
  const { data } = await api.post('/sub_account', params)
  return data
}

/** 编辑子账户（官方 PUT /console/v1/sub_account/:id，password 可选） */
export async function updateSubAccount(
  id: number,
  params: SubAccountParams
): Promise<ApiResponse> {
  const { data } = await api.put(`/sub_account/${id}`, params)
  return data
}

/** 删除子账户（官方 DELETE /console/v1/sub_account/:id） */
export async function deleteSubAccount(id: number): Promise<ApiResponse> {
  const { data } = await api.delete(`/sub_account/${id}`)
  return data
}

/** 子账户状态切换（官方 PUT /console/v1/sub_account/:id/status，status 0禁用 1启用） */
export async function changeSubAccountStatus(
  id: number,
  status: 0 | 1
): Promise<ApiResponse> {
  const { data } = await api.put(`/sub_account/${id}/status`, { id, status })
  return data
}

// ---------- 子账户表单选项（官方 clientarea 基础接口） ----------

/** 权限树节点（官方 GET /console/v1/auth → data.list） */
export interface AuthNode {
  id: number
  title: string
  url?: string
  order?: number
  parent_id?: number
  rules?: string[]
  child?: AuthNode[]
  [key: string]: unknown
}

/** 权限列表（官方 GET /console/v1/auth，树形结构） */
export async function fetchAuthList(): Promise<ApiResponse<{ list: AuthNode[] }>> {
  const { data } = await api.get('/auth')
  return data
}

/** 模块列表项（官方 GET /console/v1/module） */
export interface ModuleListItem {
  name: string
  display_name: string
  version?: string
}

/** 模块列表（官方 GET /console/v1/module） */
export async function fetchModuleList(): Promise<
  ApiResponse<{ list: ModuleListItem[] }>
> {
  const { data } = await api.get('/module')
  return data
}

/** 全部产品（官方 GET /console/v1/host/all，子账户可见产品选择用） */
export interface HostAllItem {
  id: number
  product_id?: number
  product_name?: string
  name?: string
  status?: string
  [key: string]: unknown
}

/** 用户所有产品（官方 GET /console/v1/host/all） */
export async function fetchHostAll(): Promise<
  ApiResponse<{ list: HostAllItem[]; count?: number }>
> {
  const { data } = await api.get('/host/all')
  return data
}

/** 项目列表项（官方 GET /console/v1/project，IdcsmartProject 插件） */
export interface ProjectItem {
  id: number
  name: string
  [key: string]: unknown
}

/** 项目列表（官方 GET /console/v1/project，IdcsmartProject 插件未安装时 404） */
export async function fetchProjectList(): Promise<
  ApiResponse<{ list: ProjectItem[]; count?: number }>
> {
  const { data } = await api.get('/project')
  return data
}

// ---------- 站内信（ClientCare 插件，/console/v1/client_care/mail） ----------

export interface ClientMailItem {
  id: number
  title?: string
  type?: string
  read?: number
  create_time?: number
  [key: string]: unknown
}

export interface ClientMailTypeItem {
  name?: string
  name_lang?: string
  [key: string]: unknown
}

/** 站内信列表（官方 GET /console/v1/client_care/mail/list） */
export async function fetchClientMails(params?: {
  page?: number
  limit?: number
  orderby?: string
  sort?: string
  keywords?: string
  type?: string
  read?: number | string
}): Promise<
  ApiResponse<{ list: ClientMailItem[]; count: number; type?: ClientMailTypeItem[] }>
> {
  const { data } = await api.get('/client_care/mail/list', { params })
  return data
}

/** 删除站内信（官方 DELETE /console/v1/client_care/mail?id=[]） */
export async function deleteClientMails(ids: number[]): Promise<ApiResponse> {
  const { data } = await api.delete('/client_care/mail', {
    params: { id: ids },
  })
  return data
}

/** 标记站内信已读（官方 PUT /console/v1/client_care/mail/read，all=1 全部已读） */
export async function readClientMails(params: {
  id?: number[]
  all?: number
}): Promise<ApiResponse> {
  const { data } = await api.put('/client_care/mail/read', params)
  return data
}

// ---------- 安全中心（security.htm：API密钥管理，官方 /console/v1/api） ----------

export interface ApiKeyItem {
  id: number
  /** API密钥名称 */
  name: string
  /** token（列表接口不返回，仅创建时返回一次） */
  token?: string
  /** 创建时间（秒） */
  create_time: number
  /** 白名单状态 0关闭 1开启 */
  status: 0 | 1
  /** 白名单IP（多行，每行一个 IP） */
  ip?: string
  [key: string]: unknown
}

export interface ApiKeyListData {
  list: ApiKeyItem[]
  count: number
  /** 是否可创建API 0否 1是 */
  create_api: number
}

/** API密钥列表（官方 GET /console/v1/api） */
export async function fetchApiKeyList(params?: {
  page?: number
  limit?: number
  orderby?: string
  sort?: string
  keywords?: string
}): Promise<ApiResponse<ApiKeyListData>> {
  const { data } = await api.get('/api', { params })
  return data
}

export interface CreateApiKeyResult {
  name: string
  id: number
  token: string
  /** 创建时间（秒） */
  create_time: number
  /** 私钥（仅创建时返回一次） */
  private_key: string
  /** API接口地址 */
  api_url: string
}

/** 创建API密钥（官方 POST /console/v1/api，name 必填且 ≤10字符） */
export async function createApiKey(
  params: { name: string }
): Promise<ApiResponse<CreateApiKeyResult>> {
  const { data } = await api.post('/api', params)
  return data
}

/** API白名单设置（官方 PUT /console/v1/api/:id/white_list） */
export async function updateApiWhiteList(params: {
  id: number
  /** 白名单状态 0关闭 1开启（官方传字符串，后端 in:0,1 校验） */
  status: 0 | 1 | '0' | '1'
  /** 白名单IP，状态开启时必填（多行） */
  ip?: string
}): Promise<ApiResponse> {
  const { data } = await api.put(`/api/${params.id}/white_list`, params)
  return data
}

/** 删除API密钥（官方 DELETE /console/v1/api/:id） */
export async function deleteApiKey(id: number): Promise<ApiResponse> {
  const { data } = await api.delete(`/api/${id}`)
  return data
}

// ---------- SSH密钥（security_ssh.htm，IdcsmartSshKey 插件，/console/v1/ssh_key） ----------

export interface SshKeyItem {
  id: number
  /** 密钥名称 */
  name: string
  /** 公钥内容 */
  public_key?: string
  /** 指纹 */
  finger_print?: string
  /** 类型（系统密钥/自定义） */
  type?: string
  [key: string]: unknown
}

/** SSH密钥列表（官方 GET /console/v1/ssh_key） */
export async function fetchSshKeyList(params?: {
  page?: number
  limit?: number
  orderby?: string
  sort?: string
  keywords?: string
}): Promise<ApiResponse<{ list: SshKeyItem[]; count: number }>> {
  const { data } = await api.get('/ssh_key', { params })
  return data
}

/** 创建SSH密钥（官方 POST /console/v1/ssh_key，name + public_key） */
export async function createSshKey(params: {
  name: string
  public_key: string
}): Promise<ApiResponse> {
  const { data } = await api.post('/ssh_key', params)
  return data
}

/** 编辑SSH密钥（官方 PUT /console/v1/ssh_key/:id） */
export async function updateSshKey(
  id: number,
  params: { name: string; public_key: string }
): Promise<ApiResponse> {
  const { data } = await api.put(`/ssh_key/${id}`, { id, ...params })
  return data
}

/** 删除SSH密钥（官方 DELETE /console/v1/ssh_key/:id） */
export async function deleteSshKey(id: number): Promise<ApiResponse> {
  const { data } = await api.delete(`/ssh_key/${id}`)
  return data
}

/** API日志列表（官方 GET /console/v1/log，type=api；account 操作日志同接口 type=system） */
export async function fetchApiLogList(params?: {
  page?: number
  limit?: number
  orderby?: string
  sort?: string
  keywords?: string
}): Promise<ApiResponse<{ list: AccountLogItem[]; count: number }>> {
  const { data } = await api.get('/log', { params: { type: 'api', ...params } })
  return data
}

// ---------- 安全组（security_group.htm，IdcsmartCloud 插件，/console/v1/security_group） ----------

export interface SecurityGroupItem {
  id: number
  /** 安全组名称 */
  name: string
  /** 关联实例数 */
  host_num: number
  /** 规则数 */
  rule_num: number
  /** 描述 */
  description?: string
  /** 创建时间（秒） */
  create_time: number
  [key: string]: unknown
}

/** 安全组列表（官方 GET /console/v1/security_group） */
export async function fetchSecurityGroupList(params?: {
  page?: number
  limit?: number
  orderby?: string
  sort?: string
  keywords?: string
}): Promise<ApiResponse<{ list: SecurityGroupItem[]; count: number }>> {
  const { data } = await api.get('/security_group', { params })
  return data
}

/** 创建安全组（官方 POST /console/v1/security_group） */
export async function createSecurityGroup(params: {
  name: string
  description?: string
}): Promise<ApiResponse> {
  const { data } = await api.post('/security_group', params)
  return data
}

/** 编辑安全组（官方 PUT /console/v1/security_group/:id） */
export async function updateSecurityGroup(
  id: number,
  params: { name: string; description?: string }
): Promise<ApiResponse> {
  const { data } = await api.put(`/security_group/${id}`, { id, ...params })
  return data
}

/** 删除安全组（官方 DELETE /console/v1/security_group/:id） */
export async function deleteSecurityGroup(id: number): Promise<ApiResponse> {
  const { data } = await api.delete(`/security_group/${id}`)
  return data
}

// ---------- 安全组规则/关联实例（group_rules.htm，IdcsmartCloud 插件） ----------

export interface SecurityGroupRuleItem {
  id: number
  /** 协议（all/tcp/udp/icmp/ssh/...） */
  protocol?: string
  /** 端口（22 或 22-12345 或 1-65535） */
  port?: string
  /** 授权IP（IP 或 IP/掩码） */
  ip?: string
  /** 描述 */
  description?: string
  /** 创建时间（秒） */
  create_time: number
  [key: string]: unknown
}

export interface SecurityGroupHostItem {
  id: number
  name?: string
  ip?: string
  [key: string]: unknown
}

export interface SecurityGroupRuleParams {
  id: number
  /** 规则方向 in=入方向 out=出方向 */
  direction: 'in' | 'out'
  protocol?: string
  port?: string
  ip?: string
  description?: string
}

/** 安全组规则列表（官方 GET /console/v1/security_group/:id/rule） */
export async function fetchSecurityGroupRules(
  groupId: number,
  params?: {
    page?: number
    limit?: number
    orderby?: string
    sort?: string
    keywords?: string
    direction?: 'in' | 'out'
  }
): Promise<ApiResponse<{ list: SecurityGroupRuleItem[]; count: number }>> {
  const { data } = await api.get(`/security_group/${groupId}/rule`, { params })
  return data
}

/** 添加安全组规则（官方 POST /console/v1/security_group/:id/rule） */
export async function createSecurityGroupRule(
  groupId: number,
  params: SecurityGroupRuleParams
): Promise<ApiResponse> {
  const { data } = await api.post(`/security_group/${groupId}/rule`, params)
  return data
}

/** 编辑安全组规则（官方 PUT /console/v1/security_group/rule/:id，id 为规则 ID） */
export async function updateSecurityGroupRule(
  ruleId: number,
  params: Partial<SecurityGroupRuleParams>
): Promise<ApiResponse> {
  const { data } = await api.put(`/security_group/rule/${ruleId}`, {
    id: ruleId,
    ...params,
  })
  return data
}

/** 删除安全组规则（官方 DELETE /console/v1/security_group/rule/:id） */
export async function deleteSecurityGroupRule(
  ruleId: number
): Promise<ApiResponse> {
  const { data } = await api.delete(`/security_group/rule/${ruleId}`)
  return data
}

export interface SecurityGroupBatchRule {
  protocol: string
  port: string | number
  direction: 'in' | 'out'
  ip?: string
  description?: string
}

/** 批量添加安全组规则（官方 POST /console/v1/security_group/:id/rule/batch） */
export async function batchCreateSecurityGroupRules(
  groupId: number,
  params: { rule: SecurityGroupBatchRule[] }
): Promise<ApiResponse> {
  const { data } = await api.post(`/security_group/${groupId}/rule/batch`, {
    id: groupId,
    ...params,
  })
  return data
}

/** 安全组关联实例列表（官方 GET /console/v1/security_group/:id/host） */
export async function fetchSecurityGroupHosts(
  groupId: number,
  params?: {
    page?: number
    limit?: number
    orderby?: string
    sort?: string
    keywords?: string
  }
): Promise<ApiResponse<{ list: SecurityGroupHostItem[]; count: number }>> {
  const { data } = await api.get(`/security_group/${groupId}/host`, { params })
  return data
}

/** 批量关联实例到安全组（官方 POST /console/v1/security_group/:id/host，返回每台实例关联结果） */
export async function linkSecurityGroupHosts(
  groupId: number,
  hostIds: number[]
): Promise<ApiResponse<Array<{ name?: string; msg?: string }>>> {
  const { data } = await api.post(`/security_group/${groupId}/host`, {
    id: groupId,
    host_id: hostIds,
  })
  return data
}

/** 解除实例与安全组的关联（官方 DELETE /console/v1/security_group/:id/host/:host_id） */
export async function unlinkSecurityGroupHost(
  groupId: number,
  hostId: number
): Promise<ApiResponse> {
  const { data } = await api.delete(
    `/security_group/${groupId}/host/${hostId}`
  )
  return data
}

/** 实例加入安全组（官方 POST /console/v1/security_group/:id/host/:host_id，productdetail 加入安全组） */
export async function addHostToSecurityGroup(
  groupId: number,
  hostId: number
): Promise<ApiResponse> {
  const { data } = await api.post(`/security_group/${groupId}/host/${hostId}`, {
    id: groupId,
    host_id: hostId,
  })
  return data
}
