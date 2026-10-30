<template>
  <div class="cs-page">
    <div class="breadcrumb-bar">
      <div class="page-head-left"><h2 class="page-title"><el-icon><Key /></el-icon>角色管理</h2>
      </div>
      <div class="head-actions">
        <el-button v-perm="'role.manage'" @click="openRoleDialog()">
          <el-icon><Plus /></el-icon>新建角色
        </el-button>
        <el-button v-perm="'role.manage'" type="primary" :disabled="!current || !dirty" :loading="saving" @click="save">
          <el-icon><Check /></el-icon>保存权限
        </el-button>
      </div>
    </div>

    <div class="split">
      <!-- 左栏：角色列表 -->
      <aside class="cs-card side-panel">
        <div class="side-head">
          <span>角色</span>
          <span class="side-count">{{ roles.length }} 个</span>
        </div>
        <div class="side-body" v-loading="rolesLoading">
          <div
            v-for="r in roles"
            :key="r.id"
            class="role-item"
            :class="{ active: current?.id === r.id }"
            @click="select(r)"
          >
            <div class="role-name-line">
              <span class="role-name">{{ r.name }}</span>
              <el-tag v-if="r.builtin" size="small" type="info" effect="plain">内置</el-tag>
            </div>
            <div class="role-sub">{{ r.permissionCount }} 项权限 · {{ r.code }}</div>
          </div>
          <el-empty v-if="!roles.length && !rolesLoading" description="暂无角色" :image-size="60" />
        </div>
      </aside>

      <!-- 右栏：权限矩阵 -->
      <main class="cs-card main-panel" v-loading="permLoading">
        <div class="detail-head">
          <template v-if="current">
            <span class="detail-name">{{ current.name }}</span>
            <el-tag size="small" effect="plain" class="code-chip">{{ current.code }}</el-tag>
            <el-tag size="small" :type="current.status === 'disabled' ? 'danger' : 'success'">
              {{ current.status === 'disabled' ? '停用' : '启用' }}
            </el-tag>
            <span class="detail-sub">已选 {{ draft.length }} 项</span>
          </template>
          <span v-else class="detail-sub">选择左侧角色</span>
          <div class="detail-actions">
            <el-button v-perm="'role.manage'" link :disabled="!current" @click="openRoleDialog(current)">改名</el-button>
            <el-button v-perm="'role.manage'" link type="danger" :disabled="!current" @click="handleRemoveRole">删除</el-button>
            <el-button link :disabled="!dirty" @click="resetDraft">还原</el-button>
            <el-button link @click="checkAll" :disabled="!current">全选可用项</el-button>
            <el-button link @click="clearAll" :disabled="!current">清空</el-button>
          </div>
        </div>

        <div class="detail-body">
          <div class="matrix-progress">
            <i :style="{ width: (grantableCount ? Math.round(grantableSelected / grantableCount * 100) : 0) + '%' }"></i>
          </div>
          <div class="matrix-meta">
            <span>可分配给员工 {{ grantableCount }} 项</span>
            <span v-if="dirty" class="dirty-hint">有未保存的改动</span>
          </div>

          <div v-for="g in visibleGroups" :key="g.key" class="perm-group">
            <div class="perm-group-head">
              {{ g.label }}
              <span class="group-count">{{ draft.filter(c => g.permissions.some(p => p.code === c)).length }} / {{ g.count }}</span>
            </div>
            <div class="perm-group-body">
              <label
                v-for="p in g.permissions"
                :key="p.code"
                class="perm-item"
                :class="{ on: draft.includes(p.code), locked: isLocked(p) }"
              >
                <el-checkbox
                  :model-value="draft.includes(p.code)"
                  :disabled="isLocked(p)"
                  @change="v => toggle(p.code, v)"
                />
                <span class="perm-name">{{ p.name }}</span>
                <el-tag v-if="p.highRisk" size="small" type="danger" effect="plain" class="risk-tag">高风险</el-tag>
              </label>
            </div>
          </div>
          <el-empty v-if="!visibleGroups.length" description="权限字典为空" :image-size="70" />
        </div>
      </main>
    </div>    <!-- 新建 / 编辑角色 -->
    <el-dialog v-model="roleDialog" :title="roleForm.id ? '编辑角色' : '新建角色'" width="min(440px, 94vw)" destroy-on-close>
      <el-form label-width="80px">
        <el-form-item label="角色名称" required>
          <el-input v-model="roleForm.name" maxlength="32" show-word-limit placeholder="如：部门管理员" />
        </el-form-item>
        <el-form-item label="角色编码" required>
          <el-input v-model="roleForm.code" maxlength="48" :disabled="!!roleForm.id" placeholder="如：dept_admin" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="roleDialog = false">取消</el-button>
        <el-button type="primary" :loading="roleSaving" @click="saveRole">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check, Plus } from '@element-plus/icons-vue'
