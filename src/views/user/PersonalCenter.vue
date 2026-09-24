<template>
  <div class="cs-page">
    <h2 class="page-title"><el-icon><User /></el-icon>个人中心</h2>
    <div class="profile-grid">
      <div class="cs-card quota-card">
        <div class="quota-header">
          <h3>存储空间</h3>
          <el-tag :type="quotaPercent > 80 ? 'danger' : quotaPercent > 60 ? 'warning' : 'success'" size="small">{{ quotaPercent }}%</el-tag>
        </div>
        <div class="quota-visual">
          <div class="quota-bar">
            <div class="qbar-seg qbar-free" :style="{ width: freeSegPct + '%' }">
              <div class="qbar-fill qbar-free-fill" :style="{ width: freeUsedPct + '%' }"></div>
            </div>
            <div class="qbar-seg qbar-extra" :style="{ width: extraSegPct + '%' }">
              <div class="qbar-fill qbar-extra-fill" :style="{ width: extraUsedPct + '%' }"></div>
            </div>
          </div>
          <div class="quota-detail">
            <span class="qd-item"><i class="qdot qdot-free"></i>免费额度 {{ formatSize(billing.quota.freeBytes) }}</span>
            <span class="qd-item"><i class="qdot qdot-extra"></i>增值额度 {{ formatSize(billing.quota.extraBytes) }}</span>
          </div>
        </div>
        <div class="quota-breakdown">
          <div class="qseg">
            <div class="qseg-label">免费额度</div>
            <div class="qseg-val">{{ formatSize(billing.quota.freeBytes) }}</div>
          </div>
          <div class="qseg">
            <div class="qseg-label">增量额度</div>
            <div class="qseg-val">{{ formatSize(billing.quota.extraBytes) }}</div>
            <div class="qseg-sub" v-if="billing.quota.extraExpireAt">到期 {{ formatDate(billing.quota.extraExpireAt) }}</div>
          </div>
          <div class="qseg">
            <div class="qseg-label">已用空间</div>
            <div class="qseg-val">{{ formatSize(billing.quota.usedBytes) }}</div>
          </div>
        </div>
        <el-alert
          v-if="billing.quota.uploadBlocked"
          type="error" :closable="false" show-icon class="quota-block"
          title="存储额度已满"
          description="当前用量已超过可用额度，上传已被拦截。请申请增额，待审批通过后恢复上传。"
        />
        <div class="quota-actions" v-if="billing.quota.uploadBlocked">
          <el-button type="primary" size="small" @click="$router.push('/billing')">去申请增额</el-button>
        </div>
        <div class="quota-stats">
          <div class="quota-stat-item"><el-icon :size="20" color="var(--cs-primary)"><Document /></el-icon><div><div class="stat-num">{{ stats.totalFiles }}</div><div class="stat-label">文件数</div></div></div>
          <div class="quota-stat-item"><el-icon :size="20" color="var(--cs-success)"><Folder /></el-icon><div><div class="stat-num">{{ stats.totalDirs }}</div><div class="stat-label">文件夹</div></div></div>
          <div class="quota-stat-item"><el-icon :size="20" color="var(--cs-warning)"><Delete /></el-icon><div><div class="stat-num">{{ stats.recycleCount }}</div><div class="stat-label">回收站</div></div></div>
        </div>
      </div>
      <div class="cs-card password-card">
        <h3>修改密码</h3>
        <el-form :model="pwdForm" label-width="80px" style="margin-top: 20px">
          <el-form-item label="当前密码"><el-input v-model="pwdForm.oldPassword" type="password" show-password /></el-form-item>
          <el-form-item label="新密码"><el-input v-model="pwdForm.newPassword" type="password" show-password /></el-form-item>
          <el-form-item label="确认密码"><el-input v-model="pwdForm.confirmPassword" type="password" show-password /></el-form-item>
          <el-form-item><el-button type="primary" :loading="changing" @click="handleChangePassword">确认修改</el-button></el-form-item>
        </el-form>
      </div>
      <div class="cs-card info-card">
        <h3>账户信息</h3>
        <el-descriptions :column="1" border style="margin-top: 20px">
          <el-descriptions-item label="用户名">{{ userStore.username }}</el-descriptions-item>
          <el-descriptions-item label="角色"><el-tag :type="userStore.role === 'admin' ? 'danger' : ''">{{ userStore.role === 'admin' ? '管理员' : '普通用户' }}</el-tag></el-descriptions-item>
          <el-descriptions-item label="用户ID">{{ userStore.userId || '--' }}</el-descriptions-item>
          <el-descriptions-item label="上次登录">--</el-descriptions-item>
        </el-descriptions>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { useBillingStore } from '@/stores/billing'
import { statsApi, authApi } from '@/api'
import { formatSize, formatDate } from '@/utils/file'

const userStore = useUserStore()
const billing = useBillingStore()
const pwdForm = ref({ oldPassword: '', newPassword: '', confirmPassword: '' })
const changing = ref(false)
const stats = ref({ totalFiles: 0, totalDirs: 0, recycleCount: 0 })

