/**
 * 开通进度：下单成功后轮询 /orders/{id}，把结果归一成 done / failed / timeout
 * 供「套餐购买」「套餐续费」共用（弹窗只需展示，不允许中途关闭）
 */
import { orderApi } from '@/api'

const DONE = ['done', 'success', 'paid', 'completed', 'provisioned', 'active']
const FAILED = ['failed', 'closed', 'cancelled', 'canceled', 'refunded', 'error']

const sleep = ms => new Promise(r => setTimeout(r, ms))

/**
 * @param {string|number} orderId
 * @param {{times?: number, interval?: number, onTick?: (i: number, total: number) => void}} opts
 * @returns {Promise<'done'|'failed'|'timeout'>}
 */
export async function pollProvision(orderId, opts = {}) {
  const times = opts.times ?? 12
  const interval = opts.interval ?? 1500
  for (let i = 0; i < times; i++) {
    await sleep(interval)
    opts.onTick?.(i + 1, times)
    try {
      const d = await orderApi.detail(orderId)
      // 门户订单：provision_done=true 即开通完成；status 可能是数字（2=已完成/已支付）
      if (d?.provision_done === true) return 'done'
      const st = String(d?.status ?? d?.state ?? d?.orderStatus ?? '').toLowerCase()
      if (DONE.includes(st) || st === '2') return 'done'
      if (FAILED.includes(st)) return 'failed'
    } catch (e) {
      // 门户暂不可达：继续重试，超时后由调用方提示「结果待确认」
    }
  }
  return 'timeout'
}

/** 从下单响应里取订单号（后端字段可能是 order_id / orderId / id） */
export function orderIdOf(order) {
  return order?.order_id ?? order?.orderId ?? order?.id ?? null
}
