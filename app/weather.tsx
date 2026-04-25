import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSiteContext } from "../src/context/SiteContext";
import {
    BackendWeatherBundle,
    fetchBackendWeather,
} from "../src/services/api";

const palette = {
  bg: "#F3F6FB",
  card: "#FFFFFF",
  ink: "#0B1830",
  muted: "#5A6B85",
  border: "#D9E1EE",
  accent: "#1F7AE0",
  good: "#1D8F5A",
  medium: "#D18B16",
  high: "#C43D3D",
};

function formatValue(value: number | null, suffix: string) {
  if (value === null || value === undefined) {
    return "N/A";
  }

  return `${value}${suffix}`;
}

function formatDecimal(value: number | null, suffix: string, decimals = 1) {
  if (value === null || value === undefined) {
    return "N/A";
  }

  return `${value.toFixed(decimals)}${suffix}`;
}

function formatHour(time: string) {
  const date = new Date(time);

  if (Number.isNaN(date.getTime())) {
    return time.slice(11, 16);
  }

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getRainRisk(probability: number | null) {
  if (probability === null || probability === undefined) {
    return {
      label: "Unknown",
      color: palette.muted,
    };
  }

  if (probability >= 70) {
    return {
      label: "High rain chance",
      color: palette.high,
    };
  }

  if (probability >= 35) {
    return {
      label: "Moderate rain chance",
      color: palette.medium,
    };
  }

  return {
    label: "Low rain chance",
    color: palette.good,
  };
}

function getMaxValue(values: Array<number | null>) {
  const numericValues = values.filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value)
  );

  if (numericValues.length === 0) {
    return 1;
  }

  return Math.max(...numericValues, 1);
}

function MetricCard({
  label,
  value,
  subvalue,
}: {
  label: string;
  value: string;
  subvalue?: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {subvalue ? <Text style={styles.metricSubvalue}>{subvalue}</Text> : null}
    </View>
  );
}

