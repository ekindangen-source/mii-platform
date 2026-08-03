const express = require("express");

const pool = require("../db/database");
const {
  requireAuth,
  requireRole,
} = require("../middleware/auth");
const {
  customerAccessCondition,
  ensureCustomerAccess,
} = require("../middleware/customerAccess");

const router = express.Router();

const ACTIVITY_TYPES = new Set([
  "meeting",
  "visit",
  "call",
  "follow_up",
]);
const ACTIVITY_STATUSES = new Set([
  "planned",
  "confirmed",
  "completed",
  "cancelled",
  "rescheduled",
  "no_show",
]);
const EDITABLE_STATUSES = new Set([
  "planned",
  "confirmed",
  "cancelled",
  "rescheduled",
  "no_show",
]);
const WRITE_ROLES = [
  "admin",
  "manager",
  "sales",
  "technician",
];
const DEFAULT_TIMEZONE = "Asia/Jakarta";

function nullable(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  return value;
}

function normalizeType(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  return ACTIVITY_TYPES.has(normalized)
    ? normalized
    : null;
}

function normalizeStatus(value, fallback = "planned") {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalized = String(value)
    .trim()
    .toLowerCase();

  return ACTIVITY_STATUSES.has(normalized)
    ? normalized
    : null;
}

function normalizeTimestamp(value, label, required = false) {
  const normalized = nullable(value);

  if (!normalized) {
    if (required) {
      const error = new Error(`${label} is required`);
      error.status = 400;
      throw error;
    }

    return null;
  }

  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    const error = new Error(`${label} is invalid`);
    error.status = 400;
    throw error;
  }

  return parsed.toISOString();
}

function normalizeDate(value, label = "Date") {
  const normalized = String(value || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const error = new Error(`${label} must use YYYY-MM-DD`);
    error.status = 400;
    throw error;
  }

  return normalized;
}

function normalizeTimeZone(value) {
  const timeZone = String(value || DEFAULT_TIMEZONE).trim();

  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return timeZone;
  } catch (_error) {
    const error = new Error("Time zone is invalid");
    error.status = 400;
    throw error;
  }
}

function normalizeNextActionDate(value) {
  const normalized = nullable(value);

  if (!normalized) {
    return null;
  }

  return normalizeDate(normalized, "Next action date");
}

function isManager(user) {
  return ["admin", "manager"].includes(user?.role);
}

function canWrite(user) {
  return WRITE_ROLES.includes(user?.role);
}

function sendError(res, error) {
  const status = Number(error.status) || 500;

  return res.status(status).json({
    status: "ERROR",
    message:
      status === 500
        ? error.message || "Internal server error"
        : error.message,
  });
}

async function validateContact(client, customerId, contactId) {
  if (!contactId) {
    return null;
  }

  const result = await client.query(
    `SELECT contact_id
     FROM customer_contacts
     WHERE
       customer_id = $1
       AND contact_id = $2
       AND is_active = true`,
    [customerId, contactId]
  );

  if (result.rowCount === 0) {
    const error = new Error(
      "The selected active PIC does not belong to this customer"
    );
    error.status = 400;
    throw error;
  }

  return contactId;
}

async function validateAssignee(client, user, assignedTo, defaultAssignee) {
  const resolved =
    nullable(assignedTo) || nullable(defaultAssignee) || user.userId;

  if (!isManager(user) && resolved !== user.userId) {
    const error = new Error(
      "Only administrators and managers can assign activities to another user"
    );
    error.status = 403;
    throw error;
  }

  const result = await client.query(
    `SELECT user_id
     FROM app_users
     WHERE user_id = $1 AND is_active = true`,
    [resolved]
  );

  if (result.rowCount === 0) {
    const error = new Error("Assigned user is not active");
    error.status = 400;
    throw error;
  }

  return resolved;
}

function validateSchedule({ start, end, reminderAt }) {
  const startDate = new Date(start);

  if (end && new Date(end) <= startDate) {
    const error = new Error(
      "Scheduled end must be after scheduled start"
    );
    error.status = 400;
    throw error;
  }

  if (reminderAt && new Date(reminderAt) > startDate) {
    const error = new Error(
      "Reminder must be at or before the scheduled start"
    );
    error.status = 400;
    throw error;
  }
}