const quotaPercent = computed(() => billing.totalBytes > 0 ? Math.min(100, Math.round(billing.quota.usedBytes / billing.totalBytes * 100)) : 0)

// —— 额度条分段：蓝色=免费额度，绿色=增值额度；优先消耗免费额度 ——
const usedBytes = computed(() => billing.quota.usedBytes || 0)
const freeBytes = computed(() => billing.quota.freeBytes || 0)
const extraBytes = computed(() => billing.quota.extraBytes || 0)
// 免费段 / 增值段 占总额度的宽度比例
const freeSegPct = computed(() => billing.totalBytes > 0 ? (freeBytes.value / billing.totalBytes) * 100 : 0)
const extraSegPct = computed(() => billing.totalBytes > 0 ? (extraBytes.value / billing.totalBytes) * 100 : 0)
// 免费额度内已用比例（先用免费）
const freeUsedPct = computed(() => freeBytes.value > 0 ? (Math.min(usedBytes.value, freeBytes.value) / freeBytes.value) * 100 : 0)
// 增值额度内已用比例（免费用完后才用增值）
const extraUsedPct = computed(() => extraBytes.value > 0 ? Math.min(100, (Math.max(0, usedBytes.value - freeBytes.value) / extraBytes.value) * 100) : 0)

onMounted(() => {
  // 刷新配额（/auth/profile）
  userStore.loadProfile().catch(() => {})
  // 计费额度（/billing/quota）
  billing.loadQuota().catch(() => {})
  // 个人存储统计（/stats/overview）
  statsApi.overview().then(s => {
    stats.value = { totalFiles: s.totalFiles || 0, totalDirs: s.totalDirs || 0, recycleCount: s.recycleCount || 0 }
  }).catch(() => {})
})

async function handleChangePassword() {
  if (!pwdForm.value.oldPassword || !pwdForm.value.newPassword) { ElMessage.error('请填写当前密码和新密码'); return }
  if (pwdForm.value.newPassword !== pwdForm.value.confirmPassword) { ElMessage.error('两次密码输入不一致'); return }
  changing.value = true
  try {
    await authApi.changePassword({ oldPassword: pwdForm.value.oldPassword, newPassword: pwdForm.value.newPassword })
    ElMessage.success('密码修改成功')
    pwdForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
  } catch (e) {
    // 错误提示由拦截器统一弹出
  } finally {
    changing.value = false
  }
}
</script>

<style scoped>
.page-title { display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 600; color: var(--cs-text-primary); margin: 0 0 24px 0; }
.profile-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
.quota-card { grid-column: 1 / -1; padding: 24px; }
.password-card, .info-card { padding: 24px; }
.password-card h3, .info-card h3, .quota-card h3 { font-size: 16px; font-weight: 600; color: var(--cs-text-primary); margin: 0; }
.quota-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.quota-bar { display: flex; gap: 2px; height: 12px; border-radius: 6px; overflow: hidden; margin-bottom: 12px; background: var(--cs-bg-hover); }
.qbar-seg { position: relative; height: 100%; overflow: hidden; }
.qbar-free { background: #dbeafe; }
.qbar-extra { background: #d1fae5; }
.qbar-fill { position: absolute; left: 0; top: 0; height: 100%; transition: width 0.3s ease; }
.qbar-free-fill { background: #3b82f6; }
.qbar-extra-fill { background: #22c55e; }
.quota-detail { display: flex; gap: 24px; align-items: center; flex-wrap: wrap; font-size: 14px; color: var(--cs-text-secondary); margin-bottom: 16px; }
.qd-item { display: inline-flex; align-items: center; gap: 6px; }
.qdot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
.qdot-free { background: #3b82f6; }
.qdot-extra { background: #22c55e; }
.quota-breakdown { display: flex; gap: 32px; flex-wrap: wrap; padding: 16px; background: var(--cs-bg-hover); border-radius: 6px; margin-bottom: 16px; }
.qseg { min-width: 100px; }
.qseg-label { font-size: 12px; color: var(--cs-text-tertiary); margin-bottom: 4px; }
.qseg-val { font-size: 16px; font-weight: 600; color: var(--cs-text-primary); }
.qseg-sub { font-size: 12px; color: var(--cs-text-secondary); margin-top: 4px; }
.quota-block { margin-bottom: 16px; }
.quota-actions { margin-bottom: 16px; }
.quota-stats { display: flex; gap: 32px; padding-top: 20px; border-top: 1px solid var(--cs-border); }
.quota-stat-item { display: flex; align-items: center; gap: 12px; }
.stat-num { font-size: 20px; font-weight: 600; color: var(--cs-text-primary); }
.stat-label { font-size: 12px; color: var(--cs-text-tertiary); }
@media (max-width: 768px) {
  .profile-grid { grid-template-columns: 1fr; gap: 16px; }
  .quota-stats { gap: 16px; flex-wrap: wrap; }
  .quota-card, .password-card, .info-card { padding: 16px; }
  .quota-stat-item { gap: 8px; }
  .quota-breakdown { gap: 16px; }
}
</style>