import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AutoRenewSwitch } from '@/features/client/module-host-list'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'

vi.mock('@/api', () => ({
  fetchCommon: vi.fn().mockResolvedValue({
    status: 200,
    msg: 'ok',
    data: { currency_prefix: '¥' },
  }),
  fetchHostSpecificInfo: vi.fn().mockResolvedValue({
    status: 200,
    msg: 'ok',
    data: {
      id: 17,
      name: 'ser8830400096',
      renew_amount: '3.60',
      billing_cycle_name: '月付',
      due_time: 1788746674,
    },
  }),
  updateHostRenewAuto: vi.fn().mockResolvedValue({
    status: 200,
    msg: 'ok',
  }),
  getErrorMessage: (e: unknown) => (e as Error)?.message || 'error',
  api: {},
}))

describe('AutoRenewSwitch 点击弹窗按钮不应触发行点击', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
  })

  it('点击确定/取消后行 onClick 不应被触发', async () => {
    const rowClick = vi.fn()
    render(
      <QueryClientProvider client={queryClient}>
        <Table>
          <TableBody>
            <TableRow onClick={rowClick}>
              <TableCell>
                <AutoRenewSwitch
                  hostId={17}
                  isAutoRenew={false}
                  onUpdated={() => {}}
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </QueryClientProvider>
    )

    const toggle = screen.getByRole('switch')
    await userEvent.click(toggle)
    expect(rowClick).not.toHaveBeenCalled()

    await screen.findByText(/请确认您将为以下产品开启自动续费/)

    await userEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(rowClick).not.toHaveBeenCalled()

    await userEvent.click(toggle)
    await screen.findByText(/请确认您将为以下产品开启自动续费/)
    await userEvent.click(screen.getByRole('button', { name: '确定' }))
    expect(rowClick).not.toHaveBeenCalled()
  })
})
