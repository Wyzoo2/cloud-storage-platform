import request from './request'

// ===== 认证 =====
export const authApi = {
  login: data => request.post('/auth/login', data),
  logout: () => request.post('/auth/logout'),
  changePassword: data => request.post('/auth/change-password', data),
  profile: () => request.get('/auth/profile'),
  me: () => request.get('/user/me'),
  // 刷新 token：{ refreshToken } → LoginResponse
  refresh: data => request.post('/auth/refresh', data)
}

// ===== 文件管理 =====
export const fileApi = {
  // 列目录：{ parent, page, size, sort } → { total, list, breadcrumb }
  listDir: params => request.get('/files', { params }),
  // 新建文件夹：{ parentId, name }
  mkdir: data => request.post('/files/mkdir', data),
  // 重命名/移动：{ name } 或 { parentId }
  update: (id, data) => request.patch(`/files/${id}`, data),
  // 删除：force=1 彻底删除（回收站内），默认进回收站
  remove: (id, force = 0) => request.delete(`/files/${id}`, { params: { force } }),
  // 回收站列表：{ parent, page, size } → { total, list, breadcrumb }
  trash: params => request.get('/files/trash', { params }),
  // 从回收站还原：可选目标目录 targetParentId（0=根目录「全部文件」，缺省=原位置）
  restore: (id, data) => request.post(`/files/${id}/restore`, data || {}),
  // 下载文件 → Map<string,string>
  download: id => request.get(`/files/${id}/download`),
  // 获取完整目录树（扁平 id+parentId 列表，前端自行建树）
  tree: () => request.get('/files/tree'),
  // 批量移动：{ ids: number[], targetParentId: number } → FileNodeVO[]
  batchMove: data => request.patch('/files/batch-move', data)
}

// ===== 统计大盘（个人维度）=====
export const statsApi = {
  overview: () => request.get('/stats/overview')
}

// ===== 审计日志 =====
export const auditApi = {
  // { userId, action, start, end, page, size } → { total, list }
  query: params => request.get('/audit-logs', { params })
}

// ===== 用户管理（admin）=====
export const adminApi = {
  // { keyword, status, page, size } → Spring Page { content, totalElements, ... }
  listUsers: params => request.get('/admin/users', { params }),
  // { username, initialPassword, quotaBytes, role }
  createUser: data => request.post('/admin/users', data),
  // { status, quotaBytes, role }
  updateUser: (id, data) => request.patch(`/admin/users/${id}`, data),
  // 重置密码 → { password: 'xxx' }（新密码）
  resetPassword: id => request.post(`/admin/users/${id}/reset-password`),
  // 降级为普通用户（A3 保护：不可降级自己 / 至少保留一位 active 管理员）
  demoteUser: id => request.post(`/admin/users/${id}/demote`),
  // ===== 管理端统计（R-C09）=====
  // 平台用量总览 → { totalQuotaBytes, usedBytes, remainingBytes, userCount }
  statsOverview: () => request.get('/admin/stats/overview'),
  // 用量 Top 榜 → [{ userId, username, usedBytes, quotaBytes }]
  statsTopUsers: () => request.get('/admin/stats/top-users'),
  // 近 N 日流量曲线 → [{ date, uploadBytes, downloadBytes }]
  statsTraffic: days => request.get('/admin/stats/traffic', { params: { days } })
}

// ===== 文件传输（B 组：分片上传 / 秒传 / 断点续传 / 下载）=====
export const uploadApi = {
  // 初始化上传（含秒传）：{ name, size, parentId, sha256 } → { status:'done', fileId } 或 { status:'uploading', sessionId, uploadId, chunkSize }
  // sessionId 即后端任务 id（自增）；uploadId 是 MinIO 内部标识，前端不用
  init: data => request.post('/uploads/init', data),
  // 上传单个分片：body 为该分片二进制，Content-Type 固定 octet-stream
  uploadPart: (sessionId, partNo, blob, signal) => request.put(`/uploads/${sessionId}/parts/${partNo}`, blob, { headers: { 'Content-Type': 'application/octet-stream' }, timeout: 5 * 60 * 1000, ...(signal ? { signal } : {}) }),
  // 查询会话（断点续传）→ { sessionId, status, uploadId, chunkSize, uploadedParts, partsDetail }
  getSession: sessionId => request.get(`/uploads/${sessionId}`),
  // 合并分片、落库、扣配额 → { fileId, alreadyDone }
  complete: sessionId => request.post(`/uploads/${sessionId}/complete`),
  // 取消上传：后端自动把任务置为 aborted（幂等，done/aborted 再调无副作用）
  abort: sessionId => request.post(`/uploads/${sessionId}/abort`),
  // 获取 5 分钟预签名下载地址 → { url }
  getDownloadUrl: fileId => request.get(`/files/${fileId}/download`),
  getPreviewUrl: fileId => request.get(`/files/${fileId}/download`, { params: { inline: true } })
}

// ===== 计费管理（admin）=====
export const billingAdminApi = {
  // 获取计费配置
  getConfig: () => request.get('/admin/billing/config'),
  // 更新计费配置：{ freeBytes?, pricePerGbMonthCents? }
  updateConfig: data => request.patch('/admin/billing/config', data),
  // 增额申请列表（管理端审批）：{ status?, page, size } → { list, total }
  listRequests: params => request.get('/admin/billing/increase-requests', { params }),
  // 审批通过
  approve: id => request.post(`/admin/billing/increase-requests/${id}/approve`),
  // 审批驳回：{ reason? }
  reject: (id, data) => request.post(`/admin/billing/increase-requests/${id}/reject`, data),
  // 缴费台账：{ userId?, status?, page, size } → { list, total }
  listRecords: params => request.get('/admin/billing/records', { params })
}

// ===== 计费（用户端）=====
export const billingApi = {
  // 获取计费配置（公开，需登录）
  getConfig: () => request.get('/billing/config'),
  // 获取当前用户额度信息
  getQuota: () => request.get('/billing/quota'),
  // 提交增额申请：{ gbCount, remark? }
  createRequest: data => request.post('/billing/increase-requests', data),
  // 我的申请列表：{ page, size } → { list, total }
  listMyRequests: params => request.get('/billing/increase-requests', { params })
}

// ===== 传输任务列表（后端持久化任务记录）=====
export const uploadTaskListApi = {
  // 分页查询：{ status?: uploading/done/aborted, page?(从0起), size?(默认10,最大100) } → { list, total, page, size }
  // list 项：{ id, name, sizeBytes, status, fileId, createdAt }，id = init 返回的 sessionId（后端自增）
  list: params => request.get('/uploads', { params }),
  // 任务详情：含 uploadedParts（前端自算进度）、sha256/parentId/chunkSize（刷新后恢复续传用）
  detail: id => request.get(`/uploads/${id}`),
  // 删除单条：仅 done/aborted；uploading 返回 40211「任务正在上传中，请先放弃」
  remove: id => request.delete(`/uploads/${id}`),
  // 清空全部已完成 → 删除条数
  clearCompleted: () => request.post('/uploads/clear-completed')
}
