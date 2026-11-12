<template>
  <el-drawer
    :model-value="modelValue"
    direction="rtl"
    size="420px"
    class="oc-drawer"
    :show-close="true"
    :close-on-click-modal="false"
    @update:model-value="v => emit('update:modelValue', v)"
  >
    <template #header>
      <div class="oc-head">
        <div class="oc-head-main">
          <span class="oc-title">确认订单</span>
          <el-tag size="small" effect="plain" :type="kind === 'renew' ? 'warning' : 'primary'" class="oc-tag">
            {{ kind === 'renew' ? '续费' : '新购' }}
          </el-tag>
        </div>
        <span class="oc-sub">请确认以下信息，支付后立即生效</span>
      </div>
    </template>

    <div class="oc">
      <div class="oc-goods">
        <div class="oc-goods-name">{{ item.name || '--' }}</div>
        <div class="oc-goods-meta">
          <span v-if="unitQuotaText !== '--'" class="strong">{{ unitQuotaText }}{{ unitQuotaUnit }}</span>
          <span v-if="unitQuotaText !== '--'" class="dot">·</span>
          <span v-if="item.periodDays">{{ item.periodDays }} 天有效期</span>
          <span v-if="item.periodDays" class="dot">·</span>
          <span>{{ kind === 'renew' ? '到期后顺延' : '即时到账' }}</span>
        </div>
        <div v-if="expireText" class="oc-expire">{{ expireText }}</div>
        <div class="oc-qty">
          <span class="oc-qty-label">购买数量</span>
          <el-input-number
            v-if="editableQty"
            :model-value="quantity"
            :min="1"
            :max="maxQty"
            size="small"
            controls-position="right"
            class="oc-qty-input"
            @update:model-value="onQtyChange"
          />
          <span v-else class="oc-qty-readonly">× {{ quantity }}</span>
          <span v-if="editableQty" class="oc-qty-limit">单次最多 {{ maxQty }} 份</span>
          <span v-if="totalQuotaText" class="oc-qty-total">合计 {{ totalQuotaText }}{{ totalQuotaUnit }}</span>
        </div>
      </div>

      <div class="oc-amount">
        <div class="oc-amount-left">
          <span class="oc-amount-label">应付金额</span>
          <span class="oc-amount-hint">{{ editableQty ? `单价 ¥${unitPriceYuan} × ${quantity}` : '含税 · 无其他费用' }}</span>
        </div>
        <div class="oc-amount-value">
          <span class="cur">¥</span><span class="num">{{ totalPriceYuan }}</span>
        </div>
      </div>

      <div class="oc-wallet" :class="{ warn: insufficient || frozen }">
        <div class="oc-wallet-item">
          <span class="wallet-label">钱包余额</span>
          <span class="wallet-value">{{ balanceText }}</span>
        </div>
        <el-icon class="wallet-arrow"><Right /></el-icon>
        <div class="oc-wallet-item">
          <span class="wallet-label">支付后余额</span>
          <span class="wallet-value strong" :class="{ danger: insufficient }">{{ afterText || '--' }}</span>
        </div>
      </div>

      <div v-if="insufficient" class="oc-tip danger">
        <el-icon><WarningFilled /></el-icon>
        <span>余额不足，还差 ¥{{ lackYuan }}，请先充值或调整数量</span>
      </div>
      <div v-else-if="frozen" class="oc-tip danger">
        <el-icon><WarningFilled /></el-icon>
        <span>账户已被冻结，暂时无法支付</span>
      </div>
      <div v-else class="oc-tip">
        <el-icon><InfoFilled /></el-icon>
        <span>{{ kind === 'renew' ? '续费成功后有效期自动顺延，容量不变' : '支付成功后容量立即增加，可在「我的套餐」查看' }}</span>
      </div>
    </div>

    <template #footer>
      <div class="oc-footer">
        <el-button class="oc-cancel" @click="emit('update:modelValue', false)">取消</el-button>
        <el-button type="primary" class="oc-confirm" :disabled="insufficient || frozen" @click="emit('confirm')">
          确认支付 ¥{{ totalPriceYuan }}
        </el-button>
      </div>
    </template>
  </el-drawer>
</template>

