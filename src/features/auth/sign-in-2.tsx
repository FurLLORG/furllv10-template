import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Command } from 'lucide-react'
import { cn } from '@/lib/utils'
import dashboardLight from './assets/login.png'
import { UserAuthForm } from './components/user-auth-form'
import { MainLoading } from './components/main-loading'
import { useAuthCommon, siteName } from './auth-common'

/**
 * 登录页（官方 login.htm 的 React 实现）。
 * 数据未获取完成（/common、/country 加载中）时显示加载动画；全部就绪后才渲染表单，
 * 登录方式/图形验证码/三方登录等以 /common 实际返回为准。
 */

export function SignIn2() {
  const { common, countryList, isLoading, refetch } = useAuthCommon()
  const [loading, setLoading] = useState(true)

  // 已登录直接回首页（官方 created 里 location.href = home.htm）
  useEffect(() => {
    if (localStorage.getItem('jwt')) {
      window.location.href = '/home.htm'
    }
  }, [])

  useEffect(() => {
    document.title = `${siteName(common)} - 登录`
  }, [common])

  useEffect(() => {
    if (!isLoading) {
      // 等一帧，避免 loading 闪烁
      const timer = setTimeout(() => setLoading(false), 150)
      return () => clearTimeout(timer)
    }
  }, [isLoading])

  if (loading) {
    return <MainLoading text='正在加载登录配置…' />
  }

  const redirectShow = common?.login_register_redirect_show === 1 || common?.login_register_redirect_show === '1'

  return (
    <div className='relative container grid min-h-svh flex-col items-center justify-center lg:max-w-none lg:grid-cols-2 lg:px-0'>
      <div className='lg:p-8'>
        <div className='absolute top-6 start-6 flex items-center gap-4 max-sm:flex-col max-sm:items-start'>
          {redirectShow && (
            <a
              href={common?.login_register_redirect_url}
              target={
                common?.login_register_redirect_blank === 1 ||
                common?.login_register_redirect_blank === '1'
                  ? '_blank'
                  : '_self'
              }
              className='rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90'
            >
              {common?.login_register_redirect_text || '返回官网'}
            </a>
          )}
        </div>
        <div className='mx-auto flex w-full max-w-sm flex-col justify-center space-y-4 py-8 sm:p-8'>
          <div className='flex items-center justify-center'>
            {common?.system_logo ? (
              <img
                src={common.system_logo}
                alt='logo'
                className='h-auto w-[75%] rounded-xl object-contain'
              />
            ) : (
              <Command className='h-14 w-14' />
            )}
          </div>
          <div className='flex flex-col space-y-2 text-start'>
            <h2 className='text-lg font-semibold tracking-tight'>登录</h2>
            <p className='text-sm text-muted-foreground'>
              使用手机号或邮箱登录你的账户
              <br className='max-sm:hidden' /> 还没有账户？{' '}
              <Link
                to='/regist.htm'
                className='text-nowrap underline underline-offset-4 hover:text-primary'
              >
                立即注册
              </Link>
            </p>
          </div>
          <UserAuthForm
            common={common}
            countryList={countryList}
            onRefetchCommon={refetch}
          />
          <p className='text-center text-sm text-muted-foreground'>
            登录即表示你同意我们的{' '}
            <Link
              to='/agreement.htm'
              className='underline underline-offset-4 hover:text-primary'
            >
              服务条款
            </Link>{' '}
            与{' '}
            <Link
              to='/agreement.htm'
              className='underline underline-offset-4 hover:text-primary'
            >
              隐私政策
            </Link>
          </p>
        </div>
      </div>

      <div
        className={cn(
          'relative h-full overflow-hidden bg-muted max-lg:hidden',
          '[&>img]:absolute [&>img]:top-[15%] [&>img]:left-20 [&>img]:h-full [&>img]:w-full [&>img]:object-cover [&>img]:object-top-left [&>img]:select-none'
        )}
      >
        <img
          src={dashboardLight}
          className='h-full w-full object-cover object-top-left'
          width={1024}
          height={1151}
          alt='FurLLV10'
        />
      </div>
    </div>
  )
}
