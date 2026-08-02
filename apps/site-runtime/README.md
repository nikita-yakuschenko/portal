# @b2b/site-runtime

Публичные сайты партнёров собираются из `@b2b/portal-web` с `APP_ROLE=site`
(Host → `/api/public/sites/resolve`, те же страницы витрины).

Локально:

```powershell
npm run dev:api
npm run dev:site
```

Прод: см. [`DEPLOY.md`](../../DEPLOY.md) и [`apps/site-runtime/Dockerfile`](./Dockerfile).
