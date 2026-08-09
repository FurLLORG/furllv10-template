import { describe, expect, it } from 'vitest'
import { parseModuleFromContent } from '@/lib/module-content'

describe('parseModuleFromContent', () => {
  it('解析用户示例的 /console/v1/menu/2403/host 返回（mf_dcim, server）', () => {
    const content =
      '<!-- 页面独有样式 -->\n<link rel="stylesheet" href="/plugins/server/mf_dcim/template/clientarea/pc/default/css/dcimList.css?v=10.7.2">\n\n\n<div id="cloudList">\n  <!-- 自己的东西 -->\n  <div class="main-card">\n    <div class="main-card-title">\n      <span class="title-text">{{lang.cloud_title}}</span>\n    </div>\n    <div class="main-card-table">\n      <product-filter :tab.sync="params.tab" @change="inputChange" :count="countData"></product-filter>\n      <batch-renewpage :tab="params.tab" :ids="multipleSelection" module-type="mf_dcim" @success="inputChange" ref="batchRenewRef">\n      </batch-renewpage>\n      <traffic-warning module="mf_dcim"></traffic-warning>\n    </div>\n  </div>\n</div>\n<!-- =======页面独有======= -->\n<script src="/plugins/server/mf_dcim/template/clientarea/pc/default/lang/index.js?v=10.7.2"></script>\n<script src="/plugins/server/mf_dcim/template/clientarea/pc/default/api/dcim.js?v=10.7.2"></script>\n<script src="/plugins/server/mf_dcim/template/clientarea/pc/default/js/dcimList.js?v=10.7.2"></script>\n'
    expect(parseModuleFromContent(content)).toEqual({
      kind: 'server',
      module: 'mf_dcim',
    })
  })

  it('解析 mf_cloud 模块 content（server）', () => {
    const content =
      '<script src="/plugins/server/mf_cloud/template/clientarea/pc/default/api/mf_cloud.js?v=10.7.2"></script>'
    expect(parseModuleFromContent(content)).toEqual({
      kind: 'server',
      module: 'mf_cloud',
    })
  })

  it('解析 idcsmart_common 模块 content（server 插件，产品列表页）', () => {
    const content =
      '<script src="/plugins/server/idcsmart_common/template/clientarea/pc/default/js/common_product_list.js?v=10.7.2"></script>'
    expect(parseModuleFromContent(content)).toEqual({
      kind: 'server',
      module: 'idcsmart_common',
    })
  })

  it('解析 reserver 插件 content（mf_finance 系列 / 代理 idcsmart_common）', () => {
    expect(
      parseModuleFromContent(
        '<script src="/plugins/reserver/mf_finance/template/clientarea/pc/default/js/cloudList.js?v=10.7.2"></script>'
      )
    ).toEqual({ kind: 'reserver', module: 'mf_finance' })
    expect(
      parseModuleFromContent(
        '<script src="/plugins/reserver/mf_finance_dcim/template/clientarea/pc/default/js/cloudList.js?v=10.7.2"></script>'
      )
    ).toEqual({ kind: 'reserver', module: 'mf_finance_dcim' })
    expect(
      parseModuleFromContent(
        '<script src="/plugins/reserver/idcsmart_common/template/clientarea/pc/default/js/common_product_list.js?v=10.7.2"></script>'
      )
    ).toEqual({ kind: 'reserver', module: 'idcsmart_common' })
  })

  it('reserver 模块路径不会误匹配 server 正则', () => {
    expect(
      parseModuleFromContent(
        '<script src="/plugins/reserver/mf_finance_common/template/clientarea/pc/default/js/cloudList.js"></script>'
      )
    ).toEqual({ kind: 'reserver', module: 'mf_finance_common' })
  })

  it('无模块资源路径返回 null', () => {
    expect(parseModuleFromContent('<div>纯 HTML</div>')).toBeNull()
    expect(parseModuleFromContent('')).toBeNull()
  })
})
