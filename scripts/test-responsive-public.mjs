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
    assert.equal(response?.status(), 200, `${name}: welcome page did not return HTTP 200`)
    await page.locator('.edm-hero h1').waitFor({ state: 'visible' })
    await page.waitForTimeout(350)

    const heading = (await page.locator('.edm-hero h1').innerText()).replace(/\s+/g, ' ').trim()
    assert.match(heading, /Your institution\./, `${name}: welcome headline is missing`)
    await assertNoHorizontalOverflow(page, `${name} welcome page`)

    await mkdir(artifactDir, { recursive: true })
    await page.screenshot({
      path: `${artifactDir}/${name}-welcome.png`,
      fullPage: true,
      animations: 'disabled',
    })

    const menuToggle = page.locator('.edm-mobile-toggle')
    if (width <= 900) {
      await menuToggle.waitFor({ state: 'visible' })
      await menuToggle.click()
      await page.locator('.edm-nav.is-open').waitFor({ state: 'visible' })
      const featuresLink = page.locator('.edm-nav.is-open a[href="#features"]').first()
      await featuresLink.click()
      await page.waitForFunction(() => location.hash === '#features')
      await page.goto(`${baseUrl}/#/`, { waitUntil: 'domcontentloaded' })
      await page.locator('.edm-hero h1').waitFor({ state: 'visible' })
      await assertNoHorizontalOverflow(page, `${name} welcome mobile navigation`)
    } else {
      await page.locator('.edm-nav a[href="#features"]').first().waitFor({ state: 'visible' })
    }

    const roleCategories = {
      owner: 'Owner / Admin',
      admin: 'Owner / Admin',
      teacher: 'Employee',
      student: 'Student',
      parent: 'Parent',
      accountant: 'Employee',
      exam_officer: 'Employee',
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
    await page.locator('.es-signup-form').waitFor({ state: 'visible' })
    await assertNoHorizontalOverflow(page, `${name} owner setup`)
    await page.screenshot({
      path: `${artifactDir}/${name}-owner-setup.png`,
      fullPage: true,
      animations: 'disabled',
    })

    const publicRoutes = [
      ['/public/features', 'Explore the platform'],
      ['/public/features/invoices-payments', 'Fee invoices, payments'],
      ['/public/solutions', 'The right workspace'],
      ['/public/analytics', 'See the whole picture'],
      ['/public/integrations', 'Connected when configured'],
      ['/public/pricing', 'Clear product information'],
      ['/public/support', 'A clearer next step'],
    ]
    for (const [route, expectedHeading] of publicRoutes) {
      await page.goto(`${baseUrl}/#${route}`, { waitUntil: 'domcontentloaded' })
      const publicHeading = page.locator('.ep-page-hero h1').first()
      await publicHeading.waitFor({ state: 'visible' })
      const actualHeading = (await publicHeading.innerText()).replace(/\\s+/g, ' ').trim()
      assert.ok(actualHeading.includes(expectedHeading), `${name}: ${route} heading was "${actualHeading}"`)
      await assertNoHorizontalOverflow(page, `${name} ${route}`)
      await page.screenshot({
        path: `${artifactDir}/${name}-public-${route.split('/').filter(Boolean).join('-')}.png`,
        fullPage: true,
        animations: 'disabled',
      })
    }

    assert.deepEqual(pageErrors, [], `${name}: browser runtime errors detected: ${pageErrors.join('; ')}`)
    console.log(`PASS ${name} (${width}x${height}): welcome, mobile navigation, owner login and owner setup`)
  } finally {
    await context.close()
  }
}

try {
  await waitForPreview()
  browser = await chromium.launch({ headless: true, channel: 'chrome' })
  for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
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
