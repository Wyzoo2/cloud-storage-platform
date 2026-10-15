// 部署形态开关：false = 测试（根路径）；true = 生产统一门户子路径 /storage/
export const MOUNTED = false

export const MOUNT_BASE = MOUNTED ? '/storage/' : '/'
