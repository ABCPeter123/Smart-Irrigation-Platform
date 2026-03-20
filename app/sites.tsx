import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { useSiteContext } from "../src/context/SiteContext";
import { buildRecommendation } from "../src/services/irrigation";
import { getCurrentLocationSite } from "../src/services/location";
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

function OptionRow<T extends string>({
  title,
  value,
  options,
  onChange,
}: {
  title: string;
  value: T;
  options: T[];
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.optionGroup}>
      <Text style={styles.inputLabel}>{title}</Text>
      <View style={styles.optionWrap}>
        {options.map((option) => {
          const active = option === value;
          return (
            <TouchableOpacity
              key={option}
              style={[styles.optionChip, active && styles.optionChipActive]}
              onPress={() => onChange(option)}
            >
              <Text
                style={[styles.optionChipText, active && styles.optionChipTextActive]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function SitesScreen() {
  const {
    sites,
    selectedSiteId,
    setSelectedSiteId,
    addCustomSite,
    removeSite,
    isDefaultSite,
  } = useSiteContext();

  const [weatherBySite, setWeatherBySite] = useState<Record<string, WeatherBundle>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locating, setLocating] = useState(false);

  const [siteName, setSiteName] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [areaHa, setAreaHa] = useState("0.25");
  const [cropType, setCropType] = useState<Site["cropType"]>("tomatoes");
  const [environment, setEnvironment] = useState<Site["environment"]>("open-field");
  const [irrigationMethod, setIrrigationMethod] =
    useState<Site["irrigationMethod"]>("drip");
  const [soilType, setSoilType] = useState<Site["soilType"]>("loam");

  const loadAllWeather = async () => {
    const entries = await Promise.all(
      sites.map(async (site) => {
        const weather = await fetchWeatherForSite(site);
        return [site.id, weather] as const;
      })
    );

    setWeatherBySite((prev) => {
      const next = Object.fromEntries(entries);
      return next;
    });
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

  const siteProfiles = useMemo(() => {
    return sites
      .filter((site) => weatherBySite[site.id])
      .map((site) => {
        const recommendation = buildRecommendation(site, weatherBySite[site.id]);
        return { site, recommendation, weather: weatherBySite[site.id] };
      });
  }, [sites, weatherBySite]);

  const resetForm = () => {
    setSiteName("");
    setLocationLabel("");
    setLatitude("");
    setLongitude("");
    setAreaHa("0.25");
    setCropType("tomatoes");
    setEnvironment("open-field");
    setIrrigationMethod("drip");
    setSoilType("loam");
  };

  const handleAddSite = () => {
    const lat = Number(latitude);
    const lon = Number(longitude);
    const area = Number(areaHa);

    if (!siteName.trim()) {
      Alert.alert("Missing site name", "Please enter a site name.");
      return;
    }

    if (!locationLabel.trim()) {
      Alert.alert("Missing location label", "Please enter a location label.");
      return;
    }

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      Alert.alert("Invalid latitude", "Latitude must be a number between -90 and 90.");
      return;
    }

    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      Alert.alert(
        "Invalid longitude",
        "Longitude must be a number between -180 and 180."
      );
      return;
    }

    if (!Number.isFinite(area) || area <= 0) {
      Alert.alert("Invalid area", "Area must be a positive number in hectares.");
      return;
    }

    addCustomSite({
      name: siteName.trim(),
      locationLabel: locationLabel.trim(),
      latitude: lat,
      longitude: lon,
      cropType,
      environment,
      areaHa: area,
      irrigationMethod,
      soilType,
    });

    resetForm();
    Alert.alert("Site added", "Your custom site is now available across the app.");
  };

  const handleUseCurrentLocation = async () => {
    try {
      setLocating(true);

      const currentSite = await getCurrentLocationSite();

      addCustomSite({
        name: "My Current Site",
        locationLabel: currentSite.locationLabel,
        latitude: currentSite.latitude,
        longitude: currentSite.longitude,
        cropType: "tomatoes",
        environment: "open-field",
        areaHa: 0.25,
        irrigationMethod: "drip",
        soilType: "loam",
      });

      Alert.alert(
        "Location site added",
        `A new site was created for ${currentSite.locationLabel}.`
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to access the device location.";
      Alert.alert("Location unavailable", message);
    } finally {
      setLocating(false);
    }
  };

  const handleRemoveSite = (site: Site) => {
    if (isDefaultSite(site.id)) {
      Alert.alert(
        "Built-in site",
        "Demo sites cannot be removed in this version of the app."
      );
      return;
    }

    removeSite(site.id);
  };

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
          Operational site profiles with crop, irrigation, weather, and current action
          status.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Use current location</Text>
          <Text style={styles.helperText}>
            Create a site from your phone’s current position. This is useful for field
            demos, quick validation, and on-site decision support.
          </Text>

          <TouchableOpacity
            style={[styles.secondaryButton, locating && styles.secondaryButtonDisabled]}
            onPress={handleUseCurrentLocation}
            disabled={locating}
          >
            {locating ? (
              <View style={styles.buttonRow}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.secondaryButtonText}>Detecting location...</Text>
              </View>
            ) : (
              <Text style={styles.secondaryButtonText}>Use My Current Location</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Add a site manually</Text>

          <Text style={styles.inputLabel}>Site name</Text>
          <TextInput
            style={styles.input}
            value={siteName}
            onChangeText={setSiteName}
            placeholder="e.g. Prairie Tomato House"
            placeholderTextColor="#8A97AB"
          />

          <Text style={styles.inputLabel}>Location label</Text>
          <TextInput
            style={styles.input}
            value={locationLabel}
            onChangeText={setLocationLabel}
            placeholder="e.g. Thunder Bay, ON"
            placeholderTextColor="#8A97AB"
          />

          <View style={styles.twoCol}>
            <View style={styles.inputHalf}>
              <Text style={styles.inputLabel}>Latitude</Text>
              <TextInput
                style={styles.input}
                value={latitude}
                onChangeText={setLatitude}
                placeholder="48.3809"
                placeholderTextColor="#8A97AB"
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.inputHalf}>
              <Text style={styles.inputLabel}>Longitude</Text>
              <TextInput
                style={styles.input}
                value={longitude}
                onChangeText={setLongitude}
                placeholder="-89.2477"
                placeholderTextColor="#8A97AB"
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <Text style={styles.inputLabel}>Area (ha)</Text>
          <TextInput
            style={styles.input}
            value={areaHa}
            onChangeText={setAreaHa}
            placeholder="0.25"
            placeholderTextColor="#8A97AB"
            keyboardType="decimal-pad"
          />

          <OptionRow
            title="Crop"
            value={cropType}
            options={["tomatoes", "leafy-greens", "strawberries"]}
            onChange={setCropType}
          />

          <OptionRow
            title="Environment"
            value={environment}
            options={["open-field", "greenhouse"]}
            onChange={setEnvironment}
          />

          <OptionRow
            title="Irrigation"
            value={irrigationMethod}
            options={["drip", "sprinkler", "manual"]}
            onChange={setIrrigationMethod}
          />

          <OptionRow
            title="Soil"
            value={soilType}
            options={["sandy", "loam", "clay"]}
            onChange={setSoilType}
          />

          <TouchableOpacity style={styles.primaryButton} onPress={handleAddSite}>
            <Text style={styles.primaryButtonText}>Add Site</Text>
          </TouchableOpacity>
        </View>

        {siteProfiles.map(({ site, recommendation, weather }) => {
          const selected = selectedSiteId === site.id;

          return (
            <View key={site.id} style={styles.card}>
              <View style={styles.headerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{site.name}</Text>
                  <Text style={styles.cardSubtitle}>
                    {cropLabel(site.cropType)} · {site.locationLabel}
                  </Text>
                </View>

                <View style={styles.headerActions}>
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

                  {!isDefaultSite(site.id) ? (
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => handleRemoveSite(site)}
                    >
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </TouchableOpacity>
                  ) : null}
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

              <TouchableOpacity
                style={[styles.selectButton, selected && styles.selectButtonActive]}
                onPress={() => setSelectedSiteId(site.id)}
              >
                <Text
                  style={[
                    styles.selectButtonText,
                    selected && styles.selectButtonTextActive,
                  ]}
                >
                  {selected ? "Selected Site" : "Select Site"}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
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
  headerActions: {
    alignItems: "flex-end",
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
  helperText: {
    fontSize: 14,
    color: palette.muted,
    lineHeight: 21,
    marginTop: 6,
    marginBottom: 14,
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
  inputLabel: {
    fontSize: 13,
    color: palette.muted,
    marginBottom: 6,
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#F8FAFD",
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: palette.ink,
    marginBottom: 12,
  },
  inputHalf: {
    width: "48%",
  },
  optionGroup: {
    marginBottom: 12,
  },
  optionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  optionChip: {
    backgroundColor: "#F8FAFD",
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  optionChipActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  optionChipText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: "600",
  },
  optionChipTextActive: {
    color: "#FFFFFF",
  },
  primaryButton: {
    backgroundColor: palette.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 6,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    backgroundColor: "#0B1830",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonDisabled: {
    opacity: 0.8,
  },
  secondaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  removeButton: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#FDECEC",
    borderWidth: 1,
    borderColor: "#F5C2C2",
  },
  removeButtonText: {
    color: "#C43D3D",
    fontSize: 12,
    fontWeight: "700",
  },
  selectButton: {
    marginTop: 6,
    backgroundColor: "#0B1830",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  selectButtonActive: {
    backgroundColor: palette.accent,
  },
  selectButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  selectButtonTextActive: {
    color: "#FFFFFF",
  },
});