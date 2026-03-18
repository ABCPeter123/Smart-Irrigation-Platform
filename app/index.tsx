import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
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
  hero: "#0A1836",
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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function MiniDataCard({
  label,
  value,
  subvalue,
}: {
  label: string;
  value: string;
  subvalue?: string;
}) {
  return (
    <View style={styles.miniCard}>
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={styles.miniValue}>{value}</Text>
      {subvalue ? <Text style={styles.miniSubvalue}>{subvalue}</Text> : null}
    </View>
  );
}

function SectionTitle({
  title,
  subtitle,
  rightPill,
  rightPillColor,
}: {
  title: string;
  subtitle?: string;
  rightPill?: string;
  rightPillColor?: string;
}) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {rightPill ? (
        <View
          style={[
            styles.pill,
            {
              backgroundColor: `${rightPillColor ?? palette.accent}15`,
              borderColor: `${rightPillColor ?? palette.accent}45`,
            },
          ]}
        >
          <Text style={[styles.pillText, { color: rightPillColor ?? palette.accent }]}>
            {rightPill}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default function DashboardScreen() {
  const { sites, selectedSiteId, selectedSite, setSelectedSiteId } = useSiteContext();
  const [weatherBySite, setWeatherBySite] = useState<Record<string, WeatherBundle>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAllWeather = async () => {
    const entries = await Promise.all(
      sites.map(async (site) => {
        const weather = await fetchWeatherForSite(site);
        return [site.id, weather] as const;
      })
    );

    setWeatherBySite(Object.fromEntries(entries));
  };

  const initialize = async () => {
    try {
      setLoading(true);
      await loadAllWeather();
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await loadAllWeather();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    initialize();
  }, [sites]);

  const recommendations = useMemo(() => {
    return sites
      .filter((site) => weatherBySite[site.id])
      .map((site) => buildRecommendation(site, weatherBySite[site.id]));
  }, [sites, weatherBySite]);

  const selectedWeather = weatherBySite[selectedSite.id];
  const selectedRecommendation =
    recommendations.find((rec) => rec.siteId === selectedSite.id) ?? null;

  const topRecommendation = useMemo(() => {
    const rank = { High: 3, Medium: 2, Low: 1 } as const;
    return [...recommendations].sort((a, b) => rank[b.urgency] - rank[a.urgency])[0];
  }, [recommendations]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={palette.accent} />
        <Text style={styles.loadingText}>Loading irrigation intelligence...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Northern Irrigation</Text>
          <Text style={styles.heroTitle}>Operational Dashboard</Text>
          <Text style={styles.heroSubtitle}>
            Live weather, evapotranspiration-driven irrigation guidance, and site-level
            action planning.
          </Text>

          {topRecommendation ? (
            <View style={styles.heroInnerCard}>
              <Text style={styles.heroInnerLabel}>Top action today</Text>
              <Text style={styles.heroInnerTitle}>{topRecommendation.headline}</Text>
              <Text style={styles.heroInnerText}>
                {topRecommendation.actionLabel} {topRecommendation.startBy}
              </Text>
              <Text style={styles.heroInnerText}>
                Model score: {topRecommendation.modelScore}%
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.siteSwitchRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {sites.map((site) => (
              <TouchableOpacity
                key={site.id}
                style={[
                  styles.siteChip,
                  selectedSiteId === site.id && styles.siteChipActive,
                ]}
                onPress={() => setSelectedSiteId(site.id)}
              >
                <Text
                  style={[
                    styles.siteChipText,
                    selectedSiteId === site.id && styles.siteChipTextActive,
                  ]}
                >
                  {site.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.metricsGrid}>
          <MetricCard label="Sites monitored" value={`${sites.length}`} />
          <MetricCard
            label="Priority alerts"
            value={`${recommendations.filter((rec) => rec.urgency === "High").length}`}
          />
          <MetricCard
            label="Water advised"
            value={`${recommendations.reduce((sum, rec) => sum + rec.recommendedMm, 0).toFixed(1)} mm`}
          />
          <MetricCard
            label="Average score"
            value={`${
              recommendations.length
                ? Math.round(
                    recommendations.reduce((sum, rec) => sum + rec.modelScore, 0) /
                      recommendations.length
                  )
                : 0
            }%`}
          />
        </View>

        {selectedRecommendation && selectedWeather ? (
          <View style={styles.card}>
            <SectionTitle
              title={selectedSite.name}
              subtitle={`${cropLabel(selectedSite.cropType)} · ${selectedSite.locationLabel}`}
              rightPill={selectedRecommendation.riskBand}
              rightPillColor={riskColor(selectedRecommendation.urgency)}
            />

            <View style={styles.recommendationBox}>
              <Text style={styles.recommendationLabel}>Recommendation</Text>
              <Text style={styles.recommendationTitle}>
                {selectedRecommendation.actionLabel}
              </Text>
              <Text style={styles.bodyText}>{selectedRecommendation.summary}</Text>
            </View>

            <View style={styles.twoCol}>
              <MiniDataCard label="Urgency" value={selectedRecommendation.urgency} />
              <MiniDataCard
                label="Model score"
                value={`${selectedRecommendation.modelScore}%`}
              />
            </View>

            <View style={styles.twoCol}>
              <MiniDataCard
                label="Current weather"
                value={`${selectedWeather.current.temperatureC}°C`}
                subvalue={`Wind ${selectedWeather.current.windSpeedKmh} km/h`}
              />
              <MiniDataCard
                label="Today"
                value={`${selectedWeather.today.maxTempC}° / ${selectedWeather.today.minTempC}°`}
                subvalue={`${selectedWeather.today.precipitationMm} mm precipitation`}
              />
            </View>

            <Text style={styles.subHeader}>Decision drivers</Text>
            {selectedRecommendation.reasons.map((reason, index) => (
              <View key={index} style={styles.reasonRow}>
                <Text style={styles.reasonBullet}>•</Text>
                <Text style={styles.reasonText}>{reason}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>All active sites</Text>

          {recommendations.length === 0 ? (
            <Text style={styles.sectionSubtitle}>
              No active recommendations are available yet.
            </Text>
          ) : null}

          {recommendations.map((rec) => {
            const site = sites.find((s) => s.id === rec.siteId);
            if (!site) {
              return null;
            }

            return (
              <TouchableOpacity
                key={rec.siteId}
                style={styles.siteCard}
                onPress={() => setSelectedSiteId(rec.siteId)}
              >
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.siteName}>{site.name}</Text>
                    <Text style={styles.siteMeta}>
                      {cropLabel(site.cropType)} · {site.locationLabel}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.pill,
                      {
                        backgroundColor: `${riskColor(rec.urgency)}15`,
                        borderColor: `${riskColor(rec.urgency)}45`,
                      },
                    ]}
                  >
                    <Text style={[styles.pillText, { color: riskColor(rec.urgency) }]}>
                      {rec.urgency}
                    </Text>
                  </View>
                </View>

                <Text style={styles.siteAction}>{rec.actionLabel}</Text>
                <Text style={styles.siteMeta}>{rec.startBy}</Text>
              </TouchableOpacity>
            );
          })}
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
    backgroundColor: palette.hero,
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
  },
  heroEyebrow: {
    color: "#B8C7E6",
    fontSize: 13,
    marginBottom: 8,
    fontWeight: "600",
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  heroSubtitle: {
    color: "#DCE6F8",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 16,
  },
  heroInnerCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 14,
  },
  heroInnerLabel: {
    color: "#C9D7F2",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  heroInnerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  heroInnerText: {
    color: "#E3ECFA",
    fontSize: 14,
    lineHeight: 20,
  },
  siteSwitchRow: {
    marginBottom: 16,
  },
  siteChip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 10,
  },
  siteChipActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  siteChipText: {
    color: palette.ink,
    fontWeight: "600",
    fontSize: 13,
  },
  siteChipTextActive: {
    color: "#FFFFFF",
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
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  metricLabel: {
    fontSize: 13,
    color: palette.muted,
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: "700",
    color: palette.ink,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: palette.ink,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: palette.muted,
    marginTop: 4,
  },
  recommendationBox: {
    backgroundColor: "#F8FAFD",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  recommendationLabel: {
    fontSize: 12,
    color: palette.muted,
    marginBottom: 6,
    fontWeight: "600",
  },
  recommendationTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: palette.ink,
    marginBottom: 6,
  },
  bodyText: {
    fontSize: 14,
    color: palette.muted,
    lineHeight: 21,
  },
  twoCol: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  miniCard: {
    width: "48%",
    backgroundColor: "#F8FAFD",
    borderRadius: 14,
    padding: 14,
  },
  miniLabel: {
    fontSize: 12,
    color: palette.muted,
    marginBottom: 6,
    fontWeight: "600",
  },
  miniValue: {
    fontSize: 18,
    fontWeight: "700",
    color: palette.ink,
  },
  miniSubvalue: {
    fontSize: 13,
    color: palette.muted,
    marginTop: 4,
  },
  subHeader: {
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
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  siteCard: {
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 14,
    marginTop: 14,
  },
  siteName: {
    fontSize: 17,
    fontWeight: "700",
    color: palette.ink,
  },
  siteMeta: {
    fontSize: 13,
    color: palette.muted,
    marginTop: 4,
  },
  siteAction: {
    fontSize: 16,
    fontWeight: "700",
    color: palette.ink,
    marginTop: 10,
  },
});