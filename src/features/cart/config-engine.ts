/**
 * mf_finance（通用商品）配置页引擎：复刻官方插件 js/remf_finance.js 的
 * 配置初始值、联动限制（links）、算价参数、密码生成、自定义字段校验等纯逻辑。
 * 不依赖官方 Vue2 运行环境，由原生 React 组件消费。
 */
import type {
  RemfConfigCycle,
  RemfConfigLink,
  RemfConfigOptionItem,
  RemfCustomFieldItem,
} from '@/api'

// 数量拖动类（sub 为阶梯区间）
export const RANGE_TYPES = [4, 7, 9, 11, 14, 15, 16, 17, 18, 19]
// 点击单选类（sub 为 id 列表）
export const CLICK_TYPES = [2, 6, 8, 10, 13]
// 下拉单选
export const SELECT_TYPE = 1
// 是否（开关）
export const SWITCH_TYPE = 3
// 操作系统（双下拉）
export const SYSTEM_TYPE = 5
// 数据中心（区域）
export const AREA_TYPE = 12
// 级联
export const CASCADER_TYPE = 20

export type ConfigFormValue = number | string
export type ConfigForm = Record<string, ConfigFormValue>

export interface ConfigFormSnapshot {
  options: RemfConfigOptionItem[]
  form: ConfigForm
}

/** 数量类型：生成 [m, n] 连续整数数组 */
export function createRangeArray([m, n]: [number, number]): number[] {
  const temp: number[] = []
  for (let i = m; i <= n; i++) temp.push(i)
  return temp
}

/**
 * 过滤并富化配置项（官方 getConfig 前半段）：
 * - 去掉没有 sub 的项
 * - 数量类型 qty_maximum 为 0 的项过滤（2025-07-23 起老财务 0-0 子项）
 * - option_type 5 生成 systemArr；数量类型生成 qty_range
 */
export function prepareOptions(raw: RemfConfigOptionItem[]): RemfConfigOptionItem[] {
  return raw
    .filter((item) => item.sub)
    .filter((item) => {
      if (RANGE_TYPES.includes(item.option_type)) {
        return Number(item.qty_maximum) > 0
      }
      return true
    })
    .map((item) => {
      const next = { ...item }
      if (item.option_type === SYSTEM_TYPE) {
        next.systemArr = Object.keys(item.sub as Record<string, unknown>).map(
          (value) => ({ value, label: value })
        )
      }
      if (RANGE_TYPES.includes(item.option_type)) {
        const ranges: Array<[number, number]> = (
          item.sub as Array<{ qty_minimum: number; qty_maximum: number }>
        ).map((sub) => [Number(sub.qty_minimum), Number(sub.qty_maximum)] as [number, number])
        const qty_range: number[] = []
        ranges.forEach((range) => qty_range.push(...createRangeArray(range)))
        next.qty_range = qty_range
      }
      return next
    })
}

/** 按官方规则生成配置项初始值（form），并附带 host/password 默认值 */
export function collectConfigForm(
  options: RemfConfigOptionItem[],
  host?: string,
  password?: string
): { form: ConfigForm; curSystem: string } {
  const form: ConfigForm = {}
  let curSystem = ''
  for (const cur of options) {
    if (cur.option_type === SWITCH_TYPE) {
      form[cur.id] = 0
    } else if (RANGE_TYPES.includes(cur.option_type)) {
      form[cur.id] = Number(cur.qty_minimum)
    } else if (cur.option_type === SYSTEM_TYPE) {
      const group = cur.sub as Record<string, { child: Array<{ id: number }> }>
      curSystem = Object.keys(group)[0]
      form[cur.id] = group[curSystem].child[0].id
    } else if (cur.option_type === AREA_TYPE) {
      const subs = cur.sub as Array<{ area: Array<{ id: number }> }>
      form[cur.id] = subs[0]?.area[0]?.id ?? ''
    } else {
      const subs = cur.sub as Array<{ id: number }>
      form[cur.id] = subs[0]?.id ?? ''
    }
  }
  if (host !== undefined) form.host = host
  if (password !== undefined) form.password = password
  return { form, curSystem }
}

/** 当前选项是否命中联动（官方 filterLimit）：命中需走 changeOptItem 应用限制 */
export function hasActiveLimit(
  options: RemfConfigOptionItem[],
  form: ConfigForm,
  limit: RemfConfigLink[]
): boolean {
  if (limit.length === 0) return false
  const active = limit.filter((item) => {
    const temp = Object.keys(item.sub_id).map(Number)
    const curOpt = options.find((sub) => sub.id === item.config_id)
    const tempRange: number[] = []
    if (curOpt && RANGE_TYPES.includes(curOpt.option_type)) {
      Object.values(item.sub_id)
        .map((sub) => [Number(sub.qty_minimum), Number(sub.qty_maximum)] as [number, number])
        .forEach((sub) => tempRange.push(...createRangeArray(sub)))
    }
    const value = form[item.config_id]
    const bol = temp.includes(Number(value)) || tempRange.includes(Number(value))
    return item.relation === 'seq' ? bol : !bol
  })
  return active.length > 0
}

