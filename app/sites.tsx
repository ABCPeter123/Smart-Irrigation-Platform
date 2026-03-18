import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SITES } from "../src/data/sites";
import { buildRecommendation } from "../src/services/irrigation";
import { fetchWeatherForSite } from "../src/services/weather";
import { Recommendation, Site, WeatherBundle } from "../src/types";

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

const cropLabel = (crop: Site["cropType"]) => {
  if (crop === "leafy-greens") return "Leafy Greens";
  if (crop === "strawberries") return "Strawberries";
  return "Tomatoes";
};

const riskColor = (urgency: Recommendation["urgency"]) => {
  if (urgency === "High") return palette.high;
  if (urgency === "Medium") return palette.medium;
  return palette.good;
};

function InfoCard({
  label,
  value,
  subvalue,
}: {
  label: string;
  value: string;
  subvalue?: string;
}) {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
      {subvalue ? <Text style={styles.infoSubvalue}>{subvalue}</Text> : null}
    </View>
  );
}

export default function SitesScreen() {
  const [weatherBySite, setWeatherBySite] = useState<Record<string, WeatherBundle>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAllWeather = async () => {
    const entries = await Promise.all(
      SITES.map(async (site) => {
        const weather = await fetchWeatherForSite(site);
        return [site.id, weather] as const;
      })
    );
    setWeatherBySite(Object.fromEntries(entries));
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true);
        await loadAllWeather();
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, []);

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await loadAllWeather();
    } finally {
      setRefreshing(false);
    }
  };

  const siteProfiles = useMemo(() => {
    return SITES.filter((site) => weatherBySite[site.id]).map((site) => {
      const recommendation = buildRecommendation(site, weatherBySite[site.id]);
      return { site, recommendation, weather: weatherBySite[site.id] };
    });
  }, [weatherBySite]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={palette.accent} />
        <Text style={styles.loadingText}>Loading site profiles...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.title}>Sites</Text>
        <Text style={styles.subtitle}>
          Operational site profiles with crop, irrigation, weather, and current action status.
        </Text>

        {siteProfiles.map(({ site, recommendation, weather }) => (
          <View key={site.id} style={styles.card}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{site.name}</Text>
                <Text style={styles.cardSubtitle}>
                  {cropLabel(site.cropType)} · {site.locationLabel}
                </Text>
              </View>

              <View
                style={[
                  styles.pill,
                  {
                    backgroundColor: `${riskColor(recommendation.urgency)}15`,
                    borderColor: `${riskColor(recommendation.urgency)}45`,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    { color: riskColor(recommendation.urgency) },
                  ]}
                >
                  {recommendation.riskBand}
                </Text>
              </View>
            </View>

            <View style={styles.twoCol}>
              <InfoCard label="Environment" value={site.environment} />
              <InfoCard label="Crop" value={cropLabel(site.cropType)} />
            </View>

            <View style={styles.twoCol}>
              <InfoCard label="Area" value={`${site.areaHa} ha`} />
              <InfoCard label="Soil" value={site.soilType} />
            </View>

            <View style={styles.twoCol}>
              <InfoCard label="Irrigation" value={site.irrigationMethod} />
              <InfoCard
                label="Sensors"
                value={
                  site.connectedProbes
                    ? `${site.connectedProbes} connected`
                    : "Optional hardware tier"
                }
              />
            </View>

            <View style={styles.twoCol}>
              <InfoCard
                label="Current weather"
                value={`${weather.current.temperatureC}°C`}
                subvalue={`Humidity ${weather.current.humidityPct}%`}
              />
              <InfoCard
                label="Today"
                value={`${weather.today.maxTempC}° / ${weather.today.minTempC}°`}
                subvalue={`${weather.today.precipitationMm} mm precipitation`}
              />
            </View>

            <View style={styles.actionBox}>
              <Text style={styles.actionLabel}>Current irrigation action</Text>
              <Text style={styles.actionTitle}>{recommendation.actionLabel}</Text>
              <Text style={styles.actionText}>{recommendation.summary}</Text>
            </View>

            <View style={styles.twoCol}>
              <InfoCard label="Urgency" value={recommendation.urgency} />
              <InfoCard label="Model score" value={`${recommendation.modelScore}%`} />
            </View>
          </View>
        ))}
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
    justifyContent: "center",
    alignItems: "center",
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
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: palette.ink,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: palette.muted,
    lineHeight: 20,
    marginBottom: 14,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: palette.ink,
  },
  cardSubtitle: {
    fontSize: 14,
    color: palette.muted,
    marginTop: 4,
  },
  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  twoCol: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  infoCard: {
    width: "48%",
    backgroundColor: "#F8FAFD",
    borderRadius: 14,
    padding: 14,
  },
  infoLabel: {
    fontSize: 12,
    color: palette.muted,
    marginBottom: 6,
    fontWeight: "600",
  },
  infoValue: {
    fontSize: 18,
    fontWeight: "700",
    color: palette.ink,
  },
  infoSubvalue: {
    fontSize: 13,
    color: palette.muted,
    marginTop: 4,
  },
  actionBox: {
    backgroundColor: "#F8FAFD",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  actionLabel: {
    fontSize: 12,
    color: palette.muted,
    marginBottom: 6,
    fontWeight: "600",
  },
  actionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: palette.ink,
    marginBottom: 6,
  },
  actionText: {
    fontSize: 14,
    color: palette.muted,
    lineHeight: 21,
  },
});