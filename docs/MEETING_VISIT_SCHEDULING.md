# Meeting & Visit Scheduling

MII Platform v1.5.0 adds a scheduling layer above customer interactions.

## Activity types

- Meeting
- Customer visit
- Scheduled call
- Follow-up

Each activity is linked to a customer, may be linked to an active PIC, and is assigned to an active MII user.

## Statuses

- Planned
- Confirmed
- Completed
- Cancelled
- Rescheduled
- No show

Completed activities cannot be edited or deleted. Completion creates one customer interaction atomically and stores its interaction reference on the scheduled activity.

## Agenda access

- Administrators and managers can view and assign activities for all active users.
- Sales and technician users can create and manage activities assigned to themselves.
- Other authenticated users see their assigned agenda as read-only.

The Agenda page separates open overdue activities, the selected calendar day, and the following seven days.

## Reminders

An optional reminder time can be set at or before the scheduled start. The background job checks due reminders every 15 minutes by default and emails the assigned user. A reminder is marked sent only after SMTP succeeds. Failed reminders retry up to five times with duplicate-send protection.

The reminder job defaults to the same enabled state and timezone as the daily summary. Optional settings:

```dotenv
SCHEDULE_REMINDER_ENABLED=true
SCHEDULE_REMINDER_CRON="*/15 * * * *"
SCHEDULE_REMINDER_TIMEZONE=Asia/Jakarta
```

## Daily email

The daily activity email includes:

- Today's scheduled activities grouped by assigned user
- Open overdue scheduled activities grouped by assigned user
- Time, type, customer, PIC, location, purpose, and status

## Production API build

The frontend production build must use:

```text
VITE_API_BASE_URL=/api
```
## Follow-up creation on completion

When a scheduled activity is completed and a Next action date is supplied, MII automatically creates a new planned Follow-up activity in Agenda. It keeps the same customer, PIC, assigned user, and local time of day as the completed activity. The next-action text becomes the follow-up purpose.
