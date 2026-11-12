import { ADMIN_MENUS, USER_MENUS, filterMenus } from './menus'

/**
 * 工作台分区：把菜单按「工作分区」重组，用于 72px 分区轨 + 顶部标签页。
 * 每个分区的 items 直接取自 filterMenus 的结果，因此权限/身份过滤与原来完全一致，
 * 只改呈现方式，不新增也不隐藏任何菜单。
 */
const ADMIN_SPEC = [
  { key: 'overview', title: '概览', icon: 'DataAnalysis', paths: ['/admin/dashboard', '/admin/enterprise'] },
  { key: 'org', title: '组织', icon: 'OfficeBuilding', paths: ['/admin/depts', '/admin/members', '/admin/resources', '/admin/roles'] },
  { key: 'billing', title: '计费', icon: 'Coin', paths: ['/admin/billing/config', '/admin/billing/approval', '/admin/billing/records'] },
  { key: 'platform', title: '平台', icon: 'UserFilled', paths: ['/admin/users', '/admin/enterprises', '/admin/app-release'] },
  { key: 'audit', title: '审计', icon: 'Document', paths: ['/admin/logs'] }
]

const USER_SPEC = [
  { key: 'files', title: '文件', icon: 'FolderOpened', paths: ['/files', '/transfers', '/recycle'] },
  { key: 'billing', title: '套餐', icon: 'Goods', paths: ['/packages', '/billing'] },
  { key: 'account', title: '账户', icon: 'User', paths: ['/profile'] }
]

function flatten(menus) {
  const out = []
  for (const m of menus) {
    if (m.children?.length) {
      for (const c of m.children) out.push({ path: c.path, title: c.title, icon: c.icon || m.icon, group: m.title })
    } else {
      out.push({ path: m.path, title: m.title, icon: m.icon })
    }
  }
  return out
}

export function buildPartitions({ side = 'user', can, identity, legacy = false }) {
  const menus = side === 'admin' ? ADMIN_MENUS : USER_MENUS
  const allowed = filterMenus(menus, can, { identity, legacy })
  const byPath = new Map(flatten(allowed).map(i => [i.path, i]))
  const spec = side === 'admin' ? ADMIN_SPEC : USER_SPEC

  return spec
    .map(p => ({
      key: p.key,
      title: p.title,
      icon: p.icon,
      items: p.paths.map(path => byPath.get(path)).filter(Boolean)
    }))
    .filter(p => p.items.length)
}

export function partitionOf(partitions, path) {
  if (!partitions.length) return null
  const hit = partitions.find(p => p.items.some(i => path === i.path || path.startsWith(i.path + '/')))
  return hit || partitions[0]
}
