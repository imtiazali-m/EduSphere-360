# Zero-cost AI setup for EduSphere 360

EduSphere's automatic AI mode now uses Cloudflare Workers AI only. It does **not** fall back to OpenAI, Gemini, Anthropic or any other provider that may have usage charges. Other providers can still be selected manually, but their billing is separate.

## Free allowance

Cloudflare Workers AI includes 10,000 Neurons per day on the Workers Free plan. The allowance resets at 00:00 UTC. When the Free-plan daily allowance is exhausted, requests stop until the allowance resets; the app does not upgrade the Cloudflare plan or switch to a paid provider.

The default model is `@cf/zai-org/glm-4.7-flash`. Cloudflare lists it as a hosted text-generation model and marks it Zero Data Retention. Do not send student/employee direct identifiers or confidential documents unless the institution has approved the data handling.

## One-time Cloudflare setup

1. Open Cloudflare Dashboard → Workers AI.
2. Choose **Use REST API** and create a Workers AI API token using the Cloudflare-provided template. Do not create a Global API Key.
3. Copy the Cloudflare Account ID shown on the Workers AI page.
4. Keep the Cloudflare account on the **Workers Free** plan. Do not upgrade or enable pay-as-you-go for this free-only setup.

## Add the two server-side secrets

In the Supabase development project, open **Edge Functions → Secrets** and add:

- `CLOUDFLARE_ACCOUNT_ID` — the account ID copied from Cloudflare.
- `CLOUDFLARE_AI_API_TOKEN` — the Workers AI API token.

Do not add either value to Vite environment variables, browser storage, SQL tables, GitHub files or this chat. They must remain server-side.

## Test in EduSphere

Open **Integrations & Devices → AI Provider Connections**, refresh status, then test **Cloudflare Workers AI · Free quota**. When both server secrets are present and the provider test succeeds, the AI Assistant's **Automatic · Cloudflare free quota only** option will use it.

If the free quota is reached or Cloudflare rejects a request, EduSphere shows an error. It does not retry through a paid provider. You can wait for the daily reset or stop using AI for the day.

## Official references

- Cloudflare Free-plan Workers AI quota: https://developers.cloudflare.com/workers-ai/platform/pricing/
- Cloudflare Workers AI REST API setup: https://developers.cloudflare.com/workers-ai/get-started/rest-api/
- Default model and REST API request: https://developers.cloudflare.com/workers-ai/models/glm-4.7-flash/
