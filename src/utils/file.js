// 文件类型推导：后端 FileNodeVO 无 type 字段，由文件名后缀推导
export function extToType(name) {
  if (!name || !name.includes('.')) return 'text'
  const ext = name.split('.').pop().toLowerCase()
  const map = {
    pdf: 'pdf',
    png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image', bmp: 'image', psd: 'image',
    doc: 'word', docx: 'word',
    xls: 'excel', xlsx: 'excel', csv: 'excel',
    ppt: 'ppt', pptx: 'ppt',
    mp4: 'video', avi: 'video', mov: 'video', mkv: 'video', webm: 'video',
    mp3: 'audio', wav: 'audio', flac: 'audio', ogg: 'audio', m4a: 'audio', aac: 'audio',
    zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive',
    md: 'text', txt: 'text', log: 'text', json: 'text', xml: 'text'
  }
  return map[ext] || 'text'
}

// FileNodeVO → 前端展示对象（extra 可附加 deletedAt 等字段）
export function mapFileNode(f, extra = {}) {
  return {
    id: f.id,
    parentId: f.parentId,
    name: f.name,
    isDir: !!f.isDir,
    type: f.isDir ? 'folder' : extToType(f.name),
    size: f.size || 0,
    updatedAt: f.updatedAt,
    ...extra
  }
}

export function formatSize(bytes) {
  const n = Number(bytes) || 0
  if (!n) return '0 B'
  // 支持负数（企业池「可再分配」超卖为负）：先取绝对值换算，再补负号
  const sign = n < 0 ? '-' : ''
  const v = Math.abs(n)
  const k = 1024, s = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  let i = Math.floor(Math.log(v) / Math.log(k))
  i = Math.max(0, Math.min(i, s.length - 1)) // 边界保护，防止单位 undefined
  return sign + parseFloat((v / Math.pow(k, i)).toFixed(1)) + ' ' + s[i]
}

export function formatDate(iso) {
  if (!iso) return '--'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '--'
  return d.toLocaleDateString('zh-CN') + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
//多z
export function formatDateNo8(iso) {
  if (!iso) return '--'
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(iso))
  if (!m) return '--'
  const [, y, mo, d, h, mi] = m
  if (y === '0001') return '--'          // 顺手挡掉 Go/.NET 的零值
  return `${y}-${mo}-${d} ${h}:${mi}`
}
/**
 * 剩余有效期的展示文案：
 *   > 1 天  → 剩 N 天（四舍五入）
 *   ≤ 1 天  → 剩 N 小时（四舍五入，最少 1 小时）
 *   ≤ 1 小时 → 剩 N 分钟（四舍五入，最少 1 分钟）
 *   ≤ 0     → 已到期
 */
export function formatRemain(expireAt) {
  if (!expireAt) return ''
  const ms = new Date(expireAt).getTime() - Date.now()
  if (isNaN(ms)) return ''
  if (ms <= 0) return '已到期'
  // 用四舍五入而不是向下取整：避免「还剩 1 小时」刚过 1 秒就显示成 59 分钟
  const minutes = Math.round(ms / 60000)
  if (minutes < 60) return `剩 ${Math.max(1, minutes)} 分钟`
  const hours = Math.round(ms / 3600000)
  if (hours < 24) return `剩 ${Math.max(1, hours)} 小时`
  return `剩 ${Math.max(1, Math.round(ms / 86400000))} 天`
}

/** 距离到期还有多少毫秒（负数=已过期） */
export function remainMs(expireAt) {
  if (!expireAt) return null
  const ms = new Date(expireAt).getTime() - Date.now()
  return isNaN(ms) ? null : ms
}
