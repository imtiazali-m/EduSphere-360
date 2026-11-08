# GitHub-hosted build and Cloudflare Pages release

This project now includes `.github/workflows/cloudflare-pages-release.yml`. It moves the clean install/build step to a GitHub-hosted runner, avoiding dependence on the local workstation's npm DNS/cache state.

## Configure repository variables

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `CLOUDFLARE_PAGES_PROJECT` (optional; defaults to `edusphere360`)
- `EDUSPHERE_PRODUCTION_BRANCH` (optional; defaults to `main`)

The Vite publishable key is embedded into browser assets by design. Do not put a service-role/secret key in this variable.

## Configure repository secrets for production deployment

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Create a protected GitHub Environment named `production` and add required reviewers before allowing production deployment.

## What the workflow does

- Push and pull-request events run verification, focused tests and a clean Vite build.
- A successful build publishes a `dist` artifact and `edusphere360-cloudflare-direct-upload` ZIP artifact. The ZIP has `index.html`, `_redirects` and `assets/` at its root.
- Production deployment is not automatic. Start the workflow manually from the configured production branch and set `deploy_production` to `true` only after reviewing the run.

The production job deploys the already-built `dist` folder using Wrangler Pages. It does not rebuild with different environment values and it does not apply Supabase migrations.

## Important Cloudflare project note

This workflow targets an existing Cloudflare Pages Direct Upload project. If the project is already configured with Cloudflare's Git integration, check its branch-control/build settings before using Wrangler deployment; do not change deployment modes casually. Cloudflare documents Direct Upload CI using Wrangler and the required GitHub secrets here:
https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/
