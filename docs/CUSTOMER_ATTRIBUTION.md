# MII v1.2.2 — Customer Attribution

## Purpose

Record which authenticated MII user creates each customer and show that attribution in the daily activity email.

## Behavior

- `customers.created_by` is populated from `req.user.userId`.
- The frontend cannot submit or override the creator.
- Existing customers remain valid with `created_by = NULL`.
- Daily email groups new customers by user and includes a Created By column.
- Older unattributed records display as `Legacy / Unknown`.
- This release attributes Customers only; full operational audit attribution is planned later.

## Migration

Apply `backend/sql/013_customer_created_by.sql`. The migration is additive and rerunnable.
