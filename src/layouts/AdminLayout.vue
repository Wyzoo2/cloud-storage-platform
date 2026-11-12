<template>
  <div class="site-shell">
    <SiteHeader :links="primaryLinks" :brand-to="'/admin/dashboard'" badge="管理端" subtitle="Admin Console">
      <template #actions>
        <el-dropdown v-if="moreLinks.length" trigger="click" placement="bottom-end">
          <button class="more-btn" type="button">更多<el-icon :size="12"><ArrowDown /></el-icon></button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-for="l in moreLinks" :key="l.to" @click="router.push(l.to)">{{ l.label }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <span v-if="perm.enterpriseName" class="soft-chip">{{ perm.enterpriseName }}</span>
        <button v-if="isDesktop" class="nav-icon-btn" type="button" title="检查更新" @click="checkForUpdate">
          <el-icon :size="17"><RefreshRight /></el-icon>
        </button>
        <button class="nav-icon-btn" type="button" :title="appStore.theme === 'light' ? '切换暗色' : '切换亮色'" @click="appStore.toggleTheme">
          <el-icon :size="17"><Moon v-if="appStore.theme === 'light'" /><Sunny v-else /></el-icon>
        </button>
        <el-dropdown trigger="click">
          <span class="nav-user">
            <el-avatar :size="32" class="nav-avatar admin-avatar">{{ avatarLetter }}</el-avatar>
            <span class="nav-user__name">{{ userStore.displayName || perm.nickname }}</span>
            <el-icon :size="12" class="nav-user__caret"><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-if="hasUserPortal" @click="router.push('/')"><el-icon><Back /></el-icon>返回用户端</el-dropdown-item>
              <el-dropdown-item divided @click="handleLogout"><el-icon><SwitchButton /></el-icon>退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </template>
    </SiteHeader>

    <main class="site-main content">
      <EnterpriseNoticeBar />
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in"><component :is="Component" /></transition>
      </router-view>
    </main>

    <SiteFooter brand-to="/admin/dashboard" />
    <!-- 已按需求停用：强制改密弹框（恢复时取消注释）
    <ForcePasswordDialog />
    -->
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useUserStore } from '@/stores/user'
import { usePermissionStore } from '@/stores/permission'
import { useBillingStore } from '@/stores/billing'
import SiteHeader from '@/components/SiteHeader.vue'
import SiteFooter from '@/components/SiteFooter.vue'
import EnterpriseNoticeBar from '@/components/EnterpriseNoticeBar.vue'
import { ADMIN_MENUS, USER_MENUS, filterMenus } from '@/constants/menus'
// 已按需求停用：强制改密弹框
// import ForcePasswordDialog from '@/components/ForcePasswordDialog.vue'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const userStore = useUserStore()
const perm = usePermissionStore()
const walletStore = useBillingStore()

const currentRoleName = computed(() => perm.identityLabel || '')
const visibleMenus = computed(() => filterMenus(ADMIN_MENUS, perm.can, { identity: perm.identity }))
const hasUserPortal = computed(() => filterMenus(USER_MENUS, perm.can, { identity: perm.identity }).length > 0)

// 顶栏横向导航：有子菜单的归入「更多」下拉，其余平铺
const flatLinks = computed(() => visibleMenus.value.map(m => ({
  label: m.title,
  to: m.children ? m.children[0].path : m.path,
  children: m.children || null,
  active: m.children
    ? m.children.some(c => route.path === c.path)
    : route.path === m.path
})))
const primaryLinks = computed(() => flatLinks.value.filter(l => !l.children).slice(0, 6).map(({ label, to, active }) => ({ label, to, active })))
const moreLinks = computed(() => {
  const extraFlat = flatLinks.value.filter(l => !l.children).slice(6).map(({ label, to }) => ({ label, to }))
  const subs = flatLinks.value
    .filter(l => l.children)
    .flatMap(l => l.children.map(c => ({ label: `${l.label} · ${c.title}`, to: c.path })))
  return [...extraFlat, ...subs]
})

const avatarLetter = computed(() => {
  const name = userStore.displayName || perm.nickname || ''
  return name ? name.trim().charAt(0).toUpperCase() : 'A'
})

const isDesktop = !!window.desktop?.isDesktop
const checkForUpdate = () => document.dispatchEvent(new CustomEvent('app:check-update'))

onMounted(() => {
  walletStore.loadWallet()
})

function handleLogout() { userStore.logout(); router.push('/login') }
</script>

<style scoped>
.more-btn {
  display: inline-flex; align-items: center; gap: 4px;
  height: 38px; padding: 0 14px;
  border-radius: 100px; border: 1px solid var(--cs-border);
  background: var(--cs-bg-container); color: var(--cs-text-secondary);
  font-size: 12.5px; font-weight: 700; cursor: pointer;
  transition: all 0.2s ease;
}
.more-btn:hover { color: var(--cs-primary-dark); border-color: var(--cs-primary-light); background: var(--cs-primary-lighter); }
.soft-chip {
  display: inline-flex; align-items: center; height: 30px; padding: 0 12px;
  border-radius: 100px;
  background: var(--cs-primary-lighter); color: var(--cs-primary-dark);
  border: 1px solid rgba(23,190,208,.18);
  font-size: 11.5px; font-weight: 700; white-space: nowrap;
  max-width: 160px; overflow: hidden; text-overflow: ellipsis;
}
.nav-icon-btn {
  width: 38px; height: 38px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 50%; border: 1px solid var(--cs-border); background: var(--cs-bg-container);
  color: var(--cs-text-secondary); cursor: pointer; transition: all 0.2s ease;
}
.nav-icon-btn:hover { color: var(--cs-primary-dark); border-color: var(--cs-primary-light); background: var(--cs-primary-lighter); }
.nav-user {
  display: inline-flex; align-items: center; gap: 8px;
  height: 38px; padding: 0 10px 0 3px;
  border-radius: 100px; border: 1px solid transparent;
  cursor: pointer; outline: none; transition: all 0.2s ease;
}
.nav-user:hover { background: var(--cs-bg-hover); border-color: var(--cs-border-light); }
.nav-avatar { background: var(--cs-grad-brand); color: #fff; font-size: 13px; font-weight: 800; }
.admin-avatar { background: linear-gradient(135deg, #7aa8ff 0%, #5679ff 100%); }
.nav-user__name { font-size: 13px; font-weight: 700; color: var(--cs-text-primary); max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nav-user__caret { color: var(--cs-text-tertiary); }

@media (max-width: 1080px) {
  .soft-chip, .nav-user__name { display: none; }
}
</style>
