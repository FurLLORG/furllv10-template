import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  createModuleTranslator,
  getModuleLocale,
  resolveNewsLangDict,
  type ModuleLangDict,
} from '@/lib/module-lang'

export type NewsTranslator = (key: string, fallback?: string) => string

/**
 * 新闻插件（IdcsmartNews 资源中心）语言（window.plugin_lang 等价物，
 * /plugins/addon/idcsmart_news/.../lang/index.js，key 为 news_text*）。
 * 与 useTicketLang 同款：按 localStorage.lang 取当前 locale 字典，缺 key 回退 zh-cn 字典。
 * 语言文件为静态资源，staleTime: Infinity 只在内存缓存一次。
 */
export function useNewsLang(): {
  t: NewsTranslator
  lang?: ModuleLangDict
  isLoading: boolean
  error: Error | null
} {
  const locale = getModuleLocale()
  const query = useQuery({
    queryKey: ['news-lang', locale],
    queryFn: async () => {
      const dict = await resolveNewsLangDict(locale)
      const zhDict =
        locale === 'zh-cn' ? dict : await resolveNewsLangDict('zh-cn')
      return { dict, zhDict }
    },
    staleTime: Infinity,
    retry: false,
  })

  const t = useCallback<NewsTranslator>(
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
