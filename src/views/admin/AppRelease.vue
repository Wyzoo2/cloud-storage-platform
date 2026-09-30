<template>
  <div class="cs-page">
    <div class="breadcrumb-bar">
      <h2 class="page-title"><el-icon><Upload /></el-icon>版本发布管理</h2>
      <el-button type="primary" @click="openCreateDialog"><el-icon><Plus /></el-icon>发布新版本</el-button>
    </div>
    <div class="toolbar">
      <div class="toolbar-left">
        <el-select v-model="platformFilter" @change="handleFilterChange" placeholder="全部平台" clearable style="width:150px">
          <el-option label="全部平台" value="" />
          <el-option label="Android" value="android" />
          <el-option label="Windows" value="windows" />
        </el-select>
        <el-select v-model="statusFilter" @change="handleFilterChange" placeholder="全部状态" clearable style="width:150px">
          <el-option label="全部状态" value="" />
          <el-option label="草稿" value="draft" />
          <el-option label="已发布" value="published" />
          <el-option label="已停用" value="disabled" />
        </el-select>
      </div>
      <div class="toolbar-right"><el-tag>共 {{ total }} 条记录</el-tag></div>
    </div>
    <div class="cs-card table-card">
      <el-table :data="list" v-loading="loading" style="width:100%;min-width:960px">
        <el-table-column prop="platform" label="平台" width="100">
          <template #default="{ row }">
            <el-tag :type="row.platform === 'android' ? 'success' : 'primary'" size="small" effect="plain">
              {{ row.platform === 'android' ? 'Android' : 'Windows' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="versionCode" label="版本号" width="90" />
        <el-table-column prop="versionName" label="版本名" width="100" />
        <el-table-column prop="fileSize" label="包体大小" width="110">
          <template #default="{ row }">{{ formatSize(row.fileSize) }}</template>
        </el-table-column>
        <el-table-column prop="rolloutPercent" label="灰度比例" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'published'" :type="row.rolloutPercent === 100 ? 'success' : 'warning'" size="small">
              {{ row.rolloutPercent }}%
            </el-tag>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="forceUpdate" label="强制" width="70" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.forceUpdate" type="danger" size="small" effect="dark">强制</el-tag>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="publishedAt" label="发布时间" min-width="160">
          <template #default="{ row }">{{ formatDateTime(row.publishedAt) }}</template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" min-width="160">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="340" fixed="right">
          <template #default="{ row }">
            <div class="op-actions">
              <template v-if="row.status === 'published'">
                <el-button link type="primary" size="small" @click="openRolloutDialog(row)"><el-icon><SetUp /></el-icon>调整灰度</el-button>
                <el-button link type="warning" size="small" @click="handleToggleForce(row)">
                  <el-icon><component :is="row.forceUpdate ? 'Unlock' : 'Lock'" /></el-icon>
                  {{ row.forceUpdate ? '取消强制' : '设为强制' }}
                </el-button>
                <el-button link type="danger" size="small" @click="handleDisable(row)"><el-icon><CircleClose /></el-icon>停用</el-button>
              </template>
              <template v-if="row.status === 'draft'">
                <el-button link type="success" size="small" @click="handlePublish(row)"><el-icon><CircleCheck /></el-icon>发布</el-button>
              </template>
              <template v-if="row.status === 'disabled'">
                <el-button link type="success" size="small" @click="handleEnable(row)"><el-icon><CircleCheck /></el-icon>启用</el-button>
              </template>
              <el-button v-if="row.status === 'draft'" link type="danger" size="small" @click="handleDelete(row)"><el-icon><Delete /></el-icon>删除</el-button>
              <el-button link type="info" size="small" @click="handleCopyLink(row)"><el-icon><CopyDocument /></el-icon>复制链接</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <div class="pagination-bar">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50]"
        :total="total"
        layout="total, sizes, prev, pager, next"
        background
        @current-change="fetchList"
        @size-change="fetchList"
      />
    </div>

    <!-- 发布新版本对话框 -->
    <el-dialog v-model="createDialog.visible" title="发布新版本" width="min(560px, 94vw)" :close-on-click-modal="false" destroy-on-close style="--el-dialog-margin-top:7vh">
      <el-form :model="createDialog.form" label-width="100px" label-position="right">
        <el-form-item label="平台" required>
          <el-radio-group v-model="createDialog.form.platform" @change="handlePlatformChange">
            <el-radio-button value="android">Android</el-radio-button>
            <el-radio-button value="windows">Windows</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="安装包" required>
          <el-upload
            ref="uploadRef"
            :auto-upload="false"
            :limit="1"
            :show-file-list="false"
            v-show="!createDialog.selectedFile"
            :on-change="handleFileChange"
            :on-remove="handleFileRemove"
            :accept="createDialog.form.platform === 'android' ? '.apk' : '.exe'"
            drag
            class="upload-area"
          >
            <el-icon class="el-icon--upload" :size="40"><Upload /></el-icon>
            <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
            <template #tip>
              <div class="el-upload__tip">
                {{ createDialog.form.platform === 'android' ? '仅支持 .apk 文件' : '仅支持 .exe 文件' }}，最大 200MB
              </div>
            </template>
          </el-upload>
          <!-- 已选择文件：显示文件卡片，隐藏上传区域 -->
          <div v-if="createDialog.selectedFile" class="file-selected">
            <el-icon class="file-icon"><Document /></el-icon>
            <div class="file-info">
              <div class="file-name">{{ createDialog.selectedFile.name }}</div>
              <div class="file-size">{{ formatSize(createDialog.selectedFile.size) }}</div>
            </div>
            <el-button link type="danger" size="small" @click="handleRemoveSelected"><el-icon><Delete /></el-icon>移除</el-button>
          </div>
          <div v-if="createDialog.uploadProgress > 0 && createDialog.uploadProgress < 100" class="upload-progress">
            <el-progress :percentage="createDialog.uploadProgress" :stroke-width="8" />
          </div>
        </el-form-item>
        <el-form-item label="版本名称" required>
          <el-input v-model="createDialog.form.versionName" placeholder="如 1.3.0" maxlength="32" />
        </el-form-item>
        <el-form-item label="版本号">
          <el-tag v-if="createDialog.form.platform === 'windows'" type="info">
            {{ createDialog.form.versionName.trim() ? `自动换算为 ${toVersionCode(createDialog.form.versionName.trim())}` : '由版本名称自动换算（如 1.0.1 → 10100）' }}
          </el-tag>
          <el-tag v-else type="info">发布后由系统自动生成</el-tag>
        </el-form-item>
        <el-form-item label="更新说明" required>
          <el-input
            v-model="createDialog.form.updateNotes"
            type="textarea"
            :rows="4"
            placeholder="请输入更新内容，每行一条"
            maxlength="1000"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="强制更新">
          <el-switch v-model="createDialog.form.forceUpdate" />
          <!-- <span class="form-tip">开启后低于此版本的用户将无法跳过更新</span> -->
        </el-form-item>
        <el-form-item label="灰度比例">
          <el-slider v-model="createDialog.form.rolloutPercent" :min="0" :max="100" :step="5" show-input :show-input-controls="false" />
          <div class="form-tip">建议先小流量灰度（5%），观察稳定后再逐步放量</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialog.visible = false">取消</el-button>
        <el-button type="default" :loading="createDialog.loading" @click="handleCreate(false)">保存草稿</el-button>
        <el-button type="primary" :loading="createDialog.loading" @click="handleCreate(true)">立即发布</el-button>
      </template>
    </el-dialog>

    <!-- 调整灰度对话框 -->
    <el-dialog v-model="rolloutDialog.visible" title="调整灰度比例" width="min(420px, 90vw)" :close-on-click-modal="false">
      <div class="rollout-info">
        <span>当前版本：{{ rolloutDialog.record?.versionName }}（v{{ rolloutDialog.record?.versionCode }}）</span>
        <span>当前灰度：<el-tag type="warning" size="small">{{ rolloutDialog.record?.rolloutPercent }}%</el-tag></span>
      </div>
      <div class="rollout-shortcuts">
        <el-button v-for="p in [5, 20, 50, 100]" :key="p" :type="rolloutDialog.percent === p ? 'primary' : 'default'" @click="rolloutDialog.percent = p">
          {{ p }}%
        </el-button>
      </div>
      <el-slider v-model="rolloutDialog.percent" :min="0" :max="100" :step="5" show-input :show-input-controls="false" />
      <div v-if="rolloutDialog.percent === 100" class="rollout-warning">
        <el-icon><WarningFilled /></el-icon>即将全量发布，请确认版本已充分测试
      </div>
      <template #footer>
        <el-button @click="rolloutDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="rolloutDialog.loading" @click="handleUpdateRollout">确认调整</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Upload, Plus, SetUp, CircleCheck, CircleClose, Delete, CopyDocument, Lock, Unlock, WarningFilled, Document } from '@element-plus/icons-vue'
import { appReleaseApi } from '@/api'

const loading = ref(false)
const list = ref([])
const platformFilter = ref('')
const statusFilter = ref('')
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)

