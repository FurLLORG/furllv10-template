import { useMemo } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import type { AuthNode } from '@/api'
import { computeStateMap } from './auth-logic'

export interface AuthTreeProps {
  /** 树形数据（官方 /auth 返回 list 中的一段） */
  nodes: AuthNode[]
  /** 强制勾选节点 id 集合（官方「概要」及其父链） */
  forced?: Set<number>
  /** 已选叶子节点 id 集合（受控） */
  selected: Set<number>
  onToggle: (node: AuthNode) => void
  className?: string
}

/**
 * 子账户权限勾选树（官方 el-tree show-checkbox 等价物）。
 * - 递归渲染，默认全部展开
 * - 点击节点 checkbox 级联勾选/取消其下所有叶子
 * - 强制勾选节点（概要）禁用且始终选中
 * - 受控 selected 集合只存叶子 id，父节点状态由子树推导
 */
export function AuthTree({ nodes, forced, selected, onToggle, className }: AuthTreeProps) {
  const stateMap = useMemo(
    () => computeStateMap(nodes, selected, forced ?? new Set()),
    [nodes, selected, forced]
  )

  function render(nodes: AuthNode[], depth: number) {
    return nodes.map((node) => {
      const state = stateMap.get(node.id) ?? {
        checked: false,
        indeterminate: false,
        disabled: false,
      }
      return (
        <div key={node.id}>
          <label
            className={cn(
              'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
              state.disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-accent'
            )}
            style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
          >
            <Checkbox
              checked={state.indeterminate ? 'indeterminate' : state.checked}
              disabled={state.disabled}
              onCheckedChange={() => onToggle(node)}
            />
            <span className='text-foreground'>{node.title}</span>
          </label>
          {node.child?.length ? render(node.child, depth + 1) : null}
        </div>
      )
    })
  }

  return <div className={cn('space-y-0.5', className)}>{render(nodes, 0)}</div>
}
