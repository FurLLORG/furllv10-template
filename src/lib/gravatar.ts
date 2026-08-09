import CryptoJS from 'crypto-js'

const GRAVATAR_MIRROR = 'https://gravatar.loli.net/avatar'

/**
 * Gravatar 头像地址（loli.net 镜像）。
 * 官方头像 = md5(邮箱小写去空格) + d=identicon 兜底默认图
 */
export function gravatarUrl(email: string, size = 64): string {
  const hash = CryptoJS.MD5((email ?? '').trim().toLowerCase()).toString()
  return `${GRAVATAR_MIRROR}/${hash}?d=identicon&s=${size}`
}
