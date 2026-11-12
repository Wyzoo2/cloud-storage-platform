<template>
  <div class="site-shell">
    <SiteHeader :links="navLinks" :brand-to="'/files'" subtitle="Cloud Drive">
      <template #actions>
        <el-popover placement="bottom-end" trigger="click" :width="268" popper-class="storage-pop">
          <template #reference>
            <button class="storage-chip" type="button">
              <span class="storage-chip__bar">
                <i :style="{ width: freeUsedPct + '%' }"></i>
                <i class="seg-ent" :style="{ width: entUsedPct + '%' }"></i>
                <i class="seg-extra" :style="{ width: extraUsedPct + '%' }"></i>
              </span>
              <span class="storage-chip__text">{{ formatSize(quotaUsed) }} / {{ formatSize(quotaTotal) }}</span>
            </button>
          </template>
          <div class="storage-card">
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
        </el-popover>

        <button v-if="isDesktop" class="nav-icon-btn" type="button" title="检查更新" @click="checkForUpdate">
          <el-icon :size="17"><RefreshRight /></el-icon>
        </button>
        <button class="nav-icon-btn" type="button" :title="appStore.theme === 'light' ? '切换暗色' : '切换亮色'" @click="appStore.toggleTheme">
          <el-icon :size="17"><Moon v-if="appStore.theme === 'light'" /><Sunny v-else /></el-icon>
        </button>

        <el-dropdown trigger="click">
          <span class="nav-user">
            <el-avatar :size="32" class="nav-avatar">{{ avatarLetter }}</el-avatar>
            <span class="nav-user__name">{{ userStore.displayName || perm.nickname }}</span>
            <el-icon :size="12" class="nav-user__caret"><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="router.push('/profile')"><el-icon><Setting /></el-icon>个人设置</el-dropdown-item>
              <el-dropdown-item v-if="canUseAdmin" divided @click="goAdmin"><el-icon><Monitor /></el-icon>进入管理端</el-dropdown-item>
              <el-dropdown-item :divided="!canUseAdmin" @click="handleLogout"><el-icon><SwitchButton /></el-icon>退出登录</el-dropdown-item>
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

    <SiteFooter brand-to="/files" />
    <!-- 已按需求停用：强制改密弹框（恢复时取消注释）
    <ForcePasswordDialog />
    -->
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElNotification } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useUserStore } from '@/stores/user'
import { useBillingStore } from '@/stores/billing'
import { usePermissionStore } from '@/stores/permission'
import SiteHeader from '@/components/SiteHeader.vue'
import SiteFooter from '@/components/SiteFooter.vue'
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

// 顶栏导航 = 权限过滤后的用户端菜单（横向排列，参照 pCloud.com 顶部导航）
const visibleMenus = computed(() => filterMenus(USER_MENUS, perm.can, { legacy: perm.legacy, identity: perm.identity }))
const navLinks = computed(() =>
  visibleMenus.value.map(m => ({ label: m.title, to: m.path, active: route.path === m.path }))
)

// 桌面端（Electron）才显示检查更新按钮
const isDesktop = !!window.desktop?.isDesktop
const checkForUpdate = () => document.dispatchEvent(new CustomEvent('app:check-update'))

// 额度：优先计费数据（免费+企业+增量），未就绪时回退登录快照
const quotaTotal = computed(() => billingStore.totalBytes || userStore.quota.total)
const quotaUsed = computed(() => billingStore.totalBytes ? billingStore.quota.usedBytes : userStore.quota.used)
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
const usedPct = computed(() => quotaTotal.value > 0 ? Math.min(100, Math.round((quotaUsed.value / quotaTotal.value) * 100)) : 0)
const avatarLetter = computed(() => {
  const name = userStore.displayName || perm.nickname || ''
  return name ? name.trim().charAt(0).toUpperCase() : 'U'
})

