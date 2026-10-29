/**
 * 权限上下文 store（真实接口）
 *
 * 数据来源：GET /me/context。实测字段：
 *   { userId, username, role, enterprise, enterpriseId,
 *     isEnterpriseAdmin, isPlatformAdmin, roles[], dataScope, permissions[] }
 *
 * 注意后端用的是 permissions / isPlatformAdmin 命名（与设计文档的 perms / isPlatform 不同）。
 * 接口不可用时（网络异常等）降级为 legacy=放行，避免整站不可用。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const CACHE_KEY = 'cs-perm-ctx'

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
  } catch {
    return null
  }
}

export const usePermissionStore = defineStore('permission', () => {
  const ctx = ref(readCache())
  const loaded = ref(false)
  const loading = ref(false)
  const legacy = ref(false)

  const perms = computed(() => ctx.value?.permissions || [])
  // 登录响应里的 scope 作为身份兜底（/me/context 字段缺失时使用）
  function loginScope() {
    try { return localStorage.getItem('cs-scope') || '' } catch { return '' }
  }
  const isPlatform = computed(() =>
    ctx.value?.isPlatformAdmin != null ? !!ctx.value.isPlatformAdmin : loginScope() === 'platform'
  )
  // enterpriseRole 是枚举：1 = 企业管理员（不是角色 id，角色看 roles[]）
  const isEnterpriseAdmin = computed(() => {
    if (Number(ctx.value?.enterpriseRole || 0) === 1) return true
    if (ctx.value?.isEnterpriseAdmin != null) return !!ctx.value.isEnterpriseAdmin
    return loginScope() === 'enterprise'
  })
  const identity = computed(() => (isPlatform.value ? 'platform' : 'enterprise'))
  // 界面上展示的账号身份：平台/企业管理员，普通成员显示角色名
  const identityLabel = computed(() => {
    if (isPlatform.value) return '系统管理员'
    if (isEnterpriseAdmin.value) return '企业管理员'
    return roles.value?.[0]?.name || '成员'
  })
  const dataScope = computed(() => ctx.value?.dataScope || 'SELF')
  const enterpriseId = computed(() => ctx.value?.enterpriseId ?? null)
  const enterpriseName = computed(() => ctx.value?.enterprise?.name || ctx.value?.enterpriseName || '')
  const deptPath = computed(() => ctx.value?.deptPath || '')
  const nickname = computed(() => ctx.value?.nickname || '')
  const roles = computed(() => ctx.value?.roles || [])

  function can(code) {
    if (!code) return true
    const codes = Array.isArray(code) ? code : [code]
    if (legacy.value || !loaded.value) return true
    return codes.some(c => perms.value.includes(c))
  }

  async function load(force = false) {
    if (loading.value) return
    if (loaded.value && !force) return
    loading.value = true
    try {
      const { meApi } = await import('@/api')
      const data = await meApi.context()
      ctx.value = data || {}
      legacy.value = false
      localStorage.setItem(CACHE_KEY, JSON.stringify(ctx.value))
    } catch (e) {
      legacy.value = true
    } finally {
      loaded.value = true
      loading.value = false
    }
  }

  function reset() {
    ctx.value = null
    loaded.value = false
    legacy.value = false
    localStorage.removeItem(CACHE_KEY)
  }

  return {
    ctx, loaded, loading, legacy, perms,
    isPlatform, isEnterpriseAdmin, identity, identityLabel, dataScope, enterpriseId, enterpriseName, deptPath, nickname, roles,
    can, load, reset
  }
})
