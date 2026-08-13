import { Link } from '@tanstack/react-router'
import {
  BadgeCheck,
  ChevronsUpDown,
  CreditCard,
  LogIn,
  LogOut,

} from 'lucide-react'
import useDialogState from '@/hooks/use-dialog-state'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { gravatarUrl } from '@/lib/gravatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { SignOutDialog } from '@/components/sign-out-dialog'

type NavUserProps = {
  user: {
    name: string
    email: string
    avatar: string
  }
  loading?: boolean
  isGuest?: boolean
}

export function NavUser({ user, loading, isGuest = false }: NavUserProps) {
  const { isMobile } = useSidebar()
  const [open, setOpen] = useDialogState()
  // 与顶栏 ProfileDropdown 同款头像源：未显式传图时用邮箱/手机号生成 gravatar
  const avatarSrc = user.avatar || (user.email ? gravatarUrl(user.email) : '')

  if (isGuest) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size='lg' asChild>
            <Link to='/login.htm'>
              <LogIn className='size-4 shrink-0' />
              <span className='truncate font-medium'>登录 / 注册</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size='lg'
                className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
              >
                {loading ? (
                  <>
                    <Skeleton className='size-8 shrink-0 rounded-lg' />
                    <div className='grid flex-1 gap-1.5'>
                      <Skeleton className='h-3.5 w-28' />
                      <Skeleton className='h-3 w-36' />
                    </div>
                  </>
                ) : (
                  <>
                    <Avatar className='h-8 w-8'>
                      <AvatarImage src={avatarSrc} alt={user.name} />
                      <AvatarFallback>{user.name?.slice(0, 2) || 'FU'}</AvatarFallback>
                    </Avatar>
                    <div className='grid flex-1 text-start text-sm leading-tight'>
                      <span className='truncate font-semibold'>
                        {user.name}
                      </span>
                      <span className='truncate text-xs'>{user.email}</span>
                    </div>
                  </>
                )}
                <ChevronsUpDown className='ms-auto size-4' />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className='w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg'
              side={isMobile ? 'bottom' : 'right'}
              align='end'
              sideOffset={4}
            >
              <DropdownMenuLabel className='p-0 font-normal'>
                <div className='flex items-center gap-2 px-1 py-1.5 text-start text-sm'>
                  <Avatar className='h-8 w-8'>
                    <AvatarImage src={avatarSrc} alt={user.name} />
                    <AvatarFallback>{user.name?.slice(0, 2) || 'FU'}</AvatarFallback>
                  </Avatar>
                  <div className='grid flex-1 text-start text-sm leading-tight'>
                    <span className='truncate font-semibold'>{user.name}</span>
                    <span className='truncate text-xs'>{user.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link to='/account.htm'>
                    <BadgeCheck />
                    账户设置
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to='/finance.htm'>
                    <CreditCard />
                    财务中心
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant='destructive'
                onClick={() => setOpen(true)}
              >
                <LogOut />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <SignOutDialog open={!!open} onOpenChange={setOpen} />
    </>
  )
}
