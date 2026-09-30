// Electron 主进程：CloudVault 桌面端入口
const { app, BrowserWindow, shell, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const http = require('http')
const https = require('https')
const { spawn } = require('child_process')

const isDev = !app.isPackaged
const DEV_URL = 'http://localhost:3000'

let win = null

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    // 窗口/任务栏图标：开发模式生效（生产模式 Windows 优先用 exe 内嵌图标；文件不存在时自动忽略）
    icon: path.join(__dirname, '../build/icon.ico'),
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

// ===================== 自动更新（与 App 同款：下载 EXE → 校验 → 静默安装）=====================

/**
 * 下载文件（支持 http/https、3xx 重定向、可选 Authorization），边下边报进度
 * @returns {Promise<void>}
 */
function downloadFile(url, dest, onProgress, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('重定向次数过多'))
    const client = url.startsWith('https') ? https : http
    const req = client.get(url, { rejectUnauthorized: false }, res => {
      // 重定向
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume()
        const nextUrl = new URL(res.headers.location, url).toString()
        return resolve(downloadFile(nextUrl, dest, onProgress, redirects + 1))
      }
      if (res.statusCode !== 200) {
        res.resume()
        return reject(new Error('下载失败 HTTP ' + res.statusCode))
      }

      const total = parseInt(res.headers['content-length'] || '0', 10)
      let received = 0
      const writer = fs.createWriteStream(dest)
      res.on('data', chunk => {
        received += chunk.length
        if (total > 0) onProgress(Math.min(99, Math.round((received / total) * 100)))
      })
      res.pipe(writer)
      writer.on('finish', () => writer.close(() => resolve()))
      writer.on('error', reject)
    })
    req.on('error', reject)
    req.setTimeout(10 * 60 * 1000, () => req.destroy(new Error('下载超时')))
  })
}

/** 计算文件 SHA256（十六进制小写） */
function sha256OfFile(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(file)
    stream.on('data', d => hash.update(d))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

/**
 * 渲染进程请求：下载并安装
 * payload: { downloadUrl, fileHash, versionCode/versionName }
 * 主进程通过事件把进度推回渲染进程（desktop:update-progress）
 */
// 渲染进程获取当前客户端版本号（sandbox 下 preload 无法直接访问 app 模块，只能走 IPC）
ipcMain.handle('desktop:get-version', () => app.getVersion())

ipcMain.handle('desktop:download-and-install', async (_e, payload) => {
  const { downloadUrl, fileHash } = payload || {}
  if (!downloadUrl) throw new Error('下载地址为空')

  const tmpDir = app.getPath('temp')
  const installer = path.join(tmpDir, `CloudVault-Setup-${Date.now()}.exe`)

  // 1. 下载（nginx 静态目录直连）
  await downloadFile(downloadUrl, installer, percent => {
    if (win && !win.isDestroyed()) win.webContents.send('desktop:update-progress', percent)
  })

  // 2. SHA256 校验
  if (fileHash) {
    const actual = await sha256OfFile(installer)
    if (actual.toLowerCase() !== String(fileHash).toLowerCase()) {
      fs.existsSync(installer) && fs.unlinkSync(installer)
      throw new Error('安装包校验失败，文件可能已损坏')
    }
  }

  // 3. 通过独立 VBS 脚本拉起 NSIS 安装器：WScript.Sleep 3 秒释放文件锁 → 静默安装 → 清理安装包
  //    用 VBS + wscript 完全无窗口执行（cmd bat 方案会闪黑窗，体验差）
  //    VBS 字符串内双引号用 "" 转义；installer 路径无引号字符，直接嵌入 OK
  //    sh.Run 第二参数 0=隐藏窗口，第三参数 True=等 NSIS 装完再删安装包；vbs 残留无害（句柄占用删不掉）
  const vbs = path.join(tmpDir, `cloudvault-update-${Date.now()}.vbs`)
  const vbsLines = [
    'Set fso = CreateObject("Scripting.FileSystemObject")',
    'Set sh = CreateObject("WScript.Shell")',
    'WScript.Sleep 3000',
    `sh.Run """${installer}"" /S", 0, True`,
    `fso.DeleteFile "${installer}", True`,
  ].join('\r\n')
  fs.writeFileSync(vbs, vbsLines, 'ascii')
  const child = spawn('wscript.exe', ['//B', '//Nologo', `"${vbs}"`], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    windowsVerbatimArguments: true
  })
  child.unref()

  // 4. 退出旧程序（NSIS runAfterFinish 默认会启动新版）
  setTimeout(() => app.quit(), 300)
  return true
})
