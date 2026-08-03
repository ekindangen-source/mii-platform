require("dotenv").config();

const pool = require("../db/database");
const {
  DEFAULT_TIMEZONE,
  getReportDate,
  loadDailySummary,
  summarizeScheduledByUser,
} = require("../services/dailySummaryEmail");

function argument(name) {
  const prefix = `--${name}=`;
  const item = process.argv.find((value) =>
    value.startsWith(prefix)
  );
  return item ? item.slice(prefix.length) : null;
}

async function main() {
  const timeZone =
    argument("timezone") ||
    process.env.DAILY_SUMMARY_TIMEZONE ||
    DEFAULT_TIMEZONE;
  const reportDate =
    argument("date") || getReportDate(timeZone);
  const data = await loadDailySummary({
    reportDate,
    timeZone,
  });
  const todayGroups = summarizeScheduledByUser(
    data.scheduledToday
  );
  const overdueGroups = summarizeScheduledByUser(
    data.scheduledOverdue
  );
  const todayGroupTotal = todayGroups.reduce(
    (sum, group) => sum + group.rows.length,
    0
  );
  const overdueGroupTotal = overdueGroups.reduce(
    (sum, group) => sum + group.rows.length,
    0
  );

  const checks = {
    scheduledTodayArray: Array.isArray(
      data.scheduledToday
    ),
    scheduledOverdueArray: Array.isArray(
      data.scheduledOverdue
    ),
    todayGroupCountMatchesTotal:
      todayGroupTotal === data.scheduledToday.length,
    overdueGroupCountMatchesTotal:
      overdueGroupTotal === data.scheduledOverdue.length,
    everyTodayGroupHasName: todayGroups.every(
      (group) => Boolean(group.name)
    ),
    everyOverdueGroupHasName: overdueGroups.every(
      (group) => Boolean(group.name)
    ),
  };
  const status = Object.values(checks).every(Boolean)
    ? "OK"
    : "ERROR";

  console.log(
    JSON.stringify(
      {
        status,
        reportDate,
        timeZone,
        checks,
        totals: {
          scheduledToday: data.scheduledToday.length,
          scheduledOverdue: data.scheduledOverdue.length,
          todayGroups: todayGroups.length,
          overdueGroups: overdueGroups.length,
        },
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
