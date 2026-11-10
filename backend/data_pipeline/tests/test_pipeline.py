import os
import unittest
from datetime import date
from pathlib import Path

from pipeline.db import Database
from pipeline.recommendation_model import RecommendationModel
from pipeline.sites import get_sites, seed_demo_sites_if_empty


ROOT = Path(__file__).resolve().parents[1]
DATABASE_URL = os.getenv("TEST_DATABASE_URL")


@unittest.skipUnless(DATABASE_URL, "Set TEST_DATABASE_URL for the database integration tests")
class DatabasePipelineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = Database(DATABASE_URL)
        cls.db.run_sql_file(str(ROOT / "sql" / "001_pipeline_tables.sql"))

    def test_demo_sites_seed_idempotently(self):
        seed_demo_sites_if_empty(self.db)
        seed_demo_sites_if_empty(self.db)
        sites = get_sites(self.db)
        self.assertGreaterEqual(len(sites), 2)
        self.assertTrue(all(site.id.startswith("demo-") for site in sites))

    def test_recommendations_upsert_same_site_and_day(self):
        feature = {
            "site_id": "test-repeatable-recommendation",
            "feature_date": date.today(),
            "et0_today_mm": 6.0,
            "crop_coefficient": 1.05,
            "forecast_rain_24h_mm": 0,
            "rainfall_3d_mm": 0,
            "water_holding_capacity_mm": 160,
            "irrigation_efficiency": 0.90,
            "forecast_rain_72h_mm": 0,
            "precipitation_probability_max_pct": 0,
            "temperature_max_c": 31,
            "wind_max_kmh": 36,
            "area_hectares": 0.5,
            "soil_texture": "loam",
            "temperature_min_c": 10,
            "rainfall_7d_mm": 0,
        }
        model = RecommendationModel()
        first = model.generate_for_feature(self.db, feature)
        second = model.generate_for_feature(self.db, feature)
        self.assertEqual(first["urgency"], "High")
        self.assertGreater(first["recommended_mm"], 0)
        self.assertEqual(first["recommended_mm"], second["recommended_mm"])
        self.assertEqual(first["estimated_liters"], round(first["recommended_mm"] * 5000, 0))
        count = self.db.fetch_one(
            "SELECT COUNT(*) AS total FROM irrigation_recommendations WHERE site_id = %s",
            ("test-repeatable-recommendation",),
        )
        self.assertEqual(count["total"], 1)


if __name__ == "__main__":
    unittest.main()
