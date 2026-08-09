// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CloudDetailPage } from '@/features/client/cloud-detail'

// 回归测试：官方 chart API 的 time 是字符串 "YYYY-MM-DD HH:mm:ss"，
// 若被 Number() 解析成 NaN → 全部点 time 变 '--' → category 轴去重后只剩 1 点，
// hover 永远匹配首条数据（value=0）→ tooltip 恒显示 0
const ZH_LANG: Record<string, string> = {
  common_cloud_tab1: '统计图表',
  common_cloud_text73: 'CPU占用量',
  common_cloud_text74: '占用量(%)',
  common_cloud_text83: '内存用量',
}

vi.mock('@/hooks/use-module-lang', () => ({
  useModuleLang: () => ({
    t: (key: string) => ZH_LANG[key] ?? key,
    lang: ZH_LANG,
    isLoading: false,
    error: null,
  }),
}))

afterEach(() => {
  cleanup()
})

// 用户真实返回：10 分钟一条、time 为字符串、首条 value 为 0、中间有非零峰值
const CPU_SERIES = [
  { time: '2026-08-07 10:00:00', value: 0 },
  { time: '2026-08-07 10:10:00', value: 0.2 },
  { time: '2026-08-07 15:40:00', value: 49.95 },
  { time: '2026-08-07 15:50:00', value: 15.38 },
  { time: '2026-08-07 16:00:00', value: 0.1 },
  { time: '2026-08-07 19:00:00', value: 0.2 },
]
const MEM_TOTAL = CPU_SERIES.map((s) => ({ ...s, value: s.value ? 1.92 : 0 }))
const MEM_USED = CPU_SERIES.map((s) => ({ ...s, value: s.value ? 0.36 : 0 }))

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
          product_name: '云主机',
          name: 'svc-001',
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
        host_data: {},
        config_options: [],
        cloud_os_group: [{ id: 1, name: 'CentOS' }],
        cloud_os: [{ id: 11, group: 1, name: '7.6' }],
        system_button: {},
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
    fetchCloudChart: vi.fn().mockImplementation(
      (_ns: string, _id: number, params: { type: string }) => {
        if (params.type === 'memory') {
          return Promise.resolve({
            status: 200,
            msg: 'ok',
            data: {
              unit: 'GB',
              chart_type: 'bar',
              label: ['总量(GB)', '已用(GB)'],
              list: [MEM_TOTAL, MEM_USED],
            },
          })
        }
        return Promise.resolve({
          status: 200,
          msg: 'ok',
          data: { unit: '%', chart_type: 'area', label: ['CPU使用率(%)'], list: [CPU_SERIES] },
        })
      }
    ),
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

describe('监控图 tooltip（真实字符串 time 数据）', () => {
  it('CPU 图 hover 显示非零真实值而非恒 0', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <CloudDetailPage hostId={17} commonData={undefined} />
      </QueryClientProvider>
    )
    await screen.findAllByText('云主机', {}, { timeout: 3000 })

    await userEvent.click(screen.getByRole('tab', { name: '统计图表' }))
    await new Promise((r) => setTimeout(r, 700))

    const chart = document.querySelector('[data-slot="chart"]')
    expect(chart).toBeTruthy()
    const svg = chart!.querySelector('svg')!

    // 依次 hover CPU 图多个位置，任一位置应出现非零值（49.95 / 15.38）
    let foundNonZero = false
    for (const x of [80, 160, 240]) {
      fireEvent.mouseMove(svg, { clientX: x, clientY: 100 })
      await new Promise((r) => setTimeout(r, 120))
      const body = document.body.textContent ?? ''
      if (body.includes('49.95') || body.includes('15.38')) {
        foundNonZero = true
        break
      }
    }
    expect(foundNonZero, document.body.textContent ?? '').toBe(true)
  })

  it('内存图 hover 显示已用量（0.36）而非恒 0', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <CloudDetailPage hostId={17} commonData={undefined} />
      </QueryClientProvider>
    )
    await screen.findAllByText('云主机', {}, { timeout: 3000 })

    await userEvent.click(screen.getByRole('tab', { name: '统计图表' }))
    await new Promise((r) => setTimeout(r, 700))

    // 内存图是第 3 个 chart（CPU/硬盘IO/内存/网卡）
    const charts = document.querySelectorAll('[data-slot="chart"]')
    expect(charts.length).toBeGreaterThanOrEqual(3)
    const svg = charts[2]!.querySelector('svg')!

    let foundUsed = false
    for (const x of [80, 160, 240]) {
      fireEvent.mouseMove(svg, { clientX: x, clientY: 100 })
      await new Promise((r) => setTimeout(r, 120))
      const body = document.body.textContent ?? ''
      if (body.includes('0.36')) {
        foundUsed = true
        break
      }
    }
    expect(foundUsed, document.body.textContent ?? '').toBe(true)
  })
})
