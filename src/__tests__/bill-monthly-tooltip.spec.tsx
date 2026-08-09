// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BillMonthlyChart } from '@/features/client/bill-monthly-chart'

afterEach(() => {
  cleanup()
})

vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return {
    ...actual,
    fetchBillMonthly: vi.fn().mockResolvedValue({
      status: 200,
      msg: 'ok',
      data: {
        months: [
          { month: '2026-01', paid: '100.00', unpaid: '50.00' },
          { month: '2026-02', paid: '200.50', unpaid: '0.00' },
          { month: '2026-03', paid: '0.00', unpaid: '30.00' },
        ],
      },
    }),
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
})

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

describe('BillMonthlyChart tooltip', () => {
  it('tooltip 显示系列名称（已支付/未支付）+ 金额', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BillMonthlyChart />
      </QueryClientProvider>
    )

    // 等待数据加载渲染出柱状图
    await screen.findByText('1月', {}, { timeout: 3000 })
    const chart = document.querySelector('[data-slot="chart"]')
    expect(chart).toBeTruthy()
    const svg = chart!.querySelector('svg')!

    // 依次 hover 多个位置，任意位置应同时出现「已支付」与 ¥ 金额
    let found = false
    let lastBody = ''
    for (const x of [60, 120, 180, 240]) {
      fireEvent.mouseMove(svg, { clientX: x, clientY: 100 })
      await new Promise((r) => setTimeout(r, 120))
      lastBody = document.body.textContent ?? ''
      if (lastBody.includes('已支付') && lastBody.includes('¥')) {
        found = true
        break
      }
    }
    expect(found, lastBody).toBe(true)
  })
})
