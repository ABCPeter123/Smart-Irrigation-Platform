from pathlib import Path

from pipeline.config import get_config
from pipeline.db import Database
from pipeline.feature_builder import FeatureBuilder
from pipeline.recommendation_model import RecommendationModel
from pipeline.sites import get_sites, seed_demo_sites_if_empty
from pipeline.sources.open_meteo_client import OpenMeteoClient
from pipeline.sources.soil_profile import SoilProfileProvider


ROOT = Path(__file__).resolve().parent
SQL_FILE = ROOT / "sql" / "001_pipeline_tables.sql"


def main() -> None:
    config = get_config()
    db = Database(config.database_url)

    print("Running pipeline database migration...")
    db.run_sql_file(str(SQL_FILE))

    print("Seeding demo sites if needed...")
    seed_demo_sites_if_empty(db)

    sites = get_sites(db)

    if not sites:
        print("No sites found. Add rows to pipeline_sites first.")
        return

    weather_client = OpenMeteoClient()
    soil_provider = SoilProfileProvider()
    feature_builder = FeatureBuilder()
    recommendation_model = RecommendationModel()

    print(f"Found {len(sites)} site(s).")

    for site in sites:
        print(f"Processing site: {site.name}")

        forecast_rows = weather_client.fetch_forecast(site)
        save_forecast_rows(db, site.id, forecast_rows)

        history_rows = weather_client.fetch_history(site, days_back=14)
        save_history_rows(db, site.id, history_rows)

        soil_profile = soil_provider.get_profile(site)
        soil_provider.save_profile(db, site, soil_profile)

        feature = feature_builder.build_for_site(db, site)

        if not feature:
            print(f"Skipped recommendation for {site.name}. Missing features.")
            continue

        recommendation = recommendation_model.generate_for_feature(db, feature)

        print(
            f"Recommendation for {site.name}: "
            f"{recommendation['urgency']} | "
            f"{recommendation['action_label']} | "
            f"{recommendation['confidence_score']}% confidence"
        )

    print("Pipeline completed successfully.")


def save_forecast_rows(db: Database, site_id: str, rows: list[dict]) -> None:
    db.execute_many(
        """
        INSERT INTO raw_weather_forecast_daily (
            site_id,
            forecast_date,
            temperature_max_c,
            temperature_min_c,
            precipitation_sum_mm,
            precipitation_probability_max_pct,
            wind_speed_max_kmh,
            et0_fao_mm
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT(site_id, forecast_date)
        DO UPDATE SET
            fetched_at = NOW(),
            temperature_max_c = EXCLUDED.temperature_max_c,
            temperature_min_c = EXCLUDED.temperature_min_c,
            precipitation_sum_mm = EXCLUDED.precipitation_sum_mm,
            precipitation_probability_max_pct = EXCLUDED.precipitation_probability_max_pct,
            wind_speed_max_kmh = EXCLUDED.wind_speed_max_kmh,
            et0_fao_mm = EXCLUDED.et0_fao_mm
        """,
        [
            (
                site_id,
                row["forecast_date"],
                row.get("temperature_max_c"),
                row.get("temperature_min_c"),
                row.get("precipitation_sum_mm"),
                row.get("precipitation_probability_max_pct"),
                row.get("wind_speed_max_kmh"),
                row.get("et0_fao_mm"),
            )
            for row in rows
        ],
    )


def save_history_rows(db: Database, site_id: str, rows: list[dict]) -> None:
    db.execute_many(
        """
        INSERT INTO raw_weather_history_daily (
            site_id,
            weather_date,
            temperature_max_c,
            temperature_min_c,
            precipitation_sum_mm,
            wind_speed_max_kmh,
            et0_fao_mm
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT(site_id, weather_date)
        DO UPDATE SET
            fetched_at = NOW(),
            temperature_max_c = EXCLUDED.temperature_max_c,
            temperature_min_c = EXCLUDED.temperature_min_c,
            precipitation_sum_mm = EXCLUDED.precipitation_sum_mm,
            wind_speed_max_kmh = EXCLUDED.wind_speed_max_kmh,
            et0_fao_mm = EXCLUDED.et0_fao_mm
        """,
        [
            (
                site_id,
                row["weather_date"],
                row.get("temperature_max_c"),
                row.get("temperature_min_c"),
                row.get("precipitation_sum_mm"),
                row.get("wind_speed_max_kmh"),
                row.get("et0_fao_mm"),
            )
            for row in rows
        ],
    )


if __name__ == "__main__":
    main()