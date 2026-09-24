// 预加载脚本：前端可通过 window.desktop.isDesktop 识别桌面端环境
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  platform: process.platform
})
