import type { ForecastDay } from "./publicWeather.web";

export type DemoField = {
  id: string;
  name: string;
  location: string;
  crop: string;
  areaHa: number;
  latitude: number;
  longitude: number;
  cropCoefficient: number;
  initialMoisturePct: number;
  environment: "open-field" | "greenhouse";
  irrigationMethod: "drip" | "sprinkler";
};

export const DEMO_FIELDS: DemoField[] = [
  { id: "north-ridge", name: "North Ridge Farm", location: "Hay River, NT", crop: "Leafy greens", areaHa: 0.9, latitude: 60.8156, longitude: -115.7999, cropCoefficient: 0.95, initialMoisturePct: 39, environment: "open-field", irrigationMethod: "sprinkler" },
  { id: "aurora", name: "Aurora Greenhouse", location: "Whitehorse, YT", crop: "Tomatoes", areaHa: 0.18, latitude: 60.7212, longitude: -135.0568, cropCoefficient: 1.05, initialMoisturePct: 35, environment: "greenhouse", irrigationMethod: "drip" },
  { id: "boreal", name: "Boreal Berry Plot", location: "Prince George, BC", crop: "Strawberries", areaHa: 0.42, latitude: 53.9171, longitude: -122.7497, cropCoefficient: 0.85, initialMoisturePct: 42, environment: "open-field", irrigationMethod: "drip" },
  { id: "demo-kitchener-tomatoes", name: "Kitchener Tomato Plot", location: "Kitchener, ON", crop: "Tomatoes", areaHa: 1.2, latitude: 43.4516, longitude: -80.4925, cropCoefficient: 1.05, initialMoisturePct: 36, environment: "open-field", irrigationMethod: "drip" },
  { id: "demo-waterloo-leafy-greens", name: "Waterloo Leafy Greens Field", location: "Waterloo, ON", crop: "Leafy greens", areaHa: 0.8, latitude: 43.4723, longitude: -80.5449, cropCoefficient: 0.95, initialMoisturePct: 37, environment: "open-field", irrigationMethod: "sprinkler" },
];

/**
 * Small, transparent water-balance *scenario*, not an agronomically validated
 * soil-moisture forecast. All sites use an illustrative 250 mm root zone,
 * 30% display threshold, 75% rainfall effectiveness and 85% irrigation efficiency.
 */
const ROOT_ZONE_MM = 250;
const RAIN_EFFECTIVENESS = 0.75;
const IRRIGATION_EFFICIENCY = 0.85;
export const DISPLAY_STRESS_THRESHOLD_PCT = 30;
export const PLANNED_APPLICATION_DAY = 3;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const round = (value: number) => Math.round(value * 10) / 10;
const sum = (values: number[]) => values.reduce((acc, item) => acc + item, 0);

export function calculateScenario(args: {
  field: DemoField;
  weatherDays: ForecastDay[];
  days: number;
  startingMoisturePct: number;
  extraRainMm: number;
  plannedIrrigationMm: number;
}) {
  const { field, weatherDays } = args;
  const days = clamp(Math.floor(args.days), 1, Math.min(14, weatherDays.length));
  const startingMoisture = clamp(args.startingMoisturePct, 5, 48);
  const addedRain = clamp(args.extraRainMm, 0, 30);
  const addedIrrigation = clamp(args.plannedIrrigationMm, 0, 25);
  const baseline = [startingMoisture];
  const treated = [startingMoisture];
  const dailyWaterNeedMm: number[] = [];
  const dailyRainCreditMm: number[] = [];

  for (let day = 0; day < days; day++) {
    const weather = weatherDays[day];
    // Greenhouse crops do not receive outdoor precipitation.
    const naturalRain = field.environment === "greenhouse" ? 0 : weather.precipitationMm;
    const scenarioRain = field.environment === "greenhouse" ? 0 : (day === 1 ? addedRain : 0);
    const rainCredit = (naturalRain + scenarioRain) * RAIN_EFFECTIVENESS;
    // Greenhouse ET0 is reduced slightly as an illustrative exposure assumption.
    const cropET = weather.et0Mm * field.cropCoefficient * (field.environment === "greenhouse" ? 0.85 : 1);
    const irrigationApplied = day === PLANNED_APPLICATION_DAY - 1 ? addedIrrigation * IRRIGATION_EFFICIENCY : 0;
    dailyWaterNeedMm.push(cropET);
    dailyRainCreditMm.push(rainCredit);

    // One VWC percentage point represents 2.5 mm water over a 250 mm root zone.
    baseline.push(round(clamp(baseline[day] + (rainCredit - cropET) / (ROOT_ZONE_MM / 100), 5, 48)));
    treated.push(round(clamp(treated[day] + (rainCredit + irrigationApplied - cropET) / (ROOT_ZONE_MM / 100), 5, 48)));
  }

  const firstStressDay = baseline.findIndex((value) => value < DISPLAY_STRESS_THRESHOLD_PCT);
  const weatherDemandMm = sum(dailyWaterNeedMm.slice(0, 3));
  const rainCreditMm = sum(dailyRainCreditMm.slice(0, 3));
  const threeDayBalanceMm = Math.max(0, weatherDemandMm - rainCreditMm);
  const moistureShortfallMm = Math.max(0, (DISPLAY_STRESS_THRESHOLD_PCT - baseline[Math.min(3, days)]) * ROOT_ZONE_MM / 100);
  // An illustrative model-informed application estimate, not an operational directive.
  const cap = field.irrigationMethod === "drip" ? 12 : 18;
  const modelEstimateMm = Math.max(0, Math.min(cap, round(
    (Math.max(threeDayBalanceMm, moistureShortfallMm) / IRRIGATION_EFFICIENCY)
  )));
  return {
    baseline,
    treated,
    firstStressDay,
    minimumWithoutIrrigation: Math.min(...baseline),
    estimatedNeedMm: modelEstimateMm,
    estimatedVolumeLitres: Math.round(modelEstimateMm * field.areaHa * 10000),
    threeDayDemandMm: round(weatherDemandMm),
    threeDayRainCreditMm: round(rainCreditMm),
    day5LiftPct: round(treated[Math.min(days, 5)] - baseline[Math.min(days, 5)]),
  };
}
