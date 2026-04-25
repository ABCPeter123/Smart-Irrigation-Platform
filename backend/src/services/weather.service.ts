import { prisma } from "../lib/prisma";

type OpenMeteoResponse = {
  timezone: string;
  current?: {
    time?: string;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    precipitation?: number;
    wind_speed_10m?: number;
  };
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_sum?: number[];
    precipitation_probability_max?: number[];
    et0_fao_evapotranspiration?: number[];
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    relative_humidity_2m?: number[];
    precipitation?: number[];
    precipitation_probability?: number[];
    et0_fao_evapotranspiration?: number[];
    wind_speed_10m?: number[];
  };
};

export type NormalizedWeatherBundle = {
  siteId: string;
  location: {
    latitude: number;
    longitude: number;
    timezone: string;
  };
  current: {
    time: string | null;
    temperatureC: number | null;
    relativeHumidityPct: number | null;
    precipitationMm: number | null;
    windSpeedKmh: number | null;
  };
  daily: {
    date: string | null;
    temperatureMaxC: number | null;
    temperatureMinC: number | null;
    precipitationSumMm: number | null;
    precipitationProbabilityMaxPct: number | null;
    et0Mm: number | null;
  };
  hourly24h: Array<{
    time: string;
    temperatureC: number | null;
    relativeHumidityPct: number | null;
    precipitationMm: number | null;
    precipitationProbabilityPct: number | null;
    et0Mm: number | null;
    windSpeedKmh: number | null;
  }>;
  source: "open-meteo";
  fetchedAt: string;
  cache: {
    status: "hit" | "miss";
    expiresAt: string;
  };
};

function valueAt<T>(arr: T[] | undefined, index: number): T | null {
  if (!arr || index < 0 || index >= arr.length) return null;
  return arr[index] ?? null;
}

function addMinutes(date: Date, minutes: number): Date {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() + minutes);
  return copy;
}

function buildOpenMeteoUrl(latitude: number, longitude: number): string {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    timezone: "auto",
    forecast_days: "3",
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "precipitation",
      "wind_speed_10m",
    ].join(","),
    hourly: [
      "temperature_2m",
      "relative_humidity_2m",
      "precipitation",
      "precipitation_probability",
      "et0_fao_evapotranspiration",
      "wind_speed_10m",
    ].join(","),
    daily: [
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "precipitation_probability_max",
      "et0_fao_evapotranspiration",
    ].join(","),
  });

  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

function normalizeOpenMeteoWeather(input: {
  siteId: string;
  latitude: number;
  longitude: number;
  data: OpenMeteoResponse;
  fetchedAt: Date;
  expiresAt: Date;
  cacheStatus: "hit" | "miss";
}): NormalizedWeatherBundle {
  const hourlyTimes = input.data.hourly?.time ?? [];

  const hourly24h = hourlyTimes.slice(0, 24).map((time, index) => ({
    time,
    temperatureC: valueAt(input.data.hourly?.temperature_2m, index),
    relativeHumidityPct: valueAt(input.data.hourly?.relative_humidity_2m, index),
    precipitationMm: valueAt(input.data.hourly?.precipitation, index),
    precipitationProbabilityPct: valueAt(
      input.data.hourly?.precipitation_probability,
      index
    ),
    et0Mm: valueAt(input.data.hourly?.et0_fao_evapotranspiration, index),
    windSpeedKmh: valueAt(input.data.hourly?.wind_speed_10m, index),
  }));

  return {
    siteId: input.siteId,
    location: {
      latitude: input.latitude,
      longitude: input.longitude,
      timezone: input.data.timezone,
    },
    current: {
      time: input.data.current?.time ?? null,
      temperatureC: input.data.current?.temperature_2m ?? null,
      relativeHumidityPct: input.data.current?.relative_humidity_2m ?? null,
      precipitationMm: input.data.current?.precipitation ?? null,
      windSpeedKmh: input.data.current?.wind_speed_10m ?? null,
    },
    daily: {
      date: valueAt(input.data.daily?.time, 0),
      temperatureMaxC: valueAt(input.data.daily?.temperature_2m_max, 0),
      temperatureMinC: valueAt(input.data.daily?.temperature_2m_min, 0),
      precipitationSumMm: valueAt(input.data.daily?.precipitation_sum, 0),
      precipitationProbabilityMaxPct: valueAt(
        input.data.daily?.precipitation_probability_max,
        0
      ),
      et0Mm: valueAt(input.data.daily?.et0_fao_evapotranspiration, 0),
    },
    hourly24h,
    source: "open-meteo",
    fetchedAt: input.fetchedAt.toISOString(),
    cache: {
      status: input.cacheStatus,
      expiresAt: input.expiresAt.toISOString(),
    },
  };
}

async function fetchOpenMeteoRawWeather(input: {
  latitude: number;
  longitude: number;
}): Promise<OpenMeteoResponse> {
  const url = buildOpenMeteoUrl(input.latitude, input.longitude);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Open-Meteo request failed with status ${response.status}`);
  }

  return (await response.json()) as OpenMeteoResponse;
}

export async function fetchWeatherForSite(input: {
  siteId: string;
  latitude: number;
  longitude: number;
}): Promise<NormalizedWeatherBundle> {
  const now = new Date();
  const cacheMinutes = 30;

  const cached = await prisma.weatherCache.findUnique({
    where: {
      siteId: input.siteId,
    },
  });

  if (cached && cached.expiresAt > now) {
    const rawWeather = JSON.parse(cached.responseJson) as OpenMeteoResponse;

    return normalizeOpenMeteoWeather({
      siteId: input.siteId,
      latitude: input.latitude,
      longitude: input.longitude,
      data: rawWeather,
      fetchedAt: cached.fetchedAt,
      expiresAt: cached.expiresAt,
      cacheStatus: "hit",
    });
  }

  const rawWeather = await fetchOpenMeteoRawWeather({
    latitude: input.latitude,
    longitude: input.longitude,
  });

  const fetchedAt = new Date();
  const expiresAt = addMinutes(fetchedAt, cacheMinutes);

  await prisma.weatherCache.upsert({
    where: {
      siteId: input.siteId,
    },
    create: {
      siteId: input.siteId,
      responseJson: JSON.stringify(rawWeather),
      fetchedAt,
      expiresAt,
    },
    update: {
      responseJson: JSON.stringify(rawWeather),
      fetchedAt,
      expiresAt,
    },
  });

  return normalizeOpenMeteoWeather({
    siteId: input.siteId,
    latitude: input.latitude,
    longitude: input.longitude,
    data: rawWeather,
    fetchedAt,
    expiresAt,
    cacheStatus: "miss",
  });
}