import { api, type ApiResponse } from '@/lib/api'

/**
 * 财务中心 API（对照官方 clientarea template default 的 api/finance.js + api/common.js）。
 * 所有接口均为 /console/v1 命名空间，走统一 api 客户端（Bearer token + 401 处理）。
 */

// ---------- 订单记录 ----------

export interface OrderItem {
  id: number
  type: string
  status?: string
  amount: string
  billing_cycle?: string
  create_time: number
  pay_time?: number
  gateway?: string
  gateway_sign?: string
  credit?: number
  /** 子订单项数（>1 时列表可展开） */
  order_item_count?: number
  host_id?: number
  host_status?: string
  product_names?: string[]
  product_name?: string
  voucher?: Array<{ save_name?: string; name?: string; url?: string }>
  description?: string
  /** 未支付超时秒数（支付弹窗倒计时） */
  unpaid_timeout?: number
  remain_pay_time?: number
  [key: string]: unknown
}

export interface OrderDetail {
  id: number
  type: string
  status?: string
  amount: string
  billing_cycle?: string
  create_time: number
  pay_time?: number
  gateway?: string
  gateway_sign?: string
  credit?: number
  /** 客户名称（订单详情头部展示） */
  client_name?: string
  /** 订单项（树表展开 children / 详情商品明细） */
  items?: OrderItem[]
  /** 自定义字段（订单详情页自选字段展示） */
  self_defined_field?: Array<{ id: number; field_name?: string; value?: string }>
  voucher?: Array<{ save_name?: string; name?: string; url?: string }>
  review_fail_reason?: string
  unpaid_timeout?: number
  remain_pay_time?: number
  [key: string]: unknown
}

/** 订单交易记录项（官方 GET /order/:id/transaction_record，orderDetail 页交易明细） */
export interface OrderTransactionItem {
  id: number
  create_time?: number
  product_name?: string
  host_name?: string
  description?: string
  amount?: number | string
  [key: string]: unknown
}

/** 订单列表（官方 GET /console/v1/order） */
export async function fetchOrders(params?: {
  page?: number
  limit?: number
  keywords?: string
  status?: string
  type?: string
  orderby?: string
  sort?: string
}): Promise<ApiResponse<{ list: OrderItem[]; count: number }>> {
  const { data } = await api.get('/order', { params })
  return data
}

/** 订单详情（官方 GET /console/v1/order/:id） */
export async function fetchOrderDetail(
  id: number | string
): Promise<
  ApiResponse<{
    order: OrderDetail
    customfields?: Record<string, unknown>
    self_defined_field?: OrderDetail['self_defined_field']
  }>
> {
  const { data } = await api.get(`/order/${id}`)
  return data
}

/** 订单交易记录（官方 GET /console/v1/order/:id/transaction_record，订单详情页交易明细） */
export async function fetchOrderTransactionRecord(
  id: number | string
): Promise<ApiResponse<{ list: OrderTransactionItem[]; count: number }>> {
  const { data } = await api.get(`/order/${id}/transaction_record`)
  return data
}

/** 删除订单（官方 DELETE /console/v1/order/:id） */
export async function deleteOrder(id: number | string): Promise<ApiResponse> {
  const { data } = await api.delete(`/order/${id}`)
  return data
}

/** 批量删除订单（官方 DELETE /console/v1/order?ids=[]，id 为数组序列化为 id[]=） */
export async function batchDeleteOrders(ids: number[]): Promise<ApiResponse> {
  const { data } = await api.delete('/order', { params: { id: ids } })
  return data
}

/** 合并支付（官方 POST /console/v1/order/combine，返回新订单 id） */
export async function combineOrders(
  ids: number[]
): Promise<ApiResponse<{ id: number }>> {
  const { data } = await api.post('/order/combine', { ids })
  return data
}

/** 订单列表导出 EXCEL（官方 GET /console/v1/export_excel/order，blob 响应） */
export async function exportOrders(params?: Record<string, unknown>): Promise<Blob> {
  const res = await api.get('/export_excel/order', {
    params,
    responseType: 'blob',
    timeout: 0,
  })
  return res.data as Blob
}

