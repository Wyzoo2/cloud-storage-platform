<template>
  <div class="cs-page">
    <div class="breadcrumb-bar">
      <div class="title-row">
      <h2 class="page-title"><el-icon><Goods /></el-icon>套餐增值</h2>
      </div>
      <el-button link :loading="loading" @click="refreshAll">
        <el-icon><Refresh /></el-icon>刷新
      </el-button>
    </div>

    <el-alert
      v-if="packagesError"
      class="deny-alert"
      type="error"
      show-icon
      :closable="false"
      title="套餐加载失败，请点右上角刷新重试"
    />
    <el-alert
      v-else-if="packages.denyReason"
      class="deny-alert"
      type="info"
      show-icon
      :closable="false"
      :title="packages.denyReason"
    />

    <!-- 在售套餐：左列表 + 右详情 -->
    <div class="pkg-ws">
      <section class="cs-card pkg-list" v-loading="loading">
        <header class="ws-head">
          <h3>在售套餐</h3>
          <span class="ws-count">{{ packages.list.length }} 个</span>
        </header>
        <div class="pkg-rows">
          <button
            v-for="p in packages.list"
            :key="p.skuId"
            class="pkg-row"
            :class="{ on: selectedSkuId === p.skuId, off: !canBuy(p) }"
            @click="selectedSkuId = p.skuId"
          >
            <span class="row-q">{{ fmtQuota(p.quotaGb).num }}<i>{{ fmtQuota(p.quotaGb).unit }}</i></span>
            <span class="row-main">
              <b>{{ p.name }}</b>
              <em>¥{{ p.priceYuan }} · {{ p.periodDays }} 天</em>
            </span>
            <span class="row-stock">{{ stockText(p) }}</span>
          </button>
          <el-empty v-if="!packages.list.length && !loading" description="暂无在售套餐" :image-size="64" />
        </div>
      </section>

      <section v-if="selectedPkg" class="cs-card pkg-detail">
        <header class="detail-head">
          <div class="detail-title">
            <span class="detail-kicker">套餐详情</span>
            <strong>{{ selectedPkg.name }}</strong>
          </div>
          <span class="stock-chip">{{ stockText(selectedPkg) }}</span>
        </header>

        <div class="detail-body">
          <div class="detail-hero">
            <div class="hero-num">{{ fmtQuota(selectedPkg.quotaGb).num }}<i>{{ fmtQuota(selectedPkg.quotaGb).unit }}</i></div>
            <div class="hero-price"><span>¥</span>{{ selectedPkg.priceYuan }}<em>/ {{ selectedPkg.periodDays }} 天</em></div>
          </div>

          <dl class="detail-spec">
            <div><dt>容量</dt><dd>{{ selectedPkg.quotaGb }} GB</dd></div>
            <div><dt>有效期</dt><dd>{{ selectedPkg.periodDays }} 天</dd></div>
            <div><dt>SKU</dt><dd class="mono">{{ selectedPkg.skuId }}</dd></div>
            <div v-if="selectedPkg.spec"><dt>规格</dt><dd>{{ selectedPkg.spec }}</dd></div>
          </dl>

          <p v-if="!canBuy(selectedPkg)" class="detail-deny">
            <el-icon><InfoFilled /></el-icon>
            <span>{{ selectedPkg.denyReason || packages.denyReason || '当前账号不可购买该套餐' }}</span>
          </p>

          <div class="detail-actions">
            <el-button
              type="primary"
              :disabled="!canBuy(selectedPkg)"
              :loading="buying === selectedPkg.skuId"
              class="buy-btn"
              @click="buy(selectedPkg)"
            >
              {{ canBuy(selectedPkg) ? '立即购买' : '不可购买' }}
            </el-button>
            <span class="detail-note">购买后容量立即进入可用配额，到期自动回收</span>
          </div>
        </div>
      </section>
    </div>

    <!-- 我的套餐 -->
    <div v-if="canSeeSubs" class="cs-card section">
      <div class="panel-head">
        <span>我的套餐</span>
        <div class="sub-summary">
          <span>有效 <b>{{ activeSubs.length }}</b> 笔</span>
          <template v-if="activeQuotaGb > 0">
            <span class="sep">|</span>
            <span>总容量 <b>{{ fmtQuota(activeQuotaGb).num }}{{ fmtQuota(activeQuotaGb).unit }}</b></span>
          </template>
          <template v-if="nextExpire">
            <span class="sep">|</span>
            <span>最近到期 <b>{{ formatDate(nextExpire) }}</b></span>
          </template>
        </div>
      </div>
      <div v-if="subsDenied" class="subs-denied">
        <el-icon><InfoFilled /></el-icon>
        <span>{{ subsDenied }}</span>
      </div>
      <el-table v-if="subscriptions.length" :data="subscriptions" size="small" style="width: 100%" row-key="orderItemId" :row-class-name="expiringRowClass">
        <el-table-column label="套餐" min-width="200">
          <template #default="{ row }">
            <div class="sub-name" :class="{ 'row-muted': expired(row) }">{{ row.skuName || row.skuId || '--' }}</div>
            <div class="sub-sub">
              {{ row.createdAt ? '开通 ' + formatDate(row.createdAt) : '' }}
              <span v-if="row.renewals"> · 已续费 {{ row.renewals }} 次</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="容量" min-width="190">
          <template #default="{ row }">
            <div class="sub-name" :class="{ 'row-muted': expired(row) }">{{ quotaBreakdown(row) }}</div>
            <div class="sub-sub" v-if="totalCentsOf(row) > 0">总价 ¥{{ (totalCentsOf(row) / 100).toFixed(2) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="isExpiring(row)" size="small" type="danger" effect="plain">即将到期</el-tag>
            <el-tag v-else size="small" :type="subState(row).type" effect="plain">
              {{ subState(row).text }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="到期" min-width="200">
          <template #default="{ row }">
            <span class="sub-date">
              {{ row.expireAt ? formatDate(row.expireAt) : '--' }}
              <span v-if="!expired(row)" class="remain" :class="{ soon: isExpiring(row) }">
                · {{ formatRemain(row.expireAt) }}
              </span>
              <span v-else-if="canRenew(row)" class="remain soon">· 已过期，续费后从今天起算一个周期</span>
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
      <div v-else class="sub-empty">暂无购买记录</div>
    </div>

    <OrderConfirmDialog
      v-model:quantity="confirmQty"
      :editable-qty="confirmEditableQty"
      :expire-at-before="confirmExpireBefore"
      :expire-at-after="confirmExpireAfter"
      :extend-days="confirmExtendDays"
      :max-qty="confirmMaxQty"
      v-model="confirmVisible"
      :kind="confirmKind"
      :item="confirmItem"
      :wallet-known="!!wallet"
      :balance-cents="wallet ? Number(wallet.balanceCents || 0) : 0"
      :balance-yuan="wallet ? wallet.balanceYuan : ''"
      :frozen="!!wallet?.frozen"
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
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Goods, Refresh } from '@element-plus/icons-vue'
import { billingApi, enterpriseApi, orderApi } from '@/api'
import OrderConfirmDialog from '@/components/OrderConfirmDialog.vue'
import ProvisionDialog from '@/components/ProvisionDialog.vue'
import { orderIdOf, pollProvision } from '@/utils/provision'
import { usePermissionStore } from '@/stores/permission'
import { useBillingStore } from '@/stores/billing'
import { formatDate, formatRemain, remainMs } from '@/utils/file'

const perm = usePermissionStore()
// 个人域（普通用户）可管理并续费自己的套餐；企业域仍只有企业管理员可见
const canSeeSubs = computed(() => perm.identity === 'personal' || perm.can('org.member.manage'))
// 后端拒绝时的提示（无权限 / 个人域接口未上线）
const subsDenied = ref('')
// 单次最多购买 10 份（产品限制，后端 quantity 上限 1000，这里按业务口径收窄）
const MAX_QTY = 10
const loading = ref(false)
const buying = ref('')
const renewing = ref(0)

const packages = ref({ total: 0, canPurchase: false, denyReason: '', buyerType: '', list: [] })
const subscriptions = ref([])
const packagesError = ref(false)

// 套餐详情：默认选中第一个在售套餐
const selectedSkuId = ref('')
const selectedPkg = computed(() =>
  packages.value.list.find(p => p.skuId === selectedSkuId.value) || packages.value.list[0] || null
)
watch(() => packages.value.list, list => {
  if (!list.length) { selectedSkuId.value = ''; return }
  if (!list.some(p => p.skuId === selectedSkuId.value)) selectedSkuId.value = list[0].skuId
}, { immediate: true })

/* ---------------- 摘要（数据驱动，不写死文案） ---------------- */
const activeSubs = computed(() => subscriptions.value.filter(s => !expired(s)))
const activeQuotaGb = computed(() =>
  activeSubs.value.reduce((sum, s) => sum + Number(s.totalQuotaGb ?? s.unitQuotaGb ?? 0), 0)
)
const nextExpire = computed(() => {
  const list = activeSubs.value.map(s => s.expireAt).filter(Boolean).sort()
  return list[0] || ''
})

// GB 超过 1024 进位成 TB，返回 { num, unit }
function fmtQuota(gb) {
  const n = Number(gb || 0)
  if (!n) return { num: '--', unit: '' }
  return n >= 1024 ? { num: String(+(n / 1024).toFixed(n % 1024 === 0 ? 0 : 1)), unit: 'TB' } : { num: String(n), unit: 'GB' }
}

// 库存：后端 stock=null 表示不限量
function stockText(p) {
  return p.stock == null ? '现货' : (Number(p.stock) > 0 ? `剩 ${p.stock}` : '已售罄')
}

/* ---------------- 下单确认弹窗（显示花费与余额） ---------------- */
const confirmVisible = ref(false)
const confirmTitle = ref('确认订单')
const confirmItem = ref({})
const confirmKind = ref('buy')
const pendingOrder = ref(null) // 确认后要提交的下单参数
const confirmQty = ref(1)      // 购买数量（续费由后端固定）
const confirmEditableQty = ref(false)
const confirmMaxQty = ref(10)
const confirmExpireBefore = ref('')
const confirmExpireAfter = ref('')
const confirmExtendDays = ref(0)

function askConfirm(title, item, payload, opts = {}) {
  confirmTitle.value = title
  confirmItem.value = item
  confirmKind.value = payload?.orderItemId ? 'renew' : 'buy'
  confirmQty.value = Number(opts.quantity || item.quantity || 1)
  confirmEditableQty.value = !!opts.editableQty
  confirmMaxQty.value = Number(opts.maxQty || 10)
  pendingOrder.value = payload
  confirmVisible.value = true
}

// 下单幂等键：8~64 位，只允许 [A-Za-z0-9._:-]
function makeOrderKey(skuId) {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  const rand = Math.random().toString(36).slice(2, 8)
  return `buy.${stamp}.${String(skuId || 'sku').replace(/[^A-Za-z0-9]/g, '')}.${rand}`
}

function onConfirmed() {
  confirmVisible.value = false
  const payload = pendingOrder.value
  if (!payload) return
  pendingOrder.value = null
  // 续费走一步式 /billing/subscriptions/{id}/renew，购买走 POST /orders
  if (payload.orderItemId) runRenew(payload)
  else runOrder(confirmTitle.value, { ...payload, quantity: Math.min(MAX_QTY, Math.max(1, Number(confirmQty.value) || 1)) })
}

/* ---------------- 开通进度弹窗：开通结束前不可关闭 ---------------- */
const provVisible = ref(false)
const provTitle = ref('开通中')
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

// 已回收的套餐不可续费（需重新购买）；账号不可购买时也不可续费
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
  const st = String(row?.status || '').toLowerCase()
  if (st === 'reclaimed' || st === 'failed') return false   // 已回收 / 开通失败：只能重新购买
  if (perm.identity === 'personal') return true             // 普通用户：自己的套餐可续费
  return !!packages.value.canPurchase                       // 企业域：仍只有企业管理员可续费
}

function renewTip(row) {
  if (renewCooldown.value > 0) return `请 ${renewCooldown.value} 秒后再试`
  const st = String(row?.status || '').toLowerCase()
  if (st === 'reclaimed') return '该套餐已回收，无法续费，请重新购买'
  if (st === 'failed') return '该套餐开通失败，无法续费，请重新购买'
  if (perm.identity !== 'personal' && !packages.value.canPurchase) {
    return packages.value.denyReason || '当前账号不可续费'
  }
  return ''
}

function canBuy(p) {
  return !!packages.value.canPurchase && p.canPurchase !== false
}

// 7 天内到期（含剩不到 1 天、按小时显示的情况）→ 整行淡红底 + 状态「即将到期」
// 容量三段式：数量 × 单份 = 总量（文档要求）
// 单份价格（分）：企业域 row.priceCents 是单份价，个人域也只有单份价
function unitCents(row) {
  return Number(row.unitPriceCents ?? row.priceCents ?? 0)
}

// 该笔总价（分）：优先后端总价，否则单份 × 数量
function totalCentsOf(row) {
  if (row.totalPriceCents != null) return Number(row.totalPriceCents)
  const qty = Number(row.quantity || 1)
  return unitCents(row) * (qty > 0 ? qty : 1)
}

// 状态描述：企业域 active/grace/reclaimed，个人域 pending/granting/active/grace/expired/failed
function subState(row) {
  const st = String(row?.status || '').toLowerCase()
  if (st === 'failed') return { text: '开通失败', type: 'danger' }
  if (st === 'pending' || st === 'granting') return { text: '开通中', type: 'warning' }
  if (st === 'reclaimed') return { text: '已回收', type: 'info' }
  if (expired(row)) return { text: '已到期', type: 'info' }
  if (st === 'grace') return { text: '宽限期', type: 'warning' }
  return { text: '有效', type: 'success' }
}

function quotaBreakdown(row) {
  const qty = Number(row.quantity || 1)
  const unit = Number(row.unitQuotaGb ?? row.quotaGb ?? 0)
  const total = Number(row.totalQuotaGb ?? unit * qty)
  const totalText = `${fmtQuota(total).num}${fmtQuota(total).unit}`
  if (!unit) return totalText
  const unitText = `${fmtQuota(unit).num}${fmtQuota(unit).unit}`
  return qty > 1 ? `${qty} × ${unitText} = ${totalText}` : unitText
}

const EXPIRING_MS = 7 * 24 * 3600 * 1000
function isExpiring(row) {
  if (expired(row)) return false
  const ms = remainMs(row.expireAt)
  return ms !== null && ms > 0 && ms <= EXPIRING_MS
}

function expiringRowClass({ row }) {
  return isExpiring(row) ? 'row-expiring' : ''
}

function expired(row) {
  if (row.expired != null) return !!row.expired
  if (row.status === 'reclaimed') return true
  return row.expireAt ? new Date(row.expireAt).getTime() < Date.now() : false
}

async function loadPackages() {
  try {
    packages.value = await billingApi.packages()
    packages.value.list = packages.value.list || []
    packagesError.value = false
  } catch (e) {
    packages.value = { total: 0, canPurchase: false, denyReason: '', buyerType: '', list: [] }
    packagesError.value = true
  }
}

async function loadSubscriptions() {
  if (!canSeeSubs.value) { subscriptions.value = []; subsDenied.value = ''; return }
  try {
    // 个人域读自己的开通记录（裸数组），企业域读企业池清单（{ total, list }）
    const res = perm.identity === 'personal'
      ? await enterpriseApi.mySubscriptions()
      : await enterpriseApi.subscriptions()
    subscriptions.value = Array.isArray(res) ? res : (res?.list || [])
    subsDenied.value = ''
  } catch (e) {
    subscriptions.value = []
    const msg = String(e?.message || '')
    if (/只在企业内可用|个人域|未上线|404/.test(msg)) {
      subsDenied.value = '当前版本后端未提供个人套餐记录接口，续费功能需后端上线后自动可用'
    } else if (/权限|40301|FORBIDDEN/.test(msg)) {
      subsDenied.value = '当前角色没有查看套餐记录的权限，请联系管理员分配'
    } else {
      subsDenied.value = ''
    }
  }
}

// 余额统一走 billing store：顶栏与弹窗共用同一份数据，花钱后刷新一次两边都同步
const billing = useBillingStore()
const wallet = computed(() => (billing.walletState === 'ok' ? billing.wallet : null))

async function loadWallet(force = false) {
  await billing.refreshWallet({ force })
}
async function refreshAll() {
  loading.value = true
  try {
    await Promise.all([loadPackages(), loadSubscriptions(), loadWallet()])
  } finally {
    loading.value = false
  }
}

// 下单：仅对 50000（依赖服务不可用）重试 3 次，复用同一 clientOrderKey
async function createOrderWithRetry(payload) {
  let lastErr = null
  for (let i = 0; i < 3; i++) {
    try {
      return await orderApi.create(payload)
    } catch (e) {
      lastErr = e
      if (Number(e?.code) !== 50000) throw e
      setProvision('running', 20 + i * 5, `提交订单…（第 ${i + 1} 次重试）`)
      await new Promise(r => setTimeout(r, 1000))
    }
  }
  throw lastErr
}

// 下单 → 轮询开通，全过程在弹窗里展示，结束前不允许关闭
async function runOrder(title, payload) {
  openProvision(title)
  setProvision('running', 20, '提交订单…')
  try {
    // 下单幂等键在点击时就已生成（payload.clientOrderKey），重试复用同一把键；
    // 只有系统类错误（50000 依赖服务不可用）才重试，业务错误直接抛给上层
    const order = await createOrderWithRetry(payload)
    const orderId = orderIdOf(order)
    if (!orderId) {
      setProvision('timeout', 80, '订单已提交，开通结果待确认', '请稍后刷新查看，或到门户核对订单状态。')
    } else {
      setProvision('running', 45, '开通中…')
      const result = await pollProvision(orderId, {
        onTick: (i, total) => setProvision('running', 45 + Math.round((i / total) * 50), '开通中…')
      })
      if (result === 'done') setProvision('done', 100, '套餐已生效')
      else if (result === 'failed') setProvision('failed', 100, '开通失败', '请到门户查看订单状态。')
      else setProvision('timeout', 95, '开通结果待确认', '门户响应较慢，请稍后刷新查看。')
    }
    await Promise.all([loadPackages(), loadSubscriptions()])
  } catch (e) {
    setProvision('failed', 100, '下单失败', e?.message || '')
  } finally {
    // 成功或失败都刷新一次余额，顶栏立即同步
    await billing.refreshWallet({ force: true })
  }
}

async function buy(p) {
  // 预检：冻结 / 余额不足 都不发起下单
  if (wallet.value?.frozen) return ElMessage.warning('账户已被冻结，请联系客服')
  // 先确认买几份、花多少钱，确认后才真正下单
  askConfirm(
    `购买 · ${p.name}`,
    { name: p.name, unitQuotaGb: p.quotaGb, periodDays: p.periodDays, unitPriceCents: p.priceCents },
    { skuId: p.skuId, clientOrderKey: makeOrderKey(p.skuId) },
    { editableQty: true, quantity: 1, maxQty: MAX_QTY }
  )
}
async function renew(row) {
  // 已回收的套餐后端不再提供续费，前端直接拦住
  if (row?.status === 'reclaimed') return ElMessage.warning('该套餐已回收，无法续费，请重新购买')
  if (!wallet.value) await loadWallet()
  const qty = Number(row.quantity || 1)
  const totalQuotaGb = Number(row.totalQuotaGb ?? row.unitQuotaGb ?? row.quotaGb ?? 0)
  const totalCents = totalCentsOf(row)
  const days = Number(row.periodDays || row.extendDays || 30)
  const before = row.expireAt || ''
  // 续费确认弹窗必须写清：金额、延长天数、新旧到期时间（文档 §2.4）
  askConfirm(
    `续费 · ${row.skuName || row.skuId || ''}`,
    {
      name: row.skuName || row.skuId,
      unitQuotaGb: qty > 0 ? totalQuotaGb / qty : totalQuotaGb,
      periodDays: days,
      unitPriceCents: qty > 0 ? Math.round(totalCents / qty) : totalCents
    },
    { orderItemId: row.orderItemId },
    {
      editableQty: false,
      quantity: qty,
      expireAtBefore: before,
      expireAtAfter: addDaysIso(before, days),
      extendDays: days
    }
  )
}

function fmtDateTime(iso) {
  if (!iso) return '--'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '--'
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 在 ISO 时间上加 N 天（仅用于确认弹窗展示，真实值以后端返回为准）
function addDaysIso(iso, days) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  d.setDate(d.getDate() + Number(days || 0))
  return d.toISOString()
}

// 续费成功后原地更新「原来那一行」：只改到期时间与续费次数，不新增行
// （后端 2a2d739 起续费不再产生新的开通记录，列表行数应与续费前一致）
// 续费结果的「原到期 → 新到期 + 扣费」，用于进度弹窗副文案
function renewResultText(r) {
  const before = r?.expireAtBefore
  const after = r?.expireAtAfter
  const yuan = r?.priceYuan != null ? `扣费 ¥${r.priceYuan}` : ''
  if (before && after) {
    return `${fmtDateTime(before)} → ${fmtDateTime(after)}${yuan ? '　' + yuan : ''}`
  }
  if (after) return `新到期时间 ${fmtDateTime(after)}${yuan ? '　' + yuan : ''}`
  return yuan
}

function applyRenewResult(orderItemId, r) {
  const idx = subscriptions.value.findIndex(s => String(s.orderItemId) === String(orderItemId))
  if (idx < 0) return
  const cur = subscriptions.value[idx]
  const renewals = Number(cur.renewals || 0) + (r?.duplicated ? 0 : 1)
  subscriptions.value.splice(idx, 1, {
    ...cur,
    expireAt: r?.expireAtAfter || cur.expireAt,
    renewals,
    // 续费后必然重新有效：清掉已到期标记，状态回到 active
    expired: false,
    status: String(cur.status || '').toLowerCase() === 'failed' ? cur.status : 'active'
  })
}

async function runRenew(payload) {
  renewing.value = payload.orderItemId
  openProvision(`续费 · ${confirmItem.value?.name || ''}`)
  setProvision('running', 25, '提交续费…')
  try {
    // 续费只调一个接口（不再走 /orders），后端直接延长旧开通
    const r = await enterpriseApi.renewSubscription(payload.orderItemId)
    if (r?.duplicated) {
      setProvision('done', 100, '重复提交，本次未扣款', renewResultText(r))
    } else {
      setProvision('running', 60, '开通中…')
      const orderId = r?.portalOrderId ?? r?.orderId ?? null
      if (orderId) {
        const result = await pollProvision(orderId, {
          onTick: (i, total) => setProvision('running', 60 + Math.round((i / total) * 35), '开通中…')
        })
        if (result === 'done') setProvision('done', 100, '续费成功，套餐已生效', renewResultText(r))
        else if (result === 'failed') setProvision('failed', 100, '开通失败', '请到门户查看订单状态。')
        else setProvision('done', 100, '续费已完成', renewResultText(r))
      } else {
        setProvision('done', 100, '续费成功，套餐已生效', renewResultText(r))
      }
    }
    // 原地更新那一行（后端 2a2d739 起续费只改原行、不新增记录）
    applyRenewResult(payload.orderItemId, r)
    // 不再全量重拉订阅：行已是最新，全量拉取在回调时序未落库时会把界面回退成旧到期时间
    await loadPackages()
  } catch (e) {
    const msg = String(e?.message || '')
    // 续费节流（默认 3 秒）：不扣款、不延长，前端倒计时后再允许点击
    if (msg.includes('操作过于频繁')) {
      const sec = Number((msg.match(/(\d+)\s*秒/) || [])[1] || 3)
      startRenewCooldown(sec)
      setProvision('failed', 100, '操作过于频繁', `请 ${sec} 秒后再试（本次未扣款）`)
      return
    }
    // 已扣款但写入失败：引导用户重试同一笔（重试复用幂等键，不会重复扣款）
    if (msg.includes('已扣款但续费写入失败')) {
      setProvision('failed', 100, '续费未完成（费用已扣除）', '点击下方「重试」不会重复扣款')
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
    // 成功或失败都刷新一次余额，顶栏立即同步
    await billing.refreshWallet({ force: true })
  }
}
onMounted(refreshAll)
</script>

<style scoped>
.subs-denied { display: flex; align-items: center; gap: 6px; padding: 10px 16px;
  font-size: 12px; color: var(--cs-text-tertiary); background: var(--cs-bg-page);
  border-top: 1px solid var(--cs-border-light); }

.sub-name { font-size: 13px; color: var(--cs-text-primary); }
.sub-sub { margin-top: 2px; font-size: 11px; color: var(--cs-text-tertiary); }
.page-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 14px; }
.page-title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 17px; font-weight: 600; color: var(--cs-text-primary); }

