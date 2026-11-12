<template>
  <div class="cs-page">
        <div class="breadcrumb-bar">
      <div class="title-row">
        <h2 class="page-title"><el-icon><Document /></el-icon>审计日志</h2>
      </div>
    </div>
    <div class="toolbar cs-card" style="padding: 16px 20px; margin-bottom: 20px;">
      <div class="filter-row">
        <el-select
          v-model="filters.userId"
          placeholder="操作人（输入用户名搜索）"
          clearable
          filterable
          remote
          :remote-method="searchUsers"
          :loading="userLoading"
          style="width: 200px"
        >
          <el-option v-for="u in userOptions" :key="u.id" :label="u.nickname || u.username" :value="u.id">
            <span>{{ u.nickname || u.username }}</span>
            <span class="opt-sub">{{ u.username }}</span>
          </el-option>
        </el-select>
        <el-select v-model="filters.action" placeholder="动作类型" clearable style="width: 160px">
          <el-option-group label="用户操作">
            <el-option label="登录" value="login" /><el-option label="登出" value="logout" /><el-option label="上传" value="upload" />
            <el-option label="下载" value="download" /><el-option label="删除" value="delete" /><el-option label="强制删除" value="delete_force" /><el-option label="恢复" value="restore" />
            <el-option label="新建文件夹" value="mkdir" /><el-option label="重命名" value="rename" /><el-option label="移动" value="move" />
          </el-option-group>
          <el-option-group label="计费操作">
            <el-option label="增额申请" value="billing_request" /><el-option label="审批通过" value="billing_approve" />
            <el-option label="审批驳回" value="billing_reject" /><el-option label="增量到期收回" value="billing_expire" />
            <el-option label="计费配置变更" value="billing_config" /><el-option label="购买套餐" value="billing_order" /><el-option label="套餐续费" value="billing_renew" />
          </el-option-group>
          <el-option-group label="管理操作">
            <el-option label="用户管理操作" value="user_manage" /><el-option label="用户降级" value="user_demote" /><el-option label="配额变更" value="quota_change" />
          </el-option-group>
        </el-select>
        <el-date-picker v-model="filters.dateRange" type="daterange" range-separator="-" start-placeholder="开始日期" end-placeholder="结束日期" style="width: 260px" />
        <el-button type="primary" @click="handleSearch"><el-icon><Search /></el-icon>查询</el-button>
        <el-button @click="handleReset"><el-icon><Refresh /></el-icon>重置</el-button>
      </div>
    </div>
    <div class="log-ws">
    <div class="cs-card table-card">
      <el-table
        :data="logs"
        v-loading="loading"
        style="width: 100%; min-width: 760px"
        highlight-current-row
        :row-class-name="rowClass"
        @row-click="row => (selectedLog = row)"
      >
        <el-table-column prop="createdAt" label="时间" width="180">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column prop="userId" label="操作人" width="120">
          <template #default="{ row }"><span class="user-cell">{{ row.actorName || row.username || ('ID ' + row.userId) }}</span></template>
        </el-table-column>
        <el-table-column prop="action" label="动作" width="140">
          <template #default="{ row }"><el-tag size="small" :type="actionTagType(row.action)">{{ actionLabel(row.action) }}</el-tag></template>
        </el-table-column>
        <el-table-column label="金额 / 说明" width="190">
          <template #default="{ row }">
            <span v-if="amountText(row)">{{ amountText(row) }}</span>
            <span v-else class="muted">--</span>
            <el-tag v-if="isDuplicated(row)" size="small" type="info" effect="plain" class="dup-tag">未扣款</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="target" label="目标" min-width="200">
          <template #default="{ row }">{{ targetLabel(row) }}</template>
        </el-table-column>
        <el-table-column prop="ip" label="IP" width="140">
          <template #default="{ row }">{{ row.ip || '--' }}</template>
        </el-table-column>
      </el-table>
      <div class="pagination-bar">
        <el-pagination v-model:current-page="currentPage" v-model:page-size="pageSize" :page-sizes="[20, 50, 100]" :total="total" layout="total, sizes, prev, pager, next" background @current-change="loadLogs" @size-change="handleSizeChange" />
      </div>
    </div>

      <aside class="cs-card log-side">
        <template v-if="selectedLog">
          <header class="log-side-head">
            <span class="ls-kicker">日志详情</span>
            <button class="ls-close" title="关闭" @click="selectedLog = null"><el-icon><Close /></el-icon></button>
          </header>
          <div class="ls-body">
            <div class="ls-action">{{ actionLabel(selectedLog.action) }}</div>
            <div class="ls-target">{{ targetLabel(selectedLog) }}</div>

            <dl class="ls-meta">
              <div><dt>操作人</dt><dd>{{ selectedLog.actorName || selectedLog.username || ('ID ' + selectedLog.userId) }}</dd></div>
              <div><dt>时间</dt><dd>{{ formatDate(selectedLog.createdAt) }}</dd></div>
              <div><dt>IP</dt><dd class="mono">{{ selectedLog.ip || '--' }}</dd></div>
              <div><dt>日志 ID</dt><dd class="mono">{{ selectedLog.id }}</dd></div>
            </dl>

            <div class="ls-detail">
              <span class="ls-label">详情</span>
              <pre class="detail-pre">{{ detailText(selectedLog) }}</pre>
            </div>
          </div>
        </template>
        <div v-else class="ls-empty">
          <el-icon :size="16"><Document /></el-icon>
          <span>点击左侧任意一条日志查看详情</span>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { Document, Refresh, Search } from '@element-plus/icons-vue'
