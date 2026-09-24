import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig(({ mode }) => ({
  // 桌面端打包（--mode desktop）资源用相对路径，Electron 以 file:// 加载 dist；Web 端保持根路径
  base: mode === 'desktop' ? './' : '/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  css: {
    preprocessorOptions: {
      scss: { additionalData: '' }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://192.168.9.160:3001',
        // target: 'http://112.4.135.254:9999',
        changeOrigin: true
      }
    }
  }
}))
