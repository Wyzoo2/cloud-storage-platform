<template>
  <div class="layout-user">
    <!-- 顶部全局栏：品牌 + 全局搜索 + 账号区（pCloud Drive 骨架） -->
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
            <span class="brand-name">云存储</span>
            <span class="brand-sub">Cloud Drive</span>
          </div>
        </div>
      </div>

      <div class="topbar-search">
        <el-icon :size="16" class="search-icon"><Search /></el-icon>
        <input ref="searchInputRef" v-model="quickKw" placeholder="搜索全部文件…" @keyup.enter="quickSearch" />
        <span class="kbd">/</span>
      </div>

      <div class="topbar-right">
        <button v-if="isDesktop" class="icon-btn" type="button" title="检查更新" @click="checkForUpdate"><el-icon :size="18"><RefreshRight /></el-icon></button>
        <button class="icon-btn" type="button" :title="appStore.theme === 'light' ? '切换暗色' : '切换亮色'" @click="appStore.toggleTheme">
          <el-icon :size="18"><Moon v-if="appStore.theme === 'light'" /><Sunny v-else /></el-icon>
        </button>
        <span v-if="billingStore.walletState === 'ok'" class="wallet-chip" :class="{ frozen: billingStore.wallet.frozen }">
          <el-icon :size="14"><Wallet /></el-icon>余额<b>¥{{ billingStore.wallet.balanceYuan }}</b>
        </span>
        <el-dropdown trigger="click">
          <span class="user-info">
            <el-avatar :size="32" class="user-avatar">{{ avatarLetter }}</el-avatar>
            <span class="user-meta">
              <span class="user-name">{{ userStore.displayName || perm.nickname }}</span>
              <span class="user-role">{{ perm.identityLabel || '个人空间' }}</span>
            </span>
            <el-icon :size="12" class="user-caret"><ArrowDown /></el-icon>
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

    <div class="layout-body">
      <aside class="sidebar" :class="{ collapsed: isCollapsed, 'mobile-open': mobileMenuOpen }">
        <div class="sidebar-scroll">
          <div v-show="!isCollapsed" class="sidebar-label">工作台</div>
          <el-menu :default-active="route.path" :collapse="isCollapsed" router class="sidebar-menu" @select="handleMenuNavigate">
            <el-menu-item v-for="m in visibleMenus" :key="m.path" :index="m.path">
              <el-icon><component :is="m.icon" /></el-icon>
              <template #title>{{ m.title }}</template>
            </el-menu-item>
          </el-menu>
        </div>

        <div class="sidebar-bottom">
          <div v-if="!isCollapsed" class="storage-card">
            <div class="storage-head">
              <span class="storage-title">存储空间</span>
              <span class="storage-pct">{{ usedPct }}%</span>
            </div>
            <div class="storage-bar">
              <span class="seg seg-free" :style="{ width: freeSegPct + '%' }"><i :style="{ width: freeUsedPct + '%' }"></i></span>
              <span class="seg seg-ent" :style="{ width: entSegPct + '%' }"><i :style="{ width: entUsedPct + '%' }"></i></span>
              <span class="seg seg-extra" :style="{ width: extraSegPct + '%' }"><i :style="{ width: extraUsedPct + '%' }"></i></span>
            </div>
            <div class="storage-usage">{{ formatSize(quotaUsed) }} / {{ formatSize(quotaTotal) }}</div>
            <div class="storage-legend">
              <span><i class="dot dot-free"></i>免费 {{ formatSize(freeBytes) }}</span>
              <span v-if="entBytes > 0"><i class="dot dot-ent"></i>企业 {{ formatSize(entBytes) }}</span>
              <span v-if="extraBytes > 0"><i class="dot dot-extra"></i>增值 {{ formatSize(extraBytes) }}</span>
            </div>
            <button class="storage-cta" type="button" @click="router.push('/packages')">
              扩容空间<el-icon><Right /></el-icon>
            </button>
          </div>
          <button v-else class="storage-mini" type="button" title="存储空间 / 扩容" @click="router.push('/packages')">
            <el-icon :size="18"><Coin /></el-icon>
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
import { ElNotification } from 'element-plus'
import { useAppStore } from '@/stores/app'
import logoUrl from '@/assets/logo.png'
import { useUserStore } from '@/stores/user'
import { useBillingStore } from '@/stores/billing'
import { usePermissionStore } from '@/stores/permission'
import EnterpriseNoticeBar from '@/components/EnterpriseNoticeBar.vue'
import { USER_MENUS, filterMenus } from '@/constants/menus'

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

