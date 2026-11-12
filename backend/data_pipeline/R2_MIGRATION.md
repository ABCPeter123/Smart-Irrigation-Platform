# Neon pipeline archive to Cloudflare R2

This is **preparation, not a production cutover**. The existing web dashboard, API, Vercel cron, and Neon database remain unchanged until the R2 reader/writer has been deployed and validated. This exporter never alters or deletes PostgreSQL rows and does not copy any data to GitHub.

## Why split storage

Cloudflare R2 stores immutable, compressed historical datasets and the current public projection efficiently. It is **not** a SQL database. The separate Prisma-managed `Site`, `IrrigationLog`, `SensorReading`, `RecommendationSnapshot`, and `WeatherCache` models are **not in this six-table archive**. Their future live CRUD, relations, and transaction semantics need a relational store such as D1 or retained PostgreSQL. Do not redirect the original mobile CRUD API to R2 objects.

The export covers all six existing pipeline tables, including any orphaned non-demo site IDs, within a single read-only PostgreSQL snapshot:

- `pipeline_sites` and `raw_soil_profiles`: one versioned gzip object per site ID.
- `raw_weather_forecast_daily`, `raw_weather_history_daily`, `site_features_daily`, and `irrigation_recommendations`: combined by site ID and calendar month into versioned gzip objects.
- `exports/<export-id>/manifest.json`: exact source row counts, per-object row counts, byte sizes, and SHA-256 checksums.
- `current.json`: one small JSON object containing only the latest demo-site recommendation records in the shape expected by the public API. Private and non-demo rows never appear in this public projection.

Preserving raw `input_features` and the feature table is intentional for full-fidelity archival and auditability. Only the lightweight `current.json` projection removes the duplication on the dashboard read path.

Use a **private** R2 Standard bucket separate from CookieQuant's `cookiequant-telemetry` bucket. Suggested bucket name: `smart-irrigation-data`. All keys are under `irrigation/v1/`; schema versioning allows future changes.

## Credentials

Keep these variables in a local private environment or encrypted execution environment. Never add them to Git, browser code, or a public endpoint.

```text
DATABASE_URL_UNPOOLED=<read-only PostgreSQL connection for the export>
R2_ACCOUNT_ID=<Cloudflare account ID>
R2_BUCKET=smart-irrigation-data
R2_ACCESS_KEY_ID=<bucket-scoped token key ID>
R2_SECRET_ACCESS_KEY=<bucket-scoped token secret>
```

Use read-only Neon credentials if available. Restrict the R2 token to this one bucket with Object Read & Write permissions. R2 access uses the S3-compatible API, with `region_name="auto"`.

## Read-only preview (safe initial operation)

```bash
cd backend/data_pipeline
python -m pip install -r requirements-r2.txt
python r2_export.py
```

The default prints only row counts, byte counts, and the export ID. It reads from PostgreSQL with transaction isolation `REPEATABLE READ READ ONLY`, does not upload, and never modifies Neon.

## Migration steps (only after the private bucket is configured)

1. Run `python r2_export.py --upload` to copy the six pipeline tables as immutable objects. Every uploaded object is read back and its SHA-256 digest verified. The live pointer is **not** changed.
2. Compare the printed source table counts against a fresh Neon read and inspect the uploaded `manifest.json` in R2. Any difference or checksum failure blocks the cutover.
3. Run `python r2_export.py --upload --publish-index` to publish the small R2 `current.json` **only after** all objects and the manifest verify. This still does **not** switch the public API to R2.
4. Implement and validate an R2-backed read adapter for `GET /api/public/pipeline` and a scheduled R2 writer. Maintain the existing JSON response contract and deny public writes. Keep an explicit backend selector with Neon as rollback.
5. Switch the API read path only after shadow comparisons of each site, model date, version, action and estimate. Verify browser behavior, daily refresh, and health checks before changing the scheduled write path.
6. Retain the Neon data unchanged for a rollback window. Do not revoke its production credentials or delete tables until every dependency, including mobile CRUD, has migrated.

## Optimization choices

- **One object per site per month:** limits object counts and request charges instead of generating an object for every row.
- **Deterministic gzip:** consistent bytes, easier verification, smaller archival footprint.
- **Single compact `current.json` index:** allows the public dashboard to load all visible demo-site summaries in one request after the adapter is introduced. Cache the API response for a few minutes rather than listing R2 keys per visitor.
- **Immutable export keys:** prior versions remain restorable and export retries cannot silently overwrite archived records.
- **SHA-256 per object and strict count reconciliation:** required for migration correctness.
- **No writes to the live object pointer unless explicitly requested:** the migration can be prepared and verified without changing production behavior.
- **No premature Infrequent Access storage:** Standard avoids retrieval fees for this regularly accessed data.
- **Monthly compaction for new historical data:** a future scheduled writer should update small monthly partitions and publish the latest index only after its archive is verified.

Important: this is an initial, read-only **pipeline export**, not yet an R2 runtime adapter or a full Prisma migration. The CookieQuant migration has its own bucket, archive schema, and adapter; do not reuse its telemetry format for irrigation records.
