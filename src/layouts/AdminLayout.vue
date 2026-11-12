<template>
  <div class="shell">
    <!-- 分区轨：72px，只放工作分区 -->
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
        <button v-if="hasUserPortal" class="rail-btn" title="返回用户端" @click="router.push('/')">
          <el-icon :size="15"><Back /></el-icon>
          <span>用户端</span>
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
            <span class="crumb-root">{{ activePartition?.title || '管理端' }}</span>
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

          <span v-if="walletStore.walletState === 'ok'" class="chip chip-money" :class="{ frozen: walletStore.wallet.frozen }">
            <em>余额</em><b>¥{{ walletStore.wallet.balanceYuan }}</b>
          </span>

          <el-tooltip v-if="perm.legacy" content="权限服务暂不可用，菜单按默认权限展示" placement="bottom">
            <span class="chip chip-warn">兼容模式</span>
          </el-tooltip>

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
                <el-dropdown-item @click="handleLogout"><el-icon><SwitchButton /></el-icon>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <!-- 工作分区下的页面标签 -->
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
        <div class="tabs-tail">
          <span v-if="perm.enterpriseName" class="chip chip-soft">{{ perm.enterpriseName }}</span>
          <span v-if="currentRoleName" class="chip chip-soft">{{ currentRoleName }}</span>
        </div>
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
import { useAppStore } from '@/stores/app'
import logoUrl from '@/assets/logo.png'
import { useUserStore } from '@/stores/user'
import { usePermissionStore } from '@/stores/permission'
import EnterpriseNoticeBar from '@/components/EnterpriseNoticeBar.vue'
import CommandPalette from '@/components/CommandPalette.vue'
import { useBillingStore } from '@/stores/billing'
import { buildPartitions, partitionOf } from '@/constants/partitions'
// 已按需求停用：强制改密弹框
// import ForcePasswordDialog from '@/components/ForcePasswordDialog.vue'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const userStore = useUserStore()
const perm = usePermissionStore()
const walletStore = useBillingStore()

const partitions = computed(() =>
  buildPartitions({ side: 'admin', can: perm.can, identity: perm.identity, legacy: perm.legacy })
)
const activePartition = computed(() => partitionOf(partitions.value, route.path))
const currentTitle = computed(() => {
  const hit = activePartition.value?.items.find(i => isActive(i.path))
  return hit?.title || route.meta?.title || '控制台'
})
const currentRoleName = computed(() => perm.identityLabel || '')
const initial = computed(() => (userStore.displayName || perm.nickname || '?').slice(0, 1).toUpperCase())
const hasUserPortal = computed(() =>
  buildPartitions({ side: 'user', can: perm.can, identity: perm.identity, legacy: perm.legacy }).length > 0
)

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
  walletStore.loadWallet()
  updateViewport()
  window.addEventListener('resize', updateViewport)
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateViewport)
  window.removeEventListener('keydown', onKeydown)
})

function handleLogout() { userStore.logout(); router.push('/login') }
</script>

<style scoped>
.shell { display: flex; height: 100vh; overflow: hidden; background: var(--cs-bg-page); }

/* ---------------- 分区轨 ---------------- */
.rail {
  width: var(--cs-rail-width);
  flex: none;
  display: flex;
  flex-direction: column;
  background: var(--cs-bg-container);
  border-right: 1px solid var(--cs-border-light);
  z-index: 40;
}
.rail-logo { height: var(--cs-header-height); display: flex; align-items: center; justify-content: center; flex: none; }
.rail-logo-img { width: 26px; height: 26px; border-radius: 4px; object-fit: cover; display: block; }

.rail-nav { flex: 1; display: flex; flex-direction: column; align-items: stretch; gap: 2px; padding: 8px 6px; overflow-y: auto; }
.rail-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 54px;
  border: none;
  border-radius: var(--cs-radius);
  background: transparent;
  color: var(--cs-text-tertiary);
  cursor: pointer;
  transition: background var(--cs-transition), color var(--cs-transition);
}
.rail-item span { font-size: 9.5px; letter-spacing: 0.06em; }
.rail-item:hover { background: var(--cs-bg-hover); color: var(--cs-text-primary); }
.rail-item.on { background: var(--cs-primary-lighter); color: var(--cs-primary); font-weight: 600; }
.rail-item.on::before {
  content: '';
  position: absolute;
  left: -6px; top: 12px; bottom: 12px;
  width: 2px;
  border-radius: 0 2px 2px 0;
  background: var(--cs-primary);
}

.rail-foot { padding: 10px 6px 12px; border-top: 1px solid var(--cs-border-light); }
.rail-btn {
  width: 100%;
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 7px 0;
  border: none; border-radius: var(--cs-radius);
  background: transparent; color: var(--cs-text-tertiary);
  font-size: 9.5px; letter-spacing: 0.04em; cursor: pointer;
  transition: background var(--cs-transition), color var(--cs-transition);
}
.rail-btn:hover { background: var(--cs-bg-hover); color: var(--cs-text-primary); }

