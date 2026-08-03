const {
  createTransporter,
  getEmailConfig,
} = require("./dailySummaryEmail");

const DEFAULT_TIMEZONE = "Asia/Jakarta";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDateTime(value, timeZone) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function activityTypeLabel(value) {
  const labels = {
    meeting: "Meeting",
    visit: "Customer Visit",
    call: "Scheduled Call",
    follow_up: "Follow-up",
  };

  return labels[value] || String(value || "Activity");
}

async function sendScheduledActivityReminder(activity, options = {}) {
  const config = getEmailConfig();
  const timeZone =
    options.timeZone ||
    process.env.SCHEDULE_REMINDER_TIMEZONE ||
    process.env.DAILY_SUMMARY_TIMEZONE ||
    DEFAULT_TIMEZONE;
  const recipient = String(
    activity.assigned_to_email || ""
  ).trim();

  if (!recipient) {
    throw new Error(
      `Assigned user ${activity.assigned_to} has no email address`
    );
  }

  const transporter = createTransporter();
  const typeLabel = activityTypeLabel(
    activity.activity_type
  );
  const when = formatDateTime(
    activity.scheduled_start,
    timeZone
  );
  const subject =
    `MII Reminder: ${typeLabel} with ` +
    `${activity.customer_name} at ${when}`;

  const details = [
    ["Activity", typeLabel],
    ["Customer", activity.customer_name],
    ["PIC", activity.contact_name || "-"],
    ["Scheduled", when],
    ["Location", activity.location || "-"],
    ["Purpose", activity.purpose],
    ["Notes", activity.notes || "-"],
    ["Activity ID", activity.activity_id],
  ];

  const text = [
    "MII Platform Scheduled Activity Reminder",
    "",
    ...details.map(([label, value]) => `${label}: ${value}`),
    "",
    "Open MII Platform to update or complete this activity.",
  ].join("\n");

  const htmlRows = details
    .map(
      ([label, value]) => `
        <tr>
          <th style="
            padding:8px;
            border-bottom:1px solid #e5e7eb;
            text-align:left;
            width:130px;
            color:#475569;
          ">${escapeHtml(label)}</th>
          <td style="
            padding:8px;
            border-bottom:1px solid #e5e7eb;
          ">${escapeHtml(value)}</td>
        </tr>
      `
    )
    .join("");

  const html = `
    <!doctype html>
    <html>
      <body style="
        margin:0;
        padding:24px;
        background:#f5f7fa;
        font-family:Arial,Helvetica,sans-serif;
        color:#1f2937;
      ">
        <div style="
          max-width:680px;
          margin:0 auto;
          background:#ffffff;
          border-radius:10px;
          overflow:hidden;
          border:1px solid #dbe3ec;
        ">
          <div style="
            padding:20px;
            background:#17365d;
            color:#ffffff;
          ">
            <h1 style="margin:0;font-size:22px;">
              Scheduled Activity Reminder
            </h1>
            <p style="margin:6px 0 0;color:#dbeafe;">
              ${escapeHtml(activity.assigned_to_name || recipient)}
            </p>
          </div>
          <div style="padding:20px;">
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              ${htmlRows}
            </table>
            <p style="margin:20px 0 0;color:#64748b;font-size:13px;">
              Open MII Platform to update or complete this activity.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  const result = await transporter.sendMail({
    from: config.from,
    to: recipient,
    subject,
    text,
    html,
  });

  return {
    messageId: result.messageId,
    recipient,
  };
}

module.exports = {
  sendScheduledActivityReminder,
};
