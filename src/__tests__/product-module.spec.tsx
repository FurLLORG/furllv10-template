import { describe, expect, it } from 'vitest'
import {
  detectProductModule,
  detectTabsFromContent,
  PRODUCT_MODULES,
  type ProductPluginType,
} from '@/lib/remf-module'

const DETAIL_JS: Record<string, string> = {
  cloud: 'cloudDetail.js',
  dcim: 'dcimDetail.js',
  common: 'common_product_detail.js',
}

const TAB_HTML: Record<string, string> = {
  '1': '<el-tab-pane :label="lang.common_cloud_tab1" name="1"></el-tab-pane>',
  '2': '<el-tab-pane :label="lang.common_cloud_tab2" name="2"></el-tab-pane>',
  '3': '<el-tab-pane :label="lang.common_cloud_tab3" name="3"></el-tab-pane>',
  '4': '<el-tab-pane :label="lang.common_cloud_tab4" name="4"></el-tab-pane>',
  '5': '<el-tab-pane :label="lang.common_cloud_tab5" name="5"></el-tab-pane>',
  '6': '<el-tab-pane :label="lang.common_cloud_tab6" name="6"></el-tab-pane>',
}

/** 构造接近官方真实内容的模块页 HTML（css + el-tab-pane + 自身 detail js） */
function content(
  type: ProductPluginType,
  module: string,
  kind: 'cloud' | 'dcim' | 'common',
  tabs: string[]
): string {
  return [
    `<link rel="stylesheet" href="/plugins/${type}/${module}/template/clientarea/pc/default/css/cloudDetail.css?v=10.7.2">`,
    ...tabs.map((t) => TAB_HTML[t]),
    `<script src="/plugins/${type}/${module}/template/clientarea/pc/default/js/${DETAIL_JS[kind]}"></script>`,
  ].join('\n')
}

/** 官方各模块真实 tab 集合（tab1..tab6 → monitor/manage/disk/network/backup/log） */
const OFFICIAL_TABS: Record<string, string[]> = {
  'reserver/mf_finance': ['1', '2', '4', '5', '6'],
  'reserver/mf_finance_common': ['1', '2', '6'],
  'reserver/mf_finance_dcim': ['1', '2', '4', '6'],
  'reserver/mf_cloud': ['1', '2', '3', '4', '6'],
  'reserver/mf_dcim': ['1', '2', '4', '6'],
  'reserver/idcsmart_common': ['1', '2', '6'],
  'server/mf_cloud': ['1', '2', '3', '4', '6'],
  'server/mf_dcim': ['1', '2', '4', '6'],
  'server/idcsmart_common': ['1', '2', '6'],
}

