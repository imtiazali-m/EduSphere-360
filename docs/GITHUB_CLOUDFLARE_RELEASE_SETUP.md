# GitHub-hosted build and Cloudflare Pages release

This project now includes `.github/workflows/cloudflare-pages-release.yml`. It moves the clean install/build step to a GitHub-hosted runner, avoiding dependence on the local workstation's npm DNS/cache state.

## Configure repository variables

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

The Vite publishable key is embedded into browser assets by design. Do not put a service-role/secret key in this variable.

## Configure repository secrets for production deployment

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Create a protected GitHub Environment named `production` and add required reviewers before allowing production deployment.

## What the workflow does

- Pull-request events run verification, focused tests and a clean Vite build; no Cloudflare preview is published.
- A successful build publishes a `dist` artifact and `gidcbadin-cloudflare-direct-upload` ZIP artifact. The ZIP has `index.html`, `_redirects` and `assets/` at its root.
- Merging the reviewed release to `main` triggers production deployment after the verification job succeeds. A manual `workflow_dispatch` with `deploy_production=true` remains available for a deliberate redeploy.

The production job deploys the already-built `dist` folder using Wrangler Pages. It does not rebuild with different environment values and it does not apply Supabase migrations.

## Important Cloudflare project note

This workflow creates the separate `gidcbadin` Cloudflare Pages project if it does not yet exist, then deploys the college website there. The previous `edusphere360` project is not deleted or overwritten. The new production Pages address will be `https://gidcbadin.pages.dev`. Connect the future college-owned `.edu.pk` domain through Pages > Custom domains after PKNIC registration, activation and DNS delegation. The release workflow does not register or activate domains. Cloudflare documents Direct Upload CI using Wrangler and the required GitHub secrets here:
https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/
