<template>
  <div class="cs-page">
    <!-- 页头 -->
    <div class="transfer-head">
      <div class="transfer-head__left">
        <h2 class="page-title"><el-icon><Upload /></el-icon>传输任务</h2>
        <p class="transfer-subtitle">上传记录实时展示，未完成任务可暂停、续传或放弃</p>
      </div>
      <el-button v-if="doneCount > 0" text size="small" @click="transfer.clearDone()">
        <el-icon><Delete /></el-icon><span>清空已完成（{{ doneCount }}）</span>
      </el-button>
    </div>

    <!-- 任务列表（整体一个卡片，行式布局） -->
    <div class="tr-ws">
    <div class="cs-card task-panel">
      <!-- 空状态 -->
      <div v-if="!transfer.tasks.length" class="panel-empty">
        <el-empty description="当前没有传输任务" :image-size="120" />
        <p class="empty-tip">上传文件后，任务将显示在这里，支持断点续传</p>
      </div>

      <!-- 任务行 -->
      <div v-for="t in sortedTasks" v-else :key="t.id" class="task-row" :class="{ 'is-on': selectedTask && selectedTask.id === t.id }" @click="selectedTask = t">
        <div class="task-row__icon" :style="iconStyle(t)">
          <el-icon :size="20"><component :is="getIconName(t)" /></el-icon>
        </div>

        <div class="task-row__main">
          <div class="task-row__title">
            <span class="task-row__name" :title="t.name">{{ t.name }}</span>
            <span class="task-row__size">{{ formatSize(t.size || 0) }}</span>
          </div>

          <!-- 传输中 / 已暂停：进度条 -->
          <div v-if="stateOf(t) === 'uploading' || stateOf(t) === 'paused'" class="task-row__progress">
            <span class="progress-track">
              <span class="progress-fill" :class="{ 'is-paused': stateOf(t) === 'paused' }" :style="{ width: transfer.percent(t) + '%' }"></span>
            </span>
            <span class="progress-pct" :class="{ 'is-paused': stateOf(t) === 'paused' }">{{ transfer.percent(t) }}%</span>
            <span v-if="stateOf(t) === 'paused'" class="progress-hint">{{ t.source === 'remote' ? '待续传' : '已暂停' }}</span>
          </div>

          <!-- 等待上传 -->
          <div v-else-if="stateOf(t) === 'waiting'" class="task-row__status is-waiting">
            <el-icon><Clock /></el-icon><span>{{ transfer.hashing[t.id] != null ? '正在校验指纹 ' + transfer.hashing[t.id] + '%' : '等待上传' }}</span>
          </div>

          <!-- 已放弃 -->
          <div v-else-if="stateOf(t) === 'aborted'" class="task-row__status is-aborted">
            <el-icon><CircleCloseFilled /></el-icon><span>已放弃</span>
          </div>

          <!-- 已完成 -->
          <div v-else class="task-row__status is-done">
            <el-icon><CircleCheckFilled /></el-icon><span>已完成</span>
          </div>
        </div>

        <div class="task-row__ops" v-perm="'transfer.control'">
          <el-tooltip v-if="stateOf(t) === 'uploading'" content="暂停" placement="top">
            <button class="op-btn" @click="transfer.pauseTask(t)"><el-icon><VideoPause /></el-icon></button>
          </el-tooltip>
          <template v-else-if="stateOf(t) === 'paused' || (stateOf(t) === 'waiting' && !transfer.resuming[t.id])">
            <el-tooltip content="继续上传" placement="top">
              <button class="op-btn is-primary" @click="transfer.resumeTask(t)"><el-icon><VideoPlay /></el-icon></button>
            </el-tooltip>
            <el-tooltip content="放弃任务" placement="top">
              <button class="op-btn" @click="transfer.discardTask(t)"><el-icon><Close /></el-icon></button>
            </el-tooltip>
          </template>
          <el-tooltip v-else-if="stateOf(t) === 'waiting'" content="放弃任务" placement="top">
            <button class="op-btn" @click="transfer.discardTask(t)"><el-icon><Close /></el-icon></button>
          </el-tooltip>
          <el-tooltip v-else content="移除记录" placement="top">
            <button class="op-btn" @click="transfer.removeRecord(t)"><el-icon><Close /></el-icon></button>
          </el-tooltip>
        </div>
      </div>
    </div>

    <!-- 分页：后端分页（默认每页 10 条，翻页请求后端当前页） -->
    <el-pagination
      v-if="transfer.tasks.length > 0"
      v-model:current-page="transfer.page"
      v-model:page-size="transfer.pageSize"
      :total="transfer.listTotal"
      :page-sizes="[10, 20, 50, 100]"
      layout="total, sizes, prev, pager, next"
      class="task-pagination"
    />
      <aside class="cs-card tr-side">
        <template v-if="selectedTask">
          <header class="tr-head">
            <span class="tr-kicker">任务详情</span>
            <button class="tr-close" title="关闭" @click="selectedTask = null"><el-icon><Close /></el-icon></button>
          </header>
          <div class="tr-body">
            <div class="tr-name">{{ selectedTask.name }}</div>
            <dl class="tr-meta">
              <div><dt>大小</dt><dd class="mono">{{ formatSize(selectedTask.size || 0) }}</dd></div>
              <div><dt>状态</dt><dd>{{ stateText(selectedTask) }}</dd></div>
              <div v-if="stateOf(selectedTask) === 'uploading' || stateOf(selectedTask) === 'paused'">
                <dt>进度</dt><dd class="mono">{{ transfer.percent(selectedTask) }}%</dd>
              </div>
              <div><dt>来源</dt><dd>{{ selectedTask.source === 'remote' ? '服务器文件' : '本地上传' }}</dd></div>
            </dl>
            <p class="tr-tip">
              {{ stateHint(selectedTask) }}
            </p>
          </div>
        </template>
        <div v-else class="tr-empty">
          <el-icon :size="16"><InfoFilled /></el-icon>
          <span>点击任意任务查看详情</span>
        </div>
      </aside>
    </div>

  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { formatSize, extToType } from '@/utils/file'