.deny-alert { margin-bottom: 14px; }

/* 区块卡片 */
.section { padding: 0; overflow: hidden; border-radius: var(--cs-radius-lg); box-shadow: var(--cs-shadow-sm); margin-bottom: 14px; }
.panel-head { display: flex; align-items: center; gap: 10px; padding: 13px 16px;
  border-bottom: 1px solid var(--cs-border-light); font-size: 13px; font-weight: 600; color: var(--cs-text-primary); }
.panel-count { margin-left: auto; font-size: 11.5px; font-weight: 400; color: var(--cs-text-tertiary); }
.sub-summary { margin-left: auto; display: flex; align-items: center; gap: 10px; font-size: 11.5px; font-weight: 400; color: var(--cs-text-tertiary); }
.sub-summary b { color: var(--cs-text-primary); font-weight: 600; font-variant-numeric: tabular-nums; }
.sub-summary .sep { color: var(--cs-text-disabled); }

/* 套餐卡 */
.pkg-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 14px; padding: 16px; }
.pkg-card { display: flex; flex-direction: column; gap: 6px; padding: 16px; border-radius: var(--cs-radius-lg);
  background: var(--cs-bg-page); border: 1px solid var(--cs-border-light);
  transition: border-color var(--cs-transition), box-shadow var(--cs-transition), transform var(--cs-transition); }
