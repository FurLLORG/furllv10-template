/// <reference types="vitest/config" />
import http from 'node:http'
import https from 'node:https'
import fs from 'node:fs/promises'
import path from 'path'
import {
  defineConfig,
  loadEnv,
  type Plugin,
  type ProxyOptions,
} from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import { playwright } from '@vitest/browser-playwright'

// dev 兼容：经由 proxy 拉到远程 php 壳（ViewCartController/ViewClientController 输出）引用的
// 是构建产物 /web/FurLLV10/assets/index.js|css（见 scripts/shells/）。dev 无该产物，且 /web
// 不在 proxy 也不在 publicDir → 直接访问 proxied 页面时 404/拿到 index.html 当模块加载失败。
// 这里把入口 js 换成 vite dev 入口 shim（/@vite/client + /src/main.tsx），css 置空，
// 让直接访问壳 URL（如 /cart/goods.htm）也能加载当前 dev React 应用。
function devShellAssets(): Plugin {
  return {
    name: 'furll-dev-shell-assets',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url ?? '').split('?')[0]

        // /cart 被开发代理转发到系统时，直接访问 goods.htm 会拿到远程官方 goods.php，
        // 从而完全绕过 React。开发环境中这些 SPA 页始终由 Vite index.html 承载；
        // 官方 default 内容只能出现在页面内部的 legacy iframe。
        if (
          req.method === 'GET' &&
          (url === '/cart/goods.htm' || url === '/productdetail.htm')
        ) {
          const indexPath = path.resolve(__dirname, 'index.html')
          const html = await fs.readFile(indexPath, 'utf-8')
          const transformedHtml = await server.transformIndexHtml(req.url ?? '/', html)
          res.statusCode = 200
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(transformedHtml)
          return
        }

        if (url === '/web/FurLLV10/assets/index.js') {
          res.setHeader('Content-Type', 'text/javascript; charset=utf-8')
          res.setHeader('Cache-Control', 'no-cache')
          // @vitejs/plugin-react 的 preamble（index.html 注入的同款）：JSX transform 校验
          // window.$RefreshReg$，静态 import 会被提升先执行，故 main.tsx 必须动态 import 在设全局之后
          res.end(
            "import { injectIntoGlobalHook } from '/@react-refresh';\n" +
              'injectIntoGlobalHook(window);\n' +
              'window.$RefreshReg$ = () => {};\n' +
              'window.$RefreshSig$ = () => (type) => type;\n' +
              "await import('/src/main.tsx');\n"
          )
          return
        }
        if (url === '/web/FurLLV10/assets/index.css') {
          // dev 样式由 main.tsx 的 CSS import（tailwind 插件以 JS 注入）提供，无需单独 css
          res.setHeader('Content-Type', 'text/css; charset=utf-8')
          res.setHeader('Cache-Control', 'no-cache')
          res.end('')
          return
        }
        next()
      })
    },
  }
}

// 代理连接池：复用指向 VITE_API_PROXY_TARGET 的 TCP/TLS 连接，
// 避免每个 API 请求重新握手（本地 dev 到远程测试站时收益明显）
function createProxyAgent(target: string) {
  const options = { keepAlive: true, maxSockets: 32 }
  return target.startsWith('https://')
    ? new https.Agent(options)
    : new http.Agent(options)
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 开发代理目标从环境变量读取（.env.local 配置，不提交仓库）
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_API_PROXY_TARGET

  const proxyOptions: ProxyOptions | undefined = proxyTarget
    ? {
        target: proxyTarget,
        changeOrigin: true,
        configure: (_proxy, options) => {
          options.agent = createProxyAgent(proxyTarget)
        },
      }
    : undefined

  return {
    plugins: [react(), tailwindcss(), devShellAssets()],
    // 源码静态资源目录（dev 模式服务 /images /favicon.ico /mock-sw.js）：
    // favicon.ico 服务器已有、mock-sw.js 仅本地调试，均不打包进产物；
    // images/ 由 deploy.mjs 显式复制（官网运行时 /images/ 引用）
    publicDir: path.resolve(__dirname, 'src/assets-public'),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: proxyTarget
        ? {
            '/console/v1': proxyOptions!,
            '/rtapi': proxyOptions!,
            '/upload': proxyOptions!,
            // 图形验证码插件（TpCaptcha verify/refresh）走独立 /captcha 路由
            '/captcha': proxyOptions!,
            // goods 页宿主依赖官方主题静态资源（Vue2/ElementUI/组件/插件模板）
            '/clientarea': proxyOptions!,
            // 官方购物车主题资源（goods 页 goods.css/goods.js/api，legacy-goods.html 引用）
            '/cart': proxyOptions!,
            '/plugins': proxyOptions!,
          }
        : undefined,
    },
    build: {
      // 固定入口与 css 文件名（无 hash）：各壳模板引用 /web/FurLLV10/assets/index.js|css 才能稳定命中
      rollupOptions: {
        output: {
          entryFileNames: 'assets/index.js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: (info) => {
            if (info.name?.endsWith('.css')) return 'assets/index.css'
            return 'assets/[name]-[hash][extname]'
          },
        },
      },
      // 不自动把 public/ 拷进 dist：favicon.ico、mock-sw.js 与 deploy 产物不进构建，
      // images/ 由 deploy.mjs 显式复制（官网运行时 /images/ 引用）
      copyPublicDir: false,
    },
    test: {
      silent: 'passed-only',
      unstubEnvs: true,
      browser: {
        enabled: true,
        provider: playwright(),
        instances: [{ browser: 'chromium' }],
      },
      coverage: {
        // include: ['src/**/*.{js,jsx,ts,tsx}'], // Uncomment to expand the report to all src/**/* so untested modules appear as 0% coverage.
        exclude: [
          'src/components/ui/**',
          'src/assets/**',
          'src/tanstack-table.d.ts',
          'src/routeTree.gen.ts',
          'src/test-utils/**',
          'src/routes/**',
        ],
      },
    },
  }
})