/**
 * 变更某个配置项时，先把它之前影响的关联项恢复为原始数据（官方 filterLimit(opt) 的恢复段）
 */
export function restoreDependents(
  origin: RemfConfigOptionItem[],
  options: RemfConfigOptionItem[],
  form: ConfigForm,
  limit: RemfConfigLink[],
  causeId: number
): ConfigFormSnapshot {
  const causedIds = new Set(
    limit
      .filter((item) => item.config_id === causeId)
      .reduce<number[]>((all, cur) => {
        all.push(...cur.result.map((sub) => sub.config_id))
        return all
      }, [])
  )
  if (causedIds.size === 0) return { options, form }
  const originById = new Map(origin.map((item) => [item.id, item]))
  return {
    options: options.map((item) => {
      if (!causedIds.has(item.id)) return item
      const raw = originById.get(item.id)
      if (!raw) return item
      return {
        ...item,
        disabled: false,
        systemArr: raw.systemArr,
        qty_range: raw.qty_range,
        qty_minimum: raw.qty_minimum,
        qty_maximum: raw.qty_maximum,
        sub: raw.sub,
      }
    }),
    form,
  }
}

/** 子项 id 是否在联动结果 sub_id 内（区间类先展开） */
function subIdMatches(
  subId: Record<string, { qty_minimum?: number; qty_maximum?: number }>,
  value: ConfigFormValue,
  type: number
): boolean {
  const temp = Object.keys(subId).map(Number)
  if (RANGE_TYPES.includes(type)) {
    const tempRange: number[] = []
    Object.values(subId)
      .map((sub) => [Number(sub.qty_minimum), Number(sub.qty_maximum)] as [number, number])
      .forEach((sub) => tempRange.push(...createRangeArray(sub)))
    return tempRange.includes(Number(value))
  }
  return temp.includes(Number(value))
}

/**
 * 应用联动结果（官方 changeOptItem）：按变更项命中的第一条限制，过滤其关联配置项的可选项，
 * 并重置不匹配的默认值。返回新的 options + form。
 */
