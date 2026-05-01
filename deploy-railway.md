# Railway Deployment (Backend + Public URL)

This deploys the production backend and returns a public URL for the app.

## 1) Prepare code

- Ensure backend folder is ready:
  - `mood_guardian_prod/backend`
- Required files already included:
  - `Dockerfile`
  - `package.json`
  - `src/*`

## 2) Create Railway project

1. Open [Railway](https://railway.app/)
2. Create a new project
3. Add **PostgreSQL** service
4. Add a **service from GitHub repo** (select this repository)
5. Set root directory to: `mood_guardian_prod/backend`

## 3) Configure environment variables

In the backend service variables, set:

- `NODE_ENV=production`
- `PORT=8787`
- `DATABASE_URL=${{Postgres.DATABASE_URL}}` (select from Railway variable picker)
- `JWT_SECRET=<your-strong-secret>`
- `ACCESS_TOKEN_EXPIRES_IN=15m`
- `REFRESH_TOKEN_EXPIRES_IN_DAYS=30`
- `ADMIN_SECRET=<your-admin-secret>`

## 4) Expose public domain

1. Open backend service -> **Settings** -> **Networking**
2. Generate a public domain
3. Save the URL, e.g. `https://mood-guardian-api-production.up.railway.app`

## 5) Verify backend health

Open in browser:

- `<your-backend-url>/health`

Expected:

- `{ "ok": true, ... }`

## 6) Wire app to production backend

In mobile app `设置` page:

- 后端 API 地址: `<your-backend-url>`
- 管理员密钥: same value as `ADMIN_SECRET`

Then login/register from app and verify:

- check-in
- community post/comment/report
- admin review page