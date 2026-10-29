<template>
  <div class="cs-page">
    <div class="breadcrumb-bar">
      <div class="page-head-left">
        <h2 class="page-title"><el-icon><OfficeBuilding /></el-icon>企业详情</h2>
      </div>
      <el-button link :loading="refreshing" @click="refreshAll">
        <el-icon><Refresh /></el-icon>刷新
      </el-button>
    </div>

    <!-- 企业信息 -->
    <div class="cs-card hero">
      <div class="hero-left">
        <div class="hero-title">
          <span class="hero-name">{{ ent.name || '--' }}</span>
          <el-tag v-if="ent.status" size="small" :type="statusType" effect="plain">{{ statusLabel }}</el-tag>
        </div>
        <div class="hero-meta">
          <span class="mono">{{ ent.code || '--' }}</span>
          <span v-if="ent.id" class="sep">·</span>
          <span v-if="ent.id">企业 ID {{ ent.id }}</span>
          <span class="sep">·</span>
          <span>{{ perm.identityLabel }}</span>
        </div>
      </div>
      <div class="hero-right">
        <div class="hero-item">
          <span class="hero-label">服务到期</span>
          <span class="hero-value">{{ ent.expireAt ? formatDate(ent.expireAt) : '未设置' }}</span>
        </div>
        <div class="hero-item">
          <span class="hero-label">当前账号</span>
          <span class="hero-value">{{ perm.nickname || userStore.username }}</span>
        </div>
      </div>
    </div>

    <!-- 指标 -->
    <div class="stat-row">
      <div class="stat-card">
        <span class="stat-label">成员数</span>
        <span class="stat-value">{{ metrics.members }}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">部门数</span>
        <span class="stat-value">{{ metrics.depts }}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">角色数</span>
        <span class="stat-value">{{ metrics.roles }}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">资源包</span>
        <span class="stat-value">{{ metrics.resourceCount }}<span class="unit"> 个 · {{ metrics.resourceGb }} GB</span></span>
      </div>
    </div>

    <div class="stack">

      <!-- 资源包 -->
        <div class="cs-card panel">
          <div class="panel-head">
            <span>资源包</span>
            <span class="panel-count">{{ resources.length }} 个 · 合计 {{ resStats.totalGb }} GB</span>
          </div>
          <div class="res-summary">
            <div class="res-sum-item">
              <span class="res-sum-label">已分配</span>
              <span class="res-sum-value">{{ resStats.assignedCount }} 个 · {{ resStats.assignedGb }} GB</span>
            </div>
            <div class="res-sum-item">
              <span class="res-sum-label">未分配</span>
              <span class="res-sum-value">{{ resStats.unassignedCount }} 个 · {{ resStats.unassignedGb }} GB</span>
            </div>
            <div class="res-sum-item">
              <span class="res-sum-label">可用总量</span>
              <span class="res-sum-value">{{ resStats.totalGb }} GB</span>
            </div>
          </div>
          <div class="panel-body" v-loading="resLoading">
            <el-table v-if="resources.length" :data="resources" size="small" style="width: 100%">
              <el-table-column label="规格" min-width="130">
                <template #default="{ row }">
                  <el-tag size="small" effect="plain">{{ row.skuId || '--' }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="容量" width="90" align="right">
                <template #default="{ row }">{{ row.quotaGb }} GB</template>
              </el-table-column>
              <el-table-column label="状态" width="90">
                <template #default="{ row }">
                  <el-tag size="small" :type="row.holderUserId ? 'success' : 'info'" effect="plain">
                    {{ row.holderUserId ? '已分配' : '未分配' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="持有人" width="130">
                <template #default="{ row }">
                  <span :class="{ muted: !row.holderName }">{{ row.holderName || (row.holderUserId ? 'ID ' + row.holderUserId : '未分配') }}</span>
                </template>
              </el-table-column>
              <el-table-column label="分配时间" width="160">
                <template #default="{ row }">{{ row.assignedAt ? formatDate(row.assignedAt) : '--' }}</template>
              </el-table-column>
            </el-table>
            <el-empty v-else description="暂无资源包" :image-size="70" />
          </div>
        </div>

      <!-- 最近操作 -->
      <div class="cs-card panel side-panel">
        <div class="panel-head">
          <span>最近操作</span>
          <span class="panel-count">近 {{ logs.length }} 条</span>
        </div>
        <div class="panel-body" v-loading="logLoading">
          <div v-if="logs.length" class="log-list">
            <div v-for="l in logs" :key="l.id" class="log-item">
            <span class="log-user">{{ l.username || ('ID ' + l.userId) }}</span>
                <el-tag size="small" :type="actionType(l.action)" effect="plain">{{ actionLabel(l.action) }}</el-tag>
                <span class="log-target">{{ l.target || '--' }}</span>
                <span class="log-time">{{ l.createdAt ? formatDate(l.createdAt) : '' }}</span>
              </div>
          </div>
          <el-empty v-else description="暂无操作记录" :image-size="70" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { usePermissionStore } from '@/stores/permission'
import { useUserStore } from '@/stores/user'
import { rbacSource } from '@/api/rbacSource'
import { auditApi } from '@/api'
import { formatDate } from '@/utils/file'

const perm = usePermissionStore()
const userStore = useUserStore()

const refreshing = ref(false)
const ent = computed(() => perm.ctx?.enterprise || {})

const STATUS = {
  active: { label: '正常服务', type: 'success' },
  pending: { label: '待审核', type: 'warning' },
  rejected: { label: '已驳回', type: 'info' },
  disabled: { label: '已停用', type: 'danger' }
}
const statusLabel = computed(() => STATUS[ent.value.status]?.label || ent.value.status || '--')
const statusType = computed(() => STATUS[ent.value.status]?.type || 'info')

/* ---------------- 指标 ---------------- */
const metrics = ref({ members: '--', depts: '--', roles: '--', resourceCount: 0, resourceGb: 0 })

async function loadMetrics() {
  const [members, depts, roles, resources] = await Promise.all([
    rbacSource.members({ page: 1, size: 1 }).catch(() => ({ total: '--' })),
    rbacSource.depts().catch(() => ({ total: '--' })),
    rbacSource.roles().catch(() => []),
    rbacSource.resources().catch(() => ({ total: 0, list: [] }))
  ])
  const gb = (resources.list || []).reduce((a, r) => a + Number(r.quotaGb || 0), 0)
  metrics.value = {
    members: members?.total ?? '--',
    depts: depts?.total ?? '--',
    roles: Array.isArray(roles) ? roles.length : '--',
    resourceCount: resources?.total ?? (resources.list || []).length,
    resourceGb: gb
  }
}

/* ---------------- 资源包 ---------------- */
const resources = ref([])
const resLoading = ref(false)
// userId → 展示名，仅用于资源包持有人（接口只给 holderUserId，没有名字）
const nameById = ref({})

async function loadResources() {
  resLoading.value = true
  try {
    const res = await rbacSource.resources()
    try {
      const users = await rbacSource.members({ page: 1, size: 100 })
      nameById.value = Object.fromEntries((users.list || []).map(u => [u.id, u.nickname || u.username]))
    } catch (e) { /* 忽略 */ }
    resources.value = (res.list || []).map(r => ({ ...r, holderName: nameById.value[r.holderUserId] || '' }))
  } catch (e) {
    resources.value = []
  } finally {
    resLoading.value = false
  }
}

const resStats = computed(() => {
  const list = resources.value
  const gb = r => Number(r.quotaGb || 0)
  const assigned = list.filter(r => r.holderUserId != null)
  const unassigned = list.filter(r => r.holderUserId == null)
  const sum = arr => arr.reduce((a, r) => a + gb(r), 0)
  return {
    totalGb: sum(list),
    assignedCount: assigned.length,
    assignedGb: sum(assigned),
    unassignedCount: unassigned.length,
    unassignedGb: sum(unassigned)
  }
})

/* ---------------- 最近操作 ---------------- */
const logs = ref([])
const logLoading = ref(false)

async function loadLogs() {
  logLoading.value = true
  try {
    const res = await auditApi.query({ page: 1, size: 8 })
    logs.value = res?.list || []
  } catch (e) {
    logs.value = []
  } finally {
    logLoading.value = false
  }
}

const ACTION = {
  login: '登录', logout: '登出', upload: '上传', download: '下载', delete: '删除', delete_force: '彻底删除',
  restore: '还原', mkdir: '新建文件夹', rename: '重命名', move: '移动', user_manage: '成员管理',
  billing_request: '增额申请', billing_approve: '审批通过', billing_reject: '审批驳回'
}
const actionLabel = a => ACTION[String(a || '').toLowerCase()] || a || '--'
function actionType(a) {
  const k = String(a || '').toLowerCase()
  if (['delete', 'delete_force', 'billing_reject'].includes(k)) return 'danger'
  if (['upload', 'mkdir', 'rename', 'move', 'restore'].includes(k)) return 'success'
  if (['user_manage', 'billing_approve', 'billing_request'].includes(k)) return 'warning'
  return 'info'
}

async function refreshAll() {
  refreshing.value = true
  try {
    await Promise.all([loadMetrics(), loadResources()])
    await loadLogs()
  } finally {
    refreshing.value = false
  }
}

onMounted(refreshAll)
</script>

<style scoped>
.breadcrumb-bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 14px; }
.page-head-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.page-title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 17px; font-weight: 600; letter-spacing: .2px; color: var(--cs-text-primary); }

/* 企业信息 */
.hero { display: flex; align-items: center; justify-content: space-between; gap: 28px; flex-wrap: wrap; padding: 18px 20px; margin-bottom: 14px; }
.hero-title { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.hero-name { font-size: 20px; font-weight: 700; letter-spacing: .3px; color: var(--cs-text-primary); }
.hero-meta { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--cs-text-tertiary); }
.mono { font-family: Consolas, monospace; }
.sep { color: var(--cs-text-disabled); }
.hero-right { display: flex; gap: 32px; }
.hero-item { display: flex; flex-direction: column; gap: 4px; }
.hero-label { font-size: 11.5px; color: var(--cs-text-tertiary); }
.hero-value { font-size: 13px; color: var(--cs-text-primary); font-weight: 500; }

/* 指标 */
.stat-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
.stat-card { display: flex; flex-direction: column; gap: 6px; padding: 14px 16px; border-radius: var(--cs-radius-lg);
  background: var(--cs-bg-container); box-shadow: var(--cs-shadow-sm); }
.stat-label { font-size: 12px; color: var(--cs-text-tertiary); }
.stat-value { font-size: 20px; font-weight: 700; color: var(--cs-text-primary); font-variant-numeric: tabular-nums; }
.unit { font-size: 12px; font-weight: 400; color: var(--cs-text-tertiary); }

/* 主体 */
.stack { display: flex; flex-direction: column; gap: 14px; }

.panel { padding: 0; display: flex; flex-direction: column; overflow: hidden; border-radius: var(--cs-radius-lg); box-shadow: var(--cs-shadow-sm); }
.panel-head { flex: none; display: flex; align-items: center; gap: 8px; padding: 13px 16px;
  border-bottom: 1px solid var(--cs-border-light); font-size: 13px; font-weight: 600; color: var(--cs-text-primary); }
.panel-count { margin-left: auto; font-size: 11.5px; font-weight: 400; color: var(--cs-text-tertiary); }
.panel-body { padding: 14px 16px 16px; }
.res-summary { display: flex; gap: 30px; flex-wrap: wrap; padding: 10px 16px; border-bottom: 1px dashed var(--cs-border-light); }
.res-sum-item { display: flex; align-items: baseline; gap: 8px; }
.res-sum-label { font-size: 11.5px; color: var(--cs-text-tertiary); }
.res-sum-value { font-size: 13px; font-weight: 600; color: var(--cs-text-primary); font-variant-numeric: tabular-nums; }
.side-panel .panel-body { padding: 6px 12px 12px; }

/* 最近操作 */
.log-list { display: flex; flex-direction: column; }
.log-item { display: flex; align-items: center; gap: 12px; padding: 10px 4px; border-bottom: 1px solid var(--cs-border-light); }
.log-item:last-child { border-bottom: none; }
.log-user { flex: none; width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 12.5px; font-weight: 500; color: var(--cs-text-primary); }
.log-target { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 12px; color: var(--cs-text-tertiary); }
.log-time { flex: none; font-size: 12px; color: var(--cs-text-tertiary); font-variant-numeric: tabular-nums; }
.muted { color: var(--cs-text-tertiary); }

@media (max-width: 1180px) {
  .stat-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
