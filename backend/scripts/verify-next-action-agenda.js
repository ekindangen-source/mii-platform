require("dotenv").config();

const pool = require("../db/database");

async function scalar(sql) {
  const result = await pool.query(sql);
  return result.rows[0];
}

async function main() {
  const schema = await scalar(`
    SELECT
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customer_interactions'
          AND column_name = 'next_action_at'
      ) AS next_action_at_column,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'scheduled_activities'
          AND column_name = 'source_interaction_id'
      ) AS source_interaction_column,
      EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_scheduled_activities_source_interaction'
      ) AS source_interaction_foreign_key,
      EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'uq_scheduled_activities_source_interaction'
      ) AS source_interaction_unique_index
  `);

  const integrity = await scalar(`
    SELECT
      COUNT(*) FILTER (
        WHERE ci.interaction_id IS NULL
      )::integer AS orphan_source_links,
      COUNT(*) FILTER (
        WHERE ci.interaction_id IS NOT NULL
          AND (
            sa.customer_id <> ci.customer_id
            OR sa.activity_type <> 'follow_up'
          )
      )::integer AS mismatched_source_links
    FROM scheduled_activities sa
    LEFT JOIN customer_interactions ci
      ON ci.interaction_id = sa.source_interaction_id
    WHERE sa.source_interaction_id IS NOT NULL
  `);

  const coverage = await scalar(`
    SELECT
      COUNT(*)::integer AS interaction_next_actions,
      COUNT(sa.activity_id)::integer AS linked_agenda_activities,
      COUNT(*) FILTER (
        WHERE sa.activity_id IS NULL
      )::integer AS missing_agenda_activities
    FROM customer_interactions ci
    LEFT JOIN scheduled_activities sa
      ON sa.source_interaction_id = ci.interaction_id
    WHERE
      ci.next_action_at IS NOT NULL
      AND NULLIF(btrim(ci.next_action), '') IS NOT NULL
      AND COALESCE(ci.created_by, ci.updated_by) IS NOT NULL
  `);

  const checks = {
    nextActionAtColumn: schema.next_action_at_column,
    sourceInteractionColumn: schema.source_interaction_column,
    sourceInteractionForeignKey:
      schema.source_interaction_foreign_key,
    sourceInteractionUniqueIndex:
      schema.source_interaction_unique_index,
    noOrphanSourceLinks: integrity.orphan_source_links === 0,
    noMismatchedSourceLinks:
      integrity.mismatched_source_links === 0,
    allEligibleNextActionsLinked:
      coverage.missing_agenda_activities === 0,
  };
  const status = Object.values(checks).every(Boolean)
    ? "OK"
    : "ERROR";

  console.log(
    JSON.stringify(
      {
        status,
        checks,
        totals: {
          interactionNextActions:
            coverage.interaction_next_actions,
          linkedAgendaActivities:
            coverage.linked_agenda_activities,
          missingAgendaActivities:
            coverage.missing_agenda_activities,
        },
      },
      null,
      2
    )
  );

  if (status !== "OK") {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
