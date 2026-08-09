import CryptoJS from 'crypto-js'

/**
 * 魔方系统密码传输加密（与官方 JS 一致）
 * AES-128-CBC / PKCS7 / base64
 * key/iv 来自系统 config/idcsmart.php 的 aes 配置
 */
const AES_KEY = CryptoJS.enc.Utf8.parse('idcsmart.finance')
const AES_IV = CryptoJS.enc.Utf8.parse('9311019310287172')

export function encryptPassword(password: string): string {
  return CryptoJS.AES.encrypt(password, AES_KEY, {
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
    iv: AES_IV,
  }).toString()
}
