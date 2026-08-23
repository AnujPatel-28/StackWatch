import { randomUUID } from "node:crypto";
import type { NewSnapshotRecord, SnapshotRecord } from "./types";
import type { SnapshotRepository } from "./repository";

export class InMemorySnapshotRepository implements SnapshotRepository {
  private readonly records = new Map<string, SnapshotRecord[]>();

  async getLatestSnapshot(sourceUrl: string): Promise<SnapshotRecord | null> {
    const records = this.records.get(sourceUrl) ?? [];
    return records.at(-1) ?? null;
  }

  async saveSnapshot(snapshot: NewSnapshotRecord): Promise<SnapshotRecord> {
    const record: SnapshotRecord = { ...snapshot, id: randomUUID() };
    const records = this.records.get(snapshot.sourceUrl) ?? [];
    records.push(record);
    this.records.set(snapshot.sourceUrl, records);
    return record;
  }
}

