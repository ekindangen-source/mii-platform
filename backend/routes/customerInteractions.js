const express = require("express");
const router = express.Router({
  mergeParams: true,
});

const pool = require("../db/database");
const {
  requireAuth,
  requireRole,
} = require("../middleware/auth");
const {
  addInteractionPhotoUrl,
  deleteInteractionPhoto,
  uploadInteractionPhoto,
} = require("../services/interactionPhotoStorage");

const INTERACTION_TYPES = new Set([
  "call",
  "email",
  "meeting",
  "visit",
  "whatsapp",
  "other",
]);
const PHOTO_TYPES = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);
const MAX_PHOTO_BYTES = 1024 * 1024;
const MAX_PHOTOS_PER_INTERACTION = 10;

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

function normalizeInteractionType(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  return INTERACTION_TYPES.has(normalized)
    ? normalized
    : null;
}

function normalizeInteractionAt(value) {
  const parsed = value ? new Date(value) : new Date();

  if (Number.isNaN(parsed.getTime())) {
    const error = new Error(
      "Interaction date and time is invalid"
    );
    error.status = 400;
    throw error;
  }

  return parsed.toISOString();
}

function normalizeNextActionAt(value) {
  const normalized = nullable(value);

  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    const error = new Error("Next action date and time is invalid");
    error.status = 400;
    throw error;
  }

  return parsed.toISOString();
}

function validateNextAction(nextAction, nextActionAt) {
  if (Boolean(nextAction) !== Boolean(nextActionAt)) {
    const error = new Error(
      "Next action and next action date and time must both be provided"
    );
    error.status = 400;
    throw error;
  }
}

async function syncNextActionActivity(client, values) {
  const {
    interactionId,
    customerId,
    contactId,
    nextAction,
    nextActionAt,
    assignedTo,
    updatedBy,
  } = values;
  const existingResult = await client.query(
    `SELECT *
     FROM scheduled_activities
     WHERE source_interaction_id = $1
     FOR UPDATE`,
    [interactionId]
  );
  const existing = existingResult.rows[0] || null;

  if (!nextAction || !nextActionAt) {
    if (existing && existing.status !== "completed") {
      await client.query(
        `UPDATE scheduled_activities
         SET
           status = 'cancelled',
           reminder_at = NULL,
           reminder_sent_at = NULL,
           reminder_attempt_count = 0,
           reminder_last_attempt_at = NULL,
           reminder_error = NULL,
           updated_by = $2,
           updated_at = NOW()
         WHERE activity_id = $1`,
        [existing.activity_id, updatedBy]
      );
    }

    return existing?.activity_id || null;
  }

  if (existing?.status === "completed") {
    const error = new Error(
      "The linked Agenda follow-up is completed and cannot be changed from the interaction"
    );
    error.status = 409;
    throw error;
  }

  const reminderAt = new Date(
    new Date(nextActionAt).getTime() - 15 * 60 * 1000
  ).toISOString();

  if (existing) {
    await client.query(
      `UPDATE scheduled_activities
       SET
         customer_id = $2,
         contact_id = $3,
         activity_type = 'follow_up',
         scheduled_start = $4,
         scheduled_end = NULL,
         location = NULL,
         purpose = $5,
         notes = 'Created automatically from interaction ' || $6,
         reminder_at = $7,
         reminder_sent_at = NULL,
         reminder_attempt_count = 0,
         reminder_last_attempt_at = NULL,
         reminder_error = NULL,
         status = 'planned',
         updated_by = $8,
         updated_at = NOW()
       WHERE activity_id = $1`,
      [
        existing.activity_id,
        customerId,
        contactId,
        nextActionAt,
        nextAction,
        interactionId,
        reminderAt,
        updatedBy,
      ]
    );

    return existing.activity_id;
  }

  const result = await client.query(
    `INSERT INTO scheduled_activities
     (
       customer_id,
       contact_id,
       assigned_to,
       activity_type,
       scheduled_start,
       purpose,
       notes,
       reminder_at,
       status,
       source_interaction_id,
       created_by,
       updated_by
     )
     VALUES ($1,$2,$3,'follow_up',$4,$5,$6,$7,'planned',$8,$9,$9)
     RETURNING activity_id`,
    [
      customerId,
      contactId,
      assignedTo,
      nextActionAt,
      nextAction,
      `Created automatically from interaction ${interactionId}`,
      reminderAt,
      interactionId,
      updatedBy,
    ]
  );

  return result.rows[0].activity_id;
}

