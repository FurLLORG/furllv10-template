import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useClientLang } from '@/hooks/use-client-lang'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuthCommon, siteName } from '../auth-common'
import { AuthLayout } from '../auth-layout'
import { MainLoading } from '../components/main-loading'
import { ForgetPasswordForm } from './components/forget-password-form'

/**
 * 忘记密码页（官方 forget.php 的 React 实现，页面布局参考 shadcn-admin forgot-password）。
 * 数据未获取完成（/common、/country 加载中）时显示加载动画。
 */
export function ForgetPasswordPage() {
  const { common, countryList, isLoading } = useAuthCommon()
  const { t } = useClientLang()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.title = `${siteName(common)} - ${t('forget', '忘记密码')}`
  }, [common, t])

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setLoading(false), 150)
      return () => clearTimeout(timer)
    }
  }, [isLoading])

  if (loading) {
    return <MainLoading text='正在加载…' />
  }

  return (
    <AuthLayout
      logo={common?.system_logo as string | undefined}
      maxWidth='max-w-md'
    >
      <Card className='w-full gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>
            {t('forget', '忘记密码')}
          </CardTitle>
          <CardDescription>
            输入注册时使用的邮箱或手机号
            <br />
            通过验证码重置你的密码
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ForgetPasswordForm common={common} countryList={countryList} />
        </CardContent>
        <CardFooter className='justify-center'>
          <p className='text-center text-sm text-muted-foreground'>
            {t('regist_yes_account', '已有账户？')}{' '}
            <Link
              to='/login.htm'
              className='underline underline-offset-4 hover:text-primary'
            >
              {t('regist_login_text', '立即登录')}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}