// ---------- 交易记录 ----------

export interface TransactionItem {
  id: number
  order_id: number | string
  type: string
  amount: string
  create_time: number
  gateway?: string
  transaction_number?: string
  [key: string]: unknown
}

/** 交易记录列表（官方 GET /console/v1/transaction） */
export async function fetchTransactions(params?: {
  page?: number
  limit?: number
  keywords?: string
  orderby?: string
  sort?: string
}): Promise<ApiResponse<{ list: TransactionItem[]; count: number }>> {
  const { data } = await api.get('/transaction', { params })
  return data
}

// ---------- 余额记录 ----------

export interface CreditItem {
  id: number
  amount: string
  notes?: string
  type: string
  create_time: number
  gateway?: string
  [key: string]: unknown
}

/** 余额记录列表（官方 GET /console/v1/credit） */
export async function fetchCredits(params?: {
  page?: number
  limit?: number
  keywords?: string
  type?: string
  start_time?: number | string
  end_time?: number | string
  orderby?: string
  sort?: string
}): Promise<ApiResponse<{ list: CreditItem[]; count: number }>> {
  const { data } = await api.get('/credit', { params })
  return data
}

/** 使用/取消余额（官方 POST /console/v1/credit，id=订单id use=1/0） */
export async function submitCreditUse(params: {
  id: number
  use: number
}): Promise<ApiResponse> {
  const { data } = await api.post('/credit', params)
  return data
}

// ---------- 支付 ----------

export interface GatewayItem {
  id: number | string
  name: string
  title: string
  url?: string
  [key: string]: unknown
}

/** 支付方式列表（官方 GET /console/v1/gateway） */
export async function fetchGateway(): Promise<
  ApiResponse<{ list: GatewayItem[] }>
> {
  const { data } = await api.get('/gateway')
  return data
}

/** 支付（官方 POST /console/v1/pay，返回 html 为网关渲染内容，如二维码） */
export async function payOrder(params: {
  id: number | string
  gateway: string
}): Promise<ApiResponse<{ html?: string }>> {
  const { data } = await api.post('/pay', params)
  return data
}

/** 支付状态（官方 GET /console/v1/pay/:id/status，code=Paid 已支付） */
export async function fetchPayStatus(
  id: number | string
): Promise<{ code?: string; msg?: string } & ApiResponse> {
  const { data } = await api.get(`/pay/${id}/status`)
  return data
}

/** 信用额支付（官方 POST /console/v1/credit_limit/pay） */
export async function payCreditLimit(params: {
  id: number | string
  gateway: string
}): Promise<ApiResponse> {
  const { data } = await api.post('/credit_limit/pay', params)
  return data
}

/** 充值（官方 POST /console/v1/recharge，返回订单 id） */
export async function submitRecharge(params: {
  amount: number | string
  gateway?: string
}): Promise<ApiResponse<{ id: number }>> {
  const { data } = await api.post('/recharge', params)
  return data
}

/** 银行转账提交申请（官方 POST /console/v1/order/:id/submit_application） */
export async function submitApplication(
  id: number | string
): Promise<ApiResponse> {
  const { data } = await api.post(`/order/${id}/submit_application`)
  return data
}

/** 上传凭证（官方 PUT /console/v1/order/:id/voucher，voucher 为 save_name 数组） */
export async function uploadOrderProof(params: {
  id: number | string
  voucher: string[]
}): Promise<ApiResponse> {
  const { data } = await api.put(`/order/${params.id}/voucher`, params)
  return data
}

/** 变更支付方式（官方 PUT /console/v1/order/:id/gateway） */
export async function changeOrderPayType(
  id: number | string
): Promise<ApiResponse> {
  const { data } = await api.put(`/order/${id}/gateway`)
  return data
}

// ---------- 提现 ----------

export interface WithdrawRuleData {
  status?: number
  source?: string
  method: Array<{ id: number; name: string; no_account?: number }>
  min?: number | string
  max?: number | string
  withdraw_fee_type?: string
  withdraw_fee?: number | string
  percent?: number | string
  percent_min?: number | string
  [key: string]: unknown
}

