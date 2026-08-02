# MII Platform Changelog

## [1.4.0] — In Progress

### Added
- Customer interaction timeline linked to customer accounts and optional PICs.
- Interaction types for Call, Email, Meeting, Visit, WhatsApp, and Other.
- Interaction date/time, participants, notes, next action, and follow-up date.
- Multiple private S3 photos per interaction with browser-side compression.
- Creator and updater attribution for interaction history.

### Changed
- Customer action menu now includes an Interactions workspace.
- Frontend API configuration safely defaults to `/api` when `VITE_API_BASE_URL` is not explicitly set.

### Database
- Added `customer_interactions` with generated `INT-000000` references.
- Added `customer_interaction_photos` with generated `IPH-000000` references.
- Added indexes for chronological customer history and future follow-up queries.

## [1.3.0] — 2026-08-02

### Added
- Customer account type: Organization or Individual.
- Multiple contacts/PICs under each customer account.
- Add, edit, activate, deactivate, and set-primary contact actions.
- Primary contact summary in the customer list and customer detail popup.
- Contact creator/updater attribution for future audit use.

### Changed
- Customer account details are separated from PIC/contact details.
- New customer contact information is maintained in the Contacts / PICs dialog.
- Existing single-contact customer fields are retained as a backward-compatible fallback.

### Database
- Added `customers.account_type`.
- Added `customer_contacts` with generated `PIC-000000` references.
- Existing customer contact fields are migrated into one primary contact when present.
- Enforced no more than one primary contact per customer.

## [1.2.2] — 2026-08-02

### Added
- Customer records now capture the authenticated user who created them.
- Daily activity email groups new customers by user.
- Daily customer rows show Source and Created By.
- Existing customers without attribution display as `Legacy / Unknown`.

### Database
- Added nullable `customers.created_by` linked to `app_users.user_id`.

## [1.2.1] — 2026-08-02

### Fixed
- Customer Source is now visible in the customer detail popup.

## [1.2.0] — 2026-08-02

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
