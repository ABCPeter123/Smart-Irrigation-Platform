import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSiteContext } from "../src/context/SiteContext";
import {
  BackendRecommendationResponse,
  fetchBackendRecommendation,
} from "../src/services/api";
import { getCurrentLocationSite } from "../src/services/location";
import { Site } from "../src/types";

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

const statusColor = (urgency?: string) => {
  if (urgency === "High") return palette.high;
  if (urgency === "Medium") return palette.medium;
  if (urgency === "Low") return palette.good;
  return palette.muted;
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
                style={[
                  styles.optionChipText,
                  active && styles.optionChipTextActive,
                ]}
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
  const scrollViewRef = useRef<ScrollView>(null);

  const {
    sites,
    selectedSiteId,
    setSelectedSiteId,
    addCustomSite,
    updateSite,
    removeSite,
    loadingSites,
    sitesError,
    refreshSites,
  } = useSiteContext();

  const [statusBySite, setStatusBySite] = useState<
    Record<string, BackendRecommendationResponse>
  >({});
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [locating, setLocating] = useState(false);
  const [savingSite, setSavingSite] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);

  const [siteName, setSiteName] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [areaHa, setAreaHa] = useState("0.25");
  const [cropType, setCropType] = useState<Site["cropType"]>("tomatoes");
  const [environment, setEnvironment] =
    useState<Site["environment"]>("open-field");
  const [irrigationMethod, setIrrigationMethod] =
    useState<Site["irrigationMethod"]>("drip");
  const [soilType, setSoilType] = useState<Site["soilType"]>("loam");

  const editingSite = useMemo(() => {
    if (!editingSiteId) return null;
    return sites.find((site) => site.id === editingSiteId) ?? null;
  }, [editingSiteId, sites]);

  const loadSiteStatuses = async () => {
    if (sites.length === 0) {
      setStatusBySite({});
      return;
    }

    try {
      setLoadingStatus(true);

      const entries = await Promise.all(
        sites.map(async (site) => {
          const recommendation = await fetchBackendRecommendation(site.id);
          return [site.id, recommendation] as const;
        })
      );

      setStatusBySite(Object.fromEntries(entries));
    } catch {
      setStatusBySite({});
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    loadSiteStatuses();
  }, [sites]);

  const siteProfiles = useMemo(() => {
    return sites.map((site) => ({
      site,
      backendData: statusBySite[site.id],
    }));
  }, [sites, statusBySite]);

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await refreshSites();
      await loadSiteStatuses();
    } finally {
      setRefreshing(false);
    }
  };

  const resetForm = () => {
    setEditingSiteId(null);
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

  const fillFormFromSite = (site: Site) => {
    setEditingSiteId(site.id);
    setSiteName(site.name);
    setLocationLabel(site.locationLabel);
    setLatitude(String(site.latitude));
    setLongitude(String(site.longitude));
    setAreaHa(String(site.areaHa));
    setCropType(site.cropType);
    setEnvironment(site.environment);
    setIrrigationMethod(site.irrigationMethod);
    setSoilType(site.soilType);

    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({
        y: 0,
        animated: true,
      });
    });
  };

  const validateForm = () => {
    const lat = Number(latitude);
    const lon = Number(longitude);
    const area = Number(areaHa);

    if (!siteName.trim()) {
      Alert.alert("Missing site name", "Please enter a site name.");
      return null;
    }

    if (!locationLabel.trim()) {
      Alert.alert("Missing location label", "Please enter a location label.");
      return null;
    }

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      Alert.alert(
        "Invalid latitude",
        "Latitude must be a number between -90 and 90."
      );
      return null;
    }

    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      Alert.alert(
        "Invalid longitude",
        "Longitude must be a number between -180 and 180."
      );
      return null;
    }

    if (!Number.isFinite(area) || area <= 0) {
      Alert.alert("Invalid area", "Area must be a positive number in hectares.");
      return null;
    }

    return {
      name: siteName.trim(),
      locationLabel: locationLabel.trim(),
      latitude: lat,
      longitude: lon,
      cropType,
      environment,
      areaHa: area,
      irrigationMethod,
      soilType,
      connectedProbes: editingSite?.connectedProbes ?? 0,
    };
  };

  const handleSaveSite = async () => {
    const payload = validateForm();

    if (!payload) {
      return;
    }

    try {
      setSavingSite(true);

      if (editingSiteId) {
        await updateSite(editingSiteId, payload);
        Alert.alert("Site updated", "Your site changes were saved.");
      } else {
        await addCustomSite(payload);
        Alert.alert("Site added", "Your site was saved to the backend database.");
      }

      resetForm();
      await loadSiteStatuses();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save the site.";

      Alert.alert("Site save failed", message);
    } finally {
      setSavingSite(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    try {
      setLocating(true);

      const currentSite = await getCurrentLocationSite();

      await addCustomSite({
        name: "My Current Site",
        locationLabel: currentSite.locationLabel,
        latitude: currentSite.latitude,
        longitude: currentSite.longitude,
        cropType: "tomatoes",
        environment: "open-field",
        areaHa: 0.25,
        irrigationMethod: "drip",
        soilType: "loam",
        connectedProbes: 0,
      });

      Alert.alert(
        "Location site added",
        `A backend site was created for ${currentSite.locationLabel}.`
      );

      await loadSiteStatuses();
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

  const handleRemoveSite = async (site: Site) => {
    try {
      await removeSite(site.id);

      if (editingSiteId === site.id) {
        resetForm();
      }

      Alert.alert("Site removed", `${site.name} was removed from the backend.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to remove the site.";

      Alert.alert("Remove failed", message);
    }
  };

  if (loadingSites) {
    return (
      <SafeAreaView style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={palette.accent} />
        <Text style={styles.loadingText}>Loading backend site profiles...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.title}>Sites</Text>
        <Text style={styles.subtitle}>
          Manage backend site profiles, select the active site, and create new
          field or greenhouse records.
        </Text>

        {sitesError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Could not load backend sites</Text>
            <Text style={styles.errorText}>{sitesError}</Text>

            <TouchableOpacity style={styles.primaryButton} onPress={refreshSites}>
              <Text style={styles.primaryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Use current location</Text>
          <Text style={styles.helperText}>
            Create a backend site from your phone’s current position. You can
            adjust crop and irrigation details later.
          </Text>

          <TouchableOpacity
            style={[
              styles.secondaryButton,
              locating && styles.secondaryButtonDisabled,
            ]}
            onPress={handleUseCurrentLocation}
            disabled={locating}
          >
            {locating ? (
              <View style={styles.buttonRow}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.secondaryButtonText}>
                  Detecting location...
                </Text>
              </View>
            ) : (
              <Text style={styles.secondaryButtonText}>
                Use My Current Location
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.formHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>
                {editingSiteId ? "Edit site" : "Add a site manually"}
              </Text>

              {editingSite ? (
                <Text style={styles.cardSubtitle}>
                  Editing {editingSite.name}
                </Text>
              ) : null}
            </View>

            {editingSiteId ? (
              <TouchableOpacity style={styles.cancelEditButton} onPress={resetForm}>
                <Text style={styles.cancelEditText}>Cancel</Text>
              </TouchableOpacity>
            ) : null}
          </View>

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

          <Text style={styles.inputLabel}>Area, ha</Text>
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

          <TouchableOpacity
            style={[
              styles.primaryButton,
              savingSite && styles.secondaryButtonDisabled,
            ]}
            onPress={handleSaveSite}
            disabled={savingSite}
          >
            <Text style={styles.primaryButtonText}>
              {savingSite
                ? "Saving..."
                : editingSiteId
                ? "Save Changes"
                : "Add Site"}
            </Text>
          </TouchableOpacity>
        </View>

        {loadingStatus ? (
          <View style={styles.card}>
            <ActivityIndicator size="small" color={palette.accent} />
            <Text style={styles.helperText}>Loading site status badges...</Text>
          </View>
        ) : null}

        {siteProfiles.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No sites yet</Text>
            <Text style={styles.helperText}>
              Add a site manually or use your current location to create the
              first backend site.
            </Text>
          </View>
        ) : null}

        {siteProfiles.map(({ site, backendData }) => {
          const selected = selectedSiteId === site.id;
          const urgency = backendData?.recommendation.urgency;
          const color = statusColor(urgency);

          return (
            <View key={site.id} style={styles.card}>
              <View style={styles.headerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{site.name}</Text>
                  <Text style={styles.cardSubtitle}>{site.locationLabel}</Text>
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
                  <Text style={[styles.pillText, { color }]}>
                    {urgency ?? "No status"}
                  </Text>
                </View>
              </View>

              <View style={styles.twoCol}>
                <InfoCard label="Crop" value={cropLabel(site.cropType)} />
                <InfoCard label="Environment" value={site.environment} />
              </View>

              <View style={styles.twoCol}>
                <InfoCard label="Area" value={`${site.areaHa} ha`} />
                <InfoCard label="Soil" value={site.soilType} />
              </View>

              <View style={styles.twoCol}>
                <InfoCard label="Irrigation" value={site.irrigationMethod} />
                <InfoCard
                  label="Backend ID"
                  value={`${site.id.slice(0, 8)}...`}
                  subvalue="PostgreSQL"
                />
              </View>

              <TouchableOpacity
                style={[styles.selectButton, selected && styles.selectButtonActive]}
                onPress={() => setSelectedSiteId(site.id)}
              >
                <Text style={styles.selectButtonText}>
                  {selected ? "Selected Site" : "Select Site"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.detailButton}
                onPress={() => router.push(`/site/${site.id}`)}
              >
                <Text style={styles.detailButtonText}>View Details</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.editButton}
                onPress={() => fillFormFromSite(site)}
              >
                <Text style={styles.editButtonText}>Edit Site</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemoveSite(site)}
              >
                <Text style={styles.removeButtonText}>Remove Site</Text>
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
  formHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
    gap: 12,
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
  detailButton: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#F8FAFD",
    borderWidth: 1,
    borderColor: "#D9E1EE",
    alignItems: "center",
  },
  detailButtonText: {
    color: "#0B1830",
    fontSize: 14,
    fontWeight: "700",
  },
  editButton: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    alignItems: "center",
  },
  editButtonText: {
    color: "#1D4ED8",
    fontSize: 14,
    fontWeight: "700",
  },
  cancelEditButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  cancelEditText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
  },
  removeButton: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#FDECEC",
    borderWidth: 1,
    borderColor: "#F5C2C2",
    alignItems: "center",
  },
  removeButtonText: {
    color: "#C43D3D",
    fontSize: 14,
    fontWeight: "700",
  },
  errorBox: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#991B1B",
    marginBottom: 6,
  },
  errorText: {
    fontSize: 14,
    color: "#991B1B",
    lineHeight: 20,
    marginBottom: 10,
  },
});