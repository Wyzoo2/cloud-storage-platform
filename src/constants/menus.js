/**
 * 菜单定义（前端映射，后端不提供菜单接口）
 *
 * 依据：接口文档 v1.1 §4.1 —— GET /me/context 的 perms 是「菜单/按钮显隐的唯一依据」。
 *
 * 每个菜单三个维度：
 *   perm      需要的权限点（数组=任一命中）
 *   scope     身份归属：platform=系统管理员、enterprise=企业管理员、both=两者都有
 *   needsRbac 依赖 RBAC 新接口；legacy 降级（后端未上线）时隐藏
 *
 * 身份来源：permission store 的 identity —— 真实环境取 /me/context.isPlatform；
 * 当前后端未上线权限接口，用「演示身份」开关切换（存 localStorage）。
 */

// ===== 权限分组常量（菜单过滤用，必须定义在菜单之前）=====
// 管理员侧权限（企业管理员身份自带）：任意一项即可进入管理端企业相关页
export const ADMIN_SIDE_PERMS = [
  'org.dept.read', 'org.dept.manage',
  'org.member.read', 'org.member.manage', 'org.member.resource',
  'role.read', 'role.manage',
  'admin.audit.read', 'admin.audit.export',
  'admin.dashboard.read', 'admin.dashboard.export'
]

export const ADMIN_MENUS = [
  // ===== 企业管理员：企业详情置顶 =====
  { path: '/admin/enterprise', title: '企业详情', icon: 'OfficeBuilding', perm: ADMIN_SIDE_PERMS, scope: 'enterprise' },

  // ===== 两者都有 =====
  { path: '/admin/dashboard', title: '统计大盘', icon: 'DataAnalysis', perm: 'admin.dashboard.read', scope: 'both' },
  {
    path: 'admin-billing',
    title: '计费管理',
    icon: 'Wallet',
    scope: 'platform',
    children: [
      { path: '/admin/billing/config', title: '计费配置', perm: 'admin.billing.read', scope: 'platform' },
      { path: '/admin/billing/approval', title: '增额审批', perm: 'admin.increase.read', scope: 'platform' },
      { path: '/admin/billing/records', title: '缴费台账', perm: 'admin.ledger.read', scope: 'platform' }
    ]
  },

  // ===== 仅系统管理员（平台级）=====
  { path: '/admin/users', title: '用户管理', icon: 'UserFilled', perm: 'admin.user.read', scope: 'platform' },
  { path: '/admin/enterprises', title: '企业列表', icon: 'OfficeBuilding', perm: 'admin.user.read', scope: 'platform' },
  { path: '/admin/app-release', title: '版本发布', icon: 'Upload', perm: 'admin.release.read', scope: 'platform' },

  // ===== 仅企业管理员（企业管理）=====
  { path: '/admin/depts', title: '部门管理', icon: 'OfficeBuilding', perm: 'org.dept.read', scope: 'enterprise' },
  { path: '/admin/members', title: '部门成员管理', icon: 'User', perm: 'org.member.read', scope: 'enterprise' },
  { path: '/admin/roles', title: '角色管理', icon: 'Key', perm: 'role.read', scope: 'enterprise' },

  // ===== 审计日志置底 =====
  { path: '/admin/logs', title: '审计日志', icon: 'Document', perm: 'admin.audit.read', scope: 'both' }
]


export const USER_MENUS = [
  { path: '/files', title: '我的文件', icon: 'FolderOpened', perm: 'file.read', scope: 'both' },
  { path: '/transfers', title: '传输任务', icon: 'Upload', perm: 'transfer.read', scope: 'both' },
  { path: '/recycle', title: '回收站', icon: 'Delete', perm: 'recycle.read', scope: 'both' },
  { path: '/billing', title: '增额申请', icon: 'Wallet', perm: ['increase.apply', 'increase.read'], scope: 'both' },
  { path: '/profile', title: '个人中心', icon: 'User', scope: 'both' }
]

/**
 * 按「权限点 + 身份」过滤菜单（纯函数，便于自测）
 * @param {Array} menus 菜单定义
 * @param {(perm?: any) => boolean} can 权限判定
 * @param {{identity?: 'platform'|'enterprise'}} opts
 */
export function filterMenus(menus, can, opts = {}) {
  const identity = opts?.identity || 'platform'
  const allowByScope = item => !item.scope || item.scope === 'both' || item.scope === identity

  return (menus || [])
    .map(m => (m.children ? { ...m, children: m.children.filter(c => allowByScope(c) && can(c.perm)) } : m))
    .filter(m => {
      if (!allowByScope(m)) return false
      if (m.children) return m.children.length > 0
      return can(m.perm)
    })
}

/** 数据权限四档的展示文案（PLATFORM 仅平台成员，企业成员不可设置） */
export const DATA_SCOPES = [
  { value: 'SELF', label: '仅个人', desc: '只能看自己名下的数据' },
  { value: 'DEPT', label: '本人及部门', desc: '本人 + 本部门同事（不含子部门）' },
  { value: 'DEPT_BELOW', label: '本人和本人部门以下', desc: '本人 + 子部门（不含本部门同事）' },
  { value: 'DEPT_AND_BELOW', label: '本人及本部门以下所有部门', desc: '本人 + 本部门 + 所有子部门' },
  { value: 'ALL', label: '全公司', desc: '本企业全部成员' }
]

/** 平台成员（系统管理员）专用的一档，企业侧不展示 */
const DATA_SCOPE_PLATFORM = { value: 'PLATFORM', label: '全平台', desc: '跨企业，全部数据' }

export function scopeLabel(value) {
  // 后端实际返回的是小写（实测 /admin/users 的 dataScope 为 "self"），这里统一按大写匹配
  const key = String(value || '').toUpperCase()
  const all = [...DATA_SCOPES, DATA_SCOPE_PLATFORM]
  const hit = all.find(s => s.value === key)
  return hit ? hit.label : (value || '-')
}
