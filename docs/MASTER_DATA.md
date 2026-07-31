# MII v1.2.0 — Administration Master Data

## Managed dropdowns

- Customers: Source
- Vessels: Boat Builder, Material, Type
- Engines: Brand, Type, Fuel

## Rules

- Administration is restricted to admins.
- Values may be added, renamed, reordered, activated, and deactivated.
- Values are never permanently deleted through the UI.
- Duplicate values are blocked case-insensitively.
- Inactive values disappear from new-entry dropdowns.
- Existing operational records keep their stored historical value.

## Database changes

- Adds `master_data_categories`
- Adds `master_data_values`
- Adds `customers.lead_source`
- Adds `engines.engine_type`
- Imports existing distinct builder, material, vessel type, engine brand, and fuel values.

## Development process

Install only from clean, tagged `v1.1.1`.
The installer creates `feature/v1.2.0-master-data`.
Do not merge to `main` until local review and testing are complete.
