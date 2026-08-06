require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");

const pool = require("./db/database");
const { requireAuth } = require("./middleware/auth");
const {
  startDailySummaryJob,
} = require("./jobs/dailySummaryJob");
const {
  startScheduledActivityReminderJob,
} = require("./jobs/scheduledActivityReminderJob");

const adminUsersRoutes = require("./routes/adminUsers");
const invitationsRoutes = require("./routes/invitations");
const app = express();

app.use(cors());

// Photo uploads are sent as base64 JSON.
// 8 MB comfortably supports compressed vessel and interaction photos.
app.use(express.json({ limit: "8mb" }));
app.use(
  express.urlencoded({
    extended: true,
    limit: "8mb",
  })
);

// Public static photo delivery.
// Through the existing Nginx /api proxy, a stored path such as
// /uploads/vessels/file.jpg is available to the frontend at
// /api/uploads/vessels/file.jpg.
app.use(
  "/uploads",
  express.static(
    path.join(__dirname, "uploads"),
    {
      dotfiles: "deny",
      index: false,
      maxAge: "30d",
      immutable: true,
    }
  )
);

app.get("/health", (_req, res) => {
  res.json({
    status: "OK",
    service: "MII CRM API",
  });
});

app.get("/health/db", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT NOW() AS db_time"
    );

    res.json({
      status: "OK",
      database: "connected",
      time: result.rows[0].db_time,
    });
  } catch (err) {
    console.error(
      "Database health check failed:",
      err
    );

    res.status(500).json({
      status: "ERROR",
      message: err.message,
      code: err.code,
    });
  }
});

app.use("/auth", require("./routes/auth"));

app.use("/admin/users", adminUsersRoutes);
app.use("/invitations", invitationsRoutes);

app.post("/users", (_req, res) => {
  res.status(410).json({
    status: "ERROR",
    message:
      "Password-based user creation is disabled. Use the invitation workflow.",
  });
});

app.use(
  "/master-data",
  requireAuth,
  require("./routes/masterData.js")
);
app.use(
  "/customers/:customerId/contacts",
  requireAuth,
  require("./routes/customerContacts.js")
);
app.use(
  "/customers/:customerId/interactions",
  requireAuth,
  require("./routes/customerInteractions.js")
);
app.use(
  "/scheduled-activities",
  requireAuth,
  require("./routes/scheduledActivities.js")
);
app.use(
  "/opportunities",
  requireAuth,
  require("./routes/opportunities.js")
);
app.use(
  "/customers",
  requireAuth,
  require("./routes/customers.js")
);
app.use(
  "/vessels",
  requireAuth,
  require("./routes/vessels.js")
);
app.use(
  "/engines",
  requireAuth,
  require("./routes/engines.js")
);
app.use(
  "/trips",
  requireAuth,
  require("./routes/trips.js")
);
app.use(
  "/maintenance",
  requireAuth,
  require("./routes/maintenance.js")
);

app.use((_req, res) => {
  res.status(404).json({
    status: "ERROR",
    message: "Route not found",
  });
});

app.use((err, _req, res, _next) => {
  console.error(err);

  if (
    err?.type === "entity.too.large" ||
    err?.status === 413
  ) {
    return res.status(413).json({
      status: "ERROR",
      message:
        "Uploaded photo is too large",
    });
  }

  return res.status(500).json({
    status: "ERROR",
    message: "Internal server error",
  });
});

startDailySummaryJob();
startScheduledActivityReminderJob();

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `MII CRM API running on port ${PORT}`
  );
});
