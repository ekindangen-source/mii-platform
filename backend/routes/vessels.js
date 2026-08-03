const fs = require("fs/promises");
const path = require("path");

const express = require("express");
const router = express.Router();

const pool = require("../db/database");
const {
  requireAuth,
  requireRole,
} = require("../middleware/auth");
const {
  customerAccessCondition,
  ensureCustomerAccess,
  ensureVesselAccess,
} = require("../middleware/customerAccess");

const {
  addPhotoUrl,
  deleteS3Photo,
  isLegacyLocalPhotoPath,
  uploadVesselPhoto,
} = require("../services/vesselPhotoStorage");

const LOCAL_PHOTO_DIRECTORY = path.join(
  __dirname,
  "..",
  "uploads",
  "vessels"
);

const MAX_PHOTO_BYTES =
  1024 * 1024;

const PHOTO_TYPES = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

function localPhotoFilePath(photoPath) {
  if (!isLegacyLocalPhotoPath(photoPath)) {
    return null;
  }

  return path.join(
    LOCAL_PHOTO_DIRECTORY,
    path.basename(photoPath)
  );
}

async function deleteStoredPhoto(photoPath) {
  if (!photoPath) {
    return;
  }

  if (isLegacyLocalPhotoPath(photoPath)) {
    const filePath =
      localPhotoFilePath(photoPath);

    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error(
          "Unable to remove legacy vessel photo:",
          error.message
        );
      }
    }

    return;
  }

  try {
    await deleteS3Photo(photoPath);
  } catch (error) {
    console.error(
      "Unable to remove S3 vessel photo:",
      error.message
    );
  }
}

function decodePhoto(body) {
  const mimeType =
    String(body?.MimeType || "")
      .toLowerCase()
      .trim();

  const extension =
    PHOTO_TYPES.get(mimeType);

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
    const error = new Error(
      "Invalid photo data"
    );
    error.status = 400;
    throw error;
  }

  const buffer = Buffer.from(
    base64,
    "base64"
  );

  if (!buffer.length) {
    const error = new Error(
      "Photo is empty"
    );
    error.status = 400;
    throw error;
  }

  if (buffer.length > MAX_PHOTO_BYTES) {
    const error = new Error(
      "Compressed vessel photo must not exceed 1 MB"
    );
    error.status = 413;
    throw error;
  }

  return {
    buffer,
    extension,
    mimeType,
  };
}

router.post(
  "/",
  requireAuth,
  requireRole("admin", "manager", "sales"),
  async (req, res) => {
    try {
      const r = req.body;
      await ensureCustomerAccess(pool, req.user, r.CustomerID);

      const result = await pool.query(
        `INSERT INTO vessels
        (
          customer_id,
          boat_name,
          builder,
          year_built,
          length_m,
          beam_m,
          hull_material,
          hull_type,
          passenger_capacity,
          fuel_tank_l,
          home_port,
          typical_route
        )
        VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING *`,
        [
          r.CustomerID,
          r.BoatName,
          r.Builder,
          r.YearBuilt || null,
          r.LengthM || null,
          r.BeamM || null,
          r.HullMaterial,
          r.HullType,
          r.PassengerCapacity || null,
          r.FuelTankL || null,
          r.HomePort,
          r.TypicalRoute,
        ]
      );

      return res.status(201).json({
        status: "OK",
        vessel: await addPhotoUrl(
          result.rows[0]
        ),
      });
    } catch (error) {
      return res.status(500).json({
        status: "ERROR",
        message: error.message,
      });
    }
  }
);

router.get(
  "/",
  requireAuth,
  async (req, res) => {
    try {
      const access = customerAccessCondition(req.user, "c", 1);
      const result = await pool.query(
        `SELECT
           v.*,
           c.company
         FROM vessels v
         LEFT JOIN customers c
           ON v.customer_id=c.customer_id
         WHERE ${access.clause}
         ORDER BY v.created_at DESC
         LIMIT 100`,
        access.parameters
      );

      const rows = await Promise.all(
        result.rows.map(addPhotoUrl)
      );

      return res.json(rows);
    } catch (error) {
      return res.status(500).json({
        status: "ERROR",
        message: error.message,
      });
    }
  }
);

