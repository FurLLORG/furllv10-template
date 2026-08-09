import type { AuthNode } from '@/api'

/** 节点勾选状态 */
export interface TreeItemState {
  checked: boolean
  indeterminate: boolean
  disabled: boolean
}

function flatten(nodes: AuthNode[], map: Map<number, AuthNode> = new Map()): Map<number, AuthNode> {
  for (const node of nodes) {
    map.set(node.id, node)
    if (node.child?.length) flatten(node.child, map)
  }
  return map
}

/** 收集节点（含自身）下所有叶子节点 id */
function leafIds(node: AuthNode, acc: number[] = []): number[] {
  if (node.child?.length) {
    for (const child of node.child) leafIds(child, acc)
  } else {
    acc.push(node.id)
  }
  return acc
}

/**
 * 递归计算整棵树的勾选状态。
 * - 叶子：命中 selected 集合 → 勾选
 * - 父节点：子节点全部勾选 → 勾选；部分勾选 → 半选；否则未勾选
 * - 强制勾选节点（官方「概要」）始终勾选
 */
export function computeStateMap(
  nodes: AuthNode[],
  selected: Set<number>,
  forced: Set<number>,
  map: Map<number, TreeItemState> = new Map()
): Map<number, TreeItemState> {
  for (const node of nodes) {
    if (node.child?.length) {
      for (const child of node.child) computeStateMap([child], selected, forced, map)
      const children = node.child.map((child) => map.get(child.id))
      const allChecked = children.every((s) => s?.checked)
      const anyActive = children.some((s) => s && (s.checked || s.indeterminate))
      map.set(node.id, {
        checked: allChecked || forced.has(node.id),
        indeterminate: !allChecked && anyActive,
        disabled: forced.has(node.id),
      })
    } else {
      map.set(node.id, {
        checked: selected.has(node.id) || forced.has(node.id),
        indeterminate: false,
        disabled: forced.has(node.id),
      })
    }
  }
  return map
}

/** 收集所有「已勾选或半选」的节点 id（官方 checkedKeys + halfCheckedKeys 等价物） */
export function collectActiveIds(
  nodes: AuthNode[],
  selected: Set<number>,
  forced: Set<number>
): number[] {
  const map = computeStateMap(nodes, selected, forced)
  const ids: number[] = []
  const walk = (list: AuthNode[]) => {
    for (const node of list) {
      const s = map.get(node.id)
      if (s && (s.checked || s.indeterminate)) ids.push(node.id)
      if (node.child?.length) walk(node.child)
    }
  }
  walk(nodes)
  return ids
}

/** 单个节点 toggle：切换其下全部叶子（含自身为叶子时）的选中态 */
export function toggleLeafSelection(
  node: AuthNode,
  selected: Set<number>,
  setSelected: (next: Set<number>) => void
): void {
  const leaves = leafIds(node)
  const allSelected = leaves.every((id) => selected.has(id))
  const next = new Set(selected)
  for (const id of leaves) {
    if (allSelected) next.delete(id)
    else next.add(id)
  }
  setSelected(next)
}

/** 回显：把已保存的 auth id 中属于叶子的节点写入 selected */
export function hydrateSelection(
  nodes: AuthNode[],
  authIds: number[] | undefined
): Set<number> {
  const selected = new Set<number>()
  if (!authIds?.length) return selected
  const map = flatten(nodes)
  const authSet = new Set(authIds)
  for (const [id, node] of map) {
    if (!authSet.has(id)) continue
    // 只存叶子 id，父节点状态由子树推导（官方保存的 auth 含半选父节点）
    if (!node.child?.length) selected.add(id)
  }
  return selected
}

/** 找到「概要」节点 id 并收集其父链（官方 disabledFn + defaultID 逻辑） */
export function findForceOutline(nodes: AuthNode[]): Set<number> {
  const map = flatten(nodes)
  const outline = [...map.values()].find((node) => node.title === '概要')
  if (!outline) return new Set()
  const forced = new Set<number>()
  let current: AuthNode | undefined = outline
  while (current) {
    forced.add(current.id)
    current = current.parent_id ? map.get(current.parent_id) : undefined
  }
  return forced
}
