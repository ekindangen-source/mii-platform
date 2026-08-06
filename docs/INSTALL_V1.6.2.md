# MII Platform v1.6.2 Installation

## Scope

v1.6.2 enforces the Lead-to-Customer lifecycle. Normal Customer creation is disabled. A qualified Lead becomes a Customer only when a sale is explicitly confirmed; the conversion creates a Won Opportunity, primary PIC, ownership history, and traceable Lead origin in one transaction.

## Staging or production

From the selected checkout:

```bash
cd backend
node scripts/run-sql-file.js sql/021_customer_lead_origin.sql
node scripts/verify-customer-lead-origin.js

cd ../frontend
npm ci
VITE_API_BASE_URL=/api npm run build
```

Publish the generated `frontend/dist` directory using the existing deployment procedure, then restart the API:

```bash
sudo systemctl restart mii-api
curl -i http://127.0.0.1:3000/health
curl -i https://crm.blueoceanforever.com/api/health
```

## Smoke test

1. Confirm the Customers page has no Add Customer button.
2. Confirm direct `POST /api/customers` returns HTTP 409.
3. Create a Lead and move it to Qualified.
4. Confirm the sale from the Lead action.
5. Confirm one Customer, one primary PIC, one ownership-history row, and one Won Opportunity are created.
6. Confirm the Lead is Converted and linked to the resulting Customer and Opportunity.