import { adminApi, auditApi } from '@/api'
import { formatDate } from '@/utils/file'

const logs = ref([])
const selectedLog = ref(null)

function rowClass({ row }) {
  return selectedLog.value && selectedLog.value.id === row.id ? 'log-row-on' : ''
}

const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const filters = ref({ userId: null, action: '', dateRange: null })

/* 操作人候选：输入即查后端（/admin/users?keyword=），选中后按 userId 过滤 */

const userOptions = ref([])
const userLoading = ref(false)
async function searchUsers(kw) {
  if (!kw) { userOptions.value = []; return }
  userLoading.value = true
  try {
    const res = await adminApi.listUsers({ keyword: kw, page: 1, size: 20 })
    userOptions.value = (res?.content || res?.list || []).map(u => ({ id: u.id, username: u.username, nickname: u.nickname }))
  } catch (e) {
    userOptions.value = []
  } finally {
    userLoading.value = false
  }
}

function buildParams() {
  const p = { page: currentPage.value, size: pageSize.value }
  if (filters.value.userId) p.userId = filters.value.userId
  if (filters.value.action) p.action = filters.value.action
  if (filters.value.dateRange && filters.value.dateRange.length === 2) {
    const [s, e] = filters.value.dateRange
    const start = new Date(s); start.setHours(0, 0, 0, 0)
    const end = new Date(e); end.setHours(23, 59, 59, 999)
    p.start = start.toISOString()
    p.end = end.toISOString()
  }
  return p
}

async function loadLogs() {
  loading.value = true
  try {
    const res = await auditApi.query(buildParams())
    logs.value = res.list || []
    total.value = res.total || 0
  } finally {
    loading.value = false
  }
}

function handleSearch() { currentPage.value = 1; loadLogs() }
function handleSizeChange() { currentPage.value = 1; loadLogs() }
function handleReset() { filters.value = { userId: null, action: '', dateRange: null }; currentPage.value = 1; loadLogs() }

// 后端实际动作值为小写（login / mkdir / user_manage 等），未收录的显示原文
const actionMap = { login: '登录', logout: '登出', upload: '上传', download: '下载', delete: '删除', restore: '恢复', mkdir: '新建文件夹', create_folder: '新建文件夹', rename: '重命名', move: '移动', share: '分享', user_manage: '用户管理', billing_request: '增额申请', billing_approve: '审批通过', billing_reject: '审批驳回', billing_expire: '增量到期收回', billing_config: '计费配置变更', billing_order: '购买套餐', billing_renew: '套餐续费', user_demote: '用户降级', quota_change: '配额变更', delete_force: '强制删除' }
// detail 可能是 JSON 字符串或对象，统一解析成对象
function detailObj(row) {
  const d = row?.detail
  if (!d) return {}
  if (typeof d === 'object') return d
  try { return JSON.parse(d) } catch { return {} }
}

// 购买 / 续费的金额与说明（金额单位：分）
function amountText(row) {
  const a = String(row?.action || '').toLowerCase()
  const d = detailObj(row)
  if (a === 'billing_order') {
    const yuan = d.totalCents != null ? (Number(d.totalCents) / 100).toFixed(2) : ''
    const qty = d.quantity != null ? ` × ${d.quantity}` : ''
    return yuan ? `¥${yuan}${qty}` : ''
  }
  if (a === 'billing_renew') {
    const yuan = d.priceCents != null ? (Number(d.priceCents) / 100).toFixed(2) : ''
    const ext = d.extendDays != null ? ` · 延长 ${d.extendDays} 天` : ''
    return (yuan ? `¥${yuan}` : '') + ext
  }
  return ''
}

// 重复提交（未扣款）标记
function isDuplicated(row) {
  return !!detailObj(row).duplicated
}