/** 提现规则详情（官方 GET /console/v1/withdraw/rule/credit） */
export async function fetchWithdrawRule(): Promise<
  ApiResponse<WithdrawRuleData>
> {
  const { data } = await api.get('/withdraw/rule/credit')
  return data
}

/** 提现申请（官方 POST /console/v1/withdraw） */
export async function submitWithdraw(params: {
  source: string
  method_id: number | string
  amount: number | string
  account?: string
  card_number?: string
  name?: string
  notes?: string
}): Promise<ApiResponse> {
  const { data } = await api.post('/withdraw', params)
  return data
}

/** 提现记录列表（官方 GET /console/v1/withdraw；status：0待审核 1待打款 2已驳回 3已打款） */
export interface WithdrawalItem {
  id?: number
  withdraw_amount?: number | string
  create_time?: number
  status?: number
  reason?: string
  [key: string]: unknown
}

export async function fetchWithdrawals(params?: {
  page?: number
  limit?: number
  orderby?: string
  sort?: string
  keywords?: string
}): Promise<ApiResponse<{ list: WithdrawalItem[]; count: number }>> {
  const { data } = await api.get('/withdraw', { params })
  return data
}

// ---------- 代金券（IdcsmartVoucher 插件） ----------

export interface VoucherItem {
  id: number
  code: string
  price: number | string
  min_price: number | string
  status?: string
  start_time?: number
  end_time?: number
  is_get?: number
  is_applied?: number
  onetime?: number
  upgrade_use?: number
  renew_use?: number
  user_type?: string
  product?: Array<{ id: number; name?: string }>
  product_need?: Array<{ id: number; name?: string }>
  [key: string]: unknown
}

/** 可领代金券列表（官方 GET /console/v1/voucher） */
export async function fetchVoucherAvailable(params?: {
  page?: number
  limit?: number
}): Promise<ApiResponse<{ list: VoucherItem[]; count: number }>> {
  const { data } = await api.get('/voucher', { params })
  return data
}

/** 我的代金券（官方 GET /console/v1/voucher/mine） */
export async function fetchVoucherMine(params?: {
  page?: number
  limit?: number
  orderby?: string
  sort?: string
}): Promise<ApiResponse<{ list: VoucherItem[]; count: number }>> {
  const { data } = await api.get('/voucher/mine', { params })
  return data
}

/** 领取代金券（官方 POST /console/v1/voucher/:id/get） */
export async function getVoucher(id: number): Promise<ApiResponse> {
  const { data } = await api.post(`/voucher/${id}/get`, { id })
  return data
}

/** 支付页面可用代金券列表（官方 GET /console/v1/voucher/pay） */
export async function fetchVoucherPayList(params?: {
  order_id?: number | string
}): Promise<ApiResponse<{ list: VoucherItem[] }>> {
  const { data } = await api.get('/voucher/pay', { params })
  return data
}

/** 应用代金券（官方 POST /console/v1/voucher/pay） */
export async function applyVoucher(params: {
  order_id: number | string
  use: number
  auto?: number
  voucher_get_id?: number | string
}): Promise<ApiResponse<{ voucher_amount?: number; voucher_get_id?: string }>> {
  const { data } = await api.post('/voucher/pay', params)
  return data
}

// ---------- 电子合同（EContract 插件） ----------

export interface ContractItem {
  id: number
  order_id?: number
  status?: string
  base_contract?: number
  reason?: string
  post_number?: string
  host?: Array<{ name?: string; product_name?: string; status?: string }>
  [key: string]: unknown
}

/** 申请合同列表（官方 GET /console/v1/e_contract/order） */
export async function fetchContractOrders(params?: {
  page?: number
  limit?: number
  keywords?: string
}): Promise<ApiResponse<{ list: ContractItem[]; count: number }>> {
  const { data } = await api.get('/e_contract/order', { params })
  return data
}

/** 合同管理列表（官方 GET /console/v1/e_contract） */
export async function fetchContractList(params?: {
  page?: number
  limit?: number
  keywords?: string
}): Promise<ApiResponse<{ list: ContractItem[]; count: number }>> {
  const { data } = await api.get('/e_contract', { params })
  return data
}