/* ---------------- 主区 ---------------- */
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
  border: 1px solid var(--cs-border-light);
  border-radius: var(--cs-radius);
  background: var(--cs-bg-page);
  color: var(--cs-text-tertiary);
  font-size: 11.5px;
  cursor: pointer;
  transition: border-color var(--cs-transition), background var(--cs-transition), color var(--cs-transition);
}
.search-trigger:hover { border-color: var(--cs-border); color: var(--cs-text-secondary); background: var(--cs-bg-container); }
.search-trigger kbd {
  font-family: var(--cs-mono);
  font-size: 9.5px;
  padding: 0 3px;
  border: 1px solid var(--cs-border);
  border-radius: 3px;
  color: var(--cs-text-tertiary);
  background: var(--cs-bg-container);
}
@media (max-width: 1000px) { .search-text { display: none; } }

.icon-btn {
  width: 27px; height: 27px;
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid transparent; border-radius: var(--cs-radius-sm);
  background: transparent; color: var(--cs-text-tertiary);
  cursor: pointer;
  transition: background var(--cs-transition), color var(--cs-transition);
}
.icon-btn:hover { background: var(--cs-bg-hover); color: var(--cs-text-primary); }
.only-mobile { display: none; }

.chip {
  display: inline-flex; align-items: center; gap: 4px;
  height: 22px; padding: 0 7px;
  border: 1px solid var(--cs-border-light);
  border-radius: var(--cs-radius-sm);
  font-size: 11px;
  color: var(--cs-text-secondary);
  white-space: nowrap;
}
.chip-soft { background: var(--cs-bg-page); color: var(--cs-text-tertiary); }
.chip-warn { color: var(--cs-warning); border-color: rgba(154, 100, 0, 0.25); background: rgba(154, 100, 0, 0.06); }
.chip-money em { font-style: normal; color: var(--cs-text-tertiary); }
.chip-money b { font-family: var(--cs-mono); font-size: 11.5px; font-weight: 600; color: var(--cs-primary); }
.chip-money.frozen b { color: var(--cs-danger); }

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
  border-radius: 4px;
  background: var(--cs-primary);
  color: #fff;
  font-size: 10.5px;
  font-weight: 600;
}
.account-name { font-size: 12px; color: var(--cs-text-primary); max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.account-caret { color: var(--cs-text-tertiary); }

/* ---------------- 标签栏 ---------------- */
.tabs {
  height: 37px;
  flex-shrink: 0;
  display: flex;
  align-items: stretch;
  gap: 2px;
  padding: 0 10px;
  background: var(--cs-bg-container);
  border-bottom: 1px solid var(--cs-border-light);
  overflow-x: auto;
}
.tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: 0 10px;
  font-size: 12px;
  color: var(--cs-text-secondary);
  text-decoration: none;
  white-space: nowrap;
  border-radius: var(--cs-radius-sm) var(--cs-radius-sm) 0 0;
  transition: color var(--cs-transition), background var(--cs-transition);
}
.tab:hover { color: var(--cs-text-primary); background: var(--cs-bg-hover); text-decoration: none; }
.tab.on { color: var(--cs-primary); font-weight: 600; }
.tab.on::after {
  content: '';
  position: absolute; left: 8px; right: 8px; bottom: -1px;
  height: 2px; background: var(--cs-primary); border-radius: 2px 2px 0 0;
}
.tabs-tail { margin-left: auto; display: flex; align-items: center; gap: 6px; padding: 0 4px; }
@media (max-width: 900px) { .tabs-tail { display: none; } }

.stage { flex: 1; overflow-y: auto; background: var(--cs-bg-page); }
.mobile-mask { display: none; }

/* ---------------- 移动端 ---------------- */
@media (max-width: 768px) {
  .rail {
    position: fixed; left: 0; top: 0; bottom: 0; width: 200px;
    transform: translateX(-100%);
    transition: transform var(--cs-transition-slow);
    border-right: 1px solid var(--cs-border-light);
    box-shadow: var(--cs-shadow-lg);
  }
  .rail.mobile-open { transform: translateX(0); }
  .rail-nav { flex-direction: column; align-items: stretch; padding: 8px; }
  .rail-item { flex-direction: row; justify-content: flex-start; gap: 10px; height: 40px; padding: 0 10px; }
  .rail-item span { font-size: 12.5px; }
  .rail-item.on::before { left: 0; top: 8px; bottom: 8px; }
  .rail-btn { flex-direction: row; justify-content: flex-start; gap: 8px; padding: 8px 10px; font-size: 12px; }
  .rail-logo { justify-content: flex-start; padding-left: 16px; }
  .mobile-mask { display: block; position: fixed; inset: 0; background: rgba(16, 19, 26, 0.4); z-index: 35; }
  .only-mobile { display: inline-flex; }
  .account-name { display: none; }
  .chip { max-width: 104px; overflow: hidden; text-overflow: ellipsis; }
}
</style>
