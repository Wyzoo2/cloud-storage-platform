/**
 * 无障碍补丁（键盘）：让表格行与树节点可以用键盘操作。
 *
 * 现状：行点击（选中/查看详情）与树节点点击只响应鼠标。
 * 做法：委托一个全局 keydown，对可聚焦的表格行、树节点把 Enter / Space 翻译成一次 click，
 * 于是所有已有的 @row-click / @node-click 逻辑无需改动即可用键盘触发。
 *
 * 同时补 tabindex（使元素进入 Tab 顺序）与 aria-expanded（树节点展开状态）。
 */

const ROW_SELECTOR = '.el-table__body tr.el-table__row'
const TREE_NODE_SELECTOR = '.el-tree-node__content'

function activate(el) {
  // 用真实 MouseEvent 触发，兼容依赖事件坐标/冒泡细节的组件（el-table 的行点击即如此）
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
}

function makeFocusable(el, role) {
  if (!(el instanceof HTMLElement)) return
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0')
  if (role && !el.hasAttribute('role')) el.setAttribute('role', role)
}

function syncTreeExpanded() {
  document.querySelectorAll('.el-tree-node').forEach(node => {
    const expanded = node.classList.contains('is-expanded')
    const content = node.querySelector(':scope > .el-tree-node__content')
    if (content) content.setAttribute('aria-expanded', expanded ? 'true' : 'false')
  })
}

function enhanceRow(tr) {
  if (!(tr instanceof HTMLElement)) return
  // 含可交互控件（按钮/输入框/复选框）的行不抢焦点，避免与内部控件争 Tab
  if (tr.querySelector('button, input, textarea, select, .el-checkbox')) return
  makeFocusable(tr, 'row')
  if (!tr.dataset.a11yBound) {
    tr.dataset.a11yBound = '1'
    tr.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        activate(tr)
      }
    })
  }
}

function enhanceTreeContent(el) {
  if (!(el instanceof HTMLElement)) return
  makeFocusable(el, 'treeitem')
  if (!el.dataset.a11yBound) {
    el.dataset.a11yBound = '1'
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        activate(el)
      }
    })
  }
}

function scanTree(root) {
  root.querySelectorAll?.(TREE_NODE_SELECTOR).forEach(enhanceTreeContent)
}

function scan(root) {
  if (!(root instanceof Element)) return
  if (root.matches?.(ROW_SELECTOR)) enhanceRow(root)
  if (root.matches?.(TREE_NODE_SELECTOR)) enhanceTreeContent(root)
  root.querySelectorAll?.(ROW_SELECTOR).forEach(enhanceRow)
  scanTree(root)
}

let started = false

export function installA11yKeyboardPatch() {
  if (started || typeof window === 'undefined' || !window.MutationObserver) return
  started = true

  document.querySelectorAll(ROW_SELECTOR).forEach(enhanceRow)
  document.querySelectorAll(TREE_NODE_SELECTOR).forEach(enhanceTreeContent)
  syncTreeExpanded()

  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      if (m.type === 'attributes') {
        if (m.target.classList?.contains('el-tree-node')) syncTreeExpanded()
        continue
      }
      for (const node of m.addedNodes) scan(node)
    }
  })
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class']
  })
}
