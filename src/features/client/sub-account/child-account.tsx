import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { MoreHorizontal, Plus, Users } from 'lucide-react'
import { toast } from 'sonner'
import {
  changeSubAccountStatus,
  deleteSubAccount,
  fetchAccount,
  fetchCommon,
  fetchSubAccounts,
  type SubAccountItem,
} from '@/api'
import { useAddons } from '@/hooks/use-addons'
import { useSubAccountLang } from '@/hooks/use-sub-account-lang'
import { getErrorMessage } from '@/lib/api'
import { PaginationBar, formatTime } from '@/features/client/finance/shared'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import { cn } from '@/lib/utils'

type ConfirmAction = 'disable' | 'enable' | 'delete' | null

/**
 * 子账户列表（childAccount.htm，官方 IdcsmartSubAccount 插件）。
 * 主账户可见「新增子账户」与操作列；子账户登录仅可查看列表。
 * 官方 GET /console/v1/sub_account 列表 + PUT /sub_account/:id/status + DELETE /sub_account/:id。
 */
export function ChildAccountPage() {
  const { t } = useSubAccountLang()

  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  const websiteName = (commonQuery.data?.data as { website_name?: string } | undefined)?.website_name || 'FurLL'

  useEffect(() => {
    document.title = `${websiteName} - ${t('subaccount_text46', '子账户列表')}`
  }, [websiteName, t])

  // 是否主账户（子账户无新增/操作权限，官方 localStorage.is_sub_account）
  const accountQuery = useQuery({
    queryKey: ['client-account'],
    queryFn: fetchAccount,
    retry: false,
  })
  const isSubAccount =
    (accountQuery.data?.data?.account as { customfield?: { is_sub_account?: number } } | undefined)
      ?.customfield?.is_sub_account === 1

  // 子账户插件 id（/rtapi/addons.php 反查），新增/编辑走官方插件入口 /plugin/<id>/addChildAccount.htm
  const { addons } = useAddons()
  const subAccountPluginId = useMemo(
    () => addons.find((a) => a.name.toLowerCase() === 'idcsmartsubaccount')?.id ?? null,
    [addons]
  )
  const addChildUrl = useMemo(
    () =>
      subAccountPluginId
        ? `/plugin/${subAccountPluginId}/addChildAccount.htm`
        : '/addChildAccount.htm',
    [subAccountPluginId]
  )

  // ---------- 列表 ----------
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const listQuery = useQuery({
    queryKey: ['client-sub-account-list', page, limit],
    queryFn: () =>
      fetchSubAccounts({ page, limit, orderby: 'id', sort: 'desc' }),
    retry: false,
  })
  const list = listQuery.data?.data?.list ?? []
  const total = listQuery.data?.data?.count ?? 0
  const loading = listQuery.isLoading

  // ---------- 确认弹窗 ----------
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [target, setTarget] = useState<SubAccountItem | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function openConfirm(action: Exclude<ConfirmAction, null>, item: SubAccountItem) {
    setTarget(item)
    setConfirmAction(action)
  }

  function handleConfirm() {
    if (!confirmAction || !target) return
    setSubmitting(true)
    const run =
      confirmAction === 'delete'
        ? deleteSubAccount(target.id)
        : changeSubAccountStatus(target.id, confirmAction === 'enable' ? 1 : 0)
    run
      .then((res) => {
        if (res.status === 200) {
          toast.success(
            confirmAction === 'delete'
              ? t('subaccount_text53', '删除成功')
              : t('subaccount_text44', '修改成功')
          )
          setConfirmAction(null)
          listQuery.refetch()
        } else {
          toast.error(res.msg)
        }
      })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setSubmitting(false))
  }

  const confirmTitle =
    confirmAction === 'delete'
      ? t('subaccount_text49', '提示')
      : t('subaccount_text49', '提示')
  const confirmText =
    confirmAction === 'disable'
      ? t('subaccount_text47', '此操作将停用该子账户, 是否继续')
      : confirmAction === 'enable'
        ? t('subaccount_text48', '此操作将启用该子账户, 是否继续')
        : t('subaccount_text52', '此操作将永久删除该子账户, 是否继续?')

  return (
    <div className='space-y-4'>
      <div className='mb-2'>
        <h1 className='text-2xl font-bold tracking-tight'>
          {t('subaccount_text33', '子账户列表')}
        </h1>
        <div className='text-sm text-muted-foreground'>
          {t('subaccount_text43', '子账户')}
        </div>
      </div>

      <Card className='p-0'>
        <CardContent className='p-5 sm:p-6'>
          <div className='flex items-center justify-between'>
            <div className='text-sm text-muted-foreground'>
              {t('subaccount_text33', '子账户列表')}
            </div>
            {!isSubAccount && (
              <Button asChild>
                <Link to={addChildUrl}>
                  <Plus className='mr-1 h-4 w-4' />
                  {t('subaccount_text34', '新增子账户')}
                </Link>
              </Button>
            )}
          </div>

          <div className='mt-4 overflow-hidden rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-24'>ID</TableHead>
                  <TableHead className='min-w-[160px]'>
                    {t('subaccount_text35', '账户')}
                  </TableHead>
                  <TableHead className='min-w-[160px]'>
                    {t('subaccount_text36', '上次登录时间')}
                  </TableHead>
                  {!isSubAccount && (
                    <TableHead className='w-32 text-right'>
                      {t('subaccount_text37', '操作')}
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className='h-4 w-8' /></TableCell>
                      <TableCell><Skeleton className='h-4 w-32' /></TableCell>
                      <TableCell><Skeleton className='h-4 w-32' /></TableCell>
                      {!isSubAccount && (
                        <TableCell><Skeleton className='h-4 w-8' /></TableCell>
                      )}
                    </TableRow>
                  ))
                ) : list.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={isSubAccount ? 3 : 4}
                      className='h-40 text-center text-sm text-muted-foreground'
                    >
                      <Users className='mx-auto mb-2 h-8 w-8 opacity-40' />
                      {t('subaccount_text55', '暂无信息')}
                    </TableCell>
                  </TableRow>
                ) : (
                  list.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className='text-sm tabular-nums'>{item.id}</TableCell>
                      <TableCell className='text-sm'>
                        <span className='inline-flex items-center gap-1.5'>
                          {item.username}
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.5 text-xs',
                              item.status
                                ? 'bg-primary/10 text-primary'
                                : 'bg-muted text-muted-foreground'
                            )}
                          >
                            {item.status
                              ? t('subaccount_text39', '启用')
                              : t('subaccount_text38', '停用')}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className='text-sm text-muted-foreground'>
                        {formatTime(item.last_action_time)}
                      </TableCell>
                      {!isSubAccount && (
                        <TableCell className='text-right'>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant='ghost' size='icon' className='size-8'>
                                <MoreHorizontal className='h-4 w-4' />
                                <span className='sr-only'>操作</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align='end'>
                              {item.status ? (
                                <DropdownMenuItem onClick={() => openConfirm('disable', item)}>
                                  {t('subaccount_text38', '停用')}
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => openConfirm('enable', item)}>
                                  {t('subaccount_text39', '启用')}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem asChild>
                                <Link
                                  to={addChildUrl}
                                  search={{ id: item.id, type: 'edit' }}
                                >
                                  {t('subaccount_text40', '编辑')}
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => openConfirm('delete', item)}
                              >
                                {t('subaccount_text41', '删除')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
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
        </CardContent>
      </Card>

      {/* 停用/启用/删除确认 */}
      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmText}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('subaccount_text51', '取消')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={submitting}>
              {t('subaccount_text50', '确定')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
