from datetime import date
from typing import Any

from pipeline.db import Database
from pipeline.sites import Site


CROP_COEFFICIENTS = {
    "tomatoes": 1.05,
    "leafy-greens": 0.95,
    "strawberries": 0.85,
    "corn": 1.10,
    "wheat": 0.95,
    "potatoes": 1.00,
}

ROOT_DEPTH_MM = {
    "tomatoes": 700.0,
    "leafy-greens": 300.0,
    "strawberries": 300.0,
    "corn": 900.0,
    "wheat": 1000.0,
    "potatoes": 600.0,
}

IRRIGATION_EFFICIENCY = {
    "drip": 0.90,
    "sprinkler": 0.75,
    "pivot": 0.80,
    "flood": 0.55,
}


class FeatureBuilder:
    def build_for_site(self, db: Database, site: Site) -> dict[str, Any] | None:
        forecast = db.fetch_one(
            """
            SELECT *
            FROM raw_weather_forecast_daily
            WHERE site_id = %s
            ORDER BY forecast_date ASC
            LIMIT 1
            """,
            (site.id,),
        )

        if not forecast:
            return None

        forecast_date = forecast["forecast_date"]

        forecast_72h = db.fetch_one(
            """
            SELECT
                COALESCE(SUM(precipitation_sum_mm), 0) AS forecast_rain_72h_mm,
                COALESCE(SUM(et0_fao_mm), 0) AS et0_7d_partial_mm
            FROM raw_weather_forecast_daily
            WHERE site_id = %s
              AND forecast_date >= %s
              AND forecast_date < %s::date + INTERVAL '3 days'
            """,
            (site.id, forecast_date, forecast_date),
        )

        history = db.fetch_one(
            """
            SELECT
                COALESCE(SUM(CASE WHEN weather_date >= %s::date - INTERVAL '3 days' THEN precipitation_sum_mm ELSE 0 END), 0) AS rainfall_3d_mm,
                COALESCE(SUM(CASE WHEN weather_date >= %s::date - INTERVAL '7 days' THEN precipitation_sum_mm ELSE 0 END), 0) AS rainfall_7d_mm,
                COALESCE(SUM(CASE WHEN weather_date >= %s::date - INTERVAL '14 days' THEN precipitation_sum_mm ELSE 0 END), 0) AS rainfall_14d_mm,
                COALESCE(SUM(CASE WHEN weather_date >= %s::date - INTERVAL '7 days' THEN et0_fao_mm ELSE 0 END), 0) AS et0_history_7d_mm
            FROM raw_weather_history_daily
            WHERE site_id = %s
            """,
            (
                forecast_date,
                forecast_date,
                forecast_date,
                forecast_date,
                site.id,
            ),
        )

        soil = db.fetch_one(
            """
            SELECT *
            FROM raw_soil_profiles
            WHERE site_id = %s
            """,
            (site.id,),
        )

        if not soil:
            return None

        crop_coefficient = CROP_COEFFICIENTS.get(site.crop_type, 1.0)
        root_depth_mm = ROOT_DEPTH_MM.get(site.crop_type, 500.0)
        irrigation_efficiency = IRRIGATION_EFFICIENCY.get(site.irrigation_method, 0.75)

        et0_7d = float(history["et0_history_7d_mm"] or 0) + float(
            forecast_72h["et0_7d_partial_mm"] or 0
        )

        feature = {
            "site_id": site.id,
            "feature_date": forecast_date,

            "temperature_max_c": forecast.get("temperature_max_c"),
            "temperature_min_c": forecast.get("temperature_min_c"),
            "wind_max_kmh": forecast.get("wind_speed_max_kmh"),

            "rainfall_today_mm": forecast.get("precipitation_sum_mm") or 0,
            "rainfall_3d_mm": history.get("rainfall_3d_mm") or 0,
            "rainfall_7d_mm": history.get("rainfall_7d_mm") or 0,
            "rainfall_14d_mm": history.get("rainfall_14d_mm") or 0,

            "forecast_rain_24h_mm": forecast.get("precipitation_sum_mm") or 0,
            "forecast_rain_72h_mm": forecast_72h.get("forecast_rain_72h_mm") or 0,
            "precipitation_probability_max_pct": forecast.get(
                "precipitation_probability_max_pct"
            ),

            "et0_today_mm": forecast.get("et0_fao_mm") or 0,
            "et0_7d_mm": et0_7d,

            "crop_type": site.crop_type,
            "crop_coefficient": crop_coefficient,
            "root_depth_mm": root_depth_mm,

            "soil_type": site.soil_type,
            "soil_texture": soil.get("soil_texture"),
            "sand_pct": soil.get("sand_pct"),
            "silt_pct": soil.get("silt_pct"),
            "clay_pct": soil.get("clay_pct"),
            "water_holding_capacity_mm": soil.get("water_holding_capacity_mm"),
            "infiltration_class": soil.get("infiltration_class"),

            "irrigation_method": site.irrigation_method,
            "irrigation_efficiency": irrigation_efficiency,

            "area_hectares": site.area_hectares,
        }

        self.save_feature(db, feature)

        return feature

    def save_feature(self, db: Database, feature: dict[str, Any]) -> None:
        db.execute(
            """
            INSERT INTO site_features_daily (
                site_id,
                feature_date,

                temperature_max_c,
                temperature_min_c,
                wind_max_kmh,

                rainfall_today_mm,
                rainfall_3d_mm,
                rainfall_7d_mm,
                rainfall_14d_mm,

                forecast_rain_24h_mm,
                forecast_rain_72h_mm,
                precipitation_probability_max_pct,

                et0_today_mm,
                et0_7d_mm,

                crop_type,
                crop_coefficient,
                root_depth_mm,

                soil_type,
                soil_texture,
                sand_pct,
                silt_pct,
                clay_pct,
                water_holding_capacity_mm,
                infiltration_class,

                irrigation_method,
                irrigation_efficiency,

                area_hectares
            )
            VALUES (
                %(site_id)s,
                %(feature_date)s,

                %(temperature_max_c)s,
                %(temperature_min_c)s,
                %(wind_max_kmh)s,

                %(rainfall_today_mm)s,
                %(rainfall_3d_mm)s,
                %(rainfall_7d_mm)s,
                %(rainfall_14d_mm)s,

                %(forecast_rain_24h_mm)s,
                %(forecast_rain_72h_mm)s,
                %(precipitation_probability_max_pct)s,

                %(et0_today_mm)s,
                %(et0_7d_mm)s,

                %(crop_type)s,
                %(crop_coefficient)s,
                %(root_depth_mm)s,

                %(soil_type)s,
                %(soil_texture)s,
                %(sand_pct)s,
                %(silt_pct)s,
                %(clay_pct)s,
                %(water_holding_capacity_mm)s,
                %(infiltration_class)s,

                %(irrigation_method)s,
                %(irrigation_efficiency)s,

                %(area_hectares)s
            )
            ON CONFLICT(site_id, feature_date)
            DO UPDATE SET
                temperature_max_c = EXCLUDED.temperature_max_c,
                temperature_min_c = EXCLUDED.temperature_min_c,
                wind_max_kmh = EXCLUDED.wind_max_kmh,

                rainfall_today_mm = EXCLUDED.rainfall_today_mm,
                rainfall_3d_mm = EXCLUDED.rainfall_3d_mm,
                rainfall_7d_mm = EXCLUDED.rainfall_7d_mm,
                rainfall_14d_mm = EXCLUDED.rainfall_14d_mm,

                forecast_rain_24h_mm = EXCLUDED.forecast_rain_24h_mm,
                forecast_rain_72h_mm = EXCLUDED.forecast_rain_72h_mm,
                precipitation_probability_max_pct = EXCLUDED.precipitation_probability_max_pct,

                et0_today_mm = EXCLUDED.et0_today_mm,
                et0_7d_mm = EXCLUDED.et0_7d_mm,

                crop_type = EXCLUDED.crop_type,
                crop_coefficient = EXCLUDED.crop_coefficient,
                root_depth_mm = EXCLUDED.root_depth_mm,

                soil_type = EXCLUDED.soil_type,
                soil_texture = EXCLUDED.soil_texture,
                sand_pct = EXCLUDED.sand_pct,
                silt_pct = EXCLUDED.silt_pct,
                clay_pct = EXCLUDED.clay_pct,
                water_holding_capacity_mm = EXCLUDED.water_holding_capacity_mm,
                infiltration_class = EXCLUDED.infiltration_class,

                irrigation_method = EXCLUDED.irrigation_method,
                irrigation_efficiency = EXCLUDED.irrigation_efficiency,

                area_hectares = EXCLUDED.area_hectares,
                created_at = NOW()
            """,
            feature,
        )