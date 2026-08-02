# MII Platform Changelog

## [1.2.2] — In Progress

### Added
- Customer records now capture the authenticated user who created them.
- Daily activity email groups new customers by user.
- Daily customer rows show Source and Created By.
- Existing customers without attribution display as `Legacy / Unknown`.

### Database
- Added nullable `customers.created_by` linked to `app_users.user_id`.

## [1.2.1] — In Progress

### Fixed
- Customer Source is now visible in the customer detail popup.

## [1.2.0] — In Progress

### Added
- Administration Master Data page for centrally managed dropdown values.
- Customer Source dropdown.
- Vessel Boat Builder, Material, and Type dropdowns.
- Engine Brand, Type, and Fuel dropdowns.
- Active/inactive and sort-order controls for master-data values.

### Database
- Added `master_data_categories` and `master_data_values`.
- Added `customers.lead_source`.
- Added `engines.engine_type`.
- Existing operational values are imported into master data during migration.

## [1.1.0] — In Progress

### Added
- Daily end-of-day email summarizing new customers, vessels, engines, trips and maintenance.
- Visible app version on the login page and left navigation.
- Feature roadmap, changelog and release process.
- Release tracking workbook.

### Configuration
- Google Workspace SMTP sender and recipient: `erwin@ptkba.com`.
- Daily report default schedule: 18:00 Asia/Jakarta.

## [1.0.0] — 2026-07-26

### Stable baseline
- Authentication and role-based access.
- Customers, vessels, engines, trips and maintenance modules.
- Search, sorting, pagination and record detail dialogs.
- User and role administration.
- Vessel photos stored privately in S3 with signed access.
- Browser-side vessel photo compression.
- Production deployment and health-check workflow.
