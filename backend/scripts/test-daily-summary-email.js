require("dotenv").config();

const pool = require("../db/database");
const {
  DEFAULT_TIMEZONE,
  getReportDate,
  verifyEmailTransport,
} = require("../services/dailySummaryEmail");
const {
  runDailySummary,
} = require("../jobs/dailySummaryJob");

function getArgument(name) {
  const prefix = `--${name}=`;
  const argument = process.argv.find(
    (value) => value.startsWith(prefix)
  );

  return argument
    ? argument.slice(prefix.length)
    : "";
}

(async () => {
  try {
    console.log(
      "Verifying SMTP connection..."
    );
    await verifyEmailTransport();
    console.log("SMTP connection: OK");

    const timeZone =
      process.env.DAILY_SUMMARY_TIMEZONE ||
      DEFAULT_TIMEZONE;

    const reportDate =
      getArgument("date") ||
      getReportDate(timeZone);

    console.log(
      `Sending test summary for ${reportDate}...`
    );

    const result = await runDailySummary({
      reportDate,
      force: true,
    });

    console.log(
      "Test email sent:",
      result
    );
  } catch (error) {
    console.error(
      "Daily summary test failed:",
      error
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
