import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')
const edge = read('supabase/functions/ai-assistant/index.ts')
const integration = read('src/components/IntegrationManagementWorkspace.tsx')
const workspace = read('src/components/AIAssistantWorkspace.tsx')
const pkg = JSON.parse(read('package.json'))
const configGuide = read('docs/FREE_AI_SETUP.md')

const check = (label, fn) => {
  try { fn(); console.log('PASS  ' + label) }
  catch (error) { console.error('FAIL  ' + label + ': ' + error.message); process.exitCode = 1 }
}

check('Cloudflare Workers AI uses the official account-scoped REST API', () => {
  assert.ok(edge.includes('CLOUDFLARE_ACCOUNT_ID'))
  assert.ok(edge.includes('CLOUDFLARE_AI_API_TOKEN'))
  assert.ok(edge.includes('https://api.cloudflare.com/client/v4/accounts/'))
  assert.ok(edge.includes('/ai/run/"+model'))
  assert.ok(edge.includes('messages:[{role:"system",content:system},...history]'))
  assert.ok(edge.includes('data?.result?.response'))
})

check('Automatic mode is free-only and never falls back to paid providers', () => {
  assert.ok(edge.includes('provider="cloudflare"'))
  assert.ok(edge.includes('Automatic mode will not switch to a paid AI provider.'))
  assert.ok(workspace.includes("provider==='auto'?'cloudflare':provider"))
  assert.ok(workspace.includes('Automatic · Cloudflare free quota only'))
  assert.ok(workspace.includes("provider==='auto'&&!providerStatus.cloudflare?.configured"))
  assert.ok(!workspace.includes('OPENAI_API_KEY'))
  assert.ok(!workspace.includes('CLOUDFLARE_AI_API_TOKEN'))
})

check('The no-cost provider and approved model appear in both workspaces', () => {
  assert.ok(integration.includes("key:'cloudflare'"))
  assert.ok(integration.includes("@cf/zai-org/glm-4.7-flash"))
  assert.ok(workspace.includes("key:'cloudflare'"))
  assert.ok(workspace.includes("@cf/zai-org/glm-4.7-flash"))
  assert.ok(edge.includes('cloudflare:"@cf/zai-org/glm-4.7-flash"'))
  assert.ok(edge.includes('provider==="cloudflare"?defaultModels.cloudflare'))
  assert.ok(workspace.includes("selectedProvider!=='cloudflare'"))
})

check('Credential presence requires both account ID and API token', () => {
  assert.ok(edge.includes('providers.cloudflare={configured:Boolean(Deno.env.get("CLOUDFLARE_AI_API_TOKEN")?.trim()&&Deno.env.get("CLOUDFLARE_ACCOUNT_ID")?.trim())}'))
  assert.ok(integration.includes('CLOUDFLARE_AI_API_TOKEN + CLOUDFLARE_ACCOUNT_ID'))
})

check('AI free-tier limits and safe setup are documented', () => {
  assert.ok(configGuide.includes('10,000 Neurons per day'))
  assert.ok(configGuide.includes('Workers Free'))
  assert.ok(configGuide.includes('CLOUDFLARE_ACCOUNT_ID'))
  assert.ok(configGuide.includes('CLOUDFLARE_AI_API_TOKEN'))
  assert.ok(configGuide.includes('switch to a paid provider'))
  assert.ok(pkg.scripts['test:ai-free-provider'] === 'node scripts/test-ai-free-provider.mjs')
})

if (process.exitCode) process.exit(process.exitCode)
