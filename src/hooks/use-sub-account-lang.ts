import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  createModuleTranslator,
  getModuleLocale,
  resolveSubAccountLangDict,
  type ModuleLangDict,
} from '@/lib/module-lang'

export type SubAccountTranslator = (key: string, fallback?: string) => string

/**
 * 子账户插件（IdcsmartSubAccount）语言（window.plugin_lang 等价物，
 * /plugins/addon/idcsmart_sub_account/.../lang/index.js，key 为 subaccount_text*）。
 * 与 useTicketLang 同款：按 localStorage.lang 取当前 locale 字典，缺 key 回退 zh-cn 字典。
 * 语言文件为静态资源，staleTime: Infinity 只在内存缓存一次。
 */
export function useSubAccountLang(): {
  t: SubAccountTranslator
  lang?: ModuleLangDict
  isLoading: boolean
  error: Error | null
} {
  const locale = getModuleLocale()
  const query = useQuery({
    queryKey: ['sub-account-lang', locale],
    queryFn: async () => {
      const dict = await resolveSubAccountLangDict(locale)
      const zhDict =
        locale === 'zh-cn' ? dict : await resolveSubAccountLangDict('zh-cn')
      return { dict, zhDict }
    },
    staleTime: Infinity,
    retry: false,
  })

  const t = useCallback<SubAccountTranslator>(
    (key, fallback) => {
      const { dict, zhDict } = query.data ?? {}
      return createModuleTranslator(dict, zhDict)(key, fallback)
    },
    [query.data]
  )

  return {
    t,
    lang: query.data?.dict,
    isLoading: query.isLoading,
    error: query.error ?? null,
  }
}