.pkg-card:hover { border-color: var(--cs-primary-light); box-shadow: var(--cs-shadow); transform: translateY(-2px); }
.pkg-card.disabled { opacity: .66; }
.pkg-card.disabled:hover { transform: none; border-color: var(--cs-border-light); box-shadow: none; }
.pkg-area { display: flex; align-items: baseline; gap: 4px; }
.area-num { font-size: 28px; font-weight: 700; line-height: 1.1; color: var(--cs-primary); font-variant-numeric: tabular-nums; letter-spacing: -.5px; }
.area-unit { font-size: 12.5px; font-weight: 600; color: var(--cs-primary); opacity: .72; }
.pkg-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.pkg-stock { flex: none; font-size: 10.5px; padding: 1px 6px; border-radius: 3px;
  background: var(--cs-primary-lighter); color: var(--cs-primary); }
.pkg-name { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--cs-text-secondary); }
.pkg-lines { display: flex; flex-direction: column; gap: 4px; margin-top: 2px; padding-top: 8px;
  border-top: 1px dashed var(--cs-border); }
.pkg-line { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; font-size: 11.5px; color: var(--cs-text-tertiary); }
.pkg-line b { font-weight: 600; color: var(--cs-text-primary); font-variant-numeric: tabular-nums; }
.pkg-btn-wrap { display: block; margin-top: auto; }
.pkg-btn { width: 100%; }
.pkg-empty { grid-column: 1 / -1; padding: 12px 0 20px; }

