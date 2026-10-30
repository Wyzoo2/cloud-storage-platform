<template>
  <div class="cs-page">
    <div class="breadcrumb-bar">
      <div class="page-head-left">
        <h2 class="page-title"><el-icon><User /></el-icon>部门成员管理</h2>
        <el-button link type="primary" class="head-link" @click="router.push('/admin/depts')">前往部门管理</el-button>
      </div>
    </div>

    <div class="cs-card main-panel">
      <div class="toolbar">
        <div class="toolbar-left">
          <el-cascader
            v-model="deptFilter"
            :options="deptCascader"
            :props="{ checkStrictly: true, emitPath: false, expandTrigger: 'click' }"
            placeholder="全部部门"
            clearable
            style="width: 240px"
          />
          <el-input v-model="keyword" placeholder="搜索姓名或登录账号" :prefix-icon="Search" clearable style="width: 220px" />
          <el-select v-model="statusFilter" placeholder="状态" clearable style="width: 130px">
            <el-option label="启用" value="active" /><el-option label="停用" value="disabled" />
          </el-select>
        </div>
        <div class="toolbar-right"><el-tag type="info">共 {{ total }} 人</el-tag></div>
      </div>

      <div class="table-wrap">
        <el-table :data="rows" v-loading="loading" style="width: 100%" row-key="id">
          <el-table-column label="成员" min-width="250">
            <template #default="{ row }">
              <div class="who-text">
                <span class="who-name">{{ displayName(row) }}</span>
                <span v-if="accountOf(row)" class="who-account">{{ accountOf(row) }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="部门" min-width="250" show-overflow-tooltip>
            <template #default="{ row }">{{ row.deptName || '公司节点' }}</template>
          </el-table-column>
          <el-table-column label="角色" width="150">
            <template #default="{ row }">
              <el-tag v-if="roleNameFor(row)" size="small" effect="plain">{{ roleNameFor(row) }}</el-tag>
              <span v-else class="muted">--</span>
            </template>
          </el-table-column>
          <el-table-column label="数据权限" width="200">
            <template #default="{ row }">
              <el-tag size="small" :type="scopeTagType(row.dataScope)">{{ scopeLabel(row.dataScope) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="150">
            <template #default="{ row }">
              <el-tag size="small" :type="row.status === 'disabled' ? 'danger' : 'success'">
                {{ row.status === 'disabled' ? '停用' : '启用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="最近登录" min-width="200">
            <template #default="{ row }">{{ row.lastLoginAt ? formatDate(row.lastLoginAt) : '--' }}</template>
          </el-table-column>
          <el-table-column label="操作" width="250">
            <template #default="{ row }">
              <el-button v-perm="'org.member.manage'" link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
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
          @current-change="loadList"
          @size-change="handleSizeChange"
        />
      </div>
    </div>

    <!-- 编辑成员：右侧抽屉 -->
    <el-drawer v-model="editDrawer" :title="`编辑成员 · ${form.nickname || form.username}`" size="480px" destroy-on-close>
      <div class="drawer-body">
        <section class="form-card">
          <h4 class="card-title">账号信息</h4>
          <div class="info-row"><span class="info-label">姓名</span><span>{{ form.nickname || '--' }}</span></div>
          <div class="info-row"><span class="info-label">账号</span><span class="mono">{{ form.username }}</span></div>
        </section>

        <section class="form-card">
          <h4 class="card-title">所属部门</h4>
          <el-cascader
            v-model="form.deptId"
            :options="deptCascader"
            :props="{ checkStrictly: true, emitPath: false, expandTrigger: 'click' }"
            placeholder="不选=公司节点"
            clearable
            style="width: 100%"
          />
        </section>

        <section class="form-card">
          <h4 class="card-title">角色 <span class="card-tip">每人仅一个</span></h4>
          <el-select v-model="form.roleId" clearable placeholder="选择角色" style="width: 100%">
            <el-option v-for="r in roleOptions" :key="r.id" :label="r.name" :value="r.id" />
          </el-select>
        </section>

        <section class="form-card">
          <h4 class="card-title">
            数据权限
            <span class="card-tip">{{ isEntAdminRow ? '企业管理员固定为全公司' : '决定能看到谁的数据' }}</span>
          </h4>
          <div class="scope-cards" :class="{ 'scope-cards--locked': isEntAdminRow }">
            <div
              v-for="s in DATA_SCOPES"
              :key="s.value"
              class="scope-card"
              :class="{ on: form.dataScope === s.value, locked: isEntAdminRow }"
              @click="pickScope(s.value)"
            >
              <div class="scope-title">{{ s.label }}{{ isEntAdminRow && s.value === 'ALL' ? '（固定）' : '' }}</div>
              <div class="scope-desc">{{ s.desc }}</div>
            </div>
          </div>
        </section>
      </div>

      <template #footer>
        <div class="drawer-footer">
          <el-button @click="editDrawer = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="saveEdit">保存</el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search, User } from '@element-plus/icons-vue'
import { rbacSource } from '@/api/rbacSource'
import { usePermissionStore } from '@/stores/permission'
import { useUserStore } from '@/stores/user'
import { DATA_SCOPES, scopeLabel } from '@/constants/menus'
import { formatDate } from '@/utils/file'
import { displayName, accountOf } from '@/utils/user'

const router = useRouter()
const perm = usePermissionStore()
const userStore = useUserStore()

/* ---------------- 部门选项（筛选用） ---------------- */
const deptCascader = ref([])

async function loadDepts() {
  try {
    deptCascader.value = (await rbacSource.depts()).cascader
  } catch (e) {
    deptCascader.value = []
  }
}

/* ---------------- 成员列表 ---------------- */
const rows = ref([])
const total = ref(0)
const page = ref(1)
const size = ref(20)
const keyword = ref('')
const deptFilter = ref(null)
const statusFilter = ref('')
const loading = ref(false)

async function loadList() {
  loading.value = true
  try {
    const res = await rbacSource.members({
      keyword: keyword.value.trim() || undefined,
      status: statusFilter.value || undefined,
      deptId: deptFilter.value ?? undefined,
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
  loadList()
}

let timer = null
watch(keyword, () => {
  clearTimeout(timer)
  timer = setTimeout(() => { page.value = 1; loadList() }, 300)
})
watch([deptFilter, statusFilter], () => { page.value = 1; loadList() })

/* ---------------- 角色 ---------------- */
const roleOptions = ref([])

function rolesOf(row) {
  const arr = Array.isArray(row.roles) ? row.roles : []
  return arr.map(r => (r && typeof r === 'object' ? r : { id: r })).filter(r => r.id != null)
}

function initialRoleId(row) {
  const list = rolesOf(row)
  if (list.length) return Number(list[0].id)
  return row.roleId == null ? null : Number(row.roleId)
}

function roleNameFor(row) {
  const list = rolesOf(row)
  return list.map(r => roleOptions.value.find(o => o.id === Number(r.id))?.name || r.name || '').filter(Boolean).join('、')
}

async function loadRoles() {
  try {
    roleOptions.value = await rbacSource.roles()
  } catch (e) {
    roleOptions.value = []
  }
}

/* ---------------- 编辑成员 ---------------- */
const editDrawer = ref(false)
const saving = ref(false)
const current = ref(null)
const form = ref({ nickname: '', username: '', deptId: null, dataScope: 'SELF', roleId: null })

// 企业管理员的数据权限由后端固定为 ALL，界面上置灰不可改
const isEntAdminRow = computed(() => Number(current.value?.enterpriseRole || 0) === 1)

function pickScope(value) {
  if (isEntAdminRow.value) return
  form.value.dataScope = value
}

function openEdit(row) {
  current.value = row
  form.value = {
    nickname: row.nickname || '',
    username: row.username,
    deptId: row.deptId ?? null,
    dataScope: Number(row.enterpriseRole || 0) === 1 ? 'ALL' : (row.dataScope || 'SELF'),
    roleId: initialRoleId(row)
  }
  editDrawer.value = true
}

async function saveEdit() {
  const row = current.value
  // 后端 PUT /users/{id} 是全量覆盖：缺省字段会被置空，所以每次都带全三个字段
  const payload = {
    deptId: form.value.deptId || null,
    dataScope: form.value.dataScope,
    roleIds: form.value.roleId ? [form.value.roleId] : []
  }
  const roleChanged = (initialRoleId(row) ?? null) !== (payload.roleIds[0] ?? null)
  const changed =
    roleChanged ||
    (row.deptId ?? null) !== (payload.deptId ?? null) ||
    String(row.dataScope || '').toUpperCase() !== String(payload.dataScope || '').toUpperCase()
  if (!changed) {
    editDrawer.value = false
    return ElMessage.info('没有需要保存的改动')
  }
  saving.value = true
  try {
    await rbacSource.updateMember(row.id, payload)
    // 改的是自己：当前会话的权限立刻刷新，否则菜单要到下次登录才变
    if (String(row.id) === String(userStore.userId)) await perm.load(true)
    if (roleChanged) {
      const name = payload.roleIds[0] ? roleOptions.value.find(r => r.id === payload.roleIds[0])?.name : ''
      ElMessage.success(name ? `已分配角色：${name}` : '已清除该成员的角色')
    } else {
      ElMessage.success('已保存')
    }
    editDrawer.value = false
    loadList()
  } catch (e) {
    // 拦截器已提示
  } finally {
    saving.value = false
  }
}

function scopeTagType(scope) {
  return { ALL: 'danger', DEPT: 'primary', DEPT_BELOW: 'primary', DEPT_AND_BELOW: 'primary', SELF: 'info' }[
    String(scope || '').toUpperCase()
  ] || 'info'
}

onMounted(async () => {
  loadRoles()
  loadDepts()
  loadList()
})
</script>

<style scoped>
.breadcrumb-bar { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
.page-head-left { display: flex; align-items: baseline; gap: 12px; }
.page-title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 17px; font-weight: 600; letter-spacing: .2px; color: var(--cs-text-primary); }

.main-panel { padding: 0; display: flex; flex-direction: column; overflow: hidden; border-radius: var(--cs-radius-lg); box-shadow: var(--cs-shadow-sm); min-height: 480px; }
.main-panel .toolbar { flex: none; margin: 0; padding: 12px 16px; border-bottom: 1px solid var(--cs-border-light); }
.table-wrap { flex: 1; min-height: 0; overflow: auto; }
.main-panel :deep(.el-table th.el-table__cell) { background: var(--cs-bg-page); color: var(--cs-text-tertiary); font-size: 12px; font-weight: 600; padding: 9px 0; }
.main-panel :deep(.el-table td.el-table__cell) { padding: 7px 0; }
.main-panel :deep(.el-table__row:hover > td.el-table__cell) { background: var(--cs-bg-hover); }
.pagination-bar { flex: none; display: flex; justify-content: flex-end; padding: 10px 16px; border-top: 1px solid var(--cs-border-light); }

.who-text { display: flex; flex-direction: column; line-height: 1.35; }
.who-name { font-size: 13px; font-weight: 600; color: var(--cs-text-primary); }
.who-account { font-size: 11.5px; color: var(--cs-text-tertiary); font-family: Consolas, monospace; }
.toolbar-left { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }

/* 抽屉 */
.drawer-body { display: flex; flex-direction: column; gap: 12px; }
.form-card { border: 1px solid var(--cs-border-light); border-radius: var(--cs-radius); padding: 12px 14px; background: var(--cs-bg-container); }
.card-title { margin: 0 0 10px; font-size: 12.5px; font-weight: 700; color: var(--cs-text-primary); display: flex; align-items: baseline; gap: 8px; }
.card-tip { font-weight: 400; font-size: 11.5px; color: var(--cs-text-tertiary); }
.info-row { display: flex; align-items: baseline; gap: 12px; font-size: 13px; color: var(--cs-text-secondary); padding: 3px 0; }
.info-label { width: 40px; flex: none; color: var(--cs-text-tertiary); font-size: 12px; }
.mono { font-family: Consolas, monospace; font-size: 12.5px; }
.drawer-footer { display: flex; justify-content: flex-end; gap: 8px; }

/* 数据权限卡 */
.scope-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(158px, 1fr)); gap: 8px; width: 100%; }
.scope-card { position: relative; border: 1px solid var(--cs-border); border-radius: var(--cs-radius); padding: 9px 10px; cursor: pointer;
  background: var(--cs-bg-container); transition: border-color var(--cs-transition), background var(--cs-transition); }
.scope-card:hover { border-color: var(--cs-primary-light); }
.scope-card.on { border-color: var(--cs-primary); background: var(--cs-primary-lighter); }
.scope-cards--locked { opacity: .85; }
.scope-card.locked { cursor: not-allowed; background: var(--cs-bg-page); }
.scope-card.locked:hover { border-color: var(--cs-border); }
.scope-card.locked.on { cursor: not-allowed; border-color: var(--cs-primary); background: var(--cs-primary-lighter); }
.scope-card.on::after { content: '✓'; position: absolute; top: 5px; right: 8px; font-size: 11px; font-weight: 700; color: var(--cs-primary); line-height: 1; }
.scope-title { padding-right: 14px; font-size: 12px; font-weight: 600; color: var(--cs-text-primary); margin-bottom: 2px; }
.scope-desc { font-size: 10.5px; color: var(--cs-text-tertiary); line-height: 1.45; }

@media (max-width: 1024px) {
  .scope-cards { grid-template-columns: 1fr; }
}
</style>
