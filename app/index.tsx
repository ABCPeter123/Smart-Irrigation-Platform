import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSiteContext } from "../src/context/SiteContext";
import {
  BackendRecommendationResponse,
  fetchBackendRecommendation,
} from "../src/services/api";
import { Site } from "../src/types";

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

const riskColor = (urgency: string) => {
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
          <Text
            style={[
              styles.pillText,
              { color: rightPillColor ?? palette.accent },
            ]}
          >
            {rightPill}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default function DashboardScreen() {
  const {
    sites,
    selectedSiteId,
    selectedSite,
    setSelectedSiteId,
    loadingSites,
    sitesError,
    refreshSites,
  } = useSiteContext();

  const [recommendationsBySite, setRecommendationsBySite] = useState<
    Record<string, BackendRecommendationResponse>
  >({});
  const [loadingRecommendations, setLoadingRecommendations] = useState(true);
  const [recommendationError, setRecommendationError] = useState<string | null>(
    null
  );
  const [refreshing, setRefreshing] = useState(false);

  const loadRecommendations = useCallback(async () => {
    if (loadingSites) {
      return;
    }

    if (sites.length === 0) {
      setRecommendationsBySite({});
      setLoadingRecommendations(false);
      return;
    }

    try {
      setLoadingRecommendations(true);
      setRecommendationError(null);

      const entries = await Promise.all(
        sites.map(async (site) => {
          const recommendation = await fetchBackendRecommendation(site.id);
          return [site.id, recommendation] as const;
        })
      );

      setRecommendationsBySite(Object.fromEntries(entries));
    } catch (error) {
      setRecommendationError(
        error instanceof Error
          ? error.message
          : "Unable to load backend recommendations."
      );
    } finally {
      setLoadingRecommendations(false);
    }
  }, [sites, loadingSites]);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await refreshSites();
      await loadRecommendations();
    } finally {
      setRefreshing(false);
    }
  }, [refreshSites, loadRecommendations]);

  const recommendationList = useMemo(() => {
    return sites
      .map((site) => recommendationsBySite[site.id])
      .filter(Boolean) as BackendRecommendationResponse[];
  }, [sites, recommendationsBySite]);

  const selectedRecommendation = selectedSite
    ? recommendationsBySite[selectedSite.id] ?? null
    : null;

  const topRecommendation = useMemo(() => {
    const rank = { High: 3, Medium: 2, Low: 1 } as const;

    return [...recommendationList].sort((a, b) => {
      return (
        rank[b.recommendation.urgency] - rank[a.recommendation.urgency] ||
        b.recommendation.recommendedMm - a.recommendation.recommendedMm
      );
    })[0];
  }, [recommendationList]);

  const highPriorityCount = recommendationList.filter(
    (item) => item.recommendation.urgency === "High"
  ).length;

  const totalRecommendedMm = recommendationList.reduce(
    (sum, item) => sum + item.recommendation.recommendedMm,
    0
  );

  const averageModelScore =
    recommendationList.length > 0
      ? Math.round(
          recommendationList.reduce(
            (sum, item) => sum + item.recommendation.modelScore,
            0
          ) / recommendationList.length
        )
      : 0;

  if (loadingSites || loadingRecommendations) {
    return (
      <SafeAreaView style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={palette.accent} />
        <Text style={styles.loadingText}>Loading irrigation intelligence...</Text>
      </SafeAreaView>
    );
  }

  if (sitesError) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Could not load backend sites</Text>
            <Text style={styles.errorText}>{sitesError}</Text>

            <Pressable style={styles.primaryButton} onPress={refreshSites}>
              <Text style={styles.primaryButtonText}>Retry</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (sites.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>Northern Irrigation</Text>
            <Text style={styles.heroTitle}>Operational Dashboard</Text>
            <Text style={styles.heroSubtitle}>
              Add a site to start generating backend-powered irrigation guidance.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>No backend sites yet</Text>
            <Text style={styles.sectionSubtitle}>
              Go to the Sites tab and add a site manually or from your current
              location. The Dashboard will then show live weather-based
              recommendations across all sites.
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
          <Text style={styles.heroEyebrow}>Northern Irrigation</Text>
          <Text style={styles.heroTitle}>Operational Dashboard</Text>
          <Text style={styles.heroSubtitle}>
            Backend-powered site monitoring, live weather inputs, cached
            evapotranspiration data, and irrigation action planning.
          </Text>

          {topRecommendation ? (
            <View style={styles.heroInnerCard}>
              <Text style={styles.heroInnerLabel}>Top action today</Text>
              <Text style={styles.heroInnerTitle}>
                {topRecommendation.site.name}
              </Text>
              <Text style={styles.heroInnerText}>
                {topRecommendation.recommendation.actionLabel} ·{" "}
                {topRecommendation.recommendation.startBy}
              </Text>
              <Text style={styles.heroInnerText}>
                Urgency: {topRecommendation.recommendation.urgency} · Model
                score: {topRecommendation.recommendation.modelScore}%
              </Text>
            </View>
          ) : null}
        </View>

        {recommendationError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>
              Some recommendation data could not load
            </Text>
            <Text style={styles.errorText}>{recommendationError}</Text>

            <Pressable style={styles.primaryButton} onPress={loadRecommendations}>
              <Text style={styles.primaryButtonText}>Retry Recommendations</Text>
            </Pressable>
          </View>
        ) : null}

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
          <MetricCard label="Priority alerts" value={`${highPriorityCount}`} />
          <MetricCard
            label="Water advised"
            value={`${totalRecommendedMm.toFixed(1)} mm`}
          />
          <MetricCard label="Average score" value={`${averageModelScore}%`} />
        </View>

        {selectedSite && selectedRecommendation ? (
          <View style={styles.card}>
            <SectionTitle
              title={selectedRecommendation.site.name}
              subtitle={`${cropLabel(selectedSite.cropType)} · ${
                selectedRecommendation.site.locationLabel
              }`}
              rightPill={selectedRecommendation.recommendation.riskBand}
              rightPillColor={riskColor(
                selectedRecommendation.recommendation.urgency
              )}
            />

            <View style={styles.recommendationBox}>
              <Text style={styles.recommendationLabel}>
                Selected site recommendation
              </Text>
              <Text style={styles.recommendationTitle}>
                {selectedRecommendation.recommendation.actionLabel}
              </Text>
              <Text style={styles.bodyText}>
                {selectedRecommendation.recommendation.summary}
              </Text>
            </View>

            <View style={styles.twoCol}>
              <MiniDataCard
                label="Urgency"
                value={selectedRecommendation.recommendation.urgency}
              />
              <MiniDataCard
                label="Model score"
                value={`${selectedRecommendation.recommendation.modelScore}%`}
              />
            </View>

            <View style={styles.twoCol}>
              <MiniDataCard
                label="Current weather"
                value={`${
                  selectedRecommendation.weather.current.temperatureC ?? "N/A"
                }°C`}
                subvalue={`Wind ${
                  selectedRecommendation.weather.current.windSpeedKmh ?? "N/A"
                } km/h`}
              />
              <MiniDataCard
                label="Today"
                value={`${
                  selectedRecommendation.weather.daily.et0Mm ?? "N/A"
                } mm ET0`}
                subvalue={`${
                  selectedRecommendation.weather.daily.precipitationSumMm ??
                  "N/A"
                } mm forecast rain`}
              />
            </View>

            <Text style={styles.subHeader}>Decision drivers</Text>
            {selectedRecommendation.recommendation.reasons.map(
              (reason, index) => (
                <View key={index} style={styles.reasonRow}>
                  <Text style={styles.reasonBullet}>•</Text>
                  <Text style={styles.reasonText}>{reason}</Text>
                </View>
              )
            )}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              No recommendation for selected site
            </Text>
            <Text style={styles.sectionSubtitle}>
              Pull to refresh. Confirm the backend is running and the selected
              site exists in PostgreSQL.
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>All active sites</Text>

          {recommendationList.length === 0 ? (
            <Text style={styles.sectionSubtitle}>
              No active backend recommendations are available yet.
            </Text>
          ) : null}

          {recommendationList.map((item) => {
            const urgency = item.recommendation.urgency;
            const color = riskColor(urgency);

            return (
              <TouchableOpacity
                key={item.site.id}
                style={styles.siteCard}
                onPress={() => setSelectedSiteId(item.site.id)}
              >
                <View style={styles.siteCardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.siteCardTitle}>{item.site.name}</Text>
                    <Text style={styles.siteCardSubtitle}>
                      {item.site.cropType} · {item.site.locationLabel}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.pill,
                      {
                        backgroundColor: `${color}15`,
                        borderColor: `${color}45`,
                      },
                    ]}
                  >
                    <Text style={[styles.pillText, { color }]}>{urgency}</Text>
                  </View>
                </View>

                <Text style={styles.siteCardAction}>
                  {item.recommendation.actionLabel}
                </Text>
                <Text style={styles.siteCardSummary}>
                  {item.recommendation.startBy} ·{" "}
                  {item.recommendation.recommendedLitres.toLocaleString()} litres
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.footerText}>
          Dashboard data comes from PostgreSQL site records and backend
          recommendation endpoints.
        </Text>
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
    paddingBottom: 36,
  },
  heroCard: {
    backgroundColor: palette.hero,
    borderRadius: 26,
    padding: 22,
    marginBottom: 16,
  },
  heroEyebrow: {
    color: "#9CC8FF",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 8,
  },
  heroSubtitle: {
    color: "#D5E4F7",
    fontSize: 15,
    lineHeight: 22,
  },
  heroInnerCard: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 18,
    padding: 16,
    marginTop: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  heroInnerLabel: {
    color: "#9CC8FF",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  heroInnerTitle: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "800",
    marginBottom: 6,
  },
  heroInnerText: {
    color: "#D5E4F7",
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 10,
  },
  siteChipActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  siteChipText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "700",
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
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  metricLabel: {
    fontSize: 12,
    color: palette.muted,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  metricValue: {
    fontSize: 25,
    color: palette.ink,
    fontWeight: "800",
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: palette.ink,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: palette.muted,
    lineHeight: 20,
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
    fontWeight: "800",
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
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  recommendationTitle: {
    fontSize: 24,
    fontWeight: "800",
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
    fontWeight: "700",
    marginBottom: 6,
  },
  miniValue: {
    fontSize: 18,
    color: palette.ink,
    fontWeight: "800",
  },
  miniSubvalue: {
    fontSize: 13,
    color: palette.muted,
    marginTop: 4,
  },
  subHeader: {
    fontSize: 16,
    color: palette.ink,
    fontWeight: "800",
    marginBottom: 8,
    marginTop: 4,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  reasonBullet: {
    color: palette.accent,
    fontSize: 16,
    marginRight: 8,
    lineHeight: 21,
  },
  reasonText: {
    flex: 1,
    color: palette.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  siteCard: {
    backgroundColor: "#F8FAFD",
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#E8EEF7",
  },
  siteCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
  },
  siteCardTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: palette.ink,
  },
  siteCardSubtitle: {
    fontSize: 13,
    color: palette.muted,
    marginTop: 3,
  },
  siteCardAction: {
    fontSize: 18,
    fontWeight: "800",
    color: palette.ink,
    marginBottom: 4,
  },
  siteCardSummary: {
    fontSize: 14,
    color: palette.muted,
  },
  errorCard: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#991B1B",
    marginBottom: 6,
  },
  errorText: {
    fontSize: 14,
    color: "#991B1B",
    lineHeight: 20,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: palette.accent,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  footerText: {
    textAlign: "center",
    color: "#94A3B8",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
});