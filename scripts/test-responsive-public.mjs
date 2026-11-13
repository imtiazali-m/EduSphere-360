import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'

const require = createRequire(import.meta.url)
const playwrightModule = process.env.PLAYWRIGHT_MODULE_PATH ?? 'playwright'
const { chromium } = require(playwrightModule)

const host = '127.0.0.1'
const port = Number(process.env.EDUSPHERE_PREVIEW_PORT ?? 4173)
const baseUrl = `http://${host}:${port}`
const artifactDir = process.env.EDUSPHERE_SCREENSHOT_DIR ?? 'artifacts/responsive-public'
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

const server = spawn(
  npmCommand,
  ['run', 'preview', '--', '--host', host, '--port', String(port), '--strictPort'],
  { stdio: 'ignore', shell: process.platform === 'win32' },
)

let browser

async function waitForPreview() {
  const deadline = Date.now() + 30_000
  let lastError
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
      lastError = new Error(`Preview returned HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await new Promise(resolve => setTimeout(resolve, 300))
  }
  throw new Error(`Vite preview did not become ready: ${String(lastError)}`)
}

async function assertNoHorizontalOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }))
  assert.ok(
    dimensions.document <= dimensions.viewport + 1 && dimensions.body <= dimensions.viewport + 1,
    `${label}: horizontal overflow detected (viewport=${dimensions.viewport}, document=${dimensions.document}, body=${dimensions.body})`,
  )
}

async function inspectViewport({ name, width, height }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    isMobile: width <= 430,
    hasTouch: width <= 768,
  })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))

  try {
    const response = await page.goto(`${baseUrl}/#/`, { waitUntil: 'domcontentloaded' })
    assert.equal(response?.status(), 200, `${name}: college homepage did not return HTTP 200`)
    await page.locator('.gic-hero h1').waitFor({ state: 'visible' })
    await page.waitForTimeout(250)

    const heading = (await page.locator('.gic-hero h1').innerText()).replace(/\\s+/g, ' ').trim()
    assert.match(heading, /Learn here/i, `${name}: college homepage headline is missing`)
    assert.ok((await page.locator('.gic-brand-copy').first().innerText()).includes('Government Islamia'), `${name}: college identity is missing`)
    assert.equal(await page.locator('.gic-portal-card').count(), 7, `${name}: all seven existing college portal routes should be visible`)
    assert.equal(await page.locator('.gic-notice-row').count(), 4, `${name}: official information links are missing`)
    assert.equal(await page.locator('.gic-faq-item').count(), 4, `${name}: college FAQ entries are missing`)

    const theme = await page.locator('.gic-site').evaluate(element => {
      const site = getComputedStyle(element)
      const headingStyle = getComputedStyle(element.querySelector('.gic-hero h1'))
      const primary = getComputedStyle(element.querySelector('.gic-button-primary'))
      return { font: site.fontFamily, displayFont: headingStyle.fontFamily, canvas: site.backgroundColor, primary: primary.backgroundColor }
    })
    assert.match(theme.font, /DM Sans/i, `${name}: college body typography is missing`)
    assert.match(theme.displayFont, /Playfair Display/i, `${name}: college heading typography is missing`)
    assert.equal(theme.canvas, 'rgb(255, 253, 248)', `${name}: college paper background is not applied`)
    assert.equal(theme.primary, 'rgb(25, 61, 49)', `${name}: college forest-green primary action is not applied`)
    await assertNoHorizontalOverflow(page, `${name} college homepage`)

    const faqToggle = page.locator('.gic-faq-item button').nth(1)
    await faqToggle.click()
    assert.equal(await faqToggle.getAttribute('aria-expanded'), 'true', `${name}: college FAQ did not open`)

    await mkdir(artifactDir, { recursive: true })
    await page.screenshot({
      path: `${artifactDir}/${name}-college-home.png`,
      fullPage: true,
      animations: 'disabled',
    })

    if (width <= 800) {
      const menuToggle = page.locator('.gic-menu-toggle')
      await menuToggle.waitFor({ state: 'visible' })
      await menuToggle.click()
      await page.locator('.gic-nav.is-open').waitFor({ state: 'visible' })
      await page.locator('.gic-nav.is-open a[href="#admissions"]').click()
      await page.waitForFunction(() => location.hash === '#admissions')
      await page.goto(`${baseUrl}/#/`, { waitUntil: 'domcontentloaded' })
      await page.locator('.gic-hero h1').waitFor({ state: 'visible' })
      await assertNoHorizontalOverflow(page, `${name} college mobile navigation`)
    } else {
      await page.locator('.gic-nav a[href="#admissions"]').first().waitFor({ state: 'visible' })
    }

    const roleCategories = {
      owner: 'Principal / Office',
      admin: 'Principal / Office',
      teacher: 'Faculty / Staff',
      student: 'Student',
      parent: 'Parent',
      accountant: 'Faculty / Staff',
      exam_officer: 'Faculty / Staff',
    }
    for (const [role, expectedCategory] of Object.entries(roleCategories)) {
      await page.goto(`${baseUrl}/#/login/${role}`, { waitUntil: 'domcontentloaded' })
      await page.locator('.es-auth-page').waitFor({ state: 'visible' })
      await page.locator('.es-auth-form').first().waitFor({ state: 'visible' })
      await page.waitForFunction(expected => {
        const selected = document.querySelector('.es-account-type button[aria-pressed="true"] b')
        return selected?.textContent?.trim() === expected
      }, expectedCategory)
      const selectedCategory = (await page.locator('.es-account-type button[aria-pressed="true"] b').innerText()).trim()
      assert.equal(selectedCategory, expectedCategory, `${name}: ${role} login selected ${selectedCategory}, expected ${expectedCategory}`)
      await assertNoHorizontalOverflow(page, `${name} ${role} login`)
      await page.screenshot({
        path: `${artifactDir}/${name}-${role}-login.png`,
        fullPage: true,
        animations: 'disabled',
      })
    }

    await page.goto(`${baseUrl}/#/login/owner`, { waitUntil: 'domcontentloaded' })
    await page.locator('.es-auth-page').waitFor({ state: 'visible' })
    await page.getByRole('button', { name: 'Forgot your password?' }).click()
    await page.getByRole('heading', { name: 'Reset your password' }).waitFor({ state: 'visible' })
    await page.getByRole('button', { name: 'Send password-reset link' }).waitFor({ state: 'visible' })
    await assertNoHorizontalOverflow(page, `${name} password reset`)
    await page.screenshot({
      path: `${artifactDir}/${name}-password-reset.png`,
      fullPage: true,
      animations: 'disabled',
    })
    await page.getByRole('button', { name: 'Back to login' }).click()
    await page.getByRole('heading', { name: 'Welcome back', exact: true }).waitFor({ state: 'visible' })

    await page.goto(`${baseUrl}/#/setup`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Get access through the college' }).waitFor({ state: 'visible' })
    await page.locator('.es-college-access-note').waitFor({ state: 'visible' })
    assert.equal(await page.locator('.es-signup-form').count(), 0, `${name}: public institution self-registration must not be exposed`)
    await page.getByRole('button', { name: 'Continue to sign in' }).waitFor({ state: 'visible' })
    await assertNoHorizontalOverflow(page, `${name} college account access`)
    await page.screenshot({
      path: `${artifactDir}/${name}-college-account-access.png`,
      fullPage: true,
      animations: 'disabled',
    })

    for (const route of ['/public/features', '/public/solutions', '/public/analytics']) {
      await page.goto(`${baseUrl}/#${route}`, { waitUntil: 'domcontentloaded' })
      await page.locator('.gic-hero h1').waitFor({ state: 'visible' })
      const returnedHeading = await page.locator('.gic-hero h1').innerText()
      assert.match(returnedHeading, /Learn here/i, `${name}: ${route} should resolve to the college website, not product marketing`)
      await assertNoHorizontalOverflow(page, `${name} legacy public route ${route}`)
    }

    assert.deepEqual(pageErrors, [], `${name}: browser runtime errors detected: ${pageErrors.join('; ')}`)
    console.log(`PASS ${name} (${width}x${height}): college homepage, mobile navigation, seven role routes, recovery and account guidance`)
  } finally {
    await context.close()
  }
}

try {
  await waitForPreview()
  browser = await chromium.launch({ headless: true, channel: 'chrome' })
  for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'tablet-landscape', width: 1024, height: 768 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    await inspectViewport(viewport)
  }
  console.log(`Responsive public-page QA passed. Screenshots saved under ${artifactDir}.`)
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await browser?.close().catch(() => {})
  server.kill('SIGTERM')
}
