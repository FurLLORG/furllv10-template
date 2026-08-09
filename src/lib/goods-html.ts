/**
 * 商品/分组描述富文本 HTML 的作用域样式（官方 v-html 渲染，用作用域选择器隔离样式，
 * 只影响描述容器内元素，不污染整个页面）。商品列表与购买页共用。
 */
export const DESC_HTML_CLASS =
  'text-[13px] leading-relaxed [&_*]:m-0 [&_p]:mb-1 [&_ul]:mb-1 [&_ol]:mb-1 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-4 [&_ol]:pl-4 [&_li]:mb-0.5 [&_li]:leading-relaxed [&_h1]:mb-1 [&_h1]:text-sm [&_h1]:font-semibold [&_h2]:mb-1 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_strong]:font-semibold [&_em]:italic [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_img]:max-w-full [&_img]:rounded'
