const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const express = require("express");
const router = express.Router();

const pool = require("../db/database");
const {
  requireAuth,
  requireRole,
} = require("../middleware/auth");

const PHOTO_DIRECTORY = path.join(
  __dirname,
  "..",
  "uploads",
  "vessels"
);

const PHOTO_PATH_PREFIX =
  "/uploads/vessels/";

const MAX_PHOTO_BYTES =
  5 * 1024 * 1024;

const PHOTO_TYPES = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

async function ensurePhotoDirectory() {
  await fs.mkdir(
    PHOTO_DIRECTORY,
    { recursive: true }
  );
}

function storedPhotoFilePath(photoPath) {
  if (
    !photoPath ||
    !photoPath.startsWith(
      PHOTO_PATH_PREFIX
    )
  ) {
    return null;
  }

  const filename = path.basename(photoPath);

  if (!filename) {
    return null;
  }

  return path.join(
    PHOTO_DIRECTORY,
    filename
  );
}

async function removeStoredPhoto(photoPath) {
  const filePath =
    storedPhotoFilePath(photoPath);

  if (!filePath) {
    return;
  }

  try {
    await fs.unlink(filePath);
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error(
        "Unable to remove vessel photo:",
        err
      );
    }
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

  const dataUrlMatch = base64.match(
    /^data:[^;]+;base64,(.*)$/s
  );

  if (dataUrlMatch) {
    base64 = dataUrlMatch[1];
  }

  base64 = base64.replace(/\s+/g, "");

  if (
    !base64 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(
      base64
    )
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
      "Photo must not exceed 5 MB"
    );
    error.status = 413;
    throw error;
  }

  return {
    buffer,
    extension,
  };
}

router.post(
  "/",
  requireAuth,
  requireRole(
    "admin",
    "manager",
    "sales"
  ),
  async (req, res) => {
    try {
      const r = req.body;

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
        vessel: result.rows[0],
      });
    } catch (err) {
      return res.status(500).json({
        status: "ERROR",
        message: err.message,
      });
    }
  }
);

router.get(
  "/",
  requireAuth,
  async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT
           v.*,
           c.company
         FROM vessels v
         LEFT JOIN customers c
           ON v.customer_id =
              c.customer_id
         ORDER BY v.created_at DESC
         LIMIT 100`
      );

      return res.json(result.rows);
    } catch (err) {
      return res.status(500).json({
        status: "ERROR",
        message: err.message,
      });
    }
  }
);

router.put(
  "/:id",
  requireAuth,
  requireRole(
    "admin",
    "manager",
    "sales"
  ),
  async (req, res) => {
    try {
      const r = req.body;

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
        vessel: result.rows[0],
      });
    } catch (err) {
      return res.status(500).json({
        status: "ERROR",
        message: err.message,
      });
    }
  }
);

// Upload or replace the single vessel photo.
router.put(
  "/:id/photo",
  requireAuth,
  requireRole(
    "admin",
    "manager",
    "sales"
  ),
  async (req, res) => {
    let newFilePath = null;

    try {
      const currentResult =
        await pool.query(
          `SELECT photo_path
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
      } = decodePhoto(req.body);

      await ensurePhotoDirectory();

      const filename =
        `${crypto.randomUUID()}${extension}`;

      newFilePath = path.join(
        PHOTO_DIRECTORY,
        filename
      );

      await fs.writeFile(
        newFilePath,
        buffer,
        { flag: "wx" }
      );

      const newPhotoPath =
        PHOTO_PATH_PREFIX + filename;

      const result = await pool.query(
        `UPDATE vessels
         SET
           photo_path=$1,
           updated_at=NOW()
         WHERE vessel_id=$2
         RETURNING *`,
        [
          newPhotoPath,
          req.params.id,
        ]
      );

      await removeStoredPhoto(
        currentResult.rows[0].photo_path
      );

      return res.json({
        status: "OK",
        vessel: result.rows[0],
      });
    } catch (err) {
      if (newFilePath) {
        await fs
          .unlink(newFilePath)
          .catch(() => {});
      }

      return res
        .status(err.status || 500)
        .json({
          status: "ERROR",
          message: err.message,
        });
    }
  }
);

// Remove the current vessel photo.
router.delete(
  "/:id/photo",
  requireAuth,
  requireRole(
    "admin",
    "manager",
    "sales"
  ),
  async (req, res) => {
    try {
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

      await removeStoredPhoto(
        row.previous_photo_path
      );

      delete row.previous_photo_path;

      return res.json({
        status: "OK",
        vessel: row,
      });
    } catch (err) {
      return res.status(500).json({
        status: "ERROR",
        message: err.message,
      });
    }
  }
);

// Delete the vessel and its stored photo.
router.delete(
  "/:id",
  requireAuth,
  requireRole(
    "admin",
    "manager"
  ),
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

      await removeStoredPhoto(
        result.rows[0].photo_path
      );

      return res.json({
        status: "OK",
        message: "Vessel deleted",
        vessel: result.rows[0],
      });
    } catch (err) {
      return res.status(500).json({
        status: "ERROR",
        message: err.message,
      });
    }
  }
);

module.exports = router;
