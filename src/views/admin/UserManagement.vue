<template>
  <div class="cs-page">
    <div class="breadcrumb-bar">
      <div class="page-head-left"><h2 class="page-title"><el-icon><UserFilled /></el-icon>用户管理</h2>
      </div>
    </div>

    <!-- 平台概览（GET /admin/stats/overview） -->
    <div class="stat-row">
      <div class="stat-card">
        <span class="stat-label">账号总数</span>
        <span class="stat-value">{{ overview.userCount ?? '--' }}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">总配额</span>
        <span class="stat-value">{{ formatSize(overview.totalQuotaBytes || 0) }}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">已用空间</span>
        <span class="stat-value">{{ formatSize(overview.usedBytes || 0) }}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">剩余空间</span>
        <span class="stat-value">{{ formatSize(overview.remainingBytes || 0) }}</span>
      </div>
    </div>

    <div class="toolbar">
      <div class="toolbar-left">
        <el-input
          v-model="keyword"
          placeholder="搜索用户名"
          :prefix-icon="Search"
          clearable
          style="width: 220px"
        />
        <el-select v-model="statusFilter" placeholder="全部状态" clearable style="width: 140px">
          <el-option label="正常" value="active" />
          <el-option label="禁用" value="disabled" />
        </el-select>
      </div>
      <div class="toolbar-right"><el-tag type="info">共 {{ total }} 个账号</el-tag></div>
    </div>

    <div v-if="!loading && !rows.length" class="cs-card empty-card">
      <el-empty :description="keyword || statusFilter ? '没有匹配的账号' : '暂无账号'" :image-size="90">
        <el-button v-if="keyword || statusFilter" @click="resetFilters">清空筛选</el-button>
      </el-empty>
    </div>

    <div v-else class="cs-card table-card">
      <el-table :data="rows" v-loading="loading" style="width: 100%" row-key="id">
        <el-table-column label="用户" min-width="220">
          <template #default="{ row }">
            <div class="who-text">
              <span class="who-line">
                <span class="who-name">{{ displayName(row) }}</span>
                <el-tag v-if="row.mustChangePassword" size="small" type="warning" effect="plain">初始密码</el-tag>
              </span>
              <span v-if="accountOf(row)" class="who-account">{{ accountOf(row) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="角色" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row.role === 'admin' ? 'danger' : 'info'" effect="plain">
              {{ row.role === 'admin' ? '管理员' : '普通用户' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="归属" width="110">
          <template #default="{ row }">
            <span class="muted">{{ enterpriseOf(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="isDisabled(row) ? 'danger' : 'success'">
              {{ isDisabled(row) ? '禁用' : '正常' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="配额使用" min-width="230">
          <template #default="{ row }">
            <div class="quota-cell">
              <el-progress
                :percentage="Math.min(100, quotaPercent(row))"
                :stroke-width="6"
                :show-text="false"
                :color="quotaColor(row)"
              />
              <span class="quota-text">
                {{ formatSize(row.usedBytes) }} / {{ formatSize(row.quotaBytes) }}
                <span class="quota-pct" :class="{ over: quotaPercent(row) > 90 }">{{ quotaPercent(row) }}%</span>
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="最近登录" width="170">
          <template #default="{ row }">{{ row.lastLoginAt ? formatDate(row.lastLoginAt) : '--' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right" align="right">
          <template #default="{ row }">
            <div class="op-actions">
              <el-button v-perm="'admin.user.quota'" link type="primary" size="small" @click="openQuota(row)">分配额度</el-button>
              <el-button
                v-perm="'admin.user.manage'"
                link
                :type="isDisabled(row) ? 'success' : 'danger'"
                size="small"
                @click="toggleStatus(row)"
              >{{ isDisabled(row) ? '恢复' : '禁用' }}</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="pagination-bar">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="size"
        :page-sizes="[20, 50, 100]"
        :total="total"
        layout="total, sizes, prev, pager, next"
        background
        @current-change="load"
        @size-change="handleSizeChange"
      />
    </div>

    <!-- 分配额度：仅一个额度输入框 -->
    <el-dialog v-model="quotaDialog" :title="`分配额度 · ${quotaForm.nickname || quotaForm.username}`" width="400px" align-center destroy-on-close>
      <div class="quota-now">
        <span>当前额度 <b>{{ formatSize(quotaForm.originalBytes) }}</b></span>
        <span>已用 <b>{{ formatSize(quotaForm.usedBytes) }}</b></span>
      </div>
      <el-form label-width="56px" label-position="left">
        <el-form-item label="额度">
          <el-input-number v-model="quotaForm.quotaGb" :min="1" :max="102400" :step="10" controls-position="right" style="width: 100%" />
        </el-form-item>
      </el-form>
      <div class="quota-hint">单位 GB，新额度不得小于已用空间</div>
      <template #footer>
        <el-button @click="quotaDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveQuota">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { adminApi } from '@/api'
import { formatSize, formatDate } from '@/utils/file'
import { displayName, accountOf } from '@/utils/user'

const rows = ref([])
const total = ref(0)
const page = ref(1)
const size = ref(20)
const keyword = ref('')
const statusFilter = ref('')
const loading = ref(false)
const overview = ref({})

const GB = 1024 * 1024 * 1024

async function load() {
  loading.value = true
  try {
    const res = await adminApi.listUsers({
      keyword: keyword.value.trim() || undefined,
      status: statusFilter.value || undefined,
      page: page.value,
      size: size.value
    })
    rows.value = res?.content || res?.list || []
    total.value = res?.totalElements ?? res?.total ?? 0
  } catch (e) {
    rows.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

async function loadOverview() {
  try {
    overview.value = await adminApi.statsOverview()
  } catch (e) {
    overview.value = {}
  }
}

function handleSizeChange() {
  page.value = 1
  load()
}

function resetFilters() {
  keyword.value = ''
  statusFilter.value = ''
  page.value = 1
  load()
}

let timer = null
watch(keyword, () => {
  clearTimeout(timer)
  timer = setTimeout(() => { page.value = 1; load() }, 300)
})
watch(statusFilter, () => { page.value = 1; load() })

const normStatus = s => String(s || '').toLowerCase()
const isDisabled = row => normStatus(row.status) === 'disabled' || row.disabled === true

function enterpriseOf(row) {
  const id = row.enterpriseId
  return id ? `企业 #${id}` : '平台'
}

function quotaPercent(row) {
  const totalBytes = Number(row.quotaBytes || 0) + Number(row.extraBytes || 0)
  if (!totalBytes) return 0
  return Math.round((Number(row.usedBytes || 0) / totalBytes) * 100)
}

function quotaColor(row) {
  const p = quotaPercent(row)
  if (p > 90) return '#c94a3b'
  if (p > 70) return '#d99a4e'
  return '#2f6fb5'
}

/* ---------------- 分配额度 ---------------- */
const quotaDialog = ref(false)
const saving = ref(false)
const quotaForm = ref({ id: null, username: '', nickname: '', quotaGb: 1, usedBytes: 0, originalBytes: 0 })

function openQuota(row) {
  const currentBytes = Number(row.quotaBytes || 0) + Number(row.extraBytes || 0)
  quotaForm.value = {
    id: row.id,
    username: row.username,
    nickname: row.nickname || '',
    quotaGb: Math.max(1, Math.round(currentBytes / GB)),
    usedBytes: Number(row.usedBytes || 0),
    originalBytes: currentBytes
  }
  quotaDialog.value = true
}

async function saveQuota() {
  const f = quotaForm.value
  const quotaBytes = Math.round(Number(f.quotaGb || 0) * GB)
  if (quotaBytes < f.usedBytes) return ElMessage.warning('新额度不能小于已用空间')
  if (!quotaBytes || quotaBytes === f.originalBytes) {
    quotaDialog.value = false
    return ElMessage.info('额度没有变化')
  }
  saving.value = true
  try {
    await adminApi.updateUser(f.id, { quotaBytes })
    ElMessage.success('额度已分配')
    quotaDialog.value = false
    load()
    loadOverview()
  } catch (e) {
    // 拦截器已提示
  } finally {
    saving.value = false
  }
}

/* ---------------- 禁用 / 恢复 ---------------- */
async function toggleStatus(row) {
  const next = isDisabled(row) ? 'active' : 'disabled'
  const ok = await ElMessageBox.confirm(
    `确定${next === 'disabled' ? '禁用' : '恢复'}账号「${row.nickname || row.username}」？${next === 'disabled' ? '禁用后该账号无法登录。' : ''}`,
    '确认操作',
    { type: 'warning', confirmButtonText: '确定', cancelButtonText: '取消' }
  ).catch(() => false)
  if (!ok) return
  try {
    await adminApi.updateUser(row.id, { status: next })
    ElMessage.success(next === 'disabled' ? '已禁用' : '已恢复')
    load()
  } catch (e) {
    // 拦截器已提示
  }
}

onMounted(() => {
  load()
  loadOverview()
})
</script>

<style scoped>
.breadcrumb-bar { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 14px; }
.page-head-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.page-title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 17px; font-weight: 600; letter-spacing: .2px; color: var(--cs-text-primary); }

/* 概览卡 */
.stat-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
.stat-card { display: flex; flex-direction: column; gap: 6px; padding: 14px 16px; border-radius: var(--cs-radius-lg);
  background: var(--cs-bg-container); box-shadow: var(--cs-shadow-sm); }
.stat-label { font-size: 12px; color: var(--cs-text-tertiary); }
.stat-value { font-size: 19px; font-weight: 700; color: var(--cs-text-primary); font-variant-numeric: tabular-nums; }

.toolbar-left { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.table-card { overflow-x: auto; }
.empty-card { padding: 24px; }

.who-text { display: flex; flex-direction: column; line-height: 1.35; min-width: 0; }
.who-line { display: flex; align-items: center; gap: 6px; min-width: 0; }
.who-name { font-size: 13px; font-weight: 600; color: var(--cs-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.who-account { font-size: 11.5px; color: var(--cs-text-tertiary); font-family: Consolas, monospace; }
.muted { font-size: 12.5px; color: var(--cs-text-tertiary); }

.quota-cell { display: flex; flex-direction: column; gap: 5px; }
.quota-text { font-size: 12px; color: var(--cs-text-tertiary); display: flex; align-items: center; gap: 8px; }
.quota-pct { color: var(--cs-text-secondary); font-variant-numeric: tabular-nums; }
.quota-pct.over { color: var(--cs-danger); font-weight: 600; }

.op-actions { display: flex; align-items: center; gap: 4px; justify-content: flex-end; white-space: nowrap; }
.op-actions .el-button { margin-left: 0; }
.pagination-bar { display: flex; justify-content: flex-end; margin-top: 18px; }

.quota-now { display: flex; gap: 18px; font-size: 13px; color: var(--cs-text-secondary); margin-bottom: 14px; }
.quota-now b { color: var(--cs-text-primary); font-weight: 600; }
.quota-hint { font-size: 11.5px; color: var(--cs-text-tertiary); padding-left: 56px; margin-top: -10px; }

@media (max-width: 1024px) {
  .stat-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
