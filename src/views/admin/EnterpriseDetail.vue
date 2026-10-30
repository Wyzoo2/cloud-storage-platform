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
    </div>

    <div class="stack">

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
const metrics = ref({ members: '--', depts: '--', roles: '--' })

async function loadMetrics() {
  const [members, depts, roles] = await Promise.all([
    rbacSource.members({ page: 1, size: 1 }).catch(() => ({ total: '--' })),
    rbacSource.depts().catch(() => ({ total: '--' })),
    rbacSource.roles().catch(() => [])
  ])
  metrics.value = {
    members: members?.total ?? '--',
    depts: depts?.total ?? '--',
    roles: Array.isArray(roles) ? roles.length : '--'
  }
}

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
    await loadMetrics()
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
.stat-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
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
