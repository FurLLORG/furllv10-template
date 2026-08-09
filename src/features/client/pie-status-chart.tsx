import { useState } from 'react'
import { Cell, Pie, PieChart } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

export interface PieDatum {
  name: string
  value: number
  status: string
  pct: number
}

const STATUS_COLORS: Record<string, string> = {
  Active: '#10b981',
  Suspended: '#f97316',
  Pending: '#3b82f6',
  Unpaid: '#f59e0b',
  Deleted: '#9ca3af',
}

const chartConfig = Object.fromEntries(
  Object.entries(STATUS_COLORS).map(([status, color]) => [
    status,
    { label: status, color },
  ])
) satisfies ChartConfig

/**
 * 产品状态分布环形图（shadcn chart 风格）
 * - 中心显示产品总数，hover 扇区高亮、其余淡化
 * - tooltip 显示「N 个 · X%」，颜色取自状态语义色
 * - 图例（含点击隐藏）由父级 home.tsx 渲染
 */
export function PieStatusChart({
  data,
  total,
}: {
  data: PieDatum[]
  total: number
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  return (
    <div className='relative w-full min-w-0 flex-1'>
      <ChartContainer
        config={chartConfig}
        className='mx-auto aspect-square max-h-[280px] w-full max-w-[280px]'
      >
        <PieChart>
          <Pie
            data={data}
            dataKey='value'
            nameKey='name'
            cx='50%'
            cy='50%'
            innerRadius={70}
            outerRadius={100}
            paddingAngle={2}
            rootTabIndex={-1}
            stroke='hsl(var(--background))'
            strokeWidth={2}
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            {data.map((entry, index) => (
              <Cell
                key={entry.status}
                fill={STATUS_COLORS[entry.status]}
                fillOpacity={
                  activeIndex == null || activeIndex === index ? 0.9 : 0.35
                }
              />
            ))}
          </Pie>
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name, item) => {
                  const datum = item.payload as PieDatum
                  return (
                    <div className='flex w-full items-center justify-between gap-4'>
                      <span className='text-muted-foreground'>
                        {name ?? datum.name}
                      </span>
                      <span className='font-mono font-medium tabular-nums'>
                        {value} 个 · {datum.pct}%
                      </span>
                    </div>
                  )
                }}
              />
            }
          />
        </PieChart>
      </ChartContainer>
      <div className='pointer-events-none absolute inset-0 flex flex-col items-center justify-center'>
        <span className='text-2xl font-bold'>{total}</span>
        <span className='text-xs text-muted-foreground'>产品总数</span>
      </div>
    </div>
  )
}
