/** On-demand place search for the public browser demo. No account or API key required.
 * Photon searches OpenStreetMap place/address data. Open-Meteo provides a fallback
 * for city and postal-code searches if the public Photon demo is unavailable.
 * Calls happen only after the user submits a query, not on each keystroke.
 */
export type SearchPlace = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  source: "coordinates" | "openstreetmap" | "open-meteo";
};

function boundedCoordinate(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
}

export function parseCoordinates(query: string): SearchPlace | null {
  const match = query.trim().match(/^([+-]?(?:\d{1,3}(?:\.\d+)?|\.\d+))\s*[,;]\s*([+-]?(?:\d{1,3}(?:\.\d+)?|\.\d+))$/);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!boundedCoordinate(latitude, -90, 90) || !boundedCoordinate(longitude, -180, 180)) {
    throw new Error("Latitude must be -90 to 90 and longitude must be -180 to 180.");
  }
  return {
    id: "coords:" + latitude.toFixed(5) + "," + longitude.toFixed(5),
    label: latitude.toFixed(5) + "°, " + longitude.toFixed(5) + "°",
    latitude,
    longitude,
    source: "coordinates",
  };
}

function readable(value: unknown): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim().slice(0, 100) : "";
}

type PhotonFeature = {
  geometry?: { coordinates?: unknown };
  properties?: Record<string, unknown>;
};

async function searchPhoton(term: string, signal?: AbortSignal): Promise<SearchPlace[]> {
  const params = new URLSearchParams({ q: term, limit: "7", lang: "en" });
  const response = await fetch("https://photon.komoot.io/api/?" + params, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Place search temporarily unavailable.");
  const body = await response.json() as { features?: PhotonFeature[] };
  if (!Array.isArray(body.features)) throw new Error("Invalid place search response.");
  return body.features
    .map((feature, index): SearchPlace | null => {
      const coords = feature.geometry?.coordinates;
      if (!Array.isArray(coords) ||
        !boundedCoordinate(coords[0], -180, 180) ||
        !boundedCoordinate(coords[1], -90, 90)) return null;
      const props = feature.properties || {};
      const fragments = [
        [readable(props.name), readable(props.housenumber)].filter(Boolean).join(" "),
        readable(props.street), readable(props.city) || readable(props.town) || readable(props.village),
        readable(props.state), readable(props.country),
      ].filter(Boolean);
      const unique = fragments.filter((part, i) => fragments.indexOf(part) === i);
      const label = unique.join(", ");
      if (!label) return null;
      const longitude = coords[0] as number, latitude = coords[1] as number;
      return {
        id: "osm:" + readable(props.osm_id) + ":" + index,
        label, latitude, longitude, source: "openstreetmap",
      };
    })
    .filter((value): value is SearchPlace => value !== null);
}

async function searchOpenMeteo(term: string, signal?: AbortSignal): Promise<SearchPlace[]> {
  const params = new URLSearchParams({ name: term, count: "7", language: "en", format: "json" });
  const response = await fetch("https://geocoding-api.open-meteo.com/v1/search?" + params, { signal });
  if (!response.ok) throw new Error("Place search is unavailable. Enter latitude, longitude instead.");
  const body = await response.json() as { results?: Array<{
    id?: unknown; name?: unknown; latitude?: unknown; longitude?: unknown;
    admin1?: unknown; country?: unknown;
  }> };
  return (body.results || []).flatMap((item, index) => {
    if (!boundedCoordinate(item.latitude, -90, 90) ||
      !boundedCoordinate(item.longitude, -180, 180)) return [];
    return [{
      id: "meteo:" + String(item.id || index),
      label: [readable(item.name), readable(item.admin1), readable(item.country)].filter(Boolean).join(", "),
      latitude: item.latitude, longitude: item.longitude, source: "open-meteo" as const,
    }];
  });
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<SearchPlace[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) throw new Error("Enter a place, address, or latitude, longitude.");
  if (trimmed.length > 120) throw new Error("Search terms must be 120 characters or fewer.");
  const coordinates = parseCoordinates(trimmed);
  if (coordinates) return [coordinates];
  let places: SearchPlace[];
  try {
    places = await searchPhoton(trimmed, signal);
    if (places.length === 0) places = await searchOpenMeteo(trimmed, signal);
  } catch (error) {
    if (signal?.aborted) throw error;
    places = await searchOpenMeteo(trimmed, signal);
  }
  const seen = new Set<string>();
  return places.filter(item => {
    const key = item.latitude.toFixed(4) + ":" + item.longitude.toFixed(4);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 7);
}
