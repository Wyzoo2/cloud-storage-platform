<template>
  <div class="login-page">
    <!-- 左侧：品牌与产品介绍（沿用原内容与主题色） -->
    <section class="login-brand">
      <header class="brand-head">
        <div class="brand-icon"><img :src="logoUrl" alt="优芽云存储" class="brand-logo" /></div>
        <div class="brand-name-box">
          <div class="brand-name">优芽云存储</div>
          <div class="brand-en">CLOUD STORAGE PLATFORM</div>
        </div>
      </header>

      <div class="brand-body">
        <h1 class="brand-title">私有云存储平台</h1>
        <p class="brand-desc">统一的文件工作台，上传、检索、权限与容量管理在一处完成</p>

        <div class="brand-features">
          <div class="feature-item">
            <el-icon :size="22"><UploadFilled /></el-icon>
            <div class="feature-text">
              <div class="f-title">分片上传 / 秒传 / 断点续传</div>
              <div class="f-desc">大文件稳定送达，弱网也能续传</div>
            </div>
          </div>
          <div class="feature-item">
            <el-icon :size="22"><Lock /></el-icon>
            <div class="feature-text">
              <div class="f-title">数据本地存储 / 安全可控</div>
              <div class="f-desc">私有化部署，文件不出内网</div>
            </div>
          </div>
          <div class="feature-item">
            <el-icon :size="22"><Monitor /></el-icon>
            <div class="feature-text">
              <div class="f-title">200 人起步 / 可扩展至 1000+</div>
              <div class="f-desc">企业与部门空间按需分配</div>
            </div>
          </div>
        </div>
      </div>

      <footer class="brand-footer">
        <el-icon :size="14"><LocationInformation /></el-icon>
        <span>内网部署 · 数据安全</span>
        <span class="foot-copy">© 2026</span>
      </footer>
    </section>

    <!-- 右侧：登录面板 -->
    <aside class="login-side">
      <button
        class="theme-btn"
        :title="appStore.theme === 'light' ? '切换暗色模式' : '切换亮色模式'"
        @click="appStore.toggleTheme"
      >
        <el-icon :size="15"><Moon v-if="appStore.theme === 'light'" /><Sunny v-else /></el-icon>
      </button>

      <div class="login-box">
        <h2 class="login-title">登录</h2>
        <p class="login-sub">{{ portal === 'admin' ? '用管理员账号进入管理端' : '用账号密码进入控制台' }}</p>

        <div class="portal-switch">
          <el-radio-group v-model="portal" size="large">
            <el-radio-button value="user"><el-icon><User /></el-icon><span>用户端</span></el-radio-button>
            <el-radio-button value="admin"><el-icon><UserFilled /></el-icon><span>管理端</span></el-radio-button>
          </el-radio-group>
        </div>

        <el-form ref="formRef" :model="form" :rules="rules" class="login-form" @submit.prevent="handleLogin">
          <div class="field">
            <label class="field-label">账号</label>
            <el-form-item prop="username">
              <el-input v-model="form.username" placeholder="请输入用户名" :prefix-icon="User" clearable />
            </el-form-item>
          </div>
          <div class="field">
            <label class="field-label">密码</label>
            <el-form-item prop="password">
              <el-input
                v-model="form.password"
                type="password"
                placeholder="请输入密码"
                :prefix-icon="Lock"
                show-password
                @keyup.enter="handleLogin"
              />
            </el-form-item>
          </div>

          <div class="row-between">
            <el-checkbox v-model="remember" size="small">记住登录信息</el-checkbox>
          </div>

          <el-button type="primary" :loading="loading" class="login-btn" @click="handleLogin">
            登 录
            <el-icon v-if="!loading" class="btn-arrow"><Right /></el-icon>
          </el-button>
        </el-form>

        <p class="login-tip">账号由管理员开通 · 忘记密码请联系管理员</p>
        <div class="login-footer"><span class="footer-text">© 2026 优芽云存储 · 私有化部署方案</span></div>
      </div>
    </aside>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Lock,
  LocationInformation,
  Monitor,
  Moon,
  Right,
  Sunny,
  UploadFilled,
  User,
  UserFilled
} from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { usePermissionStore } from '@/stores/permission'
import { landingPath } from '@/utils/landing'
import { useAppStore } from '@/stores/app'
import logoUrl from '@/assets/logo.png'
import { authApi } from '@/api'

