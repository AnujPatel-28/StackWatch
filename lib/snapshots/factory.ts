import { InMemorySnapshotRepository } from "./in-memory-repository";
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
    throw new Error("A real snapshot repository is not implemented because InsForge/PostgreSQL configuration is not available yet.");
  }
  throw new Error("SNAPSHOT_REPOSITORY must be configured. Use memory for development or provide a production repository adapter.");
}
