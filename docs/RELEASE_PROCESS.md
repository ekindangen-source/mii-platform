# MII Platform Release Process

## Source of truth

- App version: `frontend/package.json`
- Release plan: `docs/FEATURE_ROADMAP.md`
- Release history: `docs/CHANGELOG.md`
- Detailed tracker: `MII_Feature_Roadmap.xlsx`

## Before deployment

1. Confirm the feature target version and status.
2. Verify a clean Git working tree.
3. Back up the PostgreSQL database.
4. Build the frontend.
5. Test backend scripts and migrations.
6. Commit and push `main`.

## After deployment

1. Verify Nginx, API and database health.
2. Test the released user workflows.
3. Update roadmap statuses.
4. Mark the release as released in `CHANGELOG.md`.
5. Create and push the matching Git tag.

Do not create the release tag until production verification succeeds.
