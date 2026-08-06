require("dotenv").config();
const pool = require("../db/database");

(async () => {
  try {
    const checks = await pool.query(`
      SELECT
        to_regclass('public.sales_opportunities') IS NOT NULL AS opportunities_table,
        to_regclass('public.sales_opportunities_number_seq') IS NOT NULL AS opportunity_sequence,
        NOT EXISTS (
          SELECT 1 FROM sales_opportunities o
          LEFT JOIN customers c ON c.customer_id = o.customer_id
          WHERE c.customer_id IS NULL
        ) AS no_orphan_customers,
        NOT EXISTS (
          SELECT 1 FROM sales_opportunities o
          LEFT JOIN app_users u ON u.user_id = o.owner_id
          WHERE u.user_id IS NULL
        ) AS no_orphan_owners,
        NOT EXISTS (
          SELECT 1 FROM sales_opportunities o
          LEFT JOIN customer_contacts cc
            ON cc.customer_id = o.customer_id AND cc.contact_id = o.contact_id
          WHERE o.contact_id IS NOT NULL AND cc.contact_id IS NULL
        ) AS no_mismatched_contacts
    `);
    const totals = await pool.query(`
      SELECT
        COUNT(*)::integer AS opportunities,
        COUNT(*) FILTER (WHERE stage NOT IN ('won','lost'))::integer AS open,
        COUNT(*) FILTER (WHERE stage = 'won')::integer AS won,
        COUNT(*) FILTER (WHERE stage = 'lost')::integer AS lost,
        COALESCE(SUM(estimated_value) FILTER (WHERE stage NOT IN ('won','lost')),0) AS open_value,
        COALESCE(SUM(estimated_value * probability / 100.0)
          FILTER (WHERE stage NOT IN ('won','lost')),0) AS weighted_value
      FROM sales_opportunities
    `);
    const result = {
      status: Object.values(checks.rows[0]).every(Boolean) ? "OK" : "ERROR",
      checks: checks.rows[0],
      totals: totals.rows[0],
    };
    console.log(JSON.stringify(result, null, 2));
    if (result.status !== "OK") process.exitCode = 1;
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
