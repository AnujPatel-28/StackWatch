import type { ID, Project } from "@/lib/types";

export interface ProjectStore {
  getById(id: ID): Promise<Project | null>;
  list(): Promise<Project[]>;
}
