const nodemailer = require("nodemailer");

const pool = require("../db/database");

const DEFAULT_TIMEZONE = "Asia/Jakarta";

function getReportDate(
  timeZone = DEFAULT_TIMEZONE,
  date = new Date()
) {
  const parts = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).formatToParts(date);

  const values = Object.fromEntries(
    parts.map((part) => [
      part.type,
      part.value,
    ])
  );

  return [
    values.year,
    values.month,
    values.day,
  ].join("-");
}

function parseRecipients(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBoolean(
  value,
  fallback = false
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(
    String(value).trim().toLowerCase()
  );
}

function getEmailConfig() {
  const recipients = parseRecipients(
    process.env.DAILY_SUMMARY_TO
  );

  return {
    recipients,
    timeZone:
      process.env.DAILY_SUMMARY_TIMEZONE ||
      DEFAULT_TIMEZONE,
    from:
      process.env.SMTP_FROM ||
      process.env.SMTP_USER ||
      "",
    smtp: {
      host: process.env.SMTP_HOST || "",
      port: Number(
        process.env.SMTP_PORT || 587
      ),
      secure: parseBoolean(
        process.env.SMTP_SECURE,
        false
      ),
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
    },
  };
}

function validateEmailConfig() {
  const config = getEmailConfig();
  const missing = [];

  if (!config.recipients.length) {
    missing.push("DAILY_SUMMARY_TO");
  }

  if (!config.from) {
    missing.push("SMTP_FROM");
  }

  if (!config.smtp.host) {
    missing.push("SMTP_HOST");
  }

  if (!config.smtp.port) {
    missing.push("SMTP_PORT");
  }

  if (!config.smtp.user) {
    missing.push("SMTP_USER");
  }

  if (!config.smtp.pass) {
    missing.push("SMTP_PASS");
  }

  return {
    valid: missing.length === 0,
    missing,
    config,
  };
}

function createTransporter() {
  const {
    valid,
    missing,
    config,
  } = validateEmailConfig();

  if (!valid) {
    throw new Error(
      `Missing email configuration: ${missing.join(
        ", "
      )}`
    );
  }

  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });
}

async function verifyEmailTransport() {
  const transporter = createTransporter();
  await transporter.verify();
  return true;
}

const queries = {
  customers: `
    SELECT
      c.customer_id,
      c.company,
      c.contact_person,
      c.telephone,
      c.email,
      c.province,
      c.home_port,
      c.created_at
    FROM customers c
    WHERE
      c.created_at >= (
        ($1::date)::timestamp
        AT TIME ZONE $2
      )
      AND c.created_at < (
        (($1::date + 1)::date)::timestamp
        AT TIME ZONE $2
      )
    ORDER BY c.created_at, c.customer_id
  `,
  vessels: `
    SELECT
      v.vessel_id,
      v.boat_name,
      v.home_port,
      v.hull_type,
      v.customer_id,
      c.company AS customer_name,
      v.created_at
    FROM vessels v
    LEFT JOIN customers c
      ON c.customer_id = v.customer_id
    WHERE
      v.created_at >= (
        ($1::date)::timestamp
        AT TIME ZONE $2
      )
      AND v.created_at < (
        (($1::date + 1)::date)::timestamp
        AT TIME ZONE $2
      )
    ORDER BY v.created_at, v.vessel_id
  `,
  engines: `
    SELECT
      e.engine_id,
      e.brand,
      e.model,
      e.hp,
      e.serial_number,
      e.vessel_id,
      v.boat_name,
      e.created_at
    FROM engines e
    LEFT JOIN vessels v
      ON v.vessel_id = e.vessel_id
    WHERE
      e.created_at >= (
        ($1::date)::timestamp
        AT TIME ZONE $2
      )
      AND e.created_at < (
        (($1::date + 1)::date)::timestamp
        AT TIME ZONE $2
      )
    ORDER BY e.created_at, e.engine_id
  `,
  trips: `
    SELECT
      t.trip_id,
      t.trip_date,
      t.operating_hours,
      t.distance_nm,
      t.captain,
      t.vessel_id,
      v.boat_name,
      t.created_at
    FROM trips t
    LEFT JOIN vessels v
      ON v.vessel_id = t.vessel_id
    WHERE
      t.created_at >= (
        ($1::date)::timestamp
        AT TIME ZONE $2
      )
      AND t.created_at < (
        (($1::date + 1)::date)::timestamp
        AT TIME ZONE $2
      )
    ORDER BY t.created_at, t.trip_id
  `,
  maintenance: `
    SELECT
      m.maintenance_id,
      m.service_date,
      m.service_type,
      m.technician,
      m.status,
      m.engine_id,
      e.brand,
      e.model,
      e.vessel_id,
      v.boat_name,
      m.created_at
    FROM maintenance m
    LEFT JOIN engines e
      ON e.engine_id = m.engine_id
    LEFT JOIN vessels v
      ON v.vessel_id = e.vessel_id
    WHERE
      m.created_at >= (
        ($1::date)::timestamp
        AT TIME ZONE $2
      )
      AND m.created_at < (
        (($1::date + 1)::date)::timestamp
        AT TIME ZONE $2
      )
    ORDER BY
      m.created_at,
      m.maintenance_id
  `,
};

