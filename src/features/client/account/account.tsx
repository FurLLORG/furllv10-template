import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  fetchAccount,
  fetchCommon,
  fetchCountryList,
  fetchSubAccountAuth,
  type AvailableSecurityMethod,
} from '@/api'
import { useAddons } from '@/hooks/use-addons'
import { useClientLang } from '@/hooks/use-client-lang'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProfileTab } from './profile-tab'
import { LogTab } from './log-tab'
import { MsgTab } from './msg-tab'
import {
  SecurityVerifyDialog,
  type SecurityVerifyResult,
} from './security-verify-dialog'
import type { SubmitWithSecurity } from './types'

type ActiveTab = 'profile' | 'log' | 'msg'

const TAB_MAP: Record<string, ActiveTab> = {
  '1': 'profile',
  '2': 'log',
  '3': 'msg',
}

export function AccountPage() {
  const { t } = useClientLang()
  const { addons } = useAddons()

  // 通用配置（复用 ClientLayout 缓存）
  const commonQuery = useQuery({
    queryKey: ['client-common'],
    queryFn: fetchCommon,
    retry: false,
  })
  const commonData = commonQuery.data?.data as Record<string, unknown> | undefined

  // 账户详情
  const accountQuery = useQuery({
    queryKey: ['client-account'],
    queryFn: fetchAccount,
    retry: false,
  })
  const account = accountQuery.data?.data.account

  // 国家列表
  const countryQuery = useQuery({
    queryKey: ['client-country'],
    queryFn: () => fetchCountryList({}),
    retry: false,
  })
  const countryList = countryQuery.data?.data.list ?? []

  // 插件判断
  const pluginNames = useMemo(
    () => new Set(addons.map((a) => a.name.toLowerCase())),
    [addons]
  )
  const hasCertificationPlugin = pluginNames.has('idcsmartcertification')
  const hasCustomFieldPlugin = pluginNames.has('clientcustomfield')
  const hasWxPlugin = pluginNames.has('mpweixinnotice')
  const hasClientCare = pluginNames.has('clientcare')

  // 子账户权限（主账户全量）
  const [subRules, setSubRules] = useState<string[] | null>(null)
  const isSubAccount = account?.customfield?.is_sub_account === 1
  useEffect(() => {
    if (!isSubAccount || !account?.id) return
    let active = true
    fetchSubAccountAuth(account.id)
      .then((res) => {
        if (active && res.status === 200) setSubRules(res.data.rule ?? [])
      })
      .catch(() => active && setSubRules([]))
    return () => {
      active = false
    }
  }, [isSubAccount, account?.id])
  const rules: string[] | 'all' = useMemo(
    () => (!isSubAccount || !account?.id ? 'all' : (subRules ?? [])),
    [isSubAccount, account?.id, subRules]
  )

  const showAccountController = useMemo(() => {
    if (rules === 'all') return true
    return Array.isArray(rules) && rules.some((r) => r.includes('AccountController::index'))
  }, [rules])
  const showLogController = useMemo(() => {
    if (rules === 'all') return true
    return Array.isArray(rules) && rules.some((r) => r.includes('LogController::list'))
  }, [rules])

  // 初始 tab：?type= 参数 > 默认概要；当前 tab 不可见时回退
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const type = new URLSearchParams(window.location.search).get('type')
    return (type ? TAB_MAP[type] : undefined) ?? 'profile'
  })
  const resolvedTab: ActiveTab =
    activeTab === 'profile' && !showAccountController
      ? 'log'
      : activeTab === 'log' && !showLogController
        ? 'profile'
        : activeTab === 'msg' && !hasClientCare
          ? 'profile'
          : activeTab

  // 页面标题
  useEffect(() => {
    const base = (commonData?.website_name as string) || 'FurLL'
    document.title = `${base} - ${t('account_tips50', '账户信息')}`
  }, [commonData, t])

  // ---------- 安全验证 ----------
  const [securityState, setSecurityState] = useState<{
    actionType: string
    availableMethods: AvailableSecurityMethod[]
  } | null>(null)
  const securityResolveRef = useRef<((r: SecurityVerifyResult) => void) | null>(null)
  const securityRejectRef = useRef<(() => void) | null>(null)

  const submitWithSecurity: SubmitWithSecurity = async (actionType, doSubmit) => {
    const res = await doSubmit()
    const secData = (res as unknown as {
      data?: { need_security_verify?: boolean; available_methods?: AvailableSecurityMethod[] }
    })?.data
    if (secData?.need_security_verify && secData.available_methods?.length) {
      const secResult = await new Promise<SecurityVerifyResult>((resolve, reject) => {
        securityResolveRef.current = resolve
        securityRejectRef.current = reject
        setSecurityState({
          actionType,
          availableMethods: secData.available_methods!,
        })
      })
      if (!secResult) return undefined
      return doSubmit(secResult)
    }
    return res
  }

  function handleSecurityConfirm(result: SecurityVerifyResult) {
    const cb = securityResolveRef.current
    setSecurityState(null)
    securityResolveRef.current = null
    securityRejectRef.current = null
    cb?.(result)
  }

  function handleSecurityCancel() {
    const cb = securityRejectRef.current
    setSecurityState(null)
    securityResolveRef.current = null
    securityRejectRef.current = null
    cb?.()
  }

  function reloadAccount() {
    accountQuery.refetch()
  }

  const loading = accountQuery.isLoading || countryQuery.isLoading

  return (
    <div className='space-y-4'>
      <div className='mb-2'>
        <h1 className='text-2xl font-bold tracking-tight'>
          {t('account_title1', '账户')}
        </h1>
        <div className='text-sm text-muted-foreground'>
          {t('account_tips50', '账户信息')}
        </div>
      </div>

      {loading ? (
        <Card className='p-6'>
          <div className='space-y-4'>
            <Skeleton className='h-8 w-1/4' />
            <Skeleton className='h-40 w-full' />
            <Skeleton className='h-40 w-full' />
          </div>
        </Card>
      ) : (
        <Tabs value={resolvedTab} onValueChange={(v) => setActiveTab(v as ActiveTab)}>
          <TabsList>
            {showAccountController ? (
              <TabsTrigger value='profile'>{t('account_menu1', '概要')}</TabsTrigger>
            ) : null}
            {showLogController ? (
              <TabsTrigger value='log'>{t('account_menu2', '操作日志')}</TabsTrigger>
            ) : null}
            {hasClientCare ? (
              <TabsTrigger value='msg'>{t('subaccount_text56', '站内信')}</TabsTrigger>
            ) : null}
          </TabsList>
          {showAccountController ? (
            <TabsContent value='profile'>
              <ProfileTab
                account={account}
                commonData={commonData}
                countryList={countryList}
                hasCustomFieldPlugin={hasCustomFieldPlugin}
                hasCertificationPlugin={hasCertificationPlugin}
                hasWxPlugin={hasWxPlugin}
                submitWithSecurity={submitWithSecurity}
                reloadAccount={reloadAccount}
              />
            </TabsContent>
          ) : null}
          {showLogController ? (
            <TabsContent value='log'>
              <LogTab />
            </TabsContent>
          ) : null}
          {hasClientCare ? (
            <TabsContent value='msg'>
              <MsgTab />
            </TabsContent>
          ) : null}
        </Tabs>
      )}

      <SecurityVerifyDialog
        open={securityState !== null}
        availableMethods={securityState?.availableMethods ?? []}
        actionType={securityState?.actionType ?? 'update_password'}
        onConfirm={handleSecurityConfirm}
        onCancel={handleSecurityCancel}
      />
    </div>
  )
}
