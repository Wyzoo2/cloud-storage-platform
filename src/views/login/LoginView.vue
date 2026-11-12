<template>
  <div class="login-page">
    <header class="login-nav">
      <router-link to="/welcome" class="site-brand">
        <span class="site-brand__logo"><img :src="logoUrl" alt="云存储" /></span>
        <span class="site-brand__txt">
          <span class="site-brand__name">云存储</span>
          <span class="site-brand__sub">Cloud Storage Platform</span>
        </span>
      </router-link>
      <div class="login-nav__actions">
        <button class="login-theme" type="button" :title="appStore.theme === 'light' ? '切换暗色' : '切换亮色'" @click="appStore.toggleTheme">
          <el-icon :size="16"><Moon v-if="appStore.theme === 'light'" /><Sunny v-else /></el-icon>
        </button>
        <router-link to="/welcome" class="login-back">返回首页</router-link>
      </div>
    </header>

    <main class="login-main">
      <div class="login-card">
        <div class="login-card__head">
          <span class="login-card__mark"><img :src="logoUrl" alt="云存储" /></span>
          <h1 class="login-title">登录你的云盘</h1>
          <p class="login-sub">{{ portal === 'admin' ? '用管理员账号进入管理控制台' : '用管理员开通的账号进入工作台' }}</p>
        </div>

        <div class="portal-switch">
          <button type="button" class="switch-item" :class="{ active: portal === 'user' }" @click="portal = 'user'">
            <el-icon :size="14"><User /></el-icon><span>用户端</span>
          </button>
          <button type="button" class="switch-item" :class="{ active: portal === 'admin' }" @click="portal = 'admin'">
            <el-icon :size="14"><UserFilled /></el-icon><span>管理端</span>
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
      </div>

      <p class="login-foot">
        © 2026 云存储 · 私有化部署方案 ·
        <a href="#terms">服务条款</a> ·
        <a href="#privacy">隐私政策</a>
      </p>
    </main>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Lock, Moon, Right, Sunny, User, UserFilled } from '@element-plus/icons-vue'
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
  flex-direction: column;
  background:
    radial-gradient(760px 420px at 12% -8%, rgba(23, 190, 208, 0.18), rgba(23, 190, 208, 0) 70%),
    radial-gradient(680px 420px at 92% 4%, rgba(2, 145, 213, 0.16), rgba(2, 145, 213, 0) 72%),
    linear-gradient(180deg, #f4fdff 0%, #ffffff 62%);
}
[data-theme="dark"] .login-page { background: linear-gradient(180deg, #0f232b 0%, #0b161b 100%); }

.login-nav {
  height: var(--site-nav-h);
  padding: 0 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.login-nav__actions { display: flex; align-items: center; gap: 10px; }
.login-theme {
  width: 36px; height: 36px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid var(--cs-border); background: var(--cs-bg-container);
  color: var(--cs-text-secondary); cursor: pointer; transition: all 0.2s ease;
}
.login-theme:hover { color: var(--cs-primary-dark); border-color: var(--cs-primary-light); }
.login-back { font-size: 13px; font-weight: 700; color: var(--cs-text-secondary); text-decoration: none; padding: 8px 14px; border-radius: 100px; }
.login-back:hover { background: var(--cs-primary-lighter); color: var(--cs-primary-dark); }

.login-main { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px 20px 48px; }

.login-card {
  width: 100%;
  max-width: 440px;
  background: var(--cs-bg-container);
  border: 1px solid var(--cs-border);
  border-radius: 24px;
  box-shadow: 0 32px 70px rgba(9, 54, 80, 0.12);
  padding: 34px 32px 28px;
}
.login-card__head { text-align: center; margin-bottom: 22px; }
.login-card__mark {
  width: 52px; height: 52px; border-radius: 16px; overflow: hidden;
  display: inline-flex; margin-bottom: 16px;
  box-shadow: 0 10px 24px rgba(16, 58, 76, 0.14);
}
.login-card__mark img { width: 100%; height: 100%; object-fit: cover; display: block; }
.login-title { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.6px; color: var(--site-heading); }
.login-sub { margin: 8px 0 0; font-size: 13px; color: var(--cs-text-tertiary); }

.portal-switch {
  display: flex; gap: 4px; padding: 4px;
  border-radius: 100px;
  background: var(--cs-bg-field);
  border: 1px solid var(--cs-border-light);
  margin-bottom: 22px;
}
.switch-item {
  flex: 1; height: 38px;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  border: none; border-radius: 100px; background: transparent;
  color: var(--cs-text-secondary); font-size: 13px; font-weight: 700;
  font-family: inherit; cursor: pointer; transition: all 0.22s ease;
}
.switch-item:hover { color: var(--cs-primary-dark); }
.switch-item.active { background: var(--cs-bg-container); color: var(--cs-primary-dark); box-shadow: 0 3px 10px rgba(16, 58, 76, 0.10); }

.field { margin-bottom: 16px; }
.field-label { display: block; margin-bottom: 8px; font-size: 12.5px; font-weight: 700; color: var(--cs-text-secondary); }
.login-form :deep(.el-form-item) { margin-bottom: 0; }
.login-form :deep(.el-input__wrapper) { height: 46px; border-radius: 12px; padding: 0 14px; }
.login-form :deep(.el-input__inner) { font-size: 14px; }

.row-between { display: flex; align-items: center; justify-content: space-between; margin: 6px 0 20px; }
.row-between :deep(.el-checkbox__label) { font-size: 12.5px; color: var(--cs-text-secondary); }
.forget-hint { font-size: 12px; color: var(--cs-text-tertiary); }

.login-btn {
  width: 100%; height: 48px; border-radius: 100px;
  font-size: 15px; font-weight: 800; letter-spacing: 2px;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  background: var(--cs-grad-brand); border: none;
  box-shadow: 0 12px 26px rgba(23, 190, 208, 0.30);
}
.login-btn:hover { box-shadow: 0 16px 34px rgba(23, 190, 208, 0.40); }

.login-tip { margin: 18px 0 0; font-size: 11.5px; color: var(--cs-text-tertiary); line-height: 1.8; text-align: center; }
.login-foot { margin: 22px 0 0; font-size: 11.5px; color: var(--cs-text-tertiary); }
.login-foot a { color: var(--cs-text-tertiary); text-decoration: none; }
.login-foot a:hover { color: var(--cs-primary-dark); }

@media (max-width: 560px) {
  .login-nav { height: 62px; padding: 0 16px; }
  .login-card { padding: 26px 20px 22px; border-radius: 20px; }
  .login-title { font-size: 21px; }
}
</style>
