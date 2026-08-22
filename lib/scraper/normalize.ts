import type {
  NormalizedApiEndpoint,
  NormalizedCodeExample,
  NormalizedDocumentationPage,
  NormalizedDocumentationSnapshot,
  NormalizedSection,
} from "./types";

type RecordValue = Record<string, unknown>;

function asRecord(value: unknown): RecordValue | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : value === null || value === undefined ? "" : String(value).trim();
}

function firstString(record: RecordValue, ...keys: string[]): string {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) return value;
  }
  return "";
}

function asRecordArray(value: unknown): RecordValue[] {
  return Array.isArray(value) ? value.map(asRecord).filter((item): item is RecordValue => item !== null) : [];
}

function asSections(value: unknown): NormalizedSection[] {
  if (!Array.isArray(value)) return [];
  return value.map((item): NormalizedSection | null => {
    if (typeof item === "string") return { heading: "", content: item.trim() };
    const record = asRecord(item);
    if (!record) return null;
    return {
      heading: firstString(record, "heading", "title", "name"),
      content: firstString(record, "content", "text", "body", "description"),
    };
  }).filter((item): item is NormalizedSection => item !== null && Boolean(item.heading || item.content));
}

function asApiEndpoints(value: unknown): NormalizedApiEndpoint[] {
  if (!Array.isArray(value)) return [];
  return value.map((item): NormalizedApiEndpoint | null => {
    const record = asRecord(item);
    if (!record) return null;
    return {
      method: firstString(record, "method", "httpMethod").toUpperCase(),
      path: firstString(record, "path", "url", "endpoint"),
      description: firstString(record, "description", "summary", "details"),
    };
  }).filter((item): item is NormalizedApiEndpoint => item !== null && Boolean(item.method || item.path || item.description));
}

function asCodeExamples(value: unknown): NormalizedCodeExample[] {
  if (!Array.isArray(value)) return [];
  return value.map((item): NormalizedCodeExample | null => {
    if (typeof item === "string") return { label: "Example", code: item.trim() };
    const record = asRecord(item);
    if (!record) return null;
    return {
      label: firstString(record, "label", "title", "language", "name") || "Example",
      code: firstString(record, "code", "content", "text", "snippet"),
    };
  }).filter((item): item is NormalizedCodeExample => item !== null && Boolean(item.code));
}

function unwrapRows(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  const record = asRecord(raw);
  if (!record) return [];
  for (const key of ["pages", "data", "results", "items", "records"]) {
    if (Array.isArray(record[key])) return record[key];
  }
  return [raw];
}

function normalizePage(raw: unknown, sourceUrl: string): NormalizedDocumentationPage | null {
  const record = asRecord(raw);
  if (!record) return null;
  const input = asRecord(record.input);
  return {
    url: firstString(record, "url", "sourceUrl", "pageUrl") || firstString(input ?? {}, "url") || sourceUrl,
    title: firstString(record, "title", "pageTitle", "name"),
    product: firstString(record, "product", "productName"),
    apiVersion: firstString(record, "apiVersion", "api_version", "version"),
    description: firstString(record, "description", "summary", "intro"),
    sections: asSections(record.sections),
    apiEndpoints: asApiEndpoints(record.apiEndpoints ?? record.api_endpoints),
    codeExamples: asCodeExamples(record.codeExamples ?? record.code_examples),
  };
}

export function normalizeBrightDataResult(raw: unknown, sourceUrl: string, capturedAt = new Date().toISOString()): NormalizedDocumentationSnapshot {
  const pages = unwrapRows(raw).map((row) => normalizePage(row, sourceUrl)).filter((page): page is NormalizedDocumentationPage => page !== null);
  return { sourceUrl, capturedAt, pages };
}
