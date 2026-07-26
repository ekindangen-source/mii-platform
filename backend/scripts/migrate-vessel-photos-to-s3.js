const fs = require("fs/promises");
const path = require("path");

require("dotenv").config({
  override: true,
});

const pool = require("../db/database");

const {
  deleteS3Photo,
  uploadVesselPhoto,
} = require(
  "../services/vesselPhotoStorage"
);

const localDirectory = path.join(
  __dirname,
  "..",
  "uploads",
  "vessels"
);

const mimeTypes = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);

const dryRun =
  process.argv.includes("--dry-run");

const deleteLocal =
  process.argv.includes("--delete-local");

(async () => {
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  try {
    const result = await pool.query(
      `SELECT
         vessel_id,
         photo_path
       FROM vessels
       WHERE photo_path LIKE
         '/uploads/vessels/%'
       ORDER BY vessel_id`
    );

    console.log(
      `Found ${result.rowCount} legacy vessel photo(s).`
    );

    for (const row of result.rows) {
      const filename =
        path.basename(row.photo_path);

      const localPath =
        path.join(localDirectory, filename);

      const extension =
        path.extname(filename).toLowerCase();

      const mimeType =
        mimeTypes.get(extension);

      if (!mimeType) {
        console.error(
          `${row.vessel_id}: unsupported extension ${extension}`
        );
        failed += 1;
        continue;
      }

      try {
        const buffer =
          await fs.readFile(localPath);

        if (dryRun) {
          console.log(
            `${row.vessel_id}: would upload ${filename}`
          );
          skipped += 1;
          continue;
        }

        const objectKey =
          await uploadVesselPhoto({
            vesselId: row.vessel_id,
            buffer,
            mimeType,
            extension:
              extension === ".jpeg"
                ? ".jpg"
                : extension,
          });

        try {
          await pool.query(
            `UPDATE vessels
             SET
               photo_path=$1,
               updated_at=NOW()
             WHERE vessel_id=$2
               AND photo_path=$3`,
            [
              objectKey,
              row.vessel_id,
              row.photo_path,
            ]
          );
        } catch (error) {
          await deleteS3Photo(
            objectKey
          ).catch(() => {});

          throw error;
        }

        if (deleteLocal) {
          await fs.unlink(localPath);
        }

        migrated += 1;
        console.log(
          `${row.vessel_id}: migrated to ${objectKey}`
        );
      } catch (error) {
        failed += 1;
        console.error(
          `${row.vessel_id}: ${error.message}`
        );
      }
    }

    console.log({
      migrated,
      skipped,
      failed,
      dryRun,
      deleteLocal,
    });

    if (failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
})().catch((error) => {
  console.error(
    "Migration failed:",
    error.message
  );
  process.exitCode = 1;
});
