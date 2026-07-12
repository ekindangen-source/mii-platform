require("dotenv").config();

const bcrypt = require("bcryptjs");
const pool = require("./db/database");

async function run() {
  const [,, userId, fullName, email, password] = process.argv;

  if (!userId || !fullName || !email || !password) {
    console.error(
      'Usage: node create-admin.js ADMIN-001 "Admin Name" admin@example.com StrongPassword'
    );
    process.exit(1);
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO app_users
       (user_id, full_name, email, password_hash, role)
       VALUES ($1,$2,$3,$4,'admin')
       ON CONFLICT (email)
       DO UPDATE SET
         full_name = EXCLUDED.full_name,
         password_hash = EXCLUDED.password_hash,
         role = 'admin',
         is_active = TRUE,
         updated_at = NOW()
       RETURNING user_id, full_name, email, role`,
      [userId, fullName, email.toLowerCase(), passwordHash]
    );

    console.log("Admin user ready:", result.rows[0]);
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();