function actionLabel(a) { return actionMap[String(a || '').toLowerCase()] || a }
function actionTagType(a) { const k = String(a || '').toLowerCase(); if (!k) return 'info'; if (k === 'user_manage' || k === 'billing_config' || k === 'quota_change') return 'warning'; if (['delete', 'logout', 'billing_expire'].includes(k)) return 'info'; if (k === 'login' || k === 'billing_approve') return 'success'; if (k === 'billing_reject' || k === 'user_demote' || k === 'delete_force') return 'danger'; return 'info' }
// detail 是 JSON 字符串，格式化后展示；target 优先取 detail 里的 name（如目录名）
function parseDetail(row) {
  if (!row?.detail) return null
  try { return typeof row.detail === 'string' ? JSON.parse(row.detail) : row.detail } catch { return null }
}
function detailText(row) {
  const d = parseDetail(row)
  return d ? JSON.stringify(d, null, 2) : (row.detail || '--')
}
function targetLabel(row) {
  const d = parseDetail(row)
  const a = String(row?.action || '').toLowerCase()
  // 计费动作的 target 是订单号 / 开通记录号，补可读前缀
  if (a === 'billing_order' && row.target) return `订单 #${row.target}`
  if (a === 'billing_renew' && row.target) return `套餐 #${row.target}`
  return row.targetName || d?.name || row.target || '--'
}

onMounted(() => {
  loadLogs()
})
</script>

<style scoped>
.dup-tag { margin-left: 6px; transform: scale(.92); }
.muted { color: var(--cs-text-tertiary); }
.page-title { display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 600; color: var(--cs-text-primary); margin: 0 0 24px 0; }
.expand-detail { padding: 16px 24px; }
.expand-detail h4 { font-size: 14px; font-weight: 600; color: var(--cs-text-primary); margin: 0 0 12px 0; }
.user-cell { color: var(--cs-text-secondary); }
.detail-pre { white-space: pre-wrap; word-break: break-all; margin: 0; font-family: inherit; font-size: 13px; color: var(--cs-text-secondary); }
.pagination-bar { display: flex; justify-content: flex-end; margin-top: 20px; }
.table-card { overflow-x: auto; }
.filter-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.filter-row .el-input, .filter-row .el-select, .filter-row .el-date-editor { flex-shrink: 0; }
@media (max-width: 768px) {
  .filter-row .el-input, .filter-row .el-select, .filter-row .el-date-editor { width: 100% !important; flex: 1 1 100%; }
  .filter-row .el-button { flex: 1 1 calc(50% - 8px); margin-left: 0; }
  .filter-row .el-button + .el-button { margin-left: 0; }
  .expand-detail { padding: 12px 16px; }
  .pagination-bar { justify-content: center; }
}

/* ---------- 列表 + 右侧详情 ---------- */
.log-ws { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 12px; align-items: start; }

.log-side { position: sticky; top: 8px; min-height: 320px; display: flex; flex-direction: column; overflow: hidden; }
.log-side-head { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid var(--cs-border-light); }
.ls-kicker { font-size: 9.5px; letter-spacing: 0.14em; color: var(--cs-text-tertiary); }
.ls-close { width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: 2px; background: none; color: var(--cs-text-tertiary); cursor: pointer; }
.ls-close:hover { background: var(--cs-bg-hover); color: var(--cs-text-primary); }
.ls-body { padding: 14px; }
.ls-action { font-size: 15px; font-weight: 600; color: var(--cs-text-primary); letter-spacing: -0.01em; }
.ls-target { margin-top: 3px; font-size: 11.5px; color: var(--cs-text-tertiary); word-break: break-all; }
.ls-meta { margin: 14px 0 0; padding: 0; border-top: 1px solid var(--cs-border-light); }
.ls-meta > div { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--cs-border-light); }
.ls-meta dt { font-size: 11px; color: var(--cs-text-tertiary); }
.ls-meta dd { margin: 0; font-size: 11.5px; color: var(--cs-text-primary); text-align: right; word-break: break-all; }
.ls-detail { margin-top: 14px; }
.ls-label { display: block; margin-bottom: 6px; font-size: 10px; letter-spacing: 0.1em; color: var(--cs-text-tertiary); }
.ls-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 40px 16px; font-size: 11.5px; color: var(--cs-text-tertiary); }
:deep(.log-row-on) { background: var(--cs-primary-lighter) !important; }
:deep(.log-row-on td.el-table__cell) { background: transparent !important; }

@media (max-width: 1100px) {
  .log-ws { grid-template-columns: minmax(0, 1fr); }
  .log-side { position: static; }
}
</style>
