import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import {
  fetchCertificationInfo,
  fetchCommon,
  type CertificationInfoData,
} from '@/api'
import { useCertificationLang } from '@/hooks/use-certification-lang'
import { getErrorMessage } from '@/lib/api'
import { formatTime } from '@/features/client/finance/shared'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useCertificationNav } from './nav'

/** userStatus：10个人通过 15个人资料审核中 20企业通过 25企业资料审核中 50失败（官方 authenticationStatus.js） */
type UserStatus = 10 | 15 | 20 | 25 | 50

function InfoRow({ label, value }: { label: string; value?: string | number }) {
  return (
    <div className='flex items-center justify-between gap-4 border-b py-2 text-sm last:border-b-0'>
      <span className='shrink-0 text-muted-foreground'>{label}</span>
      <span className='min-w-0 truncate font-medium'>{value ?? '--'}</span>
    </div>
  )
}

/**
 * 认证状态页（authentication_status.htm?type=1|2|3，官方 authenticationStatus.js）。
 * 展示个人/企业认证的待审核/已通过/未通过状态；失败时展示 auth_fail 原因并可重新认证。
 */
export function CertificationStatusPage() {
  const navigate = useNavigate()
  const { t } = useCertificationLang()
  const { selectUrl } = useCertificationNav()

  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const rzType = params.get('type') ?? '1'

  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  const websiteName =
    (commonQuery.data?.data as { website_name?: string } | undefined)?.website_name ??
    'FurLL'

  const [info, setInfo] = useState<CertificationInfoData | null>(null)
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.title = `${websiteName} - ${t('realname_text41', '实名认证')}`
  }, [websiteName, t])

  useEffect(() => {
    let active = true
    fetchCertificationInfo()
      .then((res) => {
        if (!active) return
        const data = res.data ?? {}
        setInfo(data)
        const personStatus = Number(data.person?.status ?? 0)
        const companyStatus = Number(data.company?.status ?? 0)
        let status: UserStatus | null = null
        if (companyStatus === 2 && rzType !== '3') {
          status = 50
        } else if (rzType === '2') {
          if (companyStatus === 1) status = 20
          else if (companyStatus === 3 || companyStatus === 4) status = 25
          else if (companyStatus === 2) status = 50
        } else {
          if (personStatus === 1) status = 10
          else if (personStatus === 3 || personStatus === 4) status = 15
          else if (personStatus === 2) status = 50
        }
        setUserStatus(status)
      })
      .catch((error) => toast.error(getErrorMessage(error)))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [rzType])

  const person = info?.person
  const company = info?.company

  function backTicket() {
    navigate({ to: selectUrl })
  }

  function submitAgan() {
    if (Number(info?.person?.status ?? 0) === 1) {
      navigate({ to: '/authentication_status.htm', search: { type: '3' } })
    } else {
      navigate({ to: selectUrl })
    }
  }

  return (
    <div className='mx-auto max-w-3xl space-y-4'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>
          {t('realname_text41', '实名认证')}
        </h1>
      </div>

      {loading || userStatus === null ? (
        <Card>
          <CardContent className='flex min-h-72 items-center justify-center'>
            <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className='p-6'>
            {/* 个人资料审核中 */}
            {userStatus === 15 && (
              <div className='space-y-4'>
                <div className='flex items-center gap-2 text-amber-600'>
                  <Clock className='h-5 w-5' />
                  <h3 className='text-lg font-semibold'>
                    {t('realname_text34', '个人实名认证审核中！')}
                  </h3>
                </div>
                <div className='rounded-md border p-4'>
                  <InfoRow
                    label={t('realname_text36', '认证用户')}
                    value={person?.username}
                  />
                  <InfoRow
                    label={t('realname_text37', '认证证件号')}
                    value={person?.card_number}
                  />
                  <InfoRow
                    label={t('realname_text38', '真实姓名')}
                    value={person?.card_name}
                  />
                  <InfoRow
                    label={t('realname_text39', '认证时间')}
                    value={formatTime(person?.create_time)}
                  />
                </div>
                <div className='flex justify-end gap-3'>
                  <Button variant='outline' onClick={backTicket}>
                    {t('realname_text35', '升级为企业认证')}
                  </Button>
                  <Button onClick={backTicket}>
                    {t('realname_text40', '重新提交资料')}
                  </Button>
                </div>
              </div>
            )}

            {/* 个人认证已完成 */}
            {userStatus === 10 && (
              <div className='flex flex-col items-center space-y-4 text-center'>
                <CheckCircle2 className='h-16 w-16 text-emerald-500' />
                <h3 className='text-lg font-semibold text-emerald-600'>
                  {t('realname_text42', '恭喜,个人认证已完成！')}
                </h3>
                <div className='w-full max-w-lg rounded-md border p-4 text-left'>
                  <InfoRow
                    label={t('realname_text43', '认证用户')}
                    value={person?.username}
                  />
                  <InfoRow
                    label={t('realname_text44', '认证证件号')}
                    value={person?.card_number}
                  />
                  <InfoRow
                    label={t('realname_text45', '真实姓名')}
                    value={person?.card_name}
                  />
                  <InfoRow
                    label={t('realname_text46', '认证时间')}
                    value={formatTime(person?.create_time)}
                  />
                </div>
                <div className='flex justify-end'>
                  <Button onClick={backTicket}>
                    {t('realname_text47', '升级为企业认证')}
                  </Button>
                </div>
              </div>
            )}

            {/* 企业资料审核中 */}
            {userStatus === 25 && (
              <div className='space-y-4'>
                <div className='flex items-center gap-2 text-amber-600'>
                  <Clock className='h-5 w-5' />
                  <h3 className='text-lg font-semibold'>
                    {t('realname_text48', '企业实名认证审核中！')}
                  </h3>
                </div>
                <div className='rounded-md border p-4'>
                  <InfoRow
                    label={t('realname_text49', '认证用户')}
                    value={company?.username}
                  />
                  <InfoRow
                    label={t('realname_text50', '认证企业')}
                    value={company?.certification_company}
                  />
                  <InfoRow
                    label={t('realname_text51', '统一社会信用代码')}
                    value={company?.company_organ_code}
                  />
                  <InfoRow
                    label={t('realname_text52', '认证时间')}
                    value={formatTime(company?.create_time)}
                  />
                </div>
                <div className='flex justify-end'>
                  <Button onClick={backTicket}>
                    {t('realname_text53', '重新提交资料')}
                  </Button>
                </div>
              </div>
            )}

            {/* 企业认证已完成 */}
            {userStatus === 20 && (
              <div className='flex flex-col items-center space-y-4 text-center'>
                <CheckCircle2 className='h-16 w-16 text-emerald-500' />
                <h3 className='text-lg font-semibold text-emerald-600'>
                  {t('realname_text54', '恭喜,认证已完成！')}
                </h3>
                <div className='w-full max-w-lg rounded-md border p-4 text-left'>
                  <InfoRow
                    label={t('realname_text49', '认证用户')}
                    value={company?.username}
                  />
                  <InfoRow
                    label={t('realname_text52', '认证时间')}
                    value={formatTime(company?.create_time)}
                  />
                  <InfoRow
                    label={t('realname_text50', '认证企业')}
                    value={company?.certification_company}
                  />
                  <InfoRow
                    label={t('realname_text51', '统一社会信用代码')}
                    value={company?.company_organ_code}
                  />
                </div>
              </div>
            )}

            {/* 认证失败 */}
            {userStatus === 50 && (
              <div className='flex flex-col items-center space-y-3 text-center'>
                <XCircle className='h-16 w-16 text-destructive' />
                <h3 className='text-lg font-semibold'>
                  {t('realname_text60', '认证失败')}
                </h3>
                <p className='text-sm text-muted-foreground'>
                  {t('realname_text61', '未完成指定认证操作，请重新认证')}
                </p>
                {rzType === '2' && Number(company?.status ?? 0) === 2 && (
                  <p className='text-sm text-muted-foreground'>
                    {company?.auth_fail}
                  </p>
                )}
                {(rzType === '1' || rzType === '3') &&
                  Number(person?.status ?? 0) === 2 && (
                    <p className='text-sm text-muted-foreground'>
                      {person?.auth_fail}
                    </p>
                  )}
                <div className='mt-2 flex items-center gap-4'>
                  <Button onClick={submitAgan}>
                    {t('realname_text62', '重新认证')}
                  </Button>
                  <Button
                    variant='link'
                    className='text-muted-foreground'
                    onClick={() => navigate({ to: '/account.htm' })}
                  >
                    {t('realname_text63', '取消')}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
