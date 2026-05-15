## 1. Worker Asset Routing

- [x] 1.1 Configure Wrangler to publish the built admin UI under `/admin` from a frontend-only asset directory.
- [x] 1.2 Update Worker routing so `/admin` and `/admin/*` can be served by Worker assets instead of forwarding to the Container.
- [x] 1.3 Preserve Container forwarding for `/api/admin/*` and operational endpoints.

## 2. Runtime Cleanup

- [x] 2.1 Keep Express admin static serving available for local fallback without making it the production Worker path.
- [x] 2.2 Remove admin UI static files from the Container image so UI-only changes do not change Container image contents.

## 3. Verification

- [x] 3.1 Add or update tests covering Worker admin asset routing and Container-backed API routing.
- [x] 3.2 Run lint, tests, build, and production smoke.
- [x] 3.3 Deploy and confirm the latest admin UI asset is served without Container rollout delay.
