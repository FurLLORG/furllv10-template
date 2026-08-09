import { describe, expect, it } from 'vitest'
import { resolveDcimInfo } from '@/features/client/dcim-info'

describe('resolveDcimInfo 冗余解析', () => {
  it('model_config/image/line/bw/remote_info 完整时直接取用', () => {
    const info = resolveDcimInfo({
      cloudData: {
        model_config: { cpu: '8888TEST', memory: '256G', disk: '200GB SSD', gpu: '' },
        image: { name: 'CentOS-5.8-x86_64' },
        peak_defence: 0,
        bw: '100',
        line: { sync_firewall_rule: 0, bill_type: 'bw' },
        host_data: {},
      },
      remoteInfo: { rescue: 0, username: 'root', password: 'pass123', port: 22, ip_num: 0 },
    })
    expect(info.cpu).toBe('8888TEST')
    expect(info.memory).toBe('256G')
    expect(info.disk).toBe('200GB SSD')
    expect(info.os).toBe('CentOS-5.8-x86_64')
    expect(info.username).toBe('root')
    expect(info.password).toBe('pass123')
    expect(info.port).toBe('22')
    expect(info.ipNum).toBe('0')
    expect(info.bw).toBe('100')
    expect(info.billType).toBe('bw')
    expect(info.hasDefenceRow).toBe(true)
    expect(info.gpu).toBe('--')
  })

  it('model_config 缺失时用 host.base_info 分段兜底（CPU-内存-硬盘）', () => {
    const info = resolveDcimInfo({
      host: { id: 1, base_info: '8888TEST-256G-200GB SSD' },
    })
    expect(info.cpu).toBe('8888TEST')
    expect(info.memory).toBe('256G')
    expect(info.disk).toBe('200GB SSD')
  })

  it('登录信息多源兜底：remote_info → host_data → host.addition', () => {
    const hostData = resolveDcimInfo({
      cloudData: { host_data: { username: 'u1', password: 'p1', port: 22 } },
    })
    expect(hostData.username).toBe('u1')
    expect(hostData.password).toBe('p1')
    expect(hostData.port).toBe('22')

    const addition = resolveDcimInfo({
      host: { id: 1, addition: { username: 'u2', password: 'p2', port: 3389 } },
    })
    expect(addition.username).toBe('u2')
    expect(addition.port).toBe('3389')
  })

  it('操作系统兜底：image → addition.image_name → cloud_os 列表首个', () => {
    const fromImage = resolveDcimInfo({
      cloudData: { image: { name: 'Ubuntu-22.04' } },
    })
    expect(fromImage.os).toBe('Ubuntu-22.04')

    const fromCloudOs = resolveDcimInfo({
      cloudData: { cloud_os: [{ id: 1, name: 'CentOS-7' }] },
    })
    expect(fromCloudOs.os).toBe('CentOS-7')
  })

  it('bw 为 NC 时用 bw_show 兜底，无 bw_show 时标记 NC（展示真实带宽文案）', () => {
    const withShow = resolveDcimInfo({
      cloudData: { bw: 'NC', bw_show: '1000Mbps' },
    })
    expect(withShow.bw).toBe('1000Mbps')

    const withoutShow = resolveDcimInfo({ cloudData: { bw: 'NC' } })
    expect(withoutShow.bw).toBe('NC')
  })

  it('IP 数量兜底：remote_info → ipDetails → host_data IP 拼接计数', () => {
    const fromDetails = resolveDcimInfo({
      ipDetails: { ip_num: 3 },
    })
    expect(fromDetails.ipNum).toBe('3')

    const fromHostData = resolveDcimInfo({
      cloudData: {
        host_data: { dedicatedip: '1.1.1.1', assignedips: '2.2.2.2, 3.3.3.3' },
      },
    })
    expect(fromHostData.ipNum).toBe('3')
  })

  it('解析失败的字段一律回 --，不抛错', () => {
    const info = resolveDcimInfo({})
    expect(info.cpu).toBe('--')
    expect(info.memory).toBe('--')
    expect(info.disk).toBe('--')
    expect(info.os).toBe('--')
    expect(info.username).toBe('--')
    expect(info.password).toBe('')
    expect(info.port).toBe('--')
    expect(info.ipNum).toBe('--')
    expect(info.bw).toBe('--')
    expect(info.hasDefenceRow).toBe(false)
    expect(() => resolveDcimInfo({})).not.toThrow()
  })
})
