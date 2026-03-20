import { Site, WeatherBundle } from "../types";

const round = (value: number, digits = 1) => {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
};

const toIndex = (times: string[], currentTime: string) => {
  const exact = times.indexOf(currentTime);
  if (exact >= 0) return exact;

  const current = new Date(currentTime).getTime();
  let bestIndex = 0;
  let bestDelta = Number.MAX_SAFE_INTEGER;

  times.forEach((time, index) => {
    const delta = Math.abs(new Date(time).getTime() - current);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIndex = index;
    }
  });

  return bestIndex;
};

export async function fetchWeatherForSite(site: Site): Promise<WeatherBundle> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${site.latitude}` +
    `&longitude=${site.longitude}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m` +
    `&hourly=temperature_2m,relative_humidity_2m,precipitation,precipitation_probability,evapotranspiration` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,sunrise,sunset` +
    `&forecast_days=3` +
    `&timezone=auto`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather fetch failed for ${site.name}`);
  }

  const data = await response.json();

  const hourlyTimes: string[] = data.hourly.time;
  const startIndex = toIndex(hourlyTimes, data.current.time);
  const endIndex = Math.min(startIndex + 24, hourlyTimes.length);

  return {
    timezone: data.timezone,
    current: {
      time: data.current.time,
      temperatureC: round(data.current.temperature_2m),
      apparentTemperatureC: round(data.current.apparent_temperature),
      humidityPct: round(data.current.relative_humidity_2m, 0),
      windSpeedKmh: round(data.current.wind_speed_10m),
      precipitationMm: round(data.current.precipitation),
    },
    today: {
      maxTempC: round(data.daily.temperature_2m_max[0]),
      minTempC: round(data.daily.temperature_2m_min[0]),
      precipitationMm: round(data.daily.precipitation_sum[0]),
      sunrise: data.daily.sunrise[0],
      sunset: data.daily.sunset[0],
    },
    next24h: {
      times: hourlyTimes.slice(startIndex, endIndex),
      temperatureC: data.hourly.temperature_2m.slice(startIndex, endIndex).map((v: number) => round(v)),
      humidityPct: data.hourly.relative_humidity_2m.slice(startIndex, endIndex).map((v: number) => round(v, 0)),
      precipitationMm: data.hourly.precipitation.slice(startIndex, endIndex).map((v: number) => round(v)),
      precipitationProbabilityPct: data.hourly.precipitation_probability
        .slice(startIndex, endIndex)
        .map((v: number) => round(v, 0)),
      evapotranspirationMm: data.hourly.evapotranspiration
        .slice(startIndex, endIndex)
        .map((v: number) => round(v, 2)),
    },
  };
}