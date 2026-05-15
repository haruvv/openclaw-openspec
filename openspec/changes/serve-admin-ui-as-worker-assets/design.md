## Context

The production Worker currently forwards `/admin` and `/admin/*` to the RevenueAgent Container. The container runs Express and serves `dist/admin-ui` with `express.static`. As a result, every admin UI-only edit produces a new Vite asset hash that is not visible until the container image is rebuilt, pushed, and rolled out. GitHub Actions has repeatedly failed the production smoke check because Cloudflare was still serving an older container image that did not contain the new hashed asset.

Cloudflare Workers supports static asset deployment from a configured build output directory. The admin UI is a Vite SPA and does not need container runtime capabilities for static HTML/CSS/JS delivery. The container remains necessary for API routes, Chromium/Lighthouse execution, provider integrations, and durable storage bridge calls from server-side code.

## Goals / Non-Goals

**Goals:**

- Serve admin UI HTML/CSS/JS from Worker Static Assets.
- Keep `/api/admin/*`, revenue agent run endpoints, Telegram, Stripe, HIL, scheduled discovery, and storage-backed work on the existing Container path.
- Avoid waking the Container for admin UI page views and static asset requests.
- Keep local Express startup able to serve built admin UI for `npm run start` and local smoke/development flows.
- Make production smoke validate the Worker-served admin UI assets separately from Container-backed API routes.

**Non-Goals:**

- Replacing the Container runtime or moving Lighthouse/Chromium execution out of Containers.
- Changing admin authentication semantics.
- Moving the admin UI into a separate repository or a separate Cloudflare Pages project.
- Changing the Vite app routing model beyond what is needed for Worker asset fallback.

## Decisions

1. Use Worker Static Assets in the existing Worker project rather than Cloudflare Pages.

   Rationale: the current deployment already has one Worker that routes traffic and binds the Container, D1, R2, rate limits, and version metadata. Keeping the admin UI in the same Worker keeps URLs stable and avoids a second deployment target while still removing UI assets from the Container response path.

   Alternative considered: Cloudflare Pages. Pages would also solve static asset rollout, but would add a second hostname/project or routing integration. That is unnecessary for the current single-admin-console use case.

2. Let Worker asset fallback handle `/admin` SPA routes before Container forwarding.

   Rationale: `/admin`, `/admin/seo-sales`, and `/admin/seo-sales/settings` should return the SPA shell from Worker assets. `/admin/assets/*` should return immutable static files directly. `/api/admin/*` remains the authenticated JSON API and is forwarded to the Container.

   Alternative considered: serve only `/admin/assets/*` from Worker assets and keep HTML from Container. That would still make page shell rollout depend on the Container and would not fully solve UI-only deploy instability.

3. Keep Express static admin serving as a local fallback, but remove Worker routing to it in production.

   Rationale: `npm run start` and local debugging remain useful. Keeping Express admin routes does not hurt as long as production Worker routing no longer forwards normal `/admin` page traffic to the Container. The production Docker image should exclude admin UI assets so UI-only changes do not alter the Container image.

4. Keep production smoke strict about current admin asset hashes.

   Rationale: the smoke check should continue catching cases where the deployed Worker does not serve the newly built UI assets. After the asset path is detached from the Container, that check should stabilize and fail only when the Worker asset upload itself is broken.

## Risks / Trade-offs

- Worker asset fallback may bypass Express admin page authentication for static page shell requests. → Mitigation: static admin assets contain no secrets; API calls remain protected by `/api/admin/*` auth, and token handling remains client-side.
- Cloudflare Worker asset routing behavior differs between local and production. → Mitigation: keep local Express fallback and validate with build, tests, and production smoke.
- Direct Container `/admin` debugging no longer includes the admin UI bundle when the Docker image excludes static UI assets. → Mitigation: use the Worker route for production-like admin UI testing, or `npm run start` locally after `npm run build`.

## Migration Plan

1. Configure `wrangler.jsonc` to upload `dist-assets` as Worker static assets with the admin UI under `/admin`.
2. Update Worker fetch routing so admin UI page/static requests are served by Worker asset fallback, not Container forwarding.
3. Keep `/api/admin/*` and operational endpoints forwarded to the Container.
4. Update tests/smoke expectations as needed.
5. Deploy and verify `/admin/assets/<latest>.js` and `/api/admin/apps` separately.

Rollback: remove the Worker asset binding/config and restore `/admin` forwarding to the Container. The existing Express admin static serving remains in place to support rollback.
