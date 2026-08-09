import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchAccount, fetchSubAccountAuth } from '@/api'
import { useAddons } from '@/hooks/use-addons'

/** 安全中心 Tab key（对应官方 security.php 的 name 1/2/3/4） */
export type SecurityTabKey = '1' | '2' | '3' | '4'

export interface SecurityTabItem {
  key: SecurityTabKey
  /** 官方 lang key */
  labelKey: string
  /** 无 key 时的兜底文案 */
  labelFallback: string
  /** SPA 页面地址 */
  href: string
}

/**
 * 安全中心访问控制（复刻官方 asideMenu 的 getRule 逻辑）：
 * - 主账户 rules='all' → 全部可见
 * - 子账户按 /sub_account/:id/auth 返回的 rule 数组过滤
 * - SSH密钥 tab 需 IdcsmartSshKey 插件，安全组 tab 需 IdcsmartCloud 插件
 */
export function useSecurityAccess() {
  const { addons } = useAddons()

  const accountQuery = useQuery({
    queryKey: ['client-account'],
    queryFn: fetchAccount,
    retry: false,
  })
  const account = accountQuery.data?.data.account
  const isSubAccount = account?.customfield?.is_sub_account === 1

  const [subRules, setSubRules] = useState<string[] | null>(null)
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

  const hasRule = useCallback(
    (controller: string) =>
      rules === 'all' ||
      (Array.isArray(rules) && rules.some((rule) => rule.includes(controller))),
    [rules]
  )

  const pluginNames = useMemo(
    () => new Set(addons.map((addon) => addon.name.toLowerCase())),
    [addons]
  )

  const canApi = hasRule('ApiController::list')
  const canLog = hasRule('LogController::list')

  const tabs = useMemo<SecurityTabItem[]>(() => {
    const list: SecurityTabItem[] = []
    if (canApi) {
      list.push({ key: '1', labelKey: '', labelFallback: 'API', href: '/security.htm' })
    }
    if (pluginNames.has('idcsmartsshkey')) {
      list.push({
        key: '2',
        labelKey: 'security_tab1',
        labelFallback: 'SSH密钥',
        href: '/security_ssh.htm',
      })
    }
    if (canLog) {
      list.push({
        key: '3',
        labelKey: 'security_tab2',
        labelFallback: 'API日志',
        href: '/security_log.htm',
      })
    }
    if (pluginNames.has('idcsmartcloud')) {
      list.push({
        key: '4',
        labelKey: 'security_group',
        labelFallback: '安全组',
        href: '/security_group.htm',
      })
    }
    return list
  }, [canApi, canLog, pluginNames])

  return {
    tabs,
    canApi,
    canLog,
    /** 子账户权限尚未拉取完成时 loading（决定 tab 可见性前先等待） */
    loading: isSubAccount && subRules === null,
  }
}
