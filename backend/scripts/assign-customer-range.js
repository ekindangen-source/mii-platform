require("dotenv").config();

const pool = require("../db/database");

const start = Number(process.argv[2]);
const end = Number(process.argv[3]);
const assignedTo = String(process.argv[4] || "").trim();
const changedBy = String(process.argv[5] || "").trim();
const reason = String(process.argv[6] || "Initial portfolio assignment").trim();

if (!Number.isInteger(start) || !Number.isInteger(end) || start > end || !assignedTo || !changedBy) {
  console.error(
    "Usage: node scripts/assign-customer-range.js <start> <end> <assignedTo> <changedBy> [reason]"
  );
  process.exit(1);
}

(async () => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const users = await client.query(
      `SELECT user_id, is_active FROM app_users WHERE user_id = ANY($1::text[])`,
      [[assignedTo, changedBy]]
    );
    const userMap = new Map(users.rows.map((row) => [row.user_id, row]));

    if (!userMap.get(assignedTo)?.is_active) {
      throw new Error(`Assigned user ${assignedTo} is not active or does not exist.`);
    }
    if (!userMap.has(changedBy)) {
      throw new Error(`Changing user ${changedBy} does not exist.`);
    }

    const expected = end - start + 1;
    const selected = await client.query(
      `SELECT customer_id, company, assigned_to
       FROM customers
       WHERE customer_id ~ '[0-9]+$'
         AND substring(customer_id FROM '[0-9]+$')::integer BETWEEN $1 AND $2
       ORDER BY substring(customer_id FROM '[0-9]+$')::integer
       FOR UPDATE`,
      [start, end]
    );

    if (selected.rowCount !== expected) {
      throw new Error(`Expected ${expected} customers, found ${selected.rowCount}; assignment cancelled.`);
    }

    for (const customer of selected.rows) {
      if (customer.assigned_to === assignedTo) continue;

      await client.query(
        `INSERT INTO customer_assignment_history
           (customer_id, previous_assigned_to, assigned_to, changed_by, reason)
         VALUES ($1,$2,$3,$4,$5)`,
        [customer.customer_id, customer.assigned_to, assignedTo, changedBy, reason]
      );

      await client.query(
        `UPDATE customers SET assigned_to=$2, updated_at=NOW() WHERE customer_id=$1`,
        [customer.customer_id, assignedTo]
      );
    }

    await client.query("COMMIT");
    console.table(selected.rows.map((row) => ({
      customer_id: row.customer_id,
      company: row.company,
      previous_assigned_to: row.assigned_to,
      assigned_to: assignedTo,
    })));
    console.log(`Assigned customer range ${start}-${end} to ${assignedTo}.`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
