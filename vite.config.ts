/// <reference types="vitest/config" />
import http from 'node:http'
import https from 'node:https'
import path from 'path'
import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import { playwright } from '@vitest/browser-playwright'

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
    plugins: [react(), tailwindcss()],
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
