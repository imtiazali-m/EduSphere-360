import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH ?? 'playwright')
const host = '127.0.0.1'
const port = Number(process.env.EDUSPHERE_PREVIEW_PORT ?? 4173)
const baseUrl = `http://${host}:${port}`
const artifactDir = process.env.EDUSPHERE_SCREENSHOT_DIR ?? 'artifacts/responsive-public'
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const server = spawn(npmCommand, ['run','preview','--','--host',host,'--port',String(port),'--strictPort'], {
  stdio:'ignore', shell:process.platform==='win32',
})
let browser

async function waitForPreview() {
  const deadline=Date.now()+30_000
  let lastError
  while(Date.now()<deadline){
    try{
      const response=await fetch(baseUrl)
      if(response.ok)return
      lastError=new Error(`Preview returned HTTP ${response.status}`)
    }catch(error){lastError=error}
    await new Promise(resolve=>setTimeout(resolve,300))
  }
  throw new Error(`Vite preview did not become ready: ${String(lastError)}`)
}

async function assertNoHorizontalOverflow(page,label) {
  const size=await page.evaluate(()=>({
    viewport:document.documentElement.clientWidth,
    document:document.documentElement.scrollWidth,
    body:document.body.scrollWidth,
  }))
  assert.ok(
    size.document<=size.viewport+1 && size.body<=size.viewport+1,
    `${label}: horizontal overflow (viewport=${size.viewport}, document=${size.document}, body=${size.body})`,
  )
}

const publicPages = [
  ['home','Government Islamia Degree College Badin'],
  ['about','About Government Islamia Degree College Badin'],
  ['academics','Academic information'],
  ['principal','Principal'],
  ['faculty','Faculty directory'],
  ['departments','Faculty arrangement'],
  ['campus','Campus & facilities'],
  ['student-life','Student life'],
  ['events','Events & achievements'],
  ['content','News & announcements'],
  ['gallery','College gallery'],
  ['emagazine','E-magazine'],
  ['contact','Contact & location'],
]