export function applyResultLimit(
  origin: RemfConfigOptionItem[],
  options: RemfConfigOptionItem[],
  form: ConfigForm,
  limit: RemfConfigLink[],
  causeId: number
): ConfigFormSnapshot {
  const causeLimits = limit.filter((sub) => sub.config_id === causeId)
  if (causeLimits.length === 0) return { options, form }

  const resultLimit = causeLimits.filter((sub) =>
    subIdMatches(sub.sub_id, form[causeId], options.find((o) => o.id === causeId)?.option_type ?? 1)
  )
  if (resultLimit.length === 0) {
    // 官方：匹配不到限制时仅保留注释掉的恢复逻辑（不做事）
    return { options, form }
  }

  const resultArr = resultLimit[0].result
  let nextOptions = options
  const nextForm = { ...form }

  for (const item of resultArr) {
    const originIndex = origin.findIndex((sub) => sub.id === item.config_id)
    if (originIndex === -1) continue
    const curType = origin[originIndex].option_type
    const curOptionIndex = nextOptions.findIndex((sub) => sub.id === item.config_id)
    if (curOptionIndex === -1) continue

    let filterArr: number[] = []
    if (
      CLICK_TYPES.includes(curType) ||
      curType === SWITCH_TYPE ||
      curType === AREA_TYPE ||
      curType === SYSTEM_TYPE
    ) {
      filterArr = Object.keys(item.sub_id).map(Number)
    }
    if (RANGE_TYPES.includes(curType)) {
      Object.values(item.sub_id)
        .map((sub) => [Number(sub.qty_minimum), Number(sub.qty_maximum)] as [number, number])
        .forEach((sub) => filterArr.push(...createRangeArray(sub)))
    }
    let chooseArr = filterArr
    if (item.relation === 'sneq') {
      let allId: number[] = []
      if (CLICK_TYPES.includes(curType)) {
        allId = (origin[originIndex].sub as Array<{ id: number }>).map((sub) => sub.id)
      }
      if (RANGE_TYPES.includes(curType)) {
        ;(origin[originIndex].sub as Array<{ qty_minimum: number; qty_maximum: number }>)
          .map((sub) => [Number(sub.qty_minimum), Number(sub.qty_maximum)] as [number, number])
          .forEach((sub) => allId.push(...createRangeArray(sub)))
      }
      if (curType === AREA_TYPE) {
        allId = (origin[originIndex].sub as Array<{ area: Array<{ id: number }> }>).map(
          (sub) => sub.area[0].id
        )
      }
      if (curType === SYSTEM_TYPE) {
        allId = Object.values(
          origin[originIndex].sub as Record<string, { child: Array<{ id: number }> }>
        ).reduce<number[]>((all, cur) => {
          all.push(...cur.child.map((item) => item.id))
          return all
        }, [])
      }
      chooseArr = allId.filter((id) => !filterArr.includes(id))
      if (curType === SWITCH_TYPE) chooseArr = [0]
    }

    const target = nextOptions[curOptionIndex]
    const originRaw = origin[originIndex]

    let nextOption: RemfConfigOptionItem = { ...target }

    if (CLICK_TYPES.includes(curType)) {
      const curSubs = (originRaw.sub as Array<{ id: number }>).filter((sub) =>
        chooseArr.includes(sub.id)
      )
      nextOption = { ...nextOption, sub: curSubs as RemfConfigOptionItem['sub'] }
    } else if (RANGE_TYPES.includes(curType)) {
      nextOption = {
        ...nextOption,
        qty_minimum: chooseArr[0] ?? 0,
        qty_maximum: chooseArr[chooseArr.length - 1] ?? 0,
        qty_range: chooseArr,
      }
    } else if (curType === AREA_TYPE) {
      const curSubs = (originRaw.sub as Array<{ area: Array<{ id: number }> }>).filter(
        (sub) => chooseArr.includes(sub.area[0].id)
      )
      nextOption = { ...nextOption, sub: curSubs as RemfConfigOptionItem['sub'] }
    } else if (curType === SYSTEM_TYPE) {
      const group = originRaw.sub as Record<
        string,
        { child: Array<{ id: number }> }
      >
      const curSubs = Object.keys(group).reduce<Record<string, unknown>>((all, cur) => {
        const child = group[cur].child.filter((item) => chooseArr.includes(item.id))
        if (child.length > 0) {
          all[cur] = { ...group[cur], child }
        }
        return all
      }, {})
      nextOption = {
        ...nextOption,
        sub: curSubs as RemfConfigOptionItem['sub'],
        systemArr: Object.keys(curSubs).map((value) => ({ value, label: value })),
      }
    } else if (curType === SWITCH_TYPE) {
      nextOption = { ...nextOption, disabled: true }
    }

    if (nextOption !== target) {
      nextOptions = nextOptions.map((opt, idx) => (idx === curOptionIndex ? nextOption : opt))
    }

    if (!chooseArr.includes(Number(nextForm[item.config_id]))) {
      let reset: ConfigFormValue = ''
      if (CLICK_TYPES.includes(curType)) {
        reset = (nextOption.sub as Array<{ id: number }>)[0]?.id ?? ''
      } else if (RANGE_TYPES.includes(curType)) {
        reset = chooseArr[0] ?? 0
      } else if (curType === SWITCH_TYPE) {
        reset = chooseArr[0] ?? 0
      } else if (curType === AREA_TYPE) {
        const subs = nextOption.sub as Array<{ area: Array<{ id: number }> }>
        reset = subs[0]?.area[0]?.id ?? ''
      } else if (curType === SYSTEM_TYPE) {
        const group = nextOption.sub as Record<string, { child: Array<{ id: number }> }>
        reset = group[Object.keys(group)[0]]?.child[0]?.id ?? ''
      }
      nextForm[item.config_id] = reset
    }
  }
  return { options: nextOptions, form: nextForm }
}

/**
 * 变更配置项的统一入口（对应官方 changeClick/changeItem/changeArea/changeSystem/handleChange）：
 * 先恢复受影响关联项，再判断是否命中联动；命中则应用限制结果，否则仅更新值。
 */
export function handleOptionChange(params: {
  origin: RemfConfigOptionItem[]
  options: RemfConfigOptionItem[]
  form: ConfigForm
  limit: RemfConfigLink[]
  causeId: number
  value: ConfigFormValue
}): ConfigFormSnapshot {
  const { origin, options, form, limit, causeId, value } = params
  const withValue = { ...form, [causeId]: value }
  const restored = restoreDependents(origin, options, withValue, limit, causeId)
  if (hasActiveLimit(restored.options, restored.form, limit)) {
    return applyResultLimit(origin, restored.options, restored.form, limit, causeId)
  }
  return restored
}

