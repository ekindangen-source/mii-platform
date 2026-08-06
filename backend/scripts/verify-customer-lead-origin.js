require("dotenv").config();

const pool = require("../db/database");

(async () => {
  try {
    const result = await pool.query(`
      SELECT
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='customers'
            AND column_name='origin_lead_id'
        ) AS origin_lead_column,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='customers'
            AND column_name='creation_method'
        ) AS creation_method_column,
        EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname='fk_customers_origin_lead'
        ) AS origin_lead_foreign_key,
        EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE schemaname='public' AND indexname='uq_customers_origin_lead'
        ) AS origin_lead_unique_index,
        NOT EXISTS (
          SELECT 1
          FROM customers c
          LEFT JOIN crm_leads l ON l.lead_id=c.origin_lead_id
          WHERE c.creation_method='lead_conversion'
            AND l.lead_id IS NULL
        ) AS no_orphan_lead_conversions,
        NOT EXISTS (
          SELECT 1
          FROM customers c
          JOIN crm_leads l ON l.lead_id=c.origin_lead_id
          WHERE c.creation_method='lead_conversion'
            AND (
              l.status <> 'converted'
              OR l.converted_customer_id IS DISTINCT FROM c.customer_id
            )
        ) AS lead_customer_links_match,
        NOT EXISTS (
          SELECT 1
          FROM customers c
          JOIN crm_leads l ON l.lead_id=c.origin_lead_id
          LEFT JOIN sales_opportunities o
            ON o.opportunity_id=l.converted_opportunity_id
          WHERE c.creation_method='lead_conversion'
            AND (o.opportunity_id IS NULL OR o.stage <> 'won')
        ) AS every_conversion_has_won_opportunity
    `);

    const totals = await pool.query(`
      SELECT
        COUNT(*)::integer AS customers,
        COUNT(*) FILTER (WHERE creation_method='legacy')::integer AS legacy,
        COUNT(*) FILTER (WHERE creation_method='lead_conversion')::integer AS lead_conversions,
        COUNT(*) FILTER (WHERE creation_method='admin_import')::integer AS admin_imports
      FROM customers
    `);

    const checks = result.rows[0];
    const ok = Object.values(checks).every(Boolean);
    console.log(JSON.stringify({
      status: ok ? "OK" : "ERROR",
      checks,
      totals: totals.rows[0],
    }, null, 2));
    if (!ok) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ status: "ERROR", message: error.message }, null, 2));
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
