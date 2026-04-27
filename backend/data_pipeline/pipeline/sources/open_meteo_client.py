from datetime import date, timedelta
from typing import Any

import requests

from pipeline.sites import Site


FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"


class OpenMeteoClient:
    def fetch_forecast(self, site: Site) -> list[dict[str, Any]]:
        params = {
            "latitude": site.latitude,
            "longitude": site.longitude,
            "timezone": "auto",
            "forecast_days": 7,
            "daily": ",".join(
                [
                    "temperature_2m_max",
                    "temperature_2m_min",
                    "precipitation_sum",
                    "precipitation_probability_max",
                    "wind_speed_10m_max",
                    "et0_fao_evapotranspiration",
                ]
            ),
        }

        response = requests.get(FORECAST_URL, params=params, timeout=20)
        response.raise_for_status()

        payload = response.json()
        daily = payload.get("daily", {})

        return self._parse_daily_forecast(daily)

    def fetch_history(self, site: Site, days_back: int = 14) -> list[dict[str, Any]]:
        end_date = date.today() - timedelta(days=1)
        start_date = end_date - timedelta(days=days_back - 1)

        params = {
            "latitude": site.latitude,
            "longitude": site.longitude,
            "timezone": "auto",
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "daily": ",".join(
                [
                    "temperature_2m_max",
                    "temperature_2m_min",
                    "precipitation_sum",
                    "wind_speed_10m_max",
                    "et0_fao_evapotranspiration",
                ]
            ),
        }

        response = requests.get(ARCHIVE_URL, params=params, timeout=20)
        response.raise_for_status()

        payload = response.json()
        daily = payload.get("daily", {})

        return self._parse_daily_history(daily)

    def _parse_daily_forecast(self, daily: dict[str, Any]) -> list[dict[str, Any]]:
        dates = daily.get("time", [])
        rows: list[dict[str, Any]] = []

        for index, raw_date in enumerate(dates):
            rows.append(
                {
                    "forecast_date": date.fromisoformat(raw_date),
                    "temperature_max_c": self._get(daily, "temperature_2m_max", index),
                    "temperature_min_c": self._get(daily, "temperature_2m_min", index),
                    "precipitation_sum_mm": self._get(daily, "precipitation_sum", index),
                    "precipitation_probability_max_pct": self._get(
                        daily,
                        "precipitation_probability_max",
                        index,
                    ),
                    "wind_speed_max_kmh": self._get(daily, "wind_speed_10m_max", index),
                    "et0_fao_mm": self._get(
                        daily,
                        "et0_fao_evapotranspiration",
                        index,
                    ),
                }
            )

        return rows

    def _parse_daily_history(self, daily: dict[str, Any]) -> list[dict[str, Any]]:
        dates = daily.get("time", [])
        rows: list[dict[str, Any]] = []

        for index, raw_date in enumerate(dates):
            rows.append(
                {
                    "weather_date": date.fromisoformat(raw_date),
                    "temperature_max_c": self._get(daily, "temperature_2m_max", index),
                    "temperature_min_c": self._get(daily, "temperature_2m_min", index),
                    "precipitation_sum_mm": self._get(daily, "precipitation_sum", index),
                    "wind_speed_max_kmh": self._get(daily, "wind_speed_10m_max", index),
                    "et0_fao_mm": self._get(
                        daily,
                        "et0_fao_evapotranspiration",
                        index,
                    ),
                }
            )

        return rows

    def _get(self, data: dict[str, Any], key: str, index: int):
        values = data.get(key, [])

        if index >= len(values):
            return None

        return values[index]