const SELECT_ACTIVITY = `
  SELECT
    sa.*,
    c.company AS customer_name,
    c.account_type,
    cc.full_name AS contact_name,
    cc.job_title AS contact_job_title,
    au.full_name AS assigned_to_name,
    au.email AS assigned_to_email,
    creator.full_name AS created_by_name,
    updater.full_name AS updated_by_name,
    ci.interaction_type AS completed_interaction_type,
    ci.interaction_at AS completed_interaction_at
  FROM scheduled_activities sa
  INNER JOIN customers c
    ON c.customer_id = sa.customer_id
  LEFT JOIN customer_contacts cc
    ON cc.customer_id = sa.customer_id
    AND cc.contact_id = sa.contact_id
  INNER JOIN app_users au
    ON au.user_id = sa.assigned_to
  LEFT JOIN app_users creator
    ON creator.user_id = sa.created_by
  LEFT JOIN app_users updater
    ON updater.user_id = sa.updated_by
  LEFT JOIN customer_interactions ci
    ON ci.interaction_id = sa.completed_interaction_id
`;

async function loadActivity(activityId) {
  const result = await pool.query(
    `${SELECT_ACTIVITY}
     WHERE sa.activity_id = $1`,
    [activityId]
  );

  return result.rows[0] || null;
}

async function getActivityForUpdate(client, activityId, user) {
  const result = await client.query(
    `SELECT *
     FROM scheduled_activities
     WHERE activity_id = $1
     FOR UPDATE`,
    [activityId]
  );

  if (result.rowCount === 0) {
    const error = new Error("Scheduled activity not found");
    error.status = 404;
    throw error;
  }

  const activity = result.rows[0];

  if (!isManager(user) && activity.assigned_to !== user.userId) {
    const error = new Error(
      "You can only manage activities assigned to you"
    );
    error.status = 403;
    throw error;
  }

  return activity;
}

function ownerWhere(user, parameterIndex, requestedAssignee) {
  if (isManager(user)) {
    if (
      requestedAssignee &&
      requestedAssignee !== "all"
    ) {
      return {
        clause: `sa.assigned_to = $${parameterIndex}`,
        value: requestedAssignee,
      };
    }

    return null;
  }

  return {
    clause: `sa.assigned_to = $${parameterIndex}`,
    value: user.userId,
  };
}

