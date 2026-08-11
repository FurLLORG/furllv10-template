import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react'
import { cn } from '@/lib/utils'
import {
  buildLegacyGoodsConfig,
  legacyGoodsUrl,
  writeLegacyGoodsConfig,
  type LegacyOrderResult,
} from '@/lib/legacy-goods'

/** 提交超时：模块校验不过会在 iframe 内弹窗且不回调，超时后由 React 提示完善配置 */
const SUBMIT_TIMEOUT = 10000

export interface LegacyGoodsHandle {
  /**
   * 发送官方 iframeBuy postMessage 协议：模块校验配置后回传 {type:"iframeBuy",
   * params, price}，resolve 为最终订单参数；校验失败/超时 reject。
   */
  submit: (action: 'cart' | 'buy') => Promise<LegacyOrderResult>
}

interface LegacyGoodsProps {
  productId: number
  /** 购物车编辑模式（官方 goods.htm?change=true，模块从 sessionStorage.product_information 回填） */
  change: boolean
  editName: string
  commonData: Record<string, unknown> | undefined
  /** 自适应高度：父容器为 flex 布局时用 flex-1 min-h-0 撑满剩余空间（内部滚动，整页不滚动） */
  className?: string
}

/**
 * 未适配商品配置页的官方兼容渲染：iframe 真实跳转静态壳页 legacy-goods.html?id=<productId>。
 *
 * 壳页复刻官方 goods.php，官方 goods.js 在 iframe 内自行拉取 /product/:id/config_option
 * 并 jQuery 注入模块选配 HTML（模块自带 Vue2 脚本在独立 document 渲染）。官方模块自带的
 * 购买/加购按钮被壳 CSS 隐藏，动作由父页面 React 按钮触发：postMessage {type:"iframeBuy"}
 * → 模块校验并回传 {type:"iframeBuy", params, price}（见 LegacyGoodsHandle.submit）。
 *
 * 顶栏/侧边栏/切换商品由 FurLLV10 React 布局提供，本组件只占主内容区。
 * 运行时配置（addons/system_version/theme_color/__LANG_CONFIG__/commonData）在跳转前写入
 * 同源 sessionStorage，由 legacy-goods.html 读取（common_set_before 由壳页写入 localStorage）。
 */
export const LegacyGoods = forwardRef<LegacyGoodsHandle, LegacyGoodsProps>(
  function LegacyGoods(
    { productId, change, editName, commonData, className },
    ref
  ) {
    const iframeRef = useRef<HTMLIFrameElement>(null)
    const pendingRef = useRef<{
      action: 'cart' | 'buy'
      promise: Promise<LegacyOrderResult>
      resolve: (result: LegacyOrderResult) => void
      reject: (reason: Error) => void
      timer: ReturnType<typeof setTimeout>
    } | null>(null)
    // commonData 经 ref 读取：react-query 重取会让引用变化，但不应触发 iframe 重载
    const commonDataRef = useRef(commonData)
    commonDataRef.current = commonData

    const url = useMemo(
      () => legacyGoodsUrl(productId, change, editName),
      [productId, change, editName]
    )

    useLayoutEffect(() => {
      // 配置写入完成后再跳转（goods.js/模块 js 依赖 common_set_before），避免首帧加载竞态
      writeLegacyGoodsConfig(
        buildLegacyGoodsConfig(productId, commonDataRef.current)
      )
      iframeRef.current?.setAttribute('src', url)
    }, [productId, url])

    // 监听模块 iframeBuy 回传：{type:"iframeBuy", params, price}
    useLayoutEffect(() => {
      function handleMessage(event: MessageEvent) {
        const data = event.data
        if (!data || typeof data !== 'object' || data.type !== 'iframeBuy') return
        if (!data.params) return
        const pending = pendingRef.current
        if (!pending) return
        pendingRef.current = null
        clearTimeout(pending.timer)
        pending.resolve({ params: data.params, price: data.price })
      }
      window.addEventListener('message', handleMessage)
      return () => window.removeEventListener('message', handleMessage)
    }, [])

    useImperativeHandle(ref, () => ({
      submit(action) {
        if (pendingRef.current) return pendingRef.current.promise
        const win = iframeRef.current?.contentWindow
        if (!win) {
          return Promise.reject(new Error('配置页未加载完成，请稍后重试'))
        }
        let resolve!: (result: LegacyOrderResult) => void
        let reject!: (reason: Error) => void
        const promise = new Promise<LegacyOrderResult>((res, rej) => {
          resolve = res
          reject = rej
        })
        const timer = setTimeout(() => {
          if (pendingRef.current) {
            pendingRef.current = null
            reject(new Error('配置未提交，请检查选配项'))
          }
        }, SUBMIT_TIMEOUT)
        pendingRef.current = { action, promise, resolve, reject, timer }
        win.postMessage({ type: 'iframeBuy', action }, '*')
        return promise
      },
    }))

    return (
      <iframe
        ref={iframeRef}
        title='官方产品配置'
        className={cn(
          'block min-h-0 w-full flex-1 border-0 bg-background',
          className
        )}
      />
    )
  }
)
