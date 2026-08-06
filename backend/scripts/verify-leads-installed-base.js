require("dotenv").config();
const pool = require("../db/database");

(async () => {
  try {
    const checks = await pool.query(`
      SELECT
        to_regclass('public.crm_leads') IS NOT NULL AS leads_table,
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_opportunities' AND column_name='vessel_id') AS opportunity_vessel,
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_opportunities' AND column_name='engine_id') AS opportunity_engine,
        NOT EXISTS (SELECT 1 FROM crm_leads l LEFT JOIN app_users u ON u.user_id=l.owner_id WHERE u.user_id IS NULL) AS no_orphan_lead_owners,
        NOT EXISTS (
          SELECT 1 FROM sales_opportunities o
          JOIN vessels v ON v.vessel_id=o.vessel_id
          WHERE v.customer_id<>o.customer_id
        ) AS no_mismatched_vessels,
        NOT EXISTS (
          SELECT 1 FROM sales_opportunities o
          JOIN engines e ON e.engine_id=o.engine_id
          JOIN vessels v ON v.vessel_id=e.vessel_id
          WHERE v.customer_id<>o.customer_id OR (o.vessel_id IS NOT NULL AND o.vessel_id<>e.vessel_id)
        ) AS no_mismatched_engines
    `);
    const totals = await pool.query(`
      SELECT COUNT(*)::integer AS leads,
        COUNT(*) FILTER (WHERE status NOT IN ('converted','disqualified'))::integer AS active_leads,
        COUNT(*) FILTER (WHERE status='converted')::integer AS converted_leads
      FROM crm_leads
    `);
    const result = { status: Object.values(checks.rows[0]).every(Boolean) ? "OK" : "ERROR", checks: checks.rows[0], totals: totals.rows[0] };
    console.log(JSON.stringify(result, null, 2));
    if (result.status !== "OK") process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ status: "ERROR", message: error.message }, null, 2));
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
