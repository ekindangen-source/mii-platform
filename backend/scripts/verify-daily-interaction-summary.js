require("dotenv").config();

const pool = require("../db/database");
const {
  DEFAULT_TIMEZONE,
  getReportDate,
  loadDailySummary,
  summarizeInteractionsByUser,
} = require("../services/dailySummaryEmail");

function getArgument(name) {
  const prefix = `--${name}=`;
  const argument = process.argv.find((value) =>
    value.startsWith(prefix)
  );
  return argument ? argument.slice(prefix.length) : "";
}

(async () => {
  try {
    const timeZone =
      process.env.DAILY_SUMMARY_TIMEZONE ||
      DEFAULT_TIMEZONE;
    const reportDate =
      getArgument("date") || getReportDate(timeZone);

    const data = await loadDailySummary({
      reportDate,
      timeZone,
    });
    const groups = summarizeInteractionsByUser(
      data.interactions
    );

    const directCount = await pool.query(
      `
        SELECT COUNT(*)::int AS count
        FROM customer_interactions
        WHERE
          interaction_at >= (
            ($1::date)::timestamp AT TIME ZONE $2
          )
          AND interaction_at < (
            (($1::date + 1)::date)::timestamp
            AT TIME ZONE $2
          )
      `,
      [reportDate, timeZone]
    );

    const checks = {
      interactionsArray:
        Array.isArray(data.interactions),
      countMatchesDatabase:
        data.interactions.length ===
        directCount.rows[0].count,
      groupCountMatchesTotal:
        groups.reduce(
          (sum, group) => sum + group.rows.length,
          0
        ) === data.interactions.length,
      everyGroupHasName: groups.every(
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
            interactions: data.interactions.length,
            users: groups.length,
          },
          groups: groups.map((group) => ({
            user_id: group.userId,
            user_name: group.name,
            interactions: group.rows.length,
          })),
        },
        null,
        2
      )
    );

    if (status !== "OK") {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
