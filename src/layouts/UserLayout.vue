<template>
  <div class="shell">
    <aside class="rail" :class="{ 'mobile-open': mobileMenuOpen }">
      <div class="rail-logo"><img :src="logoUrl" alt="云存储" class="rail-logo-img" /></div>

      <nav class="rail-nav">
        <button
          v-for="p in partitions"
          :key="p.key"
          class="rail-item"
          :class="{ on: p.key === activePartition?.key }"
          :title="p.title"
          @click="goPartition(p)"
        >
          <el-icon :size="17"><component :is="p.icon" /></el-icon>
          <span>{{ p.title }}</span>
        </button>
      </nav>

      <div class="rail-foot">
        <button v-if="canUseAdmin" class="rail-btn" title="进入管理端" @click="goAdmin">
          <el-icon :size="15"><Monitor /></el-icon>
          <span>管理端</span>
        </button>
      </div>
    </aside>

    <div v-if="isMobile && mobileMenuOpen" class="mobile-mask" @click="mobileMenuOpen = false"></div>

    <div class="shell-main">
      <header class="topbar">
        <div class="topbar-left">
          <button class="icon-btn only-mobile" title="导航" @click="mobileMenuOpen = !mobileMenuOpen">
            <el-icon :size="16"><Menu /></el-icon>
          </button>
          <div class="crumb">
            <span class="crumb-root">{{ activePartition?.title || '工作区' }}</span>
            <i class="crumb-sep">/</i>
            <span class="crumb-cur">{{ currentTitle }}</span>
          </div>
        </div>

        <div class="topbar-right">
          <button class="search-trigger" @click="paletteOpen = true">
            <el-icon :size="14"><Search /></el-icon>
            <span class="search-text">搜索页面或动作</span>
            <kbd>⌘K</kbd>
          </button>

          <!-- 配额：进度条 + 数字，始终可见 -->
          <el-tooltip placement="bottom" :content="quotaTip">
            <span class="chip chip-quota">
              <span class="qbar">
                <i class="qbar-free" :style="{ width: freeSegPct + '%' }"></i>
                <i class="qbar-ent" :style="{ width: entSegPct + '%' }"></i>
                <i class="qbar-extra" :style="{ width: extraSegPct + '%' }"></i>
              </span>
              <b>{{ formatSize(quotaUsed) }}</b>
              <em>/ {{ quotaTotalText }}</em>
            </span>
          </el-tooltip>

          <span v-if="billingStore.walletState === 'ok'" class="chip chip-money" :class="{ frozen: billingStore.wallet.frozen }">
            <em>余额</em><b>¥{{ billingStore.wallet.balanceYuan }}</b>
          </span>

          <button v-if="isDesktop" class="icon-btn" title="检查更新" @click="checkForUpdate">
            <el-icon :size="15"><RefreshRight /></el-icon>
          </button>
          <button class="icon-btn" :title="appStore.theme === 'light' ? '切换深色' : '切换浅色'" @click="appStore.toggleTheme">
            <el-icon :size="15"><Moon v-if="appStore.theme === 'light'" /><Sunny v-else /></el-icon>
          </button>

          <el-dropdown trigger="click">
            <span class="account">
              <span class="account-avatar">{{ initial }}</span>
              <span class="account-name">{{ userStore.displayName || perm.nickname }}</span>
              <el-icon :size="11" class="account-caret"><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="router.push('/profile')"><el-icon><Setting /></el-icon>个人设置</el-dropdown-item>
                <el-dropdown-item v-if="canUseAdmin" divided @click="goAdmin"><el-icon><Monitor /></el-icon>进入管理端</el-dropdown-item>
                <el-dropdown-item :divided="!canUseAdmin" @click="handleLogout"><el-icon><SwitchButton /></el-icon>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <nav class="tabs">
        <router-link
          v-for="it in activePartition?.items || []"
          :key="it.path"
          :to="it.path"
          class="tab"
          :class="{ on: isActive(it.path) }"
        >
          {{ it.title }}
        </router-link>
      </nav>

      <EnterpriseNoticeBar />

      <main class="stage">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in"><component :is="Component" /></transition>
        </router-view>
      </main>
    </div>

    <CommandPalette v-model="paletteOpen" :groups="paletteGroups" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElNotification } from 'element-plus'
