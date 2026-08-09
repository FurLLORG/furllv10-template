import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { fetchCaptcha } from '@/api'
import { ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'

/**
 * 图形验证码弹窗（人机验证，官方 captchaDialog 组件）。
 *
 * 官方流程：GET /console/v1/captcha 返回验证码插件的 html（TpCaptcha/TencentCaptcha/GeeTest 等，
 * 各插件结构不同，不可硬编码），把它注入页面并执行其 <script>。插件脚本验证通过后调用全局
 * captchaCheckSuccsss(true, captcha, token)、取消调用 captchaCheckCancel() 通知宿主。
 * React 的 dangerouslySetInnerHTML 不执行 <script>，这里用「重建 script 节点」方式执行，
 * 与官方 jQuery .html() 行为一致。
 *
 * 弹窗样式：插件 HTML（如 TpCaptcha）自带全屏 fixed 遮罩，这里用 CSS 覆盖把它压成普通流式
 * 内容，放进本组件自己控制的居中卡片里——即真正的弹窗，不再遮住整页；内部元素用显式 px 尺寸，
 * 不受根字号影响，宽度自适应视口（min(88vw, 380px)）。
 */

declare global {
  interface Window {
    captchaCheckSuccsss?: (bol: boolean, captcha: string, token: string) => void
    captchaCheckCancel?: () => void
  }
}

interface CaptchaDialogProps {
  open: boolean
  onSuccess: (captcha: string, token: string) => void
  onClose: () => void
}

/** 覆盖插件自带的全屏 fixed 遮罩，把内容改造成流式布局并显式 px 尺寸 */
const CAPTCHA_OVERRIDES = `
#captcha-outer {
  position: static !important;
  inset: auto !important;
  width: auto !important;
  height: auto !important;
  background: transparent !important;
  z-index: auto !important;
}
#captcha-outer .captcha-content {
  position: static !important;
  left: auto !important;
  top: auto !important;
  margin: 0 !important;
  transform: none !important;
  width: 100% !important;
  max-width: none !important;
  padding: 0 !important;
  background: transparent !important;
  opacity: 1 !important;
}
#captcha-outer .captcha-title {
  font-size: 16px !important;
  line-height: 22px !important;
  color: var(--color-foreground, inherit);
}
#captcha-outer .captcha-main {
  display: flex !important;
  flex-direction: row !important;
  gap: 10px !important;
  margin-top: 14px !important;
  padding-left: 0 !important;
}
#captcha-outer #captcha-input {
  flex: 1 1 auto !important;
  min-width: 0 !important;
  height: 40px !important;
  font-size: 15px !important;
  padding: 0 12px !important;
  border: 1px solid var(--color-border, #d1d5db) !important;
  border-radius: 8px !important;
  background: transparent !important;
  box-sizing: border-box !important;
  outline: none !important;
}
#captcha-outer #captcha-input:focus {
  border-color: var(--color-primary, #0058ff) !important;
}
#captcha-outer #captcha-img {
  width: 110px !important;
  height: 40px !important;
  border-radius: 8px !important;
  flex-shrink: 0 !important;
}
#captcha-outer #captcha-error-text {
  font-size: 13px !important;
  line-height: 18px !important;
  min-height: 18px;
  margin-top: 6px !important;
}
#captcha-outer .captcha-footer {
  display: flex !important;
  flex-direction: row !important;
  gap: 10px !important;
  justify-content: flex-end !important;
  margin-top: 14px !important;
}
#captcha-outer #check-btn,
#captcha-outer #cancel-btn {
  width: 80px !important;
  height: 38px !important;
  font-size: 14px !important;
  line-height: 38px !important;
  margin: 0 !important;
  border: none !important;
  border-radius: 8px !important;
  cursor: pointer !important;
  text-align: center !important;
}
#captcha-outer #check-btn {
  background: var(--color-primary, #0058ff) !important;
  color: var(--color-primary-foreground, #fff) !important;
}
#captcha-outer #cancel-btn {
  background: var(--color-muted, #e5e7eb) !important;
  color: var(--color-foreground, #1f2937) !important;
}
`

function injectHtml(container: HTMLElement, html: string): void {
  container.innerHTML = html
  container.querySelectorAll('script').forEach((oldScript) => {
    const newScript = document.createElement('script')
    for (const attr of Array.from(oldScript.attributes)) {
      newScript.setAttribute(attr.name, attr.value)
    }
    newScript.textContent = oldScript.textContent
    oldScript.parentNode?.replaceChild(newScript, oldScript)
  })
}

export function CaptchaDialog({ open, onSuccess, onClose }: CaptchaDialogProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  const successRef = useRef(onSuccess)
  const closeRef = useRef(onClose)
  useEffect(() => {
    successRef.current = onSuccess
    closeRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const host = hostRef.current
    if (!host) return

    setLoading(true)
    setFailed(false)

    const prevSuccess = window.captchaCheckSuccsss
    const prevCancel = window.captchaCheckCancel
    window.captchaCheckSuccsss = (bol, captcha, token) => {
      if (!bol) return // 验证失败，插件自身展示错误，保持弹窗
      if (host) host.innerHTML = ''
      successRef.current(captcha, token)
    }
    window.captchaCheckCancel = () => {
      if (host) host.innerHTML = ''
      closeRef.current()
    }

    fetchCaptcha()
      .then(async (res) => {
        if (cancelled) return
        if (res.status !== 200) throw new ApiError(res.msg, res.status, res.data)
        setLoading(false)
        if (host) injectHtml(host, res.data.html)
      })
      .catch(() => {
        if (cancelled) return
        setLoading(false)
        setFailed(true)
      })

    return () => {
      cancelled = true
      window.captchaCheckSuccsss = prevSuccess
      window.captchaCheckCancel = prevCancel
      if (host) host.innerHTML = ''
    }
  }, [open])

  function retry() {
    setFailed(false)
    setLoading(true)
    const host = hostRef.current
    if (host) host.innerHTML = ''
    fetchCaptcha()
      .then(async (res) => {
        if (res.status !== 200)
          throw new ApiError(res.msg, res.status, res.data)
        setLoading(false)
        if (host) injectHtml(host, res.data.html)
      })
      .catch(() => {
        setLoading(false)
        setFailed(true)
      })
  }

  if (!open) return null

  return (
    <div className='fixed inset-0 z-[2000] flex items-center justify-center'>
      <div
        className='absolute inset-0 bg-black/50'
        onClick={onClose}
        aria-hidden='true'
      />
      <div
        className='relative w-[min(88vw,380px)] rounded-xl border bg-background p-5 shadow-xl'
        role='dialog'
        aria-modal='true'
        aria-label='图形验证'
      >
        {loading && (
          <div className='flex flex-col items-center gap-3 py-6'>
            <Loader2 className='animate-spin text-primary' />
            <span className='text-sm text-muted-foreground'>加载验证码…</span>
          </div>
        )}
        {failed && (
          <div className='flex flex-col items-center gap-4 py-4'>
            <AlertCircle className='text-destructive' />
            <span className='text-sm text-muted-foreground'>验证码加载失败</span>
            <div className='flex gap-2'>
              <Button variant='outline' onClick={retry}>
                重试
              </Button>
              <Button variant='outline' onClick={onClose}>
                取消
              </Button>
            </div>
          </div>
        )}
        <div ref={hostRef} />
      </div>
      <style>{CAPTCHA_OVERRIDES}</style>
    </div>
  )
}
