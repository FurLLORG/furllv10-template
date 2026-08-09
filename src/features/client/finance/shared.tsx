/** 时间戳（秒）→ YYYY-MM-DD HH:mm，0/缺省 → '--'（官方 formateTime filter） */
export function formatTime(ts?: number | string): string {
  const num = Number(ts)
  if (!num || Number.isNaN(num)) return '--'
  const d = new Date(num * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 时间戳（秒）→ YYYY-MM-DD HH:mm:ss（官方 formateTime1 filter） */
export function formatTimeFull(ts?: number | string): string {
  const num = Number(ts)
  if (!num || Number.isNaN(num)) return '--'
  const d = new Date(num * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 时间戳（秒）→ YYYY-MM-DD（官方 formateDate2 filter） */
export function formatDateYmd(ts?: number | string): string {
  const num = Number(ts)
  if (!num || Number.isNaN(num)) return '--'
  const d = new Date(num * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 金额格式化（保留两位小数），空 → '--' */
export function formatMoney(v?: number | string): string {
  const num = Number(v)
  if (v == null || v === '' || Number.isNaN(num)) return '--'
  return num.toFixed(2)
}

/** 整页跳转（react-hooks/immutability 规则禁止在组件内直接赋值 window.location.href） */
export function navigateHref(href: string): void {
  window.location.href = href
}

export interface PageData {
  page: number
  limit: number
  total: number
}
