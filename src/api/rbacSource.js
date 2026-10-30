/**
 * 权限配置的数据映射层（真实接口）
 *
 * 后端返回的是扁平结构和蛇形/缩写字段，页面需要的是可直接渲染的形状，
 * 这里集中做一次映射，页面不关心后端字段名。
 *
 * 已实现的后端接口：
 *   GET  /me/context
 *   GET  /org/depts/tree        → { list: [{id,parentId,name,path,status,sortNo}], total }
 *   GET  /org/roles             → [{ id, code, name, builtin, status, permissionCount }]
 *   GET  /org/permissions       → { groups: { file: [{name,code,highRisk}], ... }, total }
 *   GET  /users?keyword&status&deptId&page&size
 *   PUT  /users/{id}            → { deptId?, dataScope?, roleIds? }
 *   GET  /admin/enterprises?status&page&size
 */
import { orgApi, userApi, platformApi } from '@/api'

/* ---------------- 权限点分组的中文名（后端只给英文 key） ---------------- */
const GROUP_LABELS = {
  file: '文件',
  transfer: '传输任务',
  quota: '配额与计费',
  org: '组织与角色',
  admin_user: '用户管理',
  admin_billing: '计费管理',
  admin_audit: '审计与报表',
  release_sys: '发布与系统'
}

// 只有用户端三组可配置；组织/用户管理/计费/审计/发布系统都属于管理端，角色不可授予
const GRANTABLE_GROUPS = new Set(['file', 'transfer', 'quota'])

/** 扁平部门列表 → 树（纯渲染用途，不做任何过滤） */
function buildTree(list) {
  const nodes = list.map(d => ({ ...d, children: [] }))
  const byId = new Map(nodes.map(n => [n.id, n]))
  const roots = []
  nodes.forEach(n => {
    const parent = n.parentId != null ? byId.get(n.parentId) : null
    if (parent) parent.children.push(n)
    else roots.push(n)
  })
  return roots
}

/** 部门树 → el-cascader 结构（逐列下钻） */
function toCascader(tree) {
  return (tree || []).map(n => {
    const item = { value: n.id, label: n.name }
    const kids = toCascader(n.children)
    if (kids.length) item.children = kids
    return item
  })
}

/** 部门的完整路径（树已经带 path 字段，但它是 /1/2/ 形式，这里优先用名字拼） */
function deptOptions(tree) {
  const out = []
  const walk = (nodes, prefix) => {
    nodes.forEach(n => {
      const label = prefix ? `${prefix} / ${n.name}` : n.name
      out.push({ id: n.id, label, status: n.status })
      if (n.children?.length) walk(n.children, label)
    })
  }
  walk(tree, '')
  return out
}

export const rbacSource = {
  async depts() {
    const res = await orgApi.deptsTree()
    const list = res?.list || []
    const tree = buildTree(list)
    return { list, tree, options: deptOptions(tree), cascader: toCascader(tree), total: res?.total ?? list.length }
  },

  createDept: data => orgApi.createDept(data),
  updateDept: (id, data) => orgApi.updateDept(id, data),
  removeDept: id => orgApi.removeDept(id),

  async members(params) {
    const res = await userApi.list(params)
    const list = (res?.list || []).map(u => ({
      id: u.id,
      userId: u.id,
      username: u.username,
      nickname: u.nickname,
      enterpriseId: u.enterpriseId,
      deptId: u.deptId ?? null,
      deptName: u.deptName || '',
      enterpriseRole: u.enterpriseRole,
      // 后端已回传 RBAC 角色：roles 数组 + 兼容单角色的 roleId
      roles: Array.isArray(u.roles)
        ? u.roles.map(r => ({ id: r.id, code: r.code, name: r.name }))
        : (u.roleId != null ? [{ id: u.roleId }] : []),
      roleId: u.roleId ?? (Array.isArray(u.roles) && u.roles[0] ? u.roles[0].id : null),
      dataScope: String(u.dataScope || 'SELF').toUpperCase(),
      status: u.status,
      lastLoginAt: u.lastLoginAt
    }))
    return { list, total: res?.total ?? 0 }
  },

  /** 只提交实际变化且后端支持的字段（roleIds 不传 = 不改角色，避免覆盖） */
  updateMember: (id, data) => userApi.updateMember(id, data),


  async roles() {
    const list = await orgApi.roles()
    return (list || []).map(r => ({
      id: r.id,
      code: r.code,
      name: r.name,
      builtin: !!r.builtin,
      status: r.status,
      permissionCount: r.permissionCount ?? 0
    }))
  },

  createRole: data => orgApi.createRole(data),
  updateRole: (id, data) => orgApi.updateRole(id, data),
  removeRole: id => orgApi.removeRole(id),

  // 角色当前权限点：后端可能返回 { codes } 或 { permissions }，统一成数组
  async rolePermissions(id) {
    const data = await orgApi.rolePermissions(id)
    const codes = data?.codes || data?.permissions || []
    return Array.isArray(codes) ? codes : []
  },
  saveRolePermissions: (id, codes) => orgApi.setRolePermissions(id, codes),

  async permissions() {
    const data = await orgApi.permissions()
    const groups = Object.entries(data?.groups || {}).map(([key, items]) => ({
      key,
      label: GROUP_LABELS[key] || key,
      grantable: GRANTABLE_GROUPS.has(key),
      count: (items || []).length,
      permissions: (items || []).map(p => ({
        code: p.code,
        name: p.name,
        highRisk: !!p.highRisk,
        isPlatformOnly: !GRANTABLE_GROUPS.has(key)
      }))
    }))
    const total = data?.total ?? groups.reduce((a, g) => a + g.count, 0)
    const grantableCount = groups.filter(g => g.grantable).reduce((a, g) => a + g.count, 0)
    return { groups, total, enterpriseGrantableCount: grantableCount }
  },

  async enterprises(params) {
    const res = await platformApi.enterprises(params)
    return {
      total: res?.total ?? 0,
      // 后端返回门户字段名（enterprise_id / member_count / expire_at / created_at），两种写法都兼容
      list: (res?.list || []).map(e => ({
        id: e.id ?? e.enterprise_id ?? e.enterpriseId ?? null,
        code: e.code,
        name: e.name,
        status: e.status,
        memberCount: e.memberCount ?? e.member_count ?? null,
        ownerUserId: e.ownerUserId ?? e.owner_user_id ?? null,
        expireAt: e.expireAt ?? e.expire_at ?? null,
        createdAt: e.createdAt ?? e.created_at ?? null
      }))
    }
  },

}
