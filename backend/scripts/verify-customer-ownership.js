require("dotenv").config();

const pool = require("../db/database");

(async () => {
  try {
    const checks = await pool.query(`
      SELECT
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'customers'
            AND column_name = 'assigned_to'
        ) AS assigned_to_column,
        to_regclass('public.customer_assignment_history') IS NOT NULL
          AS history_table,
        NOT EXISTS (
          SELECT 1
          FROM customers c
          LEFT JOIN app_users u ON u.user_id = c.assigned_to
          WHERE c.assigned_to IS NOT NULL AND u.user_id IS NULL
        ) AS no_orphan_current_owners,
        NOT EXISTS (
          SELECT 1
          FROM customers c
          WHERE c.assigned_to IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM customer_assignment_history h
              WHERE h.customer_id = c.customer_id
            )
        ) AS all_owned_customers_have_history,
        NOT EXISTS (
          SELECT 1
          FROM customers c
          JOIN LATERAL (
            SELECT h.assigned_to
            FROM customer_assignment_history h
            WHERE h.customer_id = c.customer_id
            ORDER BY h.assigned_at DESC, h.assignment_history_id DESC
            LIMIT 1
          ) latest ON true
          WHERE c.assigned_to IS DISTINCT FROM latest.assigned_to
        ) AS latest_history_matches_current_owner
    `);

    const totals = await pool.query(`
      SELECT
        COUNT(*)::integer AS customers,
        COUNT(*) FILTER (WHERE assigned_to IS NOT NULL)::integer AS assigned,
        COUNT(*) FILTER (WHERE assigned_to IS NULL)::integer AS unassigned,
        (SELECT COUNT(*)::integer FROM customer_assignment_history)
          AS history_entries
      FROM customers
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
