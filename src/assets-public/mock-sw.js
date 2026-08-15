// 临时 mock service worker：拦截 API 返回假数据，用于本地布局复现（调试后删除）
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
])

const ok = (data, { status = 200 } = {}) =>
  new Response(JSON.stringify({ status, msg: 'ok', data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

const addons = [
  { id: 1, name: 'IdcsmartHelp', title: '帮助中心', url: '' },
  { id: 2, name: 'IdcsmartNews', title: '新闻中心', url: '' },
  { id: 3, name: 'IdcsmartFileDownload', title: '文件下载', url: '' },
]

const newsTypes = [
  { id: 1, name: '云服务器帮助文档很长的分类名称AAAAAAAAAAAAAAAAAAA', news_num: 12 },
  { id: 2, name: '域名相关', news_num: 3 },
  { id: 3, name: '财务问题', news_num: 8 },
]

const newsItems = Array.from({ length: 12 }).map((_, i) => ({
  id: i + 1,
  title:
    (i % 3 === 0
      ? '这是一条非常非常非常非常非常非常非常非常长的新闻标题AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
      : '关于 ' + ['云服务器', '域名', 'SSL'][i % 3] + ' 的使用说明与常见问题解答') +
    (i + 1),
  img: '',
  create_time: 1750000000 + i * 86400,
  update_time: 1750000000 + i * 86400,
  keywords: '',
}))

const helpGroups = Array.from({ length: 6 }).map((_, i) => ({
  id: i + 1,
  name: ['服务器使用帮助', '域名服务', '备案流程', '财务管理', '常见问题FAQ', '联系我们'][i],
  helps: [
    { id: i * 10 + 1, title: '如何重装系统并配置安全组规则' },
    { id: i * 10 + 2, title: '发票开具说明与退换货政策' },
    { id: i * 10 + 3, title: '一个标题特别特别特别特别特别特别特别长的文档名称ZZZZZZZZZZZZ' },
  ],
}))

const fileFolders = [
  { id: 1, name: '帮助文档', file_num: 15 },
  { id: 2, name: '软件下载', file_num: 4 },
]

const fileList = Array.from({ length: 15 }).map((_, i) => ({
  id: i + 1,
  name: 'documentation-guide-2026-very-long-file-name-part-' + (i + 1) + '.pdf',
  description: '这是一个文件描述描述描述描述描述描述描述描述',
  filetype: 'pdf',
  filesize: 2048000 * (i + 1),
  addon_idcsmart_file_folder_id: i % 2 ? 1 : 2,
}))

self.addEventListener('install', (e) => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  const path = url.pathname

  if (path.startsWith('/console/v1/common'))
    return event.respondWith(
      ok({ website_name: 'FurLL', system_logo: '', language: 'zh-cn' })
    )
  if (path.startsWith('/console/v1/index'))
    return event.respondWith(
      ok({
        account: {
          username: 'tester',
          email: 't@t.com',
          phone: '',
          phone_code: '',
          unpaid_order: 0,
          expiring_count: 0,
        },
      })
    )
  if (path.startsWith('/console/v1/menu'))
    return event.respondWith(ok({ menu: [] }))
  if (path.startsWith('/console/v1/cart'))
    return event.respondWith(ok({ list: [] }))
  if (path.startsWith('/console/v1/furll_home/addons'))
    return event.respondWith(
      ok({ client_id: 1, client_name: 'tester', addons, count: addons.length })
    )
  if (path.startsWith('/console/v1/news/type'))
    return event.respondWith(ok({ list: newsTypes, count: newsTypes.length }))
  if (path.startsWith('/console/v1/news'))
    return event.respondWith(
      ok({ list: newsItems, count: newsItems.length, limit: 20, page: 1 })
    )
  if (path.startsWith('/console/v1/help/index'))
    return event.respondWith(ok({ index: helpGroups }))
  if (path.startsWith('/console/v1/help'))
    return event.respondWith(ok({ list: helpGroups }))
  if (path.startsWith('/console/v1/file/folder'))
    return event.respondWith(ok({ list: fileFolders, count: fileFolders.length }))
  if (path.startsWith('/console/v1/file'))
    return event.respondWith(
      ok({ list: fileList, count: fileList.length, limit: 10, page: 1 })
    )
  if (
    path.startsWith('/plugins/') ||
    path.startsWith('/clientarea/') ||
    path.startsWith('/upload')
  ) {
    if (path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg'))
      return event.respondWith(
        new Response(PNG, {
          status: 200,
          headers: { 'Content-Type': 'image/png' },
        })
      )
    if (path.includes('source_back')) return event.respondWith(new Response(PNG, { status: 200, headers: { 'Content-Type': 'image/png' } }))
    return event.respondWith(new Response('', { status: 200, headers: { 'Content-Type': 'text/html' } }))
  }
  return event.respondWith(fetch(event.request))
})
