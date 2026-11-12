<template>
  <div id="top" class="site-shell landing">
    <SiteHeader :links="navLinks" :brand-to="brandTo">
      <template #actions>
        <router-link v-if="!loggedIn" to="/login" class="site-nav__ghost">登录</router-link>
        <router-link v-if="!loggedIn" to="/login" class="site-nav__cta">免费开通</router-link>
        <router-link v-else to="/files" class="site-nav__cta">进入云盘</router-link>
      </template>
    </SiteHeader>

    <!-- ============ Hero ============ -->
    <section class="hero">
      <div class="site-container hero__inner">
        <div class="hero__copy">
          <span class="hero__eyebrow">
            <el-icon :size="13"><Lock /></el-icon>
            私有化部署 · 文件不出内网
          </span>
          <h1 class="hero__title">你的数据。<br /><em>你做主。</em></h1>
          <p class="hero__sub">在你的服务器上存、取、管全部文件——分片上传、秒传、断点续传、权限与审计，一套系统全给你。</p>
          <div class="hero__actions">
            <router-link to="/login" class="site-nav__cta hero__cta">免费开通</router-link>
            <a href="#features" class="site-nav__ghost hero__ghost">看看能做什么</a>
          </div>
          <div class="hero__note">
            <span><el-icon :size="13"><CircleCheckFilled /></el-icon>无需信用卡</span>
            <span><el-icon :size="13"><CircleCheckFilled /></el-icon>5 分钟完成部署</span>
            <span><el-icon :size="13"><CircleCheckFilled /></el-icon>200 人起步，可扩到 1000+</span>
          </div>
        </div>

        <div class="hero__visual">
          <div class="app-shot-wrap">
            <i class="app-shot__float app-shot__float--a"><i></i>秒传命中 98%</i>
            <i class="app-shot__float app-shot__float--b"><i></i>存储 268 GB / 600 GB</i>
            <div class="app-shot">
              <div class="app-shot__bar">
                <span class="app-shot__dot"></span><span class="app-shot__dot"></span><span class="app-shot__dot"></span>
                <span class="app-shot__url">cloud.internal/files · 我的文件</span>
              </div>
              <div class="app-shot__body">
                <div class="app-shot__row">
                  <span class="app-shot__icon" style="background:#fff3dc;color:#f5a623">📁</span>
                  <span class="app-shot__name">产品设计稿 2026</span>
                  <span class="app-shot__meta">文件夹</span>
                </div>
                <div class="app-shot__row">
                  <span class="app-shot__icon" style="background:#ffecec;color:#fa595d">PDF</span>
                  <span class="app-shot__name">年度审计报告.pdf</span>
                  <span class="app-shot__meta">8.2 MB</span>
                </div>
                <div class="app-shot__row">
                  <span class="app-shot__icon" style="background:#eaf6ff;color:#2f86e0">DOC</span>
                  <span class="app-shot__name">Q4 需求评审.docx</span>
                  <span class="app-shot__meta">1.2 MB</span>
                </div>
                <div class="app-shot__row">
                  <span class="app-shot__icon" style="background:#e9fbf2;color:#2fb483">PNG</span>
                  <span class="app-shot__name">发布会主视觉.png</span>
                  <span class="app-shot__meta">5.0 MB</span>
                </div>
                <div class="app-shot__row">
                  <span class="app-shot__icon" style="background:#f2edfd;color:#8b6ad6">MP4</span>
                  <span class="app-shot__name">培训视频.mp4</span>
                  <span class="app-shot__meta">700 MB</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ 数据 ============ -->
    <section class="stat-strip">
      <div class="site-container stat-strip__inner">
        <div class="stat"><div class="stat__num">200<small>+</small></div><div class="stat__label">在用企业</div></div>
        <div class="stat"><div class="stat__num">12.6<small>万</small></div><div class="stat__label">平台成员</div></div>
        <div class="stat"><div class="stat__num">99.98<small>%</small></div><div class="stat__label">过去一年可用性</div></div>
        <div class="stat"><div class="stat__num">8.6<small>PB</small></div><div class="stat__label">累计文件存储</div></div>
      </div>
    </section>

    <!-- ============ 安全 ============ -->
    <section id="security" class="section">
      <div class="site-container">
        <div class="two-col">
          <div>
            <div class="section__eyebrow">安全与合规</div>
            <h2 class="section__title">私有部署。<br />银行级加密。</h2>
            <p class="section__lead">整套系统跑在你自己的机房或内网，文件从浏览器到存储只为你的网络传输一次。分片直传、内容指纹去重、全链路审计，一个都不少。</p>
            <div class="chip-row">
              <span class="chip"><el-icon :size="14"><Lock /></el-icon>数据不出内网</span>
              <span class="chip"><el-icon :size="14"><Key /></el-icon>SHA-256 内容指纹</span>
              <span class="chip"><el-icon :size="14"><Document /></el-icon>操作全留痕</span>
            </div>
          </div>
          <div class="panel panel--grad">
            <div class="panel__row">
              <span class="panel__dot">01</span>
              <div><div class="panel__t">浏览器端分片</div><div class="panel__d">大文件切片并行上传，弱网自动续传</div></div>
            </div>
            <div class="panel__row">
              <span class="panel__dot">02</span>
              <div><div class="panel__t">内容指纹校验</div><div class="panel__d">同一份内容秒级命中，不再重复上传</div></div>
            </div>
            <div class="panel__row">
              <span class="panel__dot">03</span>
              <div><div class="panel__t">服务端合并落盘</div><div class="panel__d">存储在你的对象存储里，密钥不外包</div></div>
            </div>
            <div class="panel__row">
              <span class="panel__dot">04</span>
              <div><div class="panel__t">审计与追溯</div><div class="panel__d">谁在什么时候取走了哪个文件，一目了然</div></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ 权限 / 数据归属 ============ -->
    <section id="enterprise" class="section section--tint">
      <div class="site-container">
        <div class="two-col two-col--wide-left">
          <div class="panel">
            <div class="panel__row">
              <span class="panel__dot"><el-icon :size="14"><OfficeBuilding /></el-icon></span>
              <div><div class="panel__t">企业空间</div><div class="panel__d">按部门分配，超额的部门先亮红灯</div></div>
              <span class="panel__meta">300 GB</span>
            </div>
            <div class="panel__row">
              <span class="panel__dot"><el-icon :size="14"><User /></el-icon></span>
              <div><div class="panel__t">个人免费额度</div><div class="panel__d">每个新成员自动到账，按需再加</div></div>
              <span class="panel__meta">100 GB</span>
            </div>
            <div class="panel__row">
              <span class="panel__dot"><el-icon :size="14"><Wallet /></el-icon></span>
              <div><div class="panel__t">增量套餐</div><div class="panel__d">按年订阅、到期提醒、审批留档</div></div>
              <span class="panel__meta">200 GB</span>
            </div>
            <div class="panel__row">
              <span class="panel__dot"><el-icon :size="14"><Key /></el-icon></span>
              <div><div class="panel__t">数据范围四档</div><div class="panel__d">仅个人 / 本人及部门 / 部门以下→本人及部门以下 / 全公司，均可按角色配置</div></div>
              <span class="panel__meta">RBAC</span>
            </div>
          </div>
          <div>
            <div class="section__eyebrow">治理</div>
            <h2 class="section__title">数据落在哪，<br />你说了算。</h2>
            <p class="section__lead">企业、部门、成员三层结构，配合角色与数据范围四档：谁能看见什么，是配置项，不是口头约定。</p>
            <div class="chip-row">
              <span v-for="s in scopes" :key="s.value" class="chip">{{ s.label }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ 功能 ============ -->
    <section id="features" class="section">
      <div class="site-container">
        <div class="section__head">
          <div>
            <div class="section__eyebrow">功能</div>
            <h2 class="section__title">好用吗？<br />当然。</h2>
          </div>
          <div class="section__head-actions">
            <router-link to="/login" class="site-nav__cta">免费开通</router-link>
          </div>
        </div>

        <div class="feature-grid">
          <article v-for="f in features" :key="f.title" class="feature-card">
            <span class="feature-card__icon"><el-icon :size="19"><component :is="f.icon" /></el-icon></span>
            <div class="feature-card__eyebrow">{{ f.kicker }}</div>
            <h3 class="feature-card__title">{{ f.title }}</h3>
            <p class="feature-card__desc">{{ f.desc }}</p>
            <span class="feature-card__more">了解更多<el-icon :size="12"><Right /></el-icon></span>
          </article>
        </div>
      </div>
    </section>

    <!-- ============ 口碑 ============ -->
    <section class="section section--tint">
      <div class="site-container">
        <div class="section__head">
          <div>
            <div class="section__eyebrow">口碑</div>
            <h2 class="section__title">别听我们说，<br />听他们说。</h2>
          </div>
        </div>
        <div class="quote-grid">
          <article v-for="q in quotes" :key="q.name" class="quote-card">
            <span class="quote-card__mark">“</span>
            <p class="quote-card__text">{{ q.text }}</p>
            <div class="quote-card__who">
              <span class="quote-card__avatar">{{ q.name.slice(0, 1) }}</span>
              <div>
                <div class="quote-card__name">{{ q.name }}</div>
                <div class="quote-card__role">{{ q.role }}</div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- ============ 适用人群 ============ -->
    <section id="pricing" class="section section--tight">
      <div class="site-container">
        <div class="two-col two-col--wide-left">
          <div>
            <div class="section__eyebrow">适用场景</div>
            <h2 class="section__title">还在犹豫<br />适不适合你？</h2>
            <p class="section__lead">从十几个人的设计组到上千人的集团，只要文件需要留在自己的网络里，它就能派上用场。</p>
            <div class="persona-row">
              <span v-for="p in personas" :key="p" class="persona"><i></i>{{ p }}</span>
            </div>
          </div>
          <div class="panel panel--grad">
            <div class="panel__row">
              <span class="panel__dot">企</span>
              <div><div class="panel__t">企业版</div><div class="panel__d">部门、角色、审计、额度审批一应俱全</div></div>
            </div>
            <div class="panel__row">
              <span class="panel__dot">团</span>
              <div><div class="panel__t">团队版</div><div class="panel__d">共享空间 + 成员容量按需分配</div></div>
            </div>
            <div class="panel__row">
              <span class="panel__dot">个</span>
              <div><div class="panel__t">个人版</div><div class="panel__d">免费额度起步，随时叠加增量套餐</div></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ CTA ============ -->
    <section id="faq" class="section section--tight">
      <div class="site-container">
        <div class="cta-band">
          <div>
            <h2 class="cta-band__title">准备好了吗？</h2>
            <p class="cta-band__sub">用管理员账号进入控制台，5 分钟后你的团队就能开始传文件。</p>
          </div>
          <div class="cta-band__actions">
            <router-link to="/login" class="cta-band__primary">免费开通<el-icon :size="13"><Right /></el-icon></router-link>
            <a href="#features" class="cta-band__ghost">查看功能</a>
          </div>
        </div>
      </div>
    </section>

    <SiteFooter :brand-to="brandTo" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import SiteHeader from '@/components/SiteHeader.vue'
import SiteFooter from '@/components/SiteFooter.vue'
import { DATA_SCOPES } from '@/constants/menus'

const loggedIn = computed(() => !!localStorage.getItem('cs-token'))
const brandTo = computed(() => (loggedIn.value ? '/files' : '/welcome'))

// 顶部导航锚点：点击立刻高亮，滚动时再按当前可视区块反向同步（scroll-spy）
const SECTIONS = [
  { key: 'features', label: '功能', anchor: '#features' },
  { key: 'security', label: '安全', anchor: '#security' },
  { key: 'enterprise', label: '企业版', anchor: '#enterprise' },
  { key: 'pricing', label: '价格', anchor: '#pricing' }
]
const activeKey = ref('home')
const navLinks = computed(() => [
  { label: '首页', anchor: '#top', active: activeKey.value === 'home' },
  ...SECTIONS.map(s => ({ label: s.label, anchor: s.anchor, active: activeKey.value === s.key }))
])

let scrollRaf = 0
function syncActiveByScroll() {
  const offset = 120
  const y = window.scrollY || window.pageYOffset || 0
  if (y < 80) { activeKey.value = 'home'; return }
  // 取「已经滚过导航线、且位置最靠下」的那个区块，避免导航顺序与区块顺序不一致时选错
  let current = 'home'
  let nearest = -Infinity
  for (const s of SECTIONS) {
    const el = document.getElementById(s.key)
    if (!el) continue
    const top = el.getBoundingClientRect().top
    if (top <= offset && top > nearest) { nearest = top; current = s.key }
  }
  activeKey.value = current
}
function onScroll() {
  if (scrollRaf) return
  scrollRaf = requestAnimationFrame(() => { scrollRaf = 0; syncActiveByScroll() })
}
function onHashChange() {
  const key = (window.location.hash || '').replace('#', '')
  if (!key || key === 'top') activeKey.value = 'home'
  else if (SECTIONS.some(s => s.key === key)) activeKey.value = key
}
onMounted(() => {
  // 直接用 #features 之类的链接进来时，也要落在正确的导航高亮上
  onHashChange()
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('hashchange', onHashChange)
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('hashchange', onHashChange)
  if (scrollRaf) cancelAnimationFrame(scrollRaf)
})

// 数据范围直接取产品里的真实四档配置
const scopes = DATA_SCOPES

const features = [
  { icon: 'Position', kicker: 'ACCESS & FLEXIBILITY', title: '随时随地访问', desc: '笔记本、手机、平板，浏览器打开即用；在外网也能安全回内网取文件。' },
  { icon: 'Link', kicker: 'SHARING & COLLABORATION', title: '秒传与共享', desc: '同一份内容秒级命中；分享链接可控有效期，到期自动失效。' },
  { icon: 'Coin', kicker: 'STORAGE FREEDOM', title: '不再担心空间不足', desc: '免费额度 + 企业分配 + 增量套餐，三段容量池按需叠加。' },
  { icon: 'RefreshRight', kicker: 'AUTO-BACKUP & SYNC', title: '再也不会丢文件', desc: '分片上传失败自动续传，传输任务可暂停、恢复、放弃。' },
  { icon: 'UploadFilled', kicker: 'CAPACITY & SPEED', title: '大文件？没问题', desc: '任意大小的文件，内网千兆带宽下上传下载都不限速。' },
  { icon: 'Key', kicker: 'GOVERNANCE', title: '权限与审计', desc: '角色、部门、数据范围四档配置，敏感操作全量留痕可导出。' }
]

const quotes = [
  { name: '林小满', role: '设计团队负责人', text: '素材库从 NAS 搬到这套系统后，找图从十分钟变成十秒，分片上传在弱网办公室也稳。' },
  { name: '周启明', role: 'IT 管理员', text: '最看重的是私有化：文件就在我们自己的机房，审计日志可以直接导出给合规。' },
  { name: '陈可', role: '法务经理', text: '权限按部门和角色分配，离职成员的文件回收站还在，追溯起来特别省事。' }
]

const personas = ['设计团队', '法务与合规', '销售与客户资料', '研发与构建产物', '财务与凭证', '教育与培训']
</script>

<style scoped>
.hero__cta { height: 48px; padding: 0 26px; font-size: 14px; }
.hero__ghost { height: 48px; padding: 0 24px; font-size: 14px; }
.hero__visual { position: relative; }
.panel__meta { margin-left: auto; font-size: 12px; font-weight: 800; color: var(--cs-primary-dark); font-variant-numeric: tabular-nums; }
</style>
