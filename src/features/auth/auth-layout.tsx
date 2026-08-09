import { Command } from 'lucide-react'

type AuthLayoutProps = {
  /** 网站 logo 地址（/common 的 system_logo） */
  logo?: string
  /** 内容容器最大宽度（默认 max-w-sm） */
  maxWidth?: string
  children: React.ReactNode
}

export function AuthLayout({ logo, children, maxWidth = 'max-w-sm' }: AuthLayoutProps) {
  return (
    <div className='container grid h-svh max-w-none items-center justify-center'>
      <div
        className={`mx-auto flex w-full ${maxWidth} flex-col justify-center space-y-4 py-8 sm:p-8`}
      >
        <div className='mb-4 flex items-center justify-center'>
          {logo ? (
            <img
              src={logo}
              alt='logo'
              className='h-auto w-[75%] rounded-xl object-contain'
            />
          ) : (
            <Command className='h-14 w-14' />
          )}
        </div>
        {children}
      </div>
    </div>
  )
}
