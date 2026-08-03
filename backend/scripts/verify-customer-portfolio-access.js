const pool = require("../db/database");

async function main() {
  const users = await pool.query(
    `SELECT user_id, full_name, role
     FROM app_users
     WHERE is_active = true
     ORDER BY role, full_name, user_id`
  );

  const totals = await pool.query(
    `SELECT
       COUNT(*)::integer AS customers,
       COUNT(*) FILTER (WHERE assigned_to IS NULL)::integer AS unassigned
     FROM customers`
  );

  const visibility = [];

  for (const user of users.rows) {
    let result;

    if (["admin", "manager", "viewer"].includes(user.role)) {
      result = await pool.query(
        `SELECT COUNT(*)::integer AS visible FROM customers`
      );
    } else if (user.role === "sales") {
      result = await pool.query(
        `SELECT COUNT(*)::integer AS visible
         FROM customers
         WHERE assigned_to = $1`,
        [user.user_id]
      );
    } else if (user.role === "technician") {
      result = await pool.query(
        `SELECT COUNT(*)::integer AS visible
         FROM customers c
         WHERE EXISTS (
           SELECT 1
           FROM scheduled_activities sa
           WHERE sa.customer_id = c.customer_id
             AND sa.assigned_to = $1
         )`,
        [user.user_id]
      );
    } else {
      result = { rows: [{ visible: 0 }] };
    }

    visibility.push({
      user_id: user.user_id,
      full_name: user.full_name,
      role: user.role,
      visible_customers: result.rows[0].visible,
    });
  }

  const checks = {
    noOrphanOwners: Number(
      (
        await pool.query(
          `SELECT COUNT(*)::integer AS count
           FROM customers c
           LEFT JOIN app_users u ON u.user_id = c.assigned_to
           WHERE c.assigned_to IS NOT NULL
             AND u.user_id IS NULL`
        )
      ).rows[0].count
    ) === 0,
    noSalesVisibilityOverflow: visibility
      .filter((row) => row.role === "sales")
      .every((row) => row.visible_customers <= totals.rows[0].customers),
  };

  const output = {
    status: Object.values(checks).every(Boolean) ? "OK" : "ERROR",
    checks,
    totals: totals.rows[0],
    visibility,
  };

  console.log(JSON.stringify(output, null, 2));
  if (output.status !== "OK") process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