function decodePhoto(body) {
  const mimeType = String(
    body?.MimeType || ""
  )
    .toLowerCase()
    .trim();
  const extension = PHOTO_TYPES.get(mimeType);

  if (!extension) {
    const error = new Error(
      "Only JPG, PNG, and WebP photos are allowed"
    );
    error.status = 400;
    throw error;
  }

  let base64 = String(
    body?.DataBase64 || ""
  ).trim();
  const match = base64.match(
    /^data:[^;]+;base64,(.*)$/s
  );

  if (match) {
    base64 = match[1];
  }

  base64 = base64.replace(/\s+/g, "");

  if (
    !base64 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)
  ) {
    const error = new Error("Invalid photo data");
    error.status = 400;
    throw error;
  }

  const buffer = Buffer.from(base64, "base64");

  if (!buffer.length) {
    const error = new Error("Photo is empty");
    error.status = 400;
    throw error;
  }

  if (buffer.length > MAX_PHOTO_BYTES) {
    const error = new Error(
      "Compressed interaction photo must not exceed 1 MB"
    );
    error.status = 413;
    throw error;
  }

  return {
    buffer,
    extension,
    mimeType,
    originalName: nullable(body?.OriginalName),
  };
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

async function ensureCustomer(client, customerId) {
  const result = await client.query(
    `SELECT customer_id, assigned_to
     FROM customers
     WHERE customer_id = $1`,
    [customerId]
  );

  if (result.rowCount === 0) {
    const error = new Error("Customer not found");
    error.status = 404;
    throw error;
  }

  return result.rows[0];
}

async function validateContact(
  client,
  customerId,
  contactId
) {
  if (!contactId) {
    return null;
  }

  const result = await client.query(
    `SELECT contact_id
     FROM customer_contacts
     WHERE
       customer_id = $1
       AND contact_id = $2`,
    [customerId, contactId]
  );

  if (result.rowCount === 0) {
    const error = new Error(
      "The selected PIC does not belong to this customer"
    );
    error.status = 400;
    throw error;
  }

  return contactId;
}

async function ensureInteraction(
  client,
  customerId,
  interactionId
) {
  const result = await client.query(
    `SELECT interaction_id
     FROM customer_interactions
     WHERE
       customer_id = $1
       AND interaction_id = $2`,
    [customerId, interactionId]
  );

  if (result.rowCount === 0) {
    const error = new Error("Interaction not found");
    error.status = 404;
    throw error;
  }
}

async function loadPhotosForInteractions(
  interactionIds
) {
  const photoMap = new Map();

  if (!interactionIds.length) {
    return photoMap;
  }

  const result = await pool.query(
    `SELECT *
     FROM customer_interaction_photos
     WHERE interaction_id = ANY($1::text[])
     ORDER BY created_at ASC, photo_id ASC`,
    [interactionIds]
  );

  const photos = await Promise.all(
    result.rows.map(addInteractionPhotoUrl)
  );

  photos.forEach((photo) => {
    const current =
      photoMap.get(photo.interaction_id) || [];
    current.push(photo);
    photoMap.set(photo.interaction_id, current);
  });

  return photoMap;
}

async function loadInteractions(customerId) {
  const result = await pool.query(
    `SELECT
       ci.*,
       cc.full_name AS contact_name,
       cc.job_title AS contact_job_title,
       creator.full_name AS created_by_name,
       updater.full_name AS updated_by_name,
       next_activity.activity_id AS next_action_activity_id,
       next_activity.status AS next_action_activity_status,
       CASE
         WHEN next_activity.status IN ('cancelled', 'no_show') THEN NULL
         ELSE next_activity.scheduled_start
       END AS next_action_scheduled_at,
       CASE
         WHEN next_activity.status IN ('cancelled', 'no_show') THEN NULL
         ELSE next_activity.purpose
       END AS next_action_scheduled_purpose
     FROM customer_interactions ci
     LEFT JOIN customer_contacts cc
       ON cc.contact_id = ci.contact_id
     LEFT JOIN app_users creator
       ON creator.user_id = ci.created_by
     LEFT JOIN app_users updater
       ON updater.user_id = ci.updated_by
     LEFT JOIN scheduled_activities next_activity
       ON next_activity.source_interaction_id = ci.interaction_id
     WHERE ci.customer_id = $1
     ORDER BY
       ci.interaction_at DESC,
       ci.created_at DESC,
       ci.interaction_id DESC`,
    [customerId]
  );

  const photoMap = await loadPhotosForInteractions(
    result.rows.map((row) => row.interaction_id)
  );

  return result.rows.map((row) => ({
    ...row,
    photos: photoMap.get(row.interaction_id) || [],
  }));
}

