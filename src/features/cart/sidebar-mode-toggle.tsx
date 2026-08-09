import { FolderTree, UserRound } from 'lucide-react'
import {
  useCartSidebarStore,
  type CartSidebarMode,
} from '@/stores/cart-sidebar-store'
import { cn } from '@/lib/utils'
import { SidebarMenuButton, useSidebar } from '@/components/ui/sidebar'

// 全站左侧栏模式切换：用户中心菜单 / 产品分组分类树（产品分组在右）。
// 渲染在侧边栏头部（logo 下方），所有页面常驻，随时切换；
// 标签页切换风格：激活指示条线性滑动（linear）到新位置 + 侧边栏内容淡入；
// 图标折叠模式降级为两个图标按钮（tooltip 说明），切换入口常驻。
// mode 为当前生效模式（未手动选择时已按页面默认折算）
export function SidebarModeToggle({ mode }: { mode: CartSidebarMode }) {
  const setMode = useCartSidebarStore((state) => state.setMode)
  const { state, isMobile } = useSidebar()

  if (state === 'collapsed' && !isMobile) {
    return (
      <div className='flex flex-col gap-1'>
        <SidebarMenuButton
          size='sm'
          isActive={mode === 'user'}
          tooltip='用户中心'
          aria-pressed={mode === 'user'}
          onClick={() => setMode('user')}
          className='cursor-pointer'
        >
          <UserRound className='size-4 shrink-0' />
        </SidebarMenuButton>
        <SidebarMenuButton
          size='sm'
          isActive={mode === 'groups'}
          tooltip='产品分组'
          aria-pressed={mode === 'groups'}
          onClick={() => setMode('groups')}
          className='cursor-pointer'
        >
          <FolderTree className='size-4 shrink-0' />
        </SidebarMenuButton>
      </div>
    )
  }

  return (
    <div
      role='group'
      aria-label='侧边栏切换'
      className='relative flex items-center rounded-lg border bg-sidebar-accent/60 p-1'
    >
      {/* 激活指示条：标签页切换风格，随模式滑动 */}
      <span
        aria-hidden
        className={cn(
          'absolute inset-y-1 start-1 w-[calc(50%-4px)] rounded-md bg-background shadow-sm transition-transform duration-200 ease-linear',
          mode === 'groups' && 'translate-x-full rtl:translate-x-[-100%]'
        )}
      />
      <button
        type='button'
        aria-pressed={mode === 'user'}
        onClick={() => setMode('user')}
        className={cn(
          'relative z-10 flex-1 cursor-pointer rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
          mode === 'user'
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        用户中心
      </button>
      <button
        type='button'
        aria-pressed={mode === 'groups'}
        onClick={() => setMode('groups')}
        className={cn(
          'relative z-10 flex-1 cursor-pointer rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
          mode === 'groups'
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        产品分组
      </button>
    </div>
  )
}
