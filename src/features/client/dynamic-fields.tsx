/**
 * 自动字段渲染器：把实例详情接口返回的、尚未显式适配的标量字段自动展示成信息行，
 * 避免后续后端新增字段时手动适配。
 * - 标签：优先取模块语言字典 lang[key]，缺失回退字段名转可读（如 vpc_private_ip → Vpc Private Ip）
 * - 值：valueFormat 可选自定义格式化（枚举值翻译等），缺失直接展示原文
 * - 跳过：对象/数组等结构化值、空字符串、exclude 集合中的字段（已显式渲染/内部字段）
 */

function isScalarValue(v: unknown): boolean {
  if (v == null) return false
  if (Array.isArray(v)) return false
  return typeof v !== 'object'
}

/** snake_case/camelCase → "Word Word" 可读标签兜底 */
export function humanizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatScalar(v: unknown): string {
  if (v == null || v === '') return '--'
  return String(v)
}

export function AutoDetailFields({
  data,
  exclude,
  lang,
  labelOf,
  valueFormat,
}: {
  data: Record<string, unknown>
  exclude?: Iterable<string>
  /** 模块语言字典（key→标签，支持 com_config.add 嵌套），缺失回退字段名转可读 */
  lang?: Record<string, string | Record<string, unknown>>
  /** 标签解析，优先于 lang（如把 username 映射到 lang.common_cloud_label14） */
  labelOf?: (key: string) => string | undefined
  /** 可选值格式化（枚举翻译等），返回 undefined 时用原文 */
  valueFormat?: (key: string, value: unknown) => string | undefined
}) {
  const excludeSet = new Set(exclude ?? [])
  const rows = Object.keys(data)
    .filter((key) => !excludeSet.has(key))
    .filter((key) => {
      const v = data[key]
      // 跳过对象/数组/空值/布尔值（布尔是内部开关控制字段，如 module_power_status）
      return (
        isScalarValue(v) && typeof v !== 'boolean' && v !== '' && v != null
      )
    })
    .map((key) => {
      const labelValue = lang?.[key]
      const label =
        labelOf?.(key) ??
        (typeof labelValue === 'string' && labelValue
          ? labelValue
          : humanizeKey(key))
      return {
        key,
        label,
        value: valueFormat?.(key, data[key]) ?? formatScalar(data[key]),
      }
    })

  if (rows.length === 0) return null

  return (
    <>
      {rows.map((row) => (
        <div key={row.key} className='flex min-w-0 gap-2'>
          <span
            className='w-20 shrink-0 truncate text-left text-[#1E2736] dark:text-foreground'
            title={row.label}
          >
            {row.label}：
          </span>
          <span className='min-w-0 flex-1 break-all text-[#1E2736] dark:text-foreground'>
            {row.value}
          </span>
        </div>
      ))}
    </>
  )
}