/** 初始化时应用全部联动（官方 getConfig 末尾：filterLimit() 为真时逐个 changeOptItem） */
export function applyInitLimits(
  origin: RemfConfigOptionItem[],
  options: RemfConfigOptionItem[],
  form: ConfigForm,
  limit: RemfConfigLink[]
): ConfigFormSnapshot {
  if (!hasActiveLimit(options, form, limit)) return { options, form }
  let state: ConfigFormSnapshot = { options, form }
  for (const cause of limit) {
    state = applyResultLimit(origin, state.options, state.form, limit, cause.config_id)
  }
  return state
}

/** 官方 genEnCode：按规则生成随机密码 */
export function genPassword(rule: {
  len_num: string
  upper: string
  lower: string
  num: string
  special: string
}): string {
  const length = Number(rule.len_num)
  const hasNum = Number(rule.num)
  const hasChar = Number(rule.upper) + Number(rule.lower)
  const hasSymbol = Number(rule.special)
  const caseSense = rule.upper === '1' && rule.lower === '1' ? '1' : '0'
  const lowerCase = rule.lower === '1' ? '1' : '0'
  let m = ''
  if (hasNum === 0 && hasChar === 0 && hasSymbol === 0) return m
  for (let i = length; i > 0; i--) {
    const num = Math.floor(Math.random() * 94 + 33)
    if (
      (hasNum === 0 && num >= 48 && num <= 57) ||
      (hasChar === 0 && ((num >= 65 && num <= 90) || (num >= 97 && num <= 122))) ||
      (hasSymbol === 0 &&
        ((num >= 33 && num <= 47) ||
          (num >= 58 && num <= 64) ||
          (num >= 91 && num <= 96) ||
          (num >= 123 && num <= 127)))
    ) {
      i++
      continue
    }
    m += String.fromCharCode(num)
  }
  if (caseSense === '0') {
    m = lowerCase === '0' ? m.toUpperCase() : m.toLowerCase()
  }
  return m
}

/** 自定义字段校验（官方 verifyCustomFiled 逐条规则） */
export function verifyCustomField(field: RemfCustomFieldItem, value: string): string | null {
  if (value === '') {
    return `${field.field_name}不能为空！`
  }
  const regexpr =
    field.field_type === 'link'
      ? '/^(((ht|f)tps?):\\/\\/)?([^!@#$%^&*?.s-]([^!@#$%^&*?.s]{0,63}[^!@#$%^&*?.s])?.)+[a-z]{2,6}\\/?/'
      : field.regexpr
  if (regexpr) {
    if (!new RegExp(regexpr.replace(/^\/|\/$/g, '')).test(value)) {
      return `${field.field_name}自定义字段不符合规则！`
    }
  }
  return null
}

/** 全部自定义字段校验（官方 verifyCustomFiled） */
export function verifyCustomFields(
  fields: RemfCustomFieldItem[],
  values: Record<string, string>
): string | null {
  const requireArr = fields.filter(
    (item) => item.is_required === 1 || (item.is_required === 0 && values[item.id] !== '')
  )
  if (requireArr.length === 0) return null
  const empty = requireArr.find((item) => values[item.id] === '')
  if (empty) return `${empty.field_name}不能为空！`
  for (const item of requireArr) {
    const error = verifyCustomField(item, values[item.id])
    if (error) return error
  }
  return null
}

/** 组装购物车/结算参数（官方 formatData） */
export function formatCartParams(params: {
  productId: number
  form: ConfigForm
  cycle: RemfConfigCycle['billingcycle']
  qty: number
  position?: number
  showHost: boolean
  showPassword: boolean
  customfield: Record<string, unknown>
  selfDefinedField: Record<string, string>
  cascaderSon: Record<number, Array<{ id: number; checkSubId?: number | string }>>
  curSystem?: string
}): {
  product_id: number
  config_options: { configoption: Record<string, unknown>; cycle: string; host?: string; password?: string }
  qty: number
  customfield: Record<string, unknown>
  self_defined_field: Record<string, string>
  position?: number
} {
  const temp: Record<string, unknown> = { ...params.form }
  for (const sonList of Object.values(params.cascaderSon)) {
    sonList.forEach((el) => {
      temp[el.id] = Number(el.checkSubId)
    })
  }
  const configoption = { ...temp }
  const customfield = {
    ...params.customfield,
    curSystem: params.curSystem ?? '',
    cascaderParams: (params.customfield.cascaderParams as Record<number, number | string>) ?? {},
  }
  return {
    position: params.position,
    product_id: params.productId,
    config_options: {
      configoption,
      cycle: params.cycle,
      host: params.showHost ? String(configoption.host ?? '') : undefined,
      password: params.showPassword ? String(configoption.password ?? '') : undefined,
    },
    qty: params.qty,
    customfield,
    self_defined_field: params.selfDefinedField,
  }
}
