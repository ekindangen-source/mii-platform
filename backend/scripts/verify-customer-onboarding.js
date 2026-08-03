require("dotenv").config();

const pool = require("../db/database");

async function main() {
  const result = await pool.query(`
    SELECT
      COUNT(*) FILTER (
        WHERE c.customer_id IS NULL
      )::integer AS orphan_contacts,
      COUNT(*) FILTER (
        WHERE cc.is_primary = true AND cc.is_active = false
      )::integer AS inactive_primary_contacts,
      COUNT(*) FILTER (
        WHERE NULLIF(btrim(cc.full_name), '') IS NULL
      )::integer AS contacts_without_name,
      COUNT(*) FILTER (
        WHERE cc.is_primary = true
          AND NULLIF(btrim(cc.telephone), '') IS NULL
      )::integer AS primary_contacts_without_phone
    FROM customer_contacts cc
    LEFT JOIN customers c
      ON c.customer_id = cc.customer_id
  `);

  const duplicates = await pool.query(`
    SELECT COUNT(*)::integer AS duplicate_primary_customers
    FROM (
      SELECT customer_id
      FROM customer_contacts
      WHERE is_primary = true
      GROUP BY customer_id
      HAVING COUNT(*) > 1
    ) rows
  `);

  const totals = result.rows[0];
  const checks = {
    noOrphanContacts: totals.orphan_contacts === 0,
    noInactivePrimaryContacts:
      totals.inactive_primary_contacts === 0,
    allContactsHaveNames: totals.contacts_without_name === 0,
    noDuplicatePrimaryContacts:
      duplicates.rows[0].duplicate_primary_customers === 0,
  };
  const status = Object.values(checks).every(Boolean) ? "OK" : "ERROR";

  console.log(JSON.stringify({ status, checks, totals }, null, 2));

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
