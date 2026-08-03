require("dotenv").config();

const pool = require("../db/database");

async function scalar(query, values = []) {
  const result = await pool.query(query, values);
  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return Object.values(row)[0];
}

async function main() {
  const checks = {
    activitiesTable: Boolean(
      await scalar(
        `SELECT to_regclass('public.scheduled_activities') IS NOT NULL AS ok`
      )
    ),
    customerForeignKey: Boolean(
      await scalar(
        `SELECT EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conname = 'fk_scheduled_activities_customer'
             AND conrelid = 'scheduled_activities'::regclass
         ) AS ok`
      )
    ),
    contactForeignKey: Boolean(
      await scalar(
        `SELECT EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conname = 'fk_scheduled_activities_contact'
             AND conrelid = 'scheduled_activities'::regclass
         ) AS ok`
      )
    ),
    assigneeForeignKey: Boolean(
      await scalar(
        `SELECT EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conname = 'fk_scheduled_activities_assigned_to'
             AND conrelid = 'scheduled_activities'::regclass
         ) AS ok`
      )
    ),
    completedInteractionForeignKey: Boolean(
      await scalar(
        `SELECT EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conname = 'fk_scheduled_activities_completed_interaction'
             AND conrelid = 'scheduled_activities'::regclass
         ) AS ok`
      )
    ),
    assigneeStartIndex: Boolean(
      await scalar(
        `SELECT to_regclass(
           'public.idx_scheduled_activities_assignee_start'
         ) IS NOT NULL AS ok`
      )
    ),
    reminderIndex: Boolean(
      await scalar(
        `SELECT to_regclass(
           'public.idx_scheduled_activities_reminder_due'
         ) IS NOT NULL AS ok`
      )
    ),
    noOrphanCustomers: Boolean(
      await scalar(
        `SELECT NOT EXISTS (
           SELECT 1
           FROM scheduled_activities sa
           LEFT JOIN customers c
             ON c.customer_id = sa.customer_id
           WHERE c.customer_id IS NULL
         ) AS ok`
      )
    ),
    noMismatchedContacts: Boolean(
      await scalar(
        `SELECT NOT EXISTS (
           SELECT 1
           FROM scheduled_activities sa
           LEFT JOIN customer_contacts cc
             ON cc.customer_id = sa.customer_id
             AND cc.contact_id = sa.contact_id
           WHERE
             sa.contact_id IS NOT NULL
             AND cc.contact_id IS NULL
         ) AS ok`
      )
    ),
    noOrphanAssignees: Boolean(
      await scalar(
        `SELECT NOT EXISTS (
           SELECT 1
           FROM scheduled_activities sa
           LEFT JOIN app_users u
             ON u.user_id = sa.assigned_to
           WHERE u.user_id IS NULL
         ) AS ok`
      )
    ),
    noInvalidTimes: Boolean(
      await scalar(
        `SELECT NOT EXISTS (
           SELECT 1
           FROM scheduled_activities
           WHERE
             (scheduled_end IS NOT NULL AND scheduled_end <= scheduled_start)
             OR (reminder_at IS NOT NULL AND reminder_at > scheduled_start)
         ) AS ok`
      )
    ),
    noDuplicateCompletedInteractions: Boolean(
      await scalar(
        `SELECT NOT EXISTS (
           SELECT completed_interaction_id
           FROM scheduled_activities
           WHERE completed_interaction_id IS NOT NULL
           GROUP BY completed_interaction_id
           HAVING COUNT(*) > 1
         ) AS ok`
      )
    ),
  };

  const totalsResult = await pool.query(
    `SELECT
       COUNT(*)::integer AS activities,
       COUNT(*) FILTER (
         WHERE status IN ('planned', 'confirmed')
       )::integer AS open_activities,
       COUNT(*) FILTER (
         WHERE status = 'completed'
       )::integer AS completed,
       COUNT(*) FILTER (
         WHERE reminder_at IS NOT NULL
       )::integer AS reminders
     FROM scheduled_activities`
  );

  const status = Object.values(checks).every(Boolean)
    ? "OK"
    : "ERROR";

  console.log(
    JSON.stringify(
      {
        status,
        checks,
        totals: totalsResult.rows[0],
      },
      null,
      2
    )
  );

  if (status !== "OK") {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