const REMEMBER_KEY = 'cs-remember-username'

const router = useRouter()
const userStore = useUserStore()
const appStore = useAppStore()
const portal = ref('user')
const loading = ref(false)
const remember = ref(false)
const formRef = ref(null)
const form = ref({ username: '', password: '' })
const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

onMounted(() => {
  const saved = localStorage.getItem(REMEMBER_KEY) || ''
  if (saved) {
    form.value.username = saved
    remember.value = true
  }
})

async function handleLogin() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    const payload = { username: form.value.username.trim(), password: form.value.password }
    // 用户端：POST /auth/login（门户账号校验）
    // 管理端：POST /admin/login（后端只校验本地管理员密码，管理员密码不出本机）
    // 两者请求体与成功响应体（{ accessToken, refreshToken, user }）完全一致
    const res = portal.value === 'admin' ? await authApi.adminLogin(payload) : await authApi.login(payload)
    userStore.login(res)
    // 记住登录信息：只存账号，不存密码
    if (remember.value) localStorage.setItem(REMEMBER_KEY, payload.username)
    else localStorage.removeItem(REMEMBER_KEY)
    // 先拿权限上下文，再决定去管理端还是用户端
    const perm = usePermissionStore()
    await perm.load(true)
    const wantsAdmin = portal.value === 'admin'
    const canAdmin = perm.isPlatform || perm.isEnterpriseAdmin
    if (wantsAdmin && !canAdmin) ElMessage.warning('该账号无管理端权限，已进入用户端')
    ElMessage.success('登录成功')
    router.push(landingPath(perm, { prefer: wantsAdmin && canAdmin ? 'admin' : 'user' }))
  } catch (e) {
    // 错误提示由请求拦截器统一弹出（如"用户名或密码错误"）
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  background: var(--cs-bg-page);
  color: var(--cs-text-primary);
  overflow-x: hidden;
}

/* ---------------- 左侧品牌区（沿用原渐变主题） ---------------- */
.login-brand {
  flex: 7 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 40px 56px 24px;
  color: #fff;
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #1677ff 0%, #4096ff 50%, #764ba2 100%);
}
.login-brand::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(255, 255, 255, 0.14) 1px, transparent 1px);
  background-size: 22px 22px;
  pointer-events: none;
}
[data-theme="dark"] .login-brand {
  background: linear-gradient(135deg, #0f1b33 0%, #131c31 50%, #1b1b35 100%);
  border-right: 1px solid var(--cs-border);
}

.brand-head { display: flex; align-items: center; gap: 12px; position: relative; z-index: 1; }
.brand-icon { width: 40px; height: 40px; border-radius: 10px; overflow: hidden; flex: none; background: #fff; box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18); }
.brand-logo { width: 100%; height: 100%; object-fit: cover; display: block; }
.brand-name { font-size: 16px; font-weight: 700; letter-spacing: .2px; }
.brand-en { margin-top: 3px; font-size: 10px; letter-spacing: 1.6px; opacity: 0.75; }

.brand-body { padding: 72px 0 0; max-width: 600px; position: relative; z-index: 1; }
.brand-title { margin: 0; font-size: 38px; font-weight: 800; letter-spacing: -1px; line-height: 1.15; }
.brand-desc { margin: 16px 0 0; font-size: 14px; line-height: 1.9; opacity: 0.85; }

.brand-features { margin-top: 52px; display: flex; flex-direction: column; gap: 22px; }
.feature-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 22px 24px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.10);
  border: 1px solid rgba(255, 255, 255, 0.16);
  transition: background var(--cs-transition), transform var(--cs-transition);
}
.feature-item:hover { background: rgba(255, 255, 255, 0.18); transform: translateX(4px); }
[data-theme="dark"] .feature-item { background: rgba(59, 130, 246, 0.12); border-color: rgba(59, 130, 246, 0.24); }
[data-theme="dark"] .feature-item:hover { background: rgba(59, 130, 246, 0.22); }
.feature-item .el-icon { margin-top: 1px; opacity: 0.95; }
.f-title { font-size: 15.5px; font-weight: 600; letter-spacing: .2px; }
.f-desc { margin-top: 8px; font-size: 13px; line-height: 1.7; opacity: 0.8; }

