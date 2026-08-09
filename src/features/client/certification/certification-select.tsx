import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { BadgeCheck, Building2, ChevronRight, Clock, Loader2, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import {
  createCertificationOrder,
  fetchCertificationConfig,
  fetchCertificationInfo,
  fetchCertificationPlugins,
  fetchCommon,
  type CertificationConfigData,
  type CertificationInfoData,
  type CertificationPluginItem,
} from '@/api'
import { useCertificationLang } from '@/hooks/use-certification-lang'
import { getErrorMessage } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PayDialog } from '@/features/client/finance/pay-dialog'
import { ProofDialog } from '@/features/client/finance/proof-dialog'
import { Button } from '@/components/ui/button'
import { useCertificationNav } from './nav'
import { typeCardSelected } from './certification-utils'

/** 线下支付/人工审核类订单状态（官方 statusArr，命中走凭证弹窗） */
const PAY_SPECIAL = ['WaitUpload', 'WaitReview', 'ReviewFail']

type CertType = '1' | '2'

/**
 * 实名认证选择页（authentication_select.htm / plugin/<id>/authentication_select.htm）。
 * 官方 authenticationSelect.js：认证类型（个人/企业）→ 认证方式（实名接口下拉）→
 * 免费次数用尽需先支付（PayDialog）或线下上传凭证（ProofDialog）→ 下一步进入资料填写页。
 */
