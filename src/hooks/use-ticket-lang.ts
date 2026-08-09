import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  createModuleTranslator,
  getModuleLocale,
  resolveTicketLangDict,
  type ModuleLangDict,
} from '@/lib/module-lang'

export type TicketTranslator = (key: string, fallback?: string) => string

/**
 * 工单插件语言（window.plugin_lang 等价物，/plugins/addon/idcsmart_ticket/.../lang/index.js）。
 * 与 useModuleLang 同款：按 localStorage.lang 取当前 locale 字典，缺 key 回退 zh-cn 字典。
 * 语言文件为静态资源，staleTime: Infinity 只在内存缓存一次。
 */
export function useTicketLang(): {
  t: TicketTranslator
  lang?: ModuleLangDict
  isLoading: boolean
  error: Error | null
} {
  const locale = getModuleLocale()
  const query = useQuery({
    queryKey: ['ticket-lang', locale],
    queryFn: async () => {
      const dict = await resolveTicketLangDict(locale)
      const zhDict =
        locale === 'zh-cn' ? dict : await resolveTicketLangDict('zh-cn')
      return { dict, zhDict }
    },
    staleTime: Infinity,
    retry: false,
  })

  const t = useCallback<TicketTranslator>(
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
