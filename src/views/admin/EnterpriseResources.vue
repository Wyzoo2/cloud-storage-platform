<template>
  <div class="cs-page">
    <div class="page-head">
      <h2 class="page-title"><el-icon><Coin /></el-icon>{{ isManager ? '企业资源' : '我的企业空间' }}<el-button link type="primary" @click="router.push('/packages')" style="padding-top: 10px;font-size: 14px;">前往套餐增值</el-button></h2>
      <el-button link :loading="loading" @click="refreshAll">
        <el-icon><Refresh /></el-icon>刷新
      </el-button>
    </div>

    <div v-if="pool.suspended || pool.overAllocated" class="over-bar">
      <el-icon class="over-icon"><WarningFilled /></el-icon>
      <span class="over-text">可分配额度为负（差额 {{ formatSize(Math.abs(pool.availableBytesRaw || 0)) }}），上传/下载/预览已暂停</span>
      <el-button v-if="isManager" link type="primary" size="small" @click="router.push('/packages')">去续费</el-button>
    </div>

    <div class="cs-card pool-card" v-loading="loading">
      <div class="pool-head">
        <span class="pool-title">空间池</span>
        <span class="pool-pct" :class="{ danger: pool.availableBytesRaw < 0 }">已分配 {{ allocatedPct }}%</span>
      </div>
      <el-progress
        :percentage="Math.min(100, allocatedPct)"
        :stroke-width="8"
        :show-text="false"
        :color="pool.availableBytesRaw < 0 ? '#c94a3b' : '#2f6fb5'"
        class="pool-bar"
      />
      <div class="pool-metrics">
        <div class="metric">
          <span class="metric-label">池总量</span>
          <span class="metric-value">{{ formatSize(pool.totalBytes) }}</span>
        </div>
        <div class="metric">
          <span class="metric-label">已分配</span>
          <span class="metric-value">{{ formatSize(pool.allocatedBytes) }}</span>
        </div>
        <div class="metric">
          <span class="metric-label">可再分配</span>
          <span class="metric-value" :class="pool.availableBytesRaw < 0 ? 'danger' : 'accent'">
            {{ formatSize(pool.availableBytesRaw ?? pool.availableBytes) }}
          </span>
        </div>
        <div class="metric">
          <span class="metric-label">成员已用</span>
          <span class="metric-value">{{ formatSize(pool.usedBytes) }}</span>
        </div>
        <div class="metric">
          <span class="metric-label">最近到期</span>
          <span class="metric-value small">
            {{ pool.nextExpireAt ? formatDate(pool.nextExpireAt) : '--' }}
            <el-button v-if="isManager" link type="primary" size="small" class="renew-link" @click="router.push('/packages')">续费</el-button>
          </span>
        </div>
      </div>
    </div>

    <div class="cs-card table-card">
      <div class="panel-head">
        <span>成员分配</span>
        <span class="panel-count">{{ allocations.length }}</span>
      </div>
      <el-table :data="allocations" v-loading="loading" style="width: 100%" row-key="localUserId">
        <el-table-column label="成员" min-width="220">
          <template #default="{ row }">
            <div class="who">
              <span class="who-name">{{ row.displayName || ('用户 #' + row.localUserId) }}</span>
              <el-tag v-if="row.enterpriseRole === 1" size="small" effect="plain" type="warning">企业管理员</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="已分配" width="130" align="right">
          <template #default="{ row }">
            <span :class="{ muted: !row.allocatedBytes }">{{ row.allocatedBytes ? formatSize(row.allocatedBytes) : '未分配' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="使用情况" min-width="240">
          <template #default="{ row }">
            <div v-if="row.allocatedBytes > 0" class="usage">
              <el-progress
                :percentage="Math.min(100, usagePct(row))"
                :stroke-width="6"
                :show-text="false"
                :color="usageColor(row)"
                class="usage-bar"
              />
              <span class="usage-text">{{ formatSize(row.usedBytes || 0) }} · {{ usagePct(row) }}%</span>
            </div>
            <span v-else class="muted">{{ formatSize(row.usedBytes || 0) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" align="center">
          <template #default="{ row }">
            <el-button v-perm="'org.member.manage'" link type="primary" size="small" @click="openAllocate(row)">调整额度</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div v-if="isManager" class="cs-card table-card">
      <div class="panel-head">
        <span>套餐记录</span>
        <div class="sub-summary">
          <span>有效 <b>{{ activeSubCount }}</b> 笔</span>
          <template v-if="activeSubQuota > 0">
            <span class="sep">|</span>
            <span>总容量 <b>{{ fmtQuota(activeSubQuota).num }}{{ fmtQuota(activeSubQuota).unit }}</b></span>
          </template>
          <template v-if="nextExpireAt">
            <span class="sep">|</span>
            <span>最近到期 <b>{{ formatDate(nextExpireAt) }}</b></span>
          </template>
        </div>
      </div>
      <el-table v-if="subscriptions.length" :data="subscriptions" size="small" style="width: 100%" row-key="orderItemId" :row-class-name="expiringRowClass">
        <el-table-column label="套餐" min-width="200">
          <template #default="{ row }">
            <div class="sub-name" :class="{ 'row-muted': subEnded(row) }">{{ row.skuName || row.skuId || '--' }}</div>
            <div class="sub-sub">
              {{ row.createdAt ? '开通 ' + formatDate(row.createdAt) : '' }}
              <span v-if="row.renewals"> · 已续费 {{ row.renewals }} 次</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="容量" min-width="190">
          <template #default="{ row }">
            <div class="sub-name" :class="{ 'row-muted': subEnded(row) }">{{ quotaBreakdown(row) }}</div>
            <div class="sub-sub" v-if="row.totalPriceCents != null">总价 ¥{{ (Number(row.totalPriceCents) / 100).toFixed(2) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="isExpiring(row)" size="small" type="danger" effect="plain">即将到期</el-tag>
            <el-tag v-else size="small" :type="subStateOf(row).type" effect="plain">{{ subStateOf(row).text }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="到期" min-width="200">
          <template #default="{ row }">
            <span class="sub-date">
              {{ row.expireAt ? formatDate(row.expireAt) : '--' }}
              <span v-if="!subEnded(row)" class="remain" :class="{ soon: isExpiring(row) }">· {{ formatRemain(row.expireAt) }}</span>
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" align="center">
          <template #default="{ row }">
            <el-tooltip :disabled="canRenew(row)" :content="renewTip(row)" placement="top">
              <span>
                <el-button link type="primary" size="small" :disabled="!canRenew(row)" :loading="renewing === row.orderItemId" @click="renew(row)">续费</el-button>
              </span>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>
      <div v-else class="sub-empty">暂无套餐</div>
    </div>

    <el-dialog v-model="dialog" :title="`调整额度 · ${current?.displayName || ''}`" width="420px" align-center destroy-on-close>
      <div class="alloc-body">
        <div class="alloc-row">
          <span class="alloc-label">当前分配</span>
          <span>{{ formatSize(current?.allocatedBytes || 0) }}</span>
        </div>
        <div class="alloc-row">
          <span class="alloc-label">已使用</span>
          <span>{{ formatSize(current?.usedBytes || 0) }}</span>
        </div>
        <div class="alloc-row">
          <span class="alloc-label">可再分配</span>
          <span :class="pool.availableBytesRaw < 0 ? 'danger' : ''">{{ formatSize(pool.availableBytesRaw ?? pool.availableBytes) }}</span>
        </div>
        <el-form label-width="80px" label-position="left" class="alloc-form">
          <el-form-item label="目标额度">
            <el-input-number v-model="gb" :min="0" :max="Math.max(0, maxGb)" :step="1" :precision="2" controls-position="right" style="width: 100%" />
            <span class="unit">GB</span>
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button :disabled="!current?.allocatedBytes" @click="revoke">收回</el-button>
          <el-button @click="dialog = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="save">保存</el-button>
        </div>
      </template>
    </el-dialog>

    <OrderConfirmDialog
      v-model="confirmVisible"
      kind="renew"
      :quantity="confirmQty"
      :expire-at-before="confirmExpireBefore"
      :expire-at-after="confirmExpireAfter"
      :extend-days="confirmExtendDays"
      :item="confirmItem"
      :wallet-known="billing.walletState === 'ok'"
      :balance-cents="Number(billing.wallet.balanceCents || 0)"
      :balance-yuan="billing.wallet.balanceYuan"
      :frozen="!!billing.wallet.frozen"
      @confirm="onConfirmed"
    />

    <ProvisionDialog
      v-model="provVisible"
      :title="provTitle"
      :state="provState"
      :percent="provPercent"
      :step-text="provStep"
      :detail="provDetail"
    />
  </div>
</template><script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Coin, Refresh, WarningFilled } from '@element-plus/icons-vue'
import { enterpriseApi } from '@/api'
import OrderConfirmDialog from '@/components/OrderConfirmDialog.vue'
import ProvisionDialog from '@/components/ProvisionDialog.vue'
import { pollProvision } from '@/utils/provision'
import { useBillingStore } from '@/stores/billing'
import { usePermissionStore } from '@/stores/permission'
import { useRouter } from 'vue-router'
import { formatSize, formatDate, formatRemain, remainMs } from '@/utils/file'

const GB = 1024 ** 3
const perm = usePermissionStore()
const billing = useBillingStore()
const router = useRouter()

// 企业管理员/平台管理员可管理分配；普通成员只能看自己那一行（后端也按身份裁剪）
const isManager = computed(() => perm.can('org.member.manage'))

const loading = ref(false)
const saving = ref(false)
const pool = ref({ totalBytes: 0, allocatedBytes: 0, usedBytes: 0, availableBytes: 0, availableBytesRaw: 0, overAllocated: false, suspended: false, nextExpireAt: null })
const allocations = ref([])
const subscriptions = ref([])
const renewing = ref(0)
const dialog = ref(false)
const current = ref(null)
const gb = ref(0)

/* ---------------- 下单确认弹窗（显示花费与余额） ---------------- */
const confirmVisible = ref(false)
const confirmItem = ref({})
const confirmQty = ref(1)
const confirmExpireBefore = ref('')
const confirmExpireAfter = ref('')
const confirmExtendDays = ref(0)
const pendingOrder = ref(null)

function askConfirm(title, item, payload, opts = {}) {
  confirmItem.value = item
  confirmQty.value = Number(opts.quantity || 1)
  confirmExpireBefore.value = opts.expireAtBefore || ''
  confirmExpireAfter.value = opts.expireAtAfter || ''
  confirmExtendDays.value = Number(opts.extendDays || 0)
  pendingOrder.value = payload
  confirmVisible.value = true
}

async function onConfirmed() {
  confirmVisible.value = false
  const payload = pendingOrder.value
  if (!payload) return
  pendingOrder.value = null
  await runRenew(payload)
}

/* ---------------- 开通进度弹窗：开通结束前不可关闭 ---------------- */
const provVisible = ref(false)
const provTitle = ref('续费')
const provState = ref('running')
const provPercent = ref(0)
const provStep = ref('')
const provDetail = ref('')

function openProvision(title) {
  provTitle.value = title
  provState.value = 'running'
  provPercent.value = 0
  provStep.value = ''
  provDetail.value = ''
  provVisible.value = true
}

function setProvision(state, percent, step, detail = '') {
  provState.value = state
  provPercent.value = percent
  provStep.value = step
  provDetail.value = detail
}

// 本成员最终可达到的上限 = 已有分配 + 池剩余（避免前端先查再加算错）
const maxGb = computed(() => {
  const cap = Number(current.value?.allocatedBytes || 0) + Number(pool.value.availableBytes || 0)
  return Math.floor(cap / GB)
})

// 已回收的套餐不可续费（需重新购买）
// 续费节流：后端 3 秒内只允许一次，命中后前端倒计时禁用按钮
const renewCooldown = ref(0)
let renewCooldownTimer = null
function startRenewCooldown(seconds = 3) {
  renewCooldown.value = Math.max(1, Number(seconds) || 3)
  if (renewCooldownTimer) clearInterval(renewCooldownTimer)
  renewCooldownTimer = setInterval(() => {
    renewCooldown.value -= 1
    if (renewCooldown.value <= 0) { clearInterval(renewCooldownTimer); renewCooldownTimer = null; renewCooldown.value = 0 }
  }, 1000)
}

function canRenew(row) {
  if (renewCooldown.value > 0) return false
  return row?.status !== 'reclaimed'
}

function renewTip(row) {
  if (renewCooldown.value > 0) return `请 ${renewCooldown.value} 秒后再试`
  return row?.status === 'reclaimed' ? '该套餐已回收，无法续费，请重新购买' : ''
}

// 容量三段式：数量 × 单份 = 总量（文档要求）
function quotaBreakdown(row) {
  const qty = Number(row.quantity || 1)
  const unit = Number(row.unitQuotaGb ?? row.quotaGb ?? 0)
  const total = Number(row.totalQuotaGb ?? unit * qty)
  const totalText = `${fmtQuota(total).num}${fmtQuota(total).unit}`
  if (!unit) return totalText
  const unitText = `${fmtQuota(unit).num}${fmtQuota(unit).unit}`
  return qty > 1 ? `${qty} × ${unitText} = ${totalText}` : unitText
}

// 7 天内到期（含按小时显示）→ 整行淡红底 + 状态「即将到期」
const EXPIRING_MS = 7 * 24 * 3600 * 1000
function isExpiring(row) {
  if (subEnded(row)) return false
  const ms = remainMs(row.expireAt)
  return ms !== null && ms > 0 && ms <= EXPIRING_MS
}

function expiringRowClass({ row }) {
  return isExpiring(row) ? 'row-expiring' : ''
}

// 套餐是否已结束（已回收 / 已到期）
function subEnded(row) {
  if (row.status === 'reclaimed') return true
  if (row.expired != null) return !!row.expired
  return row.expireAt ? new Date(row.expireAt).getTime() < Date.now() : false
}

// 有效期内的套餐数 / 总容量 / 最近到期
const activeSubCount = computed(() => subscriptions.value.filter(s => !subEnded(s)).length)
const activeSubQuota = computed(() =>
  subscriptions.value.filter(s => !subEnded(s)).reduce((sum, s) => sum + Number(s.totalQuotaGb ?? s.unitQuotaGb ?? 0), 0)
)
const nextExpireAt = computed(() => {
  const list = subscriptions.value.filter(s => !subEnded(s)).map(s => s.expireAt).filter(Boolean).sort()
  return list[0] || ''
})

// GB 超过 1024 进位成 TB
function fmtQuota(gb) {
  const n = Number(gb || 0)
  if (!n) return { num: '--', unit: '' }
  return n >= 1024 ? { num: String(+(n / 1024).toFixed(n % 1024 === 0 ? 0 : 1)), unit: 'TB' } : { num: String(n), unit: 'GB' }
}

// 套餐状态：active 有效 / reclaimed 已回收；expireAt 过了但还没回收，也提示已到期
function subStateOf(row) {
  if (row.status === 'reclaimed') return { text: '已回收', type: 'info' }
  const isExpired = row.expired != null ? !!row.expired : (row.expireAt ? new Date(row.expireAt).getTime() < Date.now() : false)
  if (isExpired) return { text: '已到期', type: 'warning' }
  return { text: '有效', type: 'success' }
}

// 池已分配占比（进度条用）
const allocatedPct = computed(() => {
  const total = Number(pool.value.totalBytes || 0)
  return total > 0 ? Math.round(Number(pool.value.allocatedBytes || 0) / total * 100) : 0
})

// 单个成员额度使用率
function usagePct(row) {
  return row.allocatedBytes > 0 ? Math.round((row.usedBytes || 0) / row.allocatedBytes * 100) : 0
}

function usageColor(row) {
  const pct = row.allocatedBytes > 0 ? (row.usedBytes || 0) / row.allocatedBytes * 100 : 0
  if (pct > 90) return '#c94a3b'
  if (pct > 70) return '#d99a4e'
  return '#2f6fb5'
}

async function loadPool() {
  try {
    pool.value = await enterpriseApi.pool()
  } catch (e) {
    // 个人域账号 / 网络异常：拦截器已提示，保持默认值
  }
}

async function loadAllocations() {
  try {
    const res = await enterpriseApi.allocations()
    allocations.value = res?.list || []
  } catch (e) {
    allocations.value = []
  }
}

async function loadSubscriptions() {
  if (!isManager.value) { subscriptions.value = []; return }
  try {
    const res = await enterpriseApi.subscriptions()
    subscriptions.value = res?.list || []
  } catch (e) {
    subscriptions.value = []
  }
}

// 续费：先取「买什么 + 价格 + 幂等键」→ 确认弹窗 → 下单 → 开通（结束前弹窗不可关）
// 续费：先弹确认（价格取订阅行的 totalPriceCents/priceCents），确认后调 /billing/subscriptions/{id}/renew
// 该接口一步完成（后端已建门户订单并延期），返回 portalOrderId 用于轮询开通结果
async function renew(row) {
  // 已回收的套餐不可续费（需重新购买）
  if (row?.status === 'reclaimed') return ElMessage.warning('该套餐已回收，无法续费，请重新购买')
  if (!billing.walletState || billing.walletState === 'idle') await billing.loadWallet()
  const qty = Number(row.quantity || 1)
  const totalQuotaGb = Number(row.totalQuotaGb ?? row.unitQuotaGb ?? row.quotaGb ?? 0)
  const totalCents = Number(row.totalPriceCents ?? row.priceCents ?? 0)
  const days = Number(row.periodDays || row.extendDays || 30)
  askConfirm(
    `续费 · ${row.skuName || row.skuId || ''}`,
    {
      name: row.skuName || row.skuId,
      unitQuotaGb: qty > 0 ? totalQuotaGb / qty : totalQuotaGb,
      periodDays: days,
      unitPriceCents: qty > 0 ? Math.round(totalCents / qty) : totalCents
    },
    { orderItemId: row.orderItemId, quotaGb: totalQuotaGb },
    {
      quantity: qty,
      expireAtBefore: row.expireAt || '',
      expireAtAfter: addDaysIso(row.expireAt, days),
      extendDays: days
    }
  )
}

function addDaysIso(iso, days) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  d.setDate(d.getDate() + Number(days || 0))
  return d.toISOString()
}

function fmtDateTime(iso) {
  if (!iso) return '--'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '--'
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 续费只调一个接口（延长旧开通，容量不变）；重复点击当天不再扣款
async function runRenew(payload) {
  renewing.value = payload.orderItemId
  openProvision(`续费 · ${confirmItem.value?.name || ''}`)
  setProvision('running', 25, '提交续费…')
  try {
    const r = await enterpriseApi.renewSubscription(payload.orderItemId)
    if (r?.pool) pool.value = r.pool
    if (r?.duplicated) {
      setProvision('done', 100, '重复提交，本次未扣款', `到期时间 ${fmtDateTime(r?.expireAtAfter)}`)
    } else {
      setProvision('running', 60, '开通中…')
      const orderId = r?.portalOrderId ?? r?.orderId ?? null
      if (orderId) {
        const result = await pollProvision(orderId, {
          onTick: (i, total) => setProvision('running', 60 + Math.round((i / total) * 35), '开通中…')
        })
        if (result === 'done') setProvision('done', 100, '续费成功，套餐已生效', r?.expireAtAfter ? `新到期时间 ${fmtDateTime(r.expireAtAfter)}` : '')
        else if (result === 'failed') setProvision('failed', 100, '开通失败', '请到门户查看订单状态。')
        else setProvision('done', 100, '续费已完成', `到期时间 ${fmtDateTime(r?.expireAtAfter)}`)
      } else {
        setProvision('done', 100, '续费成功，套餐已生效', r?.expireAtAfter ? `新到期时间 ${fmtDateTime(r.expireAtAfter)}` : '')
      }
    }
    await Promise.all([loadPool(), loadSubscriptions()])
    await perm.load(true)
  } catch (e) {
    const msg = String(e?.message || '')
    // 续费节流（默认 3 秒）：不扣款、不延长，前端倒计时后再允许点击
    if (msg.includes('操作过于频繁')) {
      const sec = Number((msg.match(/(\d+)\s*秒/) || [])[1] || 3)
      startRenewCooldown(sec)
      setProvision('failed', 100, '操作过于频繁', `请 ${sec} 秒后再试（本次未扣款）`)
      return
    }
    if (msg.includes('已扣款但续费写入失败')) {
      setProvision('failed', 100, '续费未完成（费用已扣除）', '点击「重试」不会重复扣款')
      const retry = await ElMessageBox.confirm(
        '费用已扣除，但到期时间未更新。点击「重试」会复用同一笔幂等键，不会重复扣款。',
        '续费未完成',
        { confirmButtonText: '重试', cancelButtonText: '稍后处理', type: 'warning' }
      ).catch(() => false)
      if (retry) return runRenew(payload)
      return
    }
    setProvision('failed', 100, '续费失败', msg)
  } finally {
    renewing.value = 0
    // 续费成功或失败都重新拉一次余额，顶栏立即同步
    await billing.refreshWallet({ force: true })
  }
}
async function refreshAll() {
  loading.value = true
  try {
    await Promise.all([loadPool(), loadAllocations(), loadSubscriptions(), billing.loadWallet()])
  } finally {
    loading.value = false
  }
}

function openAllocate(row) {
  current.value = row
  gb.value = Math.round((row.allocatedBytes || 0) / GB)
  dialog.value = true
}

async function submit(bytes) {
  saving.value = true
  try {
    const res = await enterpriseApi.setAllocation(current.value.localUserId, bytes)
    // 后端直接返回变更后的池状态，不用再拉一次
    if (res?.pool) pool.value = res.pool
    ElMessage.success(bytes === 0 ? '已收回该成员的企业额度' : `已分配 ${formatSize(bytes)}`)
    dialog.value = false
    await loadAllocations()
    // 分配变化可能让企业从「超额」恢复（或进入超额），刷新上下文让全局横幅/按钮立即同步
    await perm.load(true)
  } catch (e) {
    // 40000（超额/超卖/不属于本企业）由拦截器原样提示
  } finally {
    saving.value = false
  }
}

// 前置校验：① 不能超过「已分配 + 池剩余」 ② 低于已用需二次确认（不删文件，但会禁止继续上传）
async function confirmAllocation(bytes) {
  const used = Number(current.value?.usedBytes || 0)
  const cap = Number(current.value?.allocatedBytes || 0) + Number(pool.value.availableBytes || 0)
  if (bytes > cap) {
    ElMessage.warning(`超出企业池剩余：本次最多可设 ${formatSize(cap)}`)
    return false
  }
  if (bytes < used) {
    const ok = await ElMessageBox.confirm(
      `该成员已使用 ${formatSize(used)}，调到 ${formatSize(bytes)} 后其已用会超出额度：不会删除文件，但会禁止继续上传。确定继续？`,
      '额度低于已使用量',
      { type: 'warning', confirmButtonText: '继续', cancelButtonText: '取消' }
    ).catch(() => false)
    return !!ok
  }
  return true
}

async function save() {
  const bytes = Math.round(Number(gb.value || 0) * GB)
  if (!(await confirmAllocation(bytes))) return
  submit(bytes)
}

async function revoke() {
  if (!(await confirmAllocation(0))) return
  submit(0)
}

onMounted(refreshAll)
</script>

<style scoped>
.sub-name { font-size: 13px; color: var(--cs-text-primary); }
.sub-sub { margin-top: 2px; font-size: 11px; color: var(--cs-text-tertiary); }
.page-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.page-title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 17px; font-weight: 600; color: var(--cs-text-primary); }

.over-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; padding: 10px 14px;
  border: 1px solid #f0c9c2; border-radius: var(--cs-radius-lg); background: #fdf2f0; font-size: 12.5px; color: #a33227; }
.over-icon { color: var(--cs-danger); font-size: 16px; flex: none; }
.over-text { flex: 1; min-width: 0; line-height: 1.5; }

.pool-card { padding: 16px 18px; margin-bottom: 14px; border-radius: var(--cs-radius-lg); box-shadow: var(--cs-shadow-sm); }
.pool-head { display: flex; align-items: center; justify-content: space-between; }
.pool-title { font-size: 13px; font-weight: 600; color: var(--cs-text-primary); }
.pool-pct { font-size: 12px; color: var(--cs-text-tertiary); font-variant-numeric: tabular-nums; }
.pool-pct.danger { color: var(--cs-danger); }
.pool-bar { margin: 12px 0 16px; }
.pool-metrics { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
.metric { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.metric-label { font-size: 11.5px; color: var(--cs-text-tertiary); }
.metric-value { font-size: 16px; font-weight: 700; color: var(--cs-text-primary); font-variant-numeric: tabular-nums;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.metric-value.small { font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 6px; }
.metric-value.accent { color: var(--cs-primary); }
.metric-value.danger, .danger { color: var(--cs-danger); }
.renew-link { padding: 0; height: auto; }

.table-card { padding: 0; overflow: hidden; border-radius: var(--cs-radius-lg); box-shadow: var(--cs-shadow-sm); margin-bottom: 14px; }
.panel-head { display: flex; align-items: center; gap: 8px; padding: 13px 16px; border-bottom: 1px solid var(--cs-border-light);
  font-size: 13px; font-weight: 600; color: var(--cs-text-primary); }
.panel-count { margin-left: auto; font-size: 11.5px; font-weight: 400; color: var(--cs-text-tertiary); }
.table-card :deep(.el-table th.el-table__cell) { background: var(--cs-bg-page); color: var(--cs-text-tertiary); font-size: 12px; font-weight: 600; }

.who { display: flex; align-items: center; gap: 8px; min-width: 0; }
.who-name { font-size: 13px; font-weight: 600; color: var(--cs-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.muted { color: var(--cs-text-tertiary); }

.usage { display: flex; flex-direction: column; gap: 4px; }
.usage-bar { width: 100%; }
.usage-text { font-size: 11.5px; color: var(--cs-text-tertiary); font-variant-numeric: tabular-nums; }
.sub-summary { margin-left: auto; display: flex; align-items: center; gap: 10px; font-size: 11.5px; font-weight: 400; color: var(--cs-text-tertiary); }
.sub-summary b { color: var(--cs-text-primary); font-weight: 600; font-variant-numeric: tabular-nums; }
.sub-summary .sep { color: var(--cs-text-disabled); }
.sub-date { font-size: 12px; color: var(--cs-text-tertiary); font-variant-numeric: tabular-nums; }
.remain { margin-left: 2px; }
.remain.soon { color: var(--cs-danger); font-weight: 700; }
.row-muted { color: var(--cs-text-disabled); }
.section :deep(.row-expiring > td), :deep(.row-expiring > td) { background: rgba(255, 77, 79, .06) !important; }
.sub-empty { padding: 22px 16px; font-size: 12px; text-align: center; color: var(--cs-text-tertiary); }

.alloc-body { display: flex; flex-direction: column; gap: 8px; }
.alloc-row { display: flex; justify-content: space-between; font-size: 13px; color: var(--cs-text-primary); }
.alloc-label { color: var(--cs-text-tertiary); }
.alloc-form { margin-top: 8px; position: relative; }
.alloc-form .unit { position: absolute; right: 42px; top: 50%; transform: translateY(-50%);
  font-size: 12px; color: var(--cs-text-tertiary); pointer-events: none; }
.dialog-footer { display: flex; justify-content: flex-end; gap: 8px; }

@media (max-width: 1180px) {
  .pool-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
