/**
 * mf_cloud 云产品实例信息冗余解析（官方 server/mf_cloud cloudDetail msg-l 数据源 + 多路兜底）。
 *
 * 官方结构（GET /:ns/:id）：cpu/memory（数字）、gpu、image（操作系统）、line
 * （bill_type/sync_firewall_rule）、bw/flow/peak_defence、ipv6_num、ssh_key、
 * config（simulate_physical_machine_enable/show_panel_password_enable 等），
 * 登录信息来自 remote_info（rescueStatusData：username/password/port/panel_pass/
 * simulate_physical_machine），内存单位来自订购页配置（config.memory_unit）。
 *
 * 冗余兜底（容忍不同版本/不同上游返回结构差异）：cpu/memory 缺省回 --，
 * 带宽缺省显示无限制文案，不抛错。
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

export interface CloudInfo {
  cpu: string
  gpu: string
  memory: string
  os: string
  username: string
  password: string
  port: string
  panelPass: string
  sshKeyId: number
  sshKeyName: string
  bw: string
  flow: string
  billType?: string
  peakDefence: string
  hasDefenceRow: boolean
  ipv4Num: string
  ipv6Num: string
  isWindows: boolean
  /** 模拟物理机运行：manual_manage===0 且开关开启时展示 */
  showSimulatePhysical: boolean
  simulatePhysicalMachine: boolean
  /** 面板密码：show_panel_password_enable===1 时展示 */
  showPanelPassword: boolean
  /** 安全组（官方 cloudDetail.security_group：id>0 已加入，0=尚未加入） */
  securityGroupId: number
  securityGroupName: string
}

export function resolveCloudInfo(params: {
  cloudData?: CloudDetailData
  host?: HostDetail
  remoteInfo?: CloudRemoteInfoData
  ipDetails?: CloudIpDetailsData
  memoryUnit?: string
}): CloudInfo {
  const { cloudData, remoteInfo, ipDetails, memoryUnit } = params
  const hostData = cloudData?.host_data

  // 内存单位：订购页配置 memory_unit → 默认 GB
  const unit = str(memoryUnit) ?? 'GB'

  // 用户名/密码/端口/面板密码：remote_info → host_data → host.addition
  const addition = (params.host as { addition?: Record<string, unknown> | undefined })
    ?.addition
  const username =
    str(remoteInfo?.username) ?? str(hostData?.username) ?? str(addition?.username)
  const password =
    str(remoteInfo?.password) ?? str(hostData?.password) ?? str(addition?.password)
  const port =
    str(remoteInfo?.port) ?? str(hostData?.port) ?? str(addition?.port)
  const panelPass = str(remoteInfo?.panel_pass)

  // IPv4 数量：官方 ipv4Select.length，注释为 ipDetails.ip_num - ipv6_num
  const ipv6Num = Number(cloudData?.ipv6_num ?? 0)
  const ipv4Num = Math.max(
    (Number(ipDetails?.ip_num) || 0) - ipv6Num,
    0
  )

  const imageGroup = str(cloudData?.image?.image_group_name) ?? ''
  const config = cloudData?.config ?? {}
  // 安全组（官方 cloudDetail.security_group，动态解析，不依赖固定结构）
  const sg = (cloudData?.security_group ?? {}) as {
    id?: number
    name?: string
  }

  return {
    cpu: str(cloudData?.cpu) ?? '--',
    gpu: str(cloudData?.gpu) ?? '--',
    memory:
      cloudData?.memory == null ? '--' : `${cloudData.memory}${unit}`,
    os: str(cloudData?.image?.name) ?? '--',
    username: username ?? '',
    password: password ?? '',
    port: port ?? '--',
    panelPass: panelPass ?? '',
    sshKeyId: Number(cloudData?.ssh_key?.id ?? 0),
    sshKeyName: str(cloudData?.ssh_key?.name) ?? '',
    bw: str(cloudData?.bw) ?? '',
    flow:
      cloudData?.flow == null || Number(cloudData.flow) === 0
        ? ''
        : `${cloudData.flow}G`,
    billType: str(cloudData?.line?.bill_type) ?? 'bw',
    peakDefence: str(cloudData?.peak_defence) ?? '',
    hasDefenceRow: cloudData?.line?.sync_firewall_rule === 0,
    ipv4Num: ipv4Num > 0 ? String(ipv4Num) : '',
    ipv6Num: ipv6Num > 0 ? String(ipv6Num) : '',
    isWindows: /windows/i.test(imageGroup),
    showSimulatePhysical:
      config.manual_manage === 0 &&
      config.simulate_physical_machine_enable === 1,
    simulatePhysicalMachine: remoteInfo?.simulate_physical_machine === 1,
    showPanelPassword: config.show_panel_password_enable === 1,
    securityGroupId: Number(sg.id ?? 0),
    securityGroupName: str(sg.name) ?? '',
  }
}