import { useAppStore } from '@/stores/app'
import logoUrl from '@/assets/logo.png'
import { useUserStore } from '@/stores/user'
import { useBillingStore } from '@/stores/billing'
import { usePermissionStore } from '@/stores/permission'
import EnterpriseNoticeBar from '@/components/EnterpriseNoticeBar.vue'
import CommandPalette from '@/components/CommandPalette.vue'
import { buildPartitions, partitionOf } from '@/constants/partitions'

import { landingPath } from '@/utils/landing'
import { fetchUploadTasks } from '@/utils/uploadTaskStore'
// 已按需求停用：强制改密弹框
// import ForcePasswordDialog from '@/components/ForcePasswordDialog.vue'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const userStore = useUserStore()
const billingStore = useBillingStore()
const perm = usePermissionStore()

const partitions = computed(() =>
  buildPartitions({ side: 'user', can: perm.can, identity: perm.identity, legacy: perm.legacy })
)
const activePartition = computed(() => partitionOf(partitions.value, route.path))
const currentTitle = computed(() => {
  const hit = activePartition.value?.items.find(i => isActive(i.path))
  return hit?.title || route.meta?.title || '我的文件'
})
const initial = computed(() => (userStore.displayName || perm.nickname || '?').slice(0, 1).toUpperCase())

const paletteOpen = ref(false)
const paletteGroups = computed(() =>
  partitions.value.map(p => ({
    title: p.title,
    items: p.items.map(i => ({ key: i.path, title: i.title, icon: i.icon, hint: i.path, path: i.path }))
  }))
)

const isDesktop = !!window.desktop?.isDesktop
const checkForUpdate = () => document.dispatchEvent(new CustomEvent('app:check-update'))
const isMobile = ref(false)
const mobileMenuOpen = ref(false)

// 额度：优先计费数据，未就绪时回退登录快照
const quotaTotal = computed(() => billingStore.totalBytes || userStore.quota.total)
const quotaUsed = computed(() => billingStore.totalBytes ? billingStore.quota.usedBytes : userStore.quota.used)
const freeBytes = computed(() => billingStore.totalBytes > 0 ? (billingStore.quota.personalBytes ?? billingStore.quota.freeBytes ?? 0) : quotaTotal.value)
const entBytes = computed(() => billingStore.quota.enterpriseBytes || 0)
const extraBytes = computed(() => billingStore.totalBytes > 0 ? (billingStore.quota.extraBytes || 0) : 0)
const freeSegPct = computed(() => quotaTotal.value > 0 ? (freeBytes.value / quotaTotal.value) * 100 : 0)
const entSegPct = computed(() => quotaTotal.value > 0 ? (entBytes.value / quotaTotal.value) * 100 : 0)
const extraSegPct = computed(() => quotaTotal.value > 0 ? (extraBytes.value / quotaTotal.value) * 100 : 0)
const quotaTotalText = computed(() => extraBytes.value > 0 ? `${formatSize(freeBytes.value)} + ${formatSize(extraBytes.value)}` : formatSize(quotaTotal.value))
const quotaTip = computed(() =>
  `已用 ${formatSize(quotaUsed.value)} / 可用 ${formatSize(quotaTotal.value)}（个人免费 ${formatSize(freeBytes.value)}` +
  (entBytes.value > 0 ? ` · 企业分配 ${formatSize(entBytes.value)}` : '') +
  (extraBytes.value > 0 ? ` · 个人增量 ${formatSize(extraBytes.value)}` : '') + '）'
)

function isActive(path) {
  return route.path === path || route.path.startsWith(path + '/')
}

function goPartition(p) {
  if (isMobile.value) mobileMenuOpen.value = false
  if (p.key === activePartition.value?.key) return
  const target = p.items[0]?.path
  if (target && target !== route.path) router.push(target)
}

function onKeydown(e) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    paletteOpen.value = !paletteOpen.value
  }
}

function updateViewport() {
  isMobile.value = window.innerWidth <= 768
  if (!isMobile.value) mobileMenuOpen.value = false
}

onMounted(() => {
  billingStore.loadWallet()
  updateViewport()
  if (perm.can('transfer.read')) notifyPendingTransfers()
  userStore.loadProfile().catch(() => {})
  if (perm.can('quota.read')) billingStore.loadQuota().catch(() => {})
  window.addEventListener('resize', updateViewport)
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateViewport)
  window.removeEventListener('keydown', onKeydown)
})

