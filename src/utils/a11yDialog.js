/**
 * 无障碍补丁：为 Element Plus 的浮层补上语义属性。
 *
 * 背景：el-dialog / el-message-box 在部分版本里不会自动输出 role="dialog" 与
 * aria-modal="true"，屏幕阅读器因此无法识别"这是一个模态对话框"。
 * 这里用 MutationObserver 在浮层挂载时补齐，避免在 20+ 个页面里逐个手写指令。
 *
 * 只补充缺失的属性，不覆盖已有的 aria-* 配置。
 */

const SELECTOR = '.el-dialog, .el-message-box, .el-drawer'
const TITLE_SELECTOR = '.el-dialog__title, .el-message-box__title, .el-drawer__header, .el-dialog__header'

function labelOf(el) {
  const titleEl = el.querySelector(TITLE_SELECTOR)
  const text = (titleEl?.textContent || '').replace(/\s+/g, ' ').trim()
  return text || ''
}

function patch(el) {
  if (!(el instanceof HTMLElement)) return
  if (el.getAttribute('role') !== 'dialog') el.setAttribute('role', 'dialog')
  if (el.getAttribute('aria-modal') !== 'true') el.setAttribute('aria-modal', 'true')
  if (!el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby')) {
    const label = labelOf(el)
    if (label) el.setAttribute('aria-label', label)
  }
  // 抽屉/对话框的关闭按钮补可读名称
  const closeBtn = el.querySelector('.el-dialog__headerbtn, .el-drawer__close-btn')
  if (closeBtn) {
    const cur = (closeBtn.getAttribute('aria-label') || '').trim()
    // Element Plus 的默认值是英文 “Close this dialog”，中文界面下统一改成“关闭”
    if (!cur || /^close/i.test(cur)) closeBtn.setAttribute('aria-label', '关闭')
    if (!closeBtn.getAttribute('title')) closeBtn.setAttribute('title', '关闭')
  }
}

function scan(root) {
  if (!(root instanceof Element)) return
  if (root.matches?.(SELECTOR)) patch(root)
  root.querySelectorAll?.(SELECTOR).forEach(patch)
}

let started = false

export function installA11yDialogPatch() {
  if (started || typeof window === 'undefined' || !window.MutationObserver) return
  started = true

  // 首屏已有的浮层
  document.querySelectorAll(SELECTOR).forEach(patch)

  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of m.addedNodes) scan(node)
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
}
