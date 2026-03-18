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
import { SITES } from "../src/data/sites";
import { fetchWeatherForSite } from "../src/services/weather";
import { formatHour } from "../src/services/format";
import { Site, WeatherBundle } from "../src/types";

const palette = {
  bg: "#F3F6FB",
  card: "#FFFFFF",
  ink: "#0B1830",
  muted: "#5A6B85",
  border: "#D9E1EE",
  accent: "#1F7AE0",
};

const cropLabel = (crop: Site["cropType"]) => {
  if (crop === "leafy-greens") return "Leafy Greens";
  if (crop === "strawberries") return "Strawberries";
  return "Tomatoes";
};

function MiniCard({
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

export default function WeatherScreen() {
  const [selectedSiteId, setSelectedSiteId] = useState<string>(SITES[0].id);
  const [weatherBySite, setWeatherBySite] = useState<Record<string, WeatherBundle>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const selectedSite = useMemo(
    () => SITES.find((site) => site.id === selectedSiteId) ?? SITES[0],
    [selectedSiteId]
  );

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

  const selectedWeather = weatherBySite[selectedSite.id];

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={palette.accent} />
        <Text style={styles.loadingText}>Loading weather intelligence...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.title}>Weather</Text>
        <Text style={styles.subtitle}>
          Live forecast and hourly evapotranspiration by site.
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {SITES.map((site) => (
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

        {selectedWeather ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{selectedSite.name}</Text>
              <Text style={styles.cardSubtitle}>
                {cropLabel(selectedSite.cropType)} · {selectedSite.locationLabel}
              </Text>

              <View style={styles.twoCol}>
                <MiniCard
                  label="Current"
                  value={`${selectedWeather.current.temperatureC}°C`}
                  subvalue={`Feels like ${selectedWeather.current.apparentTemperatureC}°C`}
                />
                <MiniCard
                  label="Humidity / Wind"
                  value={`${selectedWeather.current.humidityPct}%`}
                  subvalue={`${selectedWeather.current.windSpeedKmh} km/h`}
                />
              </View>

              <View style={styles.twoCol}>
                <MiniCard
                  label="Today's range"
                  value={`${selectedWeather.today.maxTempC}° / ${selectedWeather.today.minTempC}°`}
                />
                <MiniCard
                  label="Precipitation"
                  value={`${selectedWeather.today.precipitationMm} mm`}
                />
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Next 24 hours</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.hourlyRow}>
                  {selectedWeather.next24h.times.map((time, index) => (
                    <View key={`${time}-${index}`} style={styles.hourCard}>
                      <Text style={styles.hourTime}>{formatHour(time)}</Text>
                      <Text style={styles.hourTemp}>
                        {selectedWeather.next24h.temperatureC[index]}°
                      </Text>
                      <Text style={styles.hourSub}>
                        Rain {selectedWeather.next24h.precipitationProbabilityPct[index]}%
                      </Text>
                      <Text style={styles.hourSub}>
                        ET {selectedWeather.next24h.evapotranspirationMm[index]} mm
                      </Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          </>
        ) : null}
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
  chipRow: {
    marginBottom: 14,
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
  card: {
    backgroundColor: palette.card,
    borderRadius: 18,
    padding: 16,
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
    marginBottom: 14,
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
  hourlyRow: {
    flexDirection: "row",
  },
  hourCard: {
    width: 110,
    backgroundColor: "#F8FAFD",
    borderRadius: 14,
    padding: 12,
    marginRight: 10,
  },
  hourTime: {
    fontSize: 13,
    fontWeight: "600",
    color: palette.muted,
    marginBottom: 6,
  },
  hourTemp: {
    fontSize: 22,
    fontWeight: "700",
    color: palette.ink,
    marginBottom: 6,
  },
  hourSub: {
    fontSize: 12,
    color: palette.muted,
    lineHeight: 18,
  },
});