import { InMemorySnapshotRepository } from "./in-memory-repository";
import { InsforgeSnapshotRepository } from "./insforge-repository";
import type { SnapshotRepository } from "./repository";

let developmentRepository: SnapshotRepository | undefined;

/** Selects persistence without coupling the scraper route to a database. */
export function createSnapshotRepositoryFromEnv(): SnapshotRepository {
  const configuredRepository = process.env.SNAPSHOT_REPOSITORY?.trim().toLowerCase();
  if (configuredRepository === "memory" || (!configuredRepository && process.env.NODE_ENV !== "production")) {
    developmentRepository ??= new InMemorySnapshotRepository();
    return developmentRepository;
  }
  if (configuredRepository === "insforge" || configuredRepository === "postgres" || configuredRepository === "postgresql") {
    const baseUrl = process.env.INSFORGE_URL;
    const apiKey = process.env.INSFORGE_API_KEY;
    if (!baseUrl) throw new Error("INSFORGE_URL is required when SNAPSHOT_REPOSITORY=insforge.");
    if (!apiKey) throw new Error("INSFORGE_API_KEY is required when SNAPSHOT_REPOSITORY=insforge.");
    return new InsforgeSnapshotRepository({ baseUrl, apiKey });
  }
  throw new Error("SNAPSHOT_REPOSITORY must be configured. Use memory for development or provide a production repository adapter.");
}
