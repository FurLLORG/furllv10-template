import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { RemfConfigOptionItem } from '@/api'

/**
 * 官方 10.7.2 系统图标目录（mf_finance 客户端模板，随系统源码分发）。
 * 系统值（如 CentOS / Ubuntu / TencentOS-Server）直接对应目录下的 SVG 文件名，
 * 与官方 goods.html 的 :src="`...remf_finance/${sub.value}.svg`" 一致。
 */
const SYSTEM_ICON_DIR =
  '/plugins/reserver/mf_finance/template/clientarea/pc/default/img/remf_finance'

interface SystemIconProps {
  value: string
  icoUrl?: string
  className?: string
}

/**
 * 系统图标：优先后端返回的 ico_url，缺失或加载失败时回退官方 SVG 目录，
 * 兜底失败则隐藏（不占位破版）。
 */
export function SystemIcon({ value, icoUrl, className }: SystemIconProps) {
  const [stage, setStage] = useState(0)
  const candidates = [
    ...(icoUrl ? [icoUrl] : []),
    `${SYSTEM_ICON_DIR}/${value}.svg`,
  ]
  if (stage >= candidates.length) return null
  return (
    <img
      src={candidates[stage]}
      alt=''
      loading='lazy'
      onError={() => setStage((s) => s + 1)}
      className={className}
    />
  )
}

interface SystemSelectorProps {
  item: RemfConfigOptionItem
  curSystem: string
  version: number | string | undefined
  onSystemChange: (system: string) => void
  onVersionChange: (versionId: number) => void
}

/**
 * 镜像（操作系统）选择器：参考官方 10.7.2 双下拉做法 + 自定义下拉样式。
 * 触发器 = 系统 icon + 名称（上行）+ 当前版本 + 箭头（下行）；
 * 菜单 = 系统列表（icon + 名称 + 对勾）+ 当前系统版本列表（对勾标记选中）。
 */
export function SystemSelector({
  item,
  curSystem,
  version,
  onSystemChange,
  onVersionChange,
}: SystemSelectorProps) {
  const group = item.sub as Record<
    string,
    { child: Array<{ id: number; version: string }>; ico_url?: string }
  >
  const systemArr =
    item.systemArr ?? Object.keys(group).map((value) => ({ value, label: value }))
  const currentGroup = group[curSystem]
  const currentVersion = currentGroup?.child.find((v) => v.id === Number(version))

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type='button'
          className='flex w-full flex-col gap-1.5 rounded-md border-2 border-primary/50 bg-primary/5 px-3 py-2 text-left transition-colors hover:bg-primary/10'
        >
          <span className='flex items-center gap-2'>
            <SystemIcon
              value={curSystem}
              icoUrl={currentGroup?.ico_url}
              className='h-[18px] w-[18px] shrink-0'
            />
            <span className='truncate text-sm text-foreground'>{curSystem}</span>
          </span>
          <span className='flex items-center justify-between gap-2'>
            <span className='truncate text-sm text-muted-foreground'>
              {currentVersion?.version ?? '请选择版本'}
            </span>
            <ChevronDown className='h-4 w-4 shrink-0 text-muted-foreground' />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align='start' className='w-80 p-0'>
        <div className='max-h-80 overflow-y-auto p-1.5'>
          {systemArr.map((sys) => {
            const sysGroup = group[sys.value]
            const sysActive = sys.value === curSystem
            return (
              <button
                key={sys.value}
                type='button'
                onClick={() => onSystemChange(sys.value)}
                className={cn(
                  'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors',
                  sysActive
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-foreground hover:bg-muted'
                )}
              >
                <span className='flex w-4 shrink-0 justify-center'>
                  {sysActive && <Check className='h-3.5 w-3.5' />}
                </span>
                <SystemIcon
                  value={sys.value}
                  icoUrl={sysGroup?.ico_url}
                  className='h-4 w-4 shrink-0'
                />
                <span className='truncate'>{sys.label}</span>
              </button>
            )
          })}

          <div className='mx-1 my-1.5 border-t border-border/70' />

          {(currentGroup?.child ?? []).map((ver) => {
            const verActive = ver.id === Number(version)
            return (
              <button
                key={ver.id}
                type='button'
                onClick={() => onVersionChange(ver.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors',
                  verActive
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <span className='flex w-4 shrink-0 justify-center'>
                  {verActive && <Check className='h-3.5 w-3.5' />}
                </span>
                <span className='truncate'>{ver.version}</span>
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
