// 预加载脚本：前端可通过 window.desktop 识别桌面端环境并调用自动更新能力
// 注意：sandbox 模式下 require('electron') 只有 contextBridge/ipcRenderer 等白名单 API，
// 拿不到 app 模块，因此版本号等主进程信息一律通过 IPC 获取
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  platform: process.platform,
  // 当前客户端版本号字符串（取自 package.json version），返回 Promise
  getVersion: () => ipcRenderer.invoke('desktop:get-version'),
  // 下载并静默安装；payload: { downloadUrl, fileHash }，成功后程序自动退出
  downloadAndInstall: payload => ipcRenderer.invoke('desktop:download-and-install', payload),
  // 下载进度回调（0-100），返回取消监听函数
  onUpdateProgress: cb => {
    const listener = (_e, percent) => cb(percent)
    ipcRenderer.on('desktop:update-progress', listener)
    return () => ipcRenderer.removeListener('desktop:update-progress', listener)
  }
})
