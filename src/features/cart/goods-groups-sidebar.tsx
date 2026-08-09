import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { fetchProductGroupFirst, fetchProductGroupSecond } from '@/api'
import { ChevronRight, Folder, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'

// 25y.cn 风格的产品分组分类树：一级分组手风琴展开二级分组，点击二级分组切换商品列表。
// 由 ClientSidebar 在「产品分组」模式下渲染（切换按钮在头部，跨模式保持挂载以播放滑动动画）。
// 一级/二级分组查询与 goodsList 页共用 queryKey，走 react-query 缓存不重复请求
export function ProductGroupsTree() {
  const navigate = useNavigate()
  const location = useLocation()
  const searchStr = location.searchStr
  const search = useMemo(() => new URLSearchParams(searchStr), [searchStr])
  const urlFpgId = Number(search.get('fpg_id')) || 0
  const urlSpgId = Number(search.get('spg_id')) || 0

  const firstQuery = useQuery({
    queryKey: ['cart-goods-first'],
    queryFn: fetchProductGroupFirst,
    retry: false,
  })
  const firstGroups = firstQuery.data?.data.list ?? []
  const effectiveFirstId =
    urlFpgId > 0 ? urlFpgId : (firstGroups[0]?.id ?? null)

  function selectSecond(firstId: number, secondId: number) {
    navigate({
      to: '/cart/goodsList.htm',
      search: { fpg_id: firstId, spg_id: secondId },
      replace: true,
    })
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>产品分组</SidebarGroupLabel>
      <SidebarMenu>
        {firstQuery.isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <SidebarMenuItem key={i}>
              <SidebarMenuButton size='sm' className='pointer-events-none'>
                <Skeleton className='size-4 shrink-0' />
                <Skeleton className='h-4 w-full max-w-28' />
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))
        ) : firstQuery.error ? (
          <SidebarMenuItem>
            <SidebarMenuButton
              size='sm'
              className='pointer-events-none text-muted-foreground'
            >
              分组加载失败
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : firstGroups.length === 0 ? (
          <SidebarMenuItem>
            <SidebarMenuButton
              size='sm'
              className='pointer-events-none text-muted-foreground'
            >
              暂无产品分组
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : (
          firstGroups.map((group) => (
            <FirstGroupItem
              key={group.id}
              groupId={group.id}
              name={group.name}
              activeFirstId={effectiveFirstId}
              activeSecondId={urlSpgId}
              onSelectSecond={selectSecond}
            />
          ))
        )}
      </SidebarMenu>
    </SidebarGroup>
  )
}

function FirstGroupItem({
  groupId,
  name,
  activeFirstId,
  activeSecondId,
  onSelectSecond,
}: {
  groupId: number
  name: string
  activeFirstId: number | null
  activeSecondId: number
  onSelectSecond: (firstId: number, secondId: number) => void
}) {
  const { state, isMobile } = useSidebar()
  const isActiveFirst = groupId === activeFirstId

  if (state === 'collapsed' && !isMobile) {
    return (
      <CollapsedGroupDropdown
        groupId={groupId}
        name={name}
        isActiveFirst={isActiveFirst}
        activeSecondId={activeSecondId}
        onSelectSecond={onSelectSecond}
      />
    )
  }

  return (
    <ExpandedGroupItem
      groupId={groupId}
      name={name}
      isActiveFirst={isActiveFirst}
      activeSecondId={activeSecondId}
      onSelectSecond={onSelectSecond}
    />
  )
}

function ExpandedGroupItem({
  groupId,
  name,
  isActiveFirst,
  activeSecondId,
  onSelectSecond,
}: {
  groupId: number
  name: string
  isActiveFirst: boolean
  activeSecondId: number
  onSelectSecond: (firstId: number, secondId: number) => void
}) {
  const { setOpenMobile } = useSidebar()
  // 当前一级分组（URL fpg_id）始终展开，用户手动折叠时以用户操作为准
  const [userExpanded, setUserExpanded] = useState(false)
  const open = isActiveFirst || userExpanded

  // 展开时按需加载二级分组（与 goodsList 页共用 queryKey，缓存命中不重复请求）
  const secondQuery = useQuery({
    queryKey: ['cart-goods-second', groupId],
    queryFn: () => fetchProductGroupSecond(groupId),
    enabled: open,
    retry: false,
  })
  const secondGroups = secondQuery.data?.data.list ?? []

  return (
    <Collapsible
      asChild
      open={open}
      onOpenChange={setUserExpanded}
      className='group/collapsible'
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            tooltip={name}
            isActive={isActiveFirst}
            className='data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground'
          >
            {isActiveFirst ? (
              <FolderOpen className='size-4 shrink-0' />
            ) : (
              <Folder className='size-4 shrink-0' />
            )}
            <span>{name}</span>
            <ChevronRight className='ms-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 rtl:rotate-180' />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent className='CollapsibleContent'>
          {secondQuery.isLoading ? (
            <SidebarMenuSub>
              {Array.from({ length: 2 }).map((_, i) => (
                <SidebarMenuSubItem key={i}>
                  <Skeleton className='h-4 w-full max-w-24' />
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          ) : secondGroups.length === 0 ? (
            <SidebarMenuSub>
              <SidebarMenuSubItem>
                <span className='text-xs text-muted-foreground'>
                  暂无子分组
                </span>
              </SidebarMenuSubItem>
            </SidebarMenuSub>
          ) : (
            <SidebarMenuSub>
              {secondGroups.map((group) => (
                <SidebarMenuSubItem key={group.id}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={group.id === activeSecondId && isActiveFirst}
                  >
                    <button
                      onClick={() => {
                        onSelectSecond(groupId, group.id)
                        setOpenMobile(false)
                      }}
                    >
                      <span>{group.name}</span>
                    </button>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          )}
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

function CollapsedGroupDropdown({
  groupId,
  name,
  isActiveFirst,
  activeSecondId,
  onSelectSecond,
}: {
  groupId: number
  name: string
  isActiveFirst: boolean
  activeSecondId: number
  onSelectSecond: (firstId: number, secondId: number) => void
}) {
  const { setOpenMobile } = useSidebar()
  const [open, setOpen] = useState(false)
  const secondQuery = useQuery({
    queryKey: ['cart-goods-second', groupId],
    queryFn: () => fetchProductGroupSecond(groupId),
    enabled: open,
    retry: false,
  })
  const secondGroups = secondQuery.data?.data.list ?? []

  return (
    <SidebarMenuItem>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            tooltip={name}
            isActive={isActiveFirst}
            className='data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground'
          >
            <Folder className='size-4 shrink-0' />
            <span>{name}</span>
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side='right' align='start' sideOffset={4}>
          <DropdownMenuLabel>{name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {secondQuery.isLoading ? (
            <DropdownMenuItem disabled>加载中…</DropdownMenuItem>
          ) : secondGroups.length === 0 ? (
            <DropdownMenuItem disabled>暂无子分组</DropdownMenuItem>
          ) : (
            secondGroups.map((group) => (
              <DropdownMenuItem
                key={group.id}
                asChild
                className={cn(
                  group.id === activeSecondId && isActiveFirst && 'bg-secondary'
                )}
              >
                <button
                  onClick={() => {
                    onSelectSecond(groupId, group.id)
                    setOpenMobile(false)
                  }}
                >
                  <span className='max-w-52 text-wrap'>{group.name}</span>
                </button>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}
