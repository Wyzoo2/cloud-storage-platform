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
      <div class="toolbar-right"><el-tag>共 {{ total }} 条记录</el-tag></div>
    </div>
    <div class="cs-card table-card">
      <el-table :data="list" v-loading="loading" style="width:100%;min-width:820px" show-summary :summary-method="getSummary">
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

const statusTagType = (s) => ({ active: 'success', expired: 'info' })[s] || 'info'
const statusLabel = (s) => ({ active: '生效中', expired: '已过期' })[s] || s

const formatDateTime = (ts) => {
  if (!ts) return '-'
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const getSummary = ({ columns, data }) => {
  const sums = []
  columns.forEach((col, idx) => {
    if (idx === 0) { sums[idx] = '合计'; return }
    if (col.property === 'amountCents') {
      const cents = data.reduce((s, r) => s + (r.amountCents || 0), 0)
      sums[idx] = `¥${(cents / 100).toFixed(2)}`
    } else if (col.property === 'gbCount') {
      const gb = data.reduce((s, r) => s + (r.gbCount || 0), 0)
      sums[idx] = `${gb} GB`
    } else {
      sums[idx] = ''
    }
  })
  return sums
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
</style>
