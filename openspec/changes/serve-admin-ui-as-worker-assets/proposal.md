## Why

Admin UI changes currently require rebuilding and rolling out the RevenueAgent Container because Vite assets are copied into the container image and served by Express. This makes simple UI edits slow, increases unnecessary container build/runtime work, and causes production smoke failures while Cloudflare is still serving an older container image.

## What Changes

- Serve the built admin UI static assets from the Cloudflare Worker asset layer instead of the RevenueAgent Container.
- Keep admin API routes and expensive runtime work on the Container.
- Route `/admin` and `/admin/*` through Worker asset fallback while forwarding `/api/admin/*` to the Container.
- Keep local Express development able to serve the built admin UI for non-Cloudflare runs.
- Update production smoke validation so it verifies Worker-served admin assets and still checks the Container-backed API auth boundary.

## Capabilities

### New Capabilities

- `admin-ui-static-assets`: Defines how the admin UI static frontend is deployed and served independently from the runtime container.

### Modified Capabilities

- `revenue-agent-platform-deployment`: Production deployment must separate static admin UI delivery from Container-backed API and analysis execution.

## Impact

- Affected config: `wrangler.jsonc`, deployment workflow, production smoke script.
- Affected routing: `worker/revenue-agent-container.ts`, Express admin route mounting.
- Affected build/deploy behavior: admin UI assets are uploaded with the Worker asset bundle and no longer require a new Container image to become visible.
- Affected cost/reliability: admin UI page views no longer wake the Container, and UI-only changes avoid Container rollout dependency.
