require("dotenv").config();

const pool = require("../db/database");

async function main() {
  const checks = {};

  const accountType = await pool.query(
    `SELECT
       data_type,
       is_nullable,
       column_default
     FROM information_schema.columns
     WHERE
       table_schema = 'public'
       AND table_name = 'customers'
       AND column_name = 'account_type'`
  );

  checks.accountTypeColumn =
    accountType.rowCount === 1;

  const contactsTable = await pool.query(
    `SELECT to_regclass(
       'public.customer_contacts'
     ) AS table_name`
  );

  checks.contactsTable =
    contactsTable.rows[0].table_name ===
    "customer_contacts";

  const constraints = await pool.query(
    `SELECT conname
     FROM pg_constraint
     WHERE conrelid =
       'public.customer_contacts'::regclass`
  );

  const constraintNames = new Set(
    constraints.rows.map((row) => row.conname)
  );

  checks.customerForeignKey =
    constraintNames.has(
      "fk_customer_contacts_customer"
    );
  checks.createdByForeignKey =
    constraintNames.has(
      "fk_customer_contacts_created_by"
    );
  checks.updatedByForeignKey =
    constraintNames.has(
      "fk_customer_contacts_updated_by"
    );

  const duplicatePrimary = await pool.query(
    `SELECT customer_id, COUNT(*)::integer AS count
     FROM customer_contacts
     WHERE is_primary = true
     GROUP BY customer_id
     HAVING COUNT(*) > 1`
  );

  checks.noDuplicatePrimary =
    duplicatePrimary.rowCount === 0;

  const contactsWithoutCustomer = await pool.query(
    `SELECT COUNT(*)::integer AS count
     FROM customer_contacts cc
     LEFT JOIN customers c
       ON c.customer_id = cc.customer_id
     WHERE c.customer_id IS NULL`
  );

  checks.noOrphanContacts =
    contactsWithoutCustomer.rows[0].count === 0;

  const summary = await pool.query(
    `SELECT
       COUNT(*)::integer AS total_contacts,
       COUNT(*) FILTER (
         WHERE is_active = true
       )::integer AS active_contacts,
       COUNT(*) FILTER (
         WHERE is_primary = true
       )::integer AS primary_contacts,
       COUNT(DISTINCT customer_id)::integer
         AS customers_with_contacts
     FROM customer_contacts`
  );

  const failed = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);

  console.log(
    JSON.stringify(
      {
        status:
          failed.length === 0
            ? "OK"
            : "ERROR",
        checks,
        summary: summary.rows[0],
        failed,
      },
      null,
      2
    )
  );

  if (failed.length > 0) {
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