/** 获取甲方信息（官方 GET /console/v1/e_contract/first_part_info） */
export async function fetchPartInfo(): Promise<
  ApiResponse<Record<string, unknown>>
> {
  const { data } = await api.get('/e_contract/first_part_info')
  return data
}

/** 保存甲方信息（官方 PUT /console/v1/e_contract/first_part_info） */
export async function savePartInfo(
  params: Record<string, unknown>
): Promise<ApiResponse> {
  const { data } = await api.put('/e_contract/first_part_info', params)
  return data
}

/** 下载电子合同 PDF（官方 POST /console/v1/e_contract/:id/download） */
export async function downloadContract(
  id: number
): Promise<ApiResponse<{ url: string }>> {
  const { data } = await api.post(`/e_contract/${id}/download`)
  return data
}

/** 预览电子合同（官方 GET /console/v1/e_contract/:id/preview，返回下载链接） */
export async function previewContract(
  id: number
): Promise<ApiResponse<{ url: string }>> {
  const { data } = await api.get(`/e_contract/${id}/preview`)
  return data
}

/** 取消合同（官方 POST /console/v1/e_contract/:id/cancel） */
export async function cancelContract(id: number): Promise<ApiResponse> {
  const { data } = await api.post(`/e_contract/${id}/cancel`)
  return data
}

/** 邮递纸质合同（官方 POST /console/v1/e_contract/:id/mail） */
export async function mailContract(params: {
  id: number
  rec_person: string
  rec_address: string
  rec_phone: string
}): Promise<ApiResponse<{ data?: { id: number } }>> {
  const { data } = await api.post(`/e_contract/${params.id}/mail`, params)
  return data
}

// ---------- 信用额（CreditLimit 插件） ----------

export interface CreditLimitData {
  status?: string
  end_time?: number
  credit_limit?: number | string
  remaining_amount?: number | string
  used?: number | string
  account?: {
    repayment_time?: number
    status?: string
    amount?: number | string
    order_id?: number
  }
  [key: string]: unknown
}

export interface CreditLimitAccountItem {
  id: number
  start_time?: number
  end_time?: number
  amount?: number | string
  status?: string
  order_id?: number
  [key: string]: unknown
}

/** 出账列表（官方 GET /console/v1/credit_limit/account） */
export async function fetchCreditLimitAccounts(params?: {
  page?: number
  limit?: number
}): Promise<ApiResponse<{ list: CreditLimitAccountItem[]; count: number }>> {
  const { data } = await api.get('/credit_limit/account', { params })
  return data
}

/** 授信详情（官方 GET /console/v1/credit_limit） */
export async function fetchCreditLimit(): Promise<
  ApiResponse<{ credit_limit: CreditLimitData }>
> {
  const { data } = await api.get('/credit_limit')
  return data
}

/** 出账周期订单列表（官方 GET /console/v1/credit_limit/account/:id/order） */
export async function fetchCreditLimitOrders(params: {
  id: number
  page?: number
  limit?: number
  orderby?: string
  sort?: string
}): Promise<ApiResponse<{ list: OrderItem[]; count: number }>> {
  const { data } = await api.get(`/credit_limit/account/${params.id}/order`, {
    params,
  })
  return data
}

/** 信用额提前还款（官方 POST /console/v1/credit_limit/prepayment，返回订单 id） */
export async function prepayCreditLimit(): Promise<
  ApiResponse<{ order_id: number }>
> {
  const { data } = await api.post('/credit_limit/prepayment')
  return data
}

// ---------- 平台币（Coin 插件） ----------

export interface CoinItem {
  id: number
  name?: string
  amount?: number | string
  leave_amount?: number | string
  begin_time?: number
  end_time?: number
  effective_start_time?: number
  effective_end_time?: number
  discount_amount?: number
  certification_can_use?: number
  with_event_promotion_use?: number
  with_promo_code_use?: number
  with_client_level_use?: number
  with_voucher_use?: number
  host_ids?: number[]
  product?: Array<{ id: number; name?: string }>
  product_only_defence?: number
  order_available?: number
  upgrade_available?: number
  renew_available?: number
  demand_available?: number
  cycle_limit?: number
  cycle?: string[]
  use_detail_list?: Array<{
    id: number
    order_id?: number
    create_time?: number
    amount?: number | string
    leave_amount?: number | string
  }>
  [key: string]: unknown
}

