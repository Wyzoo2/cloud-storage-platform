import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { MOUNT_BASE } from './src/deploy.config.js'

export default defineConfig(({ mode }) => ({
  // 桌面端（--mode desktop）用相对路径（Electron file://）；Web 端前缀见 src/deploy.config.js
  base: mode === 'desktop' ? './' : MOUNT_BASE,
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
        target: 'http://192.168.9.107:3001',
        // target: 'http://112.4.135.254:9999',
        changeOrigin: true
      }
    }
  }
}))
