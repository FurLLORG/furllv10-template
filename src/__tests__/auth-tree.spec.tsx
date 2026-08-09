// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  collectActiveIds,
  findForceOutline,
  hydrateSelection,
  toggleLeafSelection,
} from '@/features/client/sub-account/auth-logic'
import type { AuthNode } from '@/api'

/** 官方 /auth 树形返回结构（含「概要」强制节点 + 产品权限子树） */
const AUTH_TREE: AuthNode[] = [
  {
    id: 1,
    title: '账户信息',
    parent_id: 0,
    child: [
      { id: 2, title: '概要', parent_id: 1 },
      { id: 3, title: '修改资料', parent_id: 1 },
    ],
  },
  {
    id: 4,
    title: '财务',
    parent_id: 0,
    child: [
      { id: 5, title: '余额', parent_id: 4 },
      { id: 6, title: '订单', parent_id: 4 },
    ],
  },
  {
    id: 10,
    title: '产品权限',
    parent_id: 0,
    child: [
      { id: 11, title: '云服务器', parent_id: 10 },
      { id: 12, title: '独立服务器', parent_id: 10 },
    ],
  },
]

describe('auth-tree 权限勾选逻辑', () => {
  it('findForceOutline 收集「概要」节点及其父链', () => {
    const forced = findForceOutline(AUTH_TREE)
    expect([...forced].sort()).toEqual([1, 2])
  })

  it('hydrateSelection 只把已保存 auth 中叶子节点写入选中集', () => {
    // auth 含已勾选叶子 2、3 和半选父节点 1、4
    const selected = hydrateSelection(AUTH_TREE, [1, 2, 3, 4])
    expect([...selected].sort()).toEqual([2, 3])
  })

  it('toggleLeafSelection 勾选父节点级联其下所有叶子', () => {
    let selected = new Set<number>()
    const node = AUTH_TREE[1] // 财务
    toggleLeafSelection(node, selected, (next) => selected = next)
    expect([...selected].sort()).toEqual([5, 6])
    // 再次 toggle 取消
    toggleLeafSelection(node, selected, (next) => selected = next)
    expect(selected.size).toBe(0)
  })

  it('collectActiveIds 收集勾选+半选节点（含强制概要链），不包含未选子树', () => {
    const forced = findForceOutline(AUTH_TREE)
    const selected = new Set([3, 5]) // 修改资料 + 余额
    const active = collectActiveIds(AUTH_TREE, selected, forced)
    // 勾选叶子 3、5 → 父 1 全选（勾选）、父 4 半选；概要 2 强制勾选
    expect(active.sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('collectActiveIds 不勾选时仅含强制概要链', () => {
    const forced = findForceOutline(AUTH_TREE)
    const active = collectActiveIds(AUTH_TREE, new Set(), forced)
    expect(active.sort()).toEqual([1, 2])
  })
})
