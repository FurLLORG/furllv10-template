import path from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// jsdom 环境测试（复现浏览器交互用，与主 browser 测试配置隔离）
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/__tests__/**/*.spec.tsx'],
    testTimeout: 15000,
  },
})
