<template>
  <div class="cs-page">
    <div class="page-head">
      <h2 class="page-title"><el-icon><Goods /></el-icon>套餐增值</h2>
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

    <!-- 在售套餐 -->
    <div class="cs-card section" v-loading="loading">
      <div class="panel-head">
        <span>在售套餐</span>
        <span class="panel-count">{{ packages.list.length }} 个</span>
      </div>
      <div class="pkg-grid">
        <div v-for="p in packages.list" :key="p.skuId" class="pkg-card" :class="{ disabled: !canBuy(p) }">
          <div class="pkg-top">
            <div class="pkg-area">
              <span class="area-num">{{ fmtQuota(p.quotaGb).num }}</span>
              <span class="area-unit">{{ fmtQuota(p.quotaGb).unit }}</span>
            </div>
            <span class="pkg-stock">{{ stockText(p) }}</span>
          </div>
          <div class="pkg-name">
            {{ p.name }}
          </div>
          <div class="pkg-lines">
            <div class="pkg-line"><span>价格</span><b>¥{{ p.priceYuan }}</b></div>
            <div class="pkg-line"><span>有效期</span><b>{{ p.periodDays }} 天</b></div>
            <div v-if="p.spec" class="pkg-line"><span>规格</span><b>{{ p.spec }}</b></div>
          </div>
          <el-tooltip :disabled="canBuy(p)" :content="p.denyReason || packages.denyReason || '当前账号不可购买'" placement="top">
            <span class="pkg-btn-wrap">
              <el-button
                type="primary"
                :disabled="!canBuy(p)"
                :loading="buying === p.skuId"
                class="pkg-btn"
                @click="buy(p)"
              >
                {{ canBuy(p) ? '立即购买' : '不可购买' }}
              </el-button>
            </span>
          </el-tooltip>
        </div>
        <el-empty v-if="!packages.list.length && !loading" description="暂无在售套餐" :image-size="78" class="pkg-empty" />
      </div>
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
      <el-table v-if="subscriptions.length" :data="subscriptions" size="small" style="width: 100%" row-key="orderItemId" :row-class-name="expiringRowClass">
        <el-table-column label="套餐" min-width="180">
          <template #default="{ row }">
            <span :class="{ 'row-muted': expired(row) }">{{ row.skuName || row.skuId || '--' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="容量" width="110" align="right">
          <template #default="{ row }">
            <span :class="{ 'row-muted': expired(row) }">{{ fmtQuota(row.totalQuotaGb ?? row.unitQuotaGb ?? row.quotaGb).num }}{{ fmtQuota(row.totalQuotaGb ?? row.unitQuotaGb ?? row.quotaGb).unit }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="isExpiring(row)" size="small" type="danger" effect="plain">即将到期</el-tag>
            <el-tag v-else size="small" :type="expired(row) ? 'info' : 'success'" effect="plain">
              {{ expired(row) ? (row.status === 'reclaimed' ? '已回收' : '已到期') : '有效' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="到期" min-width="220">
          <template #default="{ row }">
            <span class="sub-date">
              {{ row.expireAt ? formatDate(row.expireAt) : '--' }}
              <span v-if="!expired(row)" class="remain" :class="{ soon: isExpiring(row) }">
                · {{ formatRemain(row.expireAt) }}
              </span>
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
      :max-qty="1000"
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
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Goods, Refresh } from '@element-plus/icons-vue'
import { billingApi, enterpriseApi, orderApi } from '@/api'
import OrderConfirmDialog from '@/components/OrderConfirmDialog.vue'
import ProvisionDialog from '@/components/ProvisionDialog.vue'
import { orderIdOf, pollProvision } from '@/utils/provision'
import { usePermissionStore } from '@/stores/permission'
import { formatDate, formatRemain, remainMs } from '@/utils/file'

const perm = usePermissionStore()
const canSeeSubs = computed(() => perm.can('org.member.manage'))
const loading = ref(false)
const buying = ref('')
const renewing = ref(0)

const packages = ref({ total: 0, canPurchase: false, denyReason: '', buyerType: '', list: [] })
const subscriptions = ref([])
const wallet = ref(null)
const packagesError = ref(false)

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

function askConfirm(title, item, payload, opts = {}) {
  confirmTitle.value = title
  confirmItem.value = item
  confirmKind.value = payload?.orderItemId ? 'renew' : 'buy'
  confirmQty.value = Number(opts.quantity || item.quantity || 1)
  confirmEditableQty.value = !!opts.editableQty
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
  else runOrder(confirmTitle.value, { ...payload, quantity: confirmQty.value })
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
function canRenew(row) {
  return !!packages.value.canPurchase && row?.status !== 'reclaimed'
}

function renewTip(row) {
  if (row?.status === 'reclaimed') return '该套餐已回收，无法续费，请重新购买'
  if (!packages.value.canPurchase) return packages.value.denyReason || '当前账号不可购买'
  return ''
}

function canBuy(p) {
  return !!packages.value.canPurchase && p.canPurchase !== false
}

// 7 天内到期（含剩不到 1 天、按小时显示的情况）→ 整行淡红底 + 状态「即将到期」
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
  // 订阅清单需要 org.member.manage（普通成员调用会 40301），没权限就不发请求
  if (!canSeeSubs.value) { subscriptions.value = []; return }
  try {
    const res = await enterpriseApi.subscriptions()
    subscriptions.value = res?.list || []
  } catch (e) {
    subscriptions.value = []
  }
}

// 余额只用于预检与展示；查不到不影响下单
async function loadWallet() {
  try {
    wallet.value = await billingApi.wallet()
  } catch (e) {
    wallet.value = null
  }
}

async function refreshAll() {
  loading.value = true
  try {
    await Promise.all([loadPackages(), loadSubscriptions(), loadWallet()])
  } finally {
    loading.value = false
  }
}

// 下单 → 轮询开通，全过程在弹窗里展示，结束前不允许关闭
async function runOrder(title, payload) {
  openProvision(title)
  setProvision('running', 20, '提交订单…')
  try {
    const order = await orderApi.create(payload)
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
    await refreshAll()
  } catch (e) {
    setProvision('failed', 100, '下单失败', e?.message || '')
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
    { editableQty: true, quantity: 1 }
  )
}
async function renew(row) {
  // 已回收的套餐后端不再提供续费，前端直接拦住
  if (row?.status === 'reclaimed') return ElMessage.warning('该套餐已回收，无法续费，请重新购买')
  if (!wallet.value) await loadWallet()
  const qty = Number(row.quantity || 1)
  const totalQuotaGb = Number(row.totalQuotaGb ?? row.unitQuotaGb ?? row.quotaGb ?? 0)
  const totalCents = Number(row.totalPriceCents ?? row.priceCents ?? 0)
  askConfirm(
    `续费 · ${row.skuName || row.skuId || ''}`,
    {
      name: row.skuName || row.skuId,
      unitQuotaGb: qty > 0 ? totalQuotaGb / qty : totalQuotaGb,
      periodDays: row.periodDays || row.extendDays,
      unitPriceCents: qty > 0 ? Math.round(totalCents / qty) : totalCents
    },
    { orderItemId: row.orderItemId },
    { editableQty: false, quantity: qty }
  )
}
async function runRenew(payload) {
  renewing.value = payload.orderItemId
  openProvision(`续费 · ${confirmItem.value?.name || ''}`)
  setProvision('running', 25, '提交续费…')
  try {
    const r = await enterpriseApi.renewSubscription(payload.orderItemId)
    setProvision('running', 60, '开通中…')
    const orderId = r?.portalOrderId ?? r?.orderId ?? null
    if (orderId) {
      const result = await pollProvision(orderId, {
        onTick: (i, total) => setProvision('running', 60 + Math.round((i / total) * 35), '开通中…')
      })
      if (result === 'done') setProvision('done', 100, '续费成功，套餐已生效')
      else if (result === 'failed') setProvision('failed', 100, '开通失败', '请到门户查看订单状态。')
      else setProvision('done', 100, '续费已完成', '开通状态仍需门户确认，可稍后刷新查看。')
    } else {
      setProvision('done', 100, '续费成功，套餐已生效')
    }
    await refreshAll()
  } catch (e) {
    setProvision('failed', 100, '续费失败', e?.message || '')
  } finally {
    renewing.value = 0
  }
}
onMounted(refreshAll)
</script>

<style scoped>
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
</style>