import { rbacSource } from '@/api/rbacSource'
import { usePermissionStore } from '@/stores/permission'

const perm = usePermissionStore()
const roles = ref([])
const rolesLoading = ref(false)
const current = ref(null)

const dict = ref({ groups: [], total: 0, enterpriseGrantableCount: 0 })
const draft = ref([])          // 当前勾选的权限点
const original = ref([])       // 载入时的快照（用于「还原」与脏检查）
const permLoading = ref(false)
const saving = ref(false)

const dirty = computed(() => {
  const a = [...draft.value].sort().join(',')
  const b = [...original.value].sort().join(',')
  return a !== b
})

// 管理端权限点（组织 / 用户管理 / 计费 / 审计 / 发布系统）一律不可配置，只随角色原样保留
const isLocked = p => !!p.isPlatformOnly

// 只展示可分配给员工的权限组；管理端权限点属于企业管理员身份，不在此配置
const visibleGroups = computed(() => dict.value.groups.filter(g => g.grantable))
const allPerms = computed(() => dict.value.groups.flatMap(g => g.permissions))
const lockedCodes = computed(() => new Set(allPerms.value.filter(isLocked).map(p => p.code)))
const grantableCount = computed(() => allPerms.value.filter(p => !isLocked(p)).length)
const grantableSelected = computed(() => draft.value.filter(c => !lockedCodes.value.has(c)).length)

/* ---------- 新建 / 改名 / 删除角色 ---------- */
const roleDialog = ref(false)
const roleSaving = ref(false)
const roleForm = ref({ id: null, code: '', name: '' })

function openRoleDialog(role) {
  roleForm.value = role
    ? { id: role.id, code: role.code || '', name: role.name || '' }
    : { id: null, code: '', name: '' }
  roleDialog.value = true
}

async function saveRole() {
  const { id, code, name } = roleForm.value
  if (!name.trim()) return ElMessage.warning('请输入角色名称')
  if (!code.trim()) return ElMessage.warning('请输入角色编码')
  if (!id && !/^[a-z0-9_]{1,48}$/.test(code.trim())) return ElMessage.warning('角色编码只能是小写字母、数字、下划线（1-48 位）')
  roleSaving.value = true
  try {
    if (id) {
      // 后端约定：只能改名，code 建后不可改
      await rbacSource.updateRole(id, { name: name.trim() })
      ElMessage.success('角色已更新')
    } else {
      await rbacSource.createRole({ code: code.trim(), name: name.trim() })
      ElMessage.success('角色已创建')
    }
    roleDialog.value = false
    await loadRoles()
    // 新建后自动选中，方便紧接着勾权限
    if (!id) {
      const created = roles.value.find(r => r.code === code.trim())
      if (created) {
        current.value = created
        await loadPerms(created.id)
      }
    }
  } catch (e) {
    // 拦截器已提示（重名/编码冲突等）
  } finally {
    roleSaving.value = false
  }
}

