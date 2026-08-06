# MII Platform v1.6.1 Installation

Extract the update ZIP over a clean v1.6.0 repository checkout.

## Windows development

```powershell
cd C:\Projects\mii-platform
git switch main
git pull --ff-only origin main
git switch -c feature/v1.6.1-leads-installed-base

# Extract MII-v1.6.1-leads-update.zip over this directory.

node --check backend/routes/leads.js
node --check backend/routes/opportunities.js
node --check backend/scripts/verify-leads-installed-base.js
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

## Isolated test database

Confirm `DB_NAME=mii_crm_test` and both email schedulers are disabled. Then run:

```bash
cd ~/mii-v150-test/backend
node scripts/run-sql-file.js sql/020_leads_installed_base_opportunities.sql
node scripts/verify-leads-installed-base.js
```

Test lead CRUD and permissions, qualified-only conversion, duplicate conversion
protection, optional Opportunity creation, and customer vessel/engine selection
before merging.

## Production

After merging and tagging v1.6.1, pull `main`, confirm the production database,
run migration `020`, run the verifier, build with `VITE_API_BASE_URL=/api`,
publish the frontend using the established backup procedure, restart `mii-api`,
and verify local and public health endpoints.
