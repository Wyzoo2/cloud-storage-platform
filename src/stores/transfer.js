import { defineStore } from 'pinia'
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchUploadTasks, fetchUploadTaskDetail, deleteUploadTask, clearCompletedUploadTasks } from '@/utils/uploadTaskStore'
import { getCachedFile, removeCachedFile, cacheFile } from '@/utils/uploadFileStore'
import { uploadFile } from '@/utils/upload'
import { uploadApi } from '@/api'
import { useFileStore } from '@/stores/file'

// 传输任务运行时状态：本地运行态（waiting/uploading/paused）+ 后端任务记录（GET /uploads）
// 任务 id 统一用 init 返回的 sessionId（后端自增 id）；哈希阶段 tmpKey / 秒传 instant-id 为本地临时 id
export const useTransferStore = defineStore('transfer', () => {
  const localTasks = ref([])   // 本地运行态任务（内存）：waiting → uploading → done / paused
  const remoteTasks = ref([])  // 后端任务记录（当前页）：uploading / done / aborted
  const page = ref(1)          // 当前页码（UI 1 起；接口从 0 起，查询传 page - 1）
  const pageSize = ref(10)     // 每页条数（后端分页，默认 10）
  const remoteTotal = ref(0)   // 后端任务总数
  const hiddenRemote = reactive(new Set()) // 续传启动中的旧任务 id：避免与本地新实例双条目展示
  const resuming = reactive({}) // task.id -> AbortController（该任务正在上传/续传中）
  const resumeLocks = new Set() // 续传启动锁：await 取缓存窗口内连点「继续」会开出多路并发续传
  const uploadingSha = new Set() // sha256 -> 正在上传（内容级去重，防同文件重复起实例走到 MinIO 合并）
  const hashing = reactive({}) // tmpKey -> 哈希百分比（等待上传阶段的指纹计算进度，供传输页展示）

  // 合并展示：本地运行态在前；后端记录按 id 去重（本地实例优先）
  const tasks = computed(() => {
    const localIds = new Set(localTasks.value.map(t => t.id))
    return [...localTasks.value, ...remoteTasks.value.filter(t => !localIds.has(t.id) && !hiddenRemote.has(t.id))]
  })

  // 分页 total：后端总数 + 本地临时任务（tmp-/instant- 无后端记录）；sessionId 任务已计入后端 total
  const listTotal = computed(() => remoteTotal.value + localTasks.value.filter(t => String(t.id).startsWith('tmp-') || String(t.id).startsWith('instant-')).length)

  // ---- 本地任务表维护 ----
  function upsertLocal(task) {
    const idx = localTasks.value.findIndex(t => t.id === task.id)
    if (idx >= 0) localTasks.value[idx] = { ...localTasks.value[idx], ...task }
    else localTasks.value.push({ ...task })
  }
  function removeLocal(id) {
    localTasks.value = localTasks.value.filter(t => t.id !== id)
  }

  // ---- 后端列表刷新（后端分页：按当前页查询，默认每页 10 条；排序在前端做）----
  async function refresh() {
    try {
      const res = await fetchUploadTasks({ page: page.value - 1, size: pageSize.value })
      remoteTasks.value = (res.list || []).map(t => ({
        id: t.id,
        name: t.name,
        size: t.sizeBytes,
        status: t.status, // uploading / done / aborted
        fileId: t.fileId ?? null,
        parentId: null,
        sha256: null,
        totalParts: 0,
        doneParts: 0,
        progress: 0,
        createdAt: t.createdAt ? new Date(t.createdAt).getTime() : 0,
        source: 'remote'
      })).sort((a, b) => b.createdAt - a.createdAt)
      remoteTotal.value = res.total ?? (res.list || []).length
      if (!remoteTasks.value.length && page.value > 1) { page.value--; return } // 当前页被删空：回退一页（page watch 触发重查）
      syncPolling()
      pollOnce() // 立即拉一次进度，避免刷新后 uploading 任务先显示 0%
    } catch {
      // 拉取失败保留旧数据（拦截器已提示）
    }
  }

  // ---- 进度轮询：后端 uploading 且本地无运行实例的任务（刷新前上传 / 其他页面在传）----
  const POLL_MS = 2000
  let pollTimer = null

  function remoteUploadingIds() {
    const localIds = new Set(localTasks.value.map(t => t.id))
    return remoteTasks.value.filter(t => t.status === 'uploading' && !localIds.has(t.id)).map(t => t.id)
  }

  function syncPolling() {
    const has = remoteUploadingIds().length > 0
    if (has && !pollTimer) pollTimer = setInterval(pollOnce, POLL_MS)
    else if (!has && pollTimer) { clearInterval(pollTimer); pollTimer = null }
  }

  async function pollOnce() {
    const ids = remoteUploadingIds()
    if (!ids.length) { syncPolling(); return }
    await Promise.all(ids.map(async id => {
      const t = remoteTasks.value.find(x => x.id === id)
      if (!t) return
      try {
        const d = await fetchUploadTaskDetail(id)
        if (d.chunkSize) t.totalParts = Math.ceil((d.sizeBytes ?? t.size) / d.chunkSize)
        t.doneParts = (d.uploadedParts || []).length
        t.progress = t.totalParts ? Math.min(100, Math.round(t.doneParts / t.totalParts * 100)) : t.progress
        t.sha256 = d.sha256 || t.sha256 // 续传要传给 init 幂等复用 session
        t.parentId = d.parentId ?? t.parentId
        if (d.status && d.status !== 'uploading') { // 其他页面/设备完成或放弃：状态对齐
          t.status = d.status
          t.fileId = d.fileId ?? t.fileId
          syncPolling()
        }
      } catch { /* 单次失败忽略，下轮重试 */ }
    }))
  }

  function percent(t) {
    if (t.status === 'done') return 100
    if (t.source === 'remote') return t.progress || 0
    if (!t.totalParts) return 0
    return Math.min(100, Math.round(((t.doneParts || 0) / t.totalParts) * 100))
  }

  // 展示状态：done=已完成；aborted=已放弃；本地实例按运行态；后端 uploading 无本地实例=待续传
  function stateOf(t) {
    if (t.source === 'remote') {
      if (t.status === 'done') return 'done'
      if (t.status === 'aborted') return 'aborted'
      return 'paused'
    }
    if (t.status === 'done') return 'done'
    if (resuming[t.id]) return t.totalParts ? 'uploading' : 'waiting'
    return t.totalParts ? 'paused' : 'waiting' // 刷新后无运行态：有进度视为暂停待续传，无进度视为等待
  }

  // 上传完成后刷新文件列表：仅当用户停留在上传目标目录
  function notifyFileList(parentId) {
    try {
      const fileStore = useFileStore()
      if (fileStore.currentParentId === parentId) fileStore.loadDir()
    } catch { /* 文件 store 未就绪忽略 */ }
  }

  // 统一上传入口：首次上传与续传共用。
  // 维护本地运行态（可暂停）、实时进度；完成后本地置 done，由后端记录接管持久化
  function upload(file, parentId, handlers = {}) {
    const { onProgress } = handlers
    const controller = new AbortController()
    // 哈希阶段暂用临时 key 登记；init 返回 sessionId 后切换为后端任务 id
    const tmpKey = 'tmp-' + Date.now().toString(36) + Math.random().toString(36).slice(2)
    resuming[tmpKey] = controller
    let snapId = null
    let lastSnap = null
    let lastSha = null // 本实例内容哈希：done/fail 时从 uploadingSha 摘除
    upsertLocal({ id: tmpKey, name: file.name, size: file.size, parentId, status: 'waiting', totalParts: 0, doneParts: 0, source: 'local' })
    cacheFile(tmpKey, file) // 选定文件即缓存本体：大文件哈希耗时数分钟，期间暂停后继续也能命中缓存

    const clearResume = () => {
      if (resuming[tmpKey] === controller) delete resuming[tmpKey]
      delete hashing[tmpKey] // 哈希进度随运行态清理
      if (snapId && resuming[snapId] === controller) delete resuming[snapId]
      if (lastSha) uploadingSha.delete(lastSha) // 结束（done/fail）后释放内容级锁
    }

    return uploadFile(file, parentId, {
      signal: controller.signal,
      // 内容级去重：哈希算完、init 之前判断，同内容已在传则跳过本实例，避免两个实例都走到 MinIO 合并导致后者失败
      onBeforeInit: sha => {
        if (uploadingSha.has(sha)) {
          ElMessage.warning('「' + file.name + '」已在传输中，请勿重复发起')
          return false
        }
        uploadingSha.add(sha)
        lastSha = sha
        return true
      },
      onProgress: p => {
        if (p.phase === 'hash') hashing[tmpKey] = p.percent // 等待阶段展示「正在校验指纹」进度
        onProgress && onProgress(p)
      },
      onSnapshot: snap => {
        if (controller.signal.aborted) return // 已暂停/放弃：丢弃迟到快照，防止已清理的任务复活
        if (snapId !== snap.id) { removeLocal(tmpKey); removeCachedFile(tmpKey); delete hashing[tmpKey] } // 临时记录被正式快照替换（id=sessionId / 秒传 instant-id）
        snapId = snap.id
        lastSnap = snap
        if (resuming[tmpKey] === controller) {
          delete resuming[tmpKey]
          resuming[snapId] = controller
        }
        upsertLocal({ ...snap, status: snap.status || 'uploading', source: 'local' })
      }
    })
      .then(async res => {
        clearResume()
        if (snapId) hiddenRemote.delete(snapId) // 本地实例已接管/结束，恢复 remote 记录展示
        if (res.skipped) { // 内容已在传：跳过本实例，清理临时等待记录与缓存，不落完成记录、不提示成功
          removeLocal(tmpKey)
          removeCachedFile(tmpKey)
          return res
        }
        if (controller.signal.aborted) { // 已放弃（如哈希阶段放弃后秒传返回）：不落完成记录，避免任务复活
          removeLocal(snapId || tmpKey)
          return res
        }
        // 完成保留记录：后端已落库，本地同步置 done；秒传 instant-id 由后端记录接管
        const doneId = snapId || tmpKey
        upsertLocal({
          id: doneId,
          name: file.name,
          size: file.size,
          parentId,
          sha256: lastSnap?.sha256,
          status: 'done',
          totalParts: lastSnap?.totalParts || 0,
          doneParts: lastSnap?.totalParts || 0,
          source: 'local'
        })
        await refresh() // 拉回后端记录（含 fileId；秒传按 fileId 对齐真实任务 id）
        if (String(doneId).startsWith('instant-')) {
          const matched = remoteTasks.value.find(t => t.fileId === res.fileId)
          if (matched) removeLocal(doneId) // 后端记录接管展示
        }
        notifyFileList(parentId) // 上传完成刷新文件列表（当前目录=目标目录时）
        ElMessage.success(res.instant ? `「${file.name}」秒传成功` : `「${file.name}」上传成功`)
        return res
      })
      .catch(err => {
        clearResume()
        if (snapId) hiddenRemote.delete(snapId) // 失败后旧记录恢复展示（local snapId 记录保留为 paused 供续传）
        removeLocal(tmpKey) // 清理临时记录（已有快照时早已被替换，重复删除无害）
        removeCachedFile(tmpKey) // 同步清理临时缓存（重复删除无害）
        throw err
      })
  }

  // 续传：优先从 IndexedDB 取回缓存文件本体，无需重新选择；缓存缺失时回退到重新选文件
  async function resumeTask(task) {
    if (resuming[task.id]) return // 该任务正在传输中，不重复续传
    if (task.sha256 && uploadingSha.has(task.sha256)) return // 同内容已有实例在传，不重复续传
    if (resumeLocks.has(task.id)) return // 节流：同一任务续传启动中，重复点击直接忽略
    resumeLocks.add(task.id)
    try {
      let t = task
      if (t.source === 'remote' && (!t.sha256 || t.parentId == null)) {
        // 刷新后恢复：先拉详情补齐 sha256 / parentId（init 幂等复用 session 需要）
        const d = await fetchUploadTaskDetail(t.id).catch(() => null)
        if (d) t = { ...t, sha256: d.sha256 || t.sha256, parentId: d.parentId ?? t.parentId }
      }
      const cacheKey = t.sha256 || t.id // 正式记录按内容哈希取缓存；tmpKey 记录按 tmpKey 取
      const cached = await getCachedFile(cacheKey)
      if (cached) {
        ElMessage.info(`正在续传「${t.name}」`)
        removeLocal(t.id) // 本地旧记录移除（新上传实例接管：init 幂等复用同 session）
        hiddenRemote.add(t.id) // 隐藏期：新实例哈希阶段不与旧记录双条目
        removeCachedFile(cacheKey) // 旧缓存清理：文件本体已在内存，新上传链路会重建缓存
        upload(cached, t.parentId ?? 0).catch(() => { hiddenRemote.delete(t.id) }) // 失败恢复旧记录展示
      } else {
        ElMessage.warning(`本地未找到「${t.name}」的缓存，请重新选择同一个文件继续`)
        pickFileForResume(t)
      }
    } finally {
      resumeLocks.delete(task.id) // 新任务已同步接管（waiting 态），释放锁
    }
  }

  function pickFileForResume(task) {
    const input = document.createElement('input')
    input.type = 'file'
    input.onchange = () => {
      const f = input.files && input.files[0]
      if (!f) return
      removeLocal(task.id)
      hiddenRemote.add(task.id)
      upload(f, task.parentId ?? 0).catch(() => { hiddenRemote.delete(task.id) })
    }
    input.click()
  }

  function pauseTask(task) {
    const c = resuming[task.id]
    if (c) {
      c.abort()
      delete resuming[task.id]
      ElMessage.info(`已暂停「${task.name}」，可随时继续`)
    }
  }

  // 放弃未完成上传：中止本地实例 + 后端 session（后端自动置 aborted，幂等）
  function discardTask(task) {
    ElMessageBox.confirm(`放弃「${task.name}」的未完成上传？`, '提示', { type: 'warning', confirmButtonText: '放弃', cancelButtonText: '取消' })
      .then(async () => {
        const c = resuming[task.id]
        if (c) c.abort()
        delete resuming[task.id]
        removeLocal(task.id)
        removeCachedFile(task.sha256 || task.id) // tmpKey 记录的缓存挂在 tmpKey 上
        hiddenRemote.delete(task.id)
        const isTemp = String(task.id).startsWith('tmp-') || String(task.id).startsWith('instant-')
        if (!isTemp) {
          // sessionId 即任务 id：abort 后端自动标 aborted（done/aborted 再调无副作用）
          try { await uploadApi.abort(task.id) } catch { /* 网络失败忽略，后端最终一致 */ }
        }
        refresh() // 拉回 aborted 状态
      })
      .catch(() => {})
  }

  // 移除已完成/已放弃记录（后端 DELETE；uploading 返回 40211「请先放弃」由拦截器提示）
  async function removeRecord(task) {
    const isTemp = String(task.id).startsWith('tmp-') || String(task.id).startsWith('instant-')
    if (task.source === 'local' && isTemp) { removeLocal(task.id); return } // 无后端记录的本地临时任务
    try {
      await deleteUploadTask(task.id)
      removeLocal(task.id)
      refresh() // 删除后整页刷新：后一条补位 + total 同步
      hiddenRemote.delete(task.id)
    } catch {
      refresh() // 失败刷新保证状态一致（拦截器已提示）
    }
  }

  // 清空全部已完成（后端接口；本地 done 记录一并清理）
  async function clearDone() {
    try {
      const res = await clearCompletedUploadTasks()
      const n = typeof res === 'number' ? res : (res?.count ?? 0)
      localTasks.value = localTasks.value.filter(t => t.status !== 'done')
      await refresh()
      ElMessage.success(`已清空 ${n} 条已完成记录`)
    } catch { /* 拦截器已提示 */ }
  }

  refresh()

  // 翻页由分页器驱动：页码变化查当前页；条数变化先回第一页（避免双重请求）
  watch(page, () => refresh())
  watch(pageSize, () => { if (page.value !== 1) page.value = 1; else refresh() })

  return { tasks, page, pageSize, listTotal, resuming, hashing, refresh, percent, stateOf, upload, resumeTask, pauseTask, discardTask, removeRecord, clearDone }
})
