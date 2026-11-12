"""Read-only Neon -> private Cloudflare R2 archive preparation.

No table mutations, deletions, production cutover or credential exposure.
Export uses a consistent PostgreSQL snapshot and immutable R2 object keys.
"""
from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import os
import re
import secrets
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any

SCHEMA_VERSION = 1
TABLE_DATE = {
    "raw_weather_forecast_daily": "forecast_date",
    "raw_weather_history_daily": "weather_date",
    "site_features_daily": "feature_date",
    "irrigation_recommendations": "recommendation_date",
}
TABLES = ("pipeline_sites", "raw_soil_profiles", *TABLE_DATE)
PREFIX = "irrigation/v1/"
MAX_UNCOMPRESSED = 64 * 1024 * 1024


@dataclass(frozen=True)
class Blob:
    key: str
    body: bytes
    rows: int
    encoding: str | None = None

    @property
    def sha256(self) -> str:
        return hashlib.sha256(self.body).hexdigest()


@dataclass(frozen=True)
class ExportPlan:
    objects: tuple[Blob, ...]
    manifest: Blob
    current: Blob
    counts: dict[str, int]


def canonical(value: Any) -> bytes:
    def normalize_date(item: Any) -> str:
        if isinstance(item, (date, datetime)):
            return item.isoformat()
        raise TypeError("Cannot serialize: " + type(item).__name__)
    return (json.dumps(value, sort_keys=True, separators=(",", ":"),
                       ensure_ascii=False, allow_nan=False, default=normalize_date)
            + "\n").encode("utf-8")


def checked_blob(key: str, data: Any, rows: int, compress: bool = True) -> Blob:
    content = canonical(data)
    if len(content) > MAX_UNCOMPRESSED:
        raise ValueError("Archive chunk exceeds 64 MiB; split this site-month first.")
    return Blob(key, gzip.compress(content, compresslevel=6, mtime=0)
                if compress else content, rows, "gzip" if compress else None)


def path_token(identifier: str) -> str:
    if not identifier:
        raise ValueError("A site ID cannot be empty")
    return base64.urlsafe_b64encode(identifier.encode("utf-8")).decode("ascii").rstrip("=")


def day_string(value: Any) -> str:
    date_text = value.isoformat() if isinstance(value, (datetime, date)) else str(value)
    if not re.match(r"^\d{4}-\d{2}-\d{2}", date_text):
        raise ValueError("Invalid date in an exported row")
    return date_text[:10]


def collect_source_rows(connection: Any) -> dict[str, list[dict[str, Any]]]:
    """All reads share one consistent, READ ONLY repeatable-read transaction."""
    import psycopg2.extras
    connection.set_session(readonly=True, isolation_level="REPEATABLE READ")
    output: dict[str, list[dict[str, Any]]] = {}
    try:
        with connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            for table in TABLES:
                order = "id" if table == "pipeline_sites" else (
                    "site_id" if table == "raw_soil_profiles"
                    else "site_id, " + TABLE_DATE[table] + ", id"
                )
                # Hard-coded allowlist only. Never concatenate caller input into SQL.
                cursor.execute("SELECT * FROM " + table + " ORDER BY " + order)
                output[table] = [dict(row) for row in cursor.fetchall()]
    finally:
        connection.rollback()
    return output


def latest_public_record(site: dict[str, Any],
                         rows: list[dict[str, Any]]) -> dict[str, Any]:
    recent = max(rows, key=lambda r: (
        day_string(r["recommendation_date"]),
        str(r.get("generated_at") or "")), default=None)
    date_value = day_string(recent["recommendation_date"]) if recent else None
    updated = recent.get("generated_at") if recent else None
    return {
        "id": site["id"], "name": site["name"],
        "latitude": site["latitude"], "longitude": site["longitude"],
        "areaHa": site["area_hectares"], "cropType": site["crop_type"],
        "soilType": site["soil_type"],
        "irrigationMethod": site["irrigation_method"],
        "forecastDate": date_value,
        "updatedAt": updated.isoformat() if isinstance(updated, (datetime, date)) else updated,
        "urgency": recent.get("urgency") if recent else None,
        "actionLabel": recent.get("action_label") if recent else None,
        "recommendedMm": recent.get("recommended_mm") if recent else None,
        "estimatedLitres": recent.get("estimated_liters") if recent else None,
        "dataCompletenessPct": recent.get("confidence_score") if recent else None,
        "waterDeficitMm": recent.get("water_deficit_mm") if recent else None,
        "modelVersion": recent.get("model_version") if recent else None,
        "reasons": recent.get("reasons") if recent else None,
    }


