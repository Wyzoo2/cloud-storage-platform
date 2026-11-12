<template>
  <div class="login-page">
    <div class="frame">
    <!-- 左：控制台品牌区（网格底 + 发丝线分栏，无卡片、无渐变） -->
    <section class="brand">
      <header class="brand-head">
        <div class="brand-mark"><img :src="logoUrl" alt="云存储" class="brand-logo" /></div>
        <div class="brand-id">
          <b>云存储</b>
          <span>CLOUD STORAGE CONSOLE</span>
        </div>
      </header>

      <div class="brand-body">
        <h1 class="brand-title">把文件、容量与权限<br />收进一个控制台</h1>
        <p class="brand-desc">上传检索、在线预览、企业空间分配、角色与数据范围、操作审计，全部在同一个工作区里完成。</p>

        <dl class="cap-list">
          <div class="cap">
            <dt>分片上传 · 秒传 · 断点续传</dt>
            <dd>大文件稳定送达，弱网也能从中断处继续</dd>
          </div>
          <div class="cap">
            <dt>企业空间按成员分配</dt>
            <dd>套餐进企业池，管理员按人分配额度，超额即时提示</dd>
          </div>
          <div class="cap">
            <dt>角色 × 数据范围双控</dt>
            <dd>权限点决定能做什么，数据范围决定能看谁的</dd>
          </div>
        </dl>
      </div>

      <footer class="brand-foot">
        <span class="dot"></span>
        <span>内网部署 · 数据不出域</span>
        <span class="foot-copy">© 2026</span>
      </footer>
    </section>

    <!-- 右：登录面板 -->
    <aside class="side">
      <button class="icon-btn side-theme" :title="appStore.theme === 'light' ? '切换深色' : '切换浅色'" @click="appStore.toggleTheme">
        <el-icon :size="15"><Moon v-if="appStore.theme === 'light'" /><Sunny v-else /></el-icon>
      </button>

      <div class="box">
        <div class="box-head">
          <h2>登录</h2>
          <span>用账号密码进入{{ portal === 'admin' ? '管理端' : '控制台' }}</span>
        </div>

        <div class="seg">
          <button class="seg-btn" :class="{ on: portal === 'user' }" @click="portal = 'user'">
            <el-icon><User /></el-icon>用户端
          </button>
          <button class="seg-btn" :class="{ on: portal === 'admin' }" @click="portal = 'admin'">
            <el-icon><UserFilled /></el-icon>管理端
          </button>
        </div>

        <el-form ref="formRef" :model="form" :rules="rules" class="form" @submit.prevent="handleLogin">
          <div class="field">
            <label class="label">账号</label>
            <el-form-item prop="username">
              <el-input v-model="form.username" placeholder="请输入用户名" :prefix-icon="User" clearable />
            </el-form-item>
          </div>
          <div class="field">
            <label class="label">密码</label>
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
            <el-checkbox v-model="remember" size="small">记住账号</el-checkbox>
            <span class="row-hint">忘记密码请联系管理员</span>
          </div>

          <el-button type="primary" :loading="loading" class="submit" @click="handleLogin">
            {{ loading ? '正在验证…' : '登录' }}
            <el-icon v-if="!loading" class="submit-arrow"><Right /></el-icon>
          </el-button>
        </el-form>

        <p class="tip">账号由管理员统一开通 · 私有化部署方案</p>
      </div>
    </aside>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Lock,
  Moon,
  Right,
  Sunny,
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
    // 管理端：POST /admin/login（后端只校验本地管理员密码）
    const res = portal.value === 'admin' ? await authApi.adminLogin(payload) : await authApi.login(payload)
    userStore.login(res)
    if (remember.value) localStorage.setItem(REMEMBER_KEY, payload.username)
    else localStorage.removeItem(REMEMBER_KEY)
    const perm = usePermissionStore()
    await perm.load(true)
    const wantsAdmin = portal.value === 'admin'
    const canAdmin = perm.isPlatform || perm.isEnterpriseAdmin
    if (wantsAdmin && !canAdmin) ElMessage.warning('该账号无管理端权限，已进入用户端')
    ElMessage.success('登录成功')
    router.push(landingPath(perm, { prefer: wantsAdmin && canAdmin ? 'admin' : 'user' }))
  } catch (e) {
    // 提示由请求拦截器统一弹出
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px;
  background: var(--cs-bg-page);
  color: var(--cs-text-primary);
}

/* 居中构图：品牌 + 表单作为一整块居中，表单盒在右栏内水平垂直居中 */
.frame {
  width: min(1120px, 100%);
  min-height: min(700px, calc(100vh - 56px));
  display: flex;
  background: var(--cs-bg-container);
  border: 1px solid var(--cs-border-light);
  border-radius: var(--cs-radius-xl);
  box-shadow: var(--cs-shadow-lg);
  overflow: hidden;
}

/* ---------------- 左侧品牌区 ---------------- */
.brand {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 44px 56px 26px;
  position: relative;
  overflow: hidden;
  background-color: var(--cs-bg-sunken);
  background-image:
    repeating-linear-gradient(0deg, var(--cs-border-light) 0 1px, transparent 1px 64px),
    repeating-linear-gradient(90deg, var(--cs-border-light) 0 1px, transparent 1px 64px);
  background-position: -1px -1px;
}

