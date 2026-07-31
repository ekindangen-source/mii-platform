const cron = require("node-cron");

const pool = require("../db/database");
const {
  DEFAULT_TIMEZONE,
  getReportDate,
  sendDailySummaryEmail,
  validateEmailConfig,
  verifyEmailTransport,
} = require("../services/dailySummaryEmail");

const DEFAULT_CRON = "0 18 * * *";

function isEnabled() {
  return ["1", "true", "yes", "on"].includes(
    String(
      process.env.DAILY_SUMMARY_ENABLED ||
        "false"
    )
      .trim()
      .toLowerCase()
  );
}

async function claimReport(reportDate) {
  const result = await pool.query(
    `
      INSERT INTO daily_summary_runs (
        report_date,
        status,
        started_at
      )
      VALUES ($1, 'running', NOW())
      ON CONFLICT (report_date)
      DO UPDATE SET
        status = 'running',
        started_at = NOW(),
        sent_at = NULL,
        recipients = NULL,
        message_id = NULL,
        error_message = NULL
      WHERE daily_summary_runs.status = 'failed'
      RETURNING report_date
    `,
    [reportDate]
  );

  return result.rowCount === 1;
}

async function markSent({
  reportDate,
  recipients,
  messageId,
}) {
  await pool.query(
    `
      UPDATE daily_summary_runs
      SET
        status = 'sent',
        sent_at = NOW(),
        recipients = $2,
        message_id = $3,
        error_message = NULL
      WHERE report_date = $1
    `,
    [
      reportDate,
      recipients.join(", "),
      messageId || null,
    ]
  );
}

async function markFailed({
  reportDate,
  error,
}) {
  await pool.query(
    `
      UPDATE daily_summary_runs
      SET
        status = 'failed',
        error_message = $2
      WHERE report_date = $1
    `,
    [
      reportDate,
      String(
        error?.stack ||
          error?.message ||
          error
      ).slice(0, 8000),
    ]
  );
}

async function runDailySummary({
  reportDate,
  force = false,
} = {}) {
  const timeZone =
    process.env.DAILY_SUMMARY_TIMEZONE ||
    DEFAULT_TIMEZONE;

  const resolvedDate =
    reportDate ||
    getReportDate(timeZone);

  if (!force) {
    const claimed = await claimReport(
      resolvedDate
    );

    if (!claimed) {
      console.log(
        `[daily-summary] ${resolvedDate} ` +
          "was already sent or is running."
      );

      return {
        skipped: true,
        reportDate: resolvedDate,
      };
    }
  }

  try {
    const result =
      await sendDailySummaryEmail({
        reportDate: resolvedDate,
        timeZone,
      });

    if (!force) {
      await markSent({
        reportDate: resolvedDate,
        recipients: result.recipients,
        messageId: result.messageId,
      });
    }

    console.log(
      `[daily-summary] Sent ${resolvedDate}:`,
      result.counts
    );

    return {
      skipped: false,
      reportDate: resolvedDate,
      ...result,
    };
  } catch (error) {
    if (!force) {
      await markFailed({
        reportDate: resolvedDate,
        error,
      });
    }

    console.error(
      `[daily-summary] Failed ${resolvedDate}:`,
      error
    );

    throw error;
  }
}

function startDailySummaryJob() {
  if (!isEnabled()) {
    console.log(
      "[daily-summary] Disabled. Set " +
        "DAILY_SUMMARY_ENABLED=true to enable."
    );
    return null;
  }

  const cronExpression =
    process.env.DAILY_SUMMARY_CRON ||
    DEFAULT_CRON;

  const timeZone =
    process.env.DAILY_SUMMARY_TIMEZONE ||
    DEFAULT_TIMEZONE;

  if (!cron.validate(cronExpression)) {
    console.error(
      "[daily-summary] Invalid cron expression:",
      cronExpression
    );
    return null;
  }

  const validation =
    validateEmailConfig();

  if (!validation.valid) {
    console.error(
      "[daily-summary] Missing configuration:",
      validation.missing.join(", ")
    );
    return null;
  }

  const task = cron.schedule(
    cronExpression,
    async () => {
      try {
        await runDailySummary();
      } catch (_error) {
        // Error is already logged and recorded.
      }
    },
    {
      timezone: timeZone,
      noOverlap: true,
      name: "mii-daily-summary",
    }
  );

  verifyEmailTransport()
    .then(() => {
      console.log(
        "[daily-summary] SMTP verified."
      );
    })
    .catch((error) => {
      console.error(
        "[daily-summary] SMTP verification failed:",
        error.message
      );
    });

  console.log(
    `[daily-summary] Scheduled "${cronExpression}" ` +
      `in ${timeZone}.`
  );

  return task;
}

module.exports = {
  runDailySummary,
  startDailySummaryJob,
};
