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
import { useSiteContext } from "../src/context/SiteContext";
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

function DataCard({
  label,
  value,
  subvalue,
}: {
  label: string;
  value: string;
  subvalue?: string;
}) {
  return (
    <View style={styles.dataCard}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={styles.dataValue}>{value}</Text>
      {subvalue ? <Text style={styles.dataSubvalue}>{subvalue}</Text> : null}
    </View>
  );
}

export default function RecommendationsScreen() {
  const [weatherBySite, setWeatherBySite] = useState<Record<string, WeatherBundle>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { sites } = useSiteContext();

  const loadAllWeather = async () => {
    const entries = await Promise.all(
      sites.map(async (site) => {
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
  }, [sites]);

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await loadAllWeather();
    } finally {
      setRefreshing(false);
    }
  };

  const recommendations = useMemo(() => {
    return sites
      .filter((site) => weatherBySite[site.id])
      .map((site) => {
        const recommendation = buildRecommendation(site, weatherBySite[site.id]);
        return { site, recommendation };
      });
  }, [sites, weatherBySite]);

  const sortedRecommendations = useMemo(() => {
    const rank = { High: 3, Medium: 2, Low: 1 } as const;
    return [...recommendations].sort(
      (a, b) => rank[b.recommendation.urgency] - rank[a.recommendation.urgency]
    );
  }, [recommendations]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={palette.accent} />
        <Text style={styles.loadingText}>Loading irrigation recommendations...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.title}>Recommendations</Text>
        <Text style={styles.subtitle}>
          Site-level irrigation actions generated from live weather, ET, crop profile,
          soil profile, and optional sensor calibration.
        </Text>

        {sortedRecommendations.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No recommendations available</Text>
            <Text style={styles.cardSubtitle}>
              Add or select a site to generate irrigation guidance.
            </Text>
          </View>
        ) : null}

        {sortedRecommendations.map(({ site, recommendation }) => (
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
                  {recommendation.urgency}
                </Text>
              </View>
            </View>

            <View style={styles.actionBox}>
              <Text style={styles.actionLabel}>Recommended action</Text>
              <Text style={styles.actionTitle}>{recommendation.actionLabel}</Text>
              <Text style={styles.actionText}>{recommendation.summary}</Text>
            </View>

            <View style={styles.twoCol}>
              <DataCard label="Start window" value={recommendation.startBy} />
              <DataCard
                label="Delivery volume"
                value={`${recommendation.recommendedLitres.toLocaleString()} L`}
              />
            </View>

            <View style={styles.twoCol}>
              <DataCard label="Risk band" value={recommendation.riskBand} />
              <DataCard label="Model score" value={`${recommendation.modelScore}%`} />
            </View>

            <Text style={styles.reasonHeader}>Decision drivers</Text>
            {recommendation.reasons.map((reason, index) => (
              <View key={index} style={styles.reasonRow}>
                <Text style={styles.reasonBullet}>•</Text>
                <Text style={styles.reasonText}>{reason}</Text>
              </View>
            ))}
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
  twoCol: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  dataCard: {
    width: "48%",
    backgroundColor: "#F8FAFD",
    borderRadius: 14,
    padding: 14,
  },
  dataLabel: {
    fontSize: 12,
    color: palette.muted,
    marginBottom: 6,
    fontWeight: "600",
  },
  dataValue: {
    fontSize: 18,
    fontWeight: "700",
    color: palette.ink,
  },
  dataSubvalue: {
    fontSize: 13,
    color: palette.muted,
    marginTop: 4,
  },
  reasonHeader: {
    fontSize: 16,
    fontWeight: "700",
    color: palette.ink,
    marginTop: 4,
    marginBottom: 8,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  reasonBullet: {
    fontSize: 18,
    color: palette.accent,
    marginRight: 8,
    lineHeight: 20,
  },
  reasonText: {
    flex: 1,
    fontSize: 14,
    color: palette.muted,
    lineHeight: 20,
  },
});