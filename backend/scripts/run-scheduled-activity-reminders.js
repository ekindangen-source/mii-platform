require("dotenv").config();

const pool = require("../db/database");
const {
  runScheduledActivityReminders,
} = require("../jobs/scheduledActivityReminderJob");

runScheduledActivityReminders()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
