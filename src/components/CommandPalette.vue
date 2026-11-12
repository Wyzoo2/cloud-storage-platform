<template>
  <teleport to="body">
    <transition name="palette">
      <div v-if="modelValue" class="cmd-mask" @mousedown.self="close">
        <div class="cmd" role="dialog" aria-label="命令面板">
          <div class="cmd-input">
            <el-icon :size="15" class="cmd-search-icon"><Search /></el-icon>
            <input
              ref="inputRef"
              v-model="keyword"
              class="cmd-field"
              placeholder="搜索页面、功能或动作…"
              autocomplete="off"
              @keydown.down.prevent="move(1)"
              @keydown.up.prevent="move(-1)"
              @keydown.enter.prevent="run"
              @keydown.esc.prevent="close"
            />
            <span class="cmd-esc">ESC</span>
          </div>

          <div v-if="groups.length" class="cmd-list">
            <template v-for="group in groups" :key="group.title">
              <div class="cmd-group">{{ group.title }}</div>
              <button
                v-for="item in group.items"
                :key="item.key"
                class="cmd-item"
                :class="{ on: item.key === activeKey }"
                @mousemove="activeKey = item.key"
                @click="pick(item)"
              >
                <el-icon :size="14" class="cmd-item-icon"><component :is="item.icon" /></el-icon>
                <span class="cmd-item-title">{{ item.title }}</span>
                <span class="cmd-item-path">{{ item.hint }}</span>
              </button>
            </template>
          </div>

          <div v-else class="cmd-empty">没有匹配的页面或动作</div>

          <div class="cmd-foot">
            <span><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
            <span><kbd>Enter</kbd> 打开</span>
            <span><kbd>Esc</kbd> 关闭</span>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** [{ title, items: [{ key, title, icon, hint, path?, action? }] }] */
  groups: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue'])

const router = useRouter()
const appStore = useAppStore()

const keyword = ref('')
const activeKey = ref('')
const inputRef = ref(null)

const flat = computed(() => props.groups.flatMap(g => g.items))

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return props.groups
  return props.groups
    .map(g => ({
      ...g,
      items: g.items.filter(i =>
        i.title.toLowerCase().includes(kw) || String(i.hint || '').toLowerCase().includes(kw)
      )
    }))
    .filter(g => g.items.length)
})

const groups = computed(() => {
  // 主题切换作为常驻动作，方便在任意页面快速切换
  const base = filtered.value
  const kw = keyword.value.trim().toLowerCase()
  const themeAction = {
    title: '动作',
    items: [{ key: 'action:theme', title: '切换深色 / 浅色', icon: 'Moon', hint: '外观', action: 'theme' }]
  }
  if (!kw || '切换深色 浅色 主题 theme'.includes(kw)) return [...base, themeAction]
  return base
})

const flatVisible = computed(() => groups.value.flatMap(g => g.items))

watch(() => props.modelValue, async open => {
  if (!open) return
  keyword.value = ''
  activeKey.value = flatVisible.value[0]?.key || ''
  await nextTick()
  inputRef.value?.focus()
})

watch(keyword, () => {
  activeKey.value = flatVisible.value[0]?.key || ''
})

function move(delta) {
  const list = flatVisible.value
  if (!list.length) return
  const idx = list.findIndex(i => i.key === activeKey.value)
  const next = (idx + delta + list.length) % list.length
  activeKey.value = list[next].key
}

function pick(item) {
  if (item.action === 'theme') {
    appStore.toggleTheme()
    close()
    return
  }
  if (item.path) {
    router.push(item.path)
    close()
  }
}

function run() {
  const item = flatVisible.value.find(i => i.key === activeKey.value)
  if (item) pick(item)
}

function close() { emit('update:modelValue', false) }
</script>

<style scoped>
.cmd-mask {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgba(16, 19, 26, 0.32);
  backdrop-filter: blur(2px);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 14vh;
}
[data-theme="dark"] .cmd-mask { background: rgba(5, 7, 11, 0.55); }

.cmd {
  width: min(560px, 92vw);
  background: var(--cs-bg-elevated);
  border: 1px solid var(--cs-border-light);
  border-radius: var(--cs-radius-xl);
  box-shadow: var(--cs-shadow-xl);
  overflow: hidden;
}

.cmd-input {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 11px 14px;
  border-bottom: 1px solid var(--cs-border-light);
}
.cmd-search-icon { color: var(--cs-text-tertiary); }
.cmd-field {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13.5px;
  color: var(--cs-text-primary);
  font-family: inherit;
}
.cmd-field::placeholder { color: var(--cs-text-tertiary); }
.cmd-esc {
  font-size: 9.5px;
  letter-spacing: 0.08em;
  color: var(--cs-text-tertiary);
  border: 1px solid var(--cs-border);
  border-radius: 3px;
  padding: 1px 4px;
}

.cmd-list { max-height: 52vh; overflow-y: auto; padding: 6px; }
.cmd-group {
  padding: 8px 8px 4px;
  font-size: 9.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--cs-text-tertiary);
}
.cmd-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 9px;
  border: none;
  border-radius: var(--cs-radius);
  background: transparent;
  color: var(--cs-text-secondary);
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
  transition: background var(--cs-transition), color var(--cs-transition);
}
.cmd-item.on { background: var(--cs-bg-hover); color: var(--cs-text-primary); }
.cmd-item-icon { color: var(--cs-text-tertiary); }
.cmd-item.on .cmd-item-icon { color: var(--cs-primary); }
.cmd-item-title { flex: 1; }
.cmd-item-path { font-size: 10.5px; color: var(--cs-text-tertiary); font-family: var(--cs-mono); }

.cmd-empty { padding: 28px 16px; text-align: center; font-size: 12px; color: var(--cs-text-tertiary); }

.cmd-foot {
  display: flex;
  gap: 14px;
  padding: 8px 14px;
  border-top: 1px solid var(--cs-border-light);
  font-size: 10.5px;
  color: var(--cs-text-tertiary);
  background: var(--cs-bg-page);
}
.cmd-foot kbd {
  display: inline-block;
  min-width: 16px;
  text-align: center;
  margin-right: 3px;
  padding: 0 3px;
  border: 1px solid var(--cs-border);
  border-radius: 3px;
  font-family: var(--cs-mono);
  font-size: 9.5px;
  background: var(--cs-bg-container);
}

.palette-enter-active, .palette-leave-active { transition: opacity 0.16s ease; }
.palette-enter-from, .palette-leave-to { opacity: 0; }
.palette-enter-active .cmd, .palette-leave-active .cmd { transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
.palette-enter-from .cmd, .palette-leave-to .cmd { transform: translateY(-8px) scale(0.99); }
</style>