/* 我的套餐表格 */
.sub-date { font-size: 12px; color: var(--cs-text-tertiary); font-variant-numeric: tabular-nums; }
.remain { margin-left: 2px; }
.remain.soon { color: var(--cs-danger); font-weight: 700; }
.row-muted { color: var(--cs-text-disabled); }
/* 7 天内到期：整行淡红 + 「剩 N 天」红字加粗 */
.section :deep(.row-expiring > td) { background: rgba(255, 77, 79, .06) !important; }
.section :deep(.row-expiring:hover > td) { background: rgba(255, 77, 79, .10) !important; }
.sub-empty { padding: 22px 16px; font-size: 12px; text-align: center; color: var(--cs-text-tertiary); }
.section :deep(.el-table th.el-table__cell) { background: var(--cs-bg-page); color: var(--cs-text-tertiary); font-size: 12px; font-weight: 600; }

/* ---------- 在售套餐：列表 + 详情 ---------- */
.pkg-ws { display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 12px; margin-bottom: 14px; align-items: start; }
.ws-count { font-size: 11px; color: var(--cs-text-tertiary); }
.pkg-rows { padding: 6px; display: flex; flex-direction: column; gap: 2px; max-height: 460px; overflow-y: auto; }
.pkg-row {
  display: grid;
  grid-template-columns: 62px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 10px;
  border: 1px solid transparent;
  border-radius: var(--cs-radius);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background var(--cs-transition), border-color var(--cs-transition);
}
.pkg-row:hover { background: var(--cs-bg-hover); }
.pkg-row.on { background: var(--cs-primary-lighter); border-color: rgba(79, 70, 229, 0.28); }
.pkg-row.off { opacity: 0.62; }
.row-q { font-family: var(--cs-mono); font-size: 15px; font-weight: 600; color: var(--cs-text-primary); letter-spacing: -0.03em; }
.row-q i { font-style: normal; font-size: 9.5px; margin-left: 2px; color: var(--cs-text-tertiary); letter-spacing: 0.04em; }
.row-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.row-main b { font-size: 12px; font-weight: 600; color: var(--cs-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row-main em { font-style: normal; font-size: 10.5px; color: var(--cs-text-tertiary); }
.row-stock { font-size: 10px; color: var(--cs-text-tertiary); white-space: nowrap; }

.pkg-detail { overflow: hidden; }
.detail-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--cs-border-light); }
.detail-title { display: flex; flex-direction: column; gap: 2px; }
.detail-kicker { font-size: 9.5px; letter-spacing: 0.14em; color: var(--cs-text-tertiary); }
.detail-title strong { font-size: 14px; font-weight: 600; color: var(--cs-text-primary); }
.stock-chip { font-size: 10.5px; color: var(--cs-text-secondary); border: 1px solid var(--cs-border-light); border-radius: 2px; padding: 2px 6px; background: var(--cs-bg-page); }

