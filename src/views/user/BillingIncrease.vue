<template>
  <div class="cs-page">
    <h2 class="page-title"><el-icon><Wallet /></el-icon>增额申请</h2>

    <!-- 超额冻结横幅 -->
    <el-alert
      v-if="billing.quota.uploadBlocked"
      type="error"
      :closable="false"
      show-icon
      class="block-banner"
      title="存储额度已满"
      description="当前用量已超过可用额度，上传将被拦截。请申请增额，待管理员审批通过后即可恢复上传。"
    />

    <!-- 额度概览 -->
    <div class="cs-card quota-overview">
      <h3>当前额度</h3>
      <div class="quota-segments">
        <div class="qseg">
          <div class="qseg-label">免费额度</div>
          <div class="qseg-val">{{ formatSize(billing.quota.freeBytes) }}</div>
        </div>
        <div class="qseg">
          <div class="qseg-label">增量额度</div>
          <div class="qseg-val">{{ formatSize(billing.quota.extraBytes) }}</div>
          <div class="qseg-sub" v-if="billing.quota.extraExpireAt">到期 {{ formatDate(billing.quota.extraExpireAt) }}</div>
        </div>
        <div class="qseg">
          <div class="qseg-label">已用空间</div>
          <div class="qseg-val">{{ formatSize(billing.quota.usedBytes) }}</div>
        </div>
        <div class="qseg">
          <div class="qseg-label">可用总额度</div>
          <div class="qseg-val">{{ formatSize(billing.totalBytes) }}</div>
        </div>
      </div>
      <div class="quota-bar">
        <div class="qbar-seg qbar-free" :style="{ width: freeSegPct + '%' }">
          <div class="qbar-fill qbar-free-fill" :style="{ width: freeUsedPct + '%' }"></div>
        </div>
        <div class="qbar-seg qbar-extra" :style="{ width: extraSegPct + '%' }">
          <div class="qbar-fill qbar-extra-fill" :style="{ width: extraUsedPct + '%' }"></div>
        </div>
      </div>
    </div>

    <!-- 申请表单 -->
    <div class="cs-card apply-card">
      <h3>申请增额</h3>
      <div class="apply-row">
        <div class="apply-field">
          <span class="apply-label">增额容量</span>
          <el-input-number v-model="gbCount" :min="1" :max="1000" :step="1" step-strictly />
          <span class="apply-unit">GB</span>
        </div>
        <div class="apply-shortcuts">
          <el-button v-for="g in [5, 10, 20, 50, 100]" :key="g" size="small" :type="gbCount === g ? 'primary' : ''" @click="gbCount = g">{{ g }}G</el-button>
        </div>
      </div>
      <div class="price-preview">
        <span class="price-label">预估月租</span>
        <span class="price-amount">{{ previewAmount }}<span class="price-unit">元/月</span></span>
        <span class="price-tip">单价 {{ formatMoney(billing.config.pricePerGbMonthCents) }}/GB/月，实际金额以审批为准</span>
      </div>
      <div class="apply-row remark-row">
        <div class="apply-field remark-field">
          <span class="apply-label">备注（可选）</span>
          <el-input v-model="remark" type="textarea" :autosize="{ minRows: 3, maxRows: 6 }" placeholder="如：项目组扩容" maxlength="500" show-word-limit />
        </div>
      </div>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">提交申请</el-button>
    </div>

    <!-- 计费与收费规则 -->
    <div class="cs-card rules-card">
      <h3>计费与收费规则</h3>
      <ul class="rules-list">
        <li><span class="rule-dot"></span><span><span class="rule-key">免费额度</span>每个账号默认 {{ formatSize(billing.config.freeBytes) }} 免费空间。</span></li>
        <li><span class="rule-dot"></span><span><span class="rule-key">增额单价</span>超出免费额度部分按 <b>{{ billing.config.pricePerGbMonthCents / 100 }} 元/GB/月</b> 计费。</span></li>
        <li><span class="rule-dot"></span><span><span class="rule-key">申请单位</span>按整数 GB 申请（1~1000GB），不足 1GB 按 1GB 计。</span></li>
        <li><span class="rule-dot"></span><span><span class="rule-key">计费周期</span>自审批通过起按 30 天为一期；到期增量自动收回，不自动续费。</span></li>
        <li><span class="rule-dot"></span><span><span class="rule-key">叠加与续期</span>多笔生效增额可叠加，续期即再次提交新申请。</span></li>
        <li><span class="rule-dot"></span><span><span class="rule-key">审批生效</span>申请提交后由管理员审批，通过后即时生效。</span></li>
        <li><span class="rule-dot"></span><span><span class="rule-key">金额说明</span>页面所示金额为预估（单价×GB），实际金额以审批通过结果为准。</span></li>
        <li><span class="rule-dot"></span><span><span class="rule-key">用量与冻结</span>已用空间含回收站；用量超过可用额度后上传将被拦截，增额通过后恢复。</span></li>
      </ul>
    </div>

    <!-- 我的申请 -->
    <div class="cs-card list-card">
      <h3>我的申请</h3>
      <el-table :data="billing.requests" v-loading="billing.loading" empty-text="暂无申请记录">
        <el-table-column prop="id" label="编号" width="80" />
        <el-table-column label="申请时间" min-width="160">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="容量" width="100">
          <template #default="{ row }">{{ row.gbCount }} GB</template>
        </el-table-column>
        <el-table-column label="金额" width="120">
          <template #default="{ row }">{{ formatMoney(row.amountCents) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip />
        <el-table-column label="处理时间" min-width="160">
          <template #default="{ row }">{{ row.handledAt ? formatDate(row.handledAt) : '--' }}</template>
        </el-table-column>
      </el-table>
      <el-pagination
        class="list-pagination"
        v-model:current-page="page"
        :page-size="pageSize"
        :total="billing.reqTotal"
        layout="total, prev, pager, next"
        @current-change="onPageChange"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useBillingStore } from '@/stores/billing'