// Active users available for assignment.
router.get("/users", requireAuth, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT user_id, full_name, email, role
       FROM app_users
       WHERE is_active = true
       ORDER BY full_name, user_id`
    );

    return res.json(result.rows);
  } catch (error) {
    return sendError(res, error);
  }
});

// Agenda buckets for one local calendar date.
router.get("/agenda", requireAuth, async (req, res) => {
  try {
    const reportDate = normalizeDate(
      req.query.date ||
        new Intl.DateTimeFormat("en-CA", {
          timeZone: DEFAULT_TIMEZONE,
        }).format(new Date())
    );
    const timeZone = normalizeTimeZone(req.query.timeZone);
    const parameters = [reportDate, timeZone];
    const owner = ownerWhere(
      req.user,
      parameters.length + 1,
      nullable(req.query.assignedTo)
    );
    const ownerClause = owner
      ? `AND ${owner.clause}`
      : "";

    if (owner) {
      parameters.push(owner.value);
    }

    const result = await pool.query(
      `${SELECT_ACTIVITY}
       WHERE
         (
           (
             sa.status IN ('planned', 'confirmed')
             AND sa.scheduled_start < (
               ($1::date)::timestamp AT TIME ZONE $2
             )
           )
           OR (
             sa.scheduled_start >= (
               ($1::date)::timestamp AT TIME ZONE $2
             )
             AND sa.scheduled_start < (
               (($1::date + 8)::date)::timestamp AT TIME ZONE $2
             )
           )
         )
         ${ownerClause}
       ORDER BY sa.scheduled_start, sa.activity_id`,
      parameters
    );

    const startOfDayResult = await pool.query(
      `SELECT
         (($1::date)::timestamp AT TIME ZONE $2) AS start_of_day,
         ((($1::date + 1)::date)::timestamp AT TIME ZONE $2) AS end_of_day`,
      [reportDate, timeZone]
    );
    const startOfDay = new Date(
      startOfDayResult.rows[0].start_of_day
    );
    const endOfDay = new Date(
      startOfDayResult.rows[0].end_of_day
    );

    const overdue = [];
    const today = [];
    const upcoming = [];

    result.rows.forEach((activity) => {
      const scheduled = new Date(activity.scheduled_start);

      if (
        ["planned", "confirmed"].includes(activity.status) &&
        scheduled < startOfDay
      ) {
        overdue.push(activity);
      } else if (scheduled >= startOfDay && scheduled < endOfDay) {
        today.push(activity);
      } else if (scheduled >= endOfDay) {
        upcoming.push(activity);
      }
    });

    return res.json({
      date: reportDate,
      timeZone,
      overdue,
      today,
      upcoming,
      counts: {
        overdue: overdue.length,
        today: today.length,
        upcoming: upcoming.length,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
});

// General list used by the customer schedule workspace.
router.get("/", requireAuth, async (req, res) => {
  try {
    const clauses = [];
    const parameters = [];

    const add = (clause, value) => {
      parameters.push(value);
      clauses.push(clause.replace("?", `$${parameters.length}`));
    };

    const access = customerAccessCondition(
      req.user,
      "c",
      parameters.length + 1
    );
    parameters.push(...access.parameters);
    clauses.push(access.clause);

    if (nullable(req.query.customerId)) {
      add("sa.customer_id = ?", nullable(req.query.customerId));
    }

    if (nullable(req.query.status)) {
      const statuses = String(req.query.status)
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter((item) => ACTIVITY_STATUSES.has(item));

      if (statuses.length) {
        add("sa.status = ANY(?::text[])", statuses);
      }
    }

    if (nullable(req.query.from)) {
      add("sa.scheduled_start >= ?::timestamptz", normalizeTimestamp(req.query.from, "From date"));
    }

    if (nullable(req.query.to)) {
      add("sa.scheduled_start < ?::timestamptz", normalizeTimestamp(req.query.to, "To date"));
    }

    const owner = ownerWhere(
      req.user,
      parameters.length + 1,
      nullable(req.query.assignedTo)
    );

    if (owner) {
      parameters.push(owner.value);
      clauses.push(owner.clause);
    }

    const where = clauses.length
      ? `WHERE ${clauses.join(" AND ")}`
      : "";

    const result = await pool.query(
      `${SELECT_ACTIVITY}
       ${where}
       ORDER BY sa.scheduled_start DESC, sa.activity_id DESC`,
      parameters
    );

    return res.json(result.rows);
  } catch (error) {
    return sendError(res, error);
  }
});

// Create a scheduled activity.
router.post(
  "/",
  requireAuth,
  requireRole(...WRITE_ROLES),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const body = req.body || {};
      const customerId = nullable(body.CustomerID);
      const activityType = normalizeType(body.ActivityType);
      const status = normalizeStatus(body.Status, "planned");
      const purpose = String(body.Purpose || "").trim();
      const start = normalizeTimestamp(
        body.ScheduledStart,
        "Scheduled start",
        true
      );
      const end = normalizeTimestamp(
        body.ScheduledEnd,
        "Scheduled end"
      );
      const reminderAt = normalizeTimestamp(
        body.ReminderAt,
        "Reminder"
      );

      if (!customerId) {
        return res.status(400).json({
          status: "ERROR",
          message: "Customer is required",
        });
      }

      if (!activityType) {
        return res.status(400).json({
          status: "ERROR",
          message: "Activity type is invalid",
        });
      }

      if (!status || !EDITABLE_STATUSES.has(status)) {
        return res.status(400).json({
          status: "ERROR",
          message: "Activity status is invalid",
        });
      }

      if (!purpose) {
        return res.status(400).json({
          status: "ERROR",
          message: "Purpose is required",
        });
      }

      validateSchedule({ start, end, reminderAt });
      const customer = await ensureCustomerAccess(
        client,
        req.user,
        customerId
      );
      const contactId = await validateContact(
        client,
        customerId,
        nullable(body.ContactID)
      );
      const assignedTo = await validateAssignee(
        client,
        req.user,
        nullable(body.AssignedTo),
        isManager(req.user) || customer.assigned_to === req.user.userId
          ? customer.assigned_to
          : req.user.userId
      );

      const result = await client.query(
        `INSERT INTO scheduled_activities
         (
           customer_id,
           contact_id,
           assigned_to,
           activity_type,
           scheduled_start,
           scheduled_end,
           location,
           purpose,
           notes,
           reminder_at,
           status,
           created_by,
           updated_by
         )
         VALUES
         ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)
         RETURNING activity_id`,
        [
          customerId,
          contactId,
          assignedTo,
          activityType,
          start,
          end,
          nullable(body.Location),
          purpose,
          nullable(body.Notes),
          reminderAt,
          status,
          req.user.userId,
        ]
      );

      return res.status(201).json({
        status: "OK",
        activity: await loadActivity(
          result.rows[0].activity_id
        ),
      });
    } catch (error) {
      return sendError(res, error);
    } finally {
      client.release();
    }
  }
);

// Update an activity that has not been completed.
router.put(
  "/:activityId",
  requireAuth,
  requireRole(...WRITE_ROLES),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const existing = await getActivityForUpdate(
        client,
        req.params.activityId,
        req.user
      );

      if (existing.status === "completed") {
        const error = new Error(
          "Completed activities cannot be edited"
        );
        error.status = 409;
        throw error;
      }

      const body = req.body || {};
      const customerId = nullable(body.CustomerID);
      const activityType = normalizeType(body.ActivityType);
      const status = normalizeStatus(body.Status, existing.status);
      const purpose = String(body.Purpose || "").trim();
      const start = normalizeTimestamp(
        body.ScheduledStart,
        "Scheduled start",
        true
      );
      const end = normalizeTimestamp(
        body.ScheduledEnd,
        "Scheduled end"
      );
      const reminderAt = normalizeTimestamp(
        body.ReminderAt,
        "Reminder"
      );

      if (!customerId || !activityType || !purpose) {
        const error = new Error(
          "Customer, activity type, scheduled start, and purpose are required"
        );
        error.status = 400;
        throw error;
      }

      if (!status || !EDITABLE_STATUSES.has(status)) {
        const error = new Error("Activity status is invalid");
        error.status = 400;
        throw error;
      }

      validateSchedule({ start, end, reminderAt });
      await ensureCustomerAccess(client, req.user, customerId);
      const contactId = await validateContact(
        client,
        customerId,
        nullable(body.ContactID)
      );
      const assignedTo = await validateAssignee(
        client,
        req.user,
        nullable(body.AssignedTo),
        existing.assigned_to
      );
      const reminderChanged =
        String(existing.reminder_at || "") !==
        String(reminderAt || "");

      await client.query(
        `UPDATE scheduled_activities
         SET
           customer_id = $2,
           contact_id = $3,
           assigned_to = $4,
           activity_type = $5,
           scheduled_start = $6,
           scheduled_end = $7,
           location = $8,
           purpose = $9,
           notes = $10,
           reminder_at = $11,
           status = $12,
           reminder_sent_at = CASE
             WHEN $13::boolean THEN NULL
             ELSE reminder_sent_at
           END,
           reminder_attempt_count = CASE
             WHEN $13::boolean THEN 0
             ELSE reminder_attempt_count
           END,
           reminder_last_attempt_at = CASE
             WHEN $13::boolean THEN NULL
             ELSE reminder_last_attempt_at
           END,
           reminder_error = CASE
             WHEN $13::boolean THEN NULL
             ELSE reminder_error
           END,
           updated_by = $14,
           updated_at = NOW()
         WHERE activity_id = $1`,
        [
          req.params.activityId,
          customerId,
          contactId,
          assignedTo,
          activityType,
          start,
          end,
          nullable(body.Location),
          purpose,
          nullable(body.Notes),
          reminderAt,
          status,
          reminderChanged,
          req.user.userId,
        ]
      );

      if (existing.source_interaction_id) {
        await client.query(
          `UPDATE customer_interactions
           SET
             next_action = CASE
               WHEN $6 IN ('cancelled', 'no_show') THEN NULL
               ELSE $2
             END,
             next_action_at = CASE
               WHEN $6 IN ('cancelled', 'no_show') THEN NULL
               ELSE $3::timestamptz
             END,
             next_action_date = CASE
               WHEN $6 IN ('cancelled', 'no_show') THEN NULL
               ELSE ($3::timestamptz AT TIME ZONE $4)::date
             END,
             updated_by = $5,
             updated_at = NOW()
           WHERE interaction_id = $1`,
          [
            existing.source_interaction_id,
            purpose,
            start,
            DEFAULT_TIMEZONE,
            req.user.userId,
            status,
          ]
        );
      }

      await client.query("COMMIT");

      return res.json({
        status: "OK",
        activity: await loadActivity(req.params.activityId),
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      return sendError(res, error);
    } finally {
      client.release();
    }
  }
);

// Complete an activity and create one customer interaction atomically.
router.post(
  "/:activityId/complete",
  requireAuth,
  requireRole(...WRITE_ROLES),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const activity = await getActivityForUpdate(
        client,
        req.params.activityId,
        req.user
      );

      if (activity.completed_interaction_id) {
        await client.query("COMMIT");
        return res.json({
          status: "OK",
          message: "Activity was already completed",
          activity: await loadActivity(req.params.activityId),
          interactionId: activity.completed_interaction_id,
        });
      }

      if (["cancelled", "rescheduled", "no_show"].includes(activity.status)) {
        const error = new Error(
          "Cancelled, rescheduled, or no-show activities cannot be completed"
        );
        error.status = 409;
        throw error;
      }

      const body = req.body || {};
      const interactionType =
        activity.activity_type === "follow_up"
          ? "other"
          : activity.activity_type;
      const outcomeNotes = String(
        body.OutcomeNotes ||
          activity.notes ||
          activity.purpose ||
          "Completed scheduled activity"
      ).trim();
      const interactionAt = normalizeTimestamp(
        body.InteractionAt || new Date().toISOString(),
        "Interaction date and time",
        true
      );

      const nextAction = nullable(body.NextAction);
      const nextActionAt = normalizeTimestamp(
        body.NextActionAt,
        "Next action date and time"
      );

      if (Boolean(nextAction) !== Boolean(nextActionAt)) {
        const error = new Error(
          "Next action and next action date and time must both be provided"
        );
        error.status = 400;
        throw error;
      }

      const interaction = await client.query(
        `INSERT INTO customer_interactions
         (
           customer_id,
           contact_id,
           interaction_type,
           interaction_at,
           participants,
           notes,
           next_action,
           next_action_date,
           next_action_at,
           created_by,
           updated_by
         )
         VALUES (
           $1,$2,$3,$4,$5,$6,$7,
           CASE
             WHEN $8::timestamptz IS NULL THEN NULL
             ELSE ($8::timestamptz AT TIME ZONE $9)::date
           END,
           $8,$10,$10
         )
         RETURNING interaction_id`,
        [
          activity.customer_id,
          activity.contact_id,
          interactionType,
          interactionAt,
          nullable(body.Participants),
          outcomeNotes,
          nextAction,
          nextActionAt,
          DEFAULT_TIMEZONE,
          req.user.userId,
        ]
      );

      let followUpActivityId = null;

      if (nextActionAt) {
        const followUpPurpose =
          nextAction || `Follow-up: ${activity.purpose}`;
        const followUpNotes =
          `Created automatically from completed activity ${activity.activity_id}.`;

        const followUp = await client.query(
          `INSERT INTO scheduled_activities
           (
             customer_id,
             contact_id,
             assigned_to,
             activity_type,
             scheduled_start,
             scheduled_end,
             location,
             purpose,
             notes,
             reminder_at,
             status,
             source_interaction_id,
             created_by,
             updated_by
           )
           SELECT
             sa.customer_id,
             sa.contact_id,
             sa.assigned_to,
             'follow_up',
             $2::timestamptz,
             NULL,
             NULL,
             $3,
             $4,
             $2::timestamptz - INTERVAL '15 minutes',
             'planned',
             $5,
             $6,
             $6
           FROM scheduled_activities sa
           WHERE sa.activity_id = $1
           RETURNING activity_id`,
          [
            activity.activity_id,
            nextActionAt,
            followUpPurpose,
            followUpNotes,
            interaction.rows[0].interaction_id,
            req.user.userId,
          ]
        );

        followUpActivityId =
          followUp.rows[0]?.activity_id || null;
      }

      await client.query(
        `UPDATE scheduled_activities
         SET
           status = 'completed',
           completed_interaction_id = $2,
           reminder_error = NULL,
           updated_by = $3,
           updated_at = NOW()
         WHERE activity_id = $1`,
        [
          req.params.activityId,
          interaction.rows[0].interaction_id,
          req.user.userId,
        ]
      );

      await client.query("COMMIT");

      return res.json({
        status: "OK",
        message: followUpActivityId
          ? "Activity completed, interaction created, and follow-up added to Agenda"
          : "Activity completed and interaction created",
        activity: await loadActivity(req.params.activityId),
        interactionId: interaction.rows[0].interaction_id,
        followUpActivityId,
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      return sendError(res, error);
    } finally {
      client.release();
    }
  }
);

// Delete only non-completed activities. Managers and administrators only.
router.delete(
  "/:activityId",
  requireAuth,
  requireRole("admin", "manager"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `DELETE FROM scheduled_activities
         WHERE
           activity_id = $1
           AND completed_interaction_id IS NULL
           AND status <> 'completed'
           AND source_interaction_id IS NULL
         RETURNING *`,
        [req.params.activityId]
      );

      if (result.rowCount === 0) {
        return res.status(409).json({
          status: "ERROR",
          message:
            "Scheduled activity was not found, has already been completed, or is managed from Interaction History",
        });
      }

      return res.json({
        status: "OK",
        message: "Scheduled activity deleted",
        activity: result.rows[0],
      });
    } catch (error) {
      return sendError(res, error);
    }
  }
);

module.exports = router;
