import type { DocumentationChange, ImpactAssessment, Project } from "@/lib/types";

export interface ImpactAnalyzer {
  assess(project: Project, change: DocumentationChange): Promise<ImpactAssessment>;
}
