export type ID = string;
export type ISODateString = string;

export type Technology = {
  id: ID;
  name: string;
  slug: string;
  ecosystem?: string;
  currentVersion?: string;
};

export type Project = {
  id: ID;
  name: string;
  slug: string;
  repositoryUrl?: string;
  technologies: Technology[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type DocumentationSource = {
  id: ID;
  projectId: ID;
  name: string;
  url: string;
  technologyId?: ID;
  kind: "official" | "reference" | "repository" | "other";
  status: "active" | "paused" | "error";
  createdAt: ISODateString;
};

export type DocumentationSnapshot = {
  id: ID;
  sourceId: ID;
  capturedAt: ISODateString;
  contentHash: string;
  pageCount: number;
  status: "complete" | "partial" | "failed";
};

export type ExtractionHealth = {
  sourceId: ID;
  status: "healthy" | "degraded" | "failed" | "unknown";
  coveragePercent?: number;
  checkedAt?: ISODateString;
  message?: string;
};

export type DocumentationChange = {
  id: ID;
  sourceId: ID;
  previousSnapshotId?: ID;
  currentSnapshotId: ID;
  detectedAt: ISODateString;
  category: "added" | "removed" | "modified" | "moved";
  summary: string;
  fingerprint: string;
};

export type ImpactAssessment = {
  id: ID;
  projectId: ID;
  changeId: ID;
  level: "none" | "low" | "medium" | "high" | "critical";
  confidence: number;
  summary: string;
  affectedFiles?: string[];
  assessedAt: ISODateString;
};

export type Recommendation = {
  id: ID;
  projectId: ID;
  impactAssessmentId?: ID;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: "open" | "accepted" | "dismissed" | "completed";
  createdAt: ISODateString;
};

export type Notification = {
  id: ID;
  projectId: ID;
  type: "change" | "impact" | "system";
  channel: "telegram" | "email" | "webhook";
  status: "pending" | "sent" | "failed" | "disabled";
  subject: string;
  sentAt?: ISODateString;
  createdAt: ISODateString;
};
