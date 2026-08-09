import { describe, expect, it } from 'vitest'
import {
  applyInitLimits,
  collectConfigForm,
  createRangeArray,
  formatCartParams,
  genPassword,
  handleOptionChange,
  prepareOptions,
  verifyCustomField,
  verifyCustomFields,
  type ConfigForm,
} from '@/features/cart/config-engine'
import type {
  RemfConfigLink,
  RemfConfigOptionItem,
  RemfCustomFieldItem,
} from '@/api'

/** 生成一个配置项（sub 为子项 id 列表） */
function item(
  id: number,
  optionType: number,
  name: string,
  subs: Array<{ id: number; qty_minimum?: number; qty_maximum?: number }>
): RemfConfigOptionItem {
  return {
    id,
    option_name: name,
    option_type: optionType,
    qty_minimum: 0,
    qty_maximum: 0,
    unit: '',
    sub: subs as RemfConfigOptionItem['sub'],
  }
}

describe('createRangeArray', () => {
  it('生成闭区间连续数组', () => {
    expect(createRangeArray([1, 4])).toEqual([1, 2, 3, 4])
    expect(createRangeArray([5, 5])).toEqual([5])
  })
})

describe('prepareOptions', () => {
  it('过滤空 sub 与 qty_maximum 为 0 的数量项，富化 systemArr/qty_range', () => {
    const raw: RemfConfigOptionItem[] = [
      item(1, 1, '下拉', [{ id: 11 }]),
      item(2, 4, '空数量', []),
      item(3, 4, '带宽', [
        { id: 31, qty_minimum: 10, qty_maximum: 10 },
        { id: 32, qty_minimum: 20, qty_maximum: 30 },
      ]),
      {
        id: 4,
        option_name: '系统',
        option_type: 5,
        qty_minimum: 0,
        qty_maximum: 0,
        unit: '',
        sub: {
          CentOS: { child: [{ id: 41, version: 'CentOS-7' }] },
          Ubuntu: { child: [{ id: 42, version: 'Ubuntu-20' }] },
        },
      },
    ]
    // 数量项 item 级 qty_maximum > 0 → 保留并富化 qty_range
    raw[2].qty_maximum = 30
    const result = prepareOptions(raw)
    expect(result.map((o) => o.id)).toEqual([1, 3, 4])
    const bw = result[1]
    expect(bw.qty_range).toEqual([10, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30])
    const sys = result[2]
    expect(sys.systemArr).toEqual([
      { value: 'CentOS', label: 'CentOS' },
      { value: 'Ubuntu', label: 'Ubuntu' },
    ])
  })

  it('数量项 qty_maximum > 0 保留', () => {
    const range = item(3, 4, '带宽', [
      { id: 31, qty_minimum: 10, qty_maximum: 10 },
    ])
    range.qty_maximum = 10
    expect(prepareOptions([range]).map((o) => o.id)).toEqual([3])
  })
})

describe('collectConfigForm', () => {
  it('按官方规则生成默认值（switch=0 / range=min / 系统=首个child / 其他=sub[0]）', () => {
    const options: RemfConfigOptionItem[] = [
      item(1, 3, '开关', [{ id: 11 }]),
      item(2, 4, '带宽', [{ id: 21, qty_minimum: 10, qty_maximum: 50 }]),
      item(3, 1, '网络', [{ id: 31 }, { id: 32 }]),
      {
        id: 4,
        option_name: '系统',
        option_type: 5,
        qty_minimum: 0,
        qty_maximum: 0,
        unit: '',
        sub: { CentOS: { child: [{ id: 41, version: "CentOS-7" }] }, Ubuntu: { child: [{ id: 42, version: "Ubuntu-20" }] } },
      },
      {
        id: 5,
        option_name: '区域',
        option_type: 12,
        qty_minimum: 0,
        qty_maximum: 0,
        unit: '',
        sub: [{ id: 51, option_name: '香港', area: [{ id: 511 }] }],
      },
    ]
    options[1].qty_minimum = 10
    options[1].qty_maximum = 50
    const { form, curSystem } = collectConfigForm(options, 'ecs01', 'pwd01')
    expect(form[1]).toBe(0)
    expect(form[2]).toBe(10)
    expect(form[3]).toBe(31)
    expect(form[4]).toBe(41)
    expect(form[5]).toBe(511)
    expect(form.host).toBe('ecs01')
    expect(form.password).toBe('pwd01')
    expect(curSystem).toBe('CentOS')
  })
})

