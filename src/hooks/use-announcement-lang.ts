import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  createModuleTranslator,
  getModuleLocale,
  resolveAnnouncementLangDict,
  type ModuleLangDict,
} from '@/lib/module-lang'
import type { NewsTranslator } from './use-news-lang'

/**
 * 公告插件（IdcsmartAnnouncement）语言（window.plugin_lang 等价物，
 * /plugins/addon/idcsmart_announcement/.../lang/index.js，key 与新闻插件同为 news_text*）。
 * 与 useNewsLang 同款：按 localStorage.lang 取当前 locale 字典，缺 key 回退 zh-cn 字典。
 * 语言文件为静态资源，staleTime: Infinity 只在内存缓存一次。
 */
export function useAnnouncementLang(): {
  t: NewsTranslator
  lang?: ModuleLangDict
  isLoading: boolean
  error: Error | null
} {
  const locale = getModuleLocale()
  const query = useQuery({
    queryKey: ['announcement-lang', locale],
    queryFn: async () => {
      const dict = await resolveAnnouncementLangDict(locale)
      const zhDict =
        locale === 'zh-cn' ? dict : await resolveAnnouncementLangDict('zh-cn')
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
