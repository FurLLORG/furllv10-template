/**
 * 官方配置页的 DOM 行为补丁（原 `legacy-goods.tsx` 的 `injectIframeStyles` 主体）。
 *
 * 与官方模板的差异都收敛在这里：手机端底部价格条折叠、滑块刻度归位、镜像版本展开、
 * 「当前配置/配置费用」由 hover 改点击、下拉宽度测量，以及官方样式覆盖表注入。
 *
 * 所有查询都走传入的 `doc`，因此同一份代码既服务 iframe 壳（传 `iframe.contentDocument`），
 * 也服务同文档注入（传主 `document`）。
 */

let activeRelease: (() => void) | null = null

/**
 * @param doc 官方页面所在文档（iframe 文档或主文档）
 * @param styles 官方样式覆盖表（`.goods` 作用域）；同文档注入时调用方需先剔除 `html`/`body` 规则
 * @returns 释放本次注册的 MutationObserver / 定时器（文档级事件监听是幂等行为，保留）
 */
export function applyOfficialDomPatches(
  doc: Document,
  styles?: string
): () => void {
  const observers: MutationObserver[] = []
  const timers: number[] = []
  let released = false

  const release = () => {
    if (released) return
    released = true
    observers.forEach((observer) => observer.disconnect())
    timers.forEach((timer) => doc.defaultView?.clearInterval(timer))
    if (activeRelease === release) activeRelease = null
  }
  // 同一文档上重复挂载（切换商品）时先释放上一次的观察器，避免叠加
  activeRelease?.()
  activeRelease = release

  const observe = (
    observer: MutationObserver,
    target: Node,
    init: MutationObserverInit
  ) => {
    observers.push(observer)
    observer.observe(target, init)
    return observer
  }
  const every = (handler: () => void, ms: number) => {
    const view = doc.defaultView
    // 文档可能未绑定 window（分离文档 / 测试桩），此时退化为不轮询
    if (typeof view?.setInterval !== 'function') return undefined
    const timer = view.setInterval(handler, ms)
    timers.push(timer)
    return timer
  }

  // 游客壳移除 aside/top menu 后不会触发 goods.js 的 updated 钩子。
  // 官方模块把选配内容异步写入 .content；内容出现后再移除遗留遮罩。
  const content = doc.querySelector('.goods .content')
  const removeMainLoading = () => {
    doc.defaultView?.requestAnimationFrame(() => {
      doc.getElementById('mainLoading')?.remove()
    })
  }
  if (content?.children.length) {
    removeMainLoading()
  } else if (content) {
    const observer = new MutationObserver(() => {
      if (!content.children.length) return
      observer.disconnect()
      removeMainLoading()
    })
    observe(observer, content, { childList: true })
  }

  const setupFOrderToggle = () => {
    // 仅手机端注入折叠手柄 + 重排价格条（CSS 在桌面端 display:none / 重排不执行）
    if (!doc.defaultView?.matchMedia('(max-width: 750px)').matches) return
    const findFOrder = () => doc.querySelector<HTMLElement>('.goods .f-order')
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
    observe(observer, doc.body, { childList: true, subtree: true })
    doc.defaultView?.addEventListener('resize', positionBotPrice)
  }

  const setupSliderLabels = () => {
    let moved = false
    const sliders = doc.querySelectorAll<HTMLElement>(
      '.goods .template .el-slider--with-input, .goods .template .slider-box > .el-slider'
    )
    const marksList = doc.querySelectorAll<HTMLElement>(
      '.goods .template .marks'
    )
    sliders.forEach((slider, index) => {
      const runway = slider.querySelector<HTMLElement>('.el-slider__runway')
      let marks =
        marksList[index] ??
        slider.parentElement?.querySelector<HTMLElement>('.marks')
      if (!runway) return

      // 部分 mf_dcim 模板只输出 aria 范围，不输出官方 marks 节点；按参考商品页补齐两端刻度。
      if (!marks) {
        const min = slider.getAttribute('aria-valuemin')
        const max = slider.getAttribute('aria-valuemax')
        if (!min || !max) return
        marks = doc.createElement('div')
        marks.className = 'marks'
        for (const value of [min, max]) {
          const item = doc.createElement('span')
          item.className = 'item'
          item.textContent = `${value}M`
          marks.append(item)
        }
        runway.append(marks)
      }

      if (marks.children.length < 2) return

      runway.classList.add('furll-slider-runway')
      marks.classList.add('furll-slider-marks')
      if (marks.parentElement !== runway) runway.append(marks)
      moved = true
    })
    return moved
  }

  const scheduleSliderLabels = () => {
    doc.defaultView?.requestAnimationFrame(() => {
      setupSliderLabels()
      setTimeout(setupSliderLabels, 0)
    })
  }

  const setupImageVersionToggle = () => {
    if (doc.body.dataset.furllImageToggleReady === '1') return
    doc.body.dataset.furllImageToggleReady = '1'
    doc.addEventListener('click', (event) => {
      const target = event.target as Element
      const imageItem = target.closest<HTMLElement>('.image-item')
      if (!imageItem) return
      if (target.closest('.version-select, .el-popover')) return
      const wasOpen = imageItem.classList.contains('version-open')
      doc.querySelectorAll<HTMLElement>('.image-item.version-open').forEach((item) => {
        item.classList.remove('version-open')
        item
          .querySelector<HTMLElement>('.version-select')
          ?.style.removeProperty('display')
      })
      if (!wasOpen) {
        imageItem.classList.add('version-open')
        imageItem
          .querySelector<HTMLElement>('.version-select')
          ?.style.setProperty('display', 'block', 'important')
        if (doc.defaultView?.matchMedia('(max-width: 750px)').matches) {
          imageItem.scrollIntoView({ block: 'nearest' })
        }
      }
    })
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
      fOrder.querySelectorAll<HTMLElement>('.cur-content, .free-content').forEach((pop) => {
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
      if (target.closest?.('.furll-click-trigger, .furll-click-popover')) {
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
      if (target.closest?.('.furll-click-trigger, .furll-click-popover')) return
      findPopoverPairs().forEach(({ pop }) => closePopover(pop))
    })

    const bindPair = (pair: { pop: HTMLElement; trigger: HTMLElement }) => {
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
    observe(observer, doc.body, { childList: true, subtree: true })
  }

  if (styles) {
    let style = doc.getElementById(
      'furll-legacy-goods-style'
    ) as HTMLStyleElement | null
    if (!style) {
      style = doc.createElement('style')
      style.id = 'furll-legacy-goods-style'
      doc.head.append(style)
    }
    style.textContent = styles
  }

  const measureDropdowns = () => {
    doc
      .querySelectorAll<HTMLElement>(
        '.op-sysyem .el-select, .f-order .duration-select'
      )
      .forEach((select) => {
        const dropdown = select.classList.contains('duration-select')
          ? doc.querySelector<HTMLElement>('.el-select-dropdown.duration-pup')
          : select.querySelector<HTMLElement>('.el-select-dropdown')
        const items = dropdown?.querySelectorAll<HTMLElement>(
          '.el-select-dropdown__item'
        )
        if (!dropdown || !items?.length) return

        // Element UI 将下拉面板移到 body 后仍会按最长周期设置 min-width。
        // 订购时长面板跟随选择框宽度，避免固定周期文案把底部操作栏撑宽。
        if (select.classList.contains('duration-select')) {
          const selectWidth = Math.ceil(select.getBoundingClientRect().width)
          dropdown.style.width = `${selectWidth}px`
          dropdown.style.minWidth = `${selectWidth}px`
          dropdown.style.maxWidth = `${selectWidth}px`
          return
        }

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
        const input = select.querySelector<HTMLInputElement>('.el-input__inner')
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

  scheduleSliderLabels()
  const sliderObserver = new MutationObserver(scheduleSliderLabels)
  observe(sliderObserver, doc.body, { childList: true, subtree: true })
  let sliderPolls = 0
  every(() => {
    sliderPolls += 1
    if (setupSliderLabels() || sliderPolls >= 100) {
      release()
    }
  }, 100)

  setupFOrderToggle()
  setupPopoverClick()
  setupImageVersionToggle()

  return release
}
