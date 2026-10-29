/**
 * v-perm 按钮级权限指令
 *
 * 用法：
 *   v-perm="'file.upload'"              单个权限点
 *   v-perm="['recycle.restore', 'recycle.purge']"   任一命中即显示
 *
 * 行为：无权限时直接移出 DOM（display:none），而不是禁用——避免用户看到一个永远点不动的按钮。
 * 注意：这只是体验层，真正的越权拦截在后端（接口文档 §5.1 40301）。
 */
import { usePermissionStore } from '@/stores/permission'

function apply(el, value) {
  const store = usePermissionStore()
  el.__permHidden = !store.can(value)
  el.style.display = el.__permHidden ? 'none' : ''
}

export const permDirective = {
  mounted(el, binding) {
    apply(el, binding.value)
  },
  updated(el, binding) {
    apply(el, binding.value)
  }
}
