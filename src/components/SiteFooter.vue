<template>
  <footer class="site-footer">
    <div class="site-container">
      <div class="footer-grid">
        <div class="footer-brand">
          <router-link :to="brandTo" class="site-brand">
            <span class="site-brand__logo"><img :src="logoUrl" alt="云存储" /></span>
            <span class="site-brand__txt">
              <span class="site-brand__name">云存储</span>
              <span class="site-brand__sub">Cloud Storage Platform</span>
            </span>
          </router-link>
          <p>私有化部署的企业云盘：文件不出内网，权限、容量与审计全部在手。</p>
        </div>

        <div class="footer-col">
          <h3>主要</h3>
          <router-link to="/files">我的文件</router-link>
          <router-link to="/transfers">传输任务</router-link>
          <router-link to="/packages">套餐增值</router-link>
          <router-link to="/profile">个人中心</router-link>
        </div>

        <div class="footer-col">
          <h3>功能</h3>
          <a href="#features">分片上传 / 秒传</a>
          <a href="#features">断点续传</a>
          <router-link to="/recycle">回收站</router-link>
          <a href="#security">安全与加密</a>
        </div>

        <div class="footer-col">
          <h3>控制台</h3>
          <router-link to="/admin/dashboard">统计大盘</router-link>
          <router-link to="/admin/users">用户管理</router-link>
          <router-link to="/admin/depts">部门管理</router-link>
          <router-link to="/admin/logs">审计日志</router-link>
        </div>

        <div class="footer-col">
          <h3>支持</h3>
          <a href="#pricing">价格与套餐</a>
          <a href="#faq">部署与迁移</a>
          <router-link to="/welcome">产品介绍</router-link>
          <a href="#top">回到顶部</a>
        </div>
      </div>

      <div class="footer-bottom">
        <span>© 2026 云存储 · 私有化部署方案 · 数据不出内网</span>
        <div class="footer-bottom__links">
          <a href="#terms">服务条款</a>
          <a href="#privacy">隐私政策</a>
          <a href="#security">安全与合规</a>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup>
import logoUrl from '@/assets/logo.png'

defineProps({
  brandTo: { type: String, default: '/files' }
})
</script>
