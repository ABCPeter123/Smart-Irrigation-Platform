from dataclasses import dataclass
from datetime import date
from typing import Any

from pipeline.db import Database


@dataclass(frozen=True)
class Site:
    id: str
    name: str
    latitude: float
    longitude: float
    area_hectares: float
    crop_type: str
    soil_type: str
    irrigation_method: str
    planting_date: date | None


def seed_demo_sites_if_empty(db: Database) -> None:
    existing = db.fetch_one("SELECT id FROM pipeline_sites LIMIT 1")

    if existing:
        return

    db.execute_many(
        """
        INSERT INTO pipeline_sites (
            id,
            name,
            latitude,
            longitude,
            area_hectares,
            crop_type,
            soil_type,
            irrigation_method,
            planting_date
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT(id) DO NOTHING
        """,
        [
            (
                "demo-kitchener-tomatoes",
                "Kitchener Tomato Plot",
                43.4516,
                -80.4925,
                1.2,
                "tomatoes",
                "loam",
                "drip",
                "2026-05-15",
            ),
            (
                "demo-waterloo-leafy-greens",
                "Waterloo Leafy Greens Field",
                43.4723,
                -80.5449,
                0.8,
                "leafy-greens",
                "sandy-loam",
                "sprinkler",
                "2026-05-01",
            ),
        ],
    )


def get_sites(db: Database) -> list[Site]:
    rows = db.fetch_all(
        """
        SELECT
            id,
            name,
            latitude,
            longitude,
            area_hectares,
            crop_type,
            soil_type,
            irrigation_method,
            planting_date
        FROM pipeline_sites
        ORDER BY name ASC
        """
    )

    return [_row_to_site(row) for row in rows]


def _row_to_site(row: dict[str, Any]) -> Site:
    return Site(
        id=str(row["id"]),
        name=str(row["name"]),
        latitude=float(row["latitude"]),
        longitude=float(row["longitude"]),
        area_hectares=float(row["area_hectares"]),
        crop_type=str(row["crop_type"]),
        soil_type=str(row["soil_type"]),
        irrigation_method=str(row["irrigation_method"]),
        planting_date=row.get("planting_date"),
    )