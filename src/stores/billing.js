import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { billingApi } from '@/api/billing'
import { usePermissionStore } from '@/stores/permission'

export const useBillingStore = defineStore('billing', () => {
  // 计费配置：免费额度 + 单价（分/GB/月）
  const config = ref({ freeBytes: 0, pricePerGbMonthCents: 100 })

  // 当前额度：免费 / 增量 / 增量到期 / 已用 / 是否超额冻结
  // 三段额度：个人免费 / 个人增量 / 企业分配（后端 /billing/quota 已拆开返回）
  const quota = ref({ personalBytes: 0, freeBytes: 0, extraBytes: 0, enterpriseBytes: 0, extraExpireAt: null, usedBytes: 0, uploadBlocked: false })

  // 我的增额申请列表
  const requests = ref([])
  const reqTotal = ref(0)
  const reqPages = ref(0)
  const loading = ref(false)

  // 可用总额度 = 免费 + 增量
  // 可用合计 = 个人免费 + 个人增量 + 企业分配（freeBytes 是 personalBytes 的兼容别名）
  const totalBytes = computed(() =>
    (quota.value.personalBytes ?? quota.value.freeBytes ?? 0) +
    (quota.value.extraBytes || 0) +
    (quota.value.enterpriseBytes || 0)
  )

  // 缺权限点时不发请求（避免整页弹「缺少权限：xxx」），由页面按需降级
  const allowed = code => usePermissionStore().can(code)

  async function loadConfig() {
    if (!allowed('billing.read')) return
    config.value = await billingApi.getConfig()
  }

  async function loadQuota() {
    if (!allowed('quota.read')) return
    quota.value = await billingApi.getQuota()
  }

  async function loadRequests(page = 1, size = 5) {
    if (!allowed('increase.read')) return
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