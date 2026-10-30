import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'

// 桌面端打包注入 VITE_API_BASE（绝对地址直连后端）；Web 端保持 /api 走代理
const baseURL = import.meta.env.VITE_API_BASE || '/api'
const request = axios.create({ baseURL, timeout: 30000 })

// 请求拦截：注入认证头（后端从 Bearer token 解析当前用户，无需再传 X-User-Id / X-User-Role）
request.interceptors.request.use(config => {
  const token = localStorage.getItem('cs-token')
  if (token) config.headers.Authorization = 'Bearer ' + token
  return config
})

const CLEAR_KEYS = ['cs-token', 'cs-refresh-token', 'cs-user-id', 'cs-username', 'cs-role', 'cs-quota', 'cs-must-change-pwd', 'cs-perm-ctx']

let refreshing = false

/**
 * 错误码矩阵（接口文档 §五）
 *   40001 未登录/令牌无效 → 直接去登录
 *   40103 登录态已不可用（过期 / 成员停用 / 企业停用）→ 先刷新，失败再去登录
 *   40301 已登录但缺权限点 → 提示 + 刷新一次权限上下文（权限是实时生效的）
 *   40101 用户名或密码错误（message 带剩余次数）/ 42301 账号已锁定（带剩余分钟）/
 *   42902 登录过于频繁（带剩余秒数）→ 原样提示，**不刷新令牌、不跳登录页**
 *   其余（409xx / 42101 / 50000 …）→ 原样展示后端 message，不按 code 猜语义
 */
const LOGIN_ERRORS = {
  40101: '用户名或密码错误',
  42301: '账号已锁定，请稍后再试',
  42902: '登录过于频繁，请稍后再试'
}

function fail(message, silent) {
  const msg = message || '请求失败'
  if (!silent) ElMessage.error(msg)
  return Promise.reject(new Error(msg))
}

/** 刷新权限上下文：动态引入避免 store ↔ api 循环依赖 */
function refreshPermissions() {
  import('@/stores/permission')
    .then(m => m.usePermissionStore().load(true))
    .catch(() => {})
}

function redirectToLogin(tip = '登录已过期，请重新登录') {
  CLEAR_KEYS.forEach(k => localStorage.removeItem(k))
  if (router.currentRoute.value.path === '/login') return
  ElMessage.warning(tip)
  router.push('/login')
}

/** 用 refreshToken 换新令牌后重放；失败即去登录（40103 的死循环防护见下） */
function refreshAndReplay(config) {
  const refreshToken = localStorage.getItem('cs-refresh-token')
  if (!refreshToken || refreshing || config?._retried) {
    redirectToLogin()
    return Promise.reject(new Error('登录已过期，请重新登录'))
  }
  refreshing = true
  return axios.post(`${baseURL}/auth/refresh`, { refreshToken })
    .then(res => {
      const body = res.data || {}
      // 刷新接口自己也可能返回 40103（成员/企业被停用）→ 直接去登录，绝不再重试
      if (body.code !== 0 || !body.data?.accessToken) throw new Error(body.message || 'refresh failed')
      localStorage.setItem('cs-token', body.data.accessToken)
      if (body.data.refreshToken) localStorage.setItem('cs-refresh-token', body.data.refreshToken)
      config._retried = true
      return request(config)
    })
    .catch(() => {
      redirectToLogin('账号或所属企业已停用，请联系管理员')
      throw new Error('登录已过期，请重新登录')
    })
    .finally(() => { refreshing = false })
}

// 响应拦截：统一处理 Result{code, message, data}，code=0 成功
request.interceptors.response.use(
  response => {

    const body = response.data || {}
    const { code, message } = body
    const silent = !!response.config?.silent
    if (code === 0) return body.data

    // 登录类错误：只提示，不刷新令牌、不跳登录（否则会把"密码错误"变成"登录已过期"）
    if (LOGIN_ERRORS[code]) return fail(message || LOGIN_ERRORS[code], silent)

    if (code === 40103) return refreshAndReplay(response.config)
    if (code === 40001) {
      redirectToLogin(message || '请先登录')
      return Promise.reject(new Error(message || '请先登录'))
    }
    if (code === 40301) {
      refreshPermissions()
      return fail(message || '无权限访问', silent)
    }
    // 40400：后端明确"接口不存在"（通常是新功能还没上线），给一句能看懂的话
    if (code === 40400) {
      const url = response.config?.url || ''
      return fail(`接口未上线：${url.startsWith('/') ? url : '/' + url}`, silent)
    }
    return fail(message, silent)
  },
  error => {
    // 用户主动取消（暂停/放弃上传）：静默返回，不弹错误提示
    if (axios.isCancel(error) || error.code === 'ERR_CANCELED' || error.name === 'AbortError') return Promise.reject(error)

    const status = error.response?.status
    const bodyCode = error.response?.data?.code
    const silent = !!error.config?.silent

    // 登录类错误可能以 HTTP 401 返回，必须排在下面的 401 分支之前
    if (LOGIN_ERRORS[bodyCode]) {
      return fail(error.response?.data?.message || LOGIN_ERRORS[bodyCode], silent)
    }
    if (bodyCode === 40001) {
      redirectToLogin(error.response?.data?.message || '请先登录')
      return Promise.reject(error)
    }
    if (bodyCode === 40400) {
      const url = error.config?.url || ''
      return fail(`接口未上线：${url.startsWith('/') ? url : '/' + url}`, silent)
    }
    // 401 或 40103：都按"登录态不可用"处理（刷新一次，失败去登录）
    if (bodyCode === 40103 || status === 401) return refreshAndReplay(error.config)

    if (!silent) ElMessage.error(error.response?.data?.message || '网络异常')
    return Promise.reject(error)
  }
)

export default request
