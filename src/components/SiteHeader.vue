<template>
  <header class="site-nav">
    <div class="site-container site-nav__inner">
      <router-link :to="brandTo" class="site-brand">
        <span class="site-brand__logo"><img :src="logoUrl" alt="云存储" /></span>
        <span class="site-brand__txt">
          <span class="site-brand__name">云存储<em v-if="badge" class="brand-badge">{{ badge }}</em></span>
          <span class="site-brand__sub">{{ subtitle }}</span>
        </span>
      </router-link>

      <nav class="site-nav__links">
        <template v-for="l in links" :key="l.label">
          <a v-if="l.anchor" :href="l.anchor" class="site-nav__link" :class="{ 'is-active': l.active }">{{ l.label }}</a>
          <router-link v-else :to="l.to" class="site-nav__link" :class="{ 'is-active': l.active }">{{ l.label }}</router-link>
        </template>
      </nav>

      <div class="site-nav__actions">
        <slot name="actions" />
        <button class="site-nav__burger" type="button" :aria-expanded="open.toString()" @click="open = !open">
          <el-icon :size="18"><Close v-if="open" /><Menu v-else /></el-icon>
        </button>
      </div>
    </div>

    <div class="site-nav__drawer" :class="{ 'is-open': open }">
      <div class="site-container">
        <template v-for="l in links" :key="'m-' + l.label">
          <a v-if="l.anchor" :href="l.anchor" class="site-nav__link" @click="open = false">{{ l.label }}</a>
          <router-link v-else :to="l.to" class="site-nav__link" @click="open = false">{{ l.label }}</router-link>
        </template>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import logoUrl from '@/assets/logo.png'

defineProps({
  // [{ label, to?, anchor?, active? }]
  links: { type: Array, default: () => [] },
  badge: { type: String, default: '' },
  subtitle: { type: String, default: 'Cloud Storage' },
  brandTo: { type: String, default: '/files' }
})

const open = ref(false)
const route = useRoute()
// 路由跳转后收起移动端面板
watch(() => route.fullPath, () => { open.value = false })
</script>

<style scoped>
.brand-badge {
  font-style: normal; font-size: 9.5px; font-weight: 800; letter-spacing: 0.2px;
  padding: 2px 6px; border-radius: 100px; margin-left: 6px;
  background: var(--cs-grad-brand); color: #fff;
}
</style>
