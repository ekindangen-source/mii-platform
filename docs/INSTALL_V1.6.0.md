# MII Platform v1.6.0 Installation

This package is an overlay for a clean MII Platform v1.5.5 checkout. Extract it
over the repository root so the `backend`, `frontend`, `docs`, and `VERSION`
paths merge with the existing project.

## Windows development checkout

```powershell
cd C:\Projects\mii-platform
git pull --ff-only origin main
git switch -c feature/v1.6.0-sales-crm

# Extract MII-v1.6.0-crm-update.zip over this directory.

node --check backend/routes/opportunities.js
node --check backend/scripts/verify-sales-opportunities.js
node --check backend/server.js

cd frontend
npm.cmd ci
$env:VITE_API_BASE_URL="/api"
npm.cmd run build
Remove-Item Env:VITE_API_BASE_URL
cd ..

git diff --check
git status --short
```

## Test server and database

```bash
cd ~/mii-v150-test
git fetch origin
git switch --track origin/feature/v1.6.0-sales-crm

cd backend
grep -E '^(DB_NAME|DAILY_SUMMARY_ENABLED|SCHEDULE_REMINDER_ENABLED)=' .env
node scripts/run-sql-file.js sql/019_sales_opportunities.sql
node scripts/verify-sales-opportunities.js

cd ../frontend
npm ci
VITE_API_BASE_URL=/api npm run build
```

Confirm the test environment uses `mii_crm_test` and keeps both email schedulers
disabled before starting the test API. Test customer portfolio visibility,
opportunity creation/editing, Pipeline filters, win/loss transitions, and the CRM
Dashboard before merging.

## Production release

After testing, merge the feature branch into `main`, build, tag `v1.6.0`, and
push. On production, pull `main`, run `sql/019_sales_opportunities.sql` once,
run `verify-sales-opportunities.js`, build the frontend with `/api`, publish the
`dist` directory using the existing deployment procedure, restart `mii-api`, and
verify both local and Nginx health endpoints.
