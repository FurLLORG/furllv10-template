import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BASE_MODULE,
  createModuleTranslator,
  getModuleLocale,
  resolveModuleLangDict,
  type LangModule,
  type ModuleLangDict,
} from '@/lib/module-lang'

export type ModuleTranslator = (key: string, fallback?: string) => string

/**
 * 官方插件语言（模块 lang/index.js，默认 mf_finance）。
 * - 按 localStorage.lang 取当前 locale 字典 + zh-cn 基准字典（缺 key 回退）
 * - 各模块字典并非全量，另取 mf_finance 基准字典（官方详情文案超集）兜底，
 *   保证 mf_dcim / mf_cloud / idcsmart_common 等模块缺 key 时仍显示官方文案
 * - 语言文件为静态资源，staleTime: Infinity 只在内存缓存一次
 */
export function useModuleLang(module: LangModule = 'mf_finance'): {
  t: ModuleTranslator
  lang?: ModuleLangDict
  isLoading: boolean
  error: Error | null
} {
  const locale = getModuleLocale()
  const query = useQuery({
    queryKey: ['module-lang', module, locale],
    queryFn: async () => {
      const dict = await resolveModuleLangDict(locale, module)
      const zhDict =
        locale === 'zh-cn' ? dict : await resolveModuleLangDict('zh-cn', module)
      const baseDict = await resolveModuleLangDict(locale, BASE_MODULE)
      const baseZhDict =
        locale === 'zh-cn'
          ? baseDict
          : await resolveModuleLangDict('zh-cn', BASE_MODULE)
      return { dict, zhDict, baseDict, baseZhDict }
    },
    staleTime: Infinity,
    retry: false,
  })

  const t = useCallback<ModuleTranslator>(
    (key, fallback) => {
      const { dict, zhDict, baseDict, baseZhDict } = query.data ?? {}
      return createModuleTranslator(dict, zhDict, baseDict, baseZhDict)(
        key,
        fallback
      )
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
