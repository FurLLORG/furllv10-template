import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  createModuleTranslator,
  getModuleLocale,
  resolveDownloadLangDict,
  resolveHelpLangDict,
  type ModuleLangDict,
  type ModuleLocale,
} from '@/lib/module-lang'

export type PluginTranslator = (key: string, fallback?: string) => string

/**
 * 通用插件语言 hook 工厂：与 useNewsLang 同款，但支持任意插件语言文件。
 * 按 localStorage.lang 取当前 locale 字典，缺 key 回退 zh-cn 字典；
 * 语言文件为静态资源，staleTime: Infinity 只在内存缓存一次。
 */
function createUsePluginLang(
  queryKey: string,
  resolver: (locale: ModuleLocale) => Promise<ModuleLangDict>
) {
  return function usePluginLang(): {
    t: PluginTranslator
    lang?: ModuleLangDict
    isLoading: boolean
    error: Error | null
  } {
    const locale = getModuleLocale()
    // resolver 为模块级常量（工厂参数），无需进 queryKey
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    const query = useQuery({
      queryKey: [queryKey, locale],
      queryFn: async () => {
        const dict = await resolver(locale)
        const zhDict = locale === 'zh-cn' ? dict : await resolver('zh-cn')
        return { dict, zhDict }
      },
      staleTime: Infinity,
      retry: false,
    })

    const t = useCallback<PluginTranslator>(
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
}

/** 帮助中心插件（IdcsmartHelp）语言（key 为 source_* / file_*） */
export const useHelpLang = createUsePluginLang('help-lang', resolveHelpLangDict)

/** 文件下载插件（IdcsmartFileDownload）语言（key 为 source_* / file_*） */
export const useDownloadLang = createUsePluginLang(
  'download-lang',
  resolveDownloadLangDict
)
