<template>
  <div class="layout-admin">
    <!-- 顶部全局栏（与用户端同一骨架，身份区改为管理端标识） -->
    <header class="topbar">
      <div class="topbar-brand">
        <button class="icon-btn menu-btn" type="button" @click="handleMenuClick">
          <el-icon :size="18">
            <template v-if="isMobile">
              <Close v-if="mobileMenuOpen" />
              <Menu v-else />
            </template>
            <template v-else>
              <Fold v-if="!isCollapsed" />
              <Expand v-else />
            </template>
          </el-icon>
        </button>
        <div class="brand">
          <div class="logo-badge"><img :src="logoUrl" alt="云存储" class="logo-img" /></div>
          <div class="brand-text">
            <span class="brand-name">云存储<em class="brand-badge">管理端</em></span>
            <span class="brand-sub">Admin Console</span>
          </div>
        </div>
      </div>

      <div class="topbar-title">
        <span class="title-main">管理控制台</span>
        <span class="title-sub">组织 · 计费 · 审计</span>
      </div>

      <div class="topbar-right">
        <el-tooltip v-if="perm.legacy" content="权限服务暂不可用，菜单按默认权限展示" placement="bottom">
          <span class="soft-chip warn">兼容模式</span>
        </el-tooltip>
        <span v-if="perm.enterpriseName" class="soft-chip">{{ perm.enterpriseName }}</span>
        <span v-if="currentRoleName" class="soft-chip accent">{{ currentRoleName }}</span>
        <button v-if="isDesktop" class="icon-btn" type="button" title="检查更新" @click="checkForUpdate"><el-icon :size="18"><RefreshRight /></el-icon></button>
        <button class="icon-btn" type="button" :title="appStore.theme === 'light' ? '切换暗色' : '切换亮色'" @click="appStore.toggleTheme">
          <el-icon :size="18"><Moon v-if="appStore.theme === 'light'" /><Sunny v-else /></el-icon>
        </button>
        <span v-if="walletStore.walletState === 'ok'" class="wallet-chip" :class="{ frozen: walletStore.wallet.frozen }">
          <el-icon :size="14"><Wallet /></el-icon>余额<b>¥{{ walletStore.wallet.balanceYuan }}</b>
        </span>
        <el-dropdown trigger="click">
          <span class="user-info">
            <el-avatar :size="32" class="user-avatar admin-avatar">{{ avatarLetter }}</el-avatar>
            <span class="user-meta">
              <span class="user-name">{{ userStore.displayName || perm.nickname }}</span>
              <span class="user-role">{{ perm.identityLabel || '管理员' }}</span>
            </span>
            <el-icon :size="12" class="user-caret"><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="handleLogout"><el-icon><SwitchButton /></el-icon>退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>

    <div class="layout-body">
      <aside class="sidebar" :class="{ collapsed: isCollapsed, 'mobile-open': mobileMenuOpen }">
        <div class="sidebar-scroll">
          <div v-show="!isCollapsed" class="sidebar-label">管理</div>
          <el-menu :default-active="route.path" :collapse="isCollapsed" router class="sidebar-menu" @select="handleMenuNavigate">
            <template v-for="m in visibleMenus" :key="m.path">
              <el-sub-menu v-if="m.children" :index="m.path">
                <template #title>
                  <el-icon><component :is="m.icon" /></el-icon><span>{{ m.title }}</span>
                </template>
                <el-menu-item v-for="c in m.children" :key="c.path" :index="c.path">{{ c.title }}</el-menu-item>
              </el-sub-menu>
              <el-menu-item v-else :index="m.path">
                <el-icon><component :is="m.icon" /></el-icon>
                <template #title>{{ m.title }}</template>
              </el-menu-item>
            </template>
          </el-menu>
        </div>
        <div class="sidebar-bottom">
          <button v-if="hasUserPortal && !isCollapsed" class="back-btn" type="button" @click="router.push('/')">
            <el-icon :size="15"><Back /></el-icon><span>返回用户端</span>
          </button>
          <button v-else-if="hasUserPortal" class="storage-mini" type="button" title="返回用户端" @click="router.push('/')">
            <el-icon :size="18"><Back /></el-icon>
          </button>
        </div>
      </aside>
      <div v-if="isMobile && mobileMenuOpen" class="mobile-mask" @click="closeMobileMenu"></div>

      <main class="content">
        <EnterpriseNoticeBar />
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in"><component :is="Component" /></transition>
        </router-view>
      </main>
    </div>
    <!-- 已按需求停用：强制改密弹框（恢复时取消注释）
    <ForcePasswordDialog />
    -->
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import logoUrl from '@/assets/logo.png'
import { useUserStore } from '@/stores/user'
import { usePermissionStore } from '@/stores/permission'
import EnterpriseNoticeBar from '@/components/EnterpriseNoticeBar.vue'
import { useBillingStore } from '@/stores/billing'
import { ADMIN_MENUS, USER_MENUS, filterMenus } from '@/constants/menus'
// 已按需求停用：强制改密弹框
// import ForcePasswordDialog from '@/components/ForcePasswordDialog.vue'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const userStore = useUserStore()
const perm = usePermissionStore()
const walletStore = useBillingStore()

