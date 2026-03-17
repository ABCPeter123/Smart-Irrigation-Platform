import React from "react";
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";

const farms = [
  {
    name: "Aurora Greenhouse",
    crop: "Tomatoes",
    location: "Whitehorse, YT",
    risk: "Medium",
    recommendation: "Irrigate tonight",
    amount: "12 mm",
    confidence: 82,
    weather: "Cool and dry over the next 24 hours",
    sensorMode: "Sensor-light",
  },
  {
    name: "North Ridge Farm",
    crop: "Leafy Greens",
    location: "Hay River, NT",
    risk: "High",
    recommendation: "Irrigate within 6 hours",
    amount: "8 mm",
    confidence: 76,
    weather: "Wind increasing, low rainfall probability",
    sensorMode: "1 soil probe connected",
  },
];

const stats = [
  { title: "Fields monitored", value: "24" },
  { title: "Water saved", value: "18%" },
  { title: "Avg. confidence", value: "79%" },
  { title: "Alerts today", value: "5" },
];

function StatCard({ title, value }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function FarmCard({ farm }) {
  const riskStyle = farm.risk === "High" ? styles.riskHigh : styles.riskMedium;

  return (
    <View style={styles.farmCard}>
      <View style={styles.rowBetween}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.farmName}>{farm.name}</Text>
          <Text style={styles.farmMeta}>{farm.crop} • {farm.location}</Text>
        </View>
        <View style={[styles.riskBadge, riskStyle]}>
          <Text style={styles.riskText}>{farm.risk} risk</Text>
        </View>
      </View>

      <View style={styles.recommendationBox}>
        <Text style={styles.boxLabel}>Recommendation</Text>
        <Text style={styles.recommendationText}>{farm.recommendation}</Text>
        <Text style={styles.boxText}>Suggested amount: {farm.amount}</Text>
        <Text style={styles.boxText}>{farm.weather}</Text>
      </View>

      <View style={styles.rowGap}>
        <View style={styles.infoBox}>
          <Text style={styles.boxLabel}>Confidence</Text>
          <Text style={styles.infoValue}>{farm.confidence}%</Text>
        </View>
        <View style={styles.infoBox}>
          <Text style={styles.boxLabel}>Calibration</Text>
          <Text style={styles.infoValueSmall}>{farm.sensorMode}</Text>
        </View>
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Northern Irrigation</Text>
          <Text style={styles.heroTitle}>Mobile App MVP</Text>
          <Text style={styles.heroSubtitle}>
            Sensor-light irrigation guidance for remote and cold-climate agriculture.
          </Text>

          <View style={styles.highlightCard}>
            <Text style={styles.boxLabelDark}>Today’s top action</Text>
            <Text style={styles.highlightTitle}>Run irrigation for Aurora Greenhouse</Text>
            <Text style={styles.highlightText}>Suggested depth: 12 mm before 10:00 PM</Text>
            <Text style={styles.highlightText}>Model confidence: 82%</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          {stats.map((item) => (
            <StatCard key={item.title} title={item.title} value={item.value} />
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What the MVP should do</Text>
          <Text style={styles.sectionText}>
            The first version should focus on irrigation recommendations, confidence scoring,
            weather context, optional sensor calibration, and simple seasonal reporting.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Farm recommendations</Text>
          {farms.map((farm) => (
            <FarmCard key={farm.name} farm={farm} />
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Core app tabs</Text>
          <Text style={styles.sectionText}>Dashboard</Text>
          <Text style={styles.sectionText}>Field Recommendations</Text>
          <Text style={styles.sectionText}>Weather and ET</Text>
          <Text style={styles.sectionText}>Sensors</Text>
          <Text style={styles.sectionText}>Season Reports</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Suggested build stack</Text>
          <Text style={styles.sectionText}>Frontend: Expo + React Native</Text>
          <Text style={styles.sectionText}>Backend: Supabase or Firebase</Text>
          <Text style={styles.sectionText}>Decision engine: rules + water-balance logic first</Text>
          <Text style={styles.sectionText}>Later: satellite signals + sensor calibration + smarter prediction</Text>
        </View>

        <TouchableOpacity style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Start Field Setup</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  heroCard: {
    backgroundColor: "#0f172a",
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
  },
  heroEyebrow: {
    color: "#cbd5e1",
    fontSize: 13,
    marginBottom: 6,
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "700",
  },
  heroSubtitle: {
    color: "#cbd5e1",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  highlightCard: {
    backgroundColor: "#1e293b",
    borderRadius: 18,
    padding: 16,
    marginTop: 18,
  },
  boxLabelDark: {
    color: "#94a3b8",
    fontSize: 12,
    marginBottom: 6,
  },
  highlightTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  highlightText: {
    color: "#e2e8f0",
    fontSize: 14,
    lineHeight: 20,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  statCard: {
    width: "48%",
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  statTitle: {
    color: "#64748b",
    fontSize: 12,
    marginBottom: 8,
  },
  statValue: {
    color: "#0f172a",
    fontSize: 24,
    fontWeight: "700",
  },
  section: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 10,
  },
  sectionText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#475569",
    marginBottom: 6,
  },
  farmCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 20,
    padding: 16,
    marginTop: 12,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  rowGap: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  farmName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  farmMeta: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 14,
  },
  riskBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  riskHigh: {
    backgroundColor: "#fee2e2",
  },
  riskMedium: {
    backgroundColor: "#fef3c7",
  },
  riskText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "600",
  },
  recommendationBox: {
    backgroundColor: "#e2e8f0",
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
  },
  boxLabel: {
    color: "#64748b",
    fontSize: 12,
    marginBottom: 4,
  },
  recommendationText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  boxText: {
    color: "#334155",
    fontSize: 14,
    lineHeight: 20,
  },
  infoBox: {
    flex: 1,
    backgroundColor: "#e2e8f0",
    borderRadius: 16,
    padding: 14,
  },
  infoValue: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
  },
  infoValueSmall: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
  },
  primaryButton: {
    backgroundColor: "#0f172a",
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});
