// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CloudDetailPage } from '@/features/client/cloud-detail'

// 官方插件 lang/index.js 的 zh-cn 字典（仅覆盖本页面用到的 key，保证测试文案与官方一致）
const ZH_LANG: Record<string, string> = {
  appstore_text301: '配置信息',
  cloud_pay_title: '支付信息',
  auto_renew: '自动续费',
  cloud_due_time: '下次续费时间',
  cloud_creat_time: '开通时间',
  cloud_pay_style: '付款类型',
  cloud_first_pay: '首次订购金额',
  cloud_re_text: '下次续费金额',
  cloud_re_btn: '续费',
  cloud_code: '优惠码',
  cloud_add_notes: '添加备注',
  common_cloud_label14: '用户名',
  common_cloud_label13: '端口',
  login_pass: '密码',
  common_cloud_tab1: '统计图表',
  common_cloud_tab2: '管理',
  common_cloud_tab4: '网络',
  common_cloud_tab5: '备份与快照',
  common_cloud_tab6: '日志',
  common_cloud_text10: '开机',
  common_cloud_text11: '关机',
  common_cloud_text12: '操作中',
  common_cloud_text13: '重启',
  common_cloud_text41: '强制重启',
  common_cloud_text42: '强制关机',
  common_cloud_text73: 'CPU占用量',
  common_cloud_text74: '占用量(%)',
  common_cloud_text289: '硬盘IO',
  common_cloud_text290: '读取速度(KB/s)',
  common_cloud_text291: '写入速度(KB/s)',
  common_cloud_text83: '内存用量',
  common_cloud_text292: '网卡',
  common_cloud_text293: '进(bps)',
  common_cloud_text294: '出(bps)',
  common_cloud_label15: '过去24小时',
  common_cloud_label16: '过去3天',
  common_cloud_label17: '过去7天',
  common_cloud_title3: '公网IP',
  common_cloud_label21: 'IP地址',
  common_cloud_label22: '网关',
  common_cloud_label23: '掩码',
  common_cloud_title4: '网络流量',
  common_cloud_label24: '当月流量',
  common_cloud_label25: '剩余流量',
  common_cloud_title46: '无限制',
  common_cloud_text31: '内存',
  cloud_os: '操作系统',
  peak_defence: '防御峰值',
  no_defense: '无防御',
  mf_disk: '硬盘',
  mf_flow: '流量',
  mf_bw: '带宽',
  actual_bw: '真实带宽',
  mf_gpu: '显卡',
  mf_tip28: '无限流量',
  common_cloud_title15: 'IP数量',
  common_cloud_title43: '个',
  common_cloud_text30: '核',
  mf_none: '无',
  mf_one: '个',
  shoppingCar_goodsNums: '数量',
  not_limited: '无限制',
  simulate_physical: '模拟物理机运行',
  simulate_physical_tip: '模拟物理机运行提示',
  panel_password: '面板密码',
  security_tab1: 'SSH密钥',
  order_text4: '未付款',
  finance_text88: '开通中',
  finance_text142: '正常',
  finance_text143: '已暂停',
  finance_text144: '已删除',
  common_cloud_text93: '开通失败',
}

// 页面组件从官方 lang 文件取文案（useModuleLang），jsdom 下没有 /plugins 静态资源，
// 用 zh-cn 字典桩替代，保持与官方一致的文案断言
vi.mock('@/hooks/use-module-lang', () => ({
  useModuleLang: () => ({
    t: (key: string) => ZH_LANG[key] ?? key,
    lang: ZH_LANG,
    isLoading: false,
    error: null,
  }),
}))

