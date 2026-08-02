# MII Platform Feature Roadmap

## Version policy

MII uses semantic versioning:

- **Major** (`2.0.0`): breaking architecture or data-model changes.
- **Minor** (`1.3.0`): backward-compatible features and modules.
- **Patch** (`1.2.2`): bug fixes and small backward-compatible enhancements.

The visible application version is read from `frontend/package.json`.

## Release plan

| Version | Status | Theme | Main scope |
|---|---|---|---|
| v1.0.0 | Released | Stable Baseline | Core modules, roles, S3 vessel photos, responsive UI |
| v1.1.x | Released | Reporting & User Access | Daily email, visible version, roadmap, and secure invitations |
| v1.2.0 | Released | Administration Master Data | Centralized dropdown lists for Customers, Vessels, and Engines |
| v1.2.1 | Released | Customer Detail | Customer Source visible in popup and simplified sidebar version |
| v1.2.2 | Released | Customer Attribution | Capture customer creator and group new customers by user in daily email |
| v1.3.0 | Released | Customer Account Foundation | Organization/individual accounts and multiple PIC/contact records |
| v1.4.0 | Released | Customer Interactions | Timeline, meeting notes, photos, next actions, and follow-ups |
| v1.4.1 | In Progress | Daily Interaction Activity | Customer interactions grouped by user in the daily email |
| v1.5.0 | Planned | Meeting & Visit Scheduling | Meetings, visits, reminders, and visit-to-interaction conversion |
| v1.6.0 | Planned | Contact Cadence | Last-contact tracking and prioritized user reminder emails |
| v1.7.0 | Planned | Full Audit Attribution | `created_by` and `updated_by` for all operational modules |
| v1.8.0 | Planned — Last Priority | Bulk Data Import | Validated customer, vessel, and engine import with dry run |

Bulk data import is intentionally placed last in the current implementation plan.
