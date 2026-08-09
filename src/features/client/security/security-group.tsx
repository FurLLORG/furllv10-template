import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { MoreHorizontal, Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  createSecurityGroup,
  deleteSecurityGroup,
  fetchCommon,
  fetchSecurityGroupList,
  updateSecurityGroup,
  type SecurityGroupItem,
} from '@/api'
import { useClientLang } from '@/hooks/use-client-lang'
import { getErrorMessage } from '@/lib/api'
import { PaginationBar } from '@/features/client/finance/pagination-bar'
import { formatTimeFull } from '@/features/client/finance/shared'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SecurityTabs } from './security-tabs'
import { ConfirmDeleteDialog, SecurityGroupDialog } from './dialogs'

export function SecurityGroupPage() {
  const { t } = useClientLang()

  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  const commonData = commonQuery.data?.data as Record<string, unknown> | undefined

  useEffect(() => {
    const base = (commonData?.website_name as string) || 'FurLL'
    document.title = `${base} - ${t('security_group', '安全组')}`
  }, [commonData, t])

  // ---------- 安全组列表 ----------
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const listQuery = useQuery({
    queryKey: ['client-security-group-list', page, limit],
    queryFn: () =>
      fetchSecurityGroupList({ page, limit, orderby: 'id', sort: 'desc' }),
    retry: false,
  })
  const list = listQuery.data?.data.list ?? []
  const total = listQuery.data?.data.count ?? 0
  const loading = listQuery.isLoading

  // ---------- 创建/编辑弹窗 ----------
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogTitle, setDialogTitle] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [errorText, setErrorText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function openCreate() {
    setDialogTitle(t('create_security_group', '创建安全组'))
    setEditId(null)
    setName('')
    setDescription('')
    setErrorText('')
    setDialogOpen(true)
  }

  function openEdit(item: SecurityGroupItem) {
    setDialogTitle(t('edit_security_group', '编辑安全组'))
    setEditId(item.id)
    setName(item.name)
    setDescription(item.description ?? '')
    setErrorText('')
    setDialogOpen(true)
  }

  function handleSubmit() {
    if (!name.trim()) {
      setErrorText(`${t('placeholder_pre1', '请输入')}${t('security_label1', '名称')}`)
      return
    }
    setErrorText('')
    setSubmitting(true)
    const run = editId
      ? updateSecurityGroup(editId, { name: name.trim(), description })
      : createSecurityGroup({ name: name.trim(), description })
    run
      .then((res) => {
        if (res.status === 200) {
          setDialogOpen(false)
          toast.success(res.msg || t('success_message', '操作成功'))
          listQuery.refetch()
        } else {
          setErrorText(res.msg)
        }
      })
      .catch((err) => setErrorText(getErrorMessage(err)))
      .finally(() => setSubmitting(false))
  }

  // ---------- 删除 ----------
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteItem, setDeleteItem] = useState<SecurityGroupItem | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

  function handleDeleteSubmit() {
    if (!deleteItem) return
    setDeleteSubmitting(true)
    deleteSecurityGroup(deleteItem.id)
      .then((res) => {
        if (res.status === 200) {
          setDeleteOpen(false)
          toast.success(res.msg || t('success_message', '操作成功'))
          listQuery.refetch()
        } else {
          toast.error(res.msg)
        }
      })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setDeleteSubmitting(false))
  }

  return (
    <div className='space-y-4'>
      <div className='mb-2'>
        <h1 className='text-2xl font-bold tracking-tight'>
          {t('security_title', '安全')}
        </h1>
        <div className='text-sm text-muted-foreground'>
          {t('security_group', '安全组')}
        </div>
      </div>

      <SecurityTabs active='4' />

      <Card className='p-5 sm:p-6'>
        <div className='flex items-center justify-between'>
          <Button onClick={openCreate}>
            <Plus className='mr-1 h-4 w-4' />
            {t('create_security_group', '创建安全组')}
          </Button>
        </div>

        <div className='mt-4 overflow-hidden rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-48'>
                  {t('security_label1', '名称')}
                </TableHead>
                <TableHead className='w-24'>
                  {t('cloud_menu_1', '实例')}
                </TableHead>
                <TableHead className='w-24'>
                  {t('rules', '规则')}
                </TableHead>
                <TableHead className='min-w-[200px]'>
                  {t('security_label8', '描述')}
                </TableHead>
                <TableHead className='w-44'>
                  {t('account_label10', '创建时间')}
                </TableHead>
                <TableHead className='w-24 text-right'>
                  {t('security_label3', '操作')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className='h-4 w-full' />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : list.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className='h-40 text-center text-sm text-muted-foreground'
                  >
                    {t('subaccount_text55', '暂无信息')}
                  </TableCell>
                </TableRow>
              ) : (
                list.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className='text-sm'>
                      <Link
                        to='/group_rules.htm'
                        search={{ id: item.id }}
                        className='text-primary hover:underline'
                      >
                        {item.name}
                      </Link>
                    </TableCell>
                    <TableCell className='text-sm'>{item.host_num}</TableCell>
                    <TableCell className='text-sm'>{item.rule_num}</TableCell>
                    <TableCell className='max-w-[300px] truncate text-sm text-muted-foreground'>
                      <span title={item.description}>{item.description || '--'}</span>
                    </TableCell>
                    <TableCell className='text-sm text-muted-foreground'>
                      {formatTimeFull(item.create_time)}
                    </TableCell>
                    <TableCell className='text-right'>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant='ghost' size='icon' className='size-8'>
                            <MoreHorizontal className='h-4 w-4' />
                            <span className='sr-only'>操作</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end'>
                          <DropdownMenuItem asChild>
                            <Link
                              to='/group_rules.htm'
                              search={{ id: item.id }}
                            >
                              {t('coin_text78', '详情')}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(item)}>
                            {t('edit', '编辑')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setDeleteItem(item)
                              setDeleteOpen(true)
                            }}
                          >
                            {t('security_btn4', '删除')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <PaginationBar
          page={page}
          limit={limit}
          total={total}
          onPageChange={setPage}
          onLimitChange={(v) => {
            setLimit(v)
            setPage(1)
          }}
        />
      </Card>

      {/* 创建/编辑安全组弹窗 */}
      <SecurityGroupDialog
        open={dialogOpen}
        title={dialogTitle}
        name={name}
        description={description}
        errorText={errorText}
        submitting={submitting}
        onChange={(patch) => {
          if (patch.name !== undefined) setName(patch.name)
          if (patch.description !== undefined) setDescription(patch.description)
        }}
        onSubmit={handleSubmit}
        onClose={() => setDialogOpen(false)}
      />

      {/* 删除安全组弹窗 */}
      <ConfirmDeleteDialog
        open={deleteOpen}
        title={t('del_group', '删除安全组')}
        name={deleteItem?.name ?? ''}
        submitting={deleteSubmitting}
        onConfirm={handleDeleteSubmit}
        onClose={() => setDeleteOpen(false)}
      />
    </div>
  )
}
