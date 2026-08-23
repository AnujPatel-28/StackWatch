import type { NewSnapshotRecord, SnapshotRecord } from "./types";

export interface SnapshotRepository {
  getLatestSnapshot(sourceUrl: string): Promise<SnapshotRecord | null>;
  getLatestHealthySnapshot(sourceUrl: string): Promise<SnapshotRecord | null>;
  listSnapshots(sourceUrl: string, limit?: number): Promise<SnapshotRecord[]>;
  saveSnapshot(snapshot: NewSnapshotRecord): Promise<SnapshotRecord>;
}