function MiniBarChart({
  title,
  data,
  valueSuffix,
}: {
  title: string;
  data: Array<{
    label: string;
    value: number | null;
  }>;
  valueSuffix: string;
}) {
  const maxValue = getMaxValue(data.map((item) => item.value));

  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>{title}</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chartRow}>
          {data.map((item, index) => {
            const value = item.value ?? 0;
            const barHeight = Math.max(6, (value / maxValue) * 90);

            return (
              <View key={`${item.label}-${index}`} style={styles.chartColumn}>
                <View style={styles.chartBarTrack}>
                  <View style={[styles.chartBar, { height: barHeight }]} />
                </View>

                <Text style={styles.chartValue}>
                  {value.toFixed(valueSuffix === "%" ? 0 : 1)}
                  {valueSuffix}
                </Text>

                <Text style={styles.chartLabel}>{item.label}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function HourlyRow({
  item,
}: {
  item: BackendWeatherBundle["hourly24h"][number];
}) {
  return (
    <View style={styles.hourlyRow}>
      <Text style={styles.hourText}>{formatHour(item.time)}</Text>

      <View style={styles.hourMetric}>
        <Text style={styles.hourValue}>
          {formatDecimal(item.temperatureC, "°C")}
        </Text>
        <Text style={styles.hourLabel}>Temp</Text>
      </View>

      <View style={styles.hourMetric}>
        <Text style={styles.hourValue}>{formatDecimal(item.et0Mm, " mm")}</Text>
        <Text style={styles.hourLabel}>ET0</Text>
      </View>

      <View style={styles.hourMetric}>
        <Text style={styles.hourValue}>
          {formatDecimal(item.precipitationMm, " mm")}
        </Text>
        <Text style={styles.hourLabel}>Rain</Text>
      </View>

      <View style={styles.hourMetric}>
        <Text style={styles.hourValue}>
          {formatValue(item.precipitationProbabilityPct, "%")}
        </Text>
        <Text style={styles.hourLabel}>Chance</Text>
      </View>
    </View>
  );
}

export default function WeatherScreen() {
  const { selectedSiteId, selectedSite, loadingSites, sitesError } =
    useSiteContext();

  const [weather, setWeather] = useState<BackendWeatherBundle | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const loadWeather = useCallback(async () => {
    if (loadingSites) {
      return;
    }

    if (!selectedSiteId) {
      setWeather(null);
      setWeatherError("No site selected. Add or select a site first.");
      setLoadingWeather(false);
      setRefreshing(false);
      return;
    }

    try {
      setWeatherError(null);

      const result = await fetchBackendWeather(selectedSiteId);
      setWeather(result);
    } catch (error) {
      setWeather(null);
      setWeatherError(
        error instanceof Error ? error.message : "Unable to load weather."
      );
    } finally {
      setLoadingWeather(false);
      setRefreshing(false);
    }
  }, [selectedSiteId, loadingSites]);

  useEffect(() => {
    loadWeather();
  }, [loadWeather]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadWeather();
  }, [loadWeather]);

  const rainRisk = useMemo(() => {
    return getRainRisk(weather?.daily.precipitationProbabilityMaxPct ?? null);
  }, [weather]);

  const totalNext24hEt0 = useMemo(() => {
    if (!weather) {
      return 0;
    }

    return weather.hourly24h.reduce((sum, item) => {
      return sum + (item.et0Mm ?? 0);
    }, 0);
  }, [weather]);

  const totalNext24hRain = useMemo(() => {
    if (!weather) {
      return 0;
    }

    return weather.hourly24h.reduce((sum, item) => {
      return sum + (item.precipitationMm ?? 0);
    }, 0);
  }, [weather]);

  if (loadingSites || loadingWeather) {
    return (
      <SafeAreaView style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={palette.accent} />
        <Text style={styles.loadingText}>Loading backend weather...</Text>
      </SafeAreaView>
    );
  }

  if (sitesError || weatherError) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Could not load weather</Text>
            <Text style={styles.errorText}>{sitesError ?? weatherError}</Text>
            <Text style={styles.helperText}>
              Check that your backend is running, the selected site exists in
              PostgreSQL, and your API IP address is reachable from this device.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!weather || !selectedSite) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No weather data</Text>
            <Text style={styles.helperText}>
              Add or select a backend site to load weather inputs.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Weather Inputs</Text>
          <Text style={styles.heroTitle}>{selectedSite.name}</Text>
          <Text style={styles.heroSubtitle}>
            {selectedSite.locationLabel} · Local site weather
          </Text>

          <View style={styles.heroMetricRow}>
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricValue}>
                {formatDecimal(weather.current.temperatureC, "°C")}
              </Text>
              <Text style={styles.heroMetricLabel}>Current temp</Text>
            </View>

            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricValue}>
                {formatDecimal(weather.current.windSpeedKmh, " km/h")}
              </Text>
              <Text style={styles.heroMetricLabel}>Wind</Text>
            </View>
          </View>
        </View>

        <View style={styles.statusCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.statusLabel}>Rain outlook</Text>
            <Text style={[styles.statusTitle, { color: rainRisk.color }]}>
              {rainRisk.label}
            </Text>
            <Text style={styles.statusText}>
              Max precipitation probability today:{" "}
              {formatValue(weather.daily.precipitationProbabilityMaxPct, "%")}
            </Text>
          </View>
        </View>

        <View style={styles.metricsGrid}>
          <MetricCard
            label="Daily ET0"
            value={formatDecimal(weather.daily.et0Mm, " mm")}
            subvalue="FAO reference evapotranspiration"
          />
          <MetricCard
            label="Forecast rain"
            value={formatDecimal(weather.daily.precipitationSumMm, " mm")}
            subvalue="Daily precipitation sum"
          />
          <MetricCard
            label="High / low"
            value={`${formatDecimal(
              weather.daily.temperatureMaxC,
              "°"
            )} / ${formatDecimal(weather.daily.temperatureMinC, "°")}`}
            subvalue={weather.daily.date ?? "Today"}
          />
          <MetricCard
            label="Humidity"
            value={formatValue(weather.current.relativeHumidityPct, "%")}
            subvalue="Current relative humidity"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Hourly Trends</Text>
          <Text style={styles.helperText}>
            Visual view of short-term temperature, ET0, and precipitation risk.
          </Text>

          <MiniBarChart
            title="Temperature"
            valueSuffix="°"
            data={weather.hourly24h.slice(0, 12).map((item) => ({
              label: formatHour(item.time),
              value: item.temperatureC,
            }))}
          />

          <MiniBarChart
            title="ET0"
            valueSuffix=" mm"
            data={weather.hourly24h.slice(0, 12).map((item) => ({
              label: formatHour(item.time),
              value: item.et0Mm,
            }))}
          />

          <MiniBarChart
            title="Precipitation Probability"
            valueSuffix="%"
            data={weather.hourly24h.slice(0, 12).map((item) => ({
              label: formatHour(item.time),
              value: item.precipitationProbabilityPct,
            }))}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Next 24 hours</Text>
          <Text style={styles.helperText}>
            Hourly temperature, ET0, rainfall, and precipitation probability
            from the backend weather bundle.
          </Text>

          <View style={styles.twoCol}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryValue}>
                {totalNext24hEt0.toFixed(2)} mm
              </Text>
              <Text style={styles.summaryLabel}>24h ET0</Text>
            </View>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryValue}>
                {totalNext24hRain.toFixed(2)} mm
              </Text>
              <Text style={styles.summaryLabel}>24h rain</Text>
            </View>
          </View>

          {weather.hourly24h.map((item) => (
            <HourlyRow key={item.time} item={item} />
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Data source</Text>

          <View style={styles.inputLine}>
            <Text style={styles.inputLabel}>Source</Text>
            <Text style={styles.inputValue}>{weather.source}</Text>
          </View>

          <View style={styles.inputLine}>
            <Text style={styles.inputLabel}>Cache status</Text>
            <Text style={styles.inputValue}>
              {weather.cache?.status ?? "not shown"}
            </Text>
          </View>

          <View style={styles.inputLine}>
            <Text style={styles.inputLabel}>Fetched at</Text>
            <Text style={styles.inputValue}>
              {new Date(weather.fetchedAt).toLocaleString()}
            </Text>
          </View>

          <View style={styles.inputLine}>
            <Text style={styles.inputLabel}>Coordinates</Text>
            <Text style={styles.inputValue}>
              {weather.location.latitude.toFixed(4)},{" "}
              {weather.location.longitude.toFixed(4)}
            </Text>
          </View>

          <View style={styles.inputLine}>
            <Text style={styles.inputLabel}>Timezone</Text>
            <Text style={styles.inputValue}>{weather.location.timezone}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  loadingWrap: {
    flex: 1,
    backgroundColor: palette.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 15,
    color: palette.muted,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  heroCard: {
    backgroundColor: "#0A1836",
    borderRadius: 26,
    padding: 22,
    marginBottom: 16,
  },
  heroEyebrow: {
    color: "#9CC8FF",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
    marginBottom: 6,
  },
  heroSubtitle: {
    color: "#D5E4F7",
    fontSize: 15,
    lineHeight: 22,
  },
  heroMetricRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
  },
  heroMetric: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  heroMetricValue: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
  },
  heroMetricLabel: {
    color: "#D5E4F7",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "700",
  },
  statusCard: {
    backgroundColor: palette.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: palette.muted,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  statusTitle: {
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 4,
  },
  statusText: {
    fontSize: 14,
    color: palette.muted,
    lineHeight: 20,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  metricCard: {
    width: "48%",
    backgroundColor: palette.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: palette.border,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: palette.muted,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: "900",
    color: palette.ink,
  },
  metricSubvalue: {
    fontSize: 12,
    color: palette.muted,
    marginTop: 4,
    lineHeight: 17,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: palette.ink,
  },
  helperText: {
    fontSize: 14,
    color: palette.muted,
    lineHeight: 21,
    marginTop: 6,
    marginBottom: 14,
  },
  twoCol: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  summaryBox: {
    width: "48%",
    backgroundColor: "#F8FAFD",
    borderRadius: 14,
    padding: 14,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "900",
    color: palette.ink,
  },
  summaryLabel: {
    fontSize: 12,
    color: palette.muted,
    marginTop: 4,
    fontWeight: "700",
  },
  chartCard: {
    backgroundColor: "#F8FAFD",
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#E8EEF7",
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: palette.ink,
    marginBottom: 12,
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingRight: 4,
  },
  chartColumn: {
    width: 46,
    alignItems: "center",
  },
  chartBarTrack: {
    height: 96,
    width: 18,
    backgroundColor: "#E2E8F0",
    borderRadius: 999,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  chartBar: {
    width: "100%",
    backgroundColor: palette.accent,
    borderRadius: 999,
  },
  chartValue: {
    fontSize: 11,
    fontWeight: "800",
    color: palette.ink,
    marginTop: 6,
  },
  chartLabel: {
    fontSize: 10,
    color: palette.muted,
    marginTop: 3,
  },
  hourlyRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFD",
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E8EEF7",
  },
  hourText: {
    width: 62,
    fontSize: 13,
    fontWeight: "800",
    color: palette.ink,
  },
  hourMetric: {
    flex: 1,
    alignItems: "flex-end",
  },
  hourValue: {
    fontSize: 13,
    fontWeight: "800",
    color: palette.ink,
  },
  hourLabel: {
    fontSize: 11,
    color: palette.muted,
    marginTop: 2,
  },
  inputLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 10,
    marginBottom: 10,
  },
  inputLabel: {
    flex: 1,
    fontSize: 14,
    color: palette.muted,
    fontWeight: "700",
  },
  inputValue: {
    flex: 1,
    fontSize: 14,
    color: palette.ink,
    fontWeight: "800",
    textAlign: "right",
  },
  errorCard: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#991B1B",
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: "#991B1B",
    lineHeight: 20,
  },
});