// 菜单显隐 = 权限点 × 身份（系统管理员 / 企业管理员）；legacy 时隐藏依赖新接口的菜单
const currentRoleName = computed(() => perm.identityLabel || '')
const visibleMenus = computed(() =>
  filterMenus(ADMIN_MENUS, perm.can, { identity: perm.identity })
)

// 是否还有用户端可用入口（企业管理员可能只有管理端菜单，此时不显示「返回用户端」）
const hasUserPortal = computed(() => filterMenus(USER_MENUS, perm.can, { identity: perm.identity }).length > 0)

// 头像首字
const avatarLetter = computed(() => {
  const name = userStore.displayName || perm.nickname || ''
  return name ? name.trim().charAt(0).toUpperCase() : 'A'
})

// 桌面端（Electron）才显示检查更新按钮；点击触发 App.vue 的手动检查
const isDesktop = !!window.desktop?.isDesktop
const checkForUpdate = () => document.dispatchEvent(new CustomEvent('app:check-update'))
const isMobile = ref(false)
const mobileMenuOpen = ref(false)

// 移动端抽屉里菜单始终展开；桌面/平板的折叠状态由 appStore 控制
const isCollapsed = computed(() => !isMobile.value && appStore.sidebarCollapsed)

function updateViewport() {
  isMobile.value = window.innerWidth <= 768
  if (!isMobile.value) mobileMenuOpen.value = false
}

onMounted(() => {
  walletStore.loadWallet()
  updateViewport()
  // 平板端（<=1024 且 >768）默认折叠侧边栏
  if (window.innerWidth <= 1024 && window.innerWidth > 768) {
    appStore.sidebarCollapsed = true
  }
  window.addEventListener('resize', updateViewport)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateViewport)
})

function handleMenuClick() {
  if (isMobile.value) {
    mobileMenuOpen.value = !mobileMenuOpen.value
  } else {
    appStore.toggleSidebar()
  }
}

function handleMenuNavigate() {
  if (isMobile.value) mobileMenuOpen.value = false
}

function closeMobileMenu() { mobileMenuOpen.value = false }

function handleLogout() { userStore.logout(); router.push('/login') }
</script>

<style scoped>
.layout-admin { display: flex; flex-direction: column; height: 100vh; overflow: hidden; background: var(--cs-bg-page); }

