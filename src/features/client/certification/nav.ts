import { useMemo } from 'react'
import { useAddons } from '@/hooks/use-addons'

const CERTIFICATION_PLUGIN_NAME = 'idcsmartcertification'

/**
 * 实名认证插件导航（官方 clientarea 插件入口 /plugin/<插件ID>/<view>.htm）。
 * 侧边栏/账户页的认证链接走插件 URL，SPA 内页间跳转同样拼插件 URL 保持地址一致；
 * 插件 ID 反查失败（未安装/接口异常）时回退裸别名（/authentication_*.htm，deploy 已生成壳）。
 */
export function useCertificationNav(): {
  pluginId: number | null
  selectUrl: string
  personUrl: string
  companyUrl: string
  statusUrl: string
  thirdUrl: string
} {
  const { addons } = useAddons()
  const pluginId = useMemo(
    () =>
      addons.find((a) => a.name.toLowerCase() === CERTIFICATION_PLUGIN_NAME)
        ?.id ?? null,
    [addons]
  )

  return useMemo(() => {
    const base = pluginId ? `/plugin/${pluginId}` : ''
    const url = (view: string) =>
      base ? `${base}/${view}.htm` : `/${view}.htm`
    return {
      pluginId,
      selectUrl: url('authentication_select'),
      personUrl: url('authentication_person'),
      companyUrl: url('authentication_company'),
      statusUrl: url('authentication_status'),
      thirdUrl: url('authentication_thrid'),
    }
  }, [pluginId])
}
