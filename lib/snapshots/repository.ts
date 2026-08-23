import type { NewSnapshotRecord, SnapshotRecord } from "./types";

export interface SnapshotRepository {
  getLatestSnapshot(sourceUrl: string): Promise<SnapshotRecord | null>;
  saveSnapshot(snapshot: NewSnapshotRecord): Promise<SnapshotRecord>;
}