// 菜单显隐按权限点；legacy 降级时隐藏依赖新接口的菜单（如「成员文件」）
const visibleMenus = computed(() => filterMenus(USER_MENUS, perm.can, { legacy: perm.legacy, identity: perm.identity }))

// 桌面端（Electron）才显示检查更新按钮；点击触发 App.vue 的手动检查
const isDesktop = !!window.desktop?.isDesktop
const checkForUpdate = () => document.dispatchEvent(new CustomEvent('app:check-update'))
const isMobile = ref(false)
const mobileMenuOpen = ref(false)

// 移动端抽屉里菜单始终展开；桌面/平板的折叠状态由 appStore 控制
const isCollapsed = computed(() => !isMobile.value && appStore.sidebarCollapsed)
// 侧边栏可用总额度：优先计费数据（免费+增量），未就绪时回退到登录时的配额快照
const quotaTotal = computed(() => billingStore.totalBytes || userStore.quota.total)
const quotaUsed = computed(() => billingStore.totalBytes ? billingStore.quota.usedBytes : userStore.quota.used)
// 额度条分段：青色=免费额度，蓝色=企业额度，绿色=增值额度；优先消耗免费额度
const freeBytes = computed(() => billingStore.totalBytes > 0 ? (billingStore.quota.personalBytes ?? billingStore.quota.freeBytes ?? 0) : quotaTotal.value)
const entBytes = computed(() => billingStore.quota.enterpriseBytes || 0)
const extraBytes = computed(() => billingStore.totalBytes > 0 ? (billingStore.quota.extraBytes || 0) : 0)
const freeSegPct = computed(() => quotaTotal.value > 0 ? (freeBytes.value / quotaTotal.value) * 100 : 0)
const entSegPct = computed(() => quotaTotal.value > 0 ? (entBytes.value / quotaTotal.value) * 100 : 0)
const extraSegPct = computed(() => quotaTotal.value > 0 ? (extraBytes.value / quotaTotal.value) * 100 : 0)
const freeUsedPct = computed(() => freeBytes.value > 0 ? (Math.min(quotaUsed.value, freeBytes.value) / freeBytes.value) * 100 : 0)
const entUsedPct = computed(() => {
  if (entBytes.value <= 0) return 0
  const rest = Math.max(0, quotaUsed.value - freeBytes.value)
  return Math.min(100, (Math.min(rest, entBytes.value) / entBytes.value) * 100)
})
const extraUsedPct = computed(() => {
  if (extraBytes.value <= 0) return 0
  const rest = Math.max(0, quotaUsed.value - freeBytes.value - entBytes.value)
  return Math.min(100, (rest / extraBytes.value) * 100)
})
// 总占用百分比（存储卡片右上角）
const usedPct = computed(() => quotaTotal.value > 0 ? Math.min(100, Math.round((quotaUsed.value / quotaTotal.value) * 100)) : 0)
// 头像首字
const avatarLetter = computed(() => {
  const name = userStore.displayName || perm.nickname || ''
  return name ? name.trim().charAt(0).toUpperCase() : 'U'
})

// 顶栏全局搜索：回车跳到「我的文件」并带上关键词
const quickKw = ref('')
const searchInputRef = ref(null)
function quickSearch() {
  const kw = quickKw.value.trim()
  router.push({ path: '/files', query: kw ? { kw } : {} })
  quickKw.value = ''
}
// 「/」聚焦搜索框（不在输入态时才生效）
function onHotkey(e) {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
  const tag = (e.target?.tagName || '').toLowerCase()
  if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return
  if (isMobile.value) return
  e.preventDefault()
  searchInputRef.value?.focus()
}

function updateViewport() {
  isMobile.value = window.innerWidth <= 768
  if (!isMobile.value) mobileMenuOpen.value = false
}

onMounted(() => {
  billingStore.loadWallet()
  updateViewport()
  // 只在该账号具备对应权限时才发请求，避免缺权限的账号一进页面就连弹提示
  if (perm.can('transfer.read')) notifyPendingTransfers()
  userStore.loadProfile().catch(() => {})
  if (perm.can('quota.read')) billingStore.loadQuota().catch(() => {})
  // 平板端（≤1024 且 >768）默认折叠侧边栏
  if (window.innerWidth <= 1024 && window.innerWidth > 768) {
    appStore.sidebarCollapsed = true
  }
  window.addEventListener('resize', updateViewport)
  window.addEventListener('keydown', onHotkey)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateViewport)
  window.removeEventListener('keydown', onHotkey)
})

