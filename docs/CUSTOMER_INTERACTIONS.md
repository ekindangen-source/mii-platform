# Customer Interactions — v1.4.0

## Purpose

Customer Interactions provides one chronological history for calls, emails,
meetings, visits, WhatsApp conversations, and other customer activity. Each
entry is linked to a customer account and may also be linked to a specific PIC.

## Interaction fields

- Generated interaction reference (`INT-000001` and later)
- Customer account
- Optional PIC/contact
- Interaction type
- Interaction date and time
- Other participants
- Notes
- Next action
- Next action date
- Created by and updated by
- Created and updated timestamps

## Photos

- Each interaction can contain multiple JPG, PNG, or WebP photos.
- The browser compresses each selected photo to no more than 1 MB.
- Up to five new photos can be selected in one save operation.
- The backend allows up to ten stored photos per interaction.
- Photos are stored privately in the existing MII S3 bucket.
- The API returns short-lived signed URLs for viewing.
- Deleting an interaction also deletes its related S3 photos.

## Permissions

- All authenticated users with customer access can view interactions.
- Admin, Manager, and Sales users can add and edit interactions and photos.
- Admin and Manager users can delete an interaction.

## API routes

Base route:

`/customers/:customerId/interactions`

- `GET /` — list the customer timeline
- `POST /` — create an interaction
- `PUT /:interactionId` — update an interaction
- `DELETE /:interactionId` — delete an interaction
- `POST /:interactionId/photos` — upload one compressed photo
- `DELETE /:interactionId/photos/:photoId` — delete one photo

## Production API setting

Production frontend builds must use:

`VITE_API_BASE_URL=/api`

The shared API service also defaults to `/api` when no explicit value is set.
An alternate URL should only be used for an isolated parallel test.
