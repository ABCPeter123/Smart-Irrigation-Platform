import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  API_BASE_URL,
  BackendHealthResponse,
  checkBackendHealth,
} from "../../src/services/api";

const palette = {
  bg: "#F3F6FB",
  card: "#FFFFFF",
  ink: "#0B1830",
  muted: "#5A6B85",
  border: "#D9E1EE",
  accent: "#1F7AE0",
  good: "#1D8F5A",
  danger: "#C43D3D",
  warning: "#D18B16",
};

type BackendStatus = "unknown" | "online" | "offline";

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Text style={styles.settingValue}>{value}</Text>
    </View>
  );
}

function StatusBadge({ status }: { status: BackendStatus }) {
  const color =
    status === "online"
      ? palette.good
      : status === "offline"
      ? palette.danger
      : palette.warning;

  const label =
    status === "online"
      ? "Online"
      : status === "offline"
      ? "Offline"
      : "Unknown";

  return (
    <View
      style={[
        styles.statusBadge,
        {
          backgroundColor: `${color}15`,
          borderColor: `${color}45`,
        },
      ]}
    >
      <Text style={[styles.statusBadgeText, { color }]}>{label}</Text>
    </View>
  );
}

export default function SettingsScreen() {
  const [backendStatus, setBackendStatus] =
    useState<BackendStatus>("unknown");
  const [healthData, setHealthData] = useState<BackendHealthResponse | null>(
    null
  );
  const [checkingBackend, setCheckingBackend] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  const runBackendCheck = useCallback(async () => {
    try {
      setCheckingBackend(true);
      setBackendError(null);

      const result = await checkBackendHealth();

      setHealthData(result);
      setBackendStatus(result.status === "ok" ? "online" : "unknown");
    } catch (error) {
      setHealthData(null);
      setBackendStatus("offline");
      setBackendError(
        error instanceof Error ? error.message : "Unable to reach backend."
      );
    } finally {
      setCheckingBackend(false);
    }
  }, []);

  useEffect(() => {
    runBackendCheck();
  }, [runBackendCheck]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>
          Platform configuration, backend connectivity, model inputs, and
          operating profile.
        </Text>

        <View style={styles.statusCard}>
          <View style={styles.statusHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Backend Status</Text>
              <Text style={styles.statusSubtitle}>
                Confirms whether the app can reach your local Express API.
              </Text>
            </View>

            <StatusBadge status={backendStatus} />
          </View>

          <View style={styles.statusBox}>
            <Text style={styles.statusLabel}>API base URL</Text>
            <Text style={styles.statusValue}>{API_BASE_URL}</Text>
          </View>

          {healthData ? (
            <>
              <SettingRow label="Health status" value={healthData.status} />
              <SettingRow label="Service" value={healthData.service} />
              <SettingRow
                label="Server timestamp"
                value={new Date(healthData.timestamp).toLocaleString()}
              />
            </>
          ) : null}

          {backendError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>Connection error</Text>
              <Text style={styles.errorText}>{backendError}</Text>
            </View>
          ) : null}

          <Pressable
            style={[
              styles.primaryButton,
              checkingBackend && styles.primaryButtonDisabled,
            ]}
            onPress={runBackendCheck}
            disabled={checkingBackend}
          >
            {checkingBackend ? (
              <View style={styles.buttonContent}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Checking...</Text>
              </View>
            ) : (
              <Text style={styles.primaryButtonText}>Check Connection</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Platform profile</Text>
          <SettingRow
            label="Product mode"
            value="Software-first irrigation intelligence"
          />
          <SettingRow
            label="Deployment model"
            value="Sensor-light decision support with optional hardware integration later"
          />
          <SettingRow
            label="Operating region"
            value="Remote and cold-climate agriculture"
          />
          <SettingRow
            label="Execution model"
            value="Backend recommendations with manual execution or future controller integration"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Backend architecture</Text>
          <SettingRow label="API framework" value="Node.js, Express, TypeScript" />
          <SettingRow label="Database" value="PostgreSQL with Prisma ORM" />
          <SettingRow
            label="Core entities"
            value="Sites, weather cache, irrigation logs, recommendation snapshots"
          />
          <SettingRow
            label="Current API mode"
            value="Local development backend over Wi-Fi"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Data sources</Text>
          <SettingRow label="Weather source" value="Open-Meteo forecast API" />
          <SettingRow
            label="Weather cache"
            value="Backend weather cache with automatic refresh after expiry"
          />
          <SettingRow
            label="Evapotranspiration input"
            value="Open-Meteo ET0 feed plus crop-adjusted water demand logic"
          />
          <SettingRow
            label="User operational input"
            value="Manual irrigation logs and site profile updates"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recommendation model</Text>
          <SettingRow label="Core logic" value="Rule-based irrigation engine" />
          <SettingRow
            label="Primary variables"
            value="ET0, precipitation, temperature, wind, soil type, crop type, irrigation method, recent irrigation"
          />
          <SettingRow
            label="Output format"
            value="Action, timing, delivery volume, urgency, risk band, model score, reasons"
          />
          <SettingRow
            label="Audit trail"
            value="Recommendation snapshots can be saved for each site"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Commercial configuration</Text>
          <SettingRow label="Base product" value="Annual software subscription" />
          <SettingRow
            label="Higher tier"
            value="Premium support, calibration, reporting, and integration services"
          />
          <SettingRow
            label="Hardware role"
            value="Performance-enhancing layer, not a core dependency"
          />
          <SettingRow
            label="Target deployments"
            value="Greenhouses, specialty crops, remote food-production sites"
          />
        </View>

        <Text style={styles.footerText}>
          For phone testing, keep your laptop and phone on the same Wi-Fi and
          allow Node.js through Windows Firewall.
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
    borderWidth: 1,
    borderColor: palette.border,
  },
  statusCard: {
    backgroundColor: palette.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  statusHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: palette.ink,
    marginBottom: 14,
  },
  statusSubtitle: {
    fontSize: 14,
    color: palette.muted,
    lineHeight: 20,
    marginTop: -8,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  statusBox: {
    backgroundColor: "#F8FAFD",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E8EEF7",
  },
  statusLabel: {
    fontSize: 12,
    color: palette.muted,
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  statusValue: {
    fontSize: 15,
    color: palette.ink,
    fontWeight: "800",
  },
  settingRow: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  settingLabel: {
    fontSize: 13,
    color: palette.muted,
    marginBottom: 6,
    fontWeight: "600",
  },
  settingValue: {
    fontSize: 15,
    color: palette.ink,
    lineHeight: 22,
  },
  errorBox: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  errorTitle: {
    color: "#991B1B",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 4,
  },
  errorText: {
    color: "#991B1B",
    fontSize: 13,
    lineHeight: 19,
  },
  primaryButton: {
    backgroundColor: palette.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.75,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  footerText: {
    textAlign: "center",
    color: "#94A3B8",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
});