/* ---------------- 顶部全局栏 ---------------- */
.topbar {
  height: var(--cs-header-height);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 18px 0 12px;
  background: var(--cs-header-bg);
  border-bottom: 1px solid var(--cs-header-border);
  position: relative;
  z-index: 12;
}
.topbar-brand { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.brand { display: flex; align-items: center; gap: 10px; }
.logo-badge { width: 36px; height: 36px; border-radius: 11px; overflow: hidden; flex-shrink: 0; background: #fff; box-shadow: 0 4px 12px rgba(16, 58, 76, 0.12); }
.logo-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.brand-text { display: flex; flex-direction: column; line-height: 1.1; }
.brand-name { display: flex; align-items: center; gap: 6px; font-size: 15.5px; font-weight: 800; letter-spacing: -0.2px; color: var(--cs-text-primary); white-space: nowrap; }
.brand-badge {
  font-style: normal; font-size: 9.5px; font-weight: 800; letter-spacing: 0.2px;
  padding: 2px 6px; border-radius: 100px;
  background: var(--cs-grad-brand); color: #fff;
}
.brand-sub { font-size: 9.5px; font-weight: 700; letter-spacing: 1.1px; text-transform: uppercase; color: var(--cs-primary); }

.topbar-title { display: flex; flex-direction: column; line-height: 1.2; padding-left: 14px; border-left: 1px solid var(--cs-border); }
.title-main { font-size: 13.5px; font-weight: 800; color: var(--cs-text-primary); letter-spacing: -0.2px; }
.title-sub { font-size: 10.5px; color: var(--cs-text-tertiary); }

.icon-btn {
  width: 36px; height: 36px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 50%; border: 1px solid transparent; background: transparent;
  color: var(--cs-text-secondary); cursor: pointer;
  transition: all 0.2s ease;
}
.icon-btn:hover { background: var(--cs-bg-hover); color: var(--cs-primary-dark); }
.menu-btn { color: var(--cs-text-tertiary); }

.topbar-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; margin-left: auto; flex-wrap: nowrap; }
.soft-chip {
  display: inline-flex; align-items: center; height: 28px; padding: 0 11px;
  border-radius: var(--cs-radius-pill);
  background: var(--cs-bg-field);
  border: 1px solid var(--cs-border-light);
  color: var(--cs-text-secondary);
  font-size: 11.5px; font-weight: 600; white-space: nowrap;
  max-width: 170px; overflow: hidden; text-overflow: ellipsis;
}
.soft-chip.accent { background: var(--cs-primary-lighter); color: var(--cs-primary-dark); border-color: rgba(23, 190, 208, 0.18); }
.soft-chip.warn { background: rgba(255, 165, 0, 0.1); color: #d98a00; border-color: rgba(255, 165, 0, 0.22); cursor: help; }

.wallet-chip {
  display: inline-flex; align-items: center; gap: 5px; height: 32px; padding: 0 12px;
  border-radius: var(--cs-radius-pill);
  background: var(--cs-primary-lighter); color: var(--cs-primary-dark);
  border: 1px solid rgba(23, 190, 208, 0.18);
  font-size: 12px; font-weight: 600;
}
.wallet-chip b { font-size: 13px; font-weight: 800; font-variant-numeric: tabular-nums; }
.wallet-chip.frozen { background: rgba(250, 89, 93, 0.1); color: var(--cs-danger); border-color: rgba(250, 89, 93, 0.2); }
.wallet-chip.frozen b { color: var(--cs-danger); }

.user-info {
  display: flex; align-items: center; gap: 8px;
  padding: 3px 9px 3px 3px;
  border-radius: var(--cs-radius-pill);
  cursor: pointer; outline: none;
  border: 1px solid transparent;
  transition: all 0.2s ease;
}
.user-info:hover { background: var(--cs-bg-hover); border-color: var(--cs-border-light); }
.user-avatar { background: var(--cs-grad-brand); color: #fff; font-size: 13px; font-weight: 800; }
.admin-avatar { background: linear-gradient(135deg, #7aa8ff 0%, #5679ff 100%); }
.user-meta { display: flex; flex-direction: column; line-height: 1.2; }
.user-name { font-size: 13px; font-weight: 700; color: var(--cs-text-primary); max-width: 132px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.user-role { font-size: 10.5px; color: var(--cs-text-tertiary); }
.user-caret { color: var(--cs-text-tertiary); }

/* ---------------- 主体 ---------------- */
.layout-body { flex: 1; display: flex; min-height: 0; }
.sidebar {
  width: var(--cs-sidebar-width);
  flex-shrink: 0;
  display: flex; flex-direction: column;
  background: var(--cs-sidebar-bg);
  border-right: 1px solid var(--cs-sidebar-border);
  transition: width var(--cs-transition);
  overflow: hidden;
}
.sidebar.collapsed { width: 76px; }
.sidebar-scroll { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 14px 12px 8px; }
.sidebar-label {
  font-size: 10.5px; font-weight: 800; letter-spacing: 1.1px; text-transform: uppercase;
  color: var(--cs-text-tertiary); padding: 4px 10px 8px;
}
.sidebar-menu { border-right: none !important; background: transparent !important; padding: 0; }
.sidebar-menu .el-menu-item,
.sidebar-menu :deep(.el-sub-menu__title) {
  position: relative;
  height: 40px; line-height: 40px;
  border-radius: 10px;
  margin-bottom: 2px;
  padding-left: 12px !important;
  color: var(--cs-sidebar-text);
  font-weight: 600;
  font-size: 13.5px;
  transition: all 0.18s ease;
}
.sidebar-menu .el-menu-item .el-icon,
.sidebar-menu :deep(.el-sub-menu__title .el-icon) { font-size: 17px; width: 17px; margin-right: 11px; color: inherit; }
.sidebar-menu .el-menu-item:hover,
.sidebar-menu :deep(.el-sub-menu__title:hover) { background: var(--cs-sidebar-hover-bg); color: var(--cs-primary-dark); }
.sidebar-menu .el-menu-item.is-active,
.sidebar-menu :deep(.el-sub-menu.is-active > .el-sub-menu__title) {
  background: var(--cs-sidebar-active-bg);
  color: var(--cs-sidebar-active-text);
  font-weight: 700;
}
.sidebar-menu .el-menu-item.is-active::before,
.sidebar-menu :deep(.el-sub-menu.is-active > .el-sub-menu__title)::before {
  content: '';
  position: absolute; left: 0; top: 50%; transform: translateY(-50%);
  width: 3px; height: 18px; border-radius: 0 3px 3px 0;
  background: var(--cs-grad-brand);
}
/* 子菜单 */
.sidebar-menu :deep(.el-sub-menu .el-menu) { background: transparent !important; padding: 2px 0 4px; }
.sidebar-menu :deep(.el-sub-menu .el-menu-item) {
  padding-left: 40px !important;
  min-width: auto;
  height: 36px; line-height: 36px;
  font-size: 13px; font-weight: 600;
  color: var(--cs-sidebar-text);
}
.sidebar-menu :deep(.el-sub-menu .el-menu-item:hover) { background: var(--cs-sidebar-hover-bg); color: var(--cs-primary-dark); }
.sidebar-menu :deep(.el-sub-menu .el-menu-item.is-active) {
  background: var(--cs-sidebar-active-bg);
  color: var(--cs-sidebar-active-text);
  font-weight: 700;
}
.sidebar-menu :deep(.el-sub-menu .el-menu-item.is-active::before) { height: 14px; }
.sidebar.collapsed .sidebar-menu .el-menu-item,
.sidebar.collapsed .sidebar-menu :deep(.el-sub-menu__title) { padding-left: 0 !important; display: flex; justify-content: center; }
.sidebar.collapsed .sidebar-menu .el-menu-item .el-icon,
.sidebar.collapsed .sidebar-menu :deep(.el-sub-menu__title .el-icon) { margin-right: 0; }

.sidebar-bottom { padding: 10px 12px 14px; border-top: 1px solid var(--cs-sidebar-border); flex-shrink: 0; }
.back-btn {
  width: 100%; height: 38px;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  border-radius: 10px;
  border: 1px solid var(--cs-border);
  background: var(--cs-bg-container);
  color: var(--cs-text-secondary);
  font-size: 12.5px; font-weight: 700; cursor: pointer;
  transition: all 0.2s ease;
}
.back-btn:hover { color: var(--cs-primary-dark); border-color: var(--cs-primary-light); background: var(--cs-primary-lighter); }
.storage-mini {
  width: 38px; height: 38px; margin: 0 auto; display: flex; align-items: center; justify-content: center;
  border-radius: 11px; border: 1px solid var(--cs-border); background: var(--cs-bg-container);
  color: var(--cs-primary-dark); cursor: pointer; transition: all 0.2s ease;
}
.storage-mini:hover { background: var(--cs-primary-lighter); border-color: var(--cs-primary-light); }

.content { flex: 1; min-width: 0; overflow-y: auto; background: var(--cs-bg-page); }
.mobile-mask { display: none; }

@media (max-width: 1024px) and (min-width: 769px) {
  .topbar { padding: 0 14px 0 10px; gap: 10px; }
  .soft-chip { display: none; }
  .user-meta { display: none; }
}

@media (max-width: 768px) {
  .topbar { padding: 0 10px; gap: 8px; height: 58px; }
  .brand-text, .topbar-title, .soft-chip, .wallet-chip, .user-meta { display: none; }
  .topbar-right { gap: 4px; }
  .sidebar {
    position: fixed;
    left: 0; top: 0; bottom: 0;
    width: var(--cs-sidebar-width) !important;
    transform: translateX(-100%);
    transition: transform var(--cs-transition);
    z-index: 1001;
    box-shadow: var(--cs-shadow-lg);
    background: var(--cs-sidebar-bg);
  }
  .sidebar.mobile-open { transform: translateX(0); }
  .mobile-mask {
    display: block;
    position: fixed; inset: 0;
    background: rgba(10, 30, 40, 0.42);
    backdrop-filter: blur(2px);
    z-index: 1000;
  }
}
</style>
