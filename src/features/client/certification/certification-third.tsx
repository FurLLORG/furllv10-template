import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AlertTriangle, Loader2 } from 'lucide-react'
import {
  fetchCertificationAuth,
  fetchCertificationStatus,
} from '@/api'
import { useCertificationLang } from '@/hooks/use-certification-lang'
import { getErrorMessage } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { useCertificationNav } from './nav'

/**
 * 三方实名验证页（authentication_thrid.htm?type=1|2，官方 authenticationThrid.js）。
 *
 * 1. GET /certification/auth：status 200 → data.html 为实名接口（如支付宝）的验证文档，
 *    注入 iframe 渲染（插件 html 自带脚本/轮询，srcDoc 同源可执行）；
 *    status 400 → data.code：10000 重定向提交资料页（select），10001 跳状态页。
 * 2. 插件 html 内脚本置 window.isCodeFinshed=false 时，轮询 200ms 等待其变为 true
 *    （代表三方验证完成）；未置位走兼容模式：等待 4s 后开始轮询。
 * 3. 轮询 GET /certification/status 每 2s：code=2 且 refresh=0 继续轮询；
 *    其余终止 → code=1 跳 status?type=3，否则跳 status?type=<rzType>。
 */
export function CertificationThirdPage() {
  const navigate = useNavigate()
  const { t } = useCertificationLang()
  const { selectUrl, statusUrl } = useCertificationNav()

  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const rzType = params.get('type') ?? '1'

  const [html, setHtml] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const codeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const statusTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopTimers = useCallback(() => {
    if (codeTimerRef.current) {
      clearInterval(codeTimerRef.current)
      codeTimerRef.current = null
    }
    if (statusTimerRef.current) {
      clearInterval(statusTimerRef.current)
      statusTimerRef.current = null
    }
  }, [])

  useEffect(() => () => stopTimers(), [stopTimers])

  /** 读取 iframe 内插件脚本写入的 isCodeFinshed（官方 window.isCodeFinshed 等价物） */
  const iframeFinished = useCallback(() => {
    const win = iframeRef.current?.contentWindow as
      | (Window & { isCodeFinshed?: unknown })
      | null
    return Boolean(win?.isCodeFinshed)
  }, [])

  const startStatusPolling = useCallback(() => {
    statusTimerRef.current = setInterval(async () => {
      try {
        const res = await fetchCertificationStatus()
        if (res.status === 400) {
          stopTimers()
          navigate({ to: selectUrl })
          return
        }
        if (res.status === 200) {
          const { code, refresh } = res.data
          if (!(code === 2 && refresh === 0)) {
            stopTimers()
            navigate({
              to: statusUrl,
              search: { type: code === 1 ? '3' : rzType },
            })
          }
        }
      } catch {
        // 单次轮询失败忽略，继续轮询
      }
    }, 2000)
  }, [navigate, rzType, selectUrl, statusUrl, stopTimers])

  // 获取验证页 html（status 400 按 code 跳转）
  useEffect(() => {
    let active = true
    fetchCertificationAuth()
      .then((res) => {
        if (!active) return
        if (res.status === 400) {
          if (res.data?.code === 10000) {
            navigate({ to: selectUrl })
          } else if (res.data?.code === 10001) {
            navigate({ to: statusUrl, search: { type: rzType } })
          }
          return
        }
        if (res.status === 200 && res.data?.html) {
          setHtml(res.data.html)
        } else {
          setError(res.msg || '加载失败')
        }
      })
      .catch((e) => {
        if (active) setError(getErrorMessage(e))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 三方验证完成后轮询系统状态
  useEffect(() => {
    if (!iframeLoaded || !html) return
    const win = iframeRef.current?.contentWindow as
      | (Window & { isCodeFinshed?: unknown })
      | null
    if (win && win.isCodeFinshed === false) {
      codeTimerRef.current = setInterval(() => {
        if (iframeFinished()) {
          stopTimers()
          startStatusPolling()
        }
      }, 200)
    } else {
      const compat = setTimeout(startStatusPolling, 4000)
      return () => {
        clearTimeout(compat)
        stopTimers()
      }
    }
    return () => stopTimers()
  }, [iframeLoaded, html, startStatusPolling, stopTimers, iframeFinished])

  return (
    <div className='mx-auto max-w-3xl space-y-4'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>
          {t('realname_text1', '实名认证')}
        </h1>
        <div className='mt-1 text-sm text-muted-foreground'>
          {t('realname_text31', '认证方式')}
        </div>
      </div>

      <Card>
        <CardContent className='p-0'>
          {loading ? (
            <div className='flex min-h-72 flex-col items-center justify-center gap-2'>
              <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
              <p className='text-sm text-muted-foreground'>
                {t('realname_text9', '上传中')}
              </p>
            </div>
          ) : error ? (
            <div className='flex min-h-72 flex-col items-center justify-center gap-2 p-8 text-center'>
              <AlertTriangle className='h-10 w-10 text-amber-500' />
              <p className='text-sm text-muted-foreground'>{error}</p>
            </div>
          ) : (
            html && (
              <iframe
                ref={iframeRef}
                title='实名认证'
                srcDoc={html}
                onLoad={() => setIframeLoaded(true)}
                className='h-[640px] w-full border-0'
              />
            )
          )}
        </CardContent>
      </Card>
    </div>
  )
}
