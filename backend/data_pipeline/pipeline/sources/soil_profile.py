from dataclasses import dataclass

from pipeline.db import Database
from pipeline.sites import Site


@dataclass(frozen=True)
class SoilProfile:
    soil_texture: str
    sand_pct: float
    silt_pct: float
    clay_pct: float
    organic_carbon_g_kg: float
    bulk_density_kg_m3: float
    water_holding_capacity_mm: float
    infiltration_class: str


MANUAL_SOIL_PROFILES = {
    "sand": SoilProfile(
        soil_texture="sand",
        sand_pct=88.0,
        silt_pct=7.0,
        clay_pct=5.0,
        organic_carbon_g_kg=8.0,
        bulk_density_kg_m3=1550.0,
        water_holding_capacity_mm=70.0,
        infiltration_class="fast",
    ),
    "sandy-loam": SoilProfile(
        soil_texture="sandy-loam",
        sand_pct=65.0,
        silt_pct=25.0,
        clay_pct=10.0,
        organic_carbon_g_kg=14.0,
        bulk_density_kg_m3=1450.0,
        water_holding_capacity_mm=110.0,
        infiltration_class="moderate-fast",
    ),
    "loam": SoilProfile(
        soil_texture="loam",
        sand_pct=40.0,
        silt_pct=40.0,
        clay_pct=20.0,
        organic_carbon_g_kg=20.0,
        bulk_density_kg_m3=1350.0,
        water_holding_capacity_mm=160.0,
        infiltration_class="moderate",
    ),
    "clay-loam": SoilProfile(
        soil_texture="clay-loam",
        sand_pct=30.0,
        silt_pct=35.0,
        clay_pct=35.0,
        organic_carbon_g_kg=24.0,
        bulk_density_kg_m3=1300.0,
        water_holding_capacity_mm=190.0,
        infiltration_class="slow-moderate",
    ),
    "clay": SoilProfile(
        soil_texture="clay",
        sand_pct=20.0,
        silt_pct=30.0,
        clay_pct=50.0,
        organic_carbon_g_kg=28.0,
        bulk_density_kg_m3=1250.0,
        water_holding_capacity_mm=210.0,
        infiltration_class="slow",
    ),
}


class SoilProfileProvider:
    def get_profile(self, site: Site) -> SoilProfile:
        return MANUAL_SOIL_PROFILES.get(
            site.soil_type,
            MANUAL_SOIL_PROFILES["loam"],
        )

    def save_profile(self, db: Database, site: Site, profile: SoilProfile) -> None:
        db.execute(
            """
            INSERT INTO raw_soil_profiles (
                site_id,
                soil_texture,
                sand_pct,
                silt_pct,
                clay_pct,
                organic_carbon_g_kg,
                bulk_density_kg_m3,
                water_holding_capacity_mm,
                infiltration_class
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT(site_id)
            DO UPDATE SET
                fetched_at = NOW(),
                soil_texture = EXCLUDED.soil_texture,
                sand_pct = EXCLUDED.sand_pct,
                silt_pct = EXCLUDED.silt_pct,
                clay_pct = EXCLUDED.clay_pct,
                organic_carbon_g_kg = EXCLUDED.organic_carbon_g_kg,
                bulk_density_kg_m3 = EXCLUDED.bulk_density_kg_m3,
                water_holding_capacity_mm = EXCLUDED.water_holding_capacity_mm,
                infiltration_class = EXCLUDED.infiltration_class
            """,
            (
                site.id,
                profile.soil_texture,
                profile.sand_pct,
                profile.silt_pct,
                profile.clay_pct,
                profile.organic_carbon_g_kg,
                profile.bulk_density_kg_m3,
                profile.water_holding_capacity_mm,
                profile.infiltration_class,
            ),
        )