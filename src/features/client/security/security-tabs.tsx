import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useClientLang } from '@/hooks/use-client-lang'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSecurityAccess, type SecurityTabKey } from './security-access'

export function SecurityTabs({ active }: { active: SecurityTabKey }) {
  const { t } = useClientLang()
  const { tabs, loading } = useSecurityAccess()
  const navigate = useNavigate()

  // 当前页面对应的 tab 不可见（无权限/插件）时回退到首个可见 tab
  useEffect(() => {
    if (loading) return
    const exists = tabs.some((tab) => tab.key === active)
    if (!exists && tabs.length > 0) {
      navigate({ to: tabs[0].href })
    }
  }, [loading, tabs, active, navigate])

  if (loading) {
    return <Skeleton className='h-10 w-full' />
  }
  if (tabs.length === 0) return null

  const effectiveActive = tabs.some((tab) => tab.key === active) ? active : tabs[0].key

  return (
    <Tabs
      value={effectiveActive}
      onValueChange={(v) => {
        const tab = tabs.find((item) => item.key === v)
        if (tab) navigate({ to: tab.href })
      }}
    >
      <TabsList>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.key} value={tab.key}>
            {tab.labelKey ? t(tab.labelKey, tab.labelFallback) : tab.labelFallback}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
