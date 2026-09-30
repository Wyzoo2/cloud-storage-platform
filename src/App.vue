<template>
  <router-view />
  <!-- 桌面端自动更新弹窗 -->
  <UpdateDialog v-if="updateVisible" :visible="updateVisible" :info="updateInfo" @close="updateVisible = false" />
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import UpdateDialog from '@/components/UpdateDialog.vue'
import { checkAppUpdate } from '@/api'

const updateVisible = ref(false)
const updateInfo = ref({})
let checking = false

// semver → 整数版本号：major*10000 + minor*100 + patch
function toVersionCode(v) {
  const parts = String(v || '0.0.0').split('.').map(n => parseInt(n, 10) || 0)
  const [major = 0, minor = 0, patch = 0] = parts
  return major * 10000 + minor * 100 + patch
}

// 检查更新：manual=true 为用户手动触发（无更新/失败时给出提示）
async function fetchUpdate(manual = false) {
  if (!window.desktop?.isDesktop || updateVisible.value || checking) return
  const token = localStorage.getItem('cs-token')
  if (!token) {
    if (manual) ElMessage.warning('请先登录')
    return
  }
  checking = true
  try {
    const data = await checkAppUpdate('windows', toVersionCode(await window.desktop.getVersion()))
    if (data && data.hasUpdate) {
      updateInfo.value = data.update || data
      updateVisible.value = true
    } else if (manual) {
      ElMessage.success('当前已是最新版本')
    }
  } catch (e) {
    if (manual) ElMessage.error(e?.message || '检查更新失败，请稍后重试')
  } finally {
    checking = false
  }
}

// 登录成功后立即检查一次（stores/user.js 的 login() 末尾派发 app:logged-in，覆盖启动时未登录、之后登录的场景）
function onLoggedIn() { fetchUpdate() }

// 布局层的「检查更新」按钮通过该事件触发手动检测
function onManualCheck() { fetchUpdate(true) }

onMounted(() => {
  // 启动 3 秒后自动检查一次（每次进入软件检测一次，不做定时轮询）
  setTimeout(fetchUpdate, 3000)
  document.addEventListener('app:check-update', onManualCheck)
  document.addEventListener('app:logged-in', onLoggedIn)
})

onBeforeUnmount(() => {
  document.removeEventListener('app:check-update', onManualCheck)
  document.removeEventListener('app:logged-in', onLoggedIn)
})
</script>

<style>
html, body, #app {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
}
</style>
