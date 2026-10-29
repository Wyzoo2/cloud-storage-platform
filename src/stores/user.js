import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { authApi } from '@/api'
import { displayName as pickDisplayName } from '@/utils/user'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('cs-token') || '')
  const username = ref(localStorage.getItem('cs-username') || '')
  // 展示名：门户用户的 username 是 portal_<uuid>，真实名称在 nickname 里
  const nickname = ref(localStorage.getItem('cs-nickname') || '')
  const role = ref(localStorage.getItem('cs-role') || 'user')
  const userId = ref(localStorage.getItem('cs-user-id') || '')
  // 登录响应新增的菜单域：platform / enterprise / null
  const scope = ref(localStorage.getItem('cs-scope') || '')
  const savedQuota = localStorage.getItem('cs-quota')
  const quota = ref(savedQuota ? JSON.parse(savedQuota) : { used: 0, total: 0 })
  // 强制改密标志：后端 mustChangePassword 为 true（新账号初始密码 / 管理员重置密码后）时布局层弹出不可关闭的改密弹框，false 不拦截
  const mustChangePwd = ref(localStorage.getItem('cs-must-change-pwd') === '1')

  const displayName = computed(() => pickDisplayName({ id: userId.value, username: username.value, nickname: nickname.value }))

  function setNickname(v) {
    nickname.value = v || ''
    localStorage.setItem('cs-nickname', nickname.value)
  }

  function setMustChangeFlag(v) {
    mustChangePwd.value = !!v
    localStorage.setItem('cs-must-change-pwd', v ? '1' : '0')
  }

  // data: { accessToken, refreshToken, user: { id, username, role, quotaBytes, usedBytes, mustChangePassword } }
  function login(data) {
    const u = data.user || {}
    token.value = data.accessToken || ''
    username.value = u.username || ''
    setNickname(u.nickname || '')
    role.value = u.role || 'user'
    userId.value = u.id != null ? String(u.id) : ''
    quota.value = { used: u.usedBytes || 0, total: u.quotaBytes || 0 }
    localStorage.setItem('cs-quota', JSON.stringify(quota.value))
    localStorage.setItem('cs-token', data.accessToken || '')
    localStorage.setItem('cs-refresh-token', data.refreshToken || '')
    localStorage.setItem('cs-username', u.username || '')
    localStorage.setItem('cs-role', u.role || 'user')
    scope.value = u.scope || ''
    localStorage.setItem('cs-scope', scope.value)
    if (u.id != null) localStorage.setItem('cs-user-id', String(u.id))
    setMustChangeFlag(!!u.mustChangePassword)
    // 通知根组件（App.vue）做一次桌面端自动更新检查
    document.dispatchEvent(new CustomEvent('app:logged-in'))
  }

  // 从 /auth/profile 刷新配额与强制改密标志（后端实测返回 { id, username, role, quotaBytes, usedBytes, mustChangePassword }）
  async function loadProfile() {
    const p = await authApi.profile()
    if (!p) return
    username.value = p.username || username.value
    if (p.nickname != null) setNickname(p.nickname)
    role.value = p.role || role.value
    userId.value = p.id != null ? String(p.id) : userId.value
    quota.value = { used: p.usedBytes || 0, total: p.quotaBytes || 0 }
    localStorage.setItem('cs-quota', JSON.stringify(quota.value))
    if (p.mustChangePassword != null) setMustChangeFlag(!!p.mustChangePassword)
  }

  function logout() {
    authApi.logout().catch(() => {})
    token.value = ''; username.value = ''; nickname.value = ''; role.value = 'user'; userId.value = ''
    quota.value = { used: 0, total: 0 }
    mustChangePwd.value = false
    ;['cs-token', 'cs-refresh-token', 'cs-user-id', 'cs-username', 'cs-role', 'cs-must-change-pwd', 'cs-quota', 'cs-nickname', 'cs-perm-ctx'].forEach(k => localStorage.removeItem(k))
  }

  return { token, username, nickname, displayName, role, userId, quota, mustChangePwd, login, logout, loadProfile, setMustChangeFlag }
})
