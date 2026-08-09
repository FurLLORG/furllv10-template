import { create } from 'zustand'

export type CartSidebarMode = 'groups' | 'user'

interface CartSidebarState {
  /** null = 用户未手动选择，按页面默认：goodsList 默认产品分组，其他页面默认用户中心 */
  mode: CartSidebarMode | null
  setMode: (mode: CartSidebarMode) => void
}

// ClientLayout 在进入新页面时重置为 null，保证每次进 goodsList 都默认产品分组；
// 手动切换仅对当前页面生效

export const useCartSidebarStore = create<CartSidebarState>()((set) => ({
  mode: null,
  setMode: (mode) => set({ mode }),
}))