// 退订组件走 clientarea 基础语言（useClientLang，window.lang 等价物）
const CLIENT_LANG: Record<string, string> = {
  common_unsubscribe_title: '退订',
  common_unsubscribe_btn_cancel: '取消退订',
  common_unsubscribe_pending: '待审核',
  common_unsubscribe_suspending: '待停用',
  common_unsubscribe_suspend: '停用中',
  common_unsubscribe_suspended: '已停用',
  common_unsubscribe_refund: '已退款',
  common_unsubscribe_reject: '审核驳回',
  common_unsubscribe_cancelled: '已取消',
  common_unsubscribe_label_product_info: '产品信息',
  common_unsubscribe_label_order_time: '订购时间',
  common_unsubscribe_label_order_amount: '订购金额',
  common_unsubscribe_label_reason: '停用原因',
  common_unsubscribe_label_time: '停用时间',
  common_unsubscribe_label_immediate: '立即',
  common_unsubscribe_label_refund_method: '退款方式',
  common_unsubscribe_refund_method_credit: '余额',
  common_unsubscribe_refund_method_gateway: '原路返回',
  common_unsubscribe_label_refund_info: '退款信息',
  common_unsubscribe_label_base_amount: '应退金额',
  common_unsubscribe_label_service_fee: '手续费',
  common_unsubscribe_label_refund_amount: '实际退款金额',
  common_unsubscribe_btn_confirm_refund: '确认退款',
  common_unsubscribe_btn_confirm_unsubscribe: '确认停用',
  common_unsubscribe_tip_no_refund: '此产品停用不支持退款',
  common_unsubscribe_msg_select_reason: '请选择停用原因',
  account_btn3: '取消',
  auto_renew_tip1: '请确认您将为以下产品',
  auto_renew_tip2: '开启自动续费',
  auto_renew_tip3: '关闭自动续费',
  auto_renew_name: '产品名称',
  auto_renew_area: '区域',
  auto_renew_cycle: '续费金额/周期',
  auto_renew_due: '到期时间',
  auto_renew_sure: '确定',
  auto_renew_cancel: '取消',
}
vi.mock('@/hooks/use-client-lang', () => ({
  useClientLang: () => ({
    t: (key: string) => CLIENT_LANG[key] ?? key,
    lang: CLIENT_LANG,
    isLoading: false,
    error: null,
  }),
}))

afterEach(() => {
  cleanup()
})

vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return {
    ...actual,
    fetchHostDetail: vi.fn().mockResolvedValue({
      status: 200,
      msg: 'ok',
      data: {
        host: {
          id: 17,
          product_id: 11,
          product_name: '高质量云电脑 2核 2GB A型',
          name: 'ser8830400096',
          status: 'Active',
          due_time: 1777881600,
          active_time: 1746000000,
          billing_cycle: 'monthly',
          billing_cycle_name: '月付',
          first_payment_amount: '59.00',
          renew_amount: '59.00',
          notes: '',
        },
        self_defined_field: [],
      },
    }),
    fetchCloudDetail: vi.fn().mockResolvedValue({
      status: 200,
      msg: 'ok',
      data: {
        host_data: {
          dedicatedip: '192.168.1.10',
          assignedips: ['10.0.0.2', '10.0.0.3'],
          username: 'root',
          password: 'pass123',
          port: 22,
          bwlimit: 0,
          bwusage: 0,
        },
        config_options: [
          { id: 1, option_type: 6, name: 'CPU', sub_name: '2核' },
          { id: 2, option_type: 9, name: '内存', sub_name: '2GB' },
          { id: 3, option_type: 12, name: '地区', sub_name: '中国', code: 'CN' },
        ],
        cloud_os_group: [{ id: 1, name: 'CentOS' }],
        cloud_os: [{ id: 11, group: 1, name: '7.6' }],
        system_button: { upgrade: { disabled: true }, upgrade_option: { disabled: true } },
        nat_acl_limit: 0,
        nat_web_limit: 0,
        network_type: 'normal',
        dcimcloud: {},
      },
    }),
    fetchCloudStatus: vi.fn().mockResolvedValue({
      status: 200,
      msg: 'ok',
      data: { status: 'on', desc: '开机' },
    }),
    fetchCloudRemoteInfo: vi.fn().mockResolvedValue({
      status: 200,
      msg: 'ok',
      data: { rescue: 0 },
    }),
    fetchCloudIpDetails: vi.fn().mockResolvedValue({
      status: 200,
      msg: 'ok',
      data: { dedicate_ip: '192.168.1.10', assign_ip: '', ip_num: 1 },
    }),
    fetchHostRenewAuto: vi.fn().mockResolvedValue({
      status: 200,
      msg: 'ok',
      data: { status: 0 },
    }),
    fetchHostSpecificInfo: vi.fn().mockResolvedValue({
      status: 200,
      msg: 'ok',
      data: {
        id: 17,
        name: 'ser8830400096',
        renew_amount: '3.6000',
        billing_cycle_name: '月付',
        due_time: 1788746674,
        ip_num: 0,
        dedicate_ip: '',
        assign_ip: '',
        country: '',
        city: '',
        area: '',
      },
    }),
    updateHostRenewAuto: vi.fn().mockResolvedValue({
      status: 200,
      msg: 'ok',
    }),
    fetchCloudNatAclList: vi.fn().mockResolvedValue({
      status: 200,
      msg: 'ok',
      data: { list: [] },
    }),
    fetchCloudNatWebList: vi.fn().mockResolvedValue({
      status: 200,
      msg: 'ok',
      data: { list: [] },
    }),
    fetchCloudIpList: vi.fn().mockResolvedValue({
      status: 200,
      msg: 'ok',
      data: { list: [] },
    }),
    fetchCloudFlow: vi.fn().mockResolvedValue({
      status: 200,
      msg: 'ok',
      data: {},
    }),
    fetchCloudChart: vi.fn().mockResolvedValue({
      status: 200,
      msg: 'ok',
      data: {
        list: [
          [
            { time: 1746000000, value: 10 },
            { time: 1746003600, value: 20 },
          ],
        ],
      },
    }),
    fetchCloudRenewPage: vi.fn().mockResolvedValue({
      status: 200,
      msg: 'ok',
      data: { host: [] },
    }),
    fetchProductConfig: vi.fn().mockResolvedValue({
      status: 200,
      msg: 'ok',
      data: { config: { memory_unit: 'GB' } },
    }),
    changeSimulatePhysical: vi.fn().mockResolvedValue({
      status: 200,
      msg: 'ok',
    }),
    fetchHostRefundInfo: vi.fn().mockResolvedValue({
      status: 200,
      msg: 'ok',
      data: { refund: null },
    }),
    fetchRefundPage: vi.fn().mockResolvedValue({
      status: 200,
      msg: 'ok',
      data: { allow_refund: 0, reason_custom: 1, reasons: [], host: {} },
    }),
    submitHostRefund: vi.fn().mockResolvedValue({ status: 200, msg: 'ok' }),
    cancelHostRefund: vi.fn().mockResolvedValue({ status: 200, msg: 'ok' }),
  }
})

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
  window.localStorage.setItem('jwt', 'test')
  vi.spyOn(window, 'open').mockImplementation(() => null)
  Object.defineProperty(navigator, 'clipboard', {
    writable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
})

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

