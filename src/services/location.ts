import * as Location from "expo-location";

export type CurrentLocationSiteResult = {
  latitude: number;
  longitude: number;
  locationLabel: string;
};

function buildFallbackLabel(latitude: number, longitude: number) {
  return `Current Location (${latitude.toFixed(3)}, ${longitude.toFixed(3)})`;
}

export async function getCurrentLocationSite(): Promise<CurrentLocationSiteResult> {
  const permission = await Location.requestForegroundPermissionsAsync();

  if (permission.status !== "granted") {
    throw new Error("Location permission was not granted.");
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const latitude = position.coords.latitude;
  const longitude = position.coords.longitude;

  let locationLabel = buildFallbackLabel(latitude, longitude);

  try {
    const results = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });

    if (results.length > 0) {
      const place = results[0];
      const parts = [place.city, place.region, place.country].filter(Boolean);

      if (parts.length > 0) {
        locationLabel = parts.join(", ");
      }
    }
  } catch {
    // Keep fallback label if reverse geocoding fails
  }

  return {
    latitude,
    longitude,
    locationLabel,
  };
}