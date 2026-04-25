import type { NormalizedWeatherBundle } from "./weather.service";

type SiteInput = {
  id: string;
  name: string;
  locationLabel: string;
  latitude: number;
  longitude: number;
  areaHa: number;
  cropType: string;
  environment: string;
  irrigationMethod: string;
  soilType: string;
};

type IrrigationLogInput = {
  appliedMm: number;
  appliedLitres: number;
  performedAt: Date;
};

export type RecommendationResult = {
  siteId: string;
  headline: string;
  actionLabel: string;
  startBy: string;
  urgency: "Low" | "Medium" | "High";
  riskBand: "Low" | "Moderate" | "Elevated" | "High";
  recommendedMm: number;
  recommendedLitres: number;
  modelScore: number;
  summary: string;
  reasons: string[];
  inputs: {
    cropCoefficient: number;
    dailyEt0Mm: number;
    cropWaterDemandMm: number;
    forecastRainMm: number;
    recentAppliedMm: number;
    netWaterNeedMm: number;
    irrigationCapMm: number;
  };
  generatedAt: string;
};

function round(value: number, decimals = 1): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function getCropCoefficient(cropType: string): number {
  const normalized = cropType.toLowerCase();

  if (normalized.includes("leafy")) return 0.95;
  if (normalized.includes("lettuce")) return 0.95;
  if (normalized.includes("strawberry")) return 0.85;
  if (normalized.includes("tomato")) return 1.05;
  if (normalized.includes("pepper")) return 1.0;
  if (normalized.includes("cucumber")) return 1.05;
  if (normalized.includes("herb")) return 0.8;

  return 0.9;
}

function getSoilReserveFactor(soilType: string): number {
  const normalized = soilType.toLowerCase();

  if (normalized.includes("sand")) return 0.85;
  if (normalized.includes("loam")) return 1.0;
  if (normalized.includes("clay")) return 1.15;
  if (normalized.includes("peat")) return 1.1;

  return 1.0;
}

function getIrrigationCapMm(irrigationMethod: string): number {
  const normalized = irrigationMethod.toLowerCase();

  if (normalized.includes("drip")) return 12;
  if (normalized.includes("sprinkler")) return 18;
  if (normalized.includes("flood")) return 25;

  return 15;
}

function getEnvironmentFactor(environment: string): number {
  const normalized = environment.toLowerCase();

  if (normalized.includes("greenhouse")) return 0.85;
  if (normalized.includes("indoor")) return 0.8;

  return 1.0;
}

function getRecentAppliedMm(logs: IrrigationLogInput[]): number {
  const now = Date.now();
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

  return logs.reduce((total, log) => {
    const ageMs = now - new Date(log.performedAt).getTime();

    if (ageMs > threeDaysMs) return total;

    const ageDays = ageMs / (24 * 60 * 60 * 1000);
    const creditFactor = Math.max(0.25, 1 - ageDays * 0.25);

    return total + log.appliedMm * creditFactor;
  }, 0);
}

function getUrgency(netWaterNeedMm: number, temperatureMaxC: number, windSpeedKmh: number): RecommendationResult["urgency"] {
  if (netWaterNeedMm >= 8 || temperatureMaxC >= 30 || windSpeedKmh >= 35) {
    return "High";
  }

  if (netWaterNeedMm >= 4 || temperatureMaxC >= 25 || windSpeedKmh >= 25) {
    return "Medium";
  }

  return "Low";
}

function getRiskBand(urgency: RecommendationResult["urgency"], netWaterNeedMm: number): RecommendationResult["riskBand"] {
  if (urgency === "High") return "High";
  if (urgency === "Medium" && netWaterNeedMm >= 6) return "Elevated";
  if (urgency === "Medium") return "Moderate";
  return "Low";
}

function getStartBy(urgency: RecommendationResult["urgency"]): string {
  if (urgency === "High") return "Within 12 hours";
  if (urgency === "Medium") return "Within 24 hours";
  return "No urgent irrigation needed";
}

function getModelScore(weather: NormalizedWeatherBundle, recentLogs: IrrigationLogInput[]): number {
  let score = 70;

  if (weather.current.temperatureC !== null) score += 5;
  if (weather.current.relativeHumidityPct !== null) score += 5;
  if (weather.current.windSpeedKmh !== null) score += 5;
  if (weather.daily.et0Mm !== null) score += 10;
  if (weather.daily.precipitationSumMm !== null) score += 5;
  if (recentLogs.length > 0) score += 5;

  return Math.min(score, 95);
}

