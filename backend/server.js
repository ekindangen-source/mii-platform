require("dotenv").config();

const express = require("express");
const cors = require("cors");

const pool = require("./db/database");

const { requireAuth } = require("./middleware/auth");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add the auth route BEFORE protected routes:

// app.use("/auth", require("./routes/auth"));

// Protect the CRM modules like this:

//app.use("/customers", requireAuth, require("./routes/customers"));
//app.use("/vessels", requireAuth, require("./routes/vessels"));
//app.use("/engines", requireAuth, require("./routes/engines"));
//app.use("/trips", requireAuth, require("./routes/trips"));
//app.use("/maintenance", requireAuth, require("./routes/maintenance"));

// Keep these public:

//app.get("/health", ...);
//app.get("/health/db", ...);
//app.use("/auth", require("./routes/auth"));

//app.use(cors());
//app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    service: "MII CRM API"
  });
});

// Database health check
app.get("/health/db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS db_time");

    res.json({
      status: "OK",
      database: "connected",
      time: result.rows[0].db_time
    });
  } catch (err) {
    console.error("Database health check failed:", err);

    res.status(500).json({
      status: "ERROR",
      message: err.message,
      code: err.code
    });
  }
});

app.use("/auth", require("./routes/auth"));

// Route modules
app.use("/customers", requireAuth, require("./routes/customers.js"));
app.use("/vessels", requireAuth, require("./routes/vessels.js"));
app.use("/engines", requireAuth, require("./routes/engines.js"));
app.use("/trips", requireAuth, require("./routes/trips.js"));
app.use("/maintenance", requireAuth, require("./routes/maintenance.js"));

// Catch unknown routes
app.use((req, res) => {
  res.status(404).json({
    status: "ERROR",
    message: "Route not found"
  });
});

// General error handler
app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    status: "ERROR",
    message: "Internal server error"
  });
});

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`MII CRM API running on port ${PORT}`);
});