import { useTransferStore } from '@/stores/transfer'

const transfer = useTransferStore()

const selectedTask = ref(null)

function stateText(t) {
  const st = stateOf(t)
  return ({ uploading: '传输中', paused: '已暂停 / 待续传', waiting: '等待中', aborted: '已放弃', done: '已完成' })[st] || st
}

function stateHint(t) {
  const st = stateOf(t)
  if (st === 'uploading') return '正在上传，可在右侧操作区暂停；暂停后保留已传分片。'
  if (st === 'paused') return t.source === 'remote' ? '服务器侧任务待续传，可在操作区继续。' : '已暂停，继续后从断点续传。'
  if (st === 'waiting') return '正在校验文件指纹，校验完成后自动开始上传。'
  if (st === 'aborted') return '任务已放弃，如仍需要该文件请重新上传。'
  return '任务已完成，可在「我的文件」中查看。'
}

onMounted(() => transfer.refresh())

const stateOf = t => transfer.stateOf(t)

// ---- 文件图标（与文件列表一致：类型色浅底 + 彩色图标）----
const iconMap = { pdf: 'Document', image: 'Picture', word: 'Document', excel: 'Grid', ppt: 'Monitor', video: 'VideoCamera', audio: 'Headset', archive: 'Files', text: 'Notebook' }
const iconColorMap = { pdf: '#ff4d4f', image: '#52c41a', word: '#1677ff', excel: '#52c41a', ppt: '#fa8c16', video: '#722ed1', audio: '#13c2c2', archive: '#8c8c8c', text: '#595959' }
function getIconName(t) { return iconMap[extToType(t.name)] || 'Document' }
function iconStyle(t) {
  const c = iconColorMap[extToType(t.name)] || '#8c8c8c'
  return { color: c, background: c + '1a' }
}

// ---- 统计与排序：进行中在前，已完成在后 ----
const doneCount = computed(() => transfer.tasks.filter(t => transfer.stateOf(t) === 'done').length)
const ORDER = { uploading: 0, waiting: 1, paused: 2, done: 3, aborted: 4 }
const sortedTasks = computed(() => {
  return [...transfer.tasks].sort((a, b) => {
    const oa = ORDER[transfer.stateOf(a)] ?? 9
    const ob = ORDER[transfer.stateOf(b)] ?? 9
    if (oa !== ob) return oa - ob
    // 未完成任务按创建时间锁定位置（进度刷新不再换位）；已完成按完成时间，刚完成的在前
    const key = t => t.status === 'done' ? (t.updatedAt || t.createdAt || 0) : (t.createdAt || t.updatedAt || 0)
    return key(b) - key(a)
  })
})

// ---- 分页：后端分页（页码/条数由 store 管理，翻页时 store 发请求） ----



watch(() => transfer.tasks.length, () => { // 列表清空（删完/清空已完成）时回退第一页
  if (!transfer.tasks.length && transfer.page > 1) transfer.page = 1

})
</script>

<style scoped>
/* ===== 页头 ===== */
.transfer-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
.transfer-subtitle { font-size: 13px; color: var(--cs-text-secondary); margin: 6px 0 0 28px; }

/* ===== 任务面板（整体一个卡片）===== */
.task-panel { overflow: hidden; }

/* 空状态 */
.panel-empty { padding: 48px 24px 40px; text-align: center; }
.empty-tip { font-size: 13px; color: var(--cs-text-tertiary); margin: 4px 0 20px; }

