import type { ChangeReport } from "../change-detection/detect.ts";
import type { TelegramDelivery } from "../notifications/telegram";

export type NormalizedSection = {
  heading: string;
  content: string;
};

export type NormalizedApiEndpoint = {
  method: string;
  path: string;
  description: string;
};

export type NormalizedCodeExample = {
  label: string;
  code: string;
};

export type NormalizedDocumentationPage = {
  url: string;
  title: string;
  product: string;
  apiVersion: string;
  description: string;
  sections: NormalizedSection[];
  apiEndpoints: NormalizedApiEndpoint[];
  codeExamples: NormalizedCodeExample[];
};

export type NormalizedDocumentationSnapshot = {
  sourceUrl: string;
  capturedAt: string;
  pages: NormalizedDocumentationPage[];
};

export type ExtractionQualityStatus = "healthy" | "partial" | "degraded" | "failed";

export type ExtractionQuality = {
  pagesFound: number;
  uniquePages: number;
  pagesWithTitles: number;
  pagesWithSections: number;
  pagesWithMeaningfulContent: number;
  pagesWithDescriptions: number;
  totalSections: number;
  totalApiEndpoints: number;
  totalCodeExamples: number;
  structuredContentCount: number;
  titleCoverage: number;
  meaningfulContentCoverage: number;
  descriptionCoverage: number;
  structuredContentCoverage: number;
  qualityScore: number;
  qualityStatus: ExtractionQualityStatus;
  explanation: string;
  degradationReason?: string;
};

export type ScrapeRunStatus = "baseline" | "unchanged" | "changed" | "partial" | "degraded" | "failed";

export type ScrapeComparisonMetadata = {
  runStatus: ScrapeRunStatus;
  changeReport?: ChangeReport;
  hasBaseline: boolean;
  previousSnapshotId?: string;
  baselineSnapshotId?: string;
  currentSnapshotId?: string;
  snapshotSaved: boolean;
  changeDetected: boolean;
  degradationReason?: string;
};

export type ScrapeApiResponse =
  | {
      success: true;
      quality: ExtractionQuality;
      snapshot: NormalizedDocumentationSnapshot;
      comparison: ScrapeComparisonMetadata;
      notification?: TelegramDelivery;
    }
  | {
      success: false;
      error: string;
    };
