<template>
  <div class="cs-page dash">
    <div class="dash-bar">
      <div class="title-row">
        <h2 class="page-title"><el-icon><DataAnalysis /></el-icon>统计大盘</h2>
        <span v-if="perm.identity === 'enterprise'" class="scope">本企业</span>
      </div>
      <div class="dash-hint">
        <span>口径：个人免费 + 个人增量 + 企业分配；池中未分配余量不计入</span>
        <button v-if="perm.can('org.member.read')" class="link-btn" @click="router.push('/admin/resources')">企业资源 →</button>
      </div>
    </div>

    <div class="kpis">
      <div v-for="stat in statCards" :key="stat.label" class="kpi">
        <span class="kpi-label">{{ stat.label }}</span>
        <strong class="kpi-value">{{ stat.value }}</strong>
      </div>
    </div>

    <div class="charts">
      <section class="cs-card panel">
        <header class="panel-head">
          <h3>存储用量 Top 10</h3>
          <span class="panel-note">按已用容量排序</span>
        </header>
        <div ref="topUsersChart" class="chart"></div>
      </section>

      <section class="cs-card panel">
        <header class="panel-head">
          <h3>流量趋势</h3>
          <div class="seg">
            <button v-for="d in [7, 30, 90]" :key="d" class="seg-btn" :class="{ on: trafficDays === d }" @click="switchDays(d)">
              {{ d }} 天
            </button>
          </div>
        </header>
        <div ref="trafficChart" class="chart"></div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts'
import { useAppStore } from '@/stores/app'
import { adminApi } from '@/api'
import { usePermissionStore } from '@/stores/permission'
import { useRouter } from 'vue-router'
import { formatSize } from '@/utils/file'

const appStore = useAppStore()
const perm = usePermissionStore()
const router = useRouter()
const topUsersChart = ref(null)
const trafficChart = ref(null)
let topChartInstance = null, trafficChartInstance = null

const adminOverview = ref({ totalQuotaBytes: 0, usedBytes: 0, remainingBytes: 0, userCount: 0 })
const topUsers = ref([])
const trafficData = ref([])
const trafficDays = ref(7)

const statCards = computed(() => [
  { label: '总配额', value: formatSize(adminOverview.value.totalQuotaBytes) },
  { label: '已用空间', value: formatSize(adminOverview.value.usedBytes) },
  { label: '剩余空间', value: formatSize(adminOverview.value.remainingBytes) },
  { label: '注册用户数', value: adminOverview.value.userCount.toLocaleString() }
])

function palette() {
  const dark = appStore.theme === 'dark'
  return {
    text: dark ? '#a3acba' : '#5a6472',
    sub: dark ? '#74808f' : '#8a93a0',
    grid: dark ? 'rgba(255,255,255,0.07)' : '#eef0f3',
    accent: dark ? '#8b8bf5' : '#4f46e5',
    second: dark ? '#7aa2f7' : '#2b5bb5',
    tooltipBg: dark ? '#1a1f2a' : '#ffffff'
  }
}

function getTextColor() { return palette().text }
function getSubTextColor() { return palette().sub }
function getBorderColor() { return palette().grid }

async function loadOverview() {
  try { adminOverview.value = await adminApi.statsOverview() } catch (e) { /* 40301 已提示 */ }
}

async function loadTopUsers() {
  try {
    const data = await adminApi.statsTopUsers()
    topUsers.value = Array.isArray(data) ? data : []
  } catch (e) { topUsers.value = [] }
}

async function loadTraffic() {
  try {
    const data = await adminApi.statsTraffic({ days: trafficDays.value })
    trafficData.value = Array.isArray(data) ? data : []
  } catch (e) { trafficData.value = [] }
  initTrafficChart()
}

function switchDays(d) {
  if (trafficDays.value === d) return
  trafficDays.value = d
  loadTraffic()
}

function initTopUsersChart() {
  if (!topUsersChart.value) return
  if (topChartInstance) topChartInstance.dispose()
  topChartInstance = echarts.init(topUsersChart.value)
  const c = palette()
  const sorted = [...topUsers.value].sort((a, b) => a.usedBytes - b.usedBytes)
  topChartInstance.setOption({
    animationDuration: 380,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: c.grid } },
      backgroundColor: c.tooltipBg,
      borderColor: c.grid,
      textStyle: { color: c.text, fontSize: 11.5 },
      formatter: p => {
        const item = sorted[p[0].dataIndex]
        const quota = Number(item.quotaBytes || 0)
        const used = Number(item.usedBytes || 0)
        const pct = quota > 0 ? Math.round((used / quota) * 1000) / 10 : 0
        return `${item.nickname || item.username}<br/>已用 ${formatSize(used)}<br/>配额 ${formatSize(quota)}<br/>使用率 ${pct}%`
      }
    },
    grid: { left: 112, right: 20, top: 10, bottom: 16 },
    xAxis: {
      type: 'value',
      axisLabel: { color: c.sub, fontSize: 10.5, formatter: v => formatSize(v) },
      splitLine: { lineStyle: { color: c.grid } },
      axisLine: { show: false }
    },
    yAxis: {
      type: 'category',
      data: sorted.map(u => u.nickname || u.username),
      axisLabel: { color: c.text, fontSize: 11, width: 96, overflow: 'truncate' },
      axisLine: { show: false },
      axisTick: { show: false }
    },
    series: [{
      type: 'bar',
      data: sorted.map(u => ({ value: u.usedBytes, itemStyle: { color: c.accent, borderRadius: [0, 3, 3, 0] } })),
      barWidth: 11
    }]
  })
}

