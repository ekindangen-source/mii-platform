const cron = require("node-cron");

const pool = require("../db/database");
const {
  validateEmailConfig,
  verifyEmailTransport,
} = require("../services/dailySummaryEmail");
const {
  sendScheduledActivityReminder,
} = require("../services/scheduledActivityReminderEmail");

const DEFAULT_CRON = "*/15 * * * *";
const DEFAULT_TIMEZONE = "Asia/Jakarta";
const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 25;

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(
    String(value).trim().toLowerCase()
  );
}

function isEnabled() {
  return parseBoolean(
    process.env.SCHEDULE_REMINDER_ENABLED,
    parseBoolean(process.env.DAILY_SUMMARY_ENABLED, false)
  );
}

async function claimDueActivities(limit = BATCH_SIZE) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT
         sa.*,
         c.company AS customer_name,
         cc.full_name AS contact_name,
         au.full_name AS assigned_to_name,
         au.email AS assigned_to_email
       FROM scheduled_activities sa
       INNER JOIN customers c
         ON c.customer_id = sa.customer_id
       LEFT JOIN customer_contacts cc
         ON cc.customer_id = sa.customer_id
         AND cc.contact_id = sa.contact_id
       INNER JOIN app_users au
         ON au.user_id = sa.assigned_to
       WHERE
         sa.status IN ('planned', 'confirmed')
         AND sa.reminder_at IS NOT NULL
         AND sa.reminder_at <= NOW()
         AND sa.reminder_sent_at IS NULL
         AND sa.reminder_attempt_count < $1
         AND (
           sa.reminder_last_attempt_at IS NULL
           OR sa.reminder_last_attempt_at <= NOW() - INTERVAL '10 minutes'
         )
         AND au.is_active = true
       ORDER BY sa.reminder_at, sa.activity_id
       FOR UPDATE OF sa SKIP LOCKED
       LIMIT $2`,
      [MAX_ATTEMPTS, limit]
    );

    if (result.rows.length) {
      await client.query(
        `UPDATE scheduled_activities
         SET
           reminder_attempt_count = reminder_attempt_count + 1,
           reminder_last_attempt_at = NOW(),
           reminder_error = NULL
         WHERE activity_id = ANY($1::text[])`,
        [result.rows.map((row) => row.activity_id)]
      );
    }

    await client.query("COMMIT");
    return result.rows;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function markSent(activityId) {
  await pool.query(
    `UPDATE scheduled_activities
     SET
       reminder_sent_at = NOW(),
       reminder_error = NULL,
       updated_at = NOW()
     WHERE activity_id = $1`,
    [activityId]
  );
}

async function markFailed(activityId, error) {
  await pool.query(
    `UPDATE scheduled_activities
     SET
       reminder_error = $2,
       updated_at = NOW()
     WHERE activity_id = $1`,
    [
      activityId,
      String(error?.message || error).slice(0, 2000),
    ]
  );
}

async function runScheduledActivityReminders() {
  const timeZone =
    process.env.SCHEDULE_REMINDER_TIMEZONE ||
    process.env.DAILY_SUMMARY_TIMEZONE ||
    DEFAULT_TIMEZONE;
  const activities = await claimDueActivities();
  const results = [];

  for (const activity of activities) {
    try {
      const sent = await sendScheduledActivityReminder(
        activity,
        { timeZone }
      );
      await markSent(activity.activity_id);
      results.push({
        activityId: activity.activity_id,
        sent: true,
        recipient: sent.recipient,
      });
    } catch (error) {
      await markFailed(activity.activity_id, error);
      results.push({
        activityId: activity.activity_id,
        sent: false,
        error: error.message,
      });
      console.error(
        `[schedule-reminder] ${activity.activity_id} failed:`,
        error.message
      );
    }
  }

  if (activities.length) {
    console.log(
      `[schedule-reminder] Processed ${activities.length} reminder(s).`
    );
  }

  return results;
}

function startScheduledActivityReminderJob() {
  if (!isEnabled()) {
    console.log(
      "[schedule-reminder] Disabled. Set " +
        "SCHEDULE_REMINDER_ENABLED=true to enable."
    );
    return null;
  }

  const expression =
    process.env.SCHEDULE_REMINDER_CRON || DEFAULT_CRON;
  const timeZone =
    process.env.SCHEDULE_REMINDER_TIMEZONE ||
    process.env.DAILY_SUMMARY_TIMEZONE ||
    DEFAULT_TIMEZONE;

  if (!cron.validate(expression)) {
    console.error(
      "[schedule-reminder] Invalid cron expression:",
      expression
    );
    return null;
  }

  const validation = validateEmailConfig();

  if (!validation.valid) {
    console.error(
      "[schedule-reminder] Missing email configuration:",
      validation.missing.join(", ")
    );
    return null;
  }

  const task = cron.schedule(
    expression,
    async () => {
      try {
        await runScheduledActivityReminders();
      } catch (error) {
        console.error(
          "[schedule-reminder] Job failed:",
          error
        );
      }
    },
    {
      timezone: timeZone,
      noOverlap: true,
      name: "mii-scheduled-activity-reminders",
    }
  );

  verifyEmailTransport()
    .then(() => {
      console.log("[schedule-reminder] SMTP verified.");
    })
    .catch((error) => {
      console.error(
        "[schedule-reminder] SMTP verification failed:",
        error.message
      );
    });

  console.log(
    `[schedule-reminder] Scheduled "${expression}" in ${timeZone}.`
  );

  return task;
}

module.exports = {
  runScheduledActivityReminders,
  startScheduledActivityReminderJob,
};