export function buildRecommendation(input: {
  site: SiteInput;
  weather: NormalizedWeatherBundle;
  recentIrrigationLogs: IrrigationLogInput[];
}): RecommendationResult {
  const { site, weather, recentIrrigationLogs } = input;

  const cropCoefficient = getCropCoefficient(site.cropType);
  const soilReserveFactor = getSoilReserveFactor(site.soilType);
  const environmentFactor = getEnvironmentFactor(site.environment);
  const irrigationCapMm = getIrrigationCapMm(site.irrigationMethod);

  const dailyEt0Mm = weather.daily.et0Mm ?? 0;
  const temperatureMaxC = weather.daily.temperatureMaxC ?? weather.current.temperatureC ?? 0;
  const windSpeedKmh = weather.current.windSpeedKmh ?? 0;
  const forecastRainMm = weather.daily.precipitationSumMm ?? 0;

  const cropWaterDemandMm =
    dailyEt0Mm * cropCoefficient * soilReserveFactor * environmentFactor;

  const rainfallCreditMm = forecastRainMm * 0.7;
  const recentAppliedMm = getRecentAppliedMm(recentIrrigationLogs);

  const rawNetWaterNeedMm = cropWaterDemandMm - rainfallCreditMm - recentAppliedMm;
  const netWaterNeedMm = Math.max(0, rawNetWaterNeedMm);

  const recommendedMm = Math.min(netWaterNeedMm, irrigationCapMm);
  const roundedRecommendedMm = round(recommendedMm, 1);

  const areaSqm = site.areaHa * 10000;
  const recommendedLitres = Math.round(roundedRecommendedMm * areaSqm);

  const urgency = getUrgency(netWaterNeedMm, temperatureMaxC, windSpeedKmh);
  const riskBand = getRiskBand(urgency, netWaterNeedMm);
  const startBy = getStartBy(urgency);
  const modelScore = getModelScore(weather, recentIrrigationLogs);

  const reasons: string[] = [];

  reasons.push(`Reference ET0 is ${round(dailyEt0Mm, 1)} mm today.`);
  reasons.push(`Crop coefficient for ${site.cropType} is estimated at ${cropCoefficient}.`);

  if (forecastRainMm > 0) {
    reasons.push(`Forecast rainfall provides an estimated ${round(rainfallCreditMm, 1)} mm water credit.`);
  } else {
    reasons.push("No meaningful forecast rainfall credit is available.");
  }

  if (recentAppliedMm > 0) {
    reasons.push(`Recent irrigation logs provide an estimated ${round(recentAppliedMm, 1)} mm water credit.`);
  } else {
    reasons.push("No recent irrigation has been logged for this site.");
  }

  if (site.environment.toLowerCase().includes("greenhouse")) {
    reasons.push("Greenhouse environment reduces open-field weather exposure in the model.");
  }

  if (windSpeedKmh >= 25) {
    reasons.push(`Wind speed is elevated at ${round(windSpeedKmh, 1)} km/h, increasing drying risk.`);
  }

  let headline: string;
  let actionLabel: string;
  let summary: string;

  if (roundedRecommendedMm <= 0.5) {
    headline = "No irrigation recommended right now";
    actionLabel = "Monitor conditions";
    summary =
      "Current weather, forecast rainfall, and recent irrigation records do not justify additional watering at this time.";
  } else if (urgency === "High") {
    headline = "Irrigation recommended soon";
    actionLabel = `Apply ${roundedRecommendedMm} mm`;
    summary =
      "Crop water demand is high relative to rainfall and recent irrigation. Apply water soon to reduce moisture stress risk.";
  } else if (urgency === "Medium") {
    headline = "Irrigation may be needed";
    actionLabel = `Apply ${roundedRecommendedMm} mm`;
    summary =
      "Weather and crop demand suggest a moderate irrigation need. Apply water within the recommended window if field conditions confirm dryness.";
  } else {
    headline = "Low irrigation priority";
    actionLabel = `Optional ${roundedRecommendedMm} mm`;
    summary =
      "The site has a low irrigation priority. Watering is optional and should depend on observed crop and soil conditions.";
  }

  return {
    siteId: site.id,
    headline,
    actionLabel,
    startBy,
    urgency,
    riskBand,
    recommendedMm: roundedRecommendedMm,
    recommendedLitres,
    modelScore,
    summary,
    reasons,
    inputs: {
      cropCoefficient,
      dailyEt0Mm: round(dailyEt0Mm, 1),
      cropWaterDemandMm: round(cropWaterDemandMm, 1),
      forecastRainMm: round(forecastRainMm, 1),
      recentAppliedMm: round(recentAppliedMm, 1),
      netWaterNeedMm: round(netWaterNeedMm, 1),
      irrigationCapMm,
    },
    generatedAt: new Date().toISOString(),
  };
}