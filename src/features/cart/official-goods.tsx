/**
 * 官方解析方式的配置页渲染：React 自己取 `/product/:id/config_option`，
 * 把 `data.content` 的 HTML 注入宿主 `.config-box .content`，再按官方方式执行其内嵌脚本。
 *
 * 与旧实现的区别：不再跳转 `FurllHome` 的 `/furll_home/default-cart-goods` 壳（iframe），
 * 官方 Vue2 模块直接渲染在当前 document 内的宿主容器里，切换商品无需整页刷新。
 *
 * 顶栏/侧边栏/切换商品仍由 React 布局提供；官方模块自带的购买/加购按钮被覆盖表隐藏，
 * 动作由 React 按钮经官方 `iframeBuy` postMessage 协议触发（同文档下 `window.parent === window`）。
 */
import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import {
  buildLegacyGoodsConfig,
  writeLegacyGoodsConfig,
  type LegacyOrderResult,
} from '@/lib/legacy-goods'
import { stripDocumentLevelRules } from '@/lib/official-css'
import {
  disposeOfficialContent,
  mountOfficialContent,
} from '@/lib/official-content'
import {
  ensureOfficialRuntime,
  getOfficialTheme,
  OFFICIAL_HOST_CLASS,
} from '@/lib/official-runtime'
import { cn } from '@/lib/utils'
import { applyOfficialDomPatches } from '@/features/cart/official-dom-patches'
import iframeStyles from './legacy-goods-iframe.css?raw'
import './official-goods.css'

/** 提交超时：模块校验不过会弹窗且不回调，超时后由 React 提示完善配置 */
const SUBMIT_TIMEOUT = 10000

export interface OfficialGoodsHandle {
  /**
   * 发送官方 iframeBuy postMessage 协议：模块校验配置后回传 {type:"iframeBuy",
   * params, price}，resolve 为最终订单参数；校验失败/超时 reject。
   */
  submit: (action: 'cart' | 'buy') => Promise<LegacyOrderResult>
}

interface PendingSubmit {
  promise: Promise<LegacyOrderResult>
  resolve: (result: LegacyOrderResult) => void
  reject: (reason: Error) => void
  timer: ReturnType<typeof setTimeout>
}

interface OfficialGoodsProps {
  productId: number
  /** 官方 `/product/:id/config_option` 返回的 `data.content` HTML */
  content: string | undefined
  commonData: Record<string, unknown> | undefined
  /** 自适应高度：父容器为 flex 布局时用 flex-1 min-h-0 撑满剩余空间 */
  className?: string
}

export const OfficialGoods = forwardRef<
  OfficialGoodsHandle,
  OfficialGoodsProps
>(function OfficialGoods({ productId, content, commonData, className }, ref) {
  const hostRef = useRef<HTMLDivElement>(null)
  const readyRef = useRef(false)
  const pendingRef = useRef<PendingSubmit | null>(null)
  const [error, setError] = useState<string | null>(null)
  // commonData 经 ref 读取：react-query 重取会让引用变化，但不应触发重新注入
  const commonDataRef = useRef(commonData)
  commonDataRef.current = commonData

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    let releasePatches: (() => void) | null = null
    readyRef.current = false

    // 官方 goods.js 与模块 js 从 localStorage.common_set_before 取币种/开关，先写再注入
    writeLegacyGoodsConfig(
      buildLegacyGoodsConfig(productId, commonDataRef.current)
    )
    // 官方 header.php:2 把主题挂在 html 上；同文档注入挂宿主，作用域 CSS 才匹配得到
    host.setAttribute('theme', getOfficialTheme())

    // data.content 还没到（强制官方模式下本组件先于 react-query 渲染）：不挂载也不报错，
    // 内容到达后同一个 effect 会重新注入
    if (!content) return

    void (async () => {
      try {
        await ensureOfficialRuntime()
        if (cancelled) return
        await mountOfficialContent(host, content ?? '')
        if (cancelled) return
        releasePatches = applyOfficialDomPatches(
          document,
          stripDocumentLevelRules(iframeStyles)
        )
        readyRef.current = true
        setError(null)
      } catch (cause) {
        if (cancelled) return
        console.error('[official-goods] 官方配置页加载失败', cause)
        setError(
          cause instanceof Error ? cause.message : '官方配置页加载失败，请稍后重试'
        )
      }
    })()

    return () => {
      cancelled = true
      readyRef.current = false
      releasePatches?.()
      disposeOfficialContent(host)
    }
  }, [productId, content])

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
      if (!readyRef.current) {
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
      pendingRef.current = { promise, resolve, reject, timer }
      window.postMessage({ type: 'iframeBuy', action }, '*')
      return promise
    },
  }))

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      {/* 官方 goods.php 的 body 骨架（aside/top-menu 是触发官方 updated 钩子的壳，这里不需要） */}
      <div ref={hostRef} className={OFFICIAL_HOST_CLASS}>
        <div className='goods'>
          <section className='el-container'>
            <section className='el-container'>
              <main className='el-main'>
                <div className='config-box'>
                  <div className='content' />
                </div>
              </main>
            </section>
          </section>
        </div>
      </div>
      {error && (
        <p className='shrink-0 pt-2 text-sm text-destructive'>{error}</p>
      )}
    </div>
  )
})