<script setup>
import { computed } from 'vue'
import { InfoFilled, Right, WarningFilled } from '@element-plus/icons-vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // buy = 新购，renew = 续费
  kind: { type: String, default: 'buy' },
  // { name, unitQuotaGb, periodDays, unitPriceCents }
  item: { type: Object, default: () => ({}) },
  // 数量：购买时可改，续费由后端固定
  quantity: { type: Number, default: 1 },
  editableQty: { type: Boolean, default: false },
  maxQty: { type: Number, default: 10 },
  // 续费：原到期时间与延长天数（用于展示「到期 X → Y（+N 天）」）
  expireAtBefore: { type: String, default: '' },
  expireAtAfter: { type: String, default: '' },
  extendDays: { type: Number, default: 0 },
  // 钱包状态：known=false 表示查不到（本地账号/门户不可用），此时不拦支付
  walletKnown: { type: Boolean, default: false },
  balanceCents: { type: Number, default: 0 },
  balanceYuan: { type: String, default: '' },
  frozen: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'update:quantity', 'confirm'])

const qty = computed(() => Math.max(1, Number(props.quantity || 1)))

const unitPriceCents = computed(() => {
  const p = props.item || {}
  if (p.unitPriceCents != null) return Number(p.unitPriceCents)
  if (p.priceCents != null) return Number(p.priceCents)
  if (p.priceYuan != null) return Math.round(Number(p.priceYuan) * 100)
  return 0
})

const totalCents = computed(() => unitPriceCents.value * qty.value)
const unitPriceYuan = computed(() => (unitPriceCents.value / 100).toFixed(2))
const totalPriceYuan = computed(() => (totalCents.value / 100).toFixed(2))

function splitGb(gb) {
  const n = Number(gb || 0)
  if (!n) return { num: '--', unit: '' }
  return n >= 1024 ? { num: String(+(n / 1024).toFixed(n % 1024 === 0 ? 0 : 1)), unit: 'TB' } : { num: String(n), unit: 'GB' }
}
const unitQuotaText = computed(() => splitGb(props.item?.unitQuotaGb).num)
const unitQuotaUnit = computed(() => splitGb(props.item?.unitQuotaGb).unit)
const totalQuotaText = computed(() => {
  const gb = Number(props.item?.unitQuotaGb || 0)
  if (!gb) return ''
  return splitGb(gb * qty.value).num
})
const totalQuotaUnit = computed(() => splitGb(props.item?.unitQuotaGb).unit)

// 续费展示：到期 2026-11-29 → 2026-12-29（+30 天）
const expireText = computed(() => {
  const before = props.expireAtBefore
  const after = props.expireAtAfter
  const days = Number(props.extendDays || 0)
  if (!before && !after) return ''
  const fmt = v => {
    if (!v) return '--'
    const d = new Date(v)
    if (isNaN(d.getTime())) return '--'
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }
  const tail = days > 0 ? `（+${days} 天）` : ''
  if (before && after) return `到期 ${fmt(before)} → ${fmt(after)}${tail}`
  if (after) return `续费后到期 ${fmt(after)}${tail}`
  return `当前到期 ${fmt(before)}${tail}`
})

const balanceText = computed(() => {
  if (!props.walletKnown) return '暂不可查'
  return `¥${props.balanceYuan || (props.balanceCents / 100).toFixed(2)}`
})

const afterText = computed(() => {
  if (!props.walletKnown) return ''
  return `¥${((props.balanceCents - totalCents.value) / 100).toFixed(2)}`
})

const insufficient = computed(() => props.walletKnown && props.balanceCents < totalCents.value)
const lackYuan = computed(() => ((totalCents.value - props.balanceCents) / 100).toFixed(2))

function onQtyChange(v) {
  const n = Math.min(props.maxQty, Math.max(1, Number(v) || 1))
  emit('update:quantity', n)
}
</script>

<style scoped>
.oc-head { display: flex; flex-direction: column; gap: 4px; }
.oc-head-main { display: flex; align-items: center; gap: 8px; }
.oc-title { font-size: 17px; font-weight: 600; color: var(--cs-text-primary); letter-spacing: .2px; }
.oc-tag { flex: none; }
.oc-sub { font-size: 12px; color: var(--cs-text-tertiary); }

