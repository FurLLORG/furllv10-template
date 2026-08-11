import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  buildLegacyShellConfig,
  legacyHostUrl,
  writeLegacyShellConfig,
} from '@/lib/legacy-shell'

/**
 * 未适配模块的官方兼容渲染：iframe 真实跳转静态壳页 legacy-host.html?id=<hostId>。
 *
 * 壳页 URL 带真实 query，官方 productdetail.js 在 iframe 内自行拉取
 * /console/v1/host/:id/view 的 content 并 jQuery 注入渲染（官方 default 行为）；
 * 模块自带 cloudDetail.js/dcimDetail.js 也从 URL 读到产品 ID。iframe 独立
 * document 隔离官方全局脚本（Vue2/Element/rem/document.writeln），不污染 React 布局。
 *
 * 顶栏/侧边栏由 FurLLV10 React 布局提供，本组件只占主内容区（壳页已去掉官方
 * aside-menu/top-menu DOM，仅保留其脚本作为 Vue components 注册依赖）。
 *
 * 运行时配置（addons/system_version/theme_color/__LANG_CONFIG__）在跳转前写入
 * 同源 sessionStorage，由 legacy-host.html 读取。
 */
export function LegacyHost({ hostId }: { hostId: number }) {
  const url = useMemo(() => legacyHostUrl(hostId), [hostId])
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useLayoutEffect(() => {
    writeLegacyShellConfig(buildLegacyShellConfig(hostId))
    iframeRef.current?.setAttribute('src', url)
  }, [hostId, url])

  return (
    <iframe
      ref={iframeRef}
      title='官方产品详情'
      className='block w-full border-0 bg-background'
      style={{ height: 'calc(100svh - 8rem)' }}
    />
  )
}
