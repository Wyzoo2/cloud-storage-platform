<template>
  <el-dialog
    :model-value="visible"
    :title="dialogTitle"
    width="min(460px, 92vw)"
    :close-on-click-modal="false"
    :close-on-press-escape="!info?.forceUpdate"
    :show-close="canClose"
    destroy-on-close
    @close="handleClose"
  >
    <!-- 更新说明 -->
    <div v-if="phase === 'notice'" class="update-body">
      <div class="version-line">
        <el-icon class="version-icon"><RefreshRight /></el-icon>
        <span>发现新版本 <b>v{{ info.versionName }}</b></span>
      </div>
      <div v-if="info.forceUpdate" class="force-tip">
        <el-tag type="danger" size="small" effect="dark">必须更新后才能继续使用</el-tag>
      </div>
      <div class="notes-title">更新内容：</div>
      <div class="notes-box">{{ info.updateNotes || '修复已知问题，优化使用体验' }}</div>
    </div>

    <!-- 下载进度 -->
    <div v-else-if="phase === 'downloading'" class="update-body">
      <div class="download-tip">正在下载更新包，请耐心等待…</div>
      <el-progress :percentage="progress" :stroke-width="14" striped striped-flow />
      <div class="download-sub">
        <el-icon class="is-loading"><Loading /></el-icon>
        请勿关闭程序，下载完成后将自动安装
      </div>
    </div>

    <!-- 安装中 -->
    <div v-else class="update-body">
      <div class="install-tip">
        <el-icon class="is-loading" :size="22"><Loading /></el-icon>
        <span>即将开始安装，程序将自动重启</span>
      </div>
    </div>

    <template #footer>
      <template v-if="phase === 'notice'">
        <el-button v-if="!info.forceUpdate" @click="handleClose">稍后再说</el-button>
        <el-button type="primary" @click="startDownload">立即更新</el-button>
      </template>
      <span v-else class="footer-muted">请勿退出程序</span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  visible: { type: Boolean, default: false },
  // { hasUpdate, forceUpdate, versionCode, versionName, updateNotes, downloadUrl, fileHash, fileSize }
  info: { type: Object, default: () => ({}) }
})
const emit = defineEmits(['close'])

// notice 提示更新 / downloading 下载中 / installing 安装中
const phase = ref('notice')
const progress = ref(0)
let offProgress = null

const dialogTitle = computed(() => {
  if (phase.value === 'downloading') return '下载更新'
  if (phase.value === 'installing') return '安装更新'
  return '软件更新'
})

const canClose = computed(() => phase.value === 'notice' && !props.info?.forceUpdate)

async function startDownload() {
  if (!window.desktop?.downloadAndInstall) {
    ElMessage.error('当前环境不支持自动更新')
    return
  }
  phase.value = 'downloading'
  progress.value = 0

  // 监听主进程下载进度
  if (window.desktop.onUpdateProgress) {
    offProgress = window.desktop.onUpdateProgress(p => { progress.value = p })
  }

  try {
    // 成功后主进程会退出；这里切到安装中作为过渡
    await window.desktop.downloadAndInstall({
      downloadUrl: props.info.apkUrl,
      fileHash: props.info.fileHash
    })
    phase.value = 'installing'
  } catch (e) {
    ElMessage.error(e?.message || '更新失败，请稍后重试')
    phase.value = 'notice'
    progress.value = 0
  }
}

function handleClose() {
  if (!canClose.value) return
  emit('close')
}

onBeforeUnmount(() => {
  if (offProgress) offProgress()
})
</script>

<style scoped>
.update-body { padding: 4px 2px; }

.version-line {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
}
.version-icon { color: var(--el-color-primary); font-size: 18px; }

.force-tip { margin: 12px 0 4px; }

.notes-title {
  margin-top: 14px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.notes-box {
  margin-top: 6px;
  padding: 10px 12px;
  max-height: 160px;
  overflow-y: auto;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  background: var(--el-fill-color-light);
  border-radius: 8px;
}

.download-tip {
  margin-bottom: 18px;
  font-size: 14px;
}
.download-sub {
  margin-top: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.install-tip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 20px 0;
  font-size: 14px;
}

.footer-muted {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
