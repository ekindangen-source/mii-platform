require("dotenv").config();

const pool = require("../db/database");

async function exists(query, values = []) {
  const result = await pool.query(query, values);
  return Boolean(result.rows[0]?.exists);
}

async function main() {
  const checks = {
    interactionsTable: await exists(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE
           table_schema = 'public'
           AND table_name = 'customer_interactions'
       )`
    ),
    photosTable: await exists(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE
           table_schema = 'public'
           AND table_name = 'customer_interaction_photos'
       )`
    ),
    customerForeignKey: await exists(
      `SELECT EXISTS (
         SELECT 1
         FROM pg_constraint
         WHERE
           conname = 'fk_customer_interactions_customer'
           AND conrelid = 'customer_interactions'::regclass
       )`
    ),
    contactForeignKey: await exists(
      `SELECT EXISTS (
         SELECT 1
         FROM pg_constraint
         WHERE
           conname = 'fk_customer_interactions_contact'
           AND conrelid = 'customer_interactions'::regclass
       )`
    ),
    createdByForeignKey: await exists(
      `SELECT EXISTS (
         SELECT 1
         FROM pg_constraint
         WHERE
           conname = 'fk_customer_interactions_created_by'
           AND conrelid = 'customer_interactions'::regclass
       )`
    ),
    photoInteractionForeignKey: await exists(
      `SELECT EXISTS (
         SELECT 1
         FROM pg_constraint
         WHERE
           conname = 'fk_customer_interaction_photos_interaction'
           AND conrelid = 'customer_interaction_photos'::regclass
       )`
    ),
    interactionDateIndex: await exists(
      `SELECT EXISTS (
         SELECT 1
         FROM pg_indexes
         WHERE
           schemaname = 'public'
           AND indexname = 'idx_customer_interactions_customer_date'
       )`
    ),
    noOrphanInteractions: await exists(
      `SELECT NOT EXISTS (
         SELECT 1
         FROM customer_interactions ci
         LEFT JOIN customers c
           ON c.customer_id = ci.customer_id
         WHERE c.customer_id IS NULL
       )`
    ),
    noMismatchedContacts: await exists(
      `SELECT NOT EXISTS (
         SELECT 1
         FROM customer_interactions ci
         JOIN customer_contacts cc
           ON cc.contact_id = ci.contact_id
         WHERE cc.customer_id <> ci.customer_id
       )`
    ),
    noOrphanPhotos: await exists(
      `SELECT NOT EXISTS (
         SELECT 1
         FROM customer_interaction_photos cip
         LEFT JOIN customer_interactions ci
           ON ci.interaction_id = cip.interaction_id
         WHERE ci.interaction_id IS NULL
       )`
    ),
  };

  const totals = await pool.query(
    `SELECT
       (SELECT COUNT(*)::integer
        FROM customer_interactions)
         AS interactions,
       (SELECT COUNT(*)::integer
        FROM customer_interaction_photos)
         AS photos,
       (SELECT COUNT(*)::integer
        FROM customer_interactions
        WHERE next_action_date IS NOT NULL)
         AS follow_ups`
  );

  const status = Object.values(checks).every(Boolean)
    ? "OK"
    : "ERROR";

  console.log(
    JSON.stringify(
      {
        status,
        checks,
        totals: totals.rows[0],
      },
      null,
      2
    )
  );

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
