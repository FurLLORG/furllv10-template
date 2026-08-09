import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MoreHorizontal, Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  createSshKey,
  deleteSshKey,
  fetchCommon,
  fetchSshKeyList,
  updateSshKey,
  type SshKeyItem,
} from '@/api'
import { useClientLang } from '@/hooks/use-client-lang'
import { getErrorMessage } from '@/lib/api'
import { PaginationBar } from '@/features/client/finance/pagination-bar'
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
import { ConfirmDeleteDialog, SshKeyDialog } from './dialogs'

export function SshKeyPage() {
  const { t } = useClientLang()

  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  const commonData = commonQuery.data?.data as Record<string, unknown> | undefined

  useEffect(() => {
    const base = (commonData?.website_name as string) || 'FurLL'
    document.title = `${base} - ${t('security_tab1', 'SSH密钥')}`
  }, [commonData, t])

  // ---------- SSH密钥列表 ----------
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const listQuery = useQuery({
    queryKey: ['client-ssh-key-list', page, limit],
    queryFn: () =>
      fetchSshKeyList({ page, limit, orderby: 'id', sort: 'desc' }),
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
  const [publicKey, setPublicKey] = useState('')
  const [errorText, setErrorText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function openCreate() {
    setDialogTitle(t('security_btn10', '创建SSH密钥'))
    setEditId(null)
    setName('')
    setPublicKey('')
    setErrorText('')
    setDialogOpen(true)
  }

  function openEdit(item: SshKeyItem) {
    setDialogTitle(t('security_title6', '编辑SSH密钥'))
    setEditId(item.id)
    setName(item.name)
    setPublicKey(item.public_key ?? '')
    setErrorText('')
    setDialogOpen(true)
  }

  function handleSubmit() {
    if (!name.trim()) {
      setErrorText(editId ? t('security_tips10', '请输入修改后的名称') : t('security_tips12', '请输入名称'))
      return
    }
    if (!publicKey.trim()) {
      setErrorText(editId ? t('security_tips11', '请输入修改后的公钥') : t('security_tips13', '请输入公钥'))
      return
    }
    setErrorText('')
    setSubmitting(true)
    const run = editId
      ? updateSshKey(editId, { name: name.trim(), public_key: publicKey })
      : createSshKey({ name: name.trim(), public_key: publicKey })
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
  const [deleteItem, setDeleteItem] = useState<SshKeyItem | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

  function handleDeleteSubmit() {
    if (!deleteItem) return
    setDeleteSubmitting(true)
    deleteSshKey(deleteItem.id)
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
          {t('security_tips6', '密钥将用于创建实例时使用，您可以使用您的私钥登陆云服务器')}
        </div>
      </div>

      <SecurityTabs active='2' />

      <Card className='p-5 sm:p-6'>
        <div className='flex items-center justify-between'>
          <Button onClick={openCreate}>
            <Plus className='mr-1 h-4 w-4' />
            {t('security_btn2', '创建密钥')}
          </Button>
        </div>

        <div className='mt-4 overflow-hidden rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-64'>
                  {t('security_label1', '名称')}
                </TableHead>
                <TableHead className='min-w-[240px]'>
                  {t('security_label10', '指纹')}
                </TableHead>
                <TableHead className='w-24 text-right'>
                  {t('finance_label6', '操作')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 3 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className='h-4 w-full' />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : list.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className='h-40 text-center text-sm text-muted-foreground'
                  >
                    {t('subaccount_text55', '暂无信息')}
                  </TableCell>
                </TableRow>
              ) : (
                list.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className='max-w-[300px] truncate text-sm'>
                      <span title={item.name}>{item.name}</span>
                    </TableCell>
                    <TableCell className='max-w-[400px] truncate text-sm text-muted-foreground'>
                      <span title={item.finger_print}>{item.finger_print}</span>
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
                          <DropdownMenuItem onClick={() => openEdit(item)}>
                            {t('security_tips8', '编辑')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setDeleteItem(item)
                              setDeleteOpen(true)
                            }}
                          >
                            {t('security_tips9', '删除')}
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

      {/* 创建/编辑SSH密钥弹窗 */}
      <SshKeyDialog
        open={dialogOpen}
        title={dialogTitle}
        name={name}
        publicKey={publicKey}
        errorText={errorText}
        submitting={submitting}
        onChange={(patch) => {
          if (patch.name !== undefined) setName(patch.name)
          if (patch.public_key !== undefined) setPublicKey(patch.public_key)
        }}
        onSubmit={handleSubmit}
        onClose={() => setDialogOpen(false)}
      />

      {/* 删除弹窗 */}
      <ConfirmDeleteDialog
        open={deleteOpen}
        title={t('security_title5', '删除SSH密钥')}
        name={deleteItem?.name ?? ''}
        submitting={deleteSubmitting}
        onConfirm={handleDeleteSubmit}
        onClose={() => setDeleteOpen(false)}
      />
    </div>
  )
}
