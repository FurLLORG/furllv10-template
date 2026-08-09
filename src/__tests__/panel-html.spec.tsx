import { describe, expect, it } from 'vitest'
import {
  buildPanelIframeDoc,
  extractBodyHtml,
  extractPanelJumpUrl,
  hasPanelContent,
  parseCustomPanel,
  parsePanelHtml,
  shouldUseIframe,
} from '@/lib/panel-html'

const CDN_PANEL = `<!DOCTYPE html>
<html lang="en">
<head><title>Document</title></head>
<body>
  <div class="row">
    <div class="col sm-5">
      <div class="card bg-primary text-white h-250">
        <div class="card-header bg-primary">用户名</div>
        <div class="card-body"><center class="col sm-5">ser447056848620@qq.com</center></div>
      </div>
    </div>
    <div class="col sm-5 wh">
      <div class="card bg-primary text-white h-250">
        <div class="card-header bg-primary">密码</div>
        <div class="card-body"><center>AN6Ho1QW9zp2</center></div>
      </div>
    </div>
  </div>
  <div class="row">
    <div class="col sm-5">
      <div class="card bg-primary text-white h-250">
        <div class="card-header bg-primary">站点统计</div>
        <div class="card-body"><center><h3 style="color: #fff"><span class="badge badge-warning">0个</span></h3></center></div>
      </div>
    </div>
    <div class="col sm-5 wh">
      <div class="card bg-primary text-white h-250">
        <div class="card-header bg-primary">流量统计</div>
        <div class="card-body"><center><h3>已用流量<span>0MB</span>/总计流量<span>30GB</span></h3></center></div>
      </div>
    </div>
  </div>
  <a href="https://www.heicdn.cn/#/auth-redirect" target="_blank" class="btn btn-primary btn-lg btn-block">登录面板</a>
  <center class="col sm-5">如登录失败，可重置密码重试</center>
</body>
</html>`

describe('parsePanelHtml（面板完整 HTML 解析为结构化卡片）', () => {
  it('解析 bootstrap card-header/body 为标签/值卡片', () => {
    const { cards } = parsePanelHtml(CDN_PANEL)
    expect(cards).toEqual([
      { label: '用户名', value: 'ser447056848620@qq.com' },
      { label: '密码', value: 'AN6Ho1QW9zp2' },
      { label: '站点统计', value: '0个' },
      { label: '流量统计', value: '已用流量0MB/总计流量30GB' },
    ])
  })

  it('解析 a.btn 为操作按钮', () => {
    const { actions } = parsePanelHtml(CDN_PANEL)
    expect(actions).toEqual([
      { text: '登录面板', href: 'https://www.heicdn.cn/#/auth-redirect' },
    ])
  })

  it('解析卡片/链接外的叶子文本为提示行', () => {
    const { notes } = parsePanelHtml(CDN_PANEL)
    expect(notes).toContainEqual({ text: '如登录失败，可重置密码重试' })
  })

  it('空/纯文本内容判为无结构化内容', () => {
    expect(hasPanelContent(parsePanelHtml('<div>hello</div>'))).toBe(true)
    expect(hasPanelContent(parsePanelHtml(''))).toBe(false)
    expect(hasPanelContent(parsePanelHtml('<script>x</script>'))).toBe(false)
  })

  it('</html> 后尾随的 <style>/<script> 文本不泄露为提示行（回归）', () => {
    const html =
      CDN_PANEL +
      '<style>.swal2-popup { top: 30%; font-size: 16px; }</style>' +
      '<script>var keep = true;</script>'
    const { notes } = parsePanelHtml(html)
    expect(notes.some((n) => n.text.includes('.swal2-popup'))).toBe(false)
    expect(notes.some((n) => n.text.includes('keep'))).toBe(false)
  })
})

describe('extractBodyHtml', () => {
  it('提取 body 内部内容', () => {
    expect(extractBodyHtml('<html><body>abc</body></html>')).toContain('abc')
    expect(extractBodyHtml('no body')).toBe('no body')
    expect(extractBodyHtml('')).toBe('')
  })
})

describe('shouldUseIframe', () => {
  it('纯 bootstrap 卡片 + a.btn 面板走结构化渲染', () => {
    expect(shouldUseIframe(CDN_PANEL, parsePanelHtml(CDN_PANEL))).toBe(false)
  })

  it('带 <button> 的富交互面板走 iframe（保交互）', () => {
    const rich = '<div><button id="gotoPanel" class="btn">跳转到面板</button></div>'
    expect(shouldUseIframe(rich, parsePanelHtml(rich))).toBe(true)
  })

  it('带 <script> 的面板走 iframe（保脚本逻辑）', () => {
    const rich = '<div>abc<script>$(function(){window.open(url)})</script></div>'
    expect(shouldUseIframe(rich, parsePanelHtml(rich))).toBe(true)
  })

  it('仅加载外部库脚本（sweetalert2）的静态面板走结构化渲染（回归）', () => {
    const nokvm =
      CDN_PANEL.replace(
        '</html>',
        '</html><link rel="stylesheet" href="/plugins/server/idcsmart_common/module/nokvm/templates/nokvm/css/htools.select.skin.css">' +
          '<script src="/plugins/server/idcsmart_common/module/nokvm/templates/nokvm/js/sweetalert2.all.min.js"></script>'
      )
    expect(shouldUseIframe(nokvm, parsePanelHtml(nokvm))).toBe(false)
  })

  it('解析不出结构化内容但有内容时 iframe 兜底', () => {
    const emptyBody = '<html><body><div class="x"></div></body></html>'
    expect(shouldUseIframe(emptyBody, parsePanelHtml(emptyBody))).toBe(true)
  })

  it('空内容不触发 iframe', () => {
    expect(shouldUseIframe('', parsePanelHtml(''))).toBe(false)
  })
})

