import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  FileText,
  ImagePlus,
  Loader2,
  MoreHorizontal,
  PackageCheck,
  Search as SearchIcon,
  X,
} from 'lucide-react'
import { fetchCertificationInfo, uploadTicketFile } from '@/api'
import {
  cancelContract,
  downloadContract,
  fetchContractList,
  fetchPartInfo,
  mailContract,
  previewContract,
  savePartInfo,
  type ContractItem,
} from '@/api/finance'
import { getErrorMessage } from '@/lib/api'
import { useAddons } from '@/hooks/use-addons'
import { useClientLang } from '@/hooks/use-client-lang'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { navigateHref, PaginationBar } from './shared'

interface ContractTabProps {
  /** 邮递纸质合同生成订单后回调父级打开支付弹窗（可选，自包含时忽略） */
  onPay?: (orderId: number) => void
}

interface PartInfoForm {
  name: string
  financial_id: string
  contact_phone: string
  financial_contact_email: string
  contact_address: string
  company_seal: string
  company_seal_url: string
  is_save: boolean
}

/** 快递信息字段兜底（ContractItem 走 index signature，值为 unknown） */
function recText(v: unknown): string {
  return v == null || v === '' ? '--' : String(v)
}

const EMPTY_PART_INFO: PartInfoForm = {
  name: '',
  financial_id: '',
  contact_phone: '',
  financial_contact_email: '',
  contact_address: '',
  company_seal: '',
  company_seal_url: '',
  is_save: false,
}

/**
 * 财务中心-电子合同（官方 finance.php 合同管理 tab，EContract 插件）。
 * GET /e_contract 列表 + 甲方信息管理 / 申请合同 / 签署 / 预览 / 下载 / 邮递纸质合同 / 取消申请 / 快递信息。
 */
