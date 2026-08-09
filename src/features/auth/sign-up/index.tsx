import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'
import { SignUpForm } from './components/sign-up-form'
import { MainLoading } from '../components/main-loading'
import { useAuthCommon, siteName } from '../auth-common'

export function SignUp() {
  const { common, countryList, isLoading } = useAuthCommon()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.title = `${siteName(common)} - 注册`
  }, [common])

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setLoading(false), 150)
      return () => clearTimeout(timer)
    }
  }, [isLoading])

  if (loading) {
    return <MainLoading text='正在加载注册配置…' />
  }

  return (
    <AuthLayout logo={common?.system_logo as string | undefined} maxWidth='max-w-md'>
      <Card className='w-full gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>注册账户</CardTitle>
          <CardDescription>
            使用邮箱或手机号注册账户
            <br />
            已有账户？{' '}
            <Link
              to='/login.htm'
              className='underline underline-offset-4 hover:text-primary'
            >
              立即登录
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignUpForm common={common} countryList={countryList} />
        </CardContent>
        <CardFooter>
          <p className='text-center text-sm text-muted-foreground'>
            注册即表示你同意我们的{' '}
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
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}