/* ===== 分页 ===== */
.task-pagination { margin-top: 14px; justify-content: flex-end; }

/* ===== 任务行 ===== */
.task-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 20px;
  transition: background 0.2s ease;
  animation: rowIn 0.3s ease;
}
.task-row + .task-row { border-top: 1px solid var(--cs-border-light); }
.task-row:hover { background: var(--cs-bg-hover); }
@keyframes rowIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

.task-row__icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
}

.task-row__main { flex: 1; min-width: 0; }
.task-row__title { display: flex; align-items: center; gap: 10px; }
.task-row__name {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--cs-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.task-row__size { flex-shrink: 0; font-size: 12px; color: var(--cs-text-tertiary); }

/* ===== 进度条 ===== */
.task-row__progress { display: flex; align-items: center; gap: 10px; margin-top: 7px; }
.progress-track { display: block; flex: 1; height: 5px; background: var(--cs-bg-hover); border-radius: 100px; overflow: hidden; }
.progress-fill {
  display: block;
  height: 100%;
  border-radius: 100px;
  background: linear-gradient(90deg, var(--cs-primary), var(--cs-primary-light));
  background-size: 200% 100%;
  animation: flow 1.4s linear infinite;
  transition: width 0.25s ease;
}
.progress-fill.is-paused { background: var(--cs-warning); background-size: 100% 100%; animation: none; }
@keyframes flow { from { background-position: 0% 0; } to { background-position: -200% 0; } }
.progress-pct { flex-shrink: 0; font-size: 12px; font-weight: 600; color: var(--cs-primary); min-width: 34px; text-align: right; font-variant-numeric: tabular-nums; }
.progress-pct.is-paused { color: var(--cs-warning); }
.progress-hint { flex-shrink: 0; font-size: 12px; color: var(--cs-warning); }

/* ===== 状态文字 ===== */
.task-row__status { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 500; margin-top: 7px; }
.task-row__status.is-waiting { color: var(--cs-text-tertiary); }
.task-row__status.is-done { color: var(--cs-success); }
.task-row__status.is-aborted { color: var(--cs-text-tertiary); }

/* ===== 操作按钮 ===== */
.task-row__ops { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.op-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--cs-text-tertiary);
  cursor: pointer;
  font-size: 15px;
  transition: all 0.2s ease;
}
.op-btn:hover { background: var(--cs-bg-hover); color: var(--cs-text-primary); transform: translateY(-1px); }
.op-btn.is-primary { color: var(--cs-primary); }
.op-btn.is-primary:hover { background: var(--cs-primary-lighter); color: var(--cs-primary); }
/* 放弃/移除 hover 变红 */
.task-row__ops .op-btn:not(.is-primary):hover { color: var(--cs-danger); background: rgba(255, 77, 79, 0.08); }

/* ===== 响应式 ===== */
@media (max-width: 768px) {
  .transfer-subtitle { margin-left: 0; }
  .task-row { flex-wrap: wrap; padding: 12px 14px; gap: 10px; }
  .task-row__main { flex: 1 1 calc(100% - 54px); }
  .task-row__ops { width: 100%; justify-content: flex-end; }
}

/* ---------- 任务列表 + 右侧详情 ---------- */
.tr-ws { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 12px; align-items: start; }
.tr-side { position: sticky; top: 8px; min-height: 240px; display: flex; flex-direction: column; overflow: hidden; }
.tr-head { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid var(--cs-border-light); }
.tr-kicker { font-size: 9.5px; letter-spacing: 0.14em; color: var(--cs-text-tertiary); }
.tr-close { width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: 2px; background: none; color: var(--cs-text-tertiary); cursor: pointer; }
.tr-close:hover { background: var(--cs-bg-hover); color: var(--cs-text-primary); }
.tr-body { padding: 14px; }
.tr-name { font-size: 13px; font-weight: 600; color: var(--cs-text-primary); word-break: break-all; }
.tr-meta { margin: 12px 0 0; padding: 0; border-top: 1px solid var(--cs-border-light); }
.tr-meta > div { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--cs-border-light); }
.tr-meta dt { font-size: 11px; color: var(--cs-text-tertiary); }
.tr-meta dd { margin: 0; font-size: 11.5px; color: var(--cs-text-primary); text-align: right; }
.tr-tip { margin: 14px 0 0; font-size: 11px; line-height: 1.7; color: var(--cs-text-tertiary); }
.tr-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 32px 16px; font-size: 11.5px; color: var(--cs-text-tertiary); }
:deep(.task-row.is-on) { background: var(--cs-primary-lighter); }

@media (max-width: 1100px) {
  .tr-ws { grid-template-columns: minmax(0, 1fr); }
  .tr-side { position: static; }
}
</style>