async function inspectViewport({name,width,height}) {
  const context=await browser.newContext({
    viewport:{width,height},
    deviceScaleFactor:1,
    isMobile:width<=430,
    hasTouch:width<=768,
  })
  const page=await context.newPage()
  const pageErrors=[]
  page.on('pageerror',error=>pageErrors.push(error.message))
  try {
    const response=await page.goto(`${baseUrl}/#/`,{waitUntil:'domcontentloaded'})
    assert.equal(response?.status(),200,`${name}: public homepage did not return HTTP 200`)
    await page.locator('.gidc-public-site').waitFor({state:'visible'})
    await page.locator('.gidc-public-hero h1').waitFor({state:'visible'})

    const brand=(await page.locator('.gidc-public-brand').innerText()).replace(/\s+/g,' ').trim()
    assert.match(brand,/Government Islamia.*Degree College Badin/i,`${name}: college identity is missing`)
    assert.equal(
      await page.locator('.gidc-public-brand img').getAttribute('src'),
      '/gidc-badin-official-logo.svg',
      `${name}: official college crest is missing from the header`,
    )
    const headline=(await page.locator('.gidc-public-hero h1').innerText()).replace(/\s+/g,' ').trim()
    assert.match(headline,/Government Islamia Degree College Badin/i,`${name}: homepage heading is missing`)

    for(const [id] of publicPages) {
      assert.equal(
        await page.locator(`.gidc-public-nav a[href="#/public/${id}"]`).count(),
        1,
        `${name}: navigation link for ${id} is missing`,
      )
    }
    assert.equal(await page.locator('.gidc-public-footer-links a').count(),publicPages.length,
      `${name}: footer does not include all dedicated public pages`)
    await assertNoHorizontalOverflow(page,`${name} homepage`)
    await mkdir(artifactDir,{recursive:true})
    await page.screenshot({path:`${artifactDir}/${name}-college-home.png`,fullPage:true,animations:'disabled'})

    if(width<=960) {
      const menu=page.locator('.gidc-public-menu-toggle')
      await menu.waitFor({state:'visible'})
      await menu.click()
      await page.locator('.gidc-public-nav.is-open').waitFor({state:'visible'})
      await page.locator('.gidc-public-nav.is-open a[href="#/public/events"]').click()
      await page.waitForFunction(()=>location.hash==='#/public/events')
      await assertNoHorizontalOverflow(page,`${name} mobile navigation`)
    } else {
      await page.locator('.gidc-public-nav a[href="#/public/events"]').waitFor({state:'visible'})
    }

    for(const [id,expectedTitle] of publicPages.filter(([id])=>id!=='home')) {
      await page.goto(`${baseUrl}/#/public/${id}`,{waitUntil:'domcontentloaded'})
      await page.locator('.gidc-public-site').waitFor({state:'visible'})
      await page.locator('.gidc-public-page').waitFor({state:'visible'})
      const title=(await page.locator('.gidc-public-page-hero h1').innerText()).replace(/\s+/g,' ').trim()
      assert.equal(title,expectedTitle,`${name}: incorrect heading on /public/${id}`)
      await assertNoHorizontalOverflow(page,`${name} /public/${id}`)
      if(id==='events') {
        assert.ok(await page.locator('.gidc-photo-card').count()>=1,
          `${name}: the approved student-guidance photograph is not included in the Events page`)
        assert.ok(await page.locator('img[src="/gidc-badin/events/student-guidance-session-event-05.webp"]').count()===1,
          `${name}: the fifth approved image is not assigned to Events`)
      }
      await page.screenshot({path:`${artifactDir}/${name}-${id}.png`,fullPage:true,animations:'disabled'})
    }

    const imageResponse=await page.request.get(`${baseUrl}/gidc-badin/events/student-guidance-session-event-05.webp`)
    assert.equal(imageResponse.status(),200,`${name}: the approved Events image asset is unavailable`)
    assert.match(imageResponse.headers()['content-type']??'',/image\/webp/i,`${name}: the Events image asset is not served as WebP`)

    await page.locator('.gidc-public-login').click()
    await page.locator('.es-auth-page').waitFor({state:'visible'})
    await page.locator('.es-auth-form').first().waitFor({state:'visible'})
    await assertNoHorizontalOverflow(page,`${name} owner login`)

    const roleCases=[
      ['owner','Management'],
      ['admin','Management'],
      ['teacher','Faculty / Staff'],
      ['accountant','Faculty / Staff'],
      ['exam_officer','Faculty / Staff'],
      ['student','Student'],
      ['parent','Parent'],
    ]
    for(const [role,category] of roleCases) {
      await page.goto(`${baseUrl}/#/login/${role}`,{waitUntil:'domcontentloaded'})
      await page.locator('.es-auth-page').waitFor({state:'visible'})
      await page.locator('.es-auth-form').first().waitFor({state:'visible'})
      const selected=page.locator('.es-account-type button[aria-pressed="true"] b')
      await page.waitForFunction(expected=>
        document.querySelector('.es-account-type button[aria-pressed="true"] b')?.textContent?.trim()===expected,
        category,
      )
      assert.equal((await selected.innerText()).trim(),category,
        `${name}: ${role} login selected the wrong account category`)
      await assertNoHorizontalOverflow(page,`${name} ${role} login`)
      if(width<=430 && role==='student') {
        await page.screenshot({path:`${artifactDir}/${name}-student-login.png`,fullPage:true,animations:'disabled'})
      }
    }

    await page.goto(`${baseUrl}/#/login/owner`,{waitUntil:'domcontentloaded'})
    await page.locator('.es-auth-page').waitFor({state:'visible'})
    await page.getByRole('button',{name:'Forgot your password?'}).click()
    await page.getByRole('heading',{name:'Reset your password'}).waitFor({state:'visible'})
    await page.getByRole('button',{name:'Send password-reset link'}).waitFor({state:'visible'})
    await assertNoHorizontalOverflow(page,`${name} password-reset screen`)

    assert.deepEqual(pageErrors,[],`${name}: uncaught browser errors: ${pageErrors.join('; ')}`)
    console.log(`PASS ${name} (${width}x${height}): 13 public pages, Events image, mobile navigation, role-based login and responsive overflow`)
  } finally {
    await context.close()
  }
}

try {
  await waitForPreview()
  browser=await chromium.launch({
    headless:true,
    executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH??(process.platform==='linux'?'/usr/bin/google-chrome':undefined),
    args:['--no-sandbox'],
  })
  for(const viewport of [
    {name:'desktop',width:1440,height:1000},
    {name:'small-desktop',width:1024,height:900},
    {name:'tablet',width:768,height:1024},
    {name:'mobile',width:390,height:844},
    {name:'small-mobile',width:360,height:800},
  ]) await inspectViewport(viewport)
  console.log('Government Islamia Degree College Badin responsive browser checks passed.')
} finally {
  if(browser)await browser.close()
  server.kill('SIGTERM')
}
