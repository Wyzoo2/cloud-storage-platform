import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'
import { permDirective } from './directives/perm'
import './styles/index.css'

const app = createApp(App)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

// 按钮级权限：v-perm="'file.upload'"
app.directive('perm', permDirective)

app.use(createPinia())
app.use(router)
app.use(ElementPlus)

const savedTheme = localStorage.getItem('cs-theme') || 'light'
document.documentElement.setAttribute('data-theme', savedTheme)
if (savedTheme === 'dark') {
  document.documentElement.classList.add('dark')
}

app.mount('#app')