describe('CloudDetailPage 选项卡', () => {
  it('点击网络选项卡不崩溃', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <QueryClientProvider client={queryClient}>
        <CloudDetailPage hostId={17} commonData={undefined} />
      </QueryClientProvider>
    )

    // 等待主数据加载
    const titles = await screen.findAllByText('高质量云电脑 2核 2GB A型', {}, { timeout: 3000 })
    expect(titles.length).toBeGreaterThan(0)

    // 点击网络选项卡
    const networkBtn = screen.getByRole('tab', { name: '网络' })
    await userEvent.click(networkBtn)
    await new Promise((r) => setTimeout(r, 300))

    expect(screen.getByText('公网IP')).toBeTruthy()
    // assignedips 为数组时主 IP + 附加 IP 都应展示（主 IP 在头部与表格各出现一次）
    expect(screen.getAllByText('192.168.1.10').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('10.0.0.2')).toBeTruthy()
    expect(screen.getByText('10.0.0.3')).toBeTruthy()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('监控选项卡每个图表只请求一次（queryKey 稳定，不无限重发）', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <CloudDetailPage hostId={17} commonData={undefined} />
      </QueryClientProvider>
    )

    await screen.findAllByText('高质量云电脑 2核 2GB A型', {}, { timeout: 3000 })

    const chartApi = (await import('@/api')).fetchCloudChart as ReturnType<typeof vi.fn>
    chartApi.mockClear()

    // 点击监控选项卡
    const monitorBtn = screen.getByRole('tab', { name: '统计图表' })
    await userEvent.click(monitorBtn)
    // 等待 4 个图表请求发出并完成
    await new Promise((r) => setTimeout(r, 500))
    const first = chartApi.mock.calls.length
    // 再等一段时间，若 queryKey 不稳定会持续重发
    await new Promise((r) => setTimeout(r, 800))
    const second = chartApi.mock.calls.length

    expect(screen.getByText('CPU占用量')).toBeTruthy()
    // cpu/disk/memory/flow 各一次，且不随时间增长
    expect(first).toBe(4)
    expect(second).toBe(first)
  })
})

