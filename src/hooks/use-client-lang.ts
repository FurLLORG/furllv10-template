import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  createModuleTranslator,
  getModuleLocale,
  resolveClientLangDict,
  type ModuleLangDict,
} from '@/lib/module-lang'

export type ClientTranslator = (key: string, fallback?: string) => string

/**
 * 官方客户端基础语言（window.lang 等价物，/clientarea/template/pc/default/lang/<locale>/index.js）。
 * 退款/停用（common_unsubscribe_*）等 clientarea 基础 key 只存在于该文件，模块 lang 里没有。
 */
export function useClientLang(): {
  t: ClientTranslator
  lang?: ModuleLangDict
  isLoading: boolean
  error: Error | null
} {
  const locale = getModuleLocale()
  const query = useQuery({
    queryKey: ['client-lang', locale],
    queryFn: () => resolveClientLangDict(locale),
    staleTime: Infinity,
    retry: false,
  })

  const t = useCallback<ClientTranslator>(
    (key, fallback) =>
      createModuleTranslator(query.data)(key, fallback),
    [query.data]
  )

  return {
    t,
    lang: query.data,
    isLoading: query.isLoading,
    error: query.error ?? null,
  }
}