describe('handleOptionChange 联动限制', () => {
  const origin: RemfConfigOptionItem[] = [
    item(1, 2, 'CPU', [{ id: 11 }, { id: 12 }, { id: 13 }]),
    item(2, 2, '内存', [{ id: 21 }, { id: 22 }, { id: 23 }]),
  ]
  // CPU=11 时内存可选 [21,22]（seq），CPU 切换后内存恢复全量
  const limit: RemfConfigLink[] = [
    {
      config_id: 1,
      relation: 'seq',
      sub_id: { 11: {} },
      result: [{ config_id: 2, relation: 'seq', sub_id: { 21: {}, 22: {} } }],
    },
  ]
  const init = collectConfigForm(origin, undefined, undefined)

  it('CPU=11 时内存被限制为 [21,22]', () => {
    const applied = applyInitLimits(origin, origin, init.form, limit)
    expect((applied.options[1].sub as Array<{ id: number }>).map((s) => s.id)).toEqual([
      21, 22,
    ])
  })

  it('切换到未命中限制的 CPU 后内存恢复全量', () => {
    const result = handleOptionChange({
      origin,
      options: origin,
      form: init.form,
      limit,
      causeId: 1,
      value: 13,
    })
    expect((result.options[1].sub as Array<{ id: number }>).map((s) => s.id)).toEqual([
      21, 22, 23,
    ])
  })

  it('命中限制时当前值不在可选内则重置为第一个', () => {
    const form: ConfigForm = { 1: 11, 2: 23 }
    const result = handleOptionChange({ origin, options: origin, form, limit, causeId: 1, value: 11 })
    expect(result.form[2]).toBe(21)
  })

  it('无联动时原样返回', () => {
    const result = handleOptionChange({ origin, options: origin, form: init.form, limit: [], causeId: 1, value: 12 })
    expect(result.form[1]).toBe(12)
    expect(result.options).toBe(origin)
  })
})

describe('genPassword', () => {
  it('按规则生成密码并满足长度', () => {
    const pwd = genPassword({ len_num: '10', upper: '1', lower: '1', num: '1', special: '0' })
    expect(pwd).toHaveLength(10)
    expect(/[A-Z]/.test(pwd)).toBe(true)
    expect(/[a-z]/.test(pwd)).toBe(true)
    expect(/\d/.test(pwd)).toBe(true)
    expect(/[^A-Za-z0-9]/.test(pwd)).toBe(false)
  })

  it('全部禁用时返回空', () => {
    expect(genPassword({ len_num: '8', upper: '0', lower: '0', num: '0', special: '0' })).toBe('')
  })
})

describe('verifyCustomFields', () => {
  const fields: RemfCustomFieldItem[] = [
    { id: 1, field_name: '邮箱', field_type: 'text', is_required: 1 },
    { id: 2, field_name: '网址', field_type: 'link', is_required: 0 },
  ]

  it('必填为空时报错', () => {
    expect(verifyCustomFields(fields, { 1: '', 2: '' })).toBe('邮箱不能为空！')
  })

  it('link 类型非链接报错', () => {
    // 官方 link 正则较宽松（. 通配符可跨连字符），纯数字无字母必然不匹配
    expect(verifyCustomFields(fields, { 1: 'a@b.com', 2: '1234567890' })).toBe(
      '网址自定义字段不符合规则！'
    )
  })

  it('全部合法返回 null', () => {
    expect(verifyCustomFields(fields, { 1: 'a@b.com', 2: 'https://example.com' })).toBeNull()
  })

  it('可选字段留空不校验', () => {
    expect(verifyCustomFields(fields, { 1: 'a@b.com', 2: '' })).toBeNull()
  })

  it('verifyCustomField 规则（单条）', () => {
    expect(verifyCustomField(fields[0], '')).toBe('邮箱不能为空！')
    expect(verifyCustomField(fields[0], 'ok')).toBeNull()
  })
})

describe('formatCartParams', () => {
  it('组装购物车参数：host/password 随 show 开关、级联子项并入 configoption', () => {
    const result = formatCartParams({
      productId: 7,
      form: { 1: 11, host: 'ecs01', password: 'pwd01' },
      cycle: 'monthly',
      qty: 2,
      position: 3,
      showHost: true,
      showPassword: false,
      customfield: {},
      selfDefinedField: { 9: '备注' },
      cascaderSon: { 20: [{ id: 901, checkSubId: 5 }] },
      curSystem: 'CentOS',
    })
    expect(result.product_id).toBe(7)
    expect(result.qty).toBe(2)
    expect(result.position).toBe(3)
    expect(result.config_options.cycle).toBe('monthly')
    expect(result.config_options.host).toBe('ecs01')
    expect(result.config_options.password).toBeUndefined()
    expect(result.config_options.configoption[901]).toBe(5)
    expect(result.customfield.curSystem).toBe('CentOS')
    expect(result.self_defined_field).toEqual({ 9: '备注' })
  })
})
