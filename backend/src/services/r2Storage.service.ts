import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import {
  GetObjectCommand, PutObjectCommand, S3Client,
} from "@aws-sdk/client-s3";
import type { PublicPipelineRecord } from "./pipelineSnapshot.service";
import type { R2WeatherSample } from "./weatherPipeline.service";
import {
  MAX_ARCHIVE_BYTES, MAX_CURRENT_BYTES, R2_CURRENT_KEY,
  isFreshSnapshot, makeR2Snapshot, parseR2Snapshot,
  type R2CurrentSnapshot,
} from "./r2Snapshot.service";

type ReadMode = "off" | "shadow" | "primary";
const allowed = new Set(["off", "shadow", "primary"]);
const modeFromEnv = (value: string | undefined): ReadMode =>
  value && allowed.has(value) ? value as ReadMode : "off";

export const r2ReadMode = (): ReadMode => modeFromEnv(process.env.R2_READ_MODE);
export const r2WriteEnabled = () => process.env.R2_SYNC_ENABLED === "true";

export function r2Configured(): boolean {
  return ["R2_ACCOUNT_ID", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]
    .every(key => Boolean(process.env[key]));
}

let client: S3Client | null = null;
function storage(): { client: S3Client; bucket: string } {
  if (!r2Configured()) throw new Error("R2 credentials not configured");
  const accountId = process.env.R2_ACCOUNT_ID!;
  const bucket = process.env.R2_BUCKET!;
  if (!/^[a-f0-9]{32}$/i.test(accountId) || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) {
    throw new Error("R2 account or bucket configuration is invalid");
  }
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: "https://" + accountId + ".r2.cloudflarestorage.com",
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
      maxAttempts: 1,
      forcePathStyle: true,
    });
  }
  return { client, bucket };
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

let cachedUntil = 0;
let cached: R2CurrentSnapshot | null = null;
let pending: Promise<R2CurrentSnapshot> | null = null;

/**
 * Only ever GET the one compact current index on the public path.
 * A 5-minute process cache and the API's edge response cache control R2 reads.
 */
export async function readR2Current(): Promise<R2CurrentSnapshot> {
  if (cached && Date.now() < cachedUntil) return cached;
  if (pending) return pending;
  pending = (async () => {
    const { client: s3, bucket } = storage();
    const response = await s3.send(new GetObjectCommand({
      Bucket: bucket, Key: R2_CURRENT_KEY,
    }), { abortSignal: AbortSignal.timeout(8000) });
    if (!response.Body || (response.ContentLength ?? 0) > MAX_CURRENT_BYTES) {
      throw new Error("R2 index is empty or too large");
    }
    const bytes = Buffer.from(await response.Body.transformToByteArray());
    if (bytes.byteLength > MAX_CURRENT_BYTES) throw new Error("R2 index too large");
    if (response.Metadata?.sha256 && sha256(bytes) !== response.Metadata.sha256) {
      throw new Error("R2 index checksum mismatch");
    }
    const snapshot = parseR2Snapshot(JSON.parse(bytes.toString("utf8")) as unknown);
    cached = snapshot;
    cachedUntil = Date.now() + 5 * 60_000;
    return snapshot;
  })();
  try {
    return await pending;
  } finally {
    pending = null;
  }
}

export async function readFreshR2Current(): Promise<R2CurrentSnapshot> {
  const snapshot = await readR2Current();
  if (!isFreshSnapshot(snapshot)) throw new Error("R2 index is too old");
  return snapshot;
}

/**
 * Two bounded writes only: one compact daily gzip archive and one public index.
 * The index is published only AFTER the archive is read back and verified.
 * No automatic retries and no object listings in the request path.
 */
export async function writeDailyR2Snapshot(
  records: PublicPipelineRecord[], samples: R2WeatherSample[] = [],
): Promise<{
  archiveKey: string; archiveBytes: number; indexBytes: number;
}> {
  if (!r2WriteEnabled()) throw new Error("R2 synchronization is disabled");
  if (records.length < 1 || records.length > 20) throw new Error("R2 site count outside limits");
  if (samples.length !== records.length ||
      !records.every(record => samples.some(sample => sample.site.id === record.id))) {
    throw new Error("Incomplete daily weather archive: refusing to advance R2 index");
  }
  const now = new Date().toISOString();
  const day = now.slice(0, 10);
  const archiveKey = "irrigation/v1/live/" + day + "/snapshot.json.gz";
  const snapshot = makeR2Snapshot(records, now, archiveKey);
  const archive = gzipSync(Buffer.from(JSON.stringify({
    schemaVersion: 1, date: day, updatedAt: now, records,
    weatherSamples: samples.map(sample => ({
      site: sample.site,
      history: sample.history,
      forecast: sample.forecast,
      features: sample.model.features,
      estimatedRecommendation: {
        urgency: sample.model.urgency,
        recommendedMm: sample.model.mm,
        estimatedLitres: sample.model.liters,
        waterDeficitMm: sample.model.deficit,
        actionLabel: sample.model.action,
        reasons: sample.model.reasons,
      },
    })),
  })), { level: 6 });
  const index = Buffer.from(JSON.stringify(snapshot));
  if (archive.byteLength > MAX_ARCHIVE_BYTES || index.byteLength > MAX_CURRENT_BYTES) {
    throw new Error("R2 daily archive or index exceeds the fixed budget");
  }
  const { client: s3, bucket } = storage();
  const put = async (key: string, body: Buffer, compressed: boolean) => {
    const hash = sha256(body);
    await s3.send(new PutObjectCommand({
      Bucket: bucket, Key: key, Body: body,
      ContentType: "application/json",
      ...(compressed ? { ContentEncoding: "gzip" } : {}),
      CacheControl: "no-store", Metadata: { sha256: hash },
    }), { abortSignal: AbortSignal.timeout(8000) });
    const back = await s3.send(new GetObjectCommand({
      Bucket: bucket, Key: key,
    }), { abortSignal: AbortSignal.timeout(8000) });
    if (!back.Body || (back.ContentLength ?? 0) > MAX_CURRENT_BYTES) {
      throw new Error("R2 verification object missing or exceeds limit");
    }
    const bytes = Buffer.from(await back.Body.transformToByteArray());
    if (sha256(bytes) !== hash) throw new Error("R2 verification checksum mismatch");
  };
  await put(archiveKey, archive, true);
  await put(R2_CURRENT_KEY, index, false);
  cached = snapshot;
  cachedUntil = Date.now() + 5 * 60_000;
  return { archiveKey, archiveBytes: archive.byteLength, indexBytes: index.byteLength };
}