.detail-body { padding: 18px 16px 16px; }
.detail-hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.hero-num { font-family: var(--cs-mono); font-size: 44px; font-weight: 600; line-height: 1; letter-spacing: -0.05em; color: var(--cs-text-primary); }
.hero-num i { font-style: normal; font-size: 13px; margin-left: 4px; color: var(--cs-text-tertiary); letter-spacing: 0.04em; }
.hero-price { font-family: var(--cs-mono); font-size: 20px; font-weight: 600; color: var(--cs-primary); letter-spacing: -0.02em; }
.hero-price span { font-size: 12px; margin-right: 1px; }
.hero-price em { font-style: normal; font-size: 10.5px; font-weight: 400; color: var(--cs-text-tertiary); margin-left: 4px; font-family: inherit; }

.detail-spec { margin: 18px 0 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1px; background: var(--cs-border-light); border: 1px solid var(--cs-border-light); border-radius: var(--cs-radius); overflow: hidden; }
.detail-spec > div { background: var(--cs-bg-container); padding: 9px 12px; display: flex; justify-content: space-between; gap: 10px; }
.detail-spec dt { font-size: 11px; color: var(--cs-text-tertiary); }
.detail-spec dd { margin: 0; font-size: 11.5px; color: var(--cs-text-primary); }

.detail-deny { display: flex; align-items: center; gap: 6px; margin: 14px 0 0; font-size: 11px; color: var(--cs-warning); }
.detail-actions { display: flex; align-items: center; gap: 12px; margin-top: 18px; flex-wrap: wrap; }
.buy-btn { min-width: 132px; height: 34px; }
.detail-note { font-size: 10.5px; color: var(--cs-text-tertiary); }

@media (max-width: 900px) {
  .pkg-ws { grid-template-columns: minmax(0, 1fr); }
  .pkg-rows { max-height: none; }
  .hero-num { font-size: 34px; }
}
</style>