async function handleRemoveRole() {
  const role = current.value
  if (!role) return
  const ok = await ElMessageBox.confirm(`确定删除角色「${role.name}」？该角色下的成员会失去它的权限。`, '删除角色', {
    type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消'
  }).catch(() => false)
  if (!ok) return
  try {
    await rbacSource.removeRole(role.id)
    ElMessage.success('角色已删除')
    current.value = null
    original.value = []
    draft.value = []
    await loadRoles()
  } catch (e) {
    // 内置角色等不可删除时后端会返回业务错误
  }
}

async function loadRoles() {
  rolesLoading.value = true
  try {
    roles.value = await rbacSource.roles()
    const hit = current.value ? roles.value.find(r => r.id === current.value.id) : null
    current.value = hit || roles.value[0] || null
    if (current.value) await loadPerms(current.value.id)
  } catch (e) {
    roles.value = []
  } finally {
    rolesLoading.value = false
  }
}

async function loadPerms(roleId) {
  permLoading.value = true
  try {
    const codes = await rbacSource.rolePermissions(roleId)
    original.value = [...codes]
    draft.value = [...codes]
  } catch (e) {
    original.value = []
    draft.value = []
  } finally {
    permLoading.value = false
  }
}

async function select(role) {
  if (role.id === current.value?.id) return
  if (dirty.value) {
    const ok = await ElMessageBox.confirm('当前角色有未保存的权限改动，切换后丢失，继续？', '切换角色', {
      type: 'warning', confirmButtonText: '继续切换', cancelButtonText: '留在当前'
    }).catch(() => false)
    if (!ok) return
  }
  current.value = role
  await loadPerms(role.id)
}

function toggle(code, checked) {
  if (checked) {
    if (!draft.value.includes(code)) draft.value = [...draft.value, code]
  } else {
    draft.value = draft.value.filter(c => c !== code)
  }
}

function resetDraft() {
  draft.value = [...original.value]
}

function checkAll() {
  const grantable = allPerms.value.filter(p => !isLocked(p)).map(p => p.code)
  // 管理端权限点不可勾选，但原先已有的必须原样保留
  const keepLocked = draft.value.filter(c => lockedCodes.value.has(c))
  draft.value = [...new Set([...keepLocked, ...grantable])]
}

function clearAll() {
  // 只清可配置项，管理端权限点保持原样
  draft.value = draft.value.filter(c => lockedCodes.value.has(c))
}

async function save() {
  if (!current.value) return
  saving.value = true
  try {
    await rbacSource.saveRolePermissions(current.value.id, draft.value)
    // 权限每次请求实时校验：主动刷新自己的上下文，改到自己所在角色时菜单立即生效
    await perm.load(true)
    original.value = [...draft.value]
    ElMessage.success('权限已保存')
    // 列表里的「N 项权限」随之刷新
    const updated = await rbacSource.roles()
    roles.value = updated
    const hit = updated.find(r => r.id === current.value.id)
    if (hit) current.value = hit
  } catch (e) {
    // 40301 / 409xx 由拦截器提示
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    dict.value = await rbacSource.permissions()
  } catch (e) {
    dict.value = { groups: [], total: 0, enterpriseGrantableCount: 0 }
  }
  await loadRoles()
})
</script>

<style scoped>
.breadcrumb-bar { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 14px; }
.page-head-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.head-actions { display: flex; gap: 8px; }
.page-title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 17px; font-weight: 600; letter-spacing: .2px; color: var(--cs-text-primary); }

.split { display: grid; grid-template-columns: 264px minmax(0, 1fr); gap: 14px; align-items: stretch; height: calc(100vh - 216px); min-height: 460px; }
.side-panel { padding: 0; display: flex; flex-direction: column; overflow: hidden; border-radius: var(--cs-radius-lg); box-shadow: var(--cs-shadow-sm); }
.side-head { display: flex; align-items: center; gap: 8px; padding: 11px 14px; flex: none;
  border-bottom: 1px solid var(--cs-border-light); font-size: 13px; font-weight: 600; color: var(--cs-text-primary); }
