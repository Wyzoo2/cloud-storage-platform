<template>
  <div class="cs-page">
    <div class="breadcrumb-bar">
      <h2 class="page-title"><el-icon><Setting /></el-icon>计费配置</h2>
    </div>

    <div class="cs-card" style="padding:24px" v-loading="loading">
      <el-form label-width="150px">
        <el-form-item label="免费额度（GB）">
          <div class="form-item-content">
            <div class="input-row">
              <el-input-number v-model="freeGb" :min="0" :max="1048576" :step="1" :precision="1" style="width:200px" />
              <span class="unit-text">GB</span>
            </div>
            <div class="hint-text">换算为 {{ freeBytesFromGb.toLocaleString() }} 字节 · 仅影响此后新注册用户（R3 快照制），已注册用户额度不变</div>
          </div>
        </el-form-item>

        <el-form-item label="存储单价（元 / GB / 月）">
          <div class="form-item-content">
            <div class="input-row">
              <el-input-number v-model="priceYuan" :min="0" :step="0.1" :precision="2" style="width:200px" />
              <span class="unit-text">元 / GB / 月</span>
            </div>
            <div class="hint-text">换算为 {{ centsFromYuan }} 分 / GB / 月 · 影响此后所有新购增额申请的价格试算</div>
          </div>
        </el-form-item>

        <el-form-item label="费用试算">
          <div class="calc-row">
            <div class="calc-item" v-for="g in calcPresets" :key="g">
              <span class="calc-gb">{{ g }} GB</span>
              <span class="calc-price">¥{{ (g * priceYuan).toFixed(2) }} / 月</span>
            </div>
          </div>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="saving" @click="handleSave"><el-icon><Check /></el-icon>保存配置</el-button>
          <el-button :disabled="saving" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Setting, Check } from '@element-plus/icons-vue'
import { billingAdminApi } from '@/api'

const GB = 1073741824
const loading = ref(false)
const saving = ref(false)
const calcPresets = [10, 50, 100]

// 编辑态：管理员友好单位（GB / 元）
const freeGb = ref(0)
const priceYuan = ref(0)
// 已生效配置快照：契约单位（字节 / 分）
const savedConfig = ref({ freeBytes: 0, pricePerGbMonthCents: 0 })

const freeBytesFromGb = computed(() => Math.round(freeGb.value * GB))
const centsFromYuan = computed(() => Math.round(priceYuan.value * 100))

const fetchConfig = async () => {
  loading.value = true
  try {
    const res = await billingAdminApi.getConfig()
    applyConfig(res)
  } catch {
    ElMessage.error('加载配置失败')
  } finally {
    loading.value = false
  }
}

const applyConfig = (res) => {
  savedConfig.value = { freeBytes: res.freeBytes ?? 0, pricePerGbMonthCents: res.pricePerGbMonthCents ?? 0 }
  freeGb.value = +(savedConfig.value.freeBytes / GB).toFixed(1)
  priceYuan.value = +(savedConfig.value.pricePerGbMonthCents / 100).toFixed(2)
}

const handleReset = () => applyConfig(savedConfig.value)

const handleSave = async () => {
  const oldC = savedConfig.value
  const newC = { freeBytes: freeBytesFromGb.value, pricePerGbMonthCents: centsFromYuan.value }
  if (newC.freeBytes === oldC.freeBytes && newC.pricePerGbMonthCents === oldC.pricePerGbMonthCents) {
    ElMessage.info('配置未变更')
    return
  }
  const fmtGb = (b) => `${(b / GB).toFixed(1)} GB`
  const fmtYuan = (c) => `¥${(c / 100).toFixed(2)} / GB / 月`
  const html = `免费额度：<b>${fmtGb(oldC.freeBytes)}</b> → <b>${fmtGb(newC.freeBytes)}</b><br/>存储单价：<b>${fmtYuan(oldC.pricePerGbMonthCents)}</b> → <b>${fmtYuan(newC.pricePerGbMonthCents)}</b><br/><br/>免费额度仅影响此后新注册用户（R3 快照制），确认保存？`
  try {
    await ElMessageBox.confirm(html, '确认配置变更', {
      type: 'warning',
      dangerouslyUseHTMLString: true,
      confirmButtonText: '确认保存',
      cancelButtonText: '再改改'
    })
  } catch {
    return
  }
  saving.value = true
  try {
    await billingAdminApi.updateConfig(newC)
    savedConfig.value = newC
    ElMessage.success('配置已保存')
  } catch {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(fetchConfig)
</script>

<style scoped>
.form-item-content { display: flex; flex-direction: column; gap: 6px; }
.input-row { display: flex; align-items: center; gap: 8px; }
.unit-text { color: var(--cs-text-secondary, #606266); font-size: 13px; }
.hint-text { color: var(--cs-text-tertiary, #909399); font-size: 12px; }
.calc-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.calc-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 14px;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  background: #f5f7fa;
}
.calc-gb { color: var(--cs-text-secondary, #606266); font-size: 13px; }
.calc-price { font-weight: 600; color: var(--cs-primary, #409eff); font-size: 14px; }
</style>
