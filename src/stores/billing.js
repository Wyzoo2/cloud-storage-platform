import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { billingApi } from '@/api/billing'

export const useBillingStore = defineStore('billing', () => {
  // 计费配置：免费额度 + 单价（分/GB/月）
  const config = ref({ freeBytes: 0, pricePerGbMonthCents: 100 })

  // 当前额度：免费 / 增量 / 增量到期 / 已用 / 是否超额冻结
  const quota = ref({ freeBytes: 0, extraBytes: 0, extraExpireAt: null, usedBytes: 0, uploadBlocked: false })

  // 我的增额申请列表
  const requests = ref([])
  const reqTotal = ref(0)
  const reqPages = ref(0)
  const requestAll = ref(null) // 全量缓存：翻页时从缓存切片，避免每次翻页都重新请求后端
  const loading = ref(false)

  // 可用总额度 = 免费 + 增量
  const totalBytes = computed(() => (quota.value.freeBytes || 0) + (quota.value.extraBytes || 0))

  async function loadConfig() {
    config.value = await billingApi.getConfig()
  }

  async function loadQuota() {
    quota.value = await billingApi.getQuota()
  }

  async function loadRequests(page = 1, size = 5, force = false) {
    // 后端 /billing/increase-requests 的 page/size 目前未真正按页返回（records 每次都返回全量）。
    // 这里一次性拉全量后由前端切片；force=true（提交后刷新）或首次加载时才重新请求，翻页走缓存秒切。
    loading.value = true
    try {
      if (force || requestAll.value == null) {
        const r = await billingApi.listIncrease({ page: 1, size: 500 })
        const all = Array.isArray(r) ? r : (r.records || [])
        const rawTotal = (r && r.total != null) ? Number(r.total) : 0
        requestAll.value = all
        reqTotal.value = Math.max(all.length, rawTotal)
      }
      requests.value = requestAll.value.slice((page - 1) * size, page * size)
      reqPages.value = Math.ceil(reqTotal.value / size) || 0
    } finally {
      loading.value = false
    }
  }

  // 供「审批结果弹窗」检测用：拉一个较大列表（不用于分页展示），返回完整数组
  async function loadRequestsForCheck() {
    const r = await billingApi.listIncrease({ page: 1, size: 500 })
    return Array.isArray(r) ? r : (r.records || [])
  }

  async function submitIncrease(gbCount, remark) {
    return billingApi.createIncrease({ gbCount, remark })
  }

  return { config, quota, totalBytes, requests, reqTotal, reqPages, requestAll, loading, loadConfig, loadQuota, loadRequests, loadRequestsForCheck, submitIncrease }
})