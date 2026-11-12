<template>
  <div class="cs-page">
    <div class="breadcrumb-bar">
      <h2 class="page-title"><el-icon><Wallet /></el-icon>缴费台账</h2>
    </div>
    <div class="toolbar">
      <div class="toolbar-left">
        <el-radio-group v-model="statusFilter" @change="fetchList">
          <el-radio-button value="">全部</el-radio-button>
          <el-radio-button value="active">生效中</el-radio-button>
          <el-radio-button value="expired">已过期</el-radio-button>
        </el-radio-group>
      </div>
      <div class="toolbar-right">
        <el-tag>共 {{ total }} 条记录</el-tag>
      </div>
    </div>
    <div class="rec-ws">
      <div class="cs-card table-card">
      <el-table
        :data="list"
        v-loading="loading"
        style="width:100%;min-width:760px"
        highlight-current-row
        :row-class-name="rowClass"
        @row-click="row => (selected = row)"
      >
        <el-table-column prop="username" label="用户名" min-width="120" />
        <el-table-column prop="amountCents" label="缴费金额" width="130">
          <template #default="{ row }"><span class="amount-cell">¥{{ (row.amountCents / 100).toFixed(2) }}</span></template>
        </el-table-column>
        <el-table-column prop="gbCount" label="购买额度" width="120">
          <template #default="{ row }">{{ row.gbCount }} GB</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="appliedAt" label="生效时间" min-width="170">
          <template #default="{ row }">{{ formatDateTime(row.appliedAt) }}</template>
        </el-table-column>
        <el-table-column prop="expireAt" label="到期时间" min-width="170">
          <template #default="{ row }">{{ formatDateTime(row.expireAt) }}</template>
        </el-table-column>
        <el-table-column prop="approvedByName" label="审批人" width="100" />
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

      <aside class="cs-card rec-side">
        <template v-if="selected">
          <header class="rec-head">
            <span class="rec-kicker">缴费详情</span>
            <button class="rec-close" title="关闭" @click="selected = null"><el-icon><Close /></el-icon></button>
          </header>
          <div class="rec-body">
            <div class="rec-amount">¥{{ (selected.amountCents / 100).toFixed(2) }}</div>
            <div class="rec-user">{{ selected.username || '--' }}<span class="rec-gb">{{ selected.gbCount }} GB</span></div>

            <dl class="rec-meta">
              <div><dt>状态</dt><dd><el-tag :type="statusTagType(selected.status)" size="small">{{ statusLabel(selected.status) }}</el-tag></dd></div>
              <div><dt>生效时间</dt><dd>{{ formatDateTime(selected.appliedAt) }}</dd></div>
              <div><dt>到期时间</dt><dd>{{ formatDateTime(selected.expireAt) }}</dd></div>
              <div><dt>审批人</dt><dd>{{ selected.approvedByName || '--' }}</dd></div>
            </dl>

            <p class="rec-tip">台账按审批通过时间记账，金额单位元（后端以分存储）</p>
          </div>
        </template>
        <div v-else class="rec-empty">
          <el-icon :size="16"><Wallet /></el-icon>
          <span>点击任意记录查看缴费详情</span>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Wallet } from '@element-plus/icons-vue'
import { billingAdminApi } from '@/api'

const loading = ref(false)
const list = ref([])
const statusFilter = ref('')
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const selected = ref(null)

function rowClass({ row }) {
  return selected.value && selected.value.id === row.id ? 'rec-row-on' : ''
}

const statusTagType = (s) => ({ active: 'success', expired: 'info' })[s] || 'info'
const statusLabel = (s) => ({ active: '生效中', expired: '已过期' })[s] || s

// 导出台账：沿用当前状态筛选，由后端生成文件（导出动作本身会记审计）

const formatDateTime = (ts) => {
  if (!ts) return '-'
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const fetchList = async () => {
  loading.value = true
  try {
    // 契约 §4.2：仅 userId / status 筛选（status 为空 = 不筛）
    const params = { page: page.value, size: pageSize.value }
    if (statusFilter.value) params.status = statusFilter.value
    const res = await billingAdminApi.listRecords(params)
    list.value = res.records || res.list || []
    total.value = res.total || list.value.length
  } catch { ElMessage.error('加载记录失败') }
  finally { loading.value = false }
}

onMounted(fetchList)
</script>

<style scoped>
.toolbar-left { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.toolbar-right { flex-shrink: 0; }
.amount-cell { font-weight: 600; color: var(--cs-primary); }
.table-card { overflow-x: auto; }
@media (max-width: 768px) {
  .breadcrumb-bar { flex-wrap: wrap; gap: 12px; }
  .toolbar { gap: 10px; }
  .toolbar-left { flex: 1 1 100%; }
  .pagination-bar { justify-content: center; }
}

/* ---------- 台账 + 右侧详情 ---------- */
.rec-ws { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 12px; align-items: start; }
.rec-side { position: sticky; top: 8px; min-height: 280px; display: flex; flex-direction: column; overflow: hidden; }
.rec-head { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid var(--cs-border-light); }
.rec-kicker { font-size: 9.5px; letter-spacing: 0.14em; color: var(--cs-text-tertiary); }
.rec-close { width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: 2px; background: none; color: var(--cs-text-tertiary); cursor: pointer; }
.rec-close:hover { background: var(--cs-bg-hover); color: var(--cs-text-primary); }
.rec-body { padding: 14px; }
.rec-amount { font-family: var(--cs-mono); font-size: 28px; font-weight: 600; letter-spacing: -0.03em; color: var(--cs-primary); line-height: 1; }
.rec-user { margin-top: 6px; font-size: 12.5px; color: var(--cs-text-primary); display: flex; align-items: baseline; gap: 8px; }
.rec-gb { font-size: 10.5px; color: var(--cs-text-tertiary); }
.rec-meta { margin: 14px 0 0; padding: 0; border-top: 1px solid var(--cs-border-light); }
.rec-meta > div { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--cs-border-light); }
.rec-meta dt { font-size: 11px; color: var(--cs-text-tertiary); }
.rec-meta dd { margin: 0; font-size: 11.5px; color: var(--cs-text-primary); }
.rec-tip { margin: 12px 0 0; font-size: 10.5px; color: var(--cs-text-tertiary); line-height: 1.6; }
.rec-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 36px 16px; font-size: 11.5px; color: var(--cs-text-tertiary); }
:deep(.rec-row-on) { background: var(--cs-primary-lighter) !important; }
:deep(.rec-row-on td.el-table__cell) { background: transparent !important; }

@media (max-width: 1100px) {
  .rec-ws { grid-template-columns: minmax(0, 1fr); }
  .rec-side { position: static; }
}
</style>
