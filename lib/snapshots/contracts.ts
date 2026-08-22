import type { DocumentationSnapshot, ID } from "@/lib/types";

export interface SnapshotStore {
  save(snapshot: DocumentationSnapshot): Promise<DocumentationSnapshot>;
  getLatest(sourceId: ID): Promise<DocumentationSnapshot | null>;
}