onMounted(() => {
  billingStore.loadWallet()
  if (perm.can('transfer.read')) notifyPendingTransfers()
  userStore.loadProfile().catch(() => {})
  if (perm.can('quota.read')) billingStore.loadQuota().catch(() => {})
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
  if (!bytes) return '0 B'
  const k = 1024, sizes = ['B','KB','MB','GB','TB','PB','EB','ZB','YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const canUseAdmin = computed(() => perm.isPlatform || perm.isEnterpriseAdmin)
function goAdmin() { router.push(landingPath(perm, { prefer: 'admin' })) }
function handleLogout() { userStore.logout(); router.push('/login') }
</script>

<style scoped>
.storage-chip {
  display: inline-flex; align-items: center; gap: 9px;
  height: 38px; padding: 0 14px;
  border-radius: 100px;
  border: 1px solid var(--cs-border);
  background: var(--cs-bg-container);
  cursor: pointer;
  transition: all 0.2s ease;
}
.storage-chip:hover { border-color: var(--cs-primary-light); background: var(--cs-primary-lighter); }
.storage-chip__bar { display: inline-flex; width: 54px; height: 6px; border-radius: 100px; overflow: hidden; background: rgba(23,190,208,.14); }
.storage-chip__bar i { display: block; height: 100%; background: linear-gradient(90deg, #17bed0, #0291d5); }
.storage-chip__bar i.seg-ent { background: linear-gradient(90deg, #7aa8ff, #5679ff); }
.storage-chip__bar i.seg-extra { background: linear-gradient(90deg, #52d09c, #2fb483); }
.storage-chip__text { font-size: 12px; font-weight: 700; color: var(--cs-text-secondary); font-variant-numeric: tabular-nums; white-space: nowrap; }

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
.nav-user__name { font-size: 13px; font-weight: 700; color: var(--cs-text-primary); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nav-user__caret { color: var(--cs-text-tertiary); }

/* 存储弹层内容 */
.storage-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.storage-title { font-size: 12.5px; font-weight: 700; color: var(--cs-text-secondary); }
.storage-pct { font-size: 12px; font-weight: 800; color: var(--cs-primary-dark); }
.storage-bar { display: flex; gap: 2px; height: 8px; border-radius: 100px; overflow: hidden; background: rgba(23,190,208,.12); }
.seg { position: relative; height: 100%; overflow: hidden; }
.seg-free { background: rgba(23,190,208,.26); }
.seg-ent { background: rgba(122,168,255,.3); }
.seg-extra { background: rgba(47,180,131,.26); }
.seg i { position: absolute; left: 0; top: 0; height: 100%; display: block; border-radius: 0 100px 100px 0; }
.seg-free i { background: linear-gradient(90deg, #17bed0, #0291d5); }
.seg-ent i { background: linear-gradient(90deg, #7aa8ff, #5679ff); }
.seg-extra i { background: linear-gradient(90deg, #52d09c, #2fb483); }
.storage-usage { margin-top: 9px; font-size: 12px; font-weight: 700; color: var(--cs-text-primary); font-variant-numeric: tabular-nums; }
.storage-legend { display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: 8px; font-size: 11px; color: var(--cs-text-tertiary); }
.storage-legend span { display: inline-flex; align-items: center; gap: 4px; }
.storage-legend .dot { width: 6px; height: 6px; border-radius: 50%; }
.dot-free { background: #17bed0; }
.dot-ent { background: #6c8cff; }
.dot-extra { background: #2fb483; }
.storage-cta {
  width: 100%; height: 34px; margin-top: 12px;
  display: inline-flex; align-items: center; justify-content: center; gap: 4px;
  border: none; border-radius: 100px;
  background: var(--cs-grad-brand); color: #fff;
  font-size: 12.5px; font-weight: 700; cursor: pointer;
  box-shadow: 0 8px 18px rgba(23,190,208,.26);
}
.storage-cta:hover { box-shadow: 0 12px 24px rgba(23,190,208,.36); }

@media (max-width: 1080px) {
  .storage-chip__text { display: none; }
  .nav-user__name { display: none; }
}
</style>