export function CertificationSelectPage() {
  const navigate = useNavigate()
  const { t } = useCertificationLang()
  const { personUrl, companyUrl } = useCertificationNav()

  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  const commonData = (commonQuery.data?.data ?? {}) as Record<string, unknown>
  const currencySuffix = (commonData.currency_suffix as string) ?? ''
  const websiteName = (commonData.website_name as string) ?? 'FurLL'

  const [info, setInfo] = useState<CertificationInfoData | null>(null)
  const [personPluginList, setPersonPluginList] = useState<CertificationPluginItem[]>([])
  const [companyPluginList, setCompanyPluginList] = useState<CertificationPluginItem[]>([])
  const [type, setType] = useState<CertType>('1')
  const [checkedPlugin, setCheckedPlugin] = useState('')
  const [configInfo, setConfigInfo] = useState<CertificationConfigData | null>(null)
  const [configLoading, setConfigLoading] = useState(false)
  const [loading, setLoading] = useState(true)

  const [payOrderId, setPayOrderId] = useState<number | null>(null)
  const [payOpen, setPayOpen] = useState(false)
  const [proofOrderId, setProofOrderId] = useState<number | null>(null)
  const [proofOpen, setProofOpen] = useState(false)

  useEffect(() => {
    document.title = `${websiteName} - ${t('realname_text1', '实名认证')}`
  }, [websiteName, t])

  const personStatus = Number(info?.person?.status ?? 0)
  const companyNeedPerson = Number(info?.certification_company_need_person ?? 0) === 1

  const currentPlugins = useMemo(
    () => (type === '1' ? personPluginList : companyPluginList),
    [type, personPluginList, companyPluginList]
  )

  /** 是否展示「支付并认证」（官方 isShowPay + statusArr 分支） */
  const isShowPay =
    (configInfo?.order?.status === 'Unpaid') ||
    (configInfo?.order != null && !configInfo.order.id && configInfo.pay === 1) ||
    (configInfo?.order?.status != null && PAY_SPECIAL.includes(configInfo.order.status))

  async function getConfig(name: string, t: CertType) {
    try {
      const res = await fetchCertificationConfig({
        name,
        type: t === '1' ? 'person' : 'company',
      })
      if (res.status === 200) setConfigInfo(res.data)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  // 初始化：基础信息 + 认证接口列表，按已认证状态确定默认类型
  useEffect(() => {
    let active = true
    Promise.all([fetchCertificationInfo(), fetchCertificationPlugins()])
      .then(([infoRes, pluginRes]) => {
        if (!active) return
        const infoData = infoRes.data ?? {}
        setInfo(infoData)
        const list = pluginRes.data?.list ?? []
        const person: CertificationPluginItem[] = []
        const company: CertificationPluginItem[] = []
        for (const item of list) {
          if (item.certification_type?.includes('person')) person.push(item)
          if (item.certification_type?.includes('company')) company.push(item)
        }
        setPersonPluginList(person)
        setCompanyPluginList(company)
        if (Number(infoData.company?.status ?? 0) === 1) {
          navigate({ to: '/authentication_status.htm', search: { type: '2' } })
          return
        }
        const nextType: CertType =
          Number(infoData.person?.status ?? 0) === 1 ? '2' : '1'
        setType(nextType)
        const plugins = nextType === '1' ? person : company
        setCheckedPlugin(plugins[0]?.name ?? '')
        if (plugins[0]?.name) void getConfig(plugins[0].name, nextType)
      })
      .catch((error) => toast.error(getErrorMessage(error)))
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function clickType(val: CertType) {
    if (val === '1' && personStatus === 1) return
    if (companyNeedPerson && val === '2' && personStatus !== 1) {
      toast.warning(t('realname_text88', '请先完成个人实名认证'))
      return
    }
    setType(val)
    const plugins = val === '1' ? personPluginList : companyPluginList
    setCheckedPlugin(plugins[0]?.name ?? '')
    if (plugins[0]?.name) void getConfig(plugins[0].name, val)
  }

  function selectPlugin(name: string) {
    setCheckedPlugin(name)
    void getConfig(name, type)
  }

  async function goUploadPage() {
    if (!checkedPlugin) {
      toast.warning(t('realname_text82', '请先选择认证类型!'))
      return
    }
    setConfigLoading(true)
    try {
      const res = await fetchCertificationConfig({
        name: checkedPlugin,
        type: type === '1' ? 'person' : 'company',
      })
      const config = res.data
      setConfigInfo(config)
      const status = config.order?.status
      if (status && PAY_SPECIAL.includes(status)) {
        if (config.order?.id) {
          setProofOrderId(config.order.id)
          setProofOpen(true)
        }
        return
      }
      if (status === 'Unpaid' && config.order?.id) {
        setPayOrderId(config.order.id)
        setPayOpen(true)
        return
      }
      if (!config.order?.id && config.pay === 1) {
        const orderRes = await createCertificationOrder({
          name: checkedPlugin,
          type: type === '1' ? 'person' : 'company',
        })
        setPayOrderId(orderRes.data.order_id)
        setPayOpen(true)
        return
      }
      const url = type === '1' ? personUrl : companyUrl
      navigate({ to: url, search: { name: checkedPlugin } })
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setConfigLoading(false)
    }
  }

  function handlePaySuccess() {
    setPayOpen(false)
    void goUploadPage()
  }

  function handleProofRefresh(changed: boolean, id?: number) {
    if (changed && id) {
      setProofOpen(false)
      setPayOrderId(id)
      setPayOpen(true)
    }
    setProofOpen(false)
    void goUploadPage()
  }

  const showPaidTip =
    configInfo?.order?.status === 'Paid'

  return (
    <div className='mx-auto max-w-3xl space-y-4'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>
          {t('realname_text23', '实名认证')}
        </h1>
        <div className='mt-1 text-sm text-muted-foreground'>
          {t('realname_text24', '认证类型')}
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className='flex min-h-72 items-center justify-center'>
            <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 认证类型 */}
          <div className='grid gap-4 sm:grid-cols-2'>
            <div
              role='button'
              tabIndex={0}
              onClick={() => clickType('1')}
              onKeyDown={(e) => e.key === 'Enter' && clickType('1')}
              className={typeCardSelected(type === '1')}
            >
              <div className='flex items-start justify-between gap-2'>
                <div className='flex items-center gap-2'>
                  <UserRound className='h-5 w-5 text-primary' />
                  <span className='font-medium'>{t('realname_text25', '个人认证')}</span>
                </div>
                {personStatus === 1 && (
                  <BadgeCheck className='h-5 w-5 text-emerald-500' />
                )}
              </div>
              <p className='mt-2 text-sm text-muted-foreground'>
                {t('realname_text26', '个人实名认证适用于个人用户，账号归属个人，认证时请提供真实姓名、证件号码、证件照等个人资料，并确保提供的资料真实有效。')}
              </p>
              {personStatus === 1 ? (
                <span className='mt-3 inline-flex items-center gap-1 text-sm text-emerald-600'>
                  <BadgeCheck className='h-4 w-4' />
                  {t('realname_text27', '已认证')}
                </span>
              ) : personStatus === 3 || personStatus === 4 ? (
                <span className='mt-3 inline-flex items-center gap-1 text-sm text-amber-600'>
                  <Clock className='h-4 w-4' />
                  {t('realname_text28', '待人工复审')}
                </span>
              ) : null}
            </div>

            {Number(info?.certification_company_open ?? 0) === 1 && (
              <div
                role='button'
                tabIndex={0}
                onClick={() => clickType('2')}
                onKeyDown={(e) => e.key === 'Enter' && clickType('2')}
                className={typeCardSelected(type === '2')}
              >
                <div className='flex items-start justify-between gap-2'>
                  <div className='flex items-center gap-2'>
                    <Building2 className='h-5 w-5 text-primary' />
                    <span className='font-medium'>{t('realname_text29', '企业认证')}</span>
                  </div>
                </div>
                <p className='mt-2 text-sm text-muted-foreground'>
                  {t('realname_text30', '用于企业、个体工商户申请，需提供企业全称、统一社会信用代码、认证人实名信息、营业执照等资料。')}
                </p>
              </div>
            )}
          </div>

          {/* 认证方式 */}
          <Card className='p-5 sm:p-6'>
            <div className='text-sm font-medium'>{t('realname_text31', '认证方式')}</div>
            <div className='mt-3 space-y-2'>
              <Select value={checkedPlugin} onValueChange={selectPlugin}>
                <SelectTrigger>
                  <SelectValue placeholder={t('realname_text32', '系统默认方式')} />
                </SelectTrigger>
                <SelectContent>
                  {currentPlugins.length === 0 && (
                    <div className='px-2 py-4 text-center text-sm text-muted-foreground'>
                      {t('realname_text82', '请先选择认证类型!')}
                    </div>
                  )}
                  {currentPlugins.map((item) => (
                    <SelectItem key={item.name} value={item.name}>
                      {item.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(isShowPay || showPaidTip) && (
                <div className='flex items-center gap-1 text-sm text-muted-foreground'>
                  {t('realname_text83', '此次认证需要支付')}
                  <span className='font-semibold text-foreground'>
                    {configInfo?.amount}
                  </span>
                  {currencySuffix}
                  {showPaidTip && (
                    <span className='text-emerald-600'>
                      ({t('realname_text85', '已支付')})
                    </span>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* 操作按钮 */}
          <div className='flex justify-end'>
            <Button onClick={goUploadPage} disabled={configLoading}>
              {configLoading && <Loader2 className='mr-1 h-4 w-4 animate-spin' />}
              {isShowPay
                ? t('realname_text84', '支付并认证')
                : t('realname_text33', '下一步')}
              {!isShowPay && <ChevronRight className='ml-1 h-4 w-4' />}
            </Button>
          </div>
        </>
      )}

      <PayDialog
        open={payOpen}
        orderId={payOrderId}
        onOpenChange={(open) => {
          if (!open) {
            setPayOpen(false)
            setPayOrderId(null)
          }
        }}
        onPaySuccess={handlePaySuccess}
        onPayCancel={() => setPayOpen(false)}
      />
      <ProofDialog
        open={proofOpen}
        orderId={proofOrderId}
        onOpenChange={(open) => {
          if (!open) {
            setProofOpen(false)
            setProofOrderId(null)
          }
        }}
        onRefresh={handleProofRefresh}
      />
    </div>
  )
}
