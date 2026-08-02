require("dotenv").config();

const pool = require("../db/database");
const {
  getReportDate,
  loadDailySummary,
  summarizeCustomersByUser,
} = require("../services/dailySummaryEmail");

(async () => {
  try {
    const column = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'customers'
        AND column_name = 'created_by'
    `);

    if (!column.rowCount) {
      throw new Error(
        "customers.created_by does not exist. Apply migration 013 first."
      );
    }

    const reportDate = getReportDate(
      process.env.DAILY_SUMMARY_TIMEZONE ||
        "Asia/Jakarta"
    );

    const data = await loadDailySummary({
      reportDate,
      timeZone:
        process.env.DAILY_SUMMARY_TIMEZONE ||
        "Asia/Jakarta",
    });

    console.log(
      `Customer attribution verification for ${reportDate}`
    );
    console.table(
      summarizeCustomersByUser(
        data.customers
      )
    );
    console.table(
      data.customers.map((row) => ({
        customer_id: row.customer_id,
        company: row.company,
        source: row.lead_source,
        created_by: row.created_by,
        created_by_name:
          row.created_by_name,
      }))
    );
  } catch (error) {
    console.error(
      "Customer attribution verification failed:",
      error.message
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
