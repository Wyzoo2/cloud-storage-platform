// 传输任务后端接口封装（原 localStorage 持久化已由后端任务记录替代）
import { uploadTaskListApi } from '@/api'

// 分页查询任务列表：params { status?: uploading/done/aborted, page?(从0起), size?(≤100) } → { list, total, page, size }
// list 项：{ id, name, sizeBytes, status, fileId, createdAt }，id = init 返回的 sessionId（后端自增）
export function fetchUploadTasks(params = {}) {
  return uploadTaskListApi.list(params)
}

// 任务详情：含 uploadedParts（前端自算进度）、sha256/parentId/chunkSize（刷新后恢复续传用）
export function fetchUploadTaskDetail(id) {
  return uploadTaskListApi.detail(id)
}

// 删除单条任务：仅 done/aborted；uploading 返回 40211「任务正在上传中，请先放弃」
export function deleteUploadTask(id) {
  return uploadTaskListApi.remove(id)
}

// 清空全部已完成 → 删除条数
export function clearCompletedUploadTasks() {
  return uploadTaskListApi.clearCompleted()
}
