import type { PublicPipelineRecord } from "./pipelineSnapshot.service";

export const R2_CURRENT_KEY = "irrigation/v1/current.json";
export const MAX_CURRENT_BYTES = 64 * 1024;
export const MAX_ARCHIVE_BYTES = 64 * 1024;

export type R2CurrentSnapshot = {
  schemaVersion: 1;
  status: "ready";
  source: string;
  updatedAt?: string;
  archiveKey?: string;
  manifestKey?: string;
  exportId?: string;
  records: PublicPipelineRecord[];
};

const object = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);
const validNumber = (x: unknown) => typeof x === "number" && Number.isFinite(x);
const nullableNumber = (x: unknown) => x === null || validNumber(x);
const text = (x: unknown) => typeof x === "string" && x.length > 0 && x.length < 300;

function isPublicRecord(value: unknown): value is PublicPipelineRecord {
  if (!object(value)) return false;
  return (
    text(value.id) && String(value.id).startsWith("demo-") &&
    text(value.name) &&
    validNumber(value.latitude) && Math.abs(value.latitude as number) <= 90 &&
    validNumber(value.longitude) && Math.abs(value.longitude as number) <= 180 &&
    validNumber(value.areaHa) && (value.areaHa as number) > 0 &&
    text(value.cropType) && text(value.soilType) && text(value.irrigationMethod) &&
    (value.forecastDate === null ||
      (typeof value.forecastDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.forecastDate))) &&
    (value.updatedAt === null ||
      (typeof value.updatedAt === "string" && Number.isFinite(Date.parse(value.updatedAt)))) &&
    (value.urgency === null || text(value.urgency)) &&
    (value.actionLabel === null || text(value.actionLabel)) &&
    nullableNumber(value.recommendedMm) && nullableNumber(value.estimatedLitres) &&
    nullableNumber(value.dataCompletenessPct) && nullableNumber(value.waterDeficitMm) &&
    (value.modelVersion === null || text(value.modelVersion))
  );
}

export function parseR2Snapshot(raw: unknown): R2CurrentSnapshot {
  if (!object(raw) || raw.schemaVersion !== 1 || raw.status !== "ready" ||
      !text(raw.source) || !Array.isArray(raw.records) || raw.records.length > 20 ||
      !raw.records.every(isPublicRecord)) {
    throw new Error("Unsupported or invalid R2 public snapshot");
  }
  const ids = raw.records.map(row => row.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Duplicate public site ID in R2 snapshot");
  }
  if (raw.updatedAt !== undefined &&
      (typeof raw.updatedAt !== "string" || !Number.isFinite(Date.parse(raw.updatedAt)))) {
    throw new Error("Invalid R2 snapshot timestamp");
  }
  return raw as R2CurrentSnapshot;
}

export function makeR2Snapshot(
  records: PublicPipelineRecord[],
  updatedAt: string,
  archiveKey: string,
): R2CurrentSnapshot {
  return parseR2Snapshot({
    schemaVersion: 1, status: "ready", source: "r2-weather-snapshot",
    updatedAt, archiveKey, records,
  });
}

/**
 * Never serve an unboundedly stale R2 snapshot as the primary data source.
 * Older export artifacts can still be used for shadow comparison.
 */
export function isFreshSnapshot(snapshot: R2CurrentSnapshot, now = Date.now()): boolean {
  const timestamp = snapshot.updatedAt
    ? Date.parse(snapshot.updatedAt)
    : Math.max(0, ...snapshot.records.map(r => r.updatedAt ? Date.parse(r.updatedAt) : 0));
  return Number.isFinite(timestamp) && timestamp <= now + 5 * 60_000 &&
    now - timestamp <= 36 * 60 * 60_000;
}

const comparable = (r: PublicPipelineRecord) => ({
  id: r.id, name: r.name, latitude: r.latitude, longitude: r.longitude,
  areaHa: r.areaHa, cropType: r.cropType, soilType: r.soilType,
  irrigationMethod: r.irrigationMethod, forecastDate: r.forecastDate,
  urgency: r.urgency, actionLabel: r.actionLabel,
  recommendedMm: r.recommendedMm, estimatedLitres: r.estimatedLitres,
  dataCompletenessPct: r.dataCompletenessPct, waterDeficitMm: r.waterDeficitMm,
  modelVersion: r.modelVersion, reasons: r.reasons,
});

/** Stable parity check that ignores ephemeral generated-at timestamps. */
export function comparePublicRecords(
  neon: PublicPipelineRecord[],
  r2: PublicPipelineRecord[],
): { matched: boolean; neonCount: number; r2Count: number; mismatchedSites: string[] } {
  const byId = new Map(r2.map(row => [row.id, row]));
  const mismatchedSites = neon
    .filter(record => {
      const candidate = byId.get(record.id);
      return !candidate || JSON.stringify(comparable(record)) !== JSON.stringify(comparable(candidate));
    }).map(record => record.id);
  for (const row of r2) {
    if (!neon.some(n => n.id === row.id)) mismatchedSites.push(row.id);
  }
  return { matched: mismatchedSites.length === 0,
    neonCount: neon.length, r2Count: r2.length, mismatchedSites };
}
