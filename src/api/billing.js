import request from './request'

// ============================================================
// 计费（用户端）—— 对接后端真实接口
// 后端统一返回 Result{ code, message, data }，request 拦截器在 code===0 时已解包返回 data
// ============================================================
export const billingApi = {
  // GET /billing/config → { freeBytes, pricePerGbMonthCents, note }
  getConfig: () => request.get('/billing/config'),

  // GET /billing/quota → { freeBytes, extraBytes, extraExpireAt, usedBytes, uploadBlocked }
  getQuota: () => request.get('/billing/quota'),

  // POST /billing/increase-requests { gbCount, remark } → { id, amountCents, status }
  createIncrease: data => request.post('/billing/increase-requests', data),

  // GET /billing/increase-requests?page&size → { records, total, ... }
  listIncrease: params => request.get('/billing/increase-requests', { params })
}