const uploadRef = ref(null)

// 发布新版本对话框
const createDialog = ref({
  visible: false,
  loading: false,
  uploadProgress: 0,
  selectedFile: null,
  form: {
    platform: 'android',
    versionName: '',
    updateNotes: '',
    forceUpdate: false,
    rolloutPercent: 5
  }
})

// 调整灰度对话框
const rolloutDialog = ref({
  visible: false,
  loading: false,
  record: null,
  percent: 0
})

const statusTagType = (s) => ({ draft: 'info', published: 'success', disabled: 'danger' })[s] || 'info'
const statusLabel = (s) => ({ draft: '草稿', published: '已发布', disabled: '已停用' })[s] || s

const formatDateTime = (ts) => {
  if (!ts) return '-'
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const formatSize = (bytes) => {
  if (!bytes) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// semver → 整数版本号：major*10000 + minor*100 + patch（与桌面端客户端换算规则一致，1.0.1 → 10001）
const toVersionCode = (v) => {
  const [major = 0, minor = 0, patch = 0] = String(v || '').split('.').map(n => parseInt(n, 10) || 0)
  return major * 10000 + minor * 100 + patch
}

const fetchList = async () => {
  loading.value = true
  try {
    const params = { page: page.value, size: pageSize.value }
    if (platformFilter.value) params.platform = platformFilter.value
    if (statusFilter.value) params.status = statusFilter.value
    const res = await appReleaseApi.list(params)
    list.value = res.records || res.list || res.content || []
    total.value = res.total ?? res.totalElements ?? list.value.length
  } catch {
    ElMessage.error('加载发布列表失败')
  } finally {
    loading.value = false
  }
}

const handleFilterChange = () => {
  page.value = 1
  fetchList()
}

const openCreateDialog = () => {
  createDialog.value = {
    visible: true,
    loading: false,
    uploadProgress: 0,
    selectedFile: null,
    form: {
      platform: 'android',
      versionName: '',
      updateNotes: '',
      forceUpdate: false,
      rolloutPercent: 5
    }
  }
}

const handleFileChange = (file) => {
  const ext = file.name.split('.').pop().toLowerCase()
  const platform = createDialog.value.form.platform
  const acceptExt = platform === 'android' ? 'apk' : 'exe'
  if (ext !== acceptExt) {
    ElMessage.warning(`请选择 .${acceptExt} 格式的文件`)
    uploadRef.value?.clearFiles()
    return
  }
  if (file.size > 200 * 1024 * 1024) {
    ElMessage.warning('文件大小不能超过 200MB')
    uploadRef.value?.clearFiles()
    return
  }
  createDialog.value.selectedFile = file.raw
}

// 移除已选文件，恢复上传区域
const handleRemoveSelected = () => {
  createDialog.value.selectedFile = null
  createDialog.value.uploadProgress = 0
  uploadRef.value?.clearFiles()
}

// 切换平台时清空不匹配的已选文件（apk/exe 类型不同）
const handlePlatformChange = (platform) => {
  const file = createDialog.value.selectedFile
  if (!file) return
  const acceptExt = platform === 'android' ? 'apk' : 'exe'
  const ext = file.name.split('.').pop().toLowerCase()
  if (ext !== acceptExt) {
    handleRemoveSelected()
    ElMessage.warning('已切换平台，请重新选择对应类型的安装包')
  }
}

const handleFileRemove = () => {
  createDialog.value.selectedFile = null
  createDialog.value.uploadProgress = 0
}

const handleCreate = async (publishNow) => {
  const { form, selectedFile } = createDialog.value
  if (!selectedFile) return ElMessage.warning('请选择安装包')
  if (!form.versionName.trim()) return ElMessage.warning('请输入版本名称')
  if (!form.updateNotes.trim()) return ElMessage.warning('请输入更新说明')
  // Windows：版本名必须是三段式且每段 ≤99，换算 versionCode 才不会进位冲突
  if (form.platform === 'windows' && !/^(\d{1,2})\.(\d{1,2})\.(\d{1,2})$/.test(form.versionName.trim())) {
    return ElMessage.warning('Windows 版本名称需为三段式且每段不超过 99（如 1.0.1）')
  }

  createDialog.value.loading = true
  createDialog.value.uploadProgress = 0

  const formData = new FormData()
  formData.append('file', selectedFile)
  formData.append('platform', form.platform)
  // Windows：versionCode 由前端从 versionName 换算后显式传入（1.0.1 → 10001），后端不自增
  if (form.platform === 'windows') {
    formData.append('versionCode', toVersionCode(form.versionName.trim()))
  }
  formData.append('versionName', form.versionName.trim())
  formData.append('updateNotes', form.updateNotes.trim())
  formData.append('forceUpdate', form.forceUpdate)
  formData.append('rolloutPercent', form.rolloutPercent)
  formData.append('publishNow', publishNow)

  try {
    const res = await appReleaseApi.create(formData, (pct) => {
      createDialog.value.uploadProgress = pct
    })
    ElMessage.success(publishNow ? '发布成功' : '已保存为草稿')
    createDialog.value.visible = false
    fetchList()
  } catch (err) {
    ElMessage.error(err?.response?.data?.message || '发布失败')
  } finally {
    createDialog.value.loading = false
  }
}

const openRolloutDialog = (row) => {
  rolloutDialog.value = {
    visible: true,
    loading: false,
    record: row,
    percent: row.rolloutPercent
  }
}

const handleUpdateRollout = async () => {
  rolloutDialog.value.loading = true
  try {
    await appReleaseApi.update(rolloutDialog.value.record.id, {
      rolloutPercent: rolloutDialog.value.percent
    })
    ElMessage.success('灰度比例已调整')
    rolloutDialog.value.visible = false
    fetchList()
  } catch (err) {
    ElMessage.error(err?.response?.data?.message || '调整失败')
  } finally {
    rolloutDialog.value.loading = false
  }
}

const handleToggleForce = async (row) => {
  try {
    await appReleaseApi.update(row.id, { forceUpdate: !row.forceUpdate })
    ElMessage.success(row.forceUpdate ? '已取消强制更新' : '已设为强制更新')
    fetchList()
  } catch (err) {
    ElMessage.error(err?.response?.data?.message || '操作失败')
  }
}

const handleDisable = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确认停用版本 ${row.versionName}（v${row.versionCode}）？\n停用后所有用户将不再收到此版本更新推送。`,
      '停用确认',
      { type: 'warning', confirmButtonText: '确认停用', cancelButtonText: '取消' }
    )
    await appReleaseApi.disable(row.id)
    ElMessage.success('已停用')
    fetchList()
  } catch (err) {
    if (err !== 'cancel') ElMessage.error(err?.response?.data?.message || '停用失败')
  }
}

const handlePublish = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确认发布版本 ${row.versionName}（v${row.versionCode}）？`,
      '发布确认',
      { type: 'info', confirmButtonText: '确认发布', cancelButtonText: '取消' }
    )
    await appReleaseApi.publish(row.id)
    ElMessage.success('已发布')
    fetchList()
  } catch (err) {
    if (err !== 'cancel') ElMessage.error(err?.response?.data?.message || '发布失败')
  }
}

