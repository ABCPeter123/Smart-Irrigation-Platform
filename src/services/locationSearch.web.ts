/** On-demand place search for the public browser demo. No account or API key required.
 * Open-Meteo provides fast worldwide city and postal-code matching.
 * Photon supplements address search, but has a strict request deadline because
 * its public demo server can be slow or unavailable.
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

const searchCache = new Map<string, SearchPlace[]>();

function readable(value: unknown): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim().slice(0, 100) : "";
}

type PhotonFeature = {
  geometry?: { coordinates?: unknown };
  properties?: Record<string, unknown>;
};

async function searchPhoton(term: string, signal?: AbortSignal): Promise<SearchPlace[]> {
  const params = new URLSearchParams({ q: term, limit: "7", lang: "en" });
  const requestSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(3500)])
    : AbortSignal.timeout(3500);
  const response = await fetch("https://photon.komoot.io/api/?" + params, {
    signal: requestSignal,
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

function uniqueLocations(places: SearchPlace[]): SearchPlace[] {
  const seen = new Set<string>();
  return places.filter(place => {
    const key = place.latitude.toFixed(4) + ":" + place.longitude.toFixed(4);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 7);
}

/**
 * Browsers only search after explicit form submission. Place names resolve
 * quickly through Open-Meteo; for street addresses, try the more detailed
 * Photon search first, but never let its availability block city lookup.
 */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<SearchPlace[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) throw new Error("Enter a place, address, or latitude, longitude.");
  if (trimmed.length > 120) throw new Error("Search terms must be 120 characters or fewer.");
  const coordinates = parseCoordinates(trimmed);
  if (coordinates) return [coordinates];

  const cacheKey = trimmed.toLocaleLowerCase("en");
  const saved = searchCache.get(cacheKey);
  if (saved) return saved;

  const addressLike = /\d+\s+\S+|\b(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|drive)\b/i.test(trimmed);
  const attempts: Array<() => Promise<SearchPlace[]>> = [];

  if (addressLike) attempts.push(() => searchPhoton(trimmed, signal));
  attempts.push(() => searchOpenMeteo(trimmed, signal));

  // Many users type "Tokyo Japan" instead of "Tokyo, Japan", or a street
  // address containing a city. Try the city words if the full query misses.
  const pieces = trimmed.split(/\s+/).filter(Boolean);
  const variants = new Set<string>();
  if (trimmed.includes(",")) {
    const parts = trimmed.split(",").map(part => part.trim()).filter(Boolean);
    if (parts[0] && !/^\d/.test(parts[0])) variants.add(parts[0]);
    if (parts[1]) variants.add(parts[1]);
  }
  if (pieces.length > 1) variants.add(pieces.slice(0, -1).join(" "));
  if (pieces.length > 2) variants.add(pieces[pieces.length - 1]);
  variants.delete(trimmed);
  for (const term of variants) {
    if (term.length >= 2) attempts.push(() => searchOpenMeteo(term, signal));
  }

  if (!addressLike) attempts.push(() => searchPhoton(trimmed, signal));

  let lastError: unknown;
  for (const find of attempts) {
    if (signal?.aborted) throw new Error("Search cancelled");
    try {
      const places = uniqueLocations(await find());
      if (places.length) {
        searchCache.set(cacheKey, places);
        return places;
      }
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
    }
  }
  if (lastError) {
    throw new Error("Place search is temporarily unavailable. Try a town name or enter exact coordinates.");
  }
  searchCache.set(cacheKey, []);
  return [];
}
