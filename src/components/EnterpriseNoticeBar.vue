<template>
  <transition name="nb-fade">
    <div v-if="visible" class="nb">
      <el-icon class="nb-icon"><WarningFilled /></el-icon>
      <span class="nb-title">{{ perm.enterpriseNotice }}</span>
      <span class="nb-sub">上传 / 下载 / 预览已暂停，文件列表仍可浏览</span>
      <div class="nb-actions">
        <el-button link type="primary" size="small" class="nb-link" @click="goRenew">去续费</el-button>
        <span class="nb-divider"></span>
        <el-button link size="small" class="nb-close" @click="dismiss">关闭</el-button>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { WarningFilled } from '@element-plus/icons-vue'
import { usePermissionStore } from '@/stores/permission'

const perm = usePermissionStore()
const router = useRouter()
const closed = ref(false)

const visible = computed(() => !!perm.enterpriseSuspended && !closed.value)

function dismiss() {
  closed.value = true
}

function goRenew() {
  router.push('/packages')
}
</script>

<style scoped>
.nb {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 16px;
  background: rgba(250, 173, 20, .10);
  border-bottom: 1px solid rgba(250, 173, 20, .32);
  font-size: 12.5px;
  color: var(--cs-text-primary);
  overflow: hidden;
}
.nb-icon { color: var(--cs-warning); font-size: 15px; flex: none; }
.nb-title { font-weight: 600; flex: none; }
.nb-sub { color: var(--cs-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nb-actions { margin-left: auto; display: flex; align-items: center; gap: 4px; flex: none; }
.nb-link { font-weight: 600; }
.nb-divider { width: 1px; height: 12px; background: rgba(250, 173, 20, .45); }
.nb-close { color: var(--cs-text-tertiary); }
.nb-fade-enter-active, .nb-fade-leave-active { transition: opacity .18s ease, transform .18s ease; }
.nb-fade-enter-from, .nb-fade-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