.oc { display: flex; flex-direction: column; gap: 14px; padding: 2px 0 4px; }

.oc-goods { padding: 14px 16px; border-radius: var(--cs-radius-lg);
  background: var(--cs-bg-page); border: 1px solid var(--cs-border-light); }
.oc-goods-name { font-size: 14px; font-weight: 600; color: var(--cs-text-primary); }
.oc-goods-meta { margin-top: 5px; font-size: 12px; color: var(--cs-text-tertiary); }
.oc-goods-meta .dot { margin: 0 6px; opacity: .6; }
.oc-goods-meta .strong { color: var(--cs-text-secondary); font-weight: 600; font-variant-numeric: tabular-nums; }

.oc-expire { margin-top: 10px; padding: 7px 10px; border-radius: 6px; background: rgba(22,119,255,.06);
  font-size: 11.5px; color: var(--cs-text-secondary); font-variant-numeric: tabular-nums; line-height: 1.6; }
.oc-qty { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding-top: 12px;
  border-top: 1px dashed var(--cs-border); }
.oc-qty-label { font-size: 12.5px; color: var(--cs-text-secondary); }
.oc-qty-input { width: 108px; }
.oc-qty-readonly { font-size: 13px; font-weight: 600; color: var(--cs-text-primary); }
.oc-qty-limit { margin-left: auto; font-size: 11px; color: var(--cs-text-tertiary); }
.oc-qty-total { font-size: 11.5px; color: var(--cs-text-tertiary); font-variant-numeric: tabular-nums; }

.oc-amount { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px;
  padding: 0 2px 12px; border-bottom: 1px dashed var(--cs-border); }
.oc-amount-left { display: flex; flex-direction: column; gap: 3px; }
.oc-amount-label { font-size: 13px; color: var(--cs-text-secondary); }
.oc-amount-hint { font-size: 11.5px; color: var(--cs-text-tertiary); }
.oc-amount-value { display: flex; align-items: baseline; color: var(--cs-primary); font-variant-numeric: tabular-nums; }
.oc-amount-value .cur { font-size: 15px; font-weight: 600; margin-right: 2px; }
.oc-amount-value .num { font-size: 30px; font-weight: 700; line-height: 1; letter-spacing: -.5px; }

.oc-wallet { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-radius: var(--cs-radius);
  background: var(--cs-bg-container); border: 1px solid var(--cs-border); }
.oc-wallet.warn { border-color: rgba(255,77,79,.35); background: rgba(255,77,79,.06); }
.oc-wallet-item { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.oc-wallet-item:last-child { text-align: right; }
.wallet-label { font-size: 11.5px; color: var(--cs-text-tertiary); }
.wallet-value { font-size: 14px; color: var(--cs-text-primary); font-variant-numeric: tabular-nums; }
.wallet-value.strong { font-weight: 600; }
.wallet-value.danger { color: var(--cs-danger); }
.wallet-arrow { color: var(--cs-text-disabled); font-size: 14px; flex: none; }

.oc-tip { display: flex; align-items: center; gap: 6px; font-size: 11.5px; line-height: 1.6; color: var(--cs-text-tertiary); }
.oc-tip .el-icon { font-size: 13px; flex: none; }
.oc-tip.danger { color: var(--cs-danger); }

.oc-footer { display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
.oc-cancel { min-width: 84px; }
.oc-confirm { min-width: 148px; font-weight: 600; }
/* 抽屉形态：右侧滑出，内容区独立滚动 */
:deep(.el-drawer__header) { margin-bottom: 0; padding: 16px 20px 12px; border-bottom: 1px solid var(--cs-border-light); }
:deep(.el-drawer__body) { padding: 18px 20px; overflow-y: auto; }
:deep(.el-drawer__footer) { padding: 12px 20px 16px; border-top: 1px solid var(--cs-border-light); }
</style>

<style>
.oc-dialog { border-radius: var(--cs-radius-xl); overflow: hidden; }
.oc-dialog .el-dialog__header { padding: 20px 22px 0; margin-right: 0; }
.oc-dialog .el-dialog__headerbtn { top: 16px; right: 14px; }
.oc-dialog .el-dialog__body { padding: 16px 22px 4px; }
.oc-dialog .el-dialog__footer { padding: 8px 22px 20px; }
</style>