const fs = require("fs");
const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "..", ".env"),
  override: true,
});

const pool = require("../db/database");

async function main() {
  const suppliedPath = process.argv[2];

  if (!suppliedPath) {
    throw new Error(
      "Usage: node scripts/run-sql-file.js <sql-file>"
    );
  }

  const sqlPath = path.resolve(process.cwd(), suppliedPath);
  const sql = fs.readFileSync(sqlPath, "utf8");

  console.log(`Running SQL file: ${sqlPath}`);

  try {
    await pool.query(sql);
    console.log("SQL completed successfully.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("SQL failed:", error.message);
  process.exitCode = 1;
});
