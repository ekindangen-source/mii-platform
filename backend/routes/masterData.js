const express = require("express");

const pool = require("../db/database");
const {
  requireRole,
} = require("../middleware/auth");

const router = express.Router();

function cleanText(value) {
  return String(value || "").trim();
}

function toBoolean(value, fallback) {
  if (typeof value === "boolean") {
    return value;
  }

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

router.get("/", async (req, res) => {
  try {
    const includeInactive = toBoolean(
      req.query.includeInactive,
      false
    );
    const category = cleanText(
      req.query.category
    );

    const parameters = [];
    const filters = [
      "c.is_active = TRUE",
    ];

    if (!includeInactive) {
      filters.push("v.is_active = TRUE");
    }

    if (category) {
      parameters.push(category);
      filters.push(
        `v.category_key = $${parameters.length}`
      );
    }

    const result = await pool.query(
      `
        SELECT
          c.category_key,
          c.category_label,
          c.module_name,
          c.field_name,
          c.description,
          c.sort_order
            AS category_sort_order,
          v.value_id,
          v.value,
          v.sort_order,
          v.is_active,
          v.created_at,
          v.updated_at
        FROM master_data_categories c
        JOIN master_data_values v
          ON v.category_key = c.category_key
        WHERE ${filters.join(" AND ")}
        ORDER BY
          c.sort_order,
          c.category_label,
          v.sort_order,
          LOWER(v.value)
      `,
      parameters
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      message: error.message,
    });
  }
});

router.get("/categories", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        category_key,
        category_label,
        module_name,
        field_name,
        description,
        sort_order,
        is_active
      FROM master_data_categories
      ORDER BY sort_order, category_label
    `);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      message: error.message,
    });
  }
});

router.post(
  "/values",
  requireRole("admin"),
  async (req, res) => {
    try {
      const categoryKey = cleanText(
        req.body.CategoryKey
      );
      const value = cleanText(req.body.Value);
      const sortOrder = Number(
        req.body.SortOrder || 0
      );

      if (!categoryKey || !value) {
        return res.status(400).json({
          status: "ERROR",
          message:
            "Category and value are required.",
        });
      }

      const result = await pool.query(
        `
          INSERT INTO master_data_values (
            category_key,
            value,
            sort_order,
            is_active
          )
          VALUES ($1, $2, $3, TRUE)
          RETURNING *
        `,
        [
          categoryKey,
          value,
          Number.isFinite(sortOrder)
            ? sortOrder
            : 0,
        ]
      );

      res.status(201).json({
        status: "OK",
        value: result.rows[0],
      });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          status: "ERROR",
          message:
            "That value already exists in this list.",
        });
      }

      res.status(500).json({
        status: "ERROR",
        message: error.message,
      });
    }
  }
);

router.patch(
  "/values/:id",
  requireRole("admin"),
  async (req, res) => {
    try {
      const valueId = Number(req.params.id);
      const value =
        req.body.Value === undefined
          ? null
          : cleanText(req.body.Value);
      const sortOrder =
        req.body.SortOrder === undefined
          ? null
          : Number(req.body.SortOrder);
      const isActive =
        req.body.IsActive === undefined
          ? null
          : toBoolean(req.body.IsActive, true);

      if (!Number.isInteger(valueId)) {
        return res.status(400).json({
          status: "ERROR",
          message: "Invalid value ID.",
        });
      }

      if (
        req.body.Value !== undefined &&
        !value
      ) {
        return res.status(400).json({
          status: "ERROR",
          message: "Value cannot be blank.",
        });
      }

      const result = await pool.query(
        `
          UPDATE master_data_values
          SET
            value = COALESCE($2, value),
            sort_order = COALESCE(
              $3::integer,
              sort_order
            ),
            is_active = COALESCE(
              $4::boolean,
              is_active
            ),
            updated_at = NOW()
          WHERE value_id = $1
          RETURNING *
        `,
        [
          valueId,
          value,
          Number.isFinite(sortOrder)
            ? sortOrder
            : null,
          isActive,
        ]
      );

      if (!result.rowCount) {
        return res.status(404).json({
          status: "ERROR",
          message: "Master-data value not found.",
        });
      }

      res.json({
        status: "OK",
        value: result.rows[0],
      });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          status: "ERROR",
          message:
            "That value already exists in this list.",
        });
      }

      res.status(500).json({
        status: "ERROR",
        message: error.message,
      });
    }
  }
);

module.exports = router;