describe('detectProductModule（通用推导，不再依赖白名单匹配）', () => {
  it('PRODUCT_MODULES 注册表保留（供 langUrl 解析），仍 9 项', () => {
    expect(PRODUCT_MODULES).toHaveLength(9)
  })

  it('server/reserver 全部模块通用推导出命名空间与 kind（re+module 规则）', () => {
    const cases: Array<[ProductPluginType, string, string, 'cloud' | 'dcim' | 'common']> = [
      ['reserver', 'mf_finance', 'remf_finance', 'cloud'],
      ['reserver', 'mf_finance_common', 'remf_finance_common', 'common'],
      ['reserver', 'mf_finance_dcim', 'remf_finance_dcim', 'dcim'],
      ['reserver', 'mf_cloud', 'remf_cloud', 'cloud'],
      ['reserver', 'mf_dcim', 'remf_dcim', 'dcim'],
      ['reserver', 'idcsmart_common', 'reidcsmart_common', 'common'],
      ['server', 'mf_cloud', 'mf_cloud', 'cloud'],
      ['server', 'mf_dcim', 'mf_dcim', 'dcim'],
      ['server', 'idcsmart_common', 'idcsmart_common', 'common'],
    ]
    for (const [type, module, ns, kind] of cases) {
      const tabs = OFFICIAL_TABS[`${type}/${module}`]
      const detected = detectProductModule(content(type, module, kind, tabs))
      expect(detected, `${type}/${module} 应探测到`).not.toBeNull()
      expect(detected?.module).toBe(module)
      expect(detected?.type).toBe(type)
      expect(detected?.apiNamespace).toBe(ns)
      expect(detected?.kind).toBe(kind)
    }
  })

  it('能力集以动态 tab 为准（对照官方，不再写死 mf_cloud backup / mf_finance disk）', () => {
    const dcim = detectProductModule(
      content('server', 'mf_dcim', 'dcim', OFFICIAL_TABS['server/mf_dcim'])
    )!
    // mf_dcim：统计/管理/网络/日志，无磁盘/备份/NAT
    expect(dcim.features).toMatchObject({
      monitor: true,
      manage: true,
      network: true,
      disk: false,
      backup: false,
      nat: false,
    })

    const mfCloud = detectProductModule(
      content('reserver', 'mf_cloud', 'cloud', OFFICIAL_TABS['reserver/mf_cloud'])
    )!
    // mf_cloud：统计/管理/磁盘/网络/日志，官方无备份 tab
    expect(mfCloud.features).toMatchObject({
      disk: true,
      network: true,
      backup: false,
      nat: true,
    })

    const common = detectProductModule(
      content(
        'reserver',
        'mf_finance_common',
        'cloud',
        OFFICIAL_TABS['reserver/mf_finance_common']
      )
    )!
    // mf_finance_common：统计/管理/日志
    expect(common.features).toMatchObject({
      disk: false,
      nat: false,
      backup: false,
      network: false,
    })
  })

  it('mf_finance 不会误匹配 mf_finance_common / mf_finance_dcim', () => {
    const detected = detectProductModule(
      content('reserver', 'mf_finance', 'cloud', OFFICIAL_TABS['reserver/mf_finance'])
    )
    expect(detected?.module).toBe('mf_finance')
    expect(detected?.apiNamespace).toBe('remf_finance')
    // 官方 mf_finance 无磁盘 tab（注释掉的 el-tab-pane 不计入），但保留网络/备份
    expect(detected?.features.disk).toBe(false)
    expect(detected?.features.network).toBe(true)
    expect(detected?.features.backup).toBe(true)
  })

  it('reserver 模板混有 server 图片路径时仍按自身 detail js 识别（idcsmart_common 代理商品）', () => {
    const html = content(
      'reserver',
      'idcsmart_common',
      'common',
      OFFICIAL_TABS['reserver/idcsmart_common']
    )
    // 官方 reserver idcsmart_common 模板 pass 图标引用 server 路径（非 detail js）
    const mixed =
      html +
      `<img src="/plugins/server/idcsmart_common/template/clientarea/pc/default/img/common/pass-show.png">`
    const detected = detectProductModule(mixed)
    expect(detected?.type).toBe('reserver')
    expect(detected?.module).toBe('idcsmart_common')
    expect(detected?.apiNamespace).toBe('reidcsmart_common')
  })

  it('未知模块（第三方/自研）零登记也能推导命名空间与保守能力集', () => {
    const html = content('server', 'acme_vps', 'cloud', ['1', '2', '4', '6'])
    const detected = detectProductModule(html)
    expect(detected).not.toBeNull()
    expect(detected?.module).toBe('acme_vps')
    expect(detected?.apiNamespace).toBe('acme_vps') // server → module
    expect(detected?.kind).toBe('cloud')
    expect(detected?.features.network).toBe(true)
    expect(detected?.features.upgrade).toBe(true)
    expect(detected?.features.nat).toBe(false)
  })

  it('未知内容返回 null', () => {
    expect(detectProductModule('<div>纯 HTML</div>')).toBeNull()
    expect(detectProductModule('')).toBeNull()
  })
})

describe('detectTabsFromContent（从官方模板动态解析 tab 集合）', () => {
  it('解析非注释 tab，跳过注释与未知编号', () => {
    const html = [
      '<!-- <el-tab-pane :label="lang.common_cloud_tab3" name="3"></el-tab-pane> -->',
      '<el-tab-pane :label="lang.common_cloud_tab1" name="1"></el-tab-pane>',
      '<el-tab-pane :label="lang.common_cloud_tab2" name="2"></el-tab-pane>',
      '<el-tab-pane :label="lang.common_cloud_tab4" name="4"></el-tab-pane>',
      '<el-tab-pane :label="lang.other" name="9"></el-tab-pane>',
    ].join('\n')
    const tabs = detectTabsFromContent(html)
    expect(tabs.has('monitor')).toBe(true)
    expect(tabs.has('manage')).toBe(true)
    expect(tabs.has('disk')).toBe(false) // 注释掉的
    expect(tabs.has('network')).toBe(true)
    expect(tabs.has('backup')).toBe(false)
    expect(tabs.has('log')).toBe(false)
  })

  it('空/无 tab 内容返回空集', () => {
    expect(detectTabsFromContent('').size).toBe(0)
    expect(detectTabsFromContent('<div>no tabs</div>').size).toBe(0)
  })
})
