import type { DocumentationChange, DocumentationSnapshot } from "@/lib/types";

export interface ChangeDetector {
  compare(previous: DocumentationSnapshot | null, current: DocumentationSnapshot): Promise<DocumentationChange[]>;
}