.side-count { margin-left: auto; font-weight: 400; font-size: 11px; color: var(--cs-text-tertiary); background: var(--cs-bg-page); border-radius: 999px; padding: 1px 7px; }
.side-body { padding: 8px; overflow: auto; flex: 1; min-height: 0; }

.role-item { padding: 10px 12px; border-radius: var(--cs-radius); cursor: pointer; margin-bottom: 4px;
  border: 1px solid transparent; transition: background var(--cs-transition), border-color var(--cs-transition); }
.role-item:hover { background: var(--cs-bg-hover); }
.role-item.active { background: var(--cs-primary-lighter); border-color: var(--cs-primary-light); }
.role-name-line { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--cs-text-primary); }
.role-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.role-sub { font-size: 11.5px; color: var(--cs-text-tertiary); margin-top: 4px; }

.main-panel { padding: 0; display: flex; flex-direction: column; overflow: hidden; border-radius: var(--cs-radius-lg); box-shadow: var(--cs-shadow-sm); }
.detail-head { display: flex; align-items: center; gap: 8px; padding: 12px 16px; flex: none; flex-wrap: wrap;
  border-bottom: 1px solid var(--cs-border-light); }
.detail-name { font-size: 15px; font-weight: 700; color: var(--cs-text-primary); }
.code-chip { font-family: Consolas, monospace; }
.detail-sub { font-size: 12px; color: var(--cs-text-tertiary); }
.detail-actions { margin-left: auto; display: flex; gap: 6px; }
.detail-actions .el-button { margin-left: 0; }
.detail-body { padding: 14px 16px 18px; flex: 1; min-height: 0; overflow: auto; }

.matrix-progress { height: 4px; border-radius: 999px; background: var(--cs-bg-page); overflow: hidden; }
.matrix-progress > i { display: block; height: 100%; border-radius: 999px;
  background: linear-gradient(90deg, var(--cs-primary-light), var(--cs-primary)); transition: width var(--cs-transition); }
.matrix-meta { display: flex; align-items: center; gap: 10px; margin: 8px 0 14px; font-size: 12px; color: var(--cs-text-tertiary); }
.dirty-hint { margin-left: auto; color: var(--cs-warning); }

.perm-group { border: 1px solid var(--cs-border-light); border-radius: var(--cs-radius); margin-bottom: 10px; overflow: hidden; background: var(--cs-bg-container); }
.perm-group-head { display: flex; align-items: center; gap: 6px; padding: 9px 12px; font-size: 12px; font-weight: 600; color: var(--cs-text-primary);
  background: var(--cs-bg-page); border-bottom: 1px solid var(--cs-border-light); }
.group-count { margin-left: auto; font-weight: 400; color: var(--cs-text-tertiary); font-size: 11px; font-variant-numeric: tabular-nums; }
.perm-group-body { padding: 8px 10px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2px 10px; }
.perm-item { display: flex; align-items: center; gap: 6px; padding: 5px 8px; border-radius: var(--cs-radius-sm); cursor: pointer;
  font-size: 12.5px; color: var(--cs-text-secondary); transition: background var(--cs-transition), color var(--cs-transition); }
.perm-item:hover { background: var(--cs-bg-hover); }
.perm-item.on { color: var(--cs-text-primary); background: var(--cs-primary-lighter); }
.perm-item.locked { cursor: not-allowed; color: var(--cs-text-disabled); background: transparent; }
.perm-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.risk-tag { transform: scale(.85); transform-origin: left center; }

@media (max-width: 1080px) {
  .split { grid-template-columns: 1fr; height: auto; min-height: 0; }
  .side-panel { max-height: 320px; }
  .main-panel { min-height: 420px; }
  .perm-group-body { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 720px) {
  .perm-group-body { grid-template-columns: 1fr; }
  .detail-actions { margin-left: 0; width: 100%; }
}
</style>
