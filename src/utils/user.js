/**
 * 人员展示名：有 nickname 用 nickname，没有就用 username 原值
 * （后端返回什么就展示什么，不做 portal_ 之类的额外包装）
 */
export function displayName(user) {
  if (!user) return '--'
  return user.nickname || user.username || '--'
}

/** 账号列 */
export function accountOf(user) {
  return user?.username || ''
}