.brand-footer {
  margin-top: auto;
  padding-top: 24px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  opacity: 0.75;
  position: relative;
  z-index: 1;
}
.foot-copy { margin-left: auto; }

/* ---------------- 右侧登录面板 ---------------- */
.login-side {
  flex: 3 1 0;
  min-width: 0;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 36px;
  background: var(--cs-bg-container);
  border-left: 1px solid var(--cs-border-light);
}
.theme-btn {
  position: absolute;
  top: 18px;
  right: 18px;
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--cs-border);
  border-radius: 8px;
  background: var(--cs-bg-container);
  color: var(--cs-text-secondary);
  cursor: pointer;
  transition: color var(--cs-transition), border-color var(--cs-transition);
}
.theme-btn:hover { color: var(--cs-primary); border-color: var(--cs-primary-light); }

.login-box { width: 100%; max-width: 340px; }
.login-title { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -.3px; }
.login-sub { margin: 8px 0 26px; font-size: 12px; color: var(--cs-text-tertiary); }

.portal-switch { margin-bottom: 24px; }
.portal-switch :deep(.el-radio-group) { width: 100%; display: flex; }
.portal-switch :deep(.el-radio-button) { flex: 1; }
.portal-switch :deep(.el-radio-button__inner) {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 38px;
  font-size: 13px;
  font-weight: 500;
}

.field { margin-bottom: 18px; }
.field-label { display: block; margin-bottom: 8px; font-size: 12px; color: var(--cs-text-secondary); }
.login-form :deep(.el-form-item) { margin-bottom: 0; }
.login-form :deep(.el-input__wrapper) { height: 40px; border-radius: 6px; }

.row-between { display: flex; align-items: center; justify-content: space-between; margin: 2px 0 20px; }
.row-between :deep(.el-checkbox__label) { font-size: 12px; color: var(--cs-text-secondary); }

.login-btn {
  width: 100%;
  height: 44px;
  border-radius: 6px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 2px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: linear-gradient(135deg, var(--cs-primary) 0%, var(--cs-primary-dark) 100%);
  border: none;
  box-shadow: var(--cs-primary-shadow);
}
.login-btn:hover { box-shadow: var(--cs-primary-shadow-hover); }
.btn-arrow { font-size: 13px; }

.login-tip { margin: 18px 0 0; font-size: 11.5px; color: var(--cs-text-tertiary); line-height: 1.8; white-space: nowrap; }
.login-footer { margin-top: 22px; }
.footer-text { font-size: 11px; color: var(--cs-text-tertiary); }

/* ---------------- 响应式 ---------------- */
@media (max-width: 1100px) {
  .login-brand { padding: 32px 40px 20px; }
  .brand-body { padding-top: 52px; }
  .brand-title { font-size: 32px; }
}
@media (max-width: 900px) {
  .login-page { flex-direction: column; }
  .login-brand { width: 100%; max-width: 100%; padding: 24px 20px 16px; }
  .login-side { width: 100%; max-width: 100%; }
  .brand-body, .login-box { width: 100%; max-width: 100%; }
  .brand-body { padding-top: 32px; }
  .brand-features { display: none; }
  .brand-title { font-size: 26px; }
  .brand-desc { font-size: 13px; }
  .login-side { flex: 1; padding: 32px 24px 40px; border-left: none; border-top: 1px solid var(--cs-border-light); }
  .theme-btn { top: 14px; right: 18px; }
}
</style>