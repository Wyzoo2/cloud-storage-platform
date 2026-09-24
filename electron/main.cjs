// Electron 主进程：CloudVault 桌面端入口
const { app, BrowserWindow, shell } = require('electron')
const path = require('path')

const isDev = !app.isPackaged
const DEV_URL = 'http://localhost:3000'

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    title: 'CloudVault 云存储平台',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // 打包后页面以 file:// 加载，axios 直连后端 http 接口，关闭同源检查避免 CORS 拦截
      webSecurity: false
    }
  })

  win.once('ready-to-show', () => win.show())

  // 页面内新开的链接（如文件下载预签名地址）交给系统浏览器处理
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    // 开发模式：加载 vite dev server，API 由 vite.config.js 的 proxy 转发到后端
    win.loadURL(DEV_URL)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    // 生产模式：加载打包后的静态资源（vite build --mode desktop 的产物）
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