function initTrafficChart() {
  if (!trafficChart.value) return
  if (trafficChartInstance) trafficChartInstance.dispose()
  trafficChartInstance = echarts.init(trafficChart.value)
  const c = palette()
  const dates = trafficData.value.map(d => d.date)
  const uploads = trafficData.value.map(d => d.uploadBytes)
  const downloads = trafficData.value.map(d => d.downloadBytes)
  trafficChartInstance.setOption({
    animationDuration: 380,
    tooltip: {
      trigger: 'axis',
      backgroundColor: c.tooltipBg,
      borderColor: c.grid,
      textStyle: { color: c.text, fontSize: 11.5 },
      formatter: p => {
        let s = p[0].axisValue
        p.forEach(item => { s += `<br/>${item.marker}${item.seriesName} ${formatSize(item.value)}` })
        return s
      }
    },
    legend: { data: ['上传', '下载'], textStyle: { color: c.sub, fontSize: 11 }, top: 0, right: 0, icon: 'roundRect', itemWidth: 9, itemHeight: 9 },
    grid: { left: 58, right: 16, top: 32, bottom: 24 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { color: c.sub, fontSize: 10.5 },
      axisLine: { lineStyle: { color: c.grid } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: c.sub, fontSize: 10.5, formatter: v => formatSize(v) },
      splitLine: { lineStyle: { color: c.grid } },
      axisLine: { show: false }
    },
    series: [
      { name: '上传', type: 'line', data: uploads, smooth: 0.2, symbol: 'none', lineStyle: { width: 1.8, color: c.accent }, itemStyle: { color: c.accent } },
      { name: '下载', type: 'line', data: downloads, smooth: 0.2, symbol: 'none', lineStyle: { width: 1.8, color: c.second }, itemStyle: { color: c.second } }
    ]
  })
}

function refreshCharts() { initTopUsersChart(); initTrafficChart() }
function handleResize() { topChartInstance?.resize(); trafficChartInstance?.resize() }

onMounted(async () => {
  await Promise.allSettled([loadOverview(), loadTopUsers(), loadTraffic()])
  initTopUsersChart()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  topChartInstance?.dispose()
  trafficChartInstance?.dispose()
})

watch(() => appStore.theme, () => { refreshCharts() })
</script>

<style scoped>
.dash { display: flex; flex-direction: column; gap: 14px; }
.dash-bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.scope {
  font-size: 10px; letter-spacing: 0.1em; color: var(--cs-primary);
  border: 1px solid rgba(79, 70, 229, 0.28); border-radius: var(--cs-radius-sm);
  padding: 1px 6px;
}
.dash-hint { display: flex; align-items: center; gap: 12px; font-size: 11px; color: var(--cs-text-tertiary); }
.link-btn { border: none; background: none; padding: 0; font-size: 11px; color: var(--cs-primary); cursor: pointer; }
.link-btn:hover { text-decoration: underline; text-underline-offset: 3px; }

.kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.kpi {
  background: var(--cs-bg-container);
  border: 1px solid var(--cs-border-light);
  border-radius: var(--cs-radius-lg);
  box-shadow: var(--cs-shadow-sm);
  padding: 14px 16px 15px;
  display: flex; flex-direction: column; gap: 9px;
}
.kpi-label { font-size: 10.5px; letter-spacing: 0.08em; color: var(--cs-text-tertiary); }
.kpi-value { font-family: var(--cs-mono); font-size: 23px; font-weight: 600; letter-spacing: -0.03em; color: var(--cs-text-primary); line-height: 1; }

.charts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.panel { overflow: hidden; }
.panel-head {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 11px 14px; border-bottom: 1px solid var(--cs-border-light);
}
.panel-head h3 { font-size: 12.5px; font-weight: 600; color: var(--cs-text-primary); }
.panel-note { font-size: 10.5px; color: var(--cs-text-tertiary); }
.chart { height: 306px; padding: 8px 4px 2px; }

.seg { display: inline-flex; border: 1px solid var(--cs-border-light); border-radius: var(--cs-radius-sm); overflow: hidden; background: var(--cs-bg-page); }
.seg-btn {
  border: none; background: transparent; color: var(--cs-text-tertiary);
  font-size: 11px; padding: 3px 9px; cursor: pointer;
  transition: background var(--cs-transition), color var(--cs-transition);
}
.seg-btn + .seg-btn { border-left: 1px solid var(--cs-border-light); }
.seg-btn:hover { color: var(--cs-text-primary); background: var(--cs-bg-hover); }
.seg-btn.on { background: var(--cs-bg-container); color: var(--cs-primary); font-weight: 600; }

@media (max-width: 1200px) {
  .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .charts { grid-template-columns: 1fr; }
}
@media (max-width: 768px) {
  .kpi-value { font-size: 19px; }
  .chart { height: 232px; }
  .dash-hint { display: none; }
}
</style>
