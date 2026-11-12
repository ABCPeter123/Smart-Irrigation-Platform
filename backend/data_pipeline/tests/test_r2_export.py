"""Contract and integrity tests for the non-destructive R2 migration."""
import gzip
import hashlib
import io
import json
import unittest
from datetime import date, datetime, timezone
from unittest.mock import patch

import r2_export


def fixture():
    now = datetime(2026, 11, 12, 15, 0, tzinfo=timezone.utc)
    site = {
        "id": "demo-kitchener-tomatoes", "name": "Kitchener Tomato Plot",
        "latitude": 43.4516, "longitude": -80.4925,
        "area_hectares": 1.2, "crop_type": "tomatoes",
        "soil_type": "loam", "irrigation_method": "drip",
        "created_at": now,
    }
    return {
        "pipeline_sites": [site],
        "raw_soil_profiles": [{
            "id": 1, "site_id": site["id"], "soil_texture": "loam",
            "sand_pct": 40., "fetched_at": now, "source": "manual-estimate",
        }],
        "raw_weather_forecast_daily": [{
            "id": 1, "site_id": site["id"], "forecast_date": date(2026, 11, 13),
            "temperature_max_c": 10., "precipitation_sum_mm": 0.,
        }],
        "raw_weather_history_daily": [{
            "id": 1, "site_id": site["id"], "weather_date": date(2026, 10, 30),
            "temperature_max_c": 8., "source": "open-meteo-past-days",
        }],
        "site_features_daily": [{
            "id": 1, "site_id": site["id"], "feature_date": date(2026, 11, 12),
            "et0_today_mm": 1.3, "soil_texture": "loam",
        }],
        "irrigation_recommendations": [{
            "id": 1, "site_id": site["id"], "recommendation_date": date(2026, 11, 12),
            "generated_at": now, "urgency": "Low", "action_label": "No irrigation needed",
            "recommended_mm": 0.0, "estimated_liters": 0.0,
            "confidence_score": 100.0, "water_deficit_mm": 0.0,
            "model_version": "weather-balance-service-v1.0",
            "reasons": ["Rain forecast"], "input_features": {"et0": 1.3},
        }],
    }


class FakeS3:
    def __init__(self, corrupt=False):
        self.objects = {}
        self.writes = []
        self.corrupt = corrupt

    def put_object(self, **kwargs):
        key = kwargs["Key"]
        if kwargs.get("IfNoneMatch") == "*" and key in self.objects:
            raise ValueError("Existing immutable key must not be replaced")
        self.objects[key] = kwargs["Body"]
        self.writes.append(key)

    def get_object(self, **kwargs):
        data = self.objects[kwargs["Key"]]
        if self.corrupt:
            data += b"corrupted"
        return {"Body": io.BytesIO(data)}


class ArchiveTests(unittest.TestCase):
    def test_versioned_archive_contains_all_six_tables_and_months(self):
        src = fixture()
        plan = r2_export.build_export(src, "20261112T150000Z-test1234")
        self.assertEqual(len(plan.objects), 3)  # profile + October + November
        self.assertEqual(sum(obj.rows for obj in plan.objects), 6)
        self.assertEqual(plan.counts, {name: 1 for name in r2_export.TABLES})
        self.assertTrue(all(obj.key.startswith("irrigation/v1/exports/") for obj in plan.objects))
        archived = []
        for obj in plan.objects:
            self.assertEqual(hashlib.sha256(obj.body).hexdigest(), obj.sha256)
            payload = json.loads(gzip.decompress(obj.body))
            if "tables" in payload:
                for table_name, rows in payload["tables"].items():
                    archived.extend((table_name, row) for row in rows)
            else:
                archived.extend(("pipeline_sites", payload["site"]) for _ in [0] if payload["site"])
                archived.extend(("raw_soil_profiles", row) for row in payload["soilProfiles"])
        self.assertEqual(len(archived), 6)
        self.assertEqual({name for name, _ in archived}, set(r2_export.TABLES))
        self.assertEqual(len({obj.key for obj in plan.objects}), len(plan.objects))

    def test_current_index_is_small_and_keeps_public_api_contract(self):
        plan = r2_export.build_export(fixture(), "20261112T150000Z-test1234")
        current = json.loads(plan.current.body)
        self.assertEqual(current["status"], "ready")
        self.assertEqual(current["schemaVersion"], 1)
        self.assertEqual(len(current["records"]), 1)
        record = current["records"][0]
        self.assertEqual(record["forecastDate"], "2026-11-12")
        self.assertEqual(record["recommendedMm"], 0)
        self.assertEqual(record["dataCompletenessPct"], 100)
        self.assertEqual(record["modelVersion"], "weather-balance-service-v1.0")
        self.assertNotIn("input_features", record)
        self.assertNotIn("databaseUrl", current)
        self.assertLess(len(plan.current.body), 5000)

    def test_deterministic_gzip_and_checksums(self):
        first = r2_export.build_export(fixture(), "20261112T150000Z-test1234")
        second = r2_export.build_export(fixture(), "20261112T150000Z-test1234")
        self.assertEqual([o.body for o in first.objects], [o.body for o in second.objects])
        self.assertEqual(first.manifest.body, second.manifest.body)
        self.assertEqual(first.current.body, second.current.body)

    def test_orphan_rows_are_not_silently_dropped(self):
        src = fixture()
        src["raw_weather_history_daily"].append({
            "id": 900, "site_id": "other-site", "weather_date": date(2026, 1, 5),
            "temperature_max_c": 3.,
        })
        plan = r2_export.build_export(src, "20261112T150000Z-test1234")
        self.assertEqual(plan.counts["raw_weather_history_daily"], 2)
        self.assertEqual(sum(obj.rows for obj in plan.objects), 7)
        self.assertEqual(plan.current.rows, 1)

    def test_current_index_excludes_nondemo_sites(self):
        src = fixture()
        src["pipeline_sites"].append({**src["pipeline_sites"][0], "id": "private-field",
                                      "name": "Private field"})
        plan = r2_export.build_export(src, "20261112T150000Z-test1234")
        self.assertEqual(plan.counts["pipeline_sites"], 2)
        self.assertEqual(json.loads(plan.current.body)["records"][0]["id"],
                         "demo-kitchener-tomatoes")
        self.assertEqual(len(json.loads(plan.current.body)["records"]), 1)

    def test_oversized_object_fails_instead_of_truncating(self):
        with patch.object(r2_export, "MAX_UNCOMPRESSED", 10):
            with self.assertRaises(ValueError):
                r2_export.build_export(fixture(), "20261112T150000Z-test1234")

    def test_no_pointer_published_until_every_object_reads_back_correctly(self):
        plan = r2_export.build_export(fixture(), "20261112T150000Z-test1234")
        s3 = FakeS3(corrupt=True)
        with self.assertRaises(RuntimeError):
            r2_export.upload_and_verify(s3, "test-bucket", plan, publish=True)
        self.assertNotIn(plan.current.key, s3.objects)

    def test_verified_upload_preserves_immutable_archives(self):
        plan = r2_export.build_export(fixture(), "20261112T150000Z-test1234")
        s3 = FakeS3()
        status = r2_export.upload_and_verify(s3, "test-bucket", plan, publish=True)
        self.assertTrue(status["published"])
        self.assertEqual(status["rowCount"], 6)
        self.assertEqual(len(s3.objects), len(plan.objects) + 2)
        with self.assertRaises(ValueError):
            r2_export.upload_and_verify(s3, "test-bucket", plan, publish=True)


if __name__ == "__main__":
    unittest.main()
