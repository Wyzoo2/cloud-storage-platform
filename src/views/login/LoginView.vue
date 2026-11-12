<template>
  <div class="login-page">
    <!-- 左侧：品牌与产品介绍（pCloud 青蓝渐变主视觉） -->
    <section class="login-brand">
      <span class="blob blob-a"></span>
      <span class="blob blob-b"></span>
      <span class="blob blob-c"></span>

      <header class="brand-head">
        <div class="brand-icon"><img :src="logoUrl" alt="云存储" class="brand-logo" /></div>
        <div class="brand-name-box">
          <div class="brand-name">云存储</div>
          <div class="brand-en">CLOUD STORAGE PLATFORM</div>
        </div>
      </header>

      <div class="brand-body">
        <span class="hero-pill"><el-icon :size="13"><Lock /></el-icon>私有化部署 · 文件不出内网</span>
        <h1 class="brand-title">你的文件，<br /><span class="title-accent">都在一处云端</span></h1>
        <p class="brand-desc">上传、检索、共享与容量管理，在一个清爽的工作台里全部完成。</p>

        <div class="brand-features">
          <div class="feature-item">
            <span class="feature-icon"><el-icon :size="18"><UploadFilled /></el-icon></span>
            <div class="feature-text">
              <div class="f-title">分片上传 / 秒传 / 断点续传</div>
              <div class="f-desc">大文件稳定送达，弱网也能续传</div>
            </div>
          </div>
          <div class="feature-item">
            <span class="feature-icon"><el-icon :size="18"><Lock /></el-icon></span>
            <div class="feature-text">
              <div class="f-title">数据本地存储 / 安全可控</div>
              <div class="f-desc">私有化部署，文件不出内网</div>
            </div>
          </div>
          <div class="feature-item">
            <span class="feature-icon"><el-icon :size="18"><Monitor /></el-icon></span>
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
        <div class="login-mark"><img :src="logoUrl" alt="云存储" /></div>
        <h2 class="login-title">欢迎回来</h2>
        <p class="login-sub">{{ portal === 'admin' ? '用管理员账号进入管理端' : '登录以继续使用你的云盘' }}</p>

        <div class="portal-switch">
          <button
            type="button"
            class="switch-item"
            :class="{ active: portal === 'user' }"
            @click="portal = 'user'"
          >
            <el-icon :size="15"><User /></el-icon><span>用户端</span>
          </button>
          <button
            type="button"
            class="switch-item"
            :class="{ active: portal === 'admin' }"
            @click="portal = 'admin'"
          >
            <el-icon :size="15"><UserFilled /></el-icon><span>管理端</span>
          </button>
        </div>

        <el-form ref="formRef" :model="form" :rules="rules" class="login-form" @submit.prevent="handleLogin">
          <div class="field">
            <label class="field-label">账号</label>
            <el-form-item prop="username">
              <el-input v-model="form.username" size="large" placeholder="请输入用户名" :prefix-icon="User" clearable />
            </el-form-item>
          </div>
          <div class="field">
            <label class="field-label">密码</label>
            <el-form-item prop="password">
              <el-input
                v-model="form.password"
                size="large"
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
            <span class="forget-hint">忘记密码请联系管理员</span>
          </div>

          <el-button type="primary" size="large" :loading="loading" class="login-btn" @click="handleLogin">
            登 录
            <el-icon v-if="!loading" class="btn-arrow"><Right /></el-icon>
          </el-button>
        </el-form>

        <p class="login-tip">账号由管理员开通 · 单点登录与审计能力随企业策略生效</p>
        <div class="login-footer"><span class="footer-text">© 2026 云存储 · 私有化部署方案</span></div>
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

/* ---------------- 左侧品牌区 ---------------- */
.login-brand {
  flex: 6 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 40px 56px 26px;
  color: #fff;
  position: relative;
  overflow: hidden;
  background: linear-gradient(270deg, #17bed0 0%, #0291d5 100%);
}
.blob {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  filter: blur(2px);
  opacity: 0.5;
}
.blob-a { width: 420px; height: 420px; right: -120px; top: -140px; background: radial-gradient(circle at 30% 30%, rgba(255,255,255,.55), rgba(255,255,255,0) 65%); }
.blob-b { width: 520px; height: 520px; left: -180px; bottom: -220px; background: radial-gradient(circle at 50% 50%, rgba(9, 62, 122, .55), rgba(9,62,122,0) 68%); opacity: .45; }
.blob-c { width: 240px; height: 240px; right: 12%; bottom: 8%; background: radial-gradient(circle at 50% 50%, rgba(255,255,255,.32), rgba(255,255,255,0) 70%); }
[data-theme="dark"] .login-brand {
  background: linear-gradient(270deg, #0d5a66 0%, #073a5e 100%);
}
[data-theme="dark"] .blob-a { opacity: .22; }

.brand-head { display: flex; align-items: center; gap: 12px; position: relative; z-index: 1; }
.brand-icon { width: 42px; height: 42px; border-radius: 13px; overflow: hidden; flex: none; background: #fff; box-shadow: 0 8px 20px rgba(6, 46, 74, 0.22); }
.brand-logo { width: 100%; height: 100%; object-fit: cover; display: block; }
.brand-name { font-size: 16.5px; font-weight: 800; letter-spacing: .2px; }
.brand-en { margin-top: 3px; font-size: 10px; letter-spacing: 1.8px; opacity: 0.78; font-weight: 600; }

.brand-body { padding: 64px 0 0; max-width: 560px; position: relative; z-index: 1; }
.hero-pill {
  display: inline-flex; align-items: center; gap: 6px;
  height: 30px; padding: 0 14px;
  border-radius: 100px;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.26);
  font-size: 12px; font-weight: 600;
  backdrop-filter: blur(6px);
}
.brand-title { margin: 20px 0 0; font-size: 44px; font-weight: 800; letter-spacing: -1.2px; line-height: 1.14; }
.title-accent { opacity: .92; }
.brand-desc { margin: 18px 0 0; font-size: 14.5px; line-height: 1.85; max-width: 460px; opacity: 0.88; }

.brand-features { margin-top: 44px; display: flex; flex-direction: column; gap: 14px; }
.feature-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.20);
  backdrop-filter: blur(10px);
  transition: background var(--cs-transition), transform var(--cs-transition);
}
.feature-item:hover { background: rgba(255, 255, 255, 0.22); transform: translateX(4px); }
[data-theme="dark"] .feature-item { background: rgba(23, 190, 208, 0.14); border-color: rgba(23, 190, 208, 0.26); }
[data-theme="dark"] .feature-item:hover { background: rgba(23, 190, 208, 0.22); }
.feature-icon {
  width: 40px; height: 40px; flex: none;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.28);
}
.f-title { font-size: 14.5px; font-weight: 700; letter-spacing: .1px; }
.f-desc { margin-top: 4px; font-size: 12.5px; line-height: 1.6; opacity: 0.82; }

