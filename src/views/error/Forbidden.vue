<template>
  <div class="forbidden-page">
    <el-result icon="warning" title="无权访问" :sub-title="subTitle">
      <template #extra>
        <el-button type="primary" @click="goHome">返回首页</el-button>
        <el-button @click="reloadPerms">刷新权限</el-button>
      </template>
    </el-result>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { usePermissionStore } from '@/stores/permission'

const route = useRoute()
const router = useRouter()
const perm = usePermissionStore()

const subTitle = computed(() => {
  if (perm.legacy) return '权限服务暂不可用，请稍后刷新重试或联系管理员'
  if (perm.perms.length === 0) {
    return '该账号尚未分配任何角色与权限，请联系管理员分配角色后再登录'
  }
  return '你的账号没有访问该页面所需的权限点，如需开通请联系企业管理员'
})

// 「返回首页」= 跳转到登录页，方便换账号或重新登录后再进入有权限的页面
function goHome() {
  router.replace('/login')
}

async function reloadPerms() {
  await perm.load(true)
  ElMessage.success('权限已刷新')
  const from = route.query.from
  if (typeof from === 'string' && from) router.replace(from)
}
</script>

<style scoped>
.forbidden-page {
  min-height: 70vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
