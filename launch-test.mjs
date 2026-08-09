import { firefox } from 'playwright'
try {
  const browser = await firefox.launch({ headless: true, channel: 'firefox' })
  console.log('launched with channel firefox:', browser.version())
  await browser.close()
} catch (e) {
  console.log('channel failed:', e.message.split('\n')[0])
  try {
    const browser = await firefox.launch({ headless: true })
    console.log('launched default:', browser.version())
    await browser.close()
  } catch (e2) {
    console.log('default failed:', e2.message.split('\n')[0])
  }
}
