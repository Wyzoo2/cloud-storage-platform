<template>
  <div class="cs-page">
    <div class="breadcrumb-bar">
      <h2 class="page-title"><el-icon><Checked /></el-icon>增额审批</h2>
    </div>
    <div class="toolbar">
      <div class="toolbar-left">
        <el-radio-group v-model="statusFilter" @change="handleFilterChange">
          <el-radio-button value="pending">待审批</el-radio-button>
          <el-radio-button value="approved">已通过</el-radio-button>
          <el-radio-button value="rejected">已驳回</el-radio-button>
          <el-radio-button value="all">全部</el-radio-button>
        </el-radio-group>
      </div>
      <div class="toolbar-right"><el-tag>共 {{ total }} 条申请</el-tag></div>
    </div>
    <div class="ap-ws">
      <div class="cs-card table-card">
      <el-table
        :data="list"
        v-loading="loading"
        style="width:100%;min-width:760px"
        highlight-current-row
        :row-class-name="rowClass"
        @row-click="row => (selected = row)"
      >
        <el-table-column prop="username" label="申请人" min-width="120" />
        <el-table-column prop="amountCents" label="申请金额" width="130">
          <template #default="{ row }"><span class="amount-cell">¥{{ (row.amountCents / 100).toFixed(2) }}</span></template>
        </el-table-column>
        <el-table-column prop="gbCount" label="申请额度" width="110">
          <template #default="{ row }">{{ row.gbCount }} GB</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注/驳回原因" min-width="180">
          <template #default="{ row }">
            <span class="remark-text" :title="row.remark">{{ row.remark || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="申请时间" min-width="170">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right" align="center">
          <template #default="{ row }">
            <div class="op-actions">
              <template v-if="row.status === 'pending'">
                <el-button v-perm="'admin.increase.approve'" link type="success" size="small" @click="handleApprove(row)"><el-icon><CircleCheck /></el-icon>通过</el-button>
                <el-button v-perm="'admin.increase.approve'" link type="danger" size="small" @click="openReject(row)"><el-icon><CircleClose /></el-icon>驳回</el-button>
              </template>
            </div>
          </template>
        </el-table-column>
      </el-table>
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
    </div>

      <aside class="cs-card ap-side">
        <template v-if="selected">
          <header class="ap-head">
            <span class="ap-kicker">申请详情</span>
            <button class="ap-close" title="关闭" @click="selected = null"><el-icon><Close /></el-icon></button>
          </header>
          <div class="ap-body">
            <div class="ap-amount">¥{{ (selected.amountCents / 100).toFixed(2) }}</div>
            <div class="ap-sub">{{ selected.username || '--' }}<span class="ap-gb">{{ selected.gbCount }} GB</span></div>

            <dl class="ap-meta">
              <div><dt>状态</dt><dd><el-tag :type="statusTagType(selected.status)" size="small">{{ statusLabel(selected.status) }}</el-tag></dd></div>
              <div><dt>申请时间</dt><dd>{{ formatDateTime(selected.createdAt) }}</dd></div>
              <div><dt>备注 / 驳回原因</dt><dd>{{ selected.remark || '-' }}</dd></div>
            </dl>

            <div v-if="selected.status === 'pending'" class="ap-actions">
              <el-button v-perm="'admin.increase.approve'" type="primary" size="small" @click="handleApprove(selected)">通过</el-button>
              <el-button v-perm="'admin.increase.approve'" type="danger" plain size="small" @click="openReject(selected)">驳回</el-button>
            </div>
            <p v-else class="ap-tip">该申请已处理，审批动作仅对「待审批」生效</p>
          </div>
        </template>
        <div v-else class="ap-empty">
          <el-icon :size="16"><Checked /></el-icon>
          <span>点击任意申请查看详情</span>
        </div>
      </aside>
    </div>

    <!-- 驳回弹窗 -->
    <el-dialog v-model="rejectDialog.visible" title="驳回申请" width="min(420px, 92vw)" :close-on-click-modal="false">
      <div class="reject-info">申请人：{{ rejectDialog.record?.username }}　申请额度：{{ rejectDialog.record?.gbCount }} GB</div>
      <el-form label-position="top">
        <el-form-item label="驳回原因" required>
          <el-input v-model="rejectDialog.reason" type="textarea" :rows="3" placeholder="请输入驳回原因" maxlength="100" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectDialog.visible = false">取消</el-button>
        <el-button type="danger" :loading="rejectDialog.loading" @click="handleReject"><el-icon><CircleClose /></el-icon>确认驳回</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Checked, CircleCheck, CircleClose } from '@element-plus/icons-vue'
import { billingAdminApi } from '@/api'

const loading = ref(false)
const list = ref([])
const statusFilter = ref('pending')
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const selected = ref(null)

function rowClass({ row }) {
  return selected.value && selected.value.id === row.id ? 'ap-row-on' : ''
}
const rejectDialog = ref({ visible: false, loading: false, reason: '', record: null })

const statusTagType = (s) => ({ pending: 'warning', approved: 'success', rejected: 'danger' })[s] || 'info'
const statusLabel = (s) => ({ pending: '待审批', approved: '已通过', rejected: '已驳回' })[s] || s

const formatDateTime = (ts) => {
  if (!ts) return '-'
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const handleFilterChange = () => { page.value = 1; fetchList() }

const fetchList = async () => {
  loading.value = true
  try {
    // 契约 §4.2：status 缺省=pending，全部须显式传 all
    const params = { status: statusFilter.value, page: page.value, size: pageSize.value }
    const res = await billingAdminApi.listRequests(params)
    list.value = res.records || res.list || []
    total.value = res.total || list.value.length
  } catch { ElMessage.error('加载列表失败') }
  finally { loading.value = false }
}

const handleApprove = (record) => {
  ElMessageBox.confirm(
    `确认通过「${record.username}」的增额申请（¥${(record.amountCents / 100).toFixed(2)}，${record.gbCount} GB）？`,
    '确认通过',
    { confirmButtonText: '确认', cancelButtonText: '取消', type: 'info' }
  ).then(async () => {
    try {
      await billingAdminApi.approve(record.id)
      ElMessage.success('已通过')
      fetchList()
    } catch { ElMessage.error('操作失败') }
  }).catch(() => {})
}

const openReject = (record) => {
  rejectDialog.value = { visible: true, loading: false, reason: '', record }
}

const handleReject = async () => {
  const d = rejectDialog.value
  if (!d.reason.trim()) { ElMessage.warning('请填写驳回原因'); return }
  d.loading = true
  try {
    await billingAdminApi.reject(d.record.id, { reason: d.reason })
    ElMessage.success('已驳回')
    d.visible = false
    fetchList()
  } catch { ElMessage.error('操作失败') }
  finally { d.loading = false }
}

onMounted(fetchList)
</script>

<style scoped>
.toolbar-left { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.toolbar-right { flex-shrink: 0; }
.amount-cell { font-weight: 600; color: var(--cs-primary); }
.remark-text { color: var(--cs-text-secondary); font-size: 13px; }
.op-actions { display: flex; align-items: center; justify-content: center; gap: 4px; white-space: nowrap; }
.op-actions .el-button { margin-left: 0; }
.op-actions .el-button + .el-button { margin-left: 0; }
.op-actions .el-button .el-icon + span { margin-left: 4px; }
.table-card { overflow-x: auto; }
.reject-info { font-size: 13px; color: var(--cs-text-secondary); margin-bottom: 16px; padding: 10px 14px; background: var(--cs-bg-page); border-radius: var(--cs-radius); }
@media (max-width: 768px) {
  .breadcrumb-bar { flex-wrap: wrap; gap: 12px; }
  .toolbar { gap: 10px; }
  .toolbar-left { flex: 1 1 100%; }
  .pagination-bar { justify-content: center; }
}

/* ---------- 审批列表 + 右侧详情 ---------- */
.ap-ws { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 12px; align-items: start; }
.ap-side { position: sticky; top: 8px; min-height: 280px; display: flex; flex-direction: column; overflow: hidden; }
.ap-head { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid var(--cs-border-light); }
.ap-kicker { font-size: 9.5px; letter-spacing: 0.14em; color: var(--cs-text-tertiary); }
.ap-close { width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: 2px; background: none; color: var(--cs-text-tertiary); cursor: pointer; }
.ap-close:hover { background: var(--cs-bg-hover); color: var(--cs-text-primary); }
.ap-body { padding: 14px; }
.ap-amount { font-family: var(--cs-mono); font-size: 28px; font-weight: 600; letter-spacing: -0.03em; color: var(--cs-text-primary); line-height: 1; }
.ap-sub { margin-top: 6px; font-size: 12.5px; color: var(--cs-text-secondary); display: flex; align-items: baseline; gap: 8px; }
.ap-gb { font-size: 10.5px; color: var(--cs-text-tertiary); }
.ap-meta { margin: 14px 0 0; padding: 0; border-top: 1px solid var(--cs-border-light); }
.ap-meta > div { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--cs-border-light); }
.ap-meta dt { font-size: 11px; color: var(--cs-text-tertiary); white-space: nowrap; }
.ap-meta dd { margin: 0; font-size: 11.5px; color: var(--cs-text-primary); text-align: right; word-break: break-all; }
.ap-actions { display: flex; gap: 8px; margin-top: 16px; }
.ap-tip { margin: 14px 0 0; font-size: 10.5px; color: var(--cs-text-tertiary); }
.ap-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 36px 16px; font-size: 11.5px; color: var(--cs-text-tertiary); }
:deep(.ap-row-on) { background: var(--cs-primary-lighter) !important; }
:deep(.ap-row-on td.el-table__cell) { background: transparent !important; }

@media (max-width: 1100px) {
  .ap-ws { grid-template-columns: minmax(0, 1fr); }
  .ap-side { position: static; }
}
</style>