.brand-footer {
  margin-top: auto;
  padding-top: 26px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  opacity: 0.78;
  position: relative;
  z-index: 1;
}
.foot-copy { margin-left: auto; }

/* ---------------- 右侧登录面板 ---------------- */
.login-side {
  flex: 4 1 0;
  min-width: 420px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 36px;
  background: var(--cs-bg-container);
}
.theme-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--cs-border);
  border-radius: 50%;
  background: var(--cs-bg-container);
  color: var(--cs-text-secondary);
  cursor: pointer;
  transition: all var(--cs-transition);
}
.theme-btn:hover { color: var(--cs-primary-dark); border-color: var(--cs-primary-light); background: var(--cs-primary-lighter); }

.login-box { width: 100%; max-width: 360px; }
.login-mark {
  width: 46px; height: 46px; border-radius: 14px; overflow: hidden;
  margin-bottom: 18px;
  box-shadow: 0 8px 20px rgba(16, 58, 76, 0.12);
  background: #fff;
}
.login-mark img { width: 100%; height: 100%; object-fit: cover; display: block; }
.login-title { margin: 0; font-size: 27px; font-weight: 800; letter-spacing: -0.6px; color: var(--cs-text-primary); }
.login-sub { margin: 8px 0 24px; font-size: 13px; color: var(--cs-text-tertiary); }

.portal-switch {
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 100px;
  background: var(--cs-bg-field);
  border: 1px solid var(--cs-border-light);
  margin-bottom: 24px;
}
.switch-item {
  flex: 1;
  height: 38px;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  border: none;
  border-radius: 100px;
  background: transparent;
  color: var(--cs-text-secondary);
  font-size: 13px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.22s ease;
}
.switch-item:hover { color: var(--cs-primary-dark); }
.switch-item.active {
  background: var(--cs-bg-container);
  color: var(--cs-primary-dark);
  box-shadow: 0 3px 10px rgba(16, 58, 76, 0.10);
}

.field { margin-bottom: 16px; }
.field-label { display: block; margin-bottom: 8px; font-size: 12.5px; font-weight: 600; color: var(--cs-text-secondary); }
.login-form :deep(.el-form-item) { margin-bottom: 0; }
.login-form :deep(.el-input__wrapper) { height: 46px; border-radius: 14px; padding: 0 14px; }
.login-form :deep(.el-input__inner) { font-size: 14px; }

.row-between { display: flex; align-items: center; justify-content: space-between; margin: 4px 0 20px; }
.row-between :deep(.el-checkbox__label) { font-size: 12.5px; color: var(--cs-text-secondary); }
.forget-hint { font-size: 12px; color: var(--cs-text-tertiary); }

.login-btn {
  width: 100%;
  height: 48px;
  border-radius: 100px;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 2px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--cs-grad-brand);
  border: none;
  box-shadow: 0 12px 26px rgba(23, 190, 208, 0.30);
}
.login-btn:hover { box-shadow: 0 16px 34px rgba(23, 190, 208, 0.40); }
.btn-arrow { font-size: 13px; }

.login-tip { margin: 18px 0 0; font-size: 11.5px; color: var(--cs-text-tertiary); line-height: 1.8; text-align: center; }
.login-footer { margin-top: 18px; text-align: center; }
.footer-text { font-size: 11px; color: var(--cs-text-tertiary); }

/* ---------------- 响应式 ---------------- */
@media (max-width: 1180px) {
  .login-brand { padding: 32px 40px 22px; }
  .brand-body { padding-top: 48px; }
  .brand-title { font-size: 38px; }
}
@media (max-width: 960px) {
  .login-page { flex-direction: column; }
  .login-brand { width: 100%; max-width: 100%; padding: 24px 20px 26px; }
  .login-side { width: 100%; min-width: 0; padding: 32px 24px 44px; }
  .brand-body { padding-top: 28px; }
  .brand-features { display: none; }
  .brand-title { font-size: 28px; letter-spacing: -0.6px; }
  .brand-title br { display: none; }
  .brand-desc { margin-top: 12px; font-size: 13px; }
  .login-mark { display: none; }
  .login-box { max-width: 420px; }
  .theme-btn { top: 16px; right: 16px; }
}
</style>
