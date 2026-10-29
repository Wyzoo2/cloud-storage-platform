import { createRouter, createWebHistory } from 'vue-router'
import { usePermissionStore } from '@/stores/permission'
import { landingPath, HOME_PATHS } from '@/utils/landing'
import { FILE_SIDE_PERMS, ADMIN_SIDE_PERMS } from '@/constants/menus'

// meta.perm 声明该路由需要的权限点（数组=任一命中）；守卫按 /me/context 的 perms 判定
const routes = [
  { path: '/login', name: 'Login', component: () => import('@/views/login/LoginView.vue'), meta: { requiresAuth: false } },
  { path: '/forbidden', name: 'Forbidden', component: () => import('@/views/error/Forbidden.vue'), meta: { title: '无权访问' } },
  {
    path: '/', component: () => import('@/layouts/UserLayout.vue'), meta: { requiresAuth: true }, redirect: '/files',
    children: [
      { path: 'files', name: 'FileList', component: () => import('@/views/user/FileList.vue'), meta: { title: '我的文件', perm: FILE_SIDE_PERMS } },
      { path: 'transfers', name: 'Transfers', component: () => import('@/views/user/Transfers.vue'), meta: { title: '传输任务', perm: 'transfer.read' } },
      { path: 'recycle', name: 'RecycleBin', component: () => import('@/views/user/RecycleBin.vue'), meta: { title: '回收站', perm: 'recycle.read' } },
      { path: 'billing', name: 'BillingIncrease', component: () => import('@/views/user/BillingIncrease.vue'), meta: { title: '增额申请', perm: ['increase.apply', 'increase.read'] } },
      // 个人中心不做权限点限制：所有能登录的人都能看自己的资料/改密码
      { path: 'profile', name: 'PersonalCenter', component: () => import('@/views/user/PersonalCenter.vue'), meta: { title: '个人中心' } }
    ]
  },
  {
    path: '/admin', component: () => import('@/layouts/AdminLayout.vue'), meta: { requiresAuth: true }, redirect: '/admin/dashboard',
    children: [
      { path: 'dashboard', name: 'Dashboard', component: () => import('@/views/admin/Dashboard.vue'), meta: { title: '统计大盘', perm: 'admin.dashboard.read', scope: 'both' } },
      // 企业列表（平台视角，仅系统管理员）
      { path: 'enterprises', name: 'EnterpriseList', component: () => import('@/views/admin/EnterpriseList.vue'), meta: { title: '企业列表', perm: 'admin.user.read', scope: 'platform' } },
      // 用户管理（账号维度，走现有 /admin/users）
      { path: 'users', name: 'UserManagement', component: () => import('@/views/admin/UserManagement.vue'), meta: { title: '用户管理', perm: 'admin.user.read', scope: 'platform' } },
      // 企业详情（企业管理员视角：本企业的资料与用量）
      { path: 'enterprise', name: 'EnterpriseDetail', component: () => import('@/views/admin/EnterpriseDetail.vue'), meta: { title: '企业详情', perm: ADMIN_SIDE_PERMS, scope: 'enterprise' } },

      // 部门管理（组织架构的增删改与部门成员）
      { path: 'depts', name: 'DeptManagement', component: () => import('@/views/admin/DeptManagement.vue'), meta: { title: '部门管理', perm: 'org.dept.read', scope: 'enterprise' } },
      // 部门成员管理（成员列表 + 角色/数据权限分配）
      { path: 'members', name: 'MemberManagement', component: () => import('@/views/admin/MemberManagement.vue'), meta: { title: '部门成员管理', perm: 'org.member.read', scope: 'enterprise' } },
      { path: 'roles', name: 'RoleManagement', component: () => import('@/views/admin/RoleManagement.vue'), meta: { title: '角色管理', perm: 'role.read', scope: 'enterprise' } },
      { path: 'logs', name: 'AuditLog', component: () => import('@/views/admin/AuditLog.vue'), meta: { title: '审计日志', perm: 'admin.audit.read', scope: 'both' } },
      { path: 'billing/config', name: 'BillingConfig', component: () => import('@/views/admin/BillingConfig.vue'), meta: { title: '计费配置', perm: 'admin.billing.read', scope: 'platform' } },
      { path: 'billing/approval', name: 'BillingApproval', component: () => import('@/views/admin/BillingApproval.vue'), meta: { title: '增额审批', perm: 'admin.increase.read', scope: 'platform' } },
      { path: 'billing/records', name: 'BillingRecords', component: () => import('@/views/admin/BillingRecords.vue'), meta: { title: '缴费台账', perm: 'admin.ledger.read', scope: 'platform' } },
      { path: 'app-release', name: 'AppRelease', component: () => import('@/views/admin/AppRelease.vue'), meta: { title: '版本发布', perm: 'admin.release.read', scope: 'platform' } }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/login' }
]

// base 与 vite 的 base 一致；桌面端保持原来的根 base
const ROUTER_BASE = import.meta.env.MODE === 'desktop' ? '/' : import.meta.env.BASE_URL

const router = createRouter({ history: createWebHistory(ROUTER_BASE), routes })

router.beforeEach(async to => {
  if (to.meta.requiresAuth === false) return true

  const token = localStorage.getItem('cs-token')
  if (!token) {
    return { path: '/login', query: to.fullPath && to.fullPath !== '/' ? { redirect: to.fullPath } : {} }
  }

  const perm = usePermissionStore()
  if (!perm.loaded) await perm.load()

  // 后端还没上线 /me/context（legacy）：沿用旧的角色判断，避免把现有用户锁在门外
  if (perm.legacy) {
    const userRole = localStorage.getItem('cs-role')
    if (to.path.startsWith('/admin') && userRole !== 'admin') return { path: '/files' }
    return true
  }

  // 默认首页（/files、/admin/dashboard）访问不了时，直接去「本账号真正的落地页」，避免 403 闪烁
  if (HOME_PATHS.has(to.path) && to.meta.perm && !perm.can(to.meta.perm)) {
    const target = landingPath(perm)
    if (target && target !== to.path) return { path: target }
  }

  // 身份不匹配（系统管理员 / 企业管理员）→ 403 页
  if (to.meta.scope && to.meta.scope !== 'both' && to.meta.scope !== perm.identity) {
    return { path: '/forbidden', query: { from: to.fullPath } }
  }

  // 有权限点要求但不具备 → 403 页（后端仍会二次拦截，见接口文档 §5.1 40301）
  if (to.meta.perm && !perm.can(to.meta.perm)) {
    return { path: '/forbidden', query: { from: to.fullPath } }
  }

  // 完全没有权限点的账号（无角色）：只能登录，统一落到 403 说明页
  // 个人中心不设权限点：任何能登录的账号都应能改自己的密码/看自己的资料
  if (!to.meta.perm && to.path !== '/profile' && to.path !== '/forbidden' && perm.perms.length === 0) {
    return { path: '/forbidden', query: { from: to.fullPath } }
  }

  return true
})

export default router
