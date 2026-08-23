import "server-only";

import { createAdminClient, type InsForgeClient } from "@insforge/sdk";
import type { ExtractionQuality, NormalizedDocumentationSnapshot } from "@/lib/scraper/types";
import type { NewSnapshotRecord, SnapshotRecord } from "./types";
import type { SnapshotRepository } from "./repository";

const SNAPSHOT_TABLE = "snapshot_records";
const SNAPSHOT_COLUMNS = "id, source_url, created_at, quality_status, normalized_snapshot, quality";

type SnapshotDatabaseRow = {
  id: string;
  source_url: string;
  created_at: string;
  quality_status: "healthy" | "partial" | "degraded";
  normalized_snapshot: NormalizedDocumentationSnapshot;
  quality: ExtractionQuality;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toSnapshotRecord(value: unknown): SnapshotRecord {
  if (!isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.source_url !== "string" ||
    typeof value.created_at !== "string" ||
    !isRecord(value.normalized_snapshot) ||
    !isRecord(value.quality)) {
    throw new Error("InsForge returned an invalid snapshot record.");
  }

  return {
    id: value.id,
    sourceUrl: value.source_url,
    createdAt: value.created_at,
    normalizedSnapshot: value.normalized_snapshot as NormalizedDocumentationSnapshot,
    quality: value.quality as ExtractionQuality,
  };
}

function databaseError(operation: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : "Unknown database error.";
  return new Error(`InsForge snapshot ${operation} failed: ${message}`);
}

export type InsforgeSnapshotRepositoryOptions = {
  baseUrl: string;
  apiKey: string;
  client?: Pick<InsForgeClient, "database">;
};

export class InsforgeSnapshotRepository implements SnapshotRepository {
  private readonly database: InsForgeClient["database"];

  constructor(options: InsforgeSnapshotRepositoryOptions) {
    this.database = options.client?.database ?? createAdminClient({
      baseUrl: options.baseUrl,
      apiKey: options.apiKey,
    }).database;
  }

  async getLatestSnapshot(sourceUrl: string): Promise<SnapshotRecord | null> {
    return this.findLatest(sourceUrl);
  }

  async getLatestHealthySnapshot(sourceUrl: string): Promise<SnapshotRecord | null> {
    return this.findLatest(sourceUrl, "healthy");
  }

  async listSnapshots(sourceUrl: string, limit = 10): Promise<SnapshotRecord[]> {
    const { data, error } = await this.database
      .from(SNAPSHOT_TABLE)
      .select(SNAPSHOT_COLUMNS)
      .eq("source_url", sourceUrl)
      .neq("quality_status", "failed")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit);
    if (error) throw databaseError("history lookup", error);
    return Array.isArray(data) ? data.map(toSnapshotRecord) : [];
  }

  private async findLatest(sourceUrl: string, qualityStatus?: "healthy"): Promise<SnapshotRecord | null> {
    const scoped = this.database
      .from(SNAPSHOT_TABLE)
      .select(SNAPSHOT_COLUMNS)
      .eq("source_url", sourceUrl);
    const filtered = qualityStatus ? scoped.eq("quality_status", qualityStatus) : scoped.neq("quality_status", "failed");
    const { data, error } = await filtered
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1);

    if (error) throw databaseError("lookup", error);
    const row = Array.isArray(data) ? data[0] : undefined;
    return row === undefined ? null : toSnapshotRecord(row);
  }

  async saveSnapshot(snapshot: NewSnapshotRecord): Promise<SnapshotRecord> {
    if (snapshot.quality.qualityStatus === "failed") {
      throw new Error("Failed snapshots cannot be persisted as baselines.");
    }

    const { data, error } = await this.database
      .from(SNAPSHOT_TABLE)
      .insert([{
        source_url: snapshot.sourceUrl,
        created_at: snapshot.createdAt,
        quality_status: snapshot.quality.qualityStatus,
        normalized_snapshot: snapshot.normalizedSnapshot,
        quality: snapshot.quality,
      }])
      .select(SNAPSHOT_COLUMNS)
      .limit(1);

    if (error) throw databaseError("save", error);
    const row = Array.isArray(data) ? data[0] : undefined;
    if (row === undefined) throw new Error("InsForge did not return the saved snapshot record.");
    return toSnapshotRecord(row);
  }
}
