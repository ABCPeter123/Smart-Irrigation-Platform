/**
 * Browser-only Open-Meteo client for the public portfolio demonstration.
 * This returns forecast weather, not soil sensor readings.
 * https://open-meteo.com/en/docs
 */
export type ForecastDay = {
  date: string;
  highC: number;
  lowC: number;
  precipitationMm: number;
  rainChancePct: number;
  et0Mm: number;
  weatherCode: number;
};

export type PublicWeather = {
  daily: ForecastDay[];
  currentTemperatureC: number | null;
  currentWindKmh: number | null;
  updatedAt: string;
  timezone: string;
};

type OpenMeteoData = {
  timezone?: string;
  current?: {
    temperature_2m?: unknown;
    wind_speed_10m?: unknown;
  };
  daily?: {
    time?: unknown;
    temperature_2m_max?: unknown;
    temperature_2m_min?: unknown;
    precipitation_sum?: unknown;
    precipitation_probability_max?: unknown;
    et0_fao_evapotranspiration?: unknown;
    weather_code?: unknown;
  };
  error?: boolean;
  reason?: string;
};

function numericValue(array: unknown, index: number, name: string): number {
  const item = Array.isArray(array) ? array[index] : undefined;
  if (typeof item !== "number" || !Number.isFinite(item)) {
    throw new Error("Forecast is missing " + name + " for day " + (index + 1) + ".");
  }
  return item;
}

function optionalNumeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function fetchPublicWeather(
  latitude: number,
  longitude: number,
  signal?: AbortSignal
): Promise<PublicWeather> {
  const query = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    timezone: "auto",
    forecast_days: "14",
    current: "temperature_2m,wind_speed_10m",
    daily: [
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "precipitation_probability_max",
      "et0_fao_evapotranspiration",
      "weather_code",
    ].join(","),
  });

  const response = await fetch("https://api.open-meteo.com/v1/forecast?" + query.toString(), {
    signal,
  });

  if (!response.ok) {
    throw new Error("Weather service returned HTTP " + response.status + ".");
  }

  const body = (await response.json()) as OpenMeteoData;
  if (body.error) {
    throw new Error(body.reason || "Weather service rejected the request.");
  }

  const daily = body.daily;
  const dates = daily?.time;
  if (!Array.isArray(dates) || dates.length < 7) {
    throw new Error("Weather service returned fewer than seven forecast days.");
  }

  const mapped = dates.slice(0, 14).map((date: unknown, index: number) => {
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error("Weather service returned an invalid forecast date.");
    }
    return {
      date,
      highC: numericValue(daily?.temperature_2m_max, index, "high temperature"),
      lowC: numericValue(daily?.temperature_2m_min, index, "low temperature"),
      precipitationMm: Math.max(0, numericValue(daily?.precipitation_sum, index, "precipitation")),
      rainChancePct: Math.max(0, Math.min(100, numericValue(daily?.precipitation_probability_max, index, "rain probability"))),
      et0Mm: Math.max(0, numericValue(daily?.et0_fao_evapotranspiration, index, "reference evapotranspiration")),
      weatherCode: numericValue(daily?.weather_code, index, "weather code"),
    };
  });

  return {
    daily: mapped,
    currentTemperatureC: optionalNumeric(body.current?.temperature_2m),
    currentWindKmh: optionalNumeric(body.current?.wind_speed_10m),
    updatedAt: new Date().toISOString(),
    timezone: body.timezone || "local",
  };
}

/** Explicit sample values used only when live weather is unavailable. */
export function sampleWeather(): PublicWeather {
  const today = new Date();
  const daily: ForecastDay[] = Array.from({ length: 14 }, (_, i) => {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + i))
      .toISOString().slice(0, 10);
    return {
      date,
      highC: [18, 19, 20, 21, 18, 17, 16][i % 7],
      lowC: [8, 9, 10, 11, 7, 6, 5][i % 7],
      precipitationMm: [0, 1.2, 0, 3.4, 1.5, 0, 5.1][i % 7],
      rainChancePct: [10, 25, 10, 55, 40, 10, 70][i % 7],
      et0Mm: [1.8, 2.3, 2.1, 2.6, 2.2, 1.8, 1.4][i % 7],
      weatherCode: [1, 2, 0, 61, 3, 1, 63][i % 7],
    };
  });
  return { daily, currentTemperatureC: null, currentWindKmh: null, updatedAt: "", timezone: "sample" };
}

export function weatherEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code >= 1 && code <= 3) return "⛅";
  if (code === 45 || code === 48) return "🌫️";
  if (code >= 51 && code <= 67) return "🌧️";
  if (code >= 71 && code <= 86) return "🌨️";
  if (code >= 95) return "⛈️";
  return "☁️";
}
