/**
 * 登录后 / 回首页时该去哪个路由
 *
 * 规则：按「登录入口 + 身份」定优先级，再取第一个有权限点、且身份匹配的菜单地址。
 *   prefer=admin  → 管理端优先（从"管理端"标签登录）
 *   prefer=user   → 用户端优先（从"用户端"标签登录）
 *   不传          → 系统管理员/企业管理员管理端优先，普通成员我的文件优先
 * 没有任何可用菜单时落到个人中心（可改密码），而不是反复弹 403。
 */
import { ADMIN_MENUS, USER_MENUS, filterMenus } from '../constants/menus.js'

const flatten = menus => menus.flatMap(m => (m.children ? m.children.map(c => c.path) : [m.path]))

export function landingPath(perm, { prefer } = {}) {
  const identity = perm.identity
  const adminPaths = flatten(filterMenus(ADMIN_MENUS, perm.can, { identity }))
  const userPaths = flatten(filterMenus(USER_MENUS, perm.can, { identity }))

  let ordered
  if (prefer === 'admin') ordered = [...adminPaths, ...userPaths]
  else if (prefer === 'user') ordered = [...userPaths, ...adminPaths]
  else {
    const preferAdmin = perm.isPlatform || perm.isEnterpriseAdmin
    ordered = preferAdmin ? [...adminPaths, ...userPaths] : [...userPaths, ...adminPaths]
  }
  return ordered[0] || '/profile'
}

/** 默认落地页（根路径、"/" 重定向用） */
export const HOME_PATHS = new Set(['/files', '/admin/dashboard'])