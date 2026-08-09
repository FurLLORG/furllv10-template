/**
 * DCIM 实例信息冗余解析（官方 dcimDetail msg-l 数据源 + 多路兜底）。
 *
 * 官方结构：cloudData.model_config（cpu/memory/disk/gpu）、image（操作系统）、
 * line（bill_type/sync_firewall_rule）、bw/flow/peak_defence（带宽/流量/防御），
 * 登录信息来自 remote_info（rescueStatusData：username/password/port/ip_num）。
 *
 * 冗余兜底（容忍不同版本/不同上游返回结构差异）：
 * - host.base_info（如 "8888TEST-256G-200GB SSD"，按 - 分段）
 * - host.addition（image_name/username/password/port）
 * - host_data（username/password/port）
 * - ipDetails.ip_num
 * 解析失败的字段一律回 --，不抛错。
 */

import type {
  CloudDetailData,
  CloudIpDetailsData,
  CloudRemoteInfoData,
  HostDetail,
} from '@/api'

function str(v: unknown): string | undefined {
  if (v == null || v === '') return undefined
  const s = String(v).trim()
  return s || undefined
}

/** base_info 分段：CPU-内存-硬盘（可能带 - 的磁盘名，取后半段拼接） */
function splitBaseInfo(baseInfo: unknown): {
  cpu?: string
  memory?: string
  disk?: string
} {
  const raw = str(baseInfo)
  if (!raw) return {}
  const parts = raw.split('-').map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) return {}
  if (parts.length === 1) return { cpu: parts[0] }
  return {
    cpu: parts[0],
    memory: parts[1],
    disk: parts.slice(2).join('-'),
  }
}

export interface DcimInfo {
  cpu: string
  memory: string
  disk: string
  gpu: string
  os: string
  username: string
  password: string
  port: string
  ipNum: string
  peakDefence: string
  bw: string
  billType?: string
  hasDefenceRow: boolean
}

export function resolveDcimInfo(params: {
  cloudData?: CloudDetailData
  host?: HostDetail
  remoteInfo?: CloudRemoteInfoData
  ipDetails?: CloudIpDetailsData
}): DcimInfo {
  const { cloudData, host, remoteInfo, ipDetails } = params
  const model = cloudData?.model_config
  const base = splitBaseInfo(
    (host as { base_info?: unknown } | undefined)?.base_info
  )
  const addition = (host as { addition?: Record<string, unknown> } | undefined)
    ?.addition
  const hostData = cloudData?.host_data

  // 操作系统：image.name → host.addition.image_name → cloud_os 列表首个
  const osName = str(model?.os) ?? str(model?.system) ?? str(cloudData?.image?.name)
  const os =
    osName ??
    str(addition?.image_name) ??
    str((cloudData?.cloud_os as Array<{ name?: string }> | undefined)?.[0]?.name)

  // 登录信息：remote_info（rescueStatusData）→ host_data → host.addition
  const username =
    str(remoteInfo?.username) ?? str(hostData?.username) ?? str(addition?.username)
  const password =
    str(remoteInfo?.password) ?? str(hostData?.password) ?? str(addition?.password)
  const port =
    str(remoteInfo?.port) ?? str(hostData?.port) ?? str(addition?.port)

  // IP 数量：remote_info → ip 详情 → host_data ip 数
  let ipNum = str(remoteInfo?.ip_num)
  if (!ipNum && ipDetails?.ip_num != null) ipNum = String(ipDetails.ip_num)
  if (!ipNum && (hostData?.dedicatedip || hostData?.assignedips)) {
    ipNum = String(
      [hostData.dedicatedip, hostData.assignedips]
        .flatMap((v) => (Array.isArray(v) ? v : str(v)?.split(/[\s,;]+/) ?? []))
        .filter(Boolean).length
    )
  }

  // 带宽/流量：bw（'NC'=真实带宽用 bw_show/actual_bw）→ bwlimit 兜底
  const billType = str(cloudData?.line?.bill_type) ?? 'bw'
  const bwRaw = cloudData?.bw
  const bw =
    str(bwRaw) === 'NC'
      ? str(cloudData?.bw_show) ?? 'NC'
      : str(bwRaw) ?? str(hostData?.bwlimit)

  return {
    cpu: str(model?.cpu) ?? base.cpu ?? '--',
    memory: str(model?.memory) ?? base.memory ?? '--',
    disk: str(model?.disk) ?? base.disk ?? '--',
    gpu: str(model?.gpu) ?? '--',
    os: os ?? '--',
    username: username ?? '--',
    password: password ?? '',
    port: port ?? '--',
    ipNum: ipNum ?? '--',
    peakDefence: str(cloudData?.peak_defence) ?? '',
    bw: bw ?? '--',
    billType,
    hasDefenceRow: cloudData?.line?.sync_firewall_rule === 0,
  }
}
