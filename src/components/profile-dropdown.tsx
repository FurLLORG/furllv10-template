import { Link } from '@tanstack/react-router'
import useDialogState from '@/hooks/use-dialog-state'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
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
import { SignOutDialog } from '@/components/sign-out-dialog'

type ProfileDropdownProps = {
  name?: string
  email?: string
  avatar?: string
  loading?: boolean
}

export function ProfileDropdown({
  name = 'satnaing',
  email = 'satnaingdev@gmail.com',
  avatar,
  loading = false,
}: ProfileDropdownProps) {
  const [open, setOpen] = useDialogState()
  // 未显式传头像时用邮箱生成 gravatar（loli.net 镜像）
  const avatarSrc = avatar || (email ? gravatarUrl(email) : '')

  if (loading) {
    return (
      <div className='flex items-center gap-2'>
        <Skeleton className='size-8 rounded-full' />
      </div>
    )
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' className='relative h-8 w-8 rounded-full'>
            <Avatar className='h-8 w-8'>
              <AvatarImage src={avatarSrc} alt={name} />
              <AvatarFallback>{name.slice(0, 2) || 'FU'}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className='w-56' align='end' forceMount>
          <DropdownMenuLabel className='font-normal'>
            <div className='flex flex-col gap-1.5'>
              <p className='text-sm leading-none font-medium'>{name}</p>
              <p className='text-xs leading-none text-muted-foreground'>
                {email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link to='/account.htm'>
                账户设置
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to='/finance.htm'>
                财务中心
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant='destructive' onClick={() => setOpen(true)}>
            退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SignOutDialog open={!!open} onOpenChange={setOpen} />
    </>
  )
}