def build_export(rows: dict[str, list[dict[str, Any]]],
                 export_id: str, prefix: str = PREFIX) -> ExportPlan:
    """Pack exact source rows by site and month, plus a compact public index."""
    if not re.fullmatch(r"[a-zA-Z0-9_.-]{8,90}", export_id):
        raise ValueError("Invalid archive export ID")
    if not prefix.endswith("/") or ".." in prefix:
        raise ValueError("Invalid object prefix")
    counts = {table: len(rows.get(table, [])) for table in TABLES}
    grouped: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"site": None, "soil": [], "months": defaultdict(
            lambda: defaultdict(list))})
    for row in rows.get("pipeline_sites", []):
        grouped[row["id"]]["site"] = row
    for row in rows.get("raw_soil_profiles", []):
        grouped[row["site_id"]]["soil"].append(row)
    for table, date_column in TABLE_DATE.items():
        for row in rows.get(table, []):
            grouped[row["site_id"]]["months"][day_string(row[date_column])[:7]][table].append(row)

    root = prefix + "exports/" + export_id + "/"
    objects: list[Blob] = []
    for site_id in sorted(grouped):
        token = path_token(site_id)
        data = grouped[site_id]
        objects.append(checked_blob(
            root + "sites/" + token + ".json.gz",
            {"schemaVersion": SCHEMA_VERSION, "siteId": site_id,
             "site": data["site"], "soilProfiles": data["soil"]},
            int(data["site"] is not None) + len(data["soil"])))
        for month in sorted(data["months"]):
            month_tables = data["months"][month]
            monthly = {table: month_tables.get(table, []) for table in TABLE_DATE}
            objects.append(checked_blob(
                root + "months/" + token + "/" + month + ".json.gz",
                {"schemaVersion": SCHEMA_VERSION, "siteId": site_id, "month": month,
                 "tables": monthly},
                sum(len(part) for part in monthly.values())))
    if sum(item.rows for item in objects) != sum(counts.values()):
        raise ValueError("Archive row counts do not match the source")

    items = [{
        "key": obj.key, "rows": obj.rows,
        "bytes": len(obj.body), "sha256": obj.sha256,
        "encoding": obj.encoding,
    } for obj in objects]
    manifest = checked_blob(
        root + "manifest.json",
        {"schemaVersion": SCHEMA_VERSION, "exportId": export_id,
         "sourceTables": counts, "objects": items,
         "archiveRows": sum(counts.values())},
        0, compress=False)
    demo_sites = sorted((item for item in rows.get("pipeline_sites", [])
                         if item["id"].startswith("demo-")), key=lambda s: s["name"])
    recommendations: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows.get("irrigation_recommendations", []):
        recommendations[row["site_id"]].append(row)
    current = checked_blob(
        prefix + "current.json",
        {"schemaVersion": SCHEMA_VERSION, "exportId": export_id,
         "manifestKey": manifest.key, "status": "ready", "source": "r2-weather-archive",
         "records": [latest_public_record(site, recommendations[site["id"]])
                     for site in demo_sites]},
        len(demo_sites), compress=False)
    return ExportPlan(tuple(objects), manifest, current, counts)


def make_r2_client():
    import boto3
    required = ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET")
    missing = [key for key in required if not os.getenv(key)]
    if missing:
        raise RuntimeError("Missing R2 environment variables: " + ", ".join(missing))
    return boto3.client(
        "s3", endpoint_url="https://" + os.environ["R2_ACCOUNT_ID"] + ".r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto"), os.environ["R2_BUCKET"]


def upload_and_verify(client: Any, bucket: str, plan: ExportPlan,
                      publish: bool = False) -> dict[str, Any]:
    """Never publish the pointer until *all* immutable objects verify."""
    for item in (*plan.objects, plan.manifest):
        args = {"Bucket": bucket, "Key": item.key, "Body": item.body,
                "ContentType": "application/json",
                "Metadata": {"sha256": item.sha256},
                "IfNoneMatch": "*"}
        if item.encoding:
            args["ContentEncoding"] = item.encoding
        client.put_object(**args)
        returned = client.get_object(Bucket=bucket, Key=item.key)["Body"].read()
        if hashlib.sha256(returned).hexdigest() != item.sha256:
            raise RuntimeError("R2 read-after-write checksum mismatch for " + item.key)

    if publish:
        # This pointer is only for R2 validation until the read adapter is deployed.
        # Production continues using Neon regardless of whether it is published.
        client.put_object(Bucket=bucket, Key=plan.current.key, Body=plan.current.body,
                          ContentType="application/json", CacheControl="no-store",
                          Metadata={"sha256": plan.current.sha256})
        check = client.get_object(Bucket=bucket, Key=plan.current.key)["Body"].read()
        if hashlib.sha256(check).hexdigest() != plan.current.sha256:
            raise RuntimeError("Published manifest verification failed")
    return {"objectsVerified": len(plan.objects) + 1,
            "rowCount": sum(plan.counts.values()), "published": publish}


def main() -> None:
    parser = argparse.ArgumentParser(description="Non-destructive Neon to R2 export")
    parser.add_argument("--upload", action="store_true",
                        help="Upload immutable objects to a private R2 bucket, then read-verify")
    parser.add_argument("--publish-index", action="store_true",
                        help="Also publish R2 current.json after all uploads pass verification")
    args = parser.parse_args()
    if args.publish_index and not args.upload:
        parser.error("--publish-index requires --upload")
    url = os.getenv("DATABASE_URL_UNPOOLED") or os.getenv("DATABASE_URL")
    if not url:
        parser.error("A read-only DATABASE_URL_UNPOOLED or DATABASE_URL is required")

    import psycopg2
    connection = psycopg2.connect(url)
    try:
        source = collect_source_rows(connection)
    finally:
        connection.close()

    export_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + secrets.token_hex(4)
    plan = build_export(source, export_id)
    stats = {"schemaVersion": SCHEMA_VERSION, "sourceCounts": plan.counts,
             "exportId": export_id, "objects": len(plan.objects) + 1,
             "compressedBytes": sum(len(x.body) for x in plan.objects),
             "publicDemoSites": plan.current.rows, "mode": "dry-run"}
    if args.upload:
        client, bucket = make_r2_client()
        stats.update(upload_and_verify(client, bucket, plan, args.publish_index))
        stats["mode"] = "uploaded"
    print(json.dumps(stats, sort_keys=True))


if __name__ == "__main__":
    main()
