const API_BASE_URL = "http://10.0.0.184:4000";

export type BackendRecommendationResponse = {
  site: {
    id: string;
    name: string;
    locationLabel: string;
    cropType: string;
    environment: string;
    irrigationMethod: string;
    soilType: string;
    areaHa: number;
  };
  recommendation: {
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
  weather: {
    source: "open-meteo";
    fetchedAt: string;
    cache?: {
      status: "hit" | "miss";
      expiresAt: string;
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
  };
  recentIrrigationLogs: Array<{
    id: string;
    siteId: string;
    appliedMm: number;
    appliedLitres: number;
    performedAt: string;
    notes?: string | null;
  }>;
};

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchBackendRecommendation(siteId: string) {
  return request<BackendRecommendationResponse>(
    `/api/recommendations/site/${siteId}`
  );
}
export type BackendSite = {
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
  connectedProbes: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateBackendSitePayload = {
  name: string;
  locationLabel: string;
  latitude: number;
  longitude: number;
  areaHa: number;
  cropType: string;
  environment: string;
  irrigationMethod: string;
  soilType: string;
  connectedProbes?: number;
};

export async function fetchBackendSites() {
  return request<BackendSite[]>("/api/sites");
}

export async function createBackendSite(payload: CreateBackendSitePayload) {
  const response = await fetch(`${API_BASE_URL}/api/sites`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      connectedProbes: 0,
      ...payload,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Create site failed: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<BackendSite>;
}

export async function deleteBackendSite(siteId: string) {
  const response = await fetch(`${API_BASE_URL}/api/sites/${siteId}`, {
    method: "DELETE",
  });

  if (!response.ok && response.status !== 204) {
    const errorText = await response.text();
    throw new Error(`Delete site failed: ${response.status} ${errorText}`);
  }
}

export type BackendIrrigationLog = {
  id: string;
  siteId: string;
  appliedMm: number;
  appliedLitres: number;
  performedAt: string;
  notes?: string | null;
};

export type CreateIrrigationLogPayload = {
  siteId: string;
  appliedMm: number;
  appliedLitres: number;
  performedAt?: string;
  notes?: string;
};

export async function createIrrigationLog(payload: CreateIrrigationLogPayload) {
  const response = await fetch(`${API_BASE_URL}/api/irrigation-logs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Create irrigation log failed: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<BackendIrrigationLog>;
}

export async function fetchIrrigationLogs(siteId: string) {
  return request<BackendIrrigationLog[]>(
    `/api/irrigation-logs?siteId=${encodeURIComponent(siteId)}`
  );
}

export async function updateBackendSite(
  siteId: string,
  payload: Partial<CreateBackendSitePayload>
) {
  const response = await fetch(`${API_BASE_URL}/api/sites/${siteId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Update site failed: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<BackendSite>;
}

export type BackendWeatherBundle = {
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
  cache?: {
    status: "hit" | "miss";
    expiresAt: string;
  };
};

export async function fetchBackendWeather(siteId: string) {
  return request<BackendWeatherBundle>(
    `/api/weather/site/${encodeURIComponent(siteId)}`
  );
}