async function loadOneInteraction(
  customerId,
  interactionId
) {
  const rows = await loadInteractions(customerId);
  return (
    rows.find(
      (row) => row.interaction_id === interactionId
    ) || null
  );
}

// LIST CUSTOMER INTERACTIONS IN REVERSE CHRONOLOGICAL ORDER
router.get("/", requireAuth, async (req, res) => {
  try {
    await ensureCustomer(pool, req.params.customerId);
    return res.json(
      await loadInteractions(req.params.customerId)
    );
  } catch (error) {
    return sendError(res, error);
  }
});

// CREATE INTERACTION
router.post(
  "/",
  requireAuth,
  requireRole("admin", "manager", "sales"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const customerId = req.params.customerId;
      const body = req.body || {};
      const interactionType =
        normalizeInteractionType(body.InteractionType);
      const notes = String(body.Notes || "").trim();
      const nextAction = nullable(body.NextAction);
      const nextActionAt = normalizeNextActionAt(body.NextActionAt);

      if (!interactionType) {
        return res.status(400).json({
          status: "ERROR",
          message: "Interaction type is invalid",
        });
      }

      if (!notes) {
        return res.status(400).json({
          status: "ERROR",
          message: "Interaction notes are required",
        });
      }

      validateNextAction(nextAction, nextActionAt);

      await client.query("BEGIN");
      const customer = await ensureCustomer(client, customerId);
      const contactId = await validateContact(
        client,
        customerId,
        nullable(body.ContactID)
      );

      const result = await client.query(
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
         VALUES
         (
           $1,$2,$3,$4,$5,$6,$7,
           CASE
             WHEN $8::timestamptz IS NULL THEN NULL
             ELSE ($8::timestamptz AT TIME ZONE 'Asia/Jakarta')::date
           END,
           $8,$9,$9
         )
         RETURNING interaction_id`,
        [
          customerId,
          contactId,
          interactionType,
          normalizeInteractionAt(body.InteractionAt),
          nullable(body.Participants),
          notes,
          nextAction,
          nextActionAt,
          req.user.userId,
        ]
      );

      await syncNextActionActivity(client, {
        interactionId: result.rows[0].interaction_id,
        customerId,
        contactId,
        nextAction,
        nextActionAt,
        assignedTo: customer.assigned_to || req.user.userId,
        updatedBy: req.user.userId,
      });

      await client.query("COMMIT");

      const interaction = await loadOneInteraction(
        customerId,
        result.rows[0].interaction_id
      );

      return res.status(201).json({
        status: "OK",
        interaction,
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      return sendError(res, error);
    } finally {
      client.release();
    }
  }
);

// UPDATE INTERACTION
router.put(
  "/:interactionId",
  requireAuth,
  requireRole("admin", "manager", "sales"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const customerId = req.params.customerId;
      const interactionId =
        req.params.interactionId;
      const body = req.body || {};
      const interactionType =
        normalizeInteractionType(body.InteractionType);
      const notes = String(body.Notes || "").trim();
      const nextAction = nullable(body.NextAction);
      const nextActionAt = normalizeNextActionAt(body.NextActionAt);

      if (!interactionType) {
        return res.status(400).json({
          status: "ERROR",
          message: "Interaction type is invalid",
        });
      }

      if (!notes) {
        return res.status(400).json({
          status: "ERROR",
          message: "Interaction notes are required",
        });
      }


      validateNextAction(nextAction, nextActionAt);

      await client.query("BEGIN");
      await ensureInteraction(
        client,
        customerId,
        interactionId
      );
      const contactId = await validateContact(
        client,
        customerId,
        nullable(body.ContactID)
      );

      await client.query(
        `UPDATE customer_interactions
         SET
           contact_id = $3,
           interaction_type = $4,
           interaction_at = $5,
           participants = $6,
           notes = $7,
           next_action = $8,
           next_action_date = CASE
             WHEN $9::timestamptz IS NULL THEN NULL
             ELSE ($9::timestamptz AT TIME ZONE 'Asia/Jakarta')::date
           END,
           next_action_at = $9,
           updated_by = $10,
           updated_at = NOW()
         WHERE
           customer_id = $1
           AND interaction_id = $2`,
        [
          customerId,
          interactionId,
          contactId,
          interactionType,
          normalizeInteractionAt(body.InteractionAt),
          nullable(body.Participants),
          notes,
          nextAction,
          nextActionAt,
          req.user.userId,
        ]
      );

      const ownerResult = await client.query(
        `SELECT COALESCE(c.assigned_to, ci.created_by) AS assigned_to
         FROM customer_interactions ci
         JOIN customers c ON c.customer_id = ci.customer_id
         WHERE ci.interaction_id = $1`,
        [interactionId]
      );

      await syncNextActionActivity(client, {
        interactionId,
        customerId,
        contactId,
        nextAction,
        nextActionAt,
        assignedTo:
          ownerResult.rows[0]?.assigned_to || req.user.userId,
        updatedBy: req.user.userId,
      });

      await client.query("COMMIT");

      return res.json({
        status: "OK",
        interaction: await loadOneInteraction(
          customerId,
          interactionId
        ),
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      return sendError(res, error);
    } finally {
      client.release();
    }
  }
);

// ADD ONE PHOTO. THE FRONTEND MAY CALL THIS REPEATEDLY.
router.post(
  "/:interactionId/photos",
  requireAuth,
  requireRole("admin", "manager", "sales"),
  async (req, res) => {
    let objectKey = null;

    try {
      const customerId = req.params.customerId;
      const interactionId =
        req.params.interactionId;

      await ensureInteraction(
        pool,
        customerId,
        interactionId
      );

      const countResult = await pool.query(
        `SELECT COUNT(*)::integer AS count
         FROM customer_interaction_photos
         WHERE interaction_id = $1`,
        [interactionId]
      );

      if (
        countResult.rows[0].count >=
        MAX_PHOTOS_PER_INTERACTION
      ) {
        return res.status(400).json({
          status: "ERROR",
          message:
            "An interaction can contain a maximum of 10 photos",
        });
      }

      const {
        buffer,
        extension,
        mimeType,
        originalName,
      } = decodePhoto(req.body);

      objectKey = await uploadInteractionPhoto({
        customerId,
        interactionId,
        buffer,
        mimeType,
        extension,
      });

      const result = await pool.query(
        `INSERT INTO customer_interaction_photos
         (
           interaction_id,
           photo_path,
           original_name,
           mime_type,
           file_size_bytes,
           created_by
         )
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING *`,
        [
          interactionId,
          objectKey,
          originalName,
          mimeType,
          buffer.length,
          req.user.userId,
        ]
      );

      return res.status(201).json({
        status: "OK",
        photo: await addInteractionPhotoUrl(
          result.rows[0]
        ),
      });
    } catch (error) {
      if (objectKey) {
        await deleteInteractionPhoto(
          objectKey
        ).catch(() => {});
      }

      return sendError(res, error);
    }
  }
);

// DELETE ONE PHOTO
router.delete(
  "/:interactionId/photos/:photoId",
  requireAuth,
  requireRole("admin", "manager", "sales"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `DELETE FROM customer_interaction_photos cip
         USING customer_interactions ci
         WHERE
           cip.photo_id = $1
           AND cip.interaction_id = $2
           AND ci.interaction_id = cip.interaction_id
           AND ci.customer_id = $3
         RETURNING cip.*`,
        [
          req.params.photoId,
          req.params.interactionId,
          req.params.customerId,
        ]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          status: "ERROR",
          message: "Interaction photo not found",
        });
      }

      await deleteInteractionPhoto(
        result.rows[0].photo_path
      ).catch((error) => {
        console.error(
          "Unable to remove interaction photo from S3:",
          error.message
        );
      });

      return res.json({
        status: "OK",
        message: "Interaction photo deleted",
      });
    } catch (error) {
      return sendError(res, error);
    }
  }
);

// DELETE AN INTERACTION AND ITS PHOTOS
router.delete(
  "/:interactionId",
  requireAuth,
  requireRole("admin", "manager"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const photos = await client.query(
        `SELECT cip.photo_path
         FROM customer_interaction_photos cip
         JOIN customer_interactions ci
           ON ci.interaction_id = cip.interaction_id
         WHERE
           ci.customer_id = $1
           AND ci.interaction_id = $2`,
        [
          req.params.customerId,
          req.params.interactionId,
        ]
      );

      const result = await client.query(
        `DELETE FROM customer_interactions
         WHERE
           customer_id = $1
           AND interaction_id = $2
         RETURNING *`,
        [
          req.params.customerId,
          req.params.interactionId,
        ]
      );

      if (result.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          status: "ERROR",
          message: "Interaction not found",
        });
      }

      await client.query("COMMIT");

      await Promise.all(
        photos.rows.map((photo) =>
          deleteInteractionPhoto(
            photo.photo_path
          ).catch((error) => {
            console.error(
              "Unable to remove interaction photo from S3:",
              error.message
            );
          })
        )
      );

      return res.json({
        status: "OK",
        message: "Interaction deleted",
        interaction: result.rows[0],
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      return sendError(res, error);
    } finally {
      client.release();
    }
  }
);

module.exports = router;
