<template>
  <div class="cs-page">
    <div class="breadcrumb-bar">
      <div class="page-head-left">
        <h2 class="page-title"><el-icon><Coin /></el-icon>企业资源</h2>
        <span class="page-sub">企业购买的空间集中管理，按成员分配</span>
      </div>
      <el-button link :loading="loading" @click="refreshAll">
        <el-icon><Refresh /></el-icon>刷新
      </el-button>
    </div>

    <!-- 超卖警示 -->
    <el-alert
      v-if="pool.overAllocated"
      type="warning"
      :closable="false"
      show-icon
      class="over-alert"
      title="企业池已超卖"
      :description="`本月套餐已到期，当前池 ${formatSize(pool.totalBytes)}，已分配 ${formatSize(pool.allocatedBytes)}，请缩减差额或尽快续费；超卖期间只能下调分配。`"
    />

    <!-- 池概览 -->
    <div class="pool-row" v-loading="loading">
      <div class="pool-card">
        <span class="pool-label">池总量</span>
        <span class="pool-value">{{ formatSize(pool.totalBytes) }}</span>
      </div>
      <div class="pool-card">
        <span class="pool-label">已分配</span>
        <span class="pool-value">{{ formatSize(pool.allocatedBytes) }}</span>
      </div>
      <div class="pool-card">
        <span class="pool-label">可再分配</span>
        <span class="pool-value accent">{{ formatSize(pool.availableBytes) }}</span>
      </div>
      <div class="pool-card">
        <span class="pool-label">企业已用</span>
        <span class="pool-value">{{ formatSize(pool.usedBytes) }}</span>
      </div>
      <div class="pool-card">
        <span class="pool-label">最近到期</span>
        <span class="pool-value small">{{ pool.nextExpireAt ? formatDate(pool.nextExpireAt) : '--' }}</span>
      </div>
    </div>

    <!-- 成员分配 -->
    <div class="cs-card table-card">
      <div class="panel-head">
        <span>成员分配</span>
        <span class="panel-count">{{ allocations.length }} 位成员</span>
      </div>
      <el-table :data="allocations" v-loading="loading" style="width: 100%" row-key="localUserId">
        <el-table-column label="成员" min-width="200">
          <template #default="{ row }">
            <div class="who-text">
              <span class="who-name">{{ row.displayName || ('用户 #' + row.localUserId) }}</span>
              <span class="who-sub">
                <el-tag v-if="row.enterpriseRole === 1" size="small" effect="plain" type="warning">企业管理员</el-tag>
                <span v-else class="muted">普通成员</span>
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="已分配" width="140" align="right">
          <template #default="{ row }">
            <span :class="{ muted: !row.allocatedBytes }">{{ row.allocatedBytes ? formatSize(row.allocatedBytes) : '未分配' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="已使用" width="140" align="right">
          <template #default="{ row }">{{ formatSize(row.usedBytes || 0) }}</template>
        </el-table-column>
        <el-table-column label="占用比" min-width="180">
          <template #default="{ row }">
            <el-progress
              v-if="row.allocatedBytes > 0"
              :percentage="Math.min(100, Math.round((row.usedBytes || 0) / row.allocatedBytes * 100))"
              :stroke-width="6"
              :show-text="false"
              :color="usageColor(row)"
            />
            <span v-else class="muted">--</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" align="right">
          <template #default="{ row }">
            <el-button v-perm="'org.member.manage'" link type="primary" size="small" @click="openAllocate(row)">
              调整额度
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="table-foot">
        <span class="muted">未激活（从未登录）的成员不会出现在这里，需要对方先登录一次。</span>
      </div>
    </div>

    <!-- 调整额度 -->
    <el-dialog v-model="dialog" :title="`调整额度 · ${current?.displayName || ''}`" width="440px" align-center destroy-on-close>
      <div class="alloc-body">
        <div class="alloc-row">
          <span class="alloc-label">当前分配</span>
          <span>{{ formatSize(current?.allocatedBytes || 0) }}</span>
        </div>
        <div class="alloc-row">
          <span class="alloc-label">已使用</span>
          <span>{{ formatSize(current?.usedBytes || 0) }}</span>
        </div>
        <div class="alloc-row">
          <span class="alloc-label">可再分配</span>
          <span>{{ formatSize(pool.availableBytes) }}</span>
        </div>
        <el-form label-width="80px" label-position="left" class="alloc-form">
          <el-form-item label="目标额度">
            <el-input-number v-model="gb" :min="0" :max="maxGb" :step="1" :precision="2" controls-position="right" style="width: 100%" />
            <span class="unit">GB</span>
          </el-form-item>
        </el-form>
        <div class="alloc-hint muted">
          直接填写最终额度（不是增量）；填 0 表示收回该成员的企业额度。
          <template v-if="maxGb <= 0">当前池已无剩余，无法上调。</template>
        </div>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button :disabled="!current?.allocatedBytes" @click="revoke">收回额度</el-button>
          <el-button @click="dialog = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="save">保存</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Coin, Refresh } from '@element-plus/icons-vue'
import { enterpriseApi } from '@/api'
import { formatSize, formatDate } from '@/utils/file'

const GB = 1024 ** 3

const loading = ref(false)
const saving = ref(false)
const pool = ref({ totalBytes: 0, allocatedBytes: 0, usedBytes: 0, availableBytes: 0, overAllocated: false, nextExpireAt: null })
const allocations = ref([])
const dialog = ref(false)
const current = ref(null)
const gb = ref(0)

// 本成员最终可达到的上限 = 已有分配 + 池剩余（避免前端先查再加算错）
const maxGb = computed(() => {
  const cap = Number(current.value?.allocatedBytes || 0) + Number(pool.value.availableBytes || 0)
  return Math.floor(cap / GB)
})

function usageColor(row) {
  const pct = row.allocatedBytes > 0 ? (row.usedBytes || 0) / row.allocatedBytes * 100 : 0
  if (pct > 90) return '#c94a3b'
  if (pct > 70) return '#d99a4e'
  return '#2f6fb5'
}

async function loadPool() {
  try {
    pool.value = await enterpriseApi.pool()
  } catch (e) {
    // 个人域账号 / 网络异常：拦截器已提示，保持默认值
  }
}

async function loadAllocations() {
  try {
    const res = await enterpriseApi.allocations()
    allocations.value = res?.list || []
  } catch (e) {
    allocations.value = []
  }
}

async function refreshAll() {
  loading.value = true
  try {
    await Promise.all([loadPool(), loadAllocations()])
  } finally {
    loading.value = false
  }
}

function openAllocate(row) {
  current.value = row
  gb.value = Math.round((row.allocatedBytes || 0) / GB)
  dialog.value = true
}

async function submit(bytes) {
  saving.value = true
  try {
    const res = await enterpriseApi.setAllocation(current.value.localUserId, bytes)
    // 后端直接返回变更后的池状态，不用再拉一次
    if (res?.pool) pool.value = res.pool
    ElMessage.success(bytes === 0 ? '已收回该成员的企业额度' : `已分配 ${formatSize(bytes)}`)
    dialog.value = false
    await loadAllocations()
  } catch (e) {
    // 40000（超额/超卖/不属于本企业）由拦截器原样提示
  } finally {
    saving.value = false
  }
}

// 前置校验：① 不能超过「已分配 + 池剩余」 ② 低于已用需二次确认（不删文件，但会禁止继续上传）
async function confirmAllocation(bytes) {
  const used = Number(current.value?.usedBytes || 0)
  const cap = Number(current.value?.allocatedBytes || 0) + Number(pool.value.availableBytes || 0)
  if (bytes > cap) {
    ElMessage.warning(`超出企业池剩余：本次最多可设 ${formatSize(cap)}`)
    return false
  }
  if (bytes < used) {
    const ok = await ElMessageBox.confirm(
      `该成员已使用 ${formatSize(used)}，调到 ${formatSize(bytes)} 后其已用会超出额度：不会删除文件，但会禁止继续上传。确定继续？`,
      '额度低于已使用量',
      { type: 'warning', confirmButtonText: '继续', cancelButtonText: '取消' }
    ).catch(() => false)
    return !!ok
  }
  return true
}

async function save() {
  const bytes = Math.round(Number(gb.value || 0) * GB)
  if (!(await confirmAllocation(bytes))) return
  submit(bytes)
}

async function revoke() {
  if (!(await confirmAllocation(0))) return
  submit(0)
}

onMounted(refreshAll)
</script>

<style scoped>
.breadcrumb-bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 14px; }
.page-head-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.page-title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 17px; font-weight: 600; letter-spacing: .2px; color: var(--cs-text-primary); }
.page-sub { font-size: 12px; color: var(--cs-text-tertiary); }