async function notifyPendingTransfers() {
  const res = await fetchUploadTasks({ status: 'uploading', page: 0, size: 10 }).catch(() => null)
  const pending = res?.list || []
  if (!pending.length) return
  ElNotification({
    title: '有未完成的传输任务',
    message: `检测到 ${res?.total ?? pending.length} 个上传任务未完成，可在「传输任务」中继续。`,
    type: 'warning',
    duration: 6000
  })
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024, sizes = ['B','KB','MB','GB','TB','PB','EB','ZB','YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// 是否具备管理端身份（平台管理员 / 企业管理员）
const canUseAdmin = computed(() => perm.isPlatform || perm.isEnterpriseAdmin)

// 进入管理端：跳到该账号真正有权限的管理端落地页
function goAdmin() {
  router.push(landingPath(perm, { prefer: 'admin' }))
}

function handleLogout() { userStore.logout(); router.push('/login') }
</script>

<style scoped>
.shell { display: flex; height: 100vh; overflow: hidden; background: var(--cs-bg-page); }

/* 分区轨 */
.rail {
  width: var(--cs-rail-width);
  flex: none;
  display: flex; flex-direction: column;
  background: var(--cs-bg-container);
  border-right: 1px solid var(--cs-border-light);
  z-index: 40;
}
.rail-logo { height: var(--cs-header-height); display: flex; align-items: center; justify-content: center; flex: none; }
.rail-logo-img { width: 26px; height: 26px; border-radius: 4px; object-fit: cover; display: block; }

.rail-nav { flex: 1; display: flex; flex-direction: column; gap: 2px; padding: 8px 6px; overflow-y: auto; }
.rail-item {
  position: relative;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  height: 54px;
  border: none; border-radius: var(--cs-radius);
  background: transparent; color: var(--cs-text-tertiary);
  cursor: pointer;
  transition: background var(--cs-transition), color var(--cs-transition);
}
.rail-item span { font-size: 9.5px; letter-spacing: 0.06em; }
.rail-item:hover { background: var(--cs-bg-hover); color: var(--cs-text-primary); }
.rail-item.on { background: var(--cs-primary-lighter); color: var(--cs-primary); font-weight: 600; }
.rail-item.on::before {
  content: ''; position: absolute; left: -6px; top: 12px; bottom: 12px;
  width: 2px; border-radius: 0 2px 2px 0; background: var(--cs-primary);
}

.rail-foot { padding: 10px 6px 12px; border-top: 1px solid var(--cs-border-light); }
.rail-btn {
  width: 100%;
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 7px 0;
  border: none; border-radius: var(--cs-radius);
  background: transparent; color: var(--cs-text-tertiary);
  font-size: 9.5px; cursor: pointer;
  transition: background var(--cs-transition), color var(--cs-transition);
}
.rail-btn:hover { background: var(--cs-bg-hover); color: var(--cs-text-primary); }

.shell-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }

.topbar {
  height: var(--cs-header-height);
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px;
  padding: 0 12px 0 14px;
  background: var(--cs-bg-container);
  border-bottom: 1px solid var(--cs-border-light);
}
.topbar-left, .topbar-right { display: flex; align-items: center; gap: 8px; min-width: 0; }

.crumb { display: flex; align-items: center; gap: 6px; font-size: 12px; white-space: nowrap; }
.crumb-root { color: var(--cs-text-tertiary); }
.crumb-sep { color: var(--cs-text-disabled); font-style: normal; }
.crumb-cur { color: var(--cs-text-primary); font-weight: 600; }

.search-trigger {
  display: inline-flex; align-items: center; gap: 7px;
  height: 27px; padding: 0 8px;
  border: 1px solid var(--cs-border-light); border-radius: var(--cs-radius);
  background: var(--cs-bg-page); color: var(--cs-text-tertiary);
  font-size: 11.5px; cursor: pointer;
  transition: border-color var(--cs-transition), background var(--cs-transition), color var(--cs-transition);
}
.search-trigger:hover { border-color: var(--cs-border); color: var(--cs-text-secondary); background: var(--cs-bg-container); }
.search-trigger kbd {
  font-family: var(--cs-mono); font-size: 9.5px; padding: 0 3px;
  border: 1px solid var(--cs-border); border-radius: 3px; background: var(--cs-bg-container);
}
@media (max-width: 1100px) { .search-text { display: none; } }

.icon-btn {
  width: 27px; height: 27px;
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid transparent; border-radius: var(--cs-radius-sm);
  background: transparent; color: var(--cs-text-tertiary); cursor: pointer;
  transition: background var(--cs-transition), color var(--cs-transition);
}
.icon-btn:hover { background: var(--cs-bg-hover); color: var(--cs-text-primary); }
.only-mobile { display: none; }

.chip {
  display: inline-flex; align-items: center; gap: 5px;
  height: 22px; padding: 0 7px;
  border: 1px solid var(--cs-border-light); border-radius: var(--cs-radius-sm);
  font-size: 11px; color: var(--cs-text-secondary); white-space: nowrap;
}
.chip-quota b { font-family: var(--cs-mono); font-size: 11px; color: var(--cs-text-primary); font-weight: 600; }
.chip-quota em { font-style: normal; color: var(--cs-text-tertiary); font-size: 10.5px; }
.chip-money em { font-style: normal; color: var(--cs-text-tertiary); }
.chip-money b { font-family: var(--cs-mono); font-size: 11.5px; font-weight: 600; color: var(--cs-primary); }
.chip-money.frozen b { color: var(--cs-danger); }

.qbar { display: inline-flex; width: 54px; height: 4px; border-radius: 2px; overflow: hidden; background: var(--cs-bg-active); }
.qbar i { display: block; height: 100%; }
.qbar-free { background: var(--cs-primary); }
.qbar-ent { background: var(--cs-info); }
.qbar-extra { background: var(--cs-warning); }

.account {
  display: inline-flex; align-items: center; gap: 7px;
  height: 27px; padding: 0 7px 0 2px;
  border: 1px solid transparent; border-radius: var(--cs-radius-sm);
  cursor: pointer;
  transition: background var(--cs-transition), border-color var(--cs-transition);
}
.account:hover { background: var(--cs-bg-hover); border-color: var(--cs-border-light); }
.account-avatar {
  width: 21px; height: 21px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 4px; background: var(--cs-primary); color: #fff;
  font-size: 10.5px; font-weight: 600;
}
.account-name { font-size: 12px; color: var(--cs-text-primary); max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.account-caret { color: var(--cs-text-tertiary); }

.tabs {
  height: 37px; flex-shrink: 0;
  display: flex; align-items: stretch; gap: 2px;
  padding: 0 10px;
  background: var(--cs-bg-container);
  border-bottom: 1px solid var(--cs-border-light);
  overflow-x: auto;
}
.tab {
  position: relative;
  display: inline-flex; align-items: center;
  padding: 0 10px;
  font-size: 12px; color: var(--cs-text-secondary);
  text-decoration: none; white-space: nowrap;
  border-radius: var(--cs-radius-sm) var(--cs-radius-sm) 0 0;
  transition: color var(--cs-transition), background var(--cs-transition);
}
.tab:hover { color: var(--cs-text-primary); background: var(--cs-bg-hover); text-decoration: none; }
.tab.on { color: var(--cs-primary); font-weight: 600; }
.tab.on::after {
  content: ''; position: absolute; left: 8px; right: 8px; bottom: -1px;
  height: 2px; background: var(--cs-primary); border-radius: 2px 2px 0 0;
}

.stage { flex: 1; overflow-y: auto; background: var(--cs-bg-page); }
.mobile-mask { display: none; }

@media (max-width: 768px) {
  .rail {
    position: fixed; left: 0; top: 0; bottom: 0; width: 200px;
    transform: translateX(-100%);
    transition: transform var(--cs-transition-slow);
    box-shadow: var(--cs-shadow-lg);
  }
  .rail.mobile-open { transform: translateX(0); }
  .rail-nav { padding: 8px; }
  .rail-item { flex-direction: row; justify-content: flex-start; gap: 10px; height: 40px; padding: 0 10px; }
  .rail-item span { font-size: 12.5px; }
  .rail-item.on::before { left: 0; top: 8px; bottom: 8px; }
  .rail-btn { flex-direction: row; justify-content: flex-start; gap: 8px; padding: 8px 10px; font-size: 12px; }
  .rail-logo { justify-content: flex-start; padding-left: 16px; }
  .mobile-mask { display: block; position: fixed; inset: 0; background: rgba(16, 19, 26, 0.4); z-index: 35; }
  .only-mobile { display: inline-flex; }
  .account-name { display: none; }
  .chip-quota em { display: none; }
}
</style>
