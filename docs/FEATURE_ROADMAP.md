# MII Platform Feature Roadmap

## Version policy

MII uses semantic versioning:

- **Major** (`2.0.0`): breaking architecture or data-model changes.
- **Minor** (`1.2.0`): backward-compatible features and modules.
- **Patch** (`1.2.1`): bug fixes and small safe corrections.

The visible application version is read from `frontend/package.json`.

## Release plan

| Version | Status | Theme | Main scope |
|---|---|---|---|
| v1.0.0 | Released | Stable Baseline | Core modules, roles, S3 vessel photos, responsive UI |
| v1.1.0 | In Progress | Reporting & Versioning | Daily email, visible version, roadmap and changelog |
| v1.2.0 | Planned | Bulk Data Import | Customers, vessels and engines Excel import with dry run |
| v1.3.0 | Planned | Customer Account Foundation | Customer/PIC model, lead source, Administration master data |
| v1.4.0 | Planned | Customer Interactions | Timeline, notes, photos, next actions and follow-ups |
| v1.5.0 | Planned | Scheduling | Meetings, visits, reminders and visit-to-interaction conversion |
| v1.6.0 | Planned | Audit & Reporting | created_by/updated_by and user attribution in reports |

The detailed tracker is stored in `MII_Feature_Roadmap.xlsx`.