.over-alert { margin-bottom: 14px; }

.pool-row { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
.pool-card { display: flex; flex-direction: column; gap: 6px; padding: 14px 16px; border-radius: var(--cs-radius-lg);
  background: var(--cs-bg-container); box-shadow: var(--cs-shadow-sm); }
.pool-label { font-size: 12px; color: var(--cs-text-tertiary); }
.pool-value { font-size: 19px; font-weight: 700; color: var(--cs-text-primary); font-variant-numeric: tabular-nums; }
.pool-value.small { font-size: 14px; font-weight: 500; }
.pool-value.accent { color: var(--cs-primary); }

.table-card { padding: 0; overflow: hidden; border-radius: var(--cs-radius-lg); box-shadow: var(--cs-shadow-sm); }
.panel-head { display: flex; align-items: center; gap: 8px; padding: 13px 16px; border-bottom: 1px solid var(--cs-border-light);
  font-size: 13px; font-weight: 600; color: var(--cs-text-primary); }
.panel-count { margin-left: auto; font-size: 11.5px; font-weight: 400; color: var(--cs-text-tertiary); }
.table-foot { padding: 10px 16px; border-top: 1px solid var(--cs-border-light); font-size: 11.5px; }

.who-text { display: flex; flex-direction: column; gap: 3px; }
.who-name { font-size: 13px; font-weight: 600; color: var(--cs-text-primary); }
.who-sub { font-size: 11.5px; }
.muted { color: var(--cs-text-tertiary); }

.alloc-body { display: flex; flex-direction: column; gap: 8px; }
.alloc-row { display: flex; justify-content: space-between; font-size: 13px; color: var(--cs-text-primary); }
.alloc-label { color: var(--cs-text-tertiary); }
.alloc-form { margin-top: 8px; position: relative; }
.alloc-form .unit { position: absolute; right: 42px; top: 50%; transform: translateY(-50%);
  font-size: 12px; color: var(--cs-text-tertiary); pointer-events: none; }
.alloc-hint { font-size: 11.5px; line-height: 1.6; margin-top: 4px; }
.dialog-footer { display: flex; justify-content: flex-end; gap: 8px; }

@media (max-width: 1180px) {
  .pool-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
