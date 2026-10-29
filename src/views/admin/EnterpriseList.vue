<template>
  <div class="cs-page">
    <div class="breadcrumb-bar">
      <div class="page-head-left"><h2 class="page-title"><el-icon><OfficeBuilding /></el-icon>企业列表</h2>
      </div>
    </div>

    <div class="toolbar">
      <div class="toolbar-left">
        <el-select v-model="statusFilter" placeholder="全部状态" clearable style="width: 150px">
          <el-option label="正常" value="active" />
          <el-option label="待审核" value="pending" />
          <el-option label="已驳回" value="rejected" />
          <el-option label="已停用" value="disabled" />
        </el-select>
      </div>
    </div>

    <div v-if="!loading && !rows.length" class="cs-card empty-card">
      <el-empty :description="statusFilter ? '没有匹配的企业' : '暂无企业'" :image-size="90">
        <el-button v-if="statusFilter" @click="statusFilter = ''">清空筛选</el-button>
      </el-empty>
    </div>

    <div v-else class="cs-card table-card">
      <el-table :data="rows" v-loading="loading" style="width: 100%" row-key="id">
        <el-table-column label="企业" min-width="220">
          <template #default="{ row }">
            <div class="ent-cell">
              <span class="ent-name">{{ row.name }}</span>
              <span class="ent-code">{{ row.code }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="statusType(row.status)" effect="plain">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="成员数" width="100" align="right">
          <template #default="{ row }">{{ row.memberCount == null ? '--' : row.memberCount }}</template>
        </el-table-column>
        <el-table-column label="到期时间" width="180">
          <template #default="{ row }">{{ row.expireAt ? formatDate(row.expireAt) : '--' }}</template>
        </el-table-column>
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">{{ row.createdAt ? formatDate(row.createdAt) : '--' }}</template>
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
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import { rbacSource } from '@/api/rbacSource'
import { formatDate } from '@/utils/file'

const rows = ref([])
const total = ref(0)
const page = ref(1)
const size = ref(20)
const statusFilter = ref('')
const loading = ref(false)

const STATUS_LABEL = { active: '正常', pending: '待审核', rejected: '已驳回', disabled: '已停用' }
const STATUS_TYPE = { active: 'success', pending: 'warning', rejected: 'info', disabled: 'danger' }

function statusLabel(s) {
  return STATUS_LABEL[s] || s || '--'
}

function statusType(s) {
  return STATUS_TYPE[s] || 'info'
}

async function load() {
  loading.value = true
  try {
    const res = await rbacSource.enterprises({
      status: statusFilter.value || undefined,
      page: page.value,
      size: size.value
    })
    rows.value = res.list
    total.value = res.total
  } catch (e) {
    rows.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function handleSizeChange() {
  page.value = 1
  load()
}

watch(statusFilter, () => { page.value = 1; load() })

onMounted(load)
</script>

<style scoped>
.breadcrumb-bar { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 14px; }
.page-head-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.page-title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 17px; font-weight: 600; letter-spacing: .2px; color: var(--cs-text-primary); }
.toolbar-left { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.table-card { overflow-x: auto; }
.empty-card { padding: 24px; }
.ent-cell { display: flex; flex-direction: column; line-height: 1.35; }
.ent-name { font-size: 13px; font-weight: 600; color: var(--cs-text-primary); }
.ent-code { font-size: 11.5px; color: var(--cs-text-tertiary); font-family: Consolas, monospace; }
.pagination-bar { display: flex; justify-content: flex-end; margin-top: 16px; }
</style>