.brand-head { display: flex; align-items: center; gap: 11px; }
.brand-mark { width: 28px; height: 28px; border-radius: 3px; overflow: hidden; flex: none; background: #fff; }
.brand-logo { width: 100%; height: 100%; object-fit: cover; display: block; }
.brand-id { display: flex; flex-direction: column; gap: 2px; }
.brand-id b { font-size: 13px; font-weight: 600; letter-spacing: 0.02em; }
.brand-id span { font-size: 8.5px; letter-spacing: 0.24em; color: var(--cs-text-tertiary); }

.brand-body { padding: 92px 0 0; max-width: 620px; }
.brand-title {
  margin: 0;
  font-size: 40px;
  line-height: 1.22;
  font-weight: 600;
  letter-spacing: -0.035em;
  color: var(--cs-text-primary);
}
.brand-desc {
  margin: 20px 0 0;
  max-width: 520px;
  font-size: 13px;
  line-height: 1.9;
  color: var(--cs-text-secondary);
}

.cap-list { margin: 52px 0 0; padding: 0; max-width: 560px; border-top: 1px solid var(--cs-border); }
.cap { display: grid; grid-template-columns: 240px 1fr; gap: 20px; padding: 14px 0; border-bottom: 1px solid var(--cs-border-light); }
.cap dt { font-size: 12.5px; font-weight: 600; color: var(--cs-text-primary); letter-spacing: 0.01em; }
.cap dd { margin: 0; font-size: 12px; line-height: 1.7; color: var(--cs-text-tertiary); }

.brand-foot {
  margin-top: auto;
  padding-top: 22px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10.5px;
  letter-spacing: 0.06em;
  color: var(--cs-text-tertiary);
}
.dot { width: 4px; height: 4px; border-radius: 50%; background: var(--cs-primary); display: inline-block; }
.foot-copy { margin-left: auto; letter-spacing: 0.1em; }

/* ---------------- 右侧登录面板 ---------------- */
.side {
  width: 396px;
  flex: none;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 40px;
  background: var(--cs-bg-container);
  border-left: 1px solid var(--cs-border);
}
.side-theme { position: absolute; top: 14px; right: 14px; }
.icon-btn {
  width: 28px; height: 28px;
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid transparent; border-radius: 2px;
  background: transparent; color: var(--cs-text-tertiary);
  cursor: pointer;
  transition: background var(--cs-transition), color var(--cs-transition);
}
.icon-btn:hover { background: var(--cs-bg-hover); color: var(--cs-text-primary); }

.box { width: 100%; max-width: 312px; margin: 0 auto; }
.box-head { margin-bottom: 22px; }
.box-head h2 { font-size: 20px; font-weight: 600; letter-spacing: -0.02em; }
.box-head span { display: block; margin-top: 6px; font-size: 11.5px; color: var(--cs-text-tertiary); }

/* 端口切换：分段控件 */
.seg { display: flex; border: 1px solid var(--cs-border); border-radius: 2px; overflow: hidden; margin-bottom: 24px; }
.seg-btn {
  flex: 1;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--cs-text-tertiary);
  font-size: 12px;
  cursor: pointer;
  transition: background var(--cs-transition), color var(--cs-transition);
}
.seg-btn + .seg-btn { border-left: 1px solid var(--cs-border); }
.seg-btn:hover { color: var(--cs-text-primary); background: var(--cs-bg-hover); }
.seg-btn.on { background: var(--cs-primary-lighter); color: var(--cs-primary); font-weight: 600; }

.field { margin-bottom: 16px; }
.label { display: block; margin-bottom: 7px; font-size: 11px; letter-spacing: 0.08em; color: var(--cs-text-tertiary); }
.form :deep(.el-form-item) { margin-bottom: 0; }
.form :deep(.el-input__wrapper) { height: 40px; padding: 0 12px; border-radius: 6px; }
.form :deep(.el-input__inner) { font-size: 13px; }
.form :deep(.el-input__prefix) { margin-right: 6px; color: var(--cs-text-tertiary); }
/* 聚焦/悬停不描边：只做极轻的底色变化，避免边框抢视觉 */
.form :deep(.el-input__wrapper:hover) { box-shadow: none !important; }
.form :deep(.el-input__wrapper.is-focus),
.form :deep(.el-input__wrapper.is-focus:hover) {
  box-shadow: none !important;
  background: var(--cs-bg-hover) !important;
}
.form :deep(.el-form-item__error) { padding-top: 4px; font-size: 10.5px; }

.row-between { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 4px 0 20px; }
.row-hint { font-size: 10.5px; color: var(--cs-text-tertiary); }

.submit {
  width: 100%;
  height: 38px;
  border-radius: 2px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.submit-arrow { font-size: 12px; }

.tip { margin: 18px 0 0; font-size: 10.5px; line-height: 1.7; color: var(--cs-text-tertiary); }

@media (max-width: 1120px) {
  .brand { padding: 34px 36px 20px; }
  .brand-body { padding-top: 64px; }
  .brand-title { font-size: 32px; }
  .cap { grid-template-columns: 200px 1fr; gap: 14px; }
}
@media (max-width: 900px) {
  .login-page { padding: 0; align-items: stretch; }
  .frame { flex-direction: column; min-height: 100vh; border: none; border-radius: 0; box-shadow: none; }
  .brand { padding: 26px 22px 18px; background-image: none; }
  .brand-body { padding-top: 32px; }
  .brand-title { font-size: 26px; }
  .brand-desc { margin-top: 14px; }
  .cap-list { margin-top: 26px; }
  .cap { grid-template-columns: 1fr; gap: 4px; padding: 10px 0; }
  .brand-foot { padding-top: 16px; }
  .side { width: 100%; flex: 1; padding: 28px 22px 36px; border-left: none; border-top: 1px solid var(--cs-border); }
  .box { max-width: 380px; }
}
</style>
