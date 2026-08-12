import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react'
import {
  buildLegacyGoodsConfig,
  legacyGoodsUrl,
  writeLegacyGoodsConfig,
  type LegacyOrderResult,
} from '@/lib/legacy-goods'
import { cn } from '@/lib/utils'
import iframeStyles from './legacy-goods-iframe.css?raw'

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

    // iframe 同源时同步最新样式：onLoad 只在 src 变化时触发，HMR 更新 iframeStyles 后
    // 已存在的 iframe 不会重新加载，此 effect 直接把最新 CSS 覆盖进 style 元素
    useLayoutEffect(() => {
      const doc = iframeRef.current?.contentDocument
      if (!doc?.head) return
      let style = doc.getElementById(
        'furll-legacy-goods-style'
      ) as HTMLStyleElement | null
      if (!style) {
        style = doc.createElement('style')
        style.id = 'furll-legacy-goods-style'
        doc.head.append(style)
      }
      style.textContent = iframeStyles
    }, [iframeStyles])

    // 监听模块 iframeBuy 回传：{type:"iframeBuy", params, price}
    useLayoutEffect(() => {
      function handleMessage(event: MessageEvent) {
        const data = event.data
        if (!data || typeof data !== 'object' || data.type !== 'iframeBuy')
          return
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

    function injectIframeStyles() {
      const doc = iframeRef.current?.contentDocument
      if (!doc) return

      const setupFOrderToggle = () => {
        // 仅手机端注入折叠手柄 + 重排价格条（CSS 在桌面端 display:none / 重排不执行）
        if (!doc.defaultView?.matchMedia('(max-width: 750px)').matches) return
        const findFOrder = () =>
          doc.querySelector<HTMLElement>('.goods .f-order')
        let collapsedByDefault = false
        // 价格保留在 .mid 内，放在当前配置 / 配置费用左侧。Vue 重渲染后再次归位。
        const positionBotPrice = () => {
          const fOrder = findFOrder()
          if (!fOrder) return
          const mid = fOrder.querySelector<HTMLElement>('.mid')
          const botPrice = fOrder.querySelector<HTMLElement>('.bot-price')
          if (mid && botPrice && mid.firstElementChild !== botPrice) {
            mid.insertBefore(botPrice, mid.firstChild)
          }
        }
        const syncCollapsed = () => {
          const collapsed =
            findFOrder()?.classList.contains('furll-forder-collapsed') ?? false
          doc
            .querySelector('.goods')
            ?.classList.toggle('furll-goods-forder-collapsed', collapsed)
          return collapsed
        }
        const inject = () => {
          const fOrder = findFOrder()
          if (!fOrder) return
          positionBotPrice()
          if (!fOrder.querySelector('.furll-forder-tip')) {
            const tip = doc.createElement('p')
            tip.className = 'furll-forder-tip'
            tip.textContent = '请在上方选择配置，价格与周期以上方官方配置页显示为准'
            fOrder.insertBefore(tip, fOrder.querySelector('.el-main'))
          }
          if (fOrder.querySelector('.furll-forder-toggle')) return
          const toggle = doc.createElement('button')
          toggle.type = 'button'
          toggle.className = 'furll-forder-toggle'
          toggle.setAttribute('aria-expanded', 'false')
          toggle.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>'
          toggle.addEventListener('click', () => {
            const collapsed = fOrder.classList.toggle('furll-forder-collapsed')
            toggle.setAttribute('aria-expanded', String(!collapsed))
            syncCollapsed()
          })
          fOrder.insertBefore(toggle, fOrder.firstChild)
          // 默认收起：仅露手柄条，点击展开
          if (!collapsedByDefault) {
            fOrder.classList.add('furll-forder-collapsed')
            collapsedByDefault = true
          }
          syncCollapsed()
        }
        inject()
        const observer = new MutationObserver(() => {
          positionBotPrice()
          if (!findFOrder()?.querySelector('.furll-forder-toggle')) inject()
        })
        observer.observe(doc.body, { childList: true, subtree: true })
        doc.defaultView?.addEventListener('resize', positionBotPrice)
      }

      /**
       * 当前配置/配置费用弹窗改点击触发 + 互斥（官方为 el-popover trigger="hover"）。
       * 原理：在 document 捕获阶段 stopImmediatePropagation 拦掉 mouseenter/mouseleave
       * 的传播（事件到不了 reference，Element 的 hover 显隐不生效），再给 reference 绑
       * click 切换显隐；点击一个时先收起其他 cur/free popover。
       */
      let popoverReady = false
      const setupPopoverClick = () => {
        if (popoverReady) return
        popoverReady = true

        const findPopoverPairs = (): {
          pop: HTMLElement
          trigger: HTMLElement
        }[] => {
          const fOrder = doc.querySelector<HTMLElement>('.goods .f-order')
          if (!fOrder) return []
          const pairs: { pop: HTMLElement; trigger: HTMLElement }[] = []
          fOrder
            .querySelectorAll<HTMLElement>('.cur-content, .free-content')
            .forEach((pop) => {
              const trigger = pop.id
                ? doc.querySelector<HTMLElement>(
                    `.el-popover__reference[aria-describedby="${pop.id}"]`
                  )
                : null
              if (pop && trigger) pairs.push({ pop, trigger })
            })
          return pairs
        }

        const blockHover = (e: Event) => {
          const target = e.target as Element
          if (
            target.closest?.('.furll-click-trigger, .furll-click-popover')
          ) {
            e.stopImmediatePropagation()
          }
        }
        doc.addEventListener('mouseenter', blockHover, true)
        doc.addEventListener('mouseleave', blockHover, true)

        const closePopover = (pop: HTMLElement) => {
          pop.classList.add('furll-click-hidden')
        }

        // 点击弹窗外部任意位置收起当前配置/配置费用弹窗
        doc.addEventListener('click', (e) => {
          const target = e.target as Element
          if (target.closest?.('.furll-click-trigger, .furll-click-popover'))
            return
          findPopoverPairs().forEach(({ pop }) => closePopover(pop))
        })

        const bindPair = (pair: {
          pop: HTMLElement
          trigger: HTMLElement
        }) => {
          const { pop, trigger } = pair
          // 双标记：Vue 重渲染重建 trigger 节点时旧标记丢失，需重新绑定
          if (
            pop.dataset.furllClickReady === '1' &&
            trigger.dataset.furllClickReady === '1'
          )
            return
          pop.dataset.furllClickReady = '1'
          trigger.dataset.furllClickReady = '1'
          pop.classList.add('furll-click-popover')
          // 显隐完全走 furll-click-hidden 类（Element UI 初始 inline display:none，
          // 基础规则 display:flex !important 覆盖，隐藏类更高优先级强制隐藏）。
          // 不用 showPopper 控制：Vue watcher 触发 Popper 重定位会把弹层放回原位，
          // 向下溢出 f-order 被 iframe 裁剪。打开时改为手动 position:fixed 钉在
          // 触发元素上方（f-order 固定贴合底部，弹层只会向上展开）。
          pop.classList.add('furll-click-hidden')
          trigger.classList.add('furll-click-trigger')

          const positionAbove = () => {
            const t = trigger.getBoundingClientRect()
            const rect = pop.getBoundingClientRect()
            const vw = doc.documentElement.clientWidth
            const left = Math.max(
              12,
              Math.min(t.left + t.width / 2 - rect.width / 2, vw - rect.width - 12)
            )
            pop.style.position = 'fixed'
            pop.style.top = `${Math.max(12, t.top - rect.height - 8)}px`
            pop.style.left = `${left}px`
            pop.style.bottom = 'auto'
            pop.style.right = 'auto'
            pop.style.margin = '0'
          }
          const setVisibleRef = (el: HTMLElement, visible: boolean) => {
            el.classList.toggle('furll-click-hidden', !visible)
            if (visible) positionAbove()
          }
          const isVisible = () => !pop.classList.contains('furll-click-hidden')

          trigger.addEventListener('click', (e) => {
            e.preventDefault()
            e.stopPropagation()
            // 互斥：先收起其他 cur/free 弹窗
            findPopoverPairs().forEach((other) => {
              if (other.pop === pop) return
              closePopover(other.pop)
            })
            setVisibleRef(pop, !isVisible())
          })
        }

        const pairs = findPopoverPairs()
        if (pairs.length) {
          pairs.forEach(bindPair)
          return
        }
        const observer = new MutationObserver(() => {
          findPopoverPairs().forEach(bindPair)
        })
        observer.observe(doc.body, { childList: true, subtree: true })
      }

      let style = doc.getElementById(
        'furll-legacy-goods-style'
      ) as HTMLStyleElement | null
      if (!style) {
        style = doc.createElement('style')
        style.id = 'furll-legacy-goods-style'
        doc.head.append(style)
      }
      style.textContent = iframeStyles

      const measureDropdowns = () => {
        doc
          .querySelectorAll<HTMLElement>('.op-sysyem .el-select')
          .forEach((select) => {
            const dropdown = select.querySelector<HTMLElement>(
              '.el-select-dropdown'
            )
            const items = dropdown?.querySelectorAll<HTMLElement>(
              '.el-select-dropdown__item'
            )
            if (!dropdown || !items?.length) return

            const measure = doc.createElement('span')
            const itemStyle = getComputedStyle(items[0])
            measure.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:${itemStyle.font};letter-spacing:${itemStyle.letterSpacing};`
            doc.body.append(measure)
            const widest = Math.max(
              ...[...items].map((item) => {
                measure.textContent = item.textContent?.trim() || ''
                return measure.getBoundingClientRect().width
              })
            )

            const padding =
              Number.parseFloat(itemStyle.paddingLeft) +
              Number.parseFloat(itemStyle.paddingRight)
            const menuWidth = Math.min(
              Math.ceil(widest + padding + 2),
              Math.max(
                select.getBoundingClientRect().width,
                doc.documentElement.clientWidth - 32
              )
            )
            const input =
              select.querySelector<HTMLInputElement>('.el-input__inner')
            measure.textContent = input?.value || ''
            const inputWidth = Math.min(
              Math.max(
                Math.ceil(measure.getBoundingClientRect().width + 52),
                select.classList.contains('system') ? 180 : 160
              ),
              doc.documentElement.clientWidth - 32
            )
            select.style.setProperty('--furll-select-width', `${inputWidth}px`)
            dropdown.style.minWidth = `${menuWidth}px`
            dropdown.style.maxWidth = `${doc.documentElement.clientWidth - 32}px`
            measure.remove()
          })
      }

      measureDropdowns()
      requestAnimationFrame(measureDropdowns)

      setupFOrderToggle()
      setupPopoverClick()
    }

    return (
      <iframe
        ref={iframeRef}
        title='官方产品配置'
        className={cn(
          'block min-h-0 w-full flex-1 border-0 bg-background',
          className
        )}
        onLoad={injectIframeStyles}
      />
    )
  }
)