async function notifyPendingTransfers() {
  const res = await fetchUploadTasks({ status: 'uploading', page: 0, size: 10 }).catch(() => null)
  const pending = res?.list || [] // 后端视角：仅 uploading 视为未完成（done/aborted 不算待续传）
  if (!pending.length) return
  ElNotification({
    title: '有未完成的传输任务',
    message: `检测到 ${res?.total ?? pending.length} 个上传任务未完成，可在左侧「传输任务」中继续。`,
    type: 'warning',
    duration: 6000
  })
}

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

function formatSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024, sizes = ['B','KB','MB','GB','TB','PB','EB','ZB','YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// 是否具备管理端身份（平台管理员 / 企业管理员）——与 AdminLayout 的「返回用户端」对称
const canUseAdmin = computed(() => perm.isPlatform || perm.isEnterpriseAdmin)

// 进入管理端：跳到该账号真正有权限的管理端落地页，而不是写死 /admin/dashboard
function goAdmin() {
  router.push(landingPath(perm, { prefer: 'admin' }))
}

function handleLogout() { userStore.logout(); router.push('/login') }
</script>

<style scoped>
.layout-user { display: flex; flex-direction: column; height: 100vh; overflow: hidden; background: var(--cs-bg-page); }

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
.brand-name { font-size: 15.5px; font-weight: 800; letter-spacing: -0.2px; color: var(--cs-text-primary); white-space: nowrap; }
.brand-sub { font-size: 9.5px; font-weight: 700; letter-spacing: 1.1px; text-transform: uppercase; color: var(--cs-primary); }

.icon-btn {
  width: 36px; height: 36px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 50%; border: 1px solid transparent; background: transparent;
  color: var(--cs-text-secondary); cursor: pointer;
  transition: all 0.2s ease;
}
.icon-btn:hover { background: var(--cs-bg-hover); color: var(--cs-primary-dark); }
.menu-btn { color: var(--cs-text-tertiary); }

.topbar-search {
  flex: 1;
  max-width: 520px;
  margin: 0 auto;
  display: flex; align-items: center; gap: 9px;
  height: 40px; padding: 0 14px;
  background: var(--cs-bg-field);
  border: 1px solid transparent;
  border-radius: var(--cs-radius-pill);
  color: var(--cs-text-tertiary);
  transition: all 0.2s ease;
}
.topbar-search:focus-within { background: var(--cs-bg-container); border-color: var(--cs-primary-light); box-shadow: var(--cs-focus-ring); color: var(--cs-primary); }
.topbar-search .search-icon { flex-shrink: 0; }
.topbar-search input {
  flex: 1; min-width: 0; border: none; outline: none; background: transparent;
  font-size: 13.5px; font-weight: 500; color: var(--cs-text-primary);
  font-family: inherit;
}
.topbar-search input::placeholder { color: var(--cs-text-tertiary); font-weight: 500; }
.topbar-search .kbd {
  flex-shrink: 0; min-width: 20px; height: 20px; line-height: 18px; text-align: center;
  border-radius: 6px; border: 1px solid var(--cs-border); background: var(--cs-bg-container);
  font-size: 11px; font-weight: 700; color: var(--cs-text-tertiary);
}

.topbar-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; margin-left: auto; }
.wallet-chip {
  display: inline-flex; align-items: center; gap: 5px;
  height: 32px; padding: 0 12px;
  border-radius: var(--cs-radius-pill);
  background: var(--cs-primary-lighter);
  color: var(--cs-primary-dark);
  font-size: 12px; font-weight: 600;
  border: 1px solid rgba(23, 190, 208, 0.18);
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
.user-meta { display: flex; flex-direction: column; line-height: 1.2; }
.user-name { font-size: 13px; font-weight: 700; color: var(--cs-text-primary); max-width: 132px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.user-role { font-size: 10.5px; color: var(--cs-text-tertiary); }
.user-caret { color: var(--cs-text-tertiary); }

/* ---------------- 主体：侧栏 + 内容 ---------------- */
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
.sidebar-menu {
  border-right: none !important;
  background: transparent !important;
  padding: 0;
}
.sidebar-menu .el-menu-item {
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
.sidebar-menu .el-menu-item .el-icon { font-size: 17px; width: 17px; margin-right: 11px; color: inherit; }
.sidebar-menu .el-menu-item:hover { background: var(--cs-sidebar-hover-bg); color: var(--cs-primary-dark); }
.sidebar-menu .el-menu-item.is-active {
  background: var(--cs-sidebar-active-bg);
  color: var(--cs-sidebar-active-text);
  font-weight: 700;
}
.sidebar-menu .el-menu-item.is-active::before {
  content: '';
  position: absolute; left: 0; top: 50%; transform: translateY(-50%);
  width: 3px; height: 18px; border-radius: 0 3px 3px 0;
  background: var(--cs-grad-brand);
}
.sidebar.collapsed .sidebar-menu .el-menu-item { padding-left: 0 !important; display: flex; justify-content: center; }
.sidebar.collapsed .sidebar-menu .el-menu-item .el-icon { margin-right: 0; }

/* 存储空间卡片 */
.sidebar-bottom { padding: 10px 12px 14px; border-top: 1px solid var(--cs-sidebar-border); flex-shrink: 0; }
.storage-card { background: var(--cs-grad-brand-muted); border: 1px solid var(--cs-border-light); border-radius: var(--cs-radius); padding: 13px; }
.storage-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 9px; }
.storage-title { font-size: 12px; font-weight: 700; color: var(--cs-text-secondary); letter-spacing: 0.2px; }
.storage-pct { font-size: 12px; font-weight: 800; color: var(--cs-primary-dark); font-variant-numeric: tabular-nums; }
.storage-bar { display: flex; gap: 2px; height: 7px; border-radius: 100px; overflow: hidden; background: rgba(23, 190, 208, 0.12); }
.seg { position: relative; height: 100%; overflow: hidden; }
.seg-free { background: rgba(23, 190, 208, 0.26); }
.seg-ent { background: rgba(122, 168, 255, 0.3); }
.seg-extra { background: rgba(47, 180, 131, 0.26); }
.seg i { position: absolute; left: 0; top: 0; height: 100%; display: block; transition: width 0.3s ease; border-radius: 0 100px 100px 0; }
.seg-free i { background: linear-gradient(90deg, #17bed0, #0291d5); }
.seg-ent i { background: linear-gradient(90deg, #7aa8ff, #5679ff); }
.seg-extra i { background: linear-gradient(90deg, #52d09c, #2fb483); }
.storage-usage { margin-top: 8px; font-size: 11.5px; font-weight: 700; color: var(--cs-text-primary); font-variant-numeric: tabular-nums; }
.storage-legend { display: flex; flex-wrap: wrap; gap: 3px 9px; margin-top: 7px; font-size: 10.5px; color: var(--cs-text-tertiary); }
.storage-legend span { display: inline-flex; align-items: center; gap: 4px; }
.storage-legend .dot { width: 5px; height: 5px; border-radius: 50%; display: inline-block; }
.dot-free { background: #17bed0; }
.dot-ent { background: #6c8cff; }
.dot-extra { background: #2fb483; }
.storage-cta {
  width: 100%; height: 32px; margin-top: 11px;
  display: inline-flex; align-items: center; justify-content: center; gap: 4px;
  border: none; border-radius: 9px;
  background: var(--cs-grad-brand); color: #fff;
  font-size: 12px; font-weight: 700; cursor: pointer;
  box-shadow: 0 5px 12px rgba(23, 190, 208, 0.26);
  transition: all 0.22s ease;
}
.storage-cta:hover { box-shadow: 0 9px 18px rgba(23, 190, 208, 0.36); transform: translateY(-1px); }
.storage-mini {
  width: 38px; height: 38px; margin: 0 auto; display: flex; align-items: center; justify-content: center;
  border-radius: 11px; border: 1px solid var(--cs-border); background: var(--cs-bg-container);
  color: var(--cs-primary-dark); cursor: pointer; transition: all 0.2s ease;
}
.storage-mini:hover { background: var(--cs-primary-lighter); border-color: var(--cs-primary-light); }

.content { flex: 1; min-width: 0; overflow-y: auto; background: var(--cs-bg-page); }
.mobile-mask { display: none; }

/* 平板端 */
@media (max-width: 1024px) and (min-width: 769px) {
  .topbar { padding: 0 14px 0 10px; gap: 10px; }
  .topbar-search { max-width: 320px; }
  .user-meta { display: none; }
}

/* 移动端：侧栏变抽屉，搜索退到第二行 */
@media (max-width: 768px) {
  .topbar { padding: 0 10px; gap: 8px; height: 58px; }
  .brand-text { display: none; }
  .topbar-search { display: none; }
  .topbar-right { gap: 4px; }
  .wallet-chip { display: none; }
  .user-meta { display: none; }
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
