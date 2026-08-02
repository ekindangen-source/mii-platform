# Daily Customer Interaction Activity — v1.4.1

The MII daily activity email includes customer interactions grouped by the application user who logged each interaction.

## Date selection

Interactions are selected using `customer_interactions.interaction_at` within the configured report calendar day and timezone. The default timezone remains `Asia/Jakarta`.

This means an interaction is reported according to when the customer contact occurred, rather than only when the record was entered.

## Email content

- Interaction count in the top summary.
- Customer Interactions by User count table.
- A detailed interaction table for each user.
- Interaction time and type.
- Customer and linked PIC.
- Participants and notes.
- Next action and follow-up date.
- Interactions without a resolvable creator display as `Legacy / Unknown`.

## Database

No database migration is required. The release uses the `customer_interactions.created_by` relationship introduced in v1.4.0.

## Verification

From the backend directory:

```bash
node scripts/verify-daily-interaction-summary.js --date=YYYY-MM-DD
```

To send a manual test email for the same date:

```bash
node scripts/test-daily-summary-email.js --date=YYYY-MM-DD
```
