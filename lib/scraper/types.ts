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
  pagesWithTitles: number;
  pagesWithSections: number;
  totalSections: number;
  totalApiEndpoints: number;
  totalCodeExamples: number;
  qualityScore: number;
  qualityStatus: ExtractionQualityStatus;
  explanation: string;
};

export type ScrapeApiResponse =
  | {
      success: true;
      quality: ExtractionQuality;
      snapshot: NormalizedDocumentationSnapshot;
    }
  | {
      success: false;
      error: string;
    };
