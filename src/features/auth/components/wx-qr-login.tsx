import { useEffect, useRef, useState } from 'react'
import { Loader2, QrCode, RefreshCw } from 'lucide-react'
import {
  fetchWxQrCode,
  fetchWxQrCodeStatus,
  selectWxClientLogin,
  type WxQrCodeData,
} from '@/api'
import { ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { afterLogin, type AuthCommonConfig } from '../auth-common'

interface WxQrLoginProps {
  /** 已登录配置（写入 lang 用） */
  common?: AuthCommonConfig
  /** 登录成功（jwt 已存 localStorage）后由父级统一跳转 */
  onLoggedIn?: () => void
}

/**
 * 微信扫码登录（官方 mp_weixin_notice 插件 qrcode 流程）：
 * 生成二维码 → 轮询状态（Wait 继续 / SelectClient 选账户 / Success 拿 jwt / Expired 刷新）。
 */
export function WxQrLogin({ common, onLoggedIn }: WxQrLoginProps) {
  const [qrData, setQrData] = useState<WxQrCodeData>({})
  const [loading, setLoading] = useState(false)
  const [selectAccount, setSelectAccount] = useState(false)
  const [clientList, setClientList] = useState<
    Array<{ id: number; username: string; status?: number }>
  >([])
  const [selectClient, setSelectClient] = useState('')
  const [selectLoading, setSelectLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  const commonRef = useRef(common)
  const onLoggedInRef = useRef(onLoggedIn)
  useEffect(() => {
    commonRef.current = common
    onLoggedInRef.current = onLoggedIn
  })

  function clearPoll() {
    if (pollRef.current) {
      clearTimeout(pollRef.current)
      pollRef.current = null
    }
  }

  async function getQrCode() {
    if (!mountedRef.current) return
    clearPoll()
    setLoading(true)
    setFailed(false)
    setSelectAccount(false)
    try {
      const res = await fetchWxQrCode()
      if (!mountedRef.current) return
      if (res.status !== 200) throw new ApiError(res.msg, res.status, res.data)
      setQrData({ ...res.data, is_refresh: false })
      setLoading(false)
      pollStatus(res.data.ticket ?? '', res.data.token ?? '')
    } catch {
      if (!mountedRef.current) return
      setLoading(false)
      setFailed(true)
    }
  }

  function pollStatus(ticket: string, token: string) {
    clearPoll()
    const tick = async () => {
      try {
        const res = await fetchWxQrCodeStatus({ ticket, token })
        if (!mountedRef.current) return
        if (res.status !== 200) return
        const status = res.data.status
        if (status === 'Wait') {
          pollRef.current = setTimeout(tick, 2000)
          return
        }
        if (status === 'SelectClient') {
          const clients = res.data.client ?? []
          setClientList(clients)
          setSelectClient(String(clients.find((c) => c.status === 1)?.id ?? ''))
          setSelectAccount(true)
          return
        }
        if (status === 'WaitBind') {
          window.location.href = `oauth.htm?ticket=${encodeURIComponent(ticket)}&token=${encodeURIComponent(token)}`
          return
        }
        if (status === 'Success' && res.data.jwt) {
          window.localStorage.setItem('jwt', res.data.jwt)
          void afterLogin(commonRef.current).then(() =>
            onLoggedInRef.current?.()
          )
          return
        }
        if (status === 'Expired') {
          setQrData((prev) => ({ ...prev, is_refresh: true }))
          return
        }
      } catch {
        // 轮询失败继续
      }
    }
    pollRef.current = setTimeout(tick, 500)
  }

  async function handleSelectClientLogin() {
    setSelectLoading(true)
    try {
      const res = await selectWxClientLogin({
        ticket: qrData.ticket,
        token: qrData.token,
        client_id: selectClient,
      })
      if (res.status !== 200) throw new ApiError(res.msg, res.status, res.data)
      window.localStorage.setItem('jwt', res.data.jwt)
      void afterLogin(commonRef.current).then(() => onLoggedInRef.current?.())
    } catch {
      // 选账户失败保持弹窗
      setSelectLoading(false)
    }
  }

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearPoll()
    }
  }, [])

  return (
    <div className='grid gap-3'>
      {!selectAccount ? (
        <div className='flex flex-col items-center gap-3'>
          <div className='relative flex h-44 w-44 items-center justify-center rounded-lg border bg-muted/30'>
            {loading && <Loader2 className='animate-spin text-primary' />}
            {!loading && qrData.img_url && (
              <img
                src={qrData.img_url}
                alt='微信扫码登录'
                className='h-full w-full object-contain'
              />
            )}
            {!loading && qrData.is_refresh && (
              <div className='absolute inset-0 flex items-center justify-center bg-background/70'>
                <Button size='sm' onClick={getQrCode}>
                  <RefreshCw />
                  刷新二维码
                </Button>
              </div>
            )}
            {failed && (
              <div className='absolute inset-0 flex items-center justify-center'>
                <Button size='sm' variant='outline' onClick={getQrCode}>
                  重新获取
                </Button>
              </div>
            )}
          </div>
          <p className='flex items-center gap-1.5 text-sm text-muted-foreground'>
            <QrCode className='size-4' />
            使用微信扫码关注公众号登录
          </p>
        </div>
      ) : (
        <div className='grid gap-3'>
          <Button variant='ghost' size='sm' className='justify-start' onClick={getQrCode}>
            返回重新扫码
          </Button>
          <p className='text-sm text-muted-foreground'>选择要登录的账户</p>
          <RadioGroup value={selectClient} onValueChange={setSelectClient}>
            {clientList.map((item) => (
              <div key={item.id} className='flex items-center gap-2'>
                <RadioGroupItem
                  value={String(item.id)}
                  id={`wx-client-${item.id}`}
                  disabled={item.status !== 1}
                />
                <Label htmlFor={`wx-client-${item.id}`}>{item.username}</Label>
              </div>
            ))}
          </RadioGroup>
          <Button
            onClick={handleSelectClientLogin}
            disabled={!selectClient || selectLoading}
          >
            {selectLoading && <Loader2 className='animate-spin' />}
            登录
          </Button>
        </div>
      )}
    </div>
  )
}