describe('CloudDetailPage DCIM 实例信息', () => {
  const DCIM_MODULE = {
    module: 'mf_dcim',
    type: 'server' as const,
    apiNamespace: 'mf_dcim',
    kind: 'dcim' as const,
    features: {
      monitor: true,
      manage: true,
      disk: false,
      network: true,
      nat: false,
      backup: false,
      upgrade: true,
    },
    langUrl: '/plugins/server/mf_dcim/template/clientarea/pc/default/lang/index.js',
  }

  it('渲染 model_config/image/line/bw 机型配置行（DCIM 无 config_options）', async () => {
    const api = await import('@/api')
    vi.mocked(api.fetchHostDetail).mockResolvedValue({
      status: 200,
      msg: 'ok',
      data: {
        host: {
          id: 16,
          product_name: 'DCIM自定义-示例',
          name: 'ser092242834803',
          status: 'Active',
          billing_cycle: 'recurring_prepayment',
        },
        self_defined_field: [],
      },
    })
    vi.mocked(api.fetchCloudDetail).mockResolvedValue({
      status: 200,
      msg: 'ok',
      data: {
        host_data: {},
        config_options: [],
        model_config: {
          cpu: '8888TEST',
          memory: '256G',
          disk: '200GB SSD',
          gpu: '',
        },
        image: { name: 'CentOS-5.8-x86_64' },
        peak_defence: 0,
        bw: '100',
        line: { sync_firewall_rule: 0, bill_type: 'bw' },
        data_center: { iso: 'CN', country_name: '中国', city: '北京' },
        dcimcloud: {},
      },
    })
    vi.mocked(api.fetchCloudRemoteInfo).mockResolvedValue({
      status: 200,
      msg: 'ok',
      data: {
        rescue: 0,
        username: 'root',
        password: 'pass123',
        port: 22,
        ip_num: 0,
      },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <CloudDetailPage
          hostId={16}
          commonData={undefined}
          module={DCIM_MODULE}
        />
      </QueryClientProvider>
    )

    await screen.findAllByText('DCIM自定义-示例', {}, { timeout: 3000 })

    // 配置信息卡：机型配置/镜像/带宽/IP 数量（官方 dcimDetail msg-l）
    expect(screen.getByText('8888TEST')).toBeTruthy()
    expect(screen.getByText('256G')).toBeTruthy()
    expect(screen.getByText('200GB SSD')).toBeTruthy()
    expect(screen.getByText('CentOS-5.8-x86_64')).toBeTruthy()
    expect(screen.getByText('100Mbps')).toBeTruthy()
    expect(screen.getByText('0个')).toBeTruthy()
    // 头部区域（官方 cloudData.data_center 国家-城市）
    expect(screen.getByText('中国-北京')).toBeTruthy()
  })

  it('DCIM 网络选项卡流量走 flow API（total/leave）', async () => {
    const api = await import('@/api')
    vi.mocked(api.fetchCloudFlow).mockResolvedValue({
      status: 200,
      msg: 'ok',
      data: { total: '100GB', leave: '23GB', reset_flow_date: '2026-08-01' },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <CloudDetailPage
          hostId={16}
          commonData={undefined}
          module={DCIM_MODULE}
        />
      </QueryClientProvider>
    )

    await screen.findAllByText('DCIM自定义-示例', {}, { timeout: 3000 })

    const networkBtn = screen.getByRole('tab', { name: '网络' })
    await userEvent.click(networkBtn)
    await screen.findByText('100GB', {}, { timeout: 3000 })

    expect(screen.getByText('23GB')).toBeTruthy()
    expect(screen.getByText('2026-08-01')).toBeTruthy()
  })
})

describe('CloudDetailPage mf_cloud 云产品配置信息', () => {
  const MF_CLOUD_MODULE = {
    module: 'mf_cloud',
    type: 'server' as const,
    apiNamespace: 'mf_cloud',
    kind: 'cloud' as const,
    features: {
      monitor: true,
      manage: true,
      disk: true,
      network: true,
      nat: true,
      backup: true,
      upgrade: true,
    },
    langUrl: '/plugins/server/mf_cloud/template/clientarea/pc/default/lang/index.js',
  }

  it('官方示例结构：全字段列表展示（CPU/GPU/内存/系统/带宽/端口/防御/IP数量/面板密码）', async () => {
    const api = await import('@/api')
    vi.mocked(api.fetchHostDetail).mockResolvedValue({
      status: 200,
      msg: 'ok',
      data: {
        host: {
          id: 15,
          product_id: 5,
          product_name: '示例云主机',
          name: 'ser0000000015',
          status: 'Active',
          billing_cycle: 'monthly',
          due_time: 1777881600,
          active_time: 1746000000,
          renew_amount: '100.00',
        },
        self_defined_field: [],
      },
    })
    vi.mocked(api.fetchCloudDetail).mockResolvedValue({
      status: 200,
      msg: 'ok',
      data: {
        ip: '',
        ip_num: 0,
        ipv6_num: 0,
        power_status: 'fault',
        cpu: 1,
        memory: 1,
        system_disk: { size: 0, type: '' },
        data_disk: { count: 1, total_size: 30 },
        line: { id: 1, bill_type: 'bw', sync_firewall_rule: 0 },
        bw: 100,
        peak_defence: 1,
        gpu: '',
        data_center: { id: 1, city: '北京', iso: 'CN' },
        image: { id: 309, name: 'CentOS-6.8.1607-x64', image_group_name: 'CentOS' },
        config: {
          simulate_physical_machine_enable: 1,
          show_panel_password_enable: 1,
          manual_manage: 0,
        },
        dcimcloud: {},
      },
    })
    vi.mocked(api.fetchCloudRemoteInfo).mockResolvedValue({
      status: 200,
      msg: 'ok',
      data: { rescue: 0, port: 0, panel_pass: '', simulate_physical_machine: 0 },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <CloudDetailPage
          hostId={15}
          commonData={undefined}
          module={MF_CLOUD_MODULE}
        />
      </QueryClientProvider>
    )

    await screen.findAllByText('示例云主机', {}, { timeout: 3000 })

    // 官方 msg-l 全字段：CPU 核数/内存单位/操作系统/带宽/端口/防御/IP 数量
    expect(screen.getByText(/1核/)).toBeTruthy()
    expect(screen.getByText('1GB')).toBeTruthy()
    expect(screen.getByText('CentOS-6.8.1607-x64')).toBeTruthy()
    expect(screen.getByText('100Mbps')).toBeTruthy()
    expect(screen.getByText('1G')).toBeTruthy()
    expect(screen.getByText('无')).toBeTruthy()
    // 模拟物理机开关 + 面板密码（config 门控开启）
    expect(screen.getByText(/模拟物理机运行/)).toBeTruthy()
    expect(screen.getByText(/面板密码/)).toBeTruthy()
  })
})

describe('CloudDetailPage 自动续费确认（specific_info）', () => {
  beforeEach(() => {
    ;(window as { __CLIENT_CONFIG__?: unknown }).__CLIENT_CONFIG__ = {
      addons: [
        { name: 'IdcsmartRenew' },
        { name: 'IdcsmartRefund' },
      ],
    }
  })

  it('切换开关先请求 specific_info，弹窗展示 ID/产品/金额周期/到期时间', async () => {
    const api = await import('@/api')
    vi.mocked(api.fetchHostDetail).mockResolvedValue({
      status: 200,
      msg: 'ok',
      data: {
        host: {
          id: 17,
          product_name: '高质量云电脑 2核 2GB A型',
          status: 'Active',
          billing_cycle: 'monthly',
          due_time: 1788746674,
          active_time: 1746000000,
          renew_amount: '3.60',
        },
        self_defined_field: [],
      },
    })
    const spy = vi.spyOn(api, 'fetchHostSpecificInfo')

    render(
      <QueryClientProvider client={queryClient}>
        <CloudDetailPage hostId={17} commonData={undefined} />
      </QueryClientProvider>
    )

    await screen.findAllByText('高质量云电脑 2核 2GB A型', {}, { timeout: 3000 })

    // 自动续费开关（付款信息卡右上角）
    const autoRenewSwitch = screen.getByRole('switch')
    await userEvent.click(autoRenewSwitch)

    // 请求 specific_info 并展示确认信息（官方 autoRenew 组件）
    expect(spy).toHaveBeenCalledWith(17)
    await screen.findByText(/请确认您将为以下产品开启自动续费/, {}, { timeout: 3000 })
    expect(screen.getByText('17')).toBeTruthy()
    expect(screen.getByText('ser8830400096')).toBeTruthy()
    expect(screen.getByText(/3\.6.*月付/)).toBeTruthy()
    expect(screen.getAllByText('2026-09-07 10:04').length).toBeGreaterThan(0)
  })
})

describe('CloudDetailPage 退订（IdcsmartRefund）', () => {
  beforeEach(() => {
    ;(window as { __CLIENT_CONFIG__?: unknown }).__CLIENT_CONFIG__ = {
      addons: [{ name: 'IdcsmartRefund' }],
    }
    // jsdom 缺少 Pointer Capture，Radix Select 点击展开需要
    Object.defineProperty(Element.prototype, 'hasPointerCapture', {
      writable: true,
      value: () => false,
    })
    Object.defineProperty(Element.prototype, 'setPointerCapture', {
      writable: true,
      value: () => {},
    })
    Object.defineProperty(Element.prototype, 'releasePointerCapture', {
      writable: true,
      value: () => {},
    })
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      writable: true,
      value: () => {},
    })
  })

  it('Active 产品展示退订按钮，点击打开申请弹窗并显示金额明细', async () => {
    const api = await import('@/api')
    // 恢复云产品默认 mock（避免 DCIM 用例的覆盖泄漏）
    vi.mocked(api.fetchHostDetail).mockResolvedValue({
      status: 200,
      msg: 'ok',
      data: {
        host: {
          id: 17,
          product_name: '高质量云电脑 2核 2GB A型',
          status: 'Active',
          billing_cycle: 'monthly',
          due_time: 1777881600,
          active_time: 1746000000,
          renew_amount: '59.00',
        },
        self_defined_field: [],
      },
    })
    vi.mocked(api.fetchHostRefundInfo).mockResolvedValue({
      status: 200,
      msg: 'ok',
      data: { refund: null },
    })
    vi.mocked(api.fetchRefundPage).mockResolvedValue({
      status: 200,
      msg: 'ok',
      data: {
        allow_refund: 1,
        reason_custom: 0,
        reasons: [{ id: 1, content: '不想用了' }],
        host: {
          create_time: 1746000000,
          first_payment_amount: '59.00',
          base_amount: '50.00',
          service_fee: '2.00',
          amount: '48.00',
        },
        show_refund_method: 0,
      },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <CloudDetailPage hostId={17} commonData={undefined} />
      </QueryClientProvider>
    )

    await screen.findAllByText('高质量云电脑 2核 2GB A型', {}, { timeout: 3000 })

    // 退订按钮（官方 unsubscribe）
    const refundBtn = screen.getByRole('button', { name: '退订' })
    await userEvent.click(refundBtn)

    // 弹窗：产品信息 + 金额明细（原因下拉需展开 Select 才挂载）
    await screen.findByText('产品信息', {}, { timeout: 3000 })
    expect(screen.getByText(/48\.00/)).toBeTruthy()
    const reasonSelect = screen.getAllByRole('combobox')[0]
    await userEvent.click(reasonSelect)
    await screen.findByText('不想用了', {}, { timeout: 3000 })
  })

  it('已有退订申请（Suspending）时展示状态与取消退订按钮', async () => {
    const api = await import('@/api')
    vi.mocked(api.fetchHostDetail).mockResolvedValue({
      status: 200,
      msg: 'ok',
      data: {
        host: {
          id: 17,
          product_name: '高质量云电脑 2核 2GB A型',
          status: 'Active',
          billing_cycle: 'monthly',
          due_time: 1777881600,
          active_time: 1746000000,
          renew_amount: '59.00',
        },
        self_defined_field: [],
      },
    })
    vi.mocked(api.fetchHostRefundInfo).mockResolvedValue({
      status: 200,
      msg: 'ok',
      data: {
        refund: {
          id: 7,
          amount: 0,
          type: 'Immediate',
          status: 'Suspending',
          create_time: 1746000000,
        },
      },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <CloudDetailPage hostId={17} commonData={undefined} />
      </QueryClientProvider>
    )

    await screen.findAllByText('高质量云电脑 2核 2GB A型', {}, { timeout: 3000 })

    expect(await screen.findByText('待停用', {}, { timeout: 3000 })).toBeTruthy()
    expect(
      await screen.findByRole('button', { name: '取消退订' }, { timeout: 3000 })
    ).toBeTruthy()
  })
})