describe('buildPanelIframeDoc', () => {
  it('注入系统 jQuery 且保留 body 内容', () => {
    const doc = buildPanelIframeDoc('<html><body><button>跳转</button></body></html>')
    expect(doc).toContain(
      'jquery.mini.js'
    )
    expect(doc).toContain('<button>跳转</button>')
    expect(doc).toMatch(/<body>/)
  })

  it('body 内脚本原样保留（iframe 内可执行）', () => {
    const script = '<html><body><script>var x=1</script></body></html>'
    const doc = buildPanelIframeDoc(script)
    expect(doc).toContain('<script>var x=1</script>')
  })

  it('保留 head 样式与 </html> 后的尾随全局资产', () => {
    const html =
      '<html><head><title>CDN 控制面板</title><style>.tianqi-cdnfly-card{color:#333}</style></head>' +
      '<body><button>跳转</button></body></html>' +
      '<link rel="stylesheet" href="/plugins/server/.../htools.css">' +
      '<script src="/plugins/server/.../sweetalert2.all.min.js"></script>'
    const doc = buildPanelIframeDoc(html)
    expect(doc).toContain('.tianqi-cdnfly-card{color:#333}')
    expect(doc).toContain('htools.css')
    expect(doc).toContain('sweetalert2.all.min.js')
    expect(doc).toContain('<button>跳转</button>')
  })
})

describe('parseCustomPanel（tianqi-cdnfly 自定义解析器）', () => {
  const HTML = `<html><head><style>.tianqi-cdnfly-card{}</style></head>
<body>
  <div class="tianqi-cdnfly-container">
    <div class="tianqi-cdnfly-card">
      <div class="tianqi-cdnfly-card-body">
        <h4 class="tianqi-cdnfly-card-title">CDN面板信息</h4>
        <p class="tianqi-cdnfly-p">用户名: ser547048698047</p>
        <p class="tianqi-cdnfly-p">密码: g1OSk1GoySbh</p>
        <button id="gotoPanel" class="tianqi-cdnfly-btn">跳转到面板</button>
      </div>
    </div>
  </div>
</body></html>`

  it('识别 tianqi-cdnfly 类签名并返回自定义内容', () => {
    const content = parseCustomPanel(HTML)
    expect(content).not.toBeNull()
    expect(content?.title).toBe('CDN面板信息')
    expect(content?.cards).toEqual([
      { label: '用户名', value: 'ser547048698047' },
      { label: '密码', value: 'g1OSk1GoySbh' },
    ])
    expect(content?.actions).toEqual([{ text: '跳转到面板', href: '' }])
  })

  it('非自定义格式返回 null（交默认解析/iframe）', () => {
    expect(parseCustomPanel('<div class="card"><div class="card-header">用户名</div></div>')).toBeNull()
    expect(parseCustomPanel('')).toBeNull()
  })
})

describe('extractPanelJumpUrl（沙箱执行面板脚本抓跳转 URL）', () => {
  const HTML = `<html><body>
    <button id="gotoPanel">跳转到面板</button>
    <script>
      $(document).ready(function() {
        var access_token = 'Ab/Cd==';
        access_token = access_token.replace(/\\//g, "_").replace(/=/g, ",");
        $('#gotoPanel').click(function() {
          var url = "?access_token=" + access_token + "&username=u1&uid=15411";
          var encodedUrl = btoa(url);
          var dailiUrl = "https://cdn.example.net//cdnlogin?token=" + encodedUrl;
          window.open(dailiUrl);
        });
      });
    </script>
  </body></html>`

  it('解析出脚本最终 window.open 的目标 URL', () => {
    const url = extractPanelJumpUrl(HTML)
    expect(url).toMatch(/^https:\/\/cdn\.example\.net\/\/cdnlogin\?token=/)
    expect(url).toContain(btoa('?access_token=Ab_Cd,,&username=u1&uid=15411'))
  })

  it('无内联脚本返回 null', () => {
    expect(extractPanelJumpUrl('<html><body>hi</body></html>')).toBeNull()
    expect(extractPanelJumpUrl('')).toBeNull()
  })
})
