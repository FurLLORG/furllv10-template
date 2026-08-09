import { describe, expect, it } from 'vitest'
import { resolveCloudInfo } from '@/features/client/cloud-info'

describe('resolveCloudInfo 冗余解析（mf_cloud 云产品）', () => {
  // 官方 /console/v1/mf_cloud/15 示例返回
  const EXAMPLE = {
    cloudData: {
      ip: '',
      ip_num: 0,
      ipv6_num: 0,
      power_status: 'fault',
      cpu: 1,
      memory: 1,
      system_disk: { size: 0, type: '' },
      data_disk: { count: 1, total_size: 30 },
      line: { id: 1, name: '示例线路', bill_type: 'bw', sync_firewall_rule: 0 },
      bw: 100,
      peak_defence: 1,
      network_type: 'normal',
      gpu: '',
      username: '',
      password: '',
      data_center: { id: 1, city: '北京', area: '北京', country: '中国', iso: 'CN' },
      image: { id: 309, name: 'CentOS-6.8.1607-x64', image_group_name: 'CentOS' },
      config: {
        simulate_physical_machine_enable: 1,
        show_panel_password_enable: 1,
        manual_manage: 0,
      },
    },
    remoteInfo: { port: 0, panel_pass: '', simulate_physical_machine: 0 },
    ipDetails: { ip_num: 0 },
    memoryUnit: 'GB',
  }

  it('官方示例：全字段按官方展示规则解析', () => {
    const info = resolveCloudInfo(EXAMPLE)
    expect(info.cpu).toBe('1')
    expect(info.gpu).toBe('--')
    expect(info.memory).toBe('1GB')
    expect(info.os).toBe('CentOS-6.8.1607-x64')
    expect(info.bw).toBe('100')
    expect(info.port).toBe('0')
    expect(info.peakDefence).toBe('1')
    expect(info.hasDefenceRow).toBe(true)
    expect(info.ipv4Num).toBe('')
    expect(info.ipv6Num).toBe('')
    expect(info.showSimulatePhysical).toBe(true)
    expect(info.showPanelPassword).toBe(true)
  })

  it('内存单位取订购页配置 memory_unit，缺省 GB', () => {
    expect(resolveCloudInfo({ ...EXAMPLE, memoryUnit: 'G' }).memory).toBe('1G')
    expect(resolveCloudInfo({ cloudData: { memory: 2 } }).memory).toBe('2GB')
  })

  it('CPU/内存缺失回 --，不拼接单位', () => {
    const info = resolveCloudInfo({ cloudData: {} })
    expect(info.cpu).toBe('--')
    expect(info.memory).toBe('--')
    expect(info.gpu).toBe('--')
    expect(info.os).toBe('--')
    expect(info.bw).toBe('')
  })

  it('带宽缺省为空（展示层显示无限制文案），防御行按 sync_firewall_rule 门控', () => {
    const info = resolveCloudInfo({
      cloudData: { line: { sync_firewall_rule: 1 } },
    })
    expect(info.bw).toBe('')
    expect(info.hasDefenceRow).toBe(false)
  })

  it('IPv4 = ipDetails.ip_num - ipv6_num，为 0 时返回空（展示层显示无）', () => {
    const info = resolveCloudInfo({
      cloudData: { ipv6_num: 2 },
      ipDetails: { ip_num: 5 },
    })
    expect(info.ipv4Num).toBe('3')
    expect(info.ipv6Num).toBe('2')
  })

  it('登录信息多源兜底：remote_info → host_data → host.addition', () => {
    const fromRemote = resolveCloudInfo({
      cloudData: { host_data: {} },
      remoteInfo: { username: 'root', password: 'p1', port: 22, panel_pass: 'pp' },
    })
    expect(fromRemote.username).toBe('root')
    expect(fromRemote.panelPass).toBe('pp')

    const fromHostData = resolveCloudInfo({
      cloudData: { host_data: { username: 'u1', port: 3389 } },
    })
    expect(fromHostData.username).toBe('u1')
    expect(fromHostData.port).toBe('3389')
  })

  it('SSH 密钥与 Windows 镜像识别', () => {
    const ssh = resolveCloudInfo({
      cloudData: { ssh_key: { id: 3, name: 'my-key' } },
    })
    expect(ssh.sshKeyId).toBe(3)
    expect(ssh.sshKeyName).toBe('my-key')

    const win = resolveCloudInfo({
      cloudData: { image: { image_group_name: 'Windows' } },
    })
    expect(win.isWindows).toBe(true)
  })

  it('模拟物理机/面板密码按 config 门控', () => {
    const off = resolveCloudInfo({
      cloudData: {
        config: { simulate_physical_machine_enable: 0, show_panel_password_enable: 0 },
      },
    })
    expect(off.showSimulatePhysical).toBe(false)
    expect(off.showPanelPassword).toBe(false)
  })
})