async function loadDailySummary({
  reportDate,
  timeZone,
}) {
  const parameters = [
    reportDate,
    timeZone,
  ];

  const [
    customers,
    vessels,
    engines,
    trips,
    maintenance,
  ] = await Promise.all([
    pool.query(
      queries.customers,
      parameters
    ),
    pool.query(
      queries.vessels,
      parameters
    ),
    pool.query(
      queries.engines,
      parameters
    ),
    pool.query(
      queries.trips,
      parameters
    ),
    pool.query(
      queries.maintenance,
      parameters
    ),
  ]);

  return {
    customers: customers.rows,
    vessels: vessels.rows,
    engines: engines.rows,
    trips: trips.rows,
    maintenance: maintenance.rows,
  };
}

function escapeHtml(value) {
  return String(
    value ?? ""
  )
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function displayValue(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return "—";
  }

  return String(value);
}

function formatTime(value, timeZone) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  ).format(new Date(value));
}

function renderHtmlTable({
  title,
  rows,
  columns,
  timeZone,
}) {
  const body = rows.length
    ? rows
        .map(
          (row) => `
            <tr>
              ${columns
                .map((column) => {
                  const rawValue =
                    column.key === "created_at"
                      ? formatTime(
                          row[column.key],
                          timeZone
                        )
                      : displayValue(
                          row[column.key]
                        );

                  return `
                    <td style="
                      padding:8px;
                      border-bottom:1px solid #e5e7eb;
                      vertical-align:top;
                    ">
                      ${escapeHtml(rawValue)}
                    </td>
                  `;
                })
                .join("")}
            </tr>
          `
        )
        .join("")
    : `
      <tr>
        <td
          colspan="${columns.length}"
          style="
            padding:12px;
            color:#64748b;
            font-style:italic;
          "
        >
          No new records.
        </td>
      </tr>
    `;

  return `
    <section style="margin:0 0 28px">
      <h2 style="
        margin:0 0 10px;
        color:#17365d;
        font-size:18px;
      ">
        ${escapeHtml(title)}
        <span style="
          color:#64748b;
          font-weight:normal;
        ">
          (${rows.length})
        </span>
      </h2>

      <div style="
        overflow-x:auto;
        border:1px solid #dbe3ec;
        border-radius:8px;
      ">
        <table
          role="presentation"
          style="
            width:100%;
            border-collapse:collapse;
            font-size:13px;
          "
        >
          <thead>
            <tr style="
              background:#eef4f8;
              color:#17365d;
              text-align:left;
            ">
              ${columns
                .map(
                  (column) => `
                    <th style="
                      padding:8px;
                      border-bottom:1px solid #dbe3ec;
                    ">
                      ${escapeHtml(
                        column.label
                      )}
                    </th>
                  `
                )
                .join("")}
            </tr>
          </thead>
          <tbody>
            ${body}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderSummaryHtml({
  reportDate,
  timeZone,
  data,
}) {
  const total =
    data.customers.length +
    data.vessels.length +
    data.engines.length +
    data.trips.length +
    data.maintenance.length;

  const cards = [
    ["Customers", data.customers.length],
    ["Vessels", data.vessels.length],
    ["Engines", data.engines.length],
    ["Trips", data.trips.length],
    [
      "Maintenance",
      data.maintenance.length,
    ],
  ]
    .map(
      ([label, count]) => `
        <td style="
          width:20%;
          padding:10px;
          text-align:center;
          background:#eef4f8;
          border:4px solid #ffffff;
        ">
          <div style="
            color:#17365d;
            font-size:22px;
            font-weight:bold;
          ">
            ${count}
          </div>
          <div style="
            color:#64748b;
            font-size:12px;
          ">
            ${escapeHtml(label)}
          </div>
        </td>
      `
    )
    .join("");

  return `
    <!doctype html>
    <html>
      <body style="
        margin:0;
        padding:0;
        background:#f5f7fa;
        font-family:Arial,Helvetica,sans-serif;
        color:#1f2937;
      ">
        <div style="
          max-width:1000px;
          margin:0 auto;
          padding:24px;
        ">
          <div style="
            background:#17365d;
            color:#ffffff;
            padding:22px;
            border-radius:10px 10px 0 0;
          ">
            <h1 style="
              margin:0 0 6px;
              font-size:24px;
            ">
              MII Platform Daily Activity
            </h1>
            <div style="
              color:#dbeafe;
              font-size:14px;
            ">
              ${escapeHtml(reportDate)}
              · ${escapeHtml(timeZone)}
              · ${total} new record${
                total === 1 ? "" : "s"
              }
            </div>
          </div>

          <div style="
            background:#ffffff;
            padding:22px;
            border-radius:0 0 10px 10px;
          ">
            <table
              role="presentation"
              style="
                width:100%;
                margin:0 0 26px;
                border-collapse:collapse;
              "
            >
              <tr>${cards}</tr>
            </table>

            ${renderHtmlTable({
              title: "New Customers",
              rows: data.customers,
              timeZone,
              columns: [
                {
                  key: "customer_id",
                  label: "ID",
                },
                {
                  key: "company",
                  label: "Customer",
                },
                {
                  key: "contact_person",
                  label: "Contact",
                },
                {
                  key: "telephone",
                  label: "Telephone",
                },
                {
                  key: "province",
                  label: "Province",
                },
                {
                  key: "created_at",
                  label: "Added",
                },
              ],
            })}

            ${renderHtmlTable({
              title: "New Vessels",
              rows: data.vessels,
              timeZone,
              columns: [
                {
                  key: "vessel_id",
                  label: "ID",
                },
                {
                  key: "boat_name",
                  label: "Boat",
                },
                {
                  key: "customer_name",
                  label: "Customer",
                },
                {
                  key: "home_port",
                  label: "Home Port",
                },
                {
                  key: "created_at",
                  label: "Added",
                },
              ],
            })}

            ${renderHtmlTable({
              title: "New Engines",
              rows: data.engines,
              timeZone,
              columns: [
                {
                  key: "engine_id",
                  label: "ID",
                },
                {
                  key: "brand",
                  label: "Brand",
                },
                {
                  key: "model",
                  label: "Model",
                },
                {
                  key: "hp",
                  label: "HP",
                },
                {
                  key: "boat_name",
                  label: "Vessel",
                },
                {
                  key: "created_at",
                  label: "Added",
                },
              ],
            })}

            ${renderHtmlTable({
              title: "New Trips",
              rows: data.trips,
              timeZone,
              columns: [
                {
                  key: "trip_id",
                  label: "ID",
                },
                {
                  key: "trip_date",
                  label: "Trip Date",
                },
                {
                  key: "boat_name",
                  label: "Vessel",
                },
                {
                  key: "operating_hours",
                  label: "Hours",
                },
                {
                  key: "captain",
                  label: "Captain",
                },
                {
                  key: "created_at",
                  label: "Added",
                },
              ],
            })}

            ${renderHtmlTable({
              title: "New Maintenance",
              rows: data.maintenance,
              timeZone,
              columns: [
                {
                  key: "maintenance_id",
                  label: "ID",
                },
                {
                  key: "service_date",
                  label: "Service Date",
                },
                {
                  key: "boat_name",
                  label: "Vessel",
                },
                {
                  key: "brand",
                  label: "Engine",
                },
                {
                  key: "service_type",
                  label: "Service",
                },
                {
                  key: "technician",
                  label: "Technician",
                },
                {
                  key: "created_at",
                  label: "Added",
                },
              ],
            })}

            <p style="
              margin:24px 0 0;
              color:#64748b;
              font-size:12px;
            ">
              This report includes records created
              during the stated WIB calendar day,
              regardless of which application user
              entered them.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function renderTextSection({
  title,
  rows,
  formatter,
}) {
  const lines = rows.length
    ? rows.map(formatter)
    : ["No new records."];

  return [
    `${title} (${rows.length})`,
    ...lines.map((line) => `- ${line}`),
    "",
  ].join("\n");
}

function renderSummaryText({
  reportDate,
  timeZone,
  data,
}) {
  return [
    `MII Platform Daily Activity`,
    `${reportDate} · ${timeZone}`,
    "",
    renderTextSection({
      title: "New Customers",
      rows: data.customers,
      formatter: (row) =>
        [
          row.customer_id,
          row.company,
          row.contact_person,
          row.telephone,
        ]
          .filter(Boolean)
          .join(" · "),
    }),
    renderTextSection({
      title: "New Vessels",
      rows: data.vessels,
      formatter: (row) =>
        [
          row.vessel_id,
          row.boat_name,
          row.customer_name,
          row.home_port,
        ]
          .filter(Boolean)
          .join(" · "),
    }),
    renderTextSection({
      title: "New Engines",
      rows: data.engines,
      formatter: (row) =>
        [
          row.engine_id,
          row.brand,
          row.model,
          row.hp
            ? `${row.hp} HP`
            : null,
          row.boat_name,
        ]
          .filter(Boolean)
          .join(" · "),
    }),
    renderTextSection({
      title: "New Trips",
      rows: data.trips,
      formatter: (row) =>
        [
          row.trip_id,
          row.trip_date,
          row.boat_name,
          row.operating_hours
            ? `${row.operating_hours} hours`
            : null,
        ]
          .filter(Boolean)
          .join(" · "),
    }),
    renderTextSection({
      title: "New Maintenance",
      rows: data.maintenance,
      formatter: (row) =>
        [
          row.maintenance_id,
          row.service_date,
          row.boat_name,
          row.service_type,
          row.technician,
        ]
          .filter(Boolean)
          .join(" · "),
    }),
  ].join("\n");
}

async function sendDailySummaryEmail({
  reportDate,
  timeZone,
}) {
  const {
    config,
  } = validateEmailConfig();

  const data = await loadDailySummary({
    reportDate,
    timeZone,
  });

  const total =
    data.customers.length +
    data.vessels.length +
    data.engines.length +
    data.trips.length +
    data.maintenance.length;

  const transporter = createTransporter();

  const result = await transporter.sendMail({
    from: config.from,
    to: config.recipients,
    subject:
      `MII Daily Activity — ${reportDate}` +
      ` (${total} new)`,
    text: renderSummaryText({
      reportDate,
      timeZone,
      data,
    }),
    html: renderSummaryHtml({
      reportDate,
      timeZone,
      data,
    }),
  });

  return {
    messageId: result.messageId,
    recipients: config.recipients,
    total,
    counts: {
      customers: data.customers.length,
      vessels: data.vessels.length,
      engines: data.engines.length,
      trips: data.trips.length,
      maintenance:
        data.maintenance.length,
    },
  };
}

module.exports = {
  DEFAULT_TIMEZONE,
  getReportDate,
  getEmailConfig,
  validateEmailConfig,
  verifyEmailTransport,
  loadDailySummary,
  sendDailySummaryEmail,
};
