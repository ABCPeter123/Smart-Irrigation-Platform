from typing import Any

from pipeline.db import Database, to_jsonb


MODEL_VERSION = "feature-store-water-balance-v1.0"


class RecommendationModel:
    def generate_for_feature(self, db: Database, feature: dict[str, Any]) -> dict[str, Any]:
        crop_et_mm = float(feature["et0_today_mm"] or 0) * float(
            feature["crop_coefficient"] or 1
        )

        effective_rain_today = float(feature["forecast_rain_24h_mm"] or 0) * 0.8

        recent_rain_credit = min(float(feature["rainfall_3d_mm"] or 0) * 0.25, 4.0)

        raw_deficit_mm = crop_et_mm - effective_rain_today - recent_rain_credit

        soil_water_holding = float(feature["water_holding_capacity_mm"] or 150)

        soil_stress_factor = self._soil_stress_factor(soil_water_holding)

        water_deficit_mm = max(raw_deficit_mm * soil_stress_factor, 0)

        irrigation_efficiency = float(feature["irrigation_efficiency"] or 0.75)

        recommended_mm = water_deficit_mm / irrigation_efficiency

        rain_72h = float(feature["forecast_rain_72h_mm"] or 0)
        rain_probability = float(feature["precipitation_probability_max_pct"] or 0)
        temp_max = float(feature["temperature_max_c"] or 0)
        wind_max = float(feature["wind_max_kmh"] or 0)

        if rain_72h >= 8 or rain_probability >= 75:
            recommended_mm *= 0.4
        elif rain_72h >= 4 or rain_probability >= 50:
            recommended_mm *= 0.7

        urgency_score = self._urgency_score(
            water_deficit_mm=water_deficit_mm,
            temp_max=temp_max,
            wind_max=wind_max,
            rain_72h=rain_72h,
            rain_probability=rain_probability,
        )

        urgency = self._urgency_label(urgency_score)

        if urgency == "Low":
            recommended_mm = 0.0

        recommended_mm = round(max(recommended_mm, 0), 1)

        estimated_liters = round(
            recommended_mm * float(feature["area_hectares"] or 1.0) * 10_000,
            0,
        )

        action_label = self._action_label(urgency, recommended_mm)
        start_by = self._start_by(urgency)

        confidence_score = self._confidence_score(feature)

        reasons = self._reasons(
            crop_et_mm=crop_et_mm,
            effective_rain_today=effective_rain_today,
            recent_rain_credit=recent_rain_credit,
            water_deficit_mm=water_deficit_mm,
            rain_72h=rain_72h,
            rain_probability=rain_probability,
            temp_max=temp_max,
            wind_max=wind_max,
            soil_texture=feature.get("soil_texture"),
            urgency=urgency,
        )

        recommendation = {
            "site_id": feature["site_id"],
            "recommendation_date": feature["feature_date"],
            "urgency": urgency,
            "action_label": action_label,
            "recommended_mm": recommended_mm,
            "estimated_liters": estimated_liters,
            "start_by": start_by,
            "confidence_score": confidence_score,
            "water_deficit_mm": round(water_deficit_mm, 2),
            "model_version": MODEL_VERSION,
            "reasons": reasons,
            "input_features": feature,
        }

        self.save_recommendation(db, recommendation)

        return recommendation

    def save_recommendation(self, db: Database, recommendation: dict[str, Any]) -> None:
        db.execute(
            """
            INSERT INTO irrigation_recommendations (
                site_id,
                recommendation_date,
                urgency,
                action_label,
                recommended_mm,
                estimated_liters,
                start_by,
                confidence_score,
                water_deficit_mm,
                model_version,
                reasons,
                input_features
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb)
            """,
            (
                recommendation["site_id"],
                recommendation["recommendation_date"],
                recommendation["urgency"],
                recommendation["action_label"],
                recommendation["recommended_mm"],
                recommendation["estimated_liters"],
                recommendation["start_by"],
                recommendation["confidence_score"],
                recommendation["water_deficit_mm"],
                recommendation["model_version"],
                to_jsonb(recommendation["reasons"]),
                to_jsonb(recommendation["input_features"]),
            ),
        )

    def _soil_stress_factor(self, water_holding_capacity_mm: float) -> float:
        if water_holding_capacity_mm < 90:
            return 1.25

        if water_holding_capacity_mm < 130:
            return 1.10

        if water_holding_capacity_mm > 190:
            return 0.90

        return 1.00

    def _urgency_score(
        self,
        water_deficit_mm: float,
        temp_max: float,
        wind_max: float,
        rain_72h: float,
        rain_probability: float,
    ) -> float:
        score = 0.0

        score += min(water_deficit_mm / 8.0, 1.0) * 60.0

        if temp_max >= 30:
            score += 15.0
        elif temp_max >= 25:
            score += 8.0

        if wind_max >= 30:
            score += 12.0
        elif wind_max >= 20:
            score += 6.0

        if rain_72h >= 8 or rain_probability >= 75:
            score -= 25.0
        elif rain_72h >= 4 or rain_probability >= 50:
            score -= 12.0

        return round(max(0.0, min(score, 100.0)), 1)

    def _urgency_label(self, score: float) -> str:
        if score >= 65:
            return "High"

        if score >= 35:
            return "Medium"

        return "Low"

    def _action_label(self, urgency: str, recommended_mm: float) -> str:
        if recommended_mm <= 0:
            return "No irrigation needed"

        if urgency == "High":
            return f"Irrigate {recommended_mm:.1f} mm"

        if urgency == "Medium":
            return f"Plan {recommended_mm:.1f} mm irrigation"

        return "Monitor field conditions"

    def _start_by(self, urgency: str) -> str:
        if urgency == "High":
            return "Start within 24 hours"

        if urgency == "Medium":
            return "Start within 48 hours"

        return "Recheck tomorrow"

    def _confidence_score(self, feature: dict[str, Any]) -> float:
        required_fields = [
            "temperature_max_c",
            "temperature_min_c",
            "wind_max_kmh",
            "forecast_rain_24h_mm",
            "forecast_rain_72h_mm",
            "rainfall_7d_mm",
            "et0_today_mm",
            "soil_texture",
            "water_holding_capacity_mm",
            "crop_coefficient",
            "irrigation_efficiency",
            "area_hectares",
        ]

        available = 0

        for field in required_fields:
            if feature.get(field) is not None:
                available += 1

        return round((available / len(required_fields)) * 100, 0)

    def _reasons(
        self,
        crop_et_mm: float,
        effective_rain_today: float,
        recent_rain_credit: float,
        water_deficit_mm: float,
        rain_72h: float,
        rain_probability: float,
        temp_max: float,
        wind_max: float,
        soil_texture: str | None,
        urgency: str,
    ) -> list[str]:
        reasons = []

        reasons.append(f"Crop-adjusted evapotranspiration is {crop_et_mm:.1f} mm today.")

        if effective_rain_today > 0:
            reasons.append(f"Expected rainfall offsets about {effective_rain_today:.1f} mm of water demand.")
        else:
            reasons.append("Expected rainfall does not meaningfully offset today's water demand.")

        if recent_rain_credit > 0:
            reasons.append(f"Recent rainfall contributes an estimated {recent_rain_credit:.1f} mm of remaining soil water credit.")

        reasons.append(f"Estimated water deficit is {water_deficit_mm:.1f} mm.")

        if soil_texture:
            reasons.append(f"Soil profile is classified as {soil_texture}.")

        if temp_max >= 25:
            reasons.append(f"Maximum temperature is {temp_max:.1f} C, increasing crop stress risk.")

        if wind_max >= 20:
            reasons.append(f"Wind speed may increase evaporation losses at {wind_max:.1f} km/h.")

        if rain_72h >= 4 or rain_probability >= 50:
            reasons.append("Forecast rainfall lowers the irrigation priority.")

        reasons.append(f"Final urgency is {urgency}.")

        return reasons