import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MoreHorizontal, Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  createApiKey,
  deleteApiKey,
  fetchApiKeyList,
  fetchCommon,
  updateApiWhiteList,
  type ApiKeyItem,
  type CreateApiKeyResult,
} from '@/api'
import { useClientLang } from '@/hooks/use-client-lang'
import { getErrorMessage } from '@/lib/api'
import { formatTimeFull } from '@/features/client/finance/shared'
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
import { useSecurityAccess } from './security-access'
import {
  ConfirmDeleteDialog,
  CreateApiDialog,
  CreateApiSuccessDialog,
  WhiteListDialog,
} from './dialogs'

export function SecurityPage() {
  const { t } = useClientLang()
  const { canApi, loading: accessLoading } = useSecurityAccess()

  // 通用配置（页面标题）
  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  const commonData = commonQuery.data?.data as Record<string, unknown> | undefined

  useEffect(() => {
    const base = (commonData?.website_name as string) || 'FurLL'
    document.title = `${base} - ${t('security_title', '安全')}`
  }, [commonData, t])

  // ---------- API密钥列表 ----------
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const listQuery = useQuery({
    queryKey: ['client-api-key-list', page, limit],
    queryFn: () =>
      fetchApiKeyList({ page, limit, orderby: 'id', sort: 'desc' }),
    enabled: canApi,
    retry: false,
  })
  const list = listQuery.data?.data.list ?? []
  const total = listQuery.data?.data.count ?? 0
  const createApi = listQuery.data?.data.create_api === 1
  const loading = listQuery.isLoading

  // ---------- 创建API弹窗 ----------
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createError, setCreateError] = useState('')
  const [createSubmitting, setCreateSubmitting] = useState(false)

  function openCreateApi() {
    setCreateName('')
    setCreateError('')
    setCreateOpen(true)
  }

  function handleCreateSubmit() {
    if (!createName.trim()) {
      setCreateError('请输入api名称')
      return
    }
    setCreateError('')
    setCreateSubmitting(true)
    createApiKey({ name: createName.trim() })
      .then((res) => {
        if (res.status === 200) {
          setCreateOpen(false)
          setSuccessData(res.data)
          setSavedChecked(false)
          setSuccessError('')
          setSuccessOpen(true)
        } else {
          setCreateError(res.msg)
        }
      })
      .catch((err) => setCreateError(getErrorMessage(err)))
      .finally(() => setCreateSubmitting(false))
  }

  // ---------- 创建成功弹窗（token/私钥仅展示一次） ----------
  const [successOpen, setSuccessOpen] = useState(false)
  const [successData, setSuccessData] = useState<CreateApiKeyResult | null>(null)
  const [savedChecked, setSavedChecked] = useState(false)
  const [successError, setSuccessError] = useState('')

  function handleSuccessSubmit() {
    if (!savedChecked) {
      setSuccessError('请保存信息后勾选')
      return
    }
    setSuccessError('')
    setSuccessOpen(false)
    listQuery.refetch()
  }

  // ---------- 删除弹窗 ----------
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteItem, setDeleteItem] = useState<ApiKeyItem | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

  function handleDeleteSubmit() {
    if (!deleteItem) return
    setDeleteSubmitting(true)
    deleteApiKey(deleteItem.id)
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

  // ---------- IP白名单弹窗 ----------
  const [whiteOpen, setWhiteOpen] = useState(false)
  const [whiteItem, setWhiteItem] = useState<ApiKeyItem | null>(null)
  const [whiteStatus, setWhiteStatus] = useState<0 | 1>(0)
  const [whiteIp, setWhiteIp] = useState('')
  const [whiteError, setWhiteError] = useState('')
  const [whiteSubmitting, setWhiteSubmitting] = useState(false)

  function openWhiteList(item: ApiKeyItem) {
    setWhiteItem(item)
    setWhiteStatus(item.status)
    setWhiteIp(item.ip ?? '')
    setWhiteError('')
    setWhiteOpen(true)
  }

  function handleWhiteSubmit() {
    if (!whiteItem) return
    if (whiteStatus === 1 && !whiteIp.trim()) {
      setWhiteError('请输入ip')
      return
    }
    setWhiteError('')
    setWhiteSubmitting(true)
    updateApiWhiteList({
      id: whiteItem.id,
      // 官方传字符串 status，后端 in:0,1 校验兼容
      status: whiteStatus === 1 ? '1' : '0',
      ip: whiteIp,
    })
      .then((res) => {
        if (res.status === 200) {
          setWhiteOpen(false)
          toast.success(res.msg || t('success_message', '操作成功'))
          listQuery.refetch()
        } else {
          setWhiteError(res.msg)
        }
      })
      .catch((err) => setWhiteError(getErrorMessage(err)))
      .finally(() => setWhiteSubmitting(false))
  }

  return (
    <div className='space-y-4'>
      <div className='mb-2'>
        <h1 className='text-2xl font-bold tracking-tight'>
          {t('security_title', '安全')}
        </h1>
      </div>

      <SecurityTabs active='1' />

      {!accessLoading && canApi ? (
        <Card className='p-5 sm:p-6'>
          {/* 创建API */}
          <div className='flex items-center justify-between'>
            {createApi ? (
              <Button onClick={openCreateApi}>
                <Plus className='mr-1 h-4 w-4' />
                {t('security_btn1', '创建API')}
              </Button>
            ) : (
              <span />
            )}
          </div>

          {/* 表格 */}
          <div className='mt-4 overflow-hidden rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-20'>ID</TableHead>
                  <TableHead className='min-w-[280px]'>
                    {t('security_label1', '名称')}
                  </TableHead>
                  <TableHead className='w-44'>
                    {t('security_label4', '创建时间')}
                  </TableHead>
                  <TableHead className='w-40'>
                    {t('security_label2', 'IP白名单')}
                  </TableHead>
                  <TableHead className='min-w-[200px]'>
                    {t('security_label6', '允许访问的IP')}
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
                      <TableCell className='text-sm'>{item.id}</TableCell>
                      <TableCell className='max-w-[320px] truncate text-sm'>
                        <span title={item.name}>{item.name}</span>
                      </TableCell>
                      <TableCell className='text-sm text-muted-foreground'>
                        {formatTimeFull(item.create_time)}
                      </TableCell>
                      <TableCell>
                        <div className='flex items-center gap-2'>
                          <span
                            className={
                              item.status === 1
                                ? 'rounded bg-blue-100 px-1.5 py-0.5 text-xs text-primary dark:bg-blue-900/50'
                                : 'rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground'
                            }
                          >
                            {item.status === 1
                              ? t('security_text1', '已开启')
                              : t('security_text2', '未开启')}
                          </span>
                          <button
                            type='button'
                            className='text-sm text-primary hover:underline'
                            onClick={() => openWhiteList(item)}
                          >
                            {t('security_btn3', '设置')}
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className='max-w-[260px] truncate text-sm text-muted-foreground'>
                        <span title={item.status === 1 ? item.ip : undefined}>
                          {item.status === 1 && item.ip ? item.ip : '--'}
                        </span>
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
      ) : null}

      {/* 创建API弹窗 */}
      <CreateApiDialog
        open={createOpen}
        submitting={createSubmitting}
        errorText={createError}
        value={createName}
        onChange={setCreateName}
        onSubmit={handleCreateSubmit}
        onClose={() => setCreateOpen(false)}
      />

      {/* 创建API成功弹窗 */}
      <CreateApiSuccessDialog
        open={successOpen}
        data={successData}
        checked={savedChecked}
        errorText={successError}
        onCheckedChange={setSavedChecked}
        onSubmit={handleSuccessSubmit}
        onClose={() => setSuccessOpen(false)}
      />

      {/* 删除弹窗 */}
      <ConfirmDeleteDialog
        open={deleteOpen}
        title={t('security_title3', '删除API')}
        name={deleteItem?.name ?? ''}
        submitting={deleteSubmitting}
        onConfirm={handleDeleteSubmit}
        onClose={() => setDeleteOpen(false)}
      />

      {/* IP白名单设置弹窗 */}
      <WhiteListDialog
        open={whiteOpen}
        status={whiteStatus}
        ip={whiteIp}
        errorText={whiteError}
        submitting={whiteSubmitting}
        onChange={(patch) => {
          if (patch.status !== undefined) setWhiteStatus(patch.status)
          if (patch.ip !== undefined) setWhiteIp(patch.ip)
        }}
        onSubmit={handleWhiteSubmit}
        onClose={() => setWhiteOpen(false)}
      />
    </div>
  )
}
