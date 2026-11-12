# R2 runtime migration

This API now supports an **opt-in R2 shadow read/write path** for the six-table irrigation pipeline. Production continues to serve **Neon** until the R2 bucket and its credentials are configured and compared. The separate Prisma mobile CRUD models still require a relational store; they have not been migrated.

## Private bucket and credentials

Create a separate **private Standard** Cloudflare R2 bucket, e.g. `smart-irrigation-data`. Do not use the CookieQuant telemetry bucket. Create an API token scoped to this single bucket and Object Read/Write. Configure the following **encrypted server-only Vercel environment variables** on `smart-irrigation-api`:

```text
R2_ACCOUNT_ID=<your Cloudflare account ID>
R2_BUCKET=smart-irrigation-data
R2_ACCESS_KEY_ID=<R2 API access key ID>
R2_SECRET_ACCESS_KEY=<R2 API secret>
R2_READ_MODE=off
R2_SYNC_ENABLED=false
```

No R2 keys are needed by the browser or the static Vercel web project. Never commit credentials. Initially keep `R2_READ_MODE=off` and `R2_SYNC_ENABLED=false`.

## Staged activation

1. **Backup:** Run the existing six-table read-only exporter (`backend/data_pipeline/r2_export.py`) with a read-only PostgreSQL connection. Dry-run by default, then upload and verify if ready. Keep its manifest and checksums. This does not change the web API.
2. **Dual-write only:** Set `R2_SYNC_ENABLED=true` on the **API** project. The authenticated daily Vercel Cron refresh first persists data in Neon, then writes one small gzipped site/weather/feature snapshot for that date under `irrigation/v1/live/YYYY-MM-DD/snapshot.json.gz`, verifies it by reading it back, and finally publishes `irrigation/v1/current.json` with a second verification. If any site update fails, no R2 index is published. No browser request can trigger an R2 write.
3. **Shadow read:** Set `R2_READ_MODE=shadow`. Each API instance serves Neon as before while comparing the compact R2 index to Neon results. Check the structured `R2 shadow parity` logs for `matched: true`. Comparison ignores ephemeral generated-at timestamps and reports mismatched demo IDs, not raw private data.
4. **R2 primary:** Once shadow parity passes repeatedly and the latest snapshot is under 36 hours old, set `R2_READ_MODE=primary`. Public GET serves R2 from a bounded server cache. If the R2 object is stale, invalid, or unavailable, the API falls back to Neon. Keep Neon cron writes enabled during this period.
5. **Future full cutover:** Introduce a persistent non-Neon source of site definitions and migrate the relational Prisma CRUD models to D1 or another SQL store. Then replace the Neon-dependent cron writer, validate historic archives, and only afterwards plan a Neon retirement. **Do not delete Neon data yet.**

## Object layout and cost controls

```text
irrigation/v1/
  current.json                                  # <=64 KiB, GET for public summaries
  live/YYYY-MM-DD/snapshot.json.gz              # <=64 KiB, one per day, full weather/features
  exports/<export-id>/manifest.json             # immutable checksum manifest
  exports/<export-id>/sites/<site-id>.json.gz
  exports/<export-id>/months/<site-id>/YYYY-MM.json.gz
```

- Reads fetch only `current.json`, never scan/list bucket contents.
- API process caches the current snapshot for 5 minutes; Vercel response has an additional 5-minute edge cache.
- Daily cron performs at most two R2 PUTs and two read-back GETs per fully successful run. Writer limits each object to 64 KiB, supports at most 20 demo records, and disables SDK automatic retries beyond the first attempt.
- S3 credentials are never exposed in responses or in structured comparison logs.
- R2 writing is **off by default**, so enabling an R2 read mode never starts object creation.
- No automated monthly compaction is enabled yet; the one-time exporter packs existing history into per-site monthly objects.
- These controls reduce accidental usage, but **they are not a billing-level hard stop**. Cloudflare account billing controls and usage monitoring must be configured separately. This implementation does not guarantee that charges cannot occur.

## Availability and rollback

If a deployment fails, set `R2_READ_MODE=off` to restore the Neon public response. Set `R2_SYNC_ENABLED=false` to stop shadow writes. The production API must continue using the same route and response shape:

```text
GET /api/public/pipeline
{ "status": "ready", "source": "...", "records": [ ... ] }
```

The `GET /api/health` endpoint reports whether the R2 credentials are configured and which read/write mode is selected, but never includes secrets.

All future background jobs and batch migrations must run under the same explicit storage limits and credential-scope policy.
