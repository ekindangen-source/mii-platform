# Customer Accounts and PICs — v1.3.0

## Purpose

v1.3.0 separates the customer account from the people who represent that customer.

A customer can be an **Organization** or an **Individual**. Both account types use the same contact model, so future interactions, meetings, reminders, and follow-ups can link to a specific PIC.

## Contact fields

- Generated contact reference (`PIC-000001`)
- Full name
- Job title / role
- Telephone
- Email
- Primary contact flag
- Active/inactive status
- Notes
- Created and updated user/time

## Business rules

- A customer may have multiple contacts.
- At most one contact can be primary.
- The first active contact automatically becomes primary.
- Setting a new primary contact removes the primary flag from the previous contact.
- Deactivating the primary contact automatically promotes another active contact when available.
- Contacts are deactivated rather than permanently deleted.
- Deleting the customer account cascades to its contacts.
- Existing customer contact fields are migrated to one primary contact when any contact information exists.

## Compatibility

The old customer contact columns remain in the database as a read-only fallback. The v1.3.0 user interface manages all new PIC information in `customer_contacts`.
