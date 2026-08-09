import { useEffect } from 'react'

/** 资源中心页隐藏浏览器页面滚动条（切换到其他页面自动恢复显示） */
export function useHidePageScrollbar() {
  useEffect(() => {
    document.documentElement.classList.add('no-scrollbar')
    return () => document.documentElement.classList.remove('no-scrollbar')
  }, [])
}
