export type SoilType = "sandy" | "loam" | "clay";
export type IrrigationMethod = "drip" | "sprinkler" | "manual";
export type EnvironmentType = "greenhouse" | "open-field";

export type Site = {
  id: string;
  name: string;
  locationLabel: string;
  latitude: number;
  longitude: number;
  cropType: "tomatoes" | "leafy-greens" | "strawberries";
  environment: EnvironmentType;
  areaHa: number;
  irrigationMethod: IrrigationMethod;
  soilType: SoilType;
  sensorMoisturePct?: number;
  connectedProbes?: number;
};

export type WeatherBundle = {
  timezone: string;
  current: {
    time: string;
    temperatureC: number;
    apparentTemperatureC: number;
    humidityPct: number;
    windSpeedKmh: number;
    precipitationMm: number;
  };
  today: {
    maxTempC: number;
    minTempC: number;
    precipitationMm: number;
    sunrise: string;
    sunset: string;
  };
  next24h: {
    times: string[];
    temperatureC: number[];
    humidityPct: number[];
    precipitationMm: number[];
    precipitationProbabilityPct: number[];
    evapotranspirationMm: number[];
  };
};

export type Recommendation = {
  siteId: string;
  headline: string;
  actionLabel: string;
  startBy: string;
  urgency: "Low" | "Medium" | "High";
  riskBand: "Stable" | "Watch" | "Priority";
  recommendedMm: number;
  recommendedLitres: number;
  modelScore: number;
  summary: string;
  reasons: string[];
};