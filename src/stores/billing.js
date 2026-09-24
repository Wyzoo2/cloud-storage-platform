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
  const loading = ref(false)

  // 可用总额度 = 免费 + 增量
  const totalBytes = computed(() => (quota.value.freeBytes || 0) + (quota.value.extraBytes || 0))

  async function loadConfig() {
    config.value = await billingApi.getConfig()
  }

  async function loadQuota() {
    quota.value = await billingApi.getQuota()
  }

  async function loadRequests(page = 1, size = 5) {
    // 后端已支持真分页：page 从 1 起，返回 { records, total, size, current, pages }，每次只拉当前页
    loading.value = true
    try {
      const r = await billingApi.listIncrease({ page, size })
      const data = Array.isArray(r) ? { records: r } : (r || {})
      const list = data.records || []
      requests.value = list
      reqTotal.value = Number(data.total ?? list.length)
      reqPages.value = Number(data.pages ?? Math.ceil(reqTotal.value / size)) || 0
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

  return { config, quota, totalBytes, requests, reqTotal, reqPages, loading, loadConfig, loadQuota, loadRequests, loadRequestsForCheck, submitIncrease }
})