// 启用已停用的版本（复用发布接口：disabled → published）
const handleEnable = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确认启用版本 ${row.versionName}（v${row.versionCode}）？启用后将恢复向客户端推送此版本。`,
      '启用确认',
      { type: 'info', confirmButtonText: '确认启用', cancelButtonText: '取消' }
    )
    await appReleaseApi.publish(row.id)
    ElMessage.success('已启用')
    fetchList()
  } catch (err) {
    if (err !== 'cancel') ElMessage.error(err?.response?.data?.message || '启用失败')
  }
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确认删除草稿 ${row.versionName}？此操作不可恢复。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' }
    )
    await appReleaseApi.remove(row.id)
    ElMessage.success('已删除')
    fetchList()
  } catch (err) {
    if (err !== 'cancel') ElMessage.error(err?.response?.data?.message || '删除失败')
  }
}

const handleCopyLink = (row) => {
  if (!row.apkUrl) {
    ElMessage.warning('下载链接尚未生成')
    return
  }
  navigator.clipboard.writeText(row.apkUrl).then(() => {
    ElMessage.success('下载链接已复制到剪贴板')
  }).catch(() => {
    ElMessage.error('复制失败，请手动复制')
  })
}

onMounted(fetchList)
</script>

<style scoped>
.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.toolbar-right {
  flex-shrink: 0;
}
.table-card {
  overflow-x: auto;
}
.text-muted {
  color: var(--el-text-color-placeholder);
}
.op-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.file-selected {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  background: var(--el-fill-color-light);
}
.file-selected .file-icon {
  font-size: 28px;
  color: var(--el-color-primary);
  flex-shrink: 0;
}
.file-selected .file-info {
  flex: 1;
  min-width: 0;
}
.file-selected .file-name {
  font-size: 13px;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-selected .file-size {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}
.upload-area {
  width: 100%;
}
.upload-area :deep(.el-upload-dragger) {
  width: 100%;
}
.upload-progress {
  margin-top: 12px;
}
.form-tip {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.rollout-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
}
.rollout-shortcuts {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.rollout-warning {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  padding: 10px;
  background: var(--el-color-warning-light-9);
  border-radius: 6px;
  color: var(--el-color-warning);
  font-size: 13px;
}
@media (max-width: 768px) {
  .breadcrumb-bar {
    flex-wrap: wrap;
    gap: 12px;
  }
  .toolbar {
    gap: 10px;
  }
  .toolbar-left {
    flex: 1 1 100%;
  }
}
</style>