import { formatSize, formatDate } from '@/utils/file'

const billing = useBillingStore()
const gbCount = ref(5)
const remark = ref('')
const submitting = ref(false)
const page = ref(1)
const pageSize = ref(5)

// —— 申请审批结果弹窗：进入页面时对比「上次已知状态」，pending → approved/rejected 即弹窗 ——
const KNOWN_KEY = 'cs-billing-known-status'

function readKnownStatus() {
  try {
    const raw = localStorage.getItem(KNOWN_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch (e) { return {} }
}

function writeKnownStatus(list) {
  const map = {}
  for (const r of list || []) { if (r && r.id != null) map[r.id] = r.status }
  try { localStorage.setItem(KNOWN_KEY, JSON.stringify(map)) } catch (e) {}
}

// 驳回原因：后端当前把驳回原因追加到 remark 字段，格式「原备注 | 驳回原因：XXX」；优先取独立字段，否则从 remark 抽取
function rejectReasonOf(r) {
  if (!r) return ''
  const direct = r.rejectReason || r.rejectMessage || r.rejectMsg || r.reason || r.reject_reason || r.refuseReason
  if (direct) return direct
  const remark = r.remark || ''
  const m = remark.match(/驳回原因[:：]\s*([\s\S]*)$/)
  return m ? m[1].trim() : ''
}

function notifyChanges(changed) {
  const approved = changed.filter(r => r.status === 'approved')
  const rejected = changed.filter(r => r.status === 'rejected')
  if (approved.length) {
    ElMessageBox.alert(
      approved.length === 1 ? `您的增额申请（编号 ${approved[0].id}）已通过审批，额度已生效` : `您的 ${approved.length} 笔增额申请已通过审批，额度已生效`,
      '申请结果',
      { type: 'success', confirmButtonText: '知道了' }
    ).catch(() => {})
  }
  if (rejected.length) {
    const reasonText = rejectReasonOf(rejected[0])
    const msg = rejected.length === 1
      ? `您的增额申请（编号 ${rejected[0].id}）已被驳回${reasonText ? `，驳回原因：${reasonText}` : ''}`
      : `您的 ${rejected.length} 笔增额申请已被驳回：${rejected.map(r => { const rs = rejectReasonOf(r); return rs ? `编号 ${r.id}（${rs}）` : `编号 ${r.id}` }).join('、')}`
    ElMessageBox.alert(
      msg,
      '申请结果',
      { type: 'warning', confirmButtonText: '知道了' }
    ).catch(() => {})
  }
}

async function checkStatusChange() {
  const known = readKnownStatus()
  const all = await billing.loadRequestsForCheck()
  const changed = all.filter(r => {
    return known[r.id] === 'pending' && (r.status === 'approved' || r.status === 'rejected')
  })
  writeKnownStatus(all)
  if (changed.length) notifyChanges(changed)
}

const previewAmount = computed(() => ((gbCount.value * billing.config.pricePerGbMonthCents) / 100).toFixed(2))
const freeSegPct = computed(() => billing.totalBytes > 0 ? (billing.quota.freeBytes / billing.totalBytes) * 100 : 0)
const extraSegPct = computed(() => billing.totalBytes > 0 ? (billing.quota.extraBytes / billing.totalBytes) * 100 : 0)
const freeUsedPct = computed(() => billing.quota.freeBytes > 0 ? (Math.min(billing.quota.usedBytes, billing.quota.freeBytes) / billing.quota.freeBytes) * 100 : 0)
const extraUsedPct = computed(() => billing.quota.extraBytes > 0 ? Math.min(100, (Math.max(0, billing.quota.usedBytes - billing.quota.freeBytes) / billing.quota.extraBytes) * 100) : 0)

function formatMoney(cents) { return '¥' + ((cents || 0) / 100).toFixed(2) }
function statusType(s) { return s === 'approved' ? 'success' : s === 'rejected' ? 'danger' : 'warning' }
function statusText(s) { return s === 'approved' ? '已通过' : s === 'rejected' ? '已驳回' : '待审批' }

async function handleSubmit() {
  const n = Number(gbCount.value)
  if (!Number.isInteger(n) || n < 1 || n > 1000) { ElMessage.error('申请容量需为 1~1000 的整数'); return }
  submitting.value = true
  try {
    await billing.submitIncrease(n, remark.value.trim())
    ElMessage.success('申请已提交，待管理员审批')
    remark.value = ''
    await billing.loadRequests(page.value, pageSize.value, true)
    // 提交成功后把全量申请状态同步进「已知状态」，这样下次进入时若已被审批即可弹窗
    writeKnownStatus(billing.requestAll)
  } catch (e) {
    ElMessage.error(e?.message || '提交失败')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  billing.loadConfig().catch(() => {})
  billing.loadQuota().catch(() => {})
  billing.loadRequests(page.value, pageSize.value).catch(() => {})
  checkStatusChange().catch(() => {})
})

function onPageChange(p) {
  billing.loadRequests(p, pageSize.value).catch(() => {})
}
</script>

<style scoped>
.page-title { display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 600; color: var(--cs-text-primary); margin: 0 0 24px 0; }
.block-banner { margin-bottom: 16px; }
.quota-overview, .apply-card, .rules-card, .list-card { padding: 24px; margin-bottom: 20px; }
.quota-overview h3, .apply-card h3, .rules-card h3, .list-card h3 { font-size: 16px; font-weight: 600; color: var(--cs-text-primary); margin: 0 0 20px 0; }
.list-pagination { margin-top: 16px; justify-content: flex-end; }
.quota-segments { display: flex; gap: 32px; margin-bottom: 20px; flex-wrap: wrap; }
.qseg { min-width: 120px; }
.qseg-label { font-size: 12px; color: var(--cs-text-tertiary); margin-bottom: 6px; }
.qseg-val { font-size: 20px; font-weight: 600; color: var(--cs-text-primary); }
.qseg-sub { font-size: 12px; color: var(--cs-text-secondary); margin-top: 4px; }
.quota-bar { display: flex; gap: 2px; height: 12px; border-radius: 6px; overflow: hidden; background: var(--cs-bg-hover); }
.qbar-seg { position: relative; height: 100%; overflow: hidden; }
.qbar-free { background: #dbeafe; }
.qbar-extra { background: #d1fae5; }
.qbar-fill { position: absolute; left: 0; top: 0; height: 100%; transition: width 0.3s ease; }
.qbar-free-fill { background: #3b82f6; }
.qbar-extra-fill { background: #22c55e; }
.apply-row { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
.apply-field { display: flex; align-items: center; gap: 12px; }
.apply-label { font-size: 14px; color: var(--cs-text-secondary); white-space: nowrap; }
.apply-unit { font-size: 14px; color: var(--cs-text-secondary); }
.apply-shortcuts { display: flex; gap: 8px; flex-wrap: wrap; }
.price-preview { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; padding: 16px; background: var(--cs-bg-hover); border-radius: var(--cs-radius); margin-bottom: 20px; }
.price-label { font-size: 14px; color: var(--cs-text-secondary); }
.price-amount { font-size: 26px; font-weight: 700; color: var(--cs-primary); }
.price-unit { font-size: 13px; font-weight: 400; color: var(--cs-text-secondary); margin-left: 2px; }
.price-tip { font-size: 12px; color: var(--cs-text-tertiary); }
.remark-row { margin-bottom: 20px; }
.remark-field { flex: 1; min-width: 240px; max-width: 520px; align-items: flex-start; }
.remark-field .el-input { width: 100%; }
.remark-field .apply-label { padding-top: 7px; }
.rules-list { margin: 0; padding: 0; list-style: none; }
.rules-list li { display: flex; align-items: flex-start; gap: 10px; padding: 9px 0; font-size: 14px; color: var(--cs-text-secondary); line-height: 1.6; border-bottom: 1px dashed var(--cs-border); }
.rules-list li:last-child { border-bottom: none; }
.rules-list b { color: var(--cs-primary); font-weight: 600; }
.rule-dot { flex-shrink: 0; width: 6px; height: 6px; border-radius: 50%; background: var(--cs-primary); margin-top: 8px; }
.rule-key { flex-shrink: 0; margin-right: 2px; font-weight: 600; color: var(--cs-text-primary); }
@media (max-width: 768px) {
  .quota-overview, .apply-card, .rules-card, .list-card { padding: 16px; }
  .quota-segments { gap: 16px; }
}
</style>