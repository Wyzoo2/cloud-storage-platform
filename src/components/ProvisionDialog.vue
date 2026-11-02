<template>
  <el-dialog
    :model-value="modelValue"
    :title="title"
    width="420px"
    align-center
    :close-on-click-modal="false"
    :close-on-press-escape="state !== 'running'"
    :show-close="state !== 'running'"
    @update:model-value="onModelUpdate"
  >
    <div class="prov">
      <div class="prov-head">
        <el-icon v-if="state === 'running'" class="is-loading prov-icon running"><Loading /></el-icon>
        <el-icon v-else-if="state === 'done'" class="prov-icon ok"><CircleCheckFilled /></el-icon>
        <el-icon v-else class="prov-icon warn"><WarningFilled /></el-icon>
        <span class="prov-step">{{ stepText || (state === 'running' ? '处理中…' : '') }}</span>
      </div>
      <el-progress
        :percentage="percent"
        :stroke-width="8"
        :show-text="false"
        :status="progressStatus"
        class="prov-bar"
      />
      <div v-if="detail" class="prov-detail">{{ detail }}</div>
    </div>
  </el-dialog>
</template>

<script setup>
import { computed } from 'vue'
import { CircleCheckFilled, Loading, WarningFilled } from '@element-plus/icons-vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '开通中' },
  // running | done | failed | timeout
  state: { type: String, default: 'running' },
  percent: { type: Number, default: 0 },
  stepText: { type: String, default: '' },
  detail: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])

const progressStatus = computed(() => {
  if (props.state === 'done') return 'success'
  if (props.state === 'failed') return 'exception'
  if (props.state === 'timeout') return 'warning'
  return undefined
})

// 开通中不允许关闭（点遮罩/叉号/ESC 都会被拦住）
function onModelUpdate(v) {
  if (!v && props.state === 'running') return
  emit('update:modelValue', v)
}
</script>

<style scoped>
.prov { display: flex; flex-direction: column; gap: 12px; padding: 4px 0 2px; }
.prov-head { display: flex; align-items: center; gap: 8px; }
.prov-icon { font-size: 18px; }
.prov-icon.running { color: var(--cs-primary); }
.prov-icon.ok { color: var(--cs-success); }
.prov-icon.warn { color: var(--cs-warning); }
.prov-step { font-size: 13px; font-weight: 600; color: var(--cs-text-primary); }
.prov-bar { margin-top: 2px; }
.prov-detail { font-size: 12px; line-height: 1.6; color: var(--cs-text-tertiary); }
</style>
