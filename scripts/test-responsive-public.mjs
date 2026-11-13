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
const server = spawn(npmCommand, ['run','preview','--','--host',host,'--port',String(port),'--strictPort'], {
  stdio:'ignore', shell:process.platform==='win32',
})
let browser

async function waitForPreview() {
  const deadline=Date.now()+30_000
  let lastError
  while(Date.now()<deadline){
    try{const response=await fetch(baseUrl);if(response.ok)return;lastError=new Error(`Preview returned HTTP ${response.status}`)}
    catch(error){lastError=error}
    await new Promise(resolve=>setTimeout(resolve,300))
  }
  throw new Error(`Vite preview did not become ready: ${String(lastError)}`)
}
async function assertNoHorizontalOverflow(page,label){
  const size=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}))
  assert.ok(size.document<=size.viewport+1&&size.body<=size.viewport+1,`${label}: horizontal overflow (viewport=${size.viewport}, document=${size.document}, body=${size.body})`)
}
async function inspectViewport({name,width,height}){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:width<=430,hasTouch:width<=768})
  const page=await context.newPage()
  const pageErrors=[]
  page.on('pageerror',error=>pageErrors.push(error.message))
  try{
    const response=await page.goto(`${baseUrl}/#/`,{waitUntil:'domcontentloaded'})
    assert.equal(response?.status(),200,`${name}: college homepage did not return HTTP 200`)
    await page.locator('.gidc-site').waitFor({state:'visible'})
    await page.locator('.gidc-hero h1').waitFor({state:'visible'})
    const title=(await page.locator('.gidc-brand-copy').first().innerText()).replace(/\\s+/g,' ').trim()
    assert.match(title,/Government Islamia.*Degree College Badin/i,`${name}: college identity is missing`)
    const headline=(await page.locator('.gidc-hero h1').innerText()).replace(/\\s+/g,' ').trim()
    assert.match(headline,/Knowledge opens doors.*Education builds futures/i,`${name}: college homepage headline is missing`)
    for(const id of ['about','programmes','admissions','campus-life','notices','portals','official-links','contact']){
      assert.equal(await page.locator('#'+id).count(),1,`${name}: missing college section #${id}`)
    }
    assert.ok(await page.locator('.gidc-image-disclaimer').innerText().then(value=>/representative education imagery/i.test(value)),`${name}: stock-photo disclosure is missing`)
    assert.equal(await page.locator('.gidc-portal-card').count(),6,`${name}: role-specific portal entry points are missing`)
    assert.equal(await page.locator('.gidc-link-grid > a').count(),3,`${name}: official education-resource links are missing`)
    await assertNoHorizontalOverflow(page,`${name} college homepage`)
    await mkdir(artifactDir,{recursive:true})
    await page.screenshot({path:`${artifactDir}/${name}-college-home.png`,fullPage:true,animations:'disabled'})

    if(width<=900){
      const menu=page.locator('.gidc-menu-toggle')
      await menu.waitFor({state:'visible'})
      await menu.click()
      await page.locator('.gidc-nav.is-open').waitFor({state:'visible'})
      await page.locator('.gidc-nav.is-open a[href="#admissions"]').click()
      await page.waitForFunction(()=>location.hash==='#admissions')
      await assertNoHorizontalOverflow(page,`${name} mobile college navigation`)
      await page.goto(`${baseUrl}/#/`,{waitUntil:'domcontentloaded'})
    }else{
      await page.locator('.gidc-nav a[href="#programmes"]').first().waitFor({state:'visible'})
    }

    await page.locator('.gidc-portal-button').click()
    await page.locator('.gidc-portal-modal').waitFor({state:'visible'})
    assert.equal(await page.locator('.gidc-modal-links button').count(),6,`${name}: portal selector should show six authorised account types`)
    await page.locator('.gidc-modal-links button').filter({hasText:'Student portal'}).click()
    await page.waitForFunction(()=>location.hash==='#/login/student')
    await page.locator('.es-auth-page').waitFor({state:'visible'})
    await page.locator('.es-auth-form').first().waitFor({state:'visible'})
    await assertNoHorizontalOverflow(page,`${name} student login`)

    const loginCases=[
      ['owner','Management'],['admin','Management'],['teacher','Faculty / Staff'],
      ['accountant','Faculty / Staff'],['exam_officer','Faculty / Staff'],
      ['student','Student'],['parent','Parent'],
    ]
    for(const [role,category] of loginCases){
      await page.goto(`${baseUrl}/#/login/${role}`,{waitUntil:'domcontentloaded'})
      await page.locator('.es-auth-page').waitFor({state:'visible'})
      await page.locator('.es-auth-form').first().waitFor({state:'visible'})
      const selected=page.locator('.es-account-type button[aria-pressed="true"] b')
      await page.waitForFunction(expected =>document.querySelector('.es-account-type button[aria-pressed="true"] b')?.textContent?.trim()===expected,category)
      assert.equal((await selected.innerText()).trim(),category,`${name}: ${role} account category does not match its role`)
      await assertNoHorizontalOverflow(page,`${name} ${role} login`)
      await page.screenshot({path:`${artifactDir}/${name}-${role}-login.png`,fullPage:true,animations:'disabled'})
    }

    await page.goto(`${baseUrl}/#/login/owner`,{waitUntil:'domcontentloaded'})
    await page.locator('.es-auth-page').waitFor({state:'visible'})
    await page.getByRole('button',{name:'Forgot your password?'}).click()
    await page.getByRole('heading',{name:'Reset your password'}).waitFor({state:'visible'})
    await page.getByRole('button',{name:'Send password-reset link'}).waitFor({state:'visible'})
    await assertNoHorizontalOverflow(page,`${name} password-reset view`)

    await page.goto(`${baseUrl}/#/setup`,{waitUntil:'domcontentloaded'})
    await page.locator('.es-auth-page').waitFor({state:'visible'})
    assert.equal(await page.locator('.es-signup-form').count(),0,`${name}: the single-college portal must not expose public creation of a separate institution`)
    await page.getByRole('heading',{name:'Welcome back'}).waitFor({state:'visible'})

    const publicRoutes=[
      ['/public/about','OUR COLLEGE'],
      ['/public/features','ACADEMIC PATHWAYS'],
      ['/public/features/invoices-payments','ACADEMIC PATHWAYS'],
      ['/public/solutions','SECURE COLLEGE ACCESS'],
      ['/public/analytics','NOTICE BOARD'],
      ['/public/support','GET IN TOUCH'],
    ]
    for(const [route,expected] of publicRoutes){
      await page.goto(`${baseUrl}/#${route}`,{waitUntil:'domcontentloaded'})
      await page.locator('.gidc-site').waitFor({state:'visible'})
      assert.ok(await page.getByText(expected,{exact:false}).count()>0,`${name}: ${route} did not render a college page`)
      await assertNoHorizontalOverflow(page,`${name} ${route}`)
    }
    assert.deepEqual(pageErrors,[],`${name}: uncaught browser errors: ${pageErrors.join('; ')}`)
    console.log(`PASS ${name} (${width}x${height}): college homepage, mobile navigation, portal routes, login categories, reset route and responsive overflow`)
  } finally {
    await context.close()
  }
}

try{
  await waitForPreview()
  browser=await chromium.launch({headless:true,args:['--no-sandbox']})
  for(const viewport of [
    {name:'desktop',width:1440,height:1000},
    {name:'small-desktop',width:1024,height:900},
    {name:'tablet',width:768,height:1024},
    {name:'mobile',width:390,height:844},
    {name:'small-mobile',width:360,height:800},
  ]) await inspectViewport(viewport)
  console.log('Government Islamia Degree College Badin responsive browser checks passed.')
} finally{
  if(browser)await browser.close()
  server.kill('SIGTERM')
}