export interface CoinClientCouponData {
  name?: string
  use_coin?: number
  credit_enough_no_use?: number
  available_coin?: number
  coin_description_open?: number
  coin_description?: string
  per_recharge_get_coin_max?: number | string
  [key: string]: unknown
}

/** 用户可用平台币详情（官方 GET /console/v1/coin/client/coupon） */
export async function fetchCoinCoupon(): Promise<
  ApiResponse<CoinClientCouponData>
> {
  const { data } = await api.get('/coin/client/coupon')
  return data
}

/** 待领取平台币列表（官方 GET /console/v1/coin/wait_get） */
export async function fetchCoinWaitList(params?: {
  page?: number
  limit?: number
}): Promise<ApiResponse<{ list: CoinItem[]; count: number }>> {
  const { data } = await api.get('/coin/wait_get', { params })
  return data
}

/** 领取平台币（官方 POST /console/v1/coin/:id/get） */
export async function getCoin(id: number): Promise<ApiResponse> {
  const { data } = await api.post(`/coin/${id}/get`, { id })
  return data
}

/** 平台币列表（官方 GET /console/v1/coin/coupon） */
export async function fetchCoinList(params?: {
  status?: string
  page?: number
  limit?: number
}): Promise<ApiResponse<{ list: CoinItem[]; count: number }>> {
  const { data } = await api.get('/coin/coupon', { params })
  return data
}

/** 平台币使用详情（官方 GET /console/v1/coin/coupon/:id/use_detail） */
export async function fetchCoinUseDetail(
  id: number
): Promise<ApiResponse<{ list: CoinItem['use_detail_list'] }>> {
  const { data } = await api.get(`/coin/coupon/${id}/use_detail`)
  return data
}

/** 平台币充值页面详情（官方 GET /console/v1/coin/recharge） */
export async function fetchCoinRechargeDetail(): Promise<
  ApiResponse<{
    coins?: Array<{
      id: number
      name?: string
      begin_time?: number
      end_time?: number
      type?: string
      recharge_min?: number
      recharge_proportion?: number
      return?: Array<{ id: number; amount: number; award: number }>
    }>
  }>
> {
  const { data } = await api.get('/coin/recharge')
  return data
}

/** 支付页面可用平台币列表（官方 GET /console/v1/coin/pay） */
export async function fetchCoinPayList(params?: {
  order_id?: number | string
}): Promise<ApiResponse<{ list: CoinItem[] }>> {
  const { data } = await api.get('/coin/pay', { params })
  return data
}

/** 应用平台币（官方 POST /console/v1/coin/pay） */
export async function applyCoin(params: {
  order_id: number | string
  use: number
  auto?: number
  coin_coupon_ids?: number[]
}): Promise<
  ApiResponse<{
    coin_amount?: number
    coin_coupons_count?: number
    coin_coupons?: Array<{ rel_id?: number; amount?: number }>
  }>
> {
  const { data } = await api.post('/coin/pay', params)
  return data
}

// ---------- 其他 ----------

/** 待退款金额（官方 GET /console/v1/refund/pending/amount，IdcsmartRefund 插件） */
export async function fetchPendingRefundAmount(): Promise<
  ApiResponse<{ amount: number }>
> {
  const { data } = await api.get('/refund/pending/amount')
  return data
}

/** 冻结记录（官方 GET /console/v1/account/credit/freeze） */
export interface FreezeRecordItem {
  id: number
  amount: number | string
  create_time: number
  client_notes?: string
  [key: string]: unknown
}

export async function fetchFreezeRecords(): Promise<
  ApiResponse<{ list: FreezeRecordItem[] }>
> {
  const { data } = await api.get('/account/credit/freeze')
  return data
}
