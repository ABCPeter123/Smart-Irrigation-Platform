import { Recommendation, Site, WeatherBundle } from "../types";

const cropCoefficient: Record<Site["cropType"], number> = {
  tomatoes: 1.1,
  "leafy-greens": 0.95,
  strawberries: 0.85,
};

const soilReserveFactor: Record<Site["soilType"], number> = {
  sandy: 1.25,
  loam: 0.85,
  clay: 0.55,
};

const targetMoisture: Record<Site["cropType"], number> = {
  tomatoes: 30,
  "leafy-greens": 34,
  strawberries: 28,
};

const irrigationCap: Record<Site["irrigationMethod"], number> = {
  drip: 18,
  sprinkler: 24,
  manual: 14,
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const round = (value: number, digits = 1) => {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
};

const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0);

const litresFromMm = (mm: number, areaHa: number) => {
  return Math.round(mm * areaHa * 10000);
};

export function buildRecommendation(site: Site, weather: WeatherBundle): Recommendation {
  const et24 = sum(weather.next24h.evapotranspirationMm);
  const precip24 = sum(weather.next24h.precipitationMm);
  const popPeak = Math.max(...weather.next24h.precipitationProbabilityPct, 0);

  const cropET = et24 * cropCoefficient[site.cropType];
  const rainCredit = site.environment === "greenhouse" ? 0 : precip24 * 0.78;

  const heatLoad =
    weather.today.maxTempC >= 30 ? 2.8 :
    weather.today.maxTempC >= 26 ? 1.6 :
    weather.today.maxTempC >= 22 ? 0.7 : 0;

  const windLoad =
    weather.current.windSpeedKmh >= 24 ? 1.6 :
    weather.current.windSpeedKmh >= 16 ? 0.8 : 0;

  const soilLoad = soilReserveFactor[site.soilType];

  let sensorLoad = 0;
  if (typeof site.sensorMoisturePct === "number") {
    const gap = targetMoisture[site.cropType] - site.sensorMoisturePct;
    sensorLoad = gap > 0 ? gap / 2.8 : -0.8;
  }

  let recommendationMm = cropET - rainCredit + heatLoad + windLoad + soilLoad + sensorLoad;

  if (site.environment === "greenhouse") {
    recommendationMm += 1.2;
  }

  recommendationMm = clamp(round(recommendationMm), 0, irrigationCap[site.irrigationMethod]);

  const recommendedLitres = litresFromMm(recommendationMm, site.areaHa);

  const urgency: Recommendation["urgency"] =
    recommendationMm >= 12 || (site.sensorMoisturePct ?? 100) < 24
      ? "High"
      : recommendationMm >= 6
      ? "Medium"
      : "Low";

  const riskBand: Recommendation["riskBand"] =
    urgency === "High" ? "Priority" : urgency === "Medium" ? "Watch" : "Stable";

  const startBy =
    urgency === "High"
      ? "within 6 hours"
      : urgency === "Medium"
      ? "today before 10:00 PM"
      : "tomorrow morning";

  const headline =
    urgency === "High"
      ? `Run irrigation for ${site.name}`
      : urgency === "Medium"
      ? `Plan irrigation for ${site.name}`
      : `Maintain current schedule for ${site.name}`;

  const actionLabel =
    recommendationMm > 0 ? `Apply ${recommendationMm} mm` : "No irrigation required";

  const reasons: string[] = [
    `Next-24h crop water demand estimated at ${round(cropET)} mm`,
    site.environment === "greenhouse"
      ? "Greenhouse site excludes direct rainfall credit"
      : `Forecast rainfall credit applied: ${round(rainCredit)} mm`,
    `Today's weather profile: ${weather.today.maxTempC}°C / ${weather.today.minTempC}°C`,
  ];

  if (weather.current.windSpeedKmh >= 16) {
    reasons.push(`Wind load elevated at ${weather.current.windSpeedKmh} km/h`);
  }

  if (typeof site.sensorMoisturePct === "number") {
    reasons.push(`Soil moisture reading at ${site.sensorMoisturePct}%`);
  }

  const modelScoreBase = 92;
  const modelScorePenalty =
    (site.connectedProbes ? 0 : 5) +
    (site.environment === "open-field" && popPeak > 65 ? 4 : 0) +
    (weather.next24h.times.length < 20 ? 5 : 0);

  const modelScore = clamp(modelScoreBase - modelScorePenalty, 78, 96);

  const summary =
    recommendationMm > 0
      ? `${actionLabel} ${startBy}. Estimated delivery volume: ${recommendedLitres.toLocaleString()} L.`
      : `No irrigation pulse is needed in the current 24-hour window.`;

    return {
        siteId: site.id,
        headline,
        actionLabel,
        startBy,
        urgency,
        riskBand,
        recommendedMm: recommendationMm,
        recommendedLitres,
        modelScore,
        summary,
        reasons,
    };
}