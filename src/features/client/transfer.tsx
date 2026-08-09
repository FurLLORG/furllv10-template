import { useEffect, useMemo } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { fetchCommon } from '@/api'
import { useClientLang } from '@/hooks/use-client-lang'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

/**
 * 二次提醒中转页（官方 /transfer.htm?target=，asideMenu.js 对外链 second_reminder=1 的菜单跳转到此）。
 * 展示目标地址并确认后才会真正跳转，防止用户在不知情下离开会员中心。
 */
export function TransferPage() {
  const { t } = useClientLang()
  const searchStr = useLocation({ select: (location) => location.searchStr })
  const target = useMemo(() => {
    const raw = new URLSearchParams(searchStr).get('target') ?? ''
    return /^https?:\/\//i.test(raw) ? raw : ''
  }, [searchStr])

  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  const commonData = commonQuery.data?.data as Record<string, unknown> | undefined
  const websiteName = (commonData?.website_name as string) || 'FurLL'
  const logoUrl = (commonData?.system_logo as string) || ''

  useEffect(() => {
    document.title = `${t('jump_tip', '跳转提示')}-${websiteName}`
  }, [t, websiteName])

  function handleContinue() {
    if (target) {
      window.location.href = target
    }
  }

  return (
    <div className='flex min-h-[70svh] items-center justify-center p-4'>
      <Card className='w-full max-w-lg'>
        <div className='flex h-12 items-center bg-background px-6'>
          {logoUrl ? (
            <img src={logoUrl} alt={websiteName} className='h-6 w-auto object-contain' />
          ) : (
            <span className='text-base font-semibold text-foreground'>
              {websiteName}
            </span>
          )}
        </div>
        <CardContent className='space-y-4 p-6'>
          <h1 className='text-xl font-semibold'>
            {t('jump_tip1', '即将离开')}
            {websiteName}
          </h1>
          <p className='text-sm text-muted-foreground'>
            {t('jump_tip2', '您即将离开')}
            {websiteName}，{t('jump_tip3', '请注意您的账号和财产安全。')}
          </p>
          {target && (
            <div
              className='truncate rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground'
              title={target}
            >
              {target}
            </div>
          )}
          <div className='flex items-center justify-end gap-3 border-t pt-4'>
            <Button variant='outline' size='sm' asChild>
              <Link to='/home.htm'>
                <ArrowLeft />
                返回
              </Link>
            </Button>
            <Button size='sm' onClick={handleContinue} disabled={!target}>
              {t('jump_tip4', '继续访问')}
              <ExternalLink />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
