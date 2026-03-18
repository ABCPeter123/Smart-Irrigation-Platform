import React from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const palette = {
  bg: "#F3F6FB",
  card: "#FFFFFF",
  ink: "#0B1830",
  muted: "#5A6B85",
  border: "#D9E1EE",
  accent: "#1F7AE0",
};

function SettingRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Text style={styles.settingValue}>{value}</Text>
    </View>
  );
}

export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>
          Platform configuration, model inputs, and operating profile.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Platform profile</Text>
          <SettingRow label="Product mode" value="Software-first irrigation intelligence" />
          <SettingRow label="Deployment model" value="Sensor-light with optional hardware tier" />
          <SettingRow label="Operating region" value="Remote and cold-climate agriculture" />
          <SettingRow label="Execution model" value="Decision-support with optional controller integration" />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Data sources</Text>
          <SettingRow label="Weather source" value="Open-Meteo forecast API" />
          <SettingRow label="Forecast horizon" value="24-hour operational window with daily weather context" />
          <SettingRow label="Evapotranspiration input" value="Hourly ET feed plus crop-adjusted water demand logic" />
          <SettingRow label="Field calibration" value="Optional soil-moisture sensor input" />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recommendation model</Text>
          <SettingRow label="Core logic" value="Rule-based irrigation engine" />
          <SettingRow label="Primary variables" value="ET, precipitation, temperature, wind, soil profile, crop profile" />
          <SettingRow label="Output format" value="Action, timing, delivery volume, urgency, model score" />
          <SettingRow label="Update cadence" value="On app refresh" />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Commercial configuration</Text>
          <SettingRow label="Base product" value="Annual software subscription" />
          <SettingRow label="Higher tier" value="Premium support and calibration services" />
          <SettingRow label="Hardware role" value="Performance-enhancing layer, not core dependency" />
          <SettingRow label="Target deployments" value="Greenhouses, specialty crops, remote food-production sites" />
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
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: palette.ink,
    marginBottom: 14,
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
});