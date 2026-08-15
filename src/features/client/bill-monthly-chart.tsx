import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchBillMonthly } from '@/api'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { cn } from '@/lib/utils'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'

const PAID_COLOR = '#3b82f6'
const UNPAID_COLOR = '#ef4444'

function formatMonthLabel(month: string): string {
  return `${Number(month.slice(5))}月`
}

function formatAmount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(Math.round(n))
}

const chartConfig = {
  paid: {
    label: '已支付',
    color: PAID_COLOR,
  },
  unpaid: {
    label: '未支付',
    color: UNPAID_COLOR,
  },
} satisfies ChartConfig

const SERIES = ['paid', 'unpaid'] as const
type SeriesKey = (typeof SERIES)[number]

/**
 * 账单月度统计（最近 12 个月已支付/未支付金额柱状图）
 * - 数据源 /console/v1/furll_home/bill_monthly，认证与其他 console API 一致（Bearer JWT）
 * - 骨架/空态/图表三态高度固定 260px，避免加载前后高度跳动
 * - 图例可点击：显示/隐藏 已支付/未支付
 */
export function BillMonthlyChart() {
  const query = useQuery({
    queryKey: ['client-bill-monthly'],
    queryFn: fetchBillMonthly,
    retry: false,
  })
  const [hidden, setHidden] = useState<Set<SeriesKey>>(new Set())

  function toggleSeries(key: SeriesKey) {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const months = (query.data?.data.months ?? []).map((m) => ({
    ...m,
    paid: Number(m.paid),
    unpaid: Number(m.unpaid),
    label: formatMonthLabel(m.month),
  }))
  const hasData = months.some((m) => m.paid > 0 || m.unpaid > 0)

  return (
    <div className='h-full min-h-[260px] w-full'>
      {query.isLoading ? (
        <Skeleton className='h-[260px] w-full' />
      ) : !hasData ? (
        <p className='flex h-[260px] items-center justify-center text-sm text-muted-foreground'>
          暂无账单记录
        </p>
      ) : (
        <div className='flex h-[260px] flex-col'>
          <ChartContainer
            config={chartConfig}
            className='min-h-0 w-full flex-1'
          >
            <BarChart data={months} barCategoryGap='28%' barGap={4}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey='label'
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                interval={0}
              />
              <YAxis
                width={44}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => formatAmount(v)}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    formatter={(value, name, item) => {
                      const key = String(item?.dataKey ?? '')
                      const label =
                        (chartConfig as Record<
                          string,
                          { label?: string } | undefined
                        >)[key]?.label ?? name
                      return (
                        <div className='flex w-full items-center justify-between gap-4'>
                          <span className='text-muted-foreground'>{label}</span>
                          <span className='font-mono font-medium tabular-nums'>
                            ¥{Number(value).toFixed(2)}
                          </span>
                        </div>
                      )
                    }}
                  />
                }
              />
              {!hidden.has('paid') && (
                <Bar
                  dataKey='paid'
                  fill='var(--color-paid)'
                  radius={[3, 3, 0, 0]}
                  maxBarSize={16}
                />
              )}
              {!hidden.has('unpaid') && (
                <Bar
                  dataKey='unpaid'
                  fill='var(--color-unpaid)'
                  radius={[3, 3, 0, 0]}
                  maxBarSize={16}
                />
              )}
            </BarChart>
          </ChartContainer>
          <div className='flex items-center justify-center gap-4 pt-3'>
            {SERIES.map((key) => {
              const isHidden = hidden.has(key)
              return (
                <button
                  key={key}
                  type='button'
                  onClick={() => toggleSeries(key)}
                  title={isHidden ? '点击恢复显示' : '点击隐藏'}
                  className={cn(
                    'flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50',
                    isHidden && 'opacity-40'
                  )}
                >
                  <span
                    className='h-2 w-2 shrink-0 rounded-[2px]'
                    style={{ backgroundColor: chartConfig[key].color }}
                  />
                  {chartConfig[key].label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
