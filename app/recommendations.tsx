import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSiteContext } from "../src/context/SiteContext";
import {
  BackendIrrigationLog,
  BackendRecommendationResponse,
  createIrrigationLog,
  fetchBackendRecommendation,
  fetchIrrigationLogs,
} from "../src/services/api";

function getUrgencyStyle(urgency: string) {
  if (urgency === "High") {
    return {
      backgroundColor: "#FEE2E2",
      color: "#991B1B",
      borderColor: "#FECACA",
    };
  }

  if (urgency === "Medium") {
    return {
      backgroundColor: "#FEF3C7",
      color: "#92400E",
      borderColor: "#FDE68A",
    };
  }

  return {
    backgroundColor: "#DCFCE7",
    color: "#166534",
    borderColor: "#BBF7D0",
  };
}

function calculateLitres(appliedMm: number, areaHa: number) {
  const areaSqm = areaHa * 10000;
  return Math.round(appliedMm * areaSqm);
}

export default function RecommendationsScreen() {
  const { selectedSiteId, selectedSite, loadingSites, sitesError } =
    useSiteContext();

  const [data, setData] = useState<BackendRecommendationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingIrrigation, setLoggingIrrigation] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [irrigationLogs, setIrrigationLogs] = useState<BackendIrrigationLog[]>(
    []
  );
  const [appliedMmInput, setAppliedMmInput] = useState("");
  const [logNotes, setLogNotes] = useState("");

  const loadIrrigationLogs = useCallback(async () => {
    if (!selectedSiteId) {
      setIrrigationLogs([]);
      return;
    }

    const logs = await fetchIrrigationLogs(selectedSiteId);
    setIrrigationLogs(logs.slice(0, 7));
  }, [selectedSiteId]);

  const loadRecommendation = useCallback(async () => {
    if (loadingSites) {
      return;
    }

    if (!selectedSiteId) {
      setData(null);
      setErrorMessage("No site selected. Add or select a site first.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setErrorMessage(null);

      const result = await fetchBackendRecommendation(selectedSiteId);
      const logs = await fetchIrrigationLogs(selectedSiteId);

      setData(result);
      setIrrigationLogs(logs.slice(0, 7));

      const recommendedMm = result.recommendation.recommendedMm;

      if (recommendedMm > 0) {
        setAppliedMmInput(String(recommendedMm));
      }
    } catch (error) {
      setData(null);
      setErrorMessage(
        error instanceof Error ? error.message : "Unknown backend error"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedSiteId, loadingSites]);

  useEffect(() => {
    loadRecommendation();
  }, [loadRecommendation]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadRecommendation();
  }, [loadRecommendation]);

  const handleLogIrrigation = async () => {
    if (!data) {
      return;
    }

    const appliedMm = Number(appliedMmInput);

    if (!Number.isFinite(appliedMm) || appliedMm <= 0) {
      Alert.alert("Invalid amount", "Enter a positive irrigation amount in mm.");
      return;
    }

    const appliedLitres = calculateLitres(appliedMm, data.site.areaHa);

    try {
      setLoggingIrrigation(true);

      await createIrrigationLog({
        siteId: data.site.id,
        appliedMm,
        appliedLitres,
        performedAt: new Date().toISOString(),
        notes: logNotes.trim() || undefined,
      });

      setLogNotes("");

      Alert.alert(
        "Irrigation logged",
        `${appliedMm} mm was logged for ${data.site.name}. The recommendation will now account for this water.`
      );

      await loadRecommendation();
      await loadIrrigationLogs();
    } catch (error) {
      Alert.alert(
        "Log failed",
        error instanceof Error ? error.message : "Unable to log irrigation."
      );
    } finally {
      setLoggingIrrigation(false);
    }
  };

  if (loading || loadingSites) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>
          Loading irrigation recommendation...
        </Text>
      </View>
    );
  }

  if (sitesError) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.kicker}>Backend Recommendation</Text>
        <Text style={styles.title}>Could not load sites</Text>

        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{sitesError}</Text>
        </View>

        <Text style={styles.helperText}>
          Check that your backend is running, your API IP address is correct, and
          your phone is on the same Wi-Fi as your laptop.
        </Text>
      </ScrollView>
    );
  }

  if (errorMessage) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.kicker}>Backend Recommendation</Text>
        <Text style={styles.title}>Could not load recommendation</Text>

        {selectedSite ? (
          <Text style={styles.subtitle}>
            Selected site: {selectedSite.name} · {selectedSite.locationLabel}
          </Text>
        ) : null}

        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>

        <Text style={styles.helperText}>
          Check that your backend is running, the selected site exists in
          PostgreSQL, and the weather endpoint works for this site.
        </Text>

        <Pressable style={styles.primaryButton} onPress={loadRecommendation}>
          <Text style={styles.primaryButtonText}>Try Again</Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>No recommendation data returned.</Text>
      </View>
    );
  }

  const { site, recommendation, weather, recentIrrigationLogs } = data;
  const urgencyStyle = getUrgencyStyle(recommendation.urgency);
  const appliedMmNumber = Number(appliedMmInput);
  const estimatedLitres =
    Number.isFinite(appliedMmNumber) && appliedMmNumber > 0
      ? calculateLitres(appliedMmNumber, site.areaHa)
      : 0;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View>
        <Text style={styles.kicker}>Backend Recommendation</Text>
        <Text style={styles.title}>{site.name}</Text>
        <Text style={styles.subtitle}>{site.locationLabel}</Text>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <Text style={styles.cardLabel}>Current Action</Text>

          <View
            style={[
              styles.urgencyBadge,
              {
                backgroundColor: urgencyStyle.backgroundColor,
                borderColor: urgencyStyle.borderColor,
              },
            ]}
          >
            <Text style={[styles.urgencyText, { color: urgencyStyle.color }]}>
              {recommendation.urgency}
            </Text>
          </View>
        </View>

        <Text style={styles.headline}>{recommendation.headline}</Text>
        <Text style={styles.action}>{recommendation.actionLabel}</Text>
        <Text style={styles.summary}>{recommendation.summary}</Text>

        <View style={styles.metricRow}>
          <View style={styles.metricBox}>
            <Text style={styles.metricValue}>
              {recommendation.recommendedMm}
            </Text>
            <Text style={styles.metricLabel}>mm advised</Text>
          </View>

          <View style={styles.metricBox}>
            <Text style={styles.metricValue}>
              {recommendation.recommendedLitres.toLocaleString()}
            </Text>
            <Text style={styles.metricLabel}>litres</Text>
          </View>

          <View style={styles.metricBox}>
            <Text style={styles.metricValue}>{recommendation.modelScore}%</Text>
            <Text style={styles.metricLabel}>model score</Text>
          </View>
        </View>

        <View style={styles.startByBox}>
          <Text style={styles.startByLabel}>Start by</Text>
          <Text style={styles.startByValue}>{recommendation.startBy}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Log Applied Irrigation</Text>

        <Text style={styles.helperText}>
          Record water already applied. The next recommendation will account for
          this recent irrigation credit.
        </Text>

        <Text style={styles.inputLabel}>Applied water, mm</Text>
        <TextInput
          style={styles.input}
          value={appliedMmInput}
          onChangeText={setAppliedMmInput}
          keyboardType="decimal-pad"
          placeholder="e.g. 5"
          placeholderTextColor="#94A3B8"
        />

        <View style={styles.estimateBox}>
          <Text style={styles.estimateLabel}>Estimated volume</Text>
          <Text style={styles.estimateValue}>
            {estimatedLitres.toLocaleString()} litres
          </Text>
        </View>

        <Text style={styles.inputLabel}>Notes, optional</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={logNotes}
          onChangeText={setLogNotes}
          multiline
          placeholder="e.g. Applied after morning inspection"
          placeholderTextColor="#94A3B8"
        />

        <Pressable
          style={[
            styles.primaryButton,
            loggingIrrigation && styles.disabledButton,
          ]}
          onPress={handleLogIrrigation}
          disabled={loggingIrrigation}
        >
          <Text style={styles.primaryButtonText}>
            {loggingIrrigation ? "Logging..." : "Log This Irrigation"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Recent Irrigation History</Text>

        {irrigationLogs.length === 0 ? (
          <Text style={styles.helperText}>
            No irrigation has been logged for this site yet.
          </Text>
        ) : (
          irrigationLogs.map((log) => (
            <View key={log.id} style={styles.historyRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyTitle}>
                  {log.appliedMm} mm ·{" "}
                  {log.appliedLitres.toLocaleString()} litres
                </Text>
                <Text style={styles.historyTime}>
                  {new Date(log.performedAt).toLocaleString()}
                </Text>
                {log.notes ? (
                  <Text style={styles.historyNotes}>{log.notes}</Text>
                ) : null}
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Weather Inputs</Text>

        <View style={styles.twoColumnGrid}>
          <View style={styles.smallMetric}>
            <Text style={styles.smallMetricValue}>
              {weather.current.temperatureC ?? "N/A"}°C
            </Text>
            <Text style={styles.smallMetricLabel}>Current temp</Text>
          </View>

          <View style={styles.smallMetric}>
            <Text style={styles.smallMetricValue}>
              {weather.current.windSpeedKmh ?? "N/A"} km/h
            </Text>
            <Text style={styles.smallMetricLabel}>Wind</Text>
          </View>

          <View style={styles.smallMetric}>
            <Text style={styles.smallMetricValue}>
              {weather.daily.et0Mm ?? "N/A"} mm
            </Text>
            <Text style={styles.smallMetricLabel}>Daily ET0</Text>
          </View>

          <View style={styles.smallMetric}>
            <Text style={styles.smallMetricValue}>
              {weather.daily.precipitationSumMm ?? "N/A"} mm
            </Text>
            <Text style={styles.smallMetricLabel}>Forecast rain</Text>
          </View>
        </View>

        <Text style={styles.sourceText}>
          Source: {weather.source}
          {weather.cache?.status ? `, cache ${weather.cache.status}` : ""}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Model Inputs</Text>

        <View style={styles.inputLine}>
          <Text style={styles.inputLabel}>Crop coefficient</Text>
          <Text style={styles.inputValue}>
            {recommendation.inputs.cropCoefficient}
          </Text>
        </View>

        <View style={styles.inputLine}>
          <Text style={styles.inputLabel}>Crop water demand</Text>
          <Text style={styles.inputValue}>
            {recommendation.inputs.cropWaterDemandMm} mm
          </Text>
        </View>

        <View style={styles.inputLine}>
          <Text style={styles.inputLabel}>Forecast rain</Text>
          <Text style={styles.inputValue}>
            {recommendation.inputs.forecastRainMm} mm
          </Text>
        </View>

        <View style={styles.inputLine}>
          <Text style={styles.inputLabel}>Recent irrigation credit</Text>
          <Text style={styles.inputValue}>
            {recommendation.inputs.recentAppliedMm} mm
          </Text>
        </View>

        <View style={styles.inputLine}>
          <Text style={styles.inputLabel}>Net water need</Text>
          <Text style={styles.inputValue}>
            {recommendation.inputs.netWaterNeedMm} mm
          </Text>
        </View>

        <View style={styles.inputLine}>
          <Text style={styles.inputLabel}>Irrigation cap</Text>
          <Text style={styles.inputValue}>
            {recommendation.inputs.irrigationCapMm} mm
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Why This Recommendation</Text>

        {recommendation.reasons.map((reason, index) => (
          <Text key={index} style={styles.reasonText}>
            • {reason}
          </Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Site Profile</Text>

        <View style={styles.inputLine}>
          <Text style={styles.inputLabel}>Crop</Text>
          <Text style={styles.inputValue}>{site.cropType}</Text>
        </View>

        <View style={styles.inputLine}>
          <Text style={styles.inputLabel}>Environment</Text>
          <Text style={styles.inputValue}>{site.environment}</Text>
        </View>

        <View style={styles.inputLine}>
          <Text style={styles.inputLabel}>Irrigation method</Text>
          <Text style={styles.inputValue}>{site.irrigationMethod}</Text>
        </View>

        <View style={styles.inputLine}>
          <Text style={styles.inputLabel}>Soil type</Text>
          <Text style={styles.inputValue}>{site.soilType}</Text>
        </View>

        <View style={styles.inputLine}>
          <Text style={styles.inputLabel}>Recent logs</Text>
          <Text style={styles.inputValue}>{recentIrrigationLogs.length}</Text>
        </View>
      </View>

      <Text style={styles.footerText}>
        Generated at {new Date(recommendation.generatedAt).toLocaleString()}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 18,
    gap: 14,
    backgroundColor: "#F6F8FB",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F6F8FB",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: "#475569",
  },
  kicker: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1F7AE0",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0F172A",
    marginTop: 4,
  },
  subtitle: {
    fontSize: 15,
    color: "#475569",
    marginTop: 2,
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  urgencyBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  urgencyText: {
    fontSize: 13,
    fontWeight: "800",
  },
  headline: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0F172A",
  },
  action: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1F7AE0",
  },
  summary: {
    fontSize: 15,
    lineHeight: 22,
    color: "#334155",
  },
  metricRow: {
    flexDirection: "row",
    gap: 10,
  },
  metricBox: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 12,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
  },
  metricLabel: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 3,
  },
  startByBox: {
    backgroundColor: "#EFF6FF",
    borderRadius: 16,
    padding: 12,
  },
  startByLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1D4ED8",
    textTransform: "uppercase",
  },
  startByValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E3A8A",
    marginTop: 4,
  },
  twoColumnGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  smallMetric: {
    width: "48%",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 12,
  },
  smallMetricValue: {
    fontSize: 17,
    fontWeight: "900",
    color: "#0F172A",
  },
  smallMetricLabel: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 3,
  },
  sourceText: {
    fontSize: 13,
    color: "#64748B",
  },
  inputLabel: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "700",
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#0F172A",
  },
  notesInput: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  estimateBox: {
    backgroundColor: "#EFF6FF",
    borderRadius: 14,
    padding: 12,
  },
  estimateLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1D4ED8",
    textTransform: "uppercase",
  },
  estimateValue: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1E3A8A",
    marginTop: 4,
  },
  inputLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 8,
  },
  inputValue: {
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "800",
    textAlign: "right",
    flex: 1,
  },
  reasonText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#334155",
  },
  footerText: {
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
    paddingBottom: 12,
  },
  errorCard: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  errorText: {
    color: "#991B1B",
    fontSize: 14,
    lineHeight: 20,
  },
  helperText: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: "#1F7AE0",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  disabledButton: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  historyRow: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0F172A",
  },
  historyTime: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 4,
  },
  historyNotes: {
    fontSize: 13,
    color: "#334155",
    marginTop: 6,
    lineHeight: 19,
  },
});