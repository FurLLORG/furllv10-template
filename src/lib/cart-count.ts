const CART_NUM_KEY = 'cartNum'
const CART_NUM_EVENT = 'furll:cart-num-changed'

function dispatchCartNumChanged(value: string) {
  const count = Number(String(value).split('-')[1]) || 0
  window.dispatchEvent(new CustomEvent(CART_NUM_EVENT, { detail: count }))
}

/**
 * 写入购物车数量（官方格式 localStorage.cartNum = "cartNum-<count>"），
 * 并派发事件让顶栏购物车角标即时刷新
 */
export function setCartCount(count: number) {
  const value = `cartNum-${count}`
  try {
    localStorage.setItem(CART_NUM_KEY, value)
  } catch {
    /* 隐私模式等写入失败时仅靠事件通知 */
  }
  dispatchCartNumChanged(value)
}

let patched = false

/**
 * 官方 goods.js 同款：patch localStorage.setItem。
 * 官方插件/其他标签页写入 cartNum 时捕获变化并回调
 */
function patchSetItem() {
  if (patched) return
  patched = true
  const original = localStorage.setItem.bind(localStorage)
  localStorage.setItem = function (key: string, newValue: string) {
    if (key === CART_NUM_KEY && newValue) {
      dispatchCartNumChanged(newValue)
    }
    return original(key, newValue)
  }
}

/**
 * 监听购物车数量变化（本 SPA 的 setCartCount + 官方插件写入 + 其他标签页 storage 事件）。
 * 返回取消订阅函数
 */
export function watchCartNumChanges(onChange: (count: number) => void) {
  patchSetItem()
  const handler = (e: Event) => {
    onChange((e as CustomEvent<number>).detail ?? 0)
  }
  const storageHandler = () => {
    onChange(Number(localStorage.getItem(CART_NUM_KEY)?.split('-')[1]) || 0)
  }
  window.addEventListener(CART_NUM_EVENT, handler)
  window.addEventListener('storage', storageHandler)
  return () => {
    window.removeEventListener(CART_NUM_EVENT, handler)
    window.removeEventListener('storage', storageHandler)
  }
}