router.put(
  "/:id",
  requireAuth,
  requireRole("admin", "manager", "sales"),
  async (req, res) => {
    try {
      const r = req.body;
      await ensureVesselAccess(pool, req.user, req.params.id);
      await ensureCustomerAccess(pool, req.user, r.CustomerID);

      const result = await pool.query(
        `UPDATE vessels
         SET
           customer_id=$1,
           boat_name=$2,
           builder=$3,
           year_built=$4,
           length_m=$5,
           beam_m=$6,
           hull_material=$7,
           hull_type=$8,
           passenger_capacity=$9,
           fuel_tank_l=$10,
           home_port=$11,
           typical_route=$12,
           updated_at=NOW()
         WHERE vessel_id=$13
         RETURNING *`,
        [
          r.CustomerID,
          r.BoatName,
          r.Builder,
          r.YearBuilt || null,
          r.LengthM || null,
          r.BeamM || null,
          r.HullMaterial,
          r.HullType,
          r.PassengerCapacity || null,
          r.FuelTankL || null,
          r.HomePort,
          r.TypicalRoute,
          req.params.id,
        ]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          status: "ERROR",
          message: "Vessel not found",
        });
      }

      return res.json({
        status: "OK",
        vessel: await addPhotoUrl(
          result.rows[0]
        ),
      });
    } catch (error) {
      return res.status(500).json({
        status: "ERROR",
        message: error.message,
      });
    }
  }
);

router.put(
  "/:id/photo",
  requireAuth,
  requireRole("admin", "manager", "sales"),
  async (req, res) => {
    let newObjectKey = null;

    try {
      await ensureVesselAccess(pool, req.user, req.params.id);
      const currentResult =
        await pool.query(
          `SELECT vessel_id, photo_path
           FROM vessels
           WHERE vessel_id=$1`,
          [req.params.id]
        );

      if (currentResult.rowCount === 0) {
        return res.status(404).json({
          status: "ERROR",
          message: "Vessel not found",
        });
      }

      const {
        buffer,
        extension,
        mimeType,
      } = decodePhoto(req.body);

      newObjectKey =
        await uploadVesselPhoto({
          vesselId: req.params.id,
          buffer,
          mimeType,
          extension,
        });

      const result = await pool.query(
        `UPDATE vessels
         SET
           photo_path=$1,
           updated_at=NOW()
         WHERE vessel_id=$2
         RETURNING *`,
        [
          newObjectKey,
          req.params.id,
        ]
      );

      await deleteStoredPhoto(
        currentResult.rows[0].photo_path
      );

      return res.json({
        status: "OK",
        vessel: await addPhotoUrl(
          result.rows[0]
        ),
      });
    } catch (error) {
      if (newObjectKey) {
        await deleteS3Photo(
          newObjectKey
        ).catch(() => {});
      }

      return res
        .status(error.status || 500)
        .json({
          status: "ERROR",
          message: error.message,
        });
    }
  }
);

router.delete(
  "/:id/photo",
  requireAuth,
  requireRole("admin", "manager", "sales"),
  async (req, res) => {
    try {
      await ensureVesselAccess(pool, req.user, req.params.id);
      const result = await pool.query(
        `WITH previous AS (
           SELECT photo_path
           FROM vessels
           WHERE vessel_id=$1
           FOR UPDATE
         ),
         updated AS (
           UPDATE vessels
           SET
             photo_path=NULL,
             updated_at=NOW()
           WHERE vessel_id=$1
           RETURNING *
         )
         SELECT
           updated.*,
           previous.photo_path
             AS previous_photo_path
         FROM updated
         CROSS JOIN previous`,
        [req.params.id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          status: "ERROR",
          message: "Vessel not found",
        });
      }

      const row = result.rows[0];

      await deleteStoredPhoto(
        row.previous_photo_path
      );

      delete row.previous_photo_path;

      return res.json({
        status: "OK",
        vessel: await addPhotoUrl(row),
      });
    } catch (error) {
      return res.status(500).json({
        status: "ERROR",
        message: error.message,
      });
    }
  }
);

router.delete(
  "/:id",
  requireAuth,
  requireRole("admin", "manager"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `DELETE FROM vessels
         WHERE vessel_id=$1
         RETURNING *`,
        [req.params.id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          status: "ERROR",
          message: "Vessel not found",
        });
      }

      await deleteStoredPhoto(
        result.rows[0].photo_path
      );

      return res.json({
        status: "OK",
        message: "Vessel deleted",
        vessel: result.rows[0],
      });
    } catch (error) {
      return res.status(500).json({
        status: "ERROR",
        message: error.message,
      });
    }
  }
);

module.exports = router;