export default function ContractTab({ onPay }: ContractTabProps = {}) {
  const { t } = useClientLang()
  const { addons } = useAddons()

  const eContractId = useMemo(
    () => addons.find((a) => a.name === 'EContract')?.id ?? null,
    [addons]
  )
  const hasCertificationPlugin = useMemo(
    () => addons.some((a) => a.name === 'IdcsmartCertification'),
    [addons]
  )

  // ---------- 列表 ----------
  const [keyword, setKeyword] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  const listQuery = useQuery({
    queryKey: ['contract-list', page, limit, appliedKeyword],
    queryFn: () =>
      fetchContractList({
        page,
        limit,
        keywords: appliedKeyword || undefined,
      }),
    retry: false,
  })
  const list = listQuery.data?.data.list ?? []
  const total = listQuery.data?.data.count ?? 0

  // ---------- 甲方信息管理 ----------
  const [infoOpen, setInfoOpen] = useState(false)
  const [infoLoading, setInfoLoading] = useState(false)
  const [infoSaving, setInfoSaving] = useState(false)
  const [sealUploading, setSealUploading] = useState(false)
  const [infoForm, setInfoForm] = useState<PartInfoForm>(EMPTY_PART_INFO)
  const [infoErrors, setInfoErrors] = useState<Record<string, string>>({})
  const sealInputRef = useRef<HTMLInputElement>(null)

  // ---------- 邮递纸质合同 ----------
  const [mailOpen, setMailOpen] = useState(false)
  const [mailing, setMailing] = useState(false)
  const [mailForm, setMailForm] = useState({
    id: 0,
    rec_person: '',
    rec_address: '',
    rec_phone: '',
  })
  const [mailErrors, setMailErrors] = useState<Record<string, string>>({})

  // ---------- 取消申请 / 快递信息 ----------
  const [cancelId, setCancelId] = useState<number | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [recData, setRecData] = useState<ContractItem | null>(null)

  // 合同状态（官方 contractStatusObj）
  const contractStatusObj: Record<
    string,
    { label: string; color: string; background: string }
  > = {
    no_sign: {
      label: t('finance_text105', '未签订'),
      color: 'rgba(117, 117, 117, 1)',
      background: 'rgba(117, 117, 117, 0)',
    },
    review: {
      label: t('finance_text106', '审核中'),
      color: 'rgba(249, 150, 0, 1)',
      background: 'rgba(249, 150, 0, 0.12)',
    },
    complete: {
      label: t('finance_text107', '已签订'),
      color: 'rgba(61, 213, 152, 1)',
      background: 'rgba(61, 213, 152, 0.12)',
    },
    wait_mail: {
      label: t('finance_text108', '待邮寄'),
      color: 'rgba(54, 153, 255, 1)',
      background: 'rgba(54, 153, 255, 0.12)',
    },
    reject: {
      label: t('finance_text109', '已驳回'),
      color: 'rgba(240, 20, 47, 1)',
      background: 'rgba(240, 20, 47, 0.08)',
    },
    cancel: {
      label: t('finance_text110', '已作废'),
      color: 'rgba(117, 117, 117, 1)',
      background: 'rgba(238, 238, 238, 1)',
    },
  }

  // 产品状态（官方 status，handelHostName 拼接用）
  const hostStatusObj: Record<string, string> = {
    Unpaid: t('finance_text3', '未付款'),
    Pending: t('finance_text88', '开通中'),
    Active: t('finance_text89', '使用中'),
    Suspended: t('finance_text90', '暂停'),
    Deleted: t('finance_text91', '删除'),
    Failed: t('finance_text92', '开通失败'),
  }

  function handelHostName(host?: ContractItem['host']): string {
    if (!host || host.length === 0) return '--'
    return host
      .map((item) => {
        const statusText = hostStatusObj[item.status ?? ''] ?? item.status
        if (item.name) {
          return `${item.product_name ?? '--'}-${item.name}-${statusText ?? '--'}`
        }
        return `${item.product_name ?? '--'}-${statusText ?? '--'}`
      })
      .join('、')
  }

  // ---------- 工具栏 ----------
  function submitSearch() {
    setAppliedKeyword(keyword.trim())
    setPage(1)
  }

  async function handleApplyOrder() {
    if (hasCertificationPlugin) {
      const res = await fetchCertificationInfo().catch(() => null)
      const certified = res?.data?.is_certification === 1
      if (!certified) {
        toast.warning(t('finance_text120', '请先完成实名认证'))
        return
      }
    }
    if (eContractId == null) {
      toast.error('电子合同插件未安装')
      return
    }
    navigateHref(`/plugin/${eContractId}/applyContract.htm`)
  }

  // ---------- 甲方信息管理 ----------
  function openInfo() {
    setInfoErrors({})
    setInfoOpen(true)
    setInfoLoading(true)
    fetchPartInfo()
      .then((res) => {
        const data = (res.data ?? {}) as Record<string, unknown>
        setInfoForm({
          name: String(data.name ?? ''),
          financial_id: String(data.financial_id ?? data.id_number ?? ''),
          contact_phone: String(data.contact_phone ?? ''),
          financial_contact_email: String(data.contact_email ?? ''),
          contact_address: String(data.contact_address ?? ''),
          company_seal: String(data.company_seal ?? ''),
          company_seal_url: String(data.company_seal_url ?? ''),
          is_save: Boolean(data.is_save),
        })
      })
      .catch((error) => toast.error(getErrorMessage(error)))
      .finally(() => setInfoLoading(false))
  }

  async function handleSealUpload(file?: File) {
    if (!file || sealUploading) return
    const isImage = ['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)
    if (!isImage) {
      toast.error(t('finance_text152', '签章图片格式只能是 JPG 或 PNG！'))
      return
    }
    if (file.size / 1024 / 1024 >= 3) {
      toast.error(t('finance_text153', '签章图片大小不能超过 3MB！'))
      return
    }
    setSealUploading(true)
    try {
      const res = await uploadTicketFile(file)
      if (res.status === 200 && res.data.save_name) {
        setInfoForm((prev) => ({
          ...prev,
          company_seal: res.data.save_name,
          company_seal_url: res.data.image_url ?? res.data.image_base64 ?? '',
        }))
        toast.success(t('finance_text154', '签章上传成功'))
      } else {
        toast.error(res.msg || t('finance_text155', '签章上传失败'))
      }
    } catch (error) {
      toast.error(getErrorMessage(error, t('finance_text155', '签章上传失败')))
    } finally {
      setSealUploading(false)
    }
  }

  function handleSealDelete() {
    setInfoForm((prev) => ({ ...prev, company_seal: '', company_seal_url: '' }))
    toast.success(t('finance_text157', '签章已删除'))
  }

  async function saveInfo() {
    if (infoSaving) return
    const nextErrors: Record<string, string> = {}
    if (!infoForm.name.trim()) {
      nextErrors.name = t('finance_text114', '请输入甲方名称')
    }
    if (!infoForm.financial_id.trim()) {
      nextErrors.financial_id = t('finance_text115', '请输入证件号码')
    }
    setInfoErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    setInfoSaving(true)
    try {
      const res = await savePartInfo({
        name: infoForm.name,
        financial_id: infoForm.financial_id,
        contact_phone: infoForm.contact_phone,
        contact_email: infoForm.financial_contact_email,
        contact_address: infoForm.contact_address,
        company_seal: infoForm.company_seal,
        is_save: infoForm.is_save,
      })
      toast.success(res.msg || '保存成功')
      setInfoOpen(false)
      listQuery.refetch()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setInfoSaving(false)
    }
  }

  // ---------- 操作 ----------
  function handelSign(orderId?: number) {
    if (eContractId == null) return
    navigateHref(`/plugin/${eContractId}/signContract.htm?id=${orderId}`)
  }

  function handelDetail(id?: number) {
    if (eContractId == null) return
    navigateHref(`/plugin/${eContractId}/contractDetail.htm?id=${id}`)
  }

  async function handelPreview(id: number) {
    try {
      const res = await previewContract(id)
      if (res.data?.url) window.open(res.data.url)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function handelDownload(id: number) {
    try {
      const res = await downloadContract(id)
      if (res.data?.url) window.open(res.data.url)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  function handelMail(item: ContractItem) {
    setMailErrors({})
    setMailForm({
      id: item.id,
      rec_person: '',
      rec_address: '',
      rec_phone: '',
    })
    setMailOpen(true)
  }

  async function saveMailData() {
    if (mailing) return
    const nextErrors: Record<string, string> = {}
    if (!mailForm.rec_person.trim()) {
      nextErrors.rec_person = t('finance_text111', '请输入收件人姓名')
    }
    if (!mailForm.rec_address.trim()) {
      nextErrors.rec_address = t('finance_text112', '请输入收件人地址')
    }
    if (!mailForm.rec_phone.trim()) {
      nextErrors.rec_phone = t('finance_text113', '请输入收件人电话')
    }
    setMailErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    setMailing(true)
    try {
      const res = await mailContract({
        id: mailForm.id,
        rec_person: mailForm.rec_person,
        rec_address: mailForm.rec_address,
        rec_phone: mailForm.rec_phone,
      })
      setMailOpen(false)
      setMailForm({ id: 0, rec_person: '', rec_address: '', rec_phone: '' })
      const orderId = res.data?.data?.id
      if (orderId && onPay) onPay(orderId)
      toast.success(res.msg || '申请成功')
      listQuery.refetch()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setMailing(false)
    }
  }

  async function saveCancel() {
    if (cancelId == null || cancelling) return
    setCancelling(true)
    try {
      const res = await cancelContract(cancelId)
      toast.success(res.msg || '取消成功')
      setCancelId(null)
      listQuery.refetch()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className='space-y-4'>
      {/* 工具栏 */}
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='flex items-center gap-2'>
          <Button onClick={openInfo}>{t('finance_text24', '甲方信息管理')}</Button>
          <Button onClick={handleApplyOrder}>
            {t('finance_text25', '申请合同')}
          </Button>
        </div>
        <div className='flex items-center gap-2'>
          <div className='relative'>
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
              placeholder={t('finance_text26', '请输入合同ID、产品标识、编号')}
              className='h-9 w-64 pr-7'
            />
            {keyword && (
              <button
                type='button'
                aria-label='清除搜索'
                onClick={() => {
                  setKeyword('')
                  setAppliedKeyword('')
                  setPage(1)
                }}
                className='absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
              >
                <X className='h-4 w-4' />
              </button>
            )}
          </div>
          <Button onClick={submitSearch}>
            <SearchIcon className='mr-1 h-4 w-4' />
            {t('finance_text27', '搜索')}
          </Button>
        </div>
      </div>

      {/* 列表 */}
      <div className='rounded-lg border bg-card'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('finance_text28', '合同ID')}</TableHead>
              <TableHead>{t('finance_text29', '产品内容')}</TableHead>
              <TableHead>{t('finance_text31', '状态')}</TableHead>
              <TableHead className='w-20 text-right'>
                {t('finance_label6', '操作')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQuery.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4}>
                    <Skeleton className='h-6 w-full' />
                  </TableCell>
                </TableRow>
              ))
            ) : listQuery.error ? (
              <TableRow>
                <TableCell colSpan={4} className='h-24 text-center text-sm text-muted-foreground'>
                  {getErrorMessage(listQuery.error)}
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <div className='flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground'>
                    <FileText className='h-8 w-8' />
                    <p>暂无合同</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              list.map((item) => {
                const st = contractStatusObj[item.status ?? ''] ?? {
                  label: item.status ?? '--',
                  color: 'inherit',
                  background: 'transparent',
                }
                return (
                  <TableRow key={item.id}>
                    <TableCell>{item.id}</TableCell>
                    <TableCell className='max-w-xs truncate'>
                      {item.base_contract === 1
                        ? t('finance_text30', '基础合同')
                        : handelHostName(item.host)}
                    </TableCell>
                    <TableCell>
                      <div className='flex items-center gap-2'>
                        <Badge
                          className='border-transparent font-medium'
                          style={{ color: st.color, background: st.background }}
                        >
                          {st.label}
                        </Badge>
                        {item.status === 'reject' && item.reason ? (
                          <span
                            className='max-w-40 truncate text-xs text-destructive'
                            title={item.reason}
                          >
                            {item.reason}
                          </span>
                        ) : null}
                        {item.status === 'complete' && item.post_number ? (
                          <button
                            type='button'
                            title={t('finance_text32', '快递信息')}
                            onClick={() => setRecData(item)}
                            className='text-primary hover:opacity-80'
                          >
                            <PackageCheck className='h-4 w-4' />
                          </button>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className='text-right'>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant='ghost' size='icon' className='h-8 w-8'>
                            <MoreHorizontal className='h-4 w-4' />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end'>
                          {item.status === 'no_sign' ? (
                            <DropdownMenuItem onClick={() => handelSign(item.order_id)}>
                              {t('finance_text33', '签订合同')}
                            </DropdownMenuItem>
                          ) : null}
                          {item.status === 'review' ? (
                            <>
                              <DropdownMenuItem onClick={() => handelDetail(item.id)}>
                                {t('finance_text34', '查看')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setCancelId(item.id)}>
                                {t('finance_text35', '取消')}
                              </DropdownMenuItem>
                            </>
                          ) : null}
                          {item.status === 'complete' || item.status === 'wait_mail' ? (
                            <>
                              <DropdownMenuItem onClick={() => handelPreview(item.id)}>
                                {t('invoice_text41', '预览')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handelDownload(item.id)}>
                                {t('finance_text36', '下载')}
                              </DropdownMenuItem>
                            </>
                          ) : null}
                          {item.status === 'complete' && !item.post_number ? (
                            <DropdownMenuItem onClick={() => handelMail(item)}>
                              {t('finance_text37', '邮递')}
                            </DropdownMenuItem>
                          ) : null}
                          {item.status === 'reject' || item.status === 'cancel' ? (
                            <DropdownMenuItem disabled>--</DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
        {!listQuery.isLoading && !listQuery.error ? (
          <div className='border-t px-2 py-1'>
            <PaginationBar
              page={page}
              limit={limit}
              total={total}
              onPageChange={setPage}
              onLimitChange={(l) => {
                setLimit(l)
                setPage(1)
              }}
            />
          </div>
        ) : null}
      </div>

      {/* 甲方信息管理弹窗 */}
      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>{t('finance_text59', '甲方信息管理')}</DialogTitle>
            <DialogDescription className='space-y-1'>
              <p>{t('finance_text60', '合同签订后具有法律效力！')}</p>
              <p>{t('finance_text61', '请仔细核对您的甲方信息，确认信息的真实和完整。')}</p>
            </DialogDescription>
          </DialogHeader>
          {infoLoading ? (
            <div className='space-y-3'>
              <Skeleton className='h-9 w-full' />
              <Skeleton className='h-9 w-full' />
              <Skeleton className='h-9 w-full' />
              <Skeleton className='h-9 w-full' />
              <Skeleton className='h-9 w-full' />
              <Skeleton className='h-32 w-full' />
            </div>
          ) : (
            <div className='space-y-4'>
              <div className='space-y-1.5'>
                <Label>{t('finance_text64', '甲方名称')}</Label>
                <Input
                  value={infoForm.name}
                  onChange={(e) =>
                    setInfoForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder={t('finance_text65', '请输入')}
                />
                {infoErrors.name ? (
                  <p className='text-xs text-destructive'>{infoErrors.name}</p>
                ) : null}
              </div>
              <div className='space-y-1.5'>
                <Label>{t('finance_text66', '证件号码')}</Label>
                <Input
                  value={infoForm.financial_id}
                  onChange={(e) =>
                    setInfoForm((prev) => ({
                      ...prev,
                      financial_id: e.target.value,
                    }))
                  }
                  placeholder={t('finance_text65', '请输入')}
                />
                {infoErrors.financial_id ? (
                  <p className='text-xs text-destructive'>{infoErrors.financial_id}</p>
                ) : null}
              </div>
              <div className='space-y-1.5'>
                <Label>{t('finance_text67', '联系电话')}</Label>
                <Input
                  value={infoForm.contact_phone}
                  onChange={(e) =>
                    setInfoForm((prev) => ({
                      ...prev,
                      contact_phone: e.target.value,
                    }))
                  }
                  placeholder={t('finance_text65', '请输入')}
                />
              </div>
              <div className='space-y-1.5'>
                <Label>{t('finance_text68', '联系邮箱')}</Label>
                <Input
                  value={infoForm.financial_contact_email}
                  onChange={(e) =>
                    setInfoForm((prev) => ({
                      ...prev,
                      financial_contact_email: e.target.value,
                    }))
                  }
                  placeholder={t('finance_text65', '请输入')}
                />
              </div>
              <div className='space-y-1.5'>
                <Label>{t('finance_text69', '联系地址')}</Label>
                <Input
                  value={infoForm.contact_address}
                  onChange={(e) =>
                    setInfoForm((prev) => ({
                      ...prev,
                      contact_address: e.target.value,
                    }))
                  }
                  placeholder={t('finance_text65', '请输入')}
                />
              </div>
              {/* 企业签章 */}
              <div className='space-y-1.5'>
                <Label>{t('finance_text149', '公司签章')}</Label>
                {infoForm.company_seal_url ? (
                  <div className='flex items-center gap-3'>
                    <img
                      src={infoForm.company_seal_url}
                      alt=''
                      className='h-24 w-24 rounded-md border object-contain'
                    />
                    <div className='flex flex-col gap-2'>
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={() => sealInputRef.current?.click()}
                      >
                        {t('finance_text150', '上传签章')}
                      </Button>
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        className='text-destructive hover:text-destructive'
                        onClick={handleSealDelete}
                      >
                        {t('finance_text157', '删除')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type='button'
                    onClick={() => sealInputRef.current?.click()}
                    className='flex w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed p-6 text-center hover:border-primary/50 hover:bg-muted/40'
                  >
                    <ImagePlus className='h-6 w-6 text-muted-foreground' />
                    <span className='text-sm text-primary'>
                      {t('finance_text150', '上传签章')}
                    </span>
                    <span className='text-xs text-muted-foreground'>
                      {t('finance_text151', '尺寸：300px × 300px，大小：≤3M，格式：JPG/PNG')}
                    </span>
                  </button>
                )}
                <input
                  ref={sealInputRef}
                  type='file'
                  accept='image/jpeg,image/jpg,image/png'
                  hidden
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleSealUpload(e.target.files[0])
                    e.target.value = ''
                  }}
                />
                {sealUploading ? (
                  <p className='flex items-center gap-1 text-xs text-muted-foreground'>
                    <Loader2 className='h-3 w-3 animate-spin' />
                    上传中...
                  </p>
                ) : null}
              </div>
              <div className='flex items-center justify-between gap-2 rounded-md border p-3'>
                <span className='text-xs leading-relaxed text-muted-foreground'>
                  {t('finance_text158', '首次签订需要确认以上信息是否正确，请检查后保存')}
                </span>
                <Switch
                  checked={infoForm.is_save}
                  onCheckedChange={(v) =>
                    setInfoForm((prev) => ({ ...prev, is_save: v }))
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={saveInfo} disabled={infoSaving || infoLoading}>
              {infoSaving ? (
                <Loader2 className='mr-1 h-4 w-4 animate-spin' />
              ) : null}
              {t('finance_text70', '保存')}
            </Button>
            <Button variant='outline' onClick={() => setInfoOpen(false)}>
              {t('finance_text71', '取消')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 申请纸质合同弹窗 */}
      <Dialog open={mailOpen} onOpenChange={setMailOpen}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>{t('finance_text76', '申请纸质合同')}</DialogTitle>
            <DialogDescription>
              {t('finance_text77', '电子合同法律效力等同于纸质合同，您可以直接在线下载打印合同适用，无需申请纸质合同。如业务一定需要纸质合同，请点击“确定”按钮申请纸质盖章合同，我们将在10个工作日内为您邮寄。')}
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-1.5'>
              <Label>{t('finance_text78', '收件人姓名')}</Label>
              <Input
                value={mailForm.rec_person}
                onChange={(e) =>
                  setMailForm((prev) => ({ ...prev, rec_person: e.target.value }))
                }
                placeholder={t('finance_text65', '请输入')}
              />
              {mailErrors.rec_person ? (
                <p className='text-xs text-destructive'>{mailErrors.rec_person}</p>
              ) : null}
            </div>
            <div className='space-y-1.5'>
              <Label>{t('finance_text79', '收件人地址')}</Label>
              <Input
                value={mailForm.rec_address}
                onChange={(e) =>
                  setMailForm((prev) => ({ ...prev, rec_address: e.target.value }))
                }
                placeholder={t('finance_text65', '请输入')}
              />
              {mailErrors.rec_address ? (
                <p className='text-xs text-destructive'>{mailErrors.rec_address}</p>
              ) : null}
            </div>
            <div className='space-y-1.5'>
              <Label>{t('finance_text80', '收件人电话')}</Label>
              <Input
                value={mailForm.rec_phone}
                onChange={(e) =>
                  setMailForm((prev) => ({ ...prev, rec_phone: e.target.value }))
                }
                placeholder={t('finance_text65', '请输入')}
              />
              {mailErrors.rec_phone ? (
                <p className='text-xs text-destructive'>{mailErrors.rec_phone}</p>
              ) : null}
            </div>
          </div>
          <DialogFooter className='sm:justify-between'>
            <div className='flex items-center text-sm'>
              {t('finance_text81', '快递费用')}：
              <span className='text-primary'>￥20.00</span>
            </div>
            <div className='flex gap-2'>
              <Button onClick={saveMailData} disabled={mailing}>
                {mailing ? <Loader2 className='mr-1 h-4 w-4 animate-spin' /> : null}
                {t('finance_text82', '确认申请')}
              </Button>
              <Button variant='outline' onClick={() => setMailOpen(false)}>
                {t('finance_text83', '取消')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 取消申请确认弹窗 */}
      <Dialog
        open={cancelId != null}
        onOpenChange={(open) => !open && setCancelId(null)}
      >
        <DialogContent className='sm:max-w-sm'>
          <DialogHeader>
            <DialogTitle>{t('finance_text72', '取消申请')}</DialogTitle>
            <DialogDescription>
              {t('finance_text73', '撤回申请后，若要再次申请，需重新盖章')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={saveCancel} disabled={cancelling}>
              {cancelling ? <Loader2 className='mr-1 h-4 w-4 animate-spin' /> : null}
              {t('finance_text74', '确认')}
            </Button>
            <Button variant='outline' onClick={() => setCancelId(null)}>
              {t('finance_text75', '取消')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 快递信息弹窗 */}
      <Dialog
        open={recData != null}
        onOpenChange={(open) => !open && setRecData(null)}
      >
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>{t('finance_text51', '快递信息')}</DialogTitle>
            <DialogDescription>
              {t('finance_text52', '您的合同已发出，请注意查收')}
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-2 text-sm'>
            <div className='flex gap-2'>
              <span className='w-16 shrink-0 text-muted-foreground'>
                {t('finance_text53', '快递')}：
              </span>
              <span>{recText(recData?.courier_company)}</span>
            </div>
            <div className='flex gap-2'>
              <span className='w-16 shrink-0 text-muted-foreground'>
                {t('finance_text54', '单号')}：
              </span>
              <span>{recText(recData?.post_number)}</span>
            </div>
            <div className='flex gap-2'>
              <span className='w-16 shrink-0 text-muted-foreground'>
                {t('finance_text55', '地址')}：
              </span>
              <span className='break-all'>{recText(recData?.rec_address)}</span>
            </div>
            <div className='flex gap-2'>
              <span className='w-16 shrink-0 text-muted-foreground'>
                {t('finance_text56', '电话')}：
              </span>
              <span>{recText(recData?.rec_phone)}</span>
            </div>
            <div className='flex gap-2'>
              <span className='w-16 shrink-0 text-muted-foreground'>
                {t('finance_text57', '姓名')}：
              </span>
              <span>{recText(recData?.rec_person)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setRecData(null)}>
              {t('finance_text58', '关闭')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
