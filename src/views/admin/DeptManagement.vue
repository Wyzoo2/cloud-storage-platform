<template>
  <div class="cs-page">
    <div class="breadcrumb-bar">
      <div class="page-head-left">
        <h2 class="page-title"><el-icon><OfficeBuilding /></el-icon>部门管理</h2>
        <span class="page-sub">{{ deptCount }} 个部门 · {{ memberTotalAll }} 位成员</span>
      </div>
      <el-button v-perm="'org.dept.manage'" type="primary" @click="openDialog()">
        <el-icon><Plus /></el-icon>新建部门
      </el-button>
    </div>

    <div class="split">
      <!-- 左：组织架构 -->
      <aside class="cs-card tree-panel">
        <div class="panel-head">
          <span>组织架构</span>
        </div>
        <div class="panel-body" v-loading="loading">
          <div
            v-for="n in rows"
            :key="n.id"
            class="node"
            :class="{ active: currentId === n.id }"
            :style="{ paddingLeft: 14 + n.depth * 18 + 'px' }"
            @click="select(n.id)"
          >
            <span v-for="i in n.depth" :key="i" class="guide" :style="{ left: 14 + (i - 1) * 18 + 'px' }"></span>
            <span class="caret" @click.stop="toggle(n)">
              <el-icon v-if="n.children?.length" :size="11">
                <ArrowRight v-if="collapsed.has(n.id)" /><ArrowDown v-else />
              </el-icon>
            </span>
            <span class="node-title" :title="n.name">{{ n.name }}</span>
            <span v-if="countOf(n.id)" class="node-num">{{ countOf(n.id) }}</span>
          </div>

          <el-empty v-if="!rows.length && !loading" description="暂无部门" :image-size="70" />
        </div>
      </aside>

      <!-- 右：部门详情 + 部门成员 -->
      <main class="cs-card detail-panel">
        <template v-if="current">
          <div class="panel-head">
            <span class="head-name">{{ current.name }}</span>
            <div class="head-actions">
              <el-button v-perm="'org.dept.manage'" link type="primary" @click="openDialog(null, current.id)">新建子部门</el-button>
              <el-button v-perm="'org.dept.manage'" link type="primary" @click="openDialog(current)">编辑</el-button>
              <el-button v-perm="'org.dept.manage'" link type="danger" @click="removeCurrent">删除</el-button>
            </div>
          </div>

          <div class="meta">
            <div class="meta-item">
              <span class="meta-label">上级部门</span>
              <span class="meta-value">{{ parentName }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">子部门</span>
              <span class="meta-value">{{ childCount }} 个</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">直属成员</span>
              <span class="meta-value">{{ memberTotal }} 人</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">排序值</span>
              <span class="meta-value">{{ current.sortNo ?? 0 }}</span>
            </div>
          </div>

          <div class="table-head">
            <span>部门成员</span>
            <span class="panel-count">{{ memberTotal }} 人</span>
          </div>
          <div class="table-wrap">
            <el-table :data="members" v-loading="memberLoading" style="width: 100%" row-key="id">
              <el-table-column label="成员" min-width="200">
                <template #default="{ row }">
                  <div class="who-text">
                    <span class="who-name">{{ displayName(row) }}</span>
                    <span v-if="accountOf(row)" class="who-account">{{ accountOf(row) }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="部门" min-width="150" show-overflow-tooltip>
                <template #default="{ row }">{{ row.deptName || '公司节点' }}</template>
              </el-table-column>
              <el-table-column label="数据权限" width="170">
                <template #default="{ row }">
                  <el-tag size="small" :type="scopeTagType(row.dataScope)" effect="plain">{{ scopeLabel(row.dataScope) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="90">
                <template #default="{ row }">
                  <el-tag size="small" :type="row.status === 'disabled' ? 'danger' : 'success'" effect="plain">
                    {{ row.status === 'disabled' ? '停用' : '启用' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="最近登录" width="170">
                <template #default="{ row }">{{ row.lastLoginAt ? formatDate(row.lastLoginAt) : '--' }}</template>
              </el-table-column>
            </el-table>
            <el-empty v-if="!memberLoading && !members.length" description="该部门暂无直属成员" :image-size="70" />
          </div>
          <div class="pagination-bar">
            <el-pagination
              v-model:current-page="page"
              v-model:page-size="size"
              :page-sizes="[10, 20, 50]"
              :total="memberTotal"
              layout="total, sizes, prev, pager, next"
              background
              @current-change="loadMembers"
              @size-change="handleSizeChange"
            />
          </div>
        </template>

        <el-empty v-else description="选择左侧部门查看详情" :image-size="90" class="detail-empty" />
      </main>
    </div>

    <!-- 新建 / 编辑部门 -->
    <el-dialog v-model="dialog" :title="form.id ? '编辑部门' : '新建部门'" width="420px" align-center destroy-on-close>
      <el-form label-width="76px" label-position="left">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" maxlength="64" show-word-limit placeholder="如：技术部" />
        </el-form-item>
        <el-form-item label="上级">
          <el-cascader
            v-model="form.parentId"
            :options="parentOptions"
            :props="{ checkStrictly: true, emitPath: false, expandTrigger: 'click' }"
            placeholder="不选 = 顶级部门"
            clearable
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sortNo" :min="0" :max="9999" controls-position="right" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
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
import { ArrowDown, ArrowRight, OfficeBuilding, Plus } from '@element-plus/icons-vue'
import { rbacSource } from '@/api/rbacSource'
import { scopeLabel } from '@/constants/menus'
import { displayName, accountOf } from '@/utils/user'
import { formatDate } from '@/utils/file'

/* ---------------- 部门树 ---------------- */
const tree = ref([])
const cascader = ref([])
const counts = ref({})
const loading = ref(false)
const currentId = ref(null)
const collapsed = ref(new Set())
const memberTotalAll = ref(0)

const rows = computed(() => {
  const out = []
  const walk = (nodes, depth) => {
    nodes.forEach(n => {
      out.push({ ...n, depth })
      if (n.children?.length && !collapsed.value.has(n.id)) walk(n.children, depth + 1)
    })
  }
  walk(tree.value, 0)
  return out
})

// 部门总数按完整树统计（折叠不影响数字）
const deptCount = computed(() => {
  let n = 0
  const walk = nodes => nodes.forEach(x => { n++; if (x.children?.length) walk(x.children) })
  walk(tree.value)
  return n
})
const current = computed(() => rows.value.find(n => n.id === currentId.value) || null)
const parentName = computed(() => {
  if (!current.value) return '--'
  const p = rows.value.find(n => n.id === current.value.parentId)
  return p ? p.name : '顶级部门'
})
const childCount = computed(() => (current.value ? treeChildrenOf(current.value.id).length : 0))

function treeChildrenOf(id) {
  let hit = null
  const walk = nodes => {
    nodes.forEach(n => {
      if (n.id === id) hit = n
      if (n.children?.length) walk(n.children)
    })
  }
  walk(tree.value)
  return hit?.children || []
}

const countOf = id => counts.value[id] || 0

async function loadTree() {
  loading.value = true
  try {
    const res = await rbacSource.depts()
    tree.value = res.tree
    cascader.value = res.cascader
  } catch (e) {
    tree.value = []
    cascader.value = []
  } finally {
    loading.value = false
  }
}

// 人数徽标：一次取最多 100 人聚合（超过 100 则不展示，避免数字不准）
async function loadCounts() {
  try {
    const res = await rbacSource.members({ page: 1, size: 100 })
    memberTotalAll.value = res.total || 0
    if ((res.total || 0) > 100) return
    const map = {}
    res.list.forEach(m => {
      if (m.deptId != null) map[m.deptId] = (map[m.deptId] || 0) + 1
    })
    counts.value = map
  } catch (e) {
    counts.value = {}
  }
}

/* ---------------- 部门成员 ---------------- */
const members = ref([])
const memberTotal = ref(0)
const page = ref(1)
const size = ref(10)
const memberLoading = ref(false)

async function loadMembers() {
  if (currentId.value === null) {
    members.value = []
    memberTotal.value = 0
    return
  }
  memberLoading.value = true
  try {
    const res = await rbacSource.members({ deptId: currentId.value, page: page.value, size: size.value })
    members.value = res.list
    memberTotal.value = res.total
  } catch (e) {
    members.value = []
    memberTotal.value = 0
  } finally {
    memberLoading.value = false
  }
}

function select(id) {
  currentId.value = id
  page.value = 1
  loadMembers()
}

// 树刷新后保证右侧仍有选中项
function ensureSelection() {
  if (currentId.value != null && rows.value.some(n => n.id === currentId.value)) return
  select(rows.value.length ? rows.value[0].id : null)
}

function toggle(node) {
  const s = new Set(collapsed.value)
  s.has(node.id) ? s.delete(node.id) : s.add(node.id)
  collapsed.value = s
}

/* ---------------- 部门增删改 ---------------- */
const dialog = ref(false)
const saving = ref(false)
const form = ref({ id: null, name: '', parentId: null, sortNo: 0 })

// 上级候选：级联树里剔除「自己 + 自己的子孙」，避免形成环
const parentOptions = computed(() => {
  const prune = nodes =>
    (nodes || [])
      .filter(n => n.value !== form.value.id)
      .map(n => (n.children ? { ...n, children: prune(n.children) } : n))
  return prune(cascader.value)
})

function openDialog(node, parentId) {
  form.value = node
    ? { id: node.id, name: node.name, parentId: node.parentId ?? null, sortNo: node.sortNo ?? 0 }
    : { id: null, name: '', parentId: parentId ?? currentId.value ?? null, sortNo: 0 }
  dialog.value = true
}

async function save() {
  const name = form.value.name.trim()
  if (!name) return ElMessage.warning('请输入部门名称')
  saving.value = true
  try {
    const payload = { name, parentId: form.value.parentId ?? null, sortNo: form.value.sortNo ?? 0 }
    if (form.value.id) await rbacSource.updateDept(form.value.id, payload)
    else await rbacSource.createDept(payload)
    ElMessage.success(form.value.id ? '部门已更新' : '部门已创建')
    dialog.value = false
    await Promise.all([loadTree(), loadCounts()])
    ensureSelection()
    loadMembers()
  } catch (e) {
    // 拦截器已提示
  } finally {
    saving.value = false
  }
}

async function removeCurrent() {
  const dept = current.value
  if (!dept) return
  const ok = await ElMessageBox.confirm(
    `确定删除部门「${dept.name}」？其下成员会变为「公司节点」，子部门需先移走。`,
    '删除部门',
    { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
  ).catch(() => false)
  if (!ok) return
  try {
    await rbacSource.removeDept(dept.id)
    ElMessage.success('部门已删除')
    currentId.value = null
    await Promise.all([loadTree(), loadCounts()])
    ensureSelection()
    loadMembers()
  } catch (e) {
    // 拦截器已提示
  }
}

function handleSizeChange() {
  page.value = 1
  loadMembers()
}

function scopeTagType(scope) {
  return { ALL: 'danger', DEPT: 'primary', DEPT_BELOW: 'primary', DEPT_AND_BELOW: 'primary', SELF: 'info' }[
    String(scope || '').toUpperCase()
  ] || 'info'
}

onMounted(async () => {
  await loadTree()
  loadCounts()
  ensureSelection()
})
</script>

<style scoped>
.breadcrumb-bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 14px; }
.page-head-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.page-title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 17px; font-weight: 600; letter-spacing: .2px; color: var(--cs-text-primary); }
.page-sub { font-size: 12px; color: var(--cs-text-tertiary); }

.split { display: grid; grid-template-columns: 340px minmax(0, 1fr); gap: 14px; align-items: stretch; height: calc(100vh - 190px); min-height: 480px; }

.tree-panel, .detail-panel { padding: 0; display: flex; flex-direction: column; overflow: hidden; border-radius: var(--cs-radius-lg); box-shadow: var(--cs-shadow-sm); }
.panel-head { flex: none; display: flex; align-items: center; gap: 10px; padding: 13px 16px;
  border-bottom: 1px solid var(--cs-border-light); font-size: 13px; font-weight: 600; color: var(--cs-text-primary); }
.panel-count { margin-left: auto; font-size: 11.5px; font-weight: 400; color: var(--cs-text-tertiary); }
.panel-body { padding: 8px 8px 10px; overflow: auto; flex: 1; min-height: 0; }
.head-name { font-size: 14px; font-weight: 600; }
.head-actions { margin-left: auto; display: flex; gap: 10px; }
.head-actions .el-button { margin-left: 0; font-size: 12.5px; }

/* 树：大行高 + 层级引导线，无图标 */
.node { position: relative; display: flex; align-items: center; gap: 8px; height: 42px; padding: 0 12px; margin-bottom: 1px;
  border-radius: var(--cs-radius); cursor: pointer; font-size: 14px; color: var(--cs-text-secondary);
  transition: background var(--cs-transition), color var(--cs-transition); }
.node:hover { background: var(--cs-bg-hover); }
.node.active { background: var(--cs-primary-lighter); color: var(--cs-primary); font-weight: 600; }
.guide { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--cs-border-light); pointer-events: none; }
.caret { width: 14px; flex: none; display: inline-flex; justify-content: center; color: var(--cs-text-tertiary); }
.node-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: .2px; }
.node-num { flex: none; min-width: 24px; text-align: right; font-size: 12px; color: var(--cs-text-tertiary); font-variant-numeric: tabular-nums; }
.node.active .node-num { color: var(--cs-primary); }

/* 右侧详情 */
.meta { flex: none; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; padding: 14px 16px;
  border-bottom: 1px solid var(--cs-border-light); }
.meta-item { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.meta-label { font-size: 11.5px; color: var(--cs-text-tertiary); }
.meta-value { font-size: 13px; font-weight: 500; color: var(--cs-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.table-head { flex: none; display: flex; align-items: center; padding: 11px 16px; font-size: 13px; font-weight: 600; color: var(--cs-text-primary); }
.table-wrap { flex: 1; min-height: 0; overflow: auto; border-top: 1px solid var(--cs-border-light); }
.detail-panel :deep(.el-table th.el-table__cell) { background: var(--cs-bg-page); color: var(--cs-text-tertiary); font-size: 12px; font-weight: 600; padding: 8px 0; }
.detail-panel :deep(.el-table td.el-table__cell) { padding: 7px 0; }
.detail-panel :deep(.el-table__row:hover > td.el-table__cell) { background: var(--cs-bg-hover); }
.pagination-bar { flex: none; display: flex; justify-content: flex-end; padding: 10px 16px; border-top: 1px solid var(--cs-border-light); }
.detail-empty { flex: 1; display: flex; flex-direction: column; justify-content: center; }

.who-text { display: flex; flex-direction: column; line-height: 1.35; }
.who-name { font-size: 13px; font-weight: 600; color: var(--cs-text-primary); }
.who-account { font-size: 11.5px; color: var(--cs-text-tertiary); font-family: Consolas, monospace; }
.dialog-footer { display: flex; justify-content: flex-end; gap: 8px; }

@media (max-width: 1080px) {
  .split { grid-template-columns: 1fr; height: auto; min-height: 0; }
  .tree-panel { max-height: 320px; }
  .detail-panel { min-height: 420px; }
  .meta { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
