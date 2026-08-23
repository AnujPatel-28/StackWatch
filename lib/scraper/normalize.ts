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
  return typeof value === "string" ? value.trim() : "";
}

function firstString(record: RecordValue, ...keys: string[]): string {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) return value;
  }
  return "";
}

function canonicalizeUrl(value: string): string {
  const candidate = asString(value);
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    url.hash = "";
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return candidate.replace(/#.*$/, "").replace(/\/+$/, "");
  }
}

function asSections(value: unknown): NormalizedSection[] {
  if (!Array.isArray(value)) return [];
  return value.map((item): NormalizedSection | null => {
    if (typeof item === "string") {
      const content = item.trim();
      return content ? { heading: "", content } : null;
    }
    const record = asRecord(item);
    if (!record) return null;
    const content = firstString(record, "content", "text", "body", "description");
    return content ? { heading: firstString(record, "heading", "title", "name"), content } : null;
  }).filter((item): item is NormalizedSection => item !== null);
}

function asApiEndpoints(value: unknown): NormalizedApiEndpoint[] {
  if (!Array.isArray(value)) return [];
  const endpoints = new Map<string, NormalizedApiEndpoint>();
  value.forEach((item): void => {
    const record = asRecord(item);
    if (!record) return;
    const endpoint = {
      method: firstString(record, "method", "httpMethod").toUpperCase(),
      path: firstString(record, "path", "url", "endpoint"),
      description: firstString(record, "description", "summary", "details"),
    };
    if (!endpoint.method && !endpoint.path && !endpoint.description) return;
    const key = endpoint.method || endpoint.path ? `${endpoint.method}|${endpoint.path}` : endpoint.description;
    if (!endpoints.has(key)) endpoints.set(key, endpoint);
  });
  return [...endpoints.values()];
}

function asCodeExamples(value: unknown): NormalizedCodeExample[] {
  if (!Array.isArray(value)) return [];
  const examples = new Map<string, NormalizedCodeExample>();
  value.forEach((item): void => {
    const record = asRecord(item);
    const code = typeof item === "string" ? item.trim() : record ? firstString(record, "code", "content", "text", "snippet") : "";
    if (!code) return;
    const example = { label: record ? firstString(record, "label", "title", "language", "name") || "Example" : "Example", code };
    const key = `${example.label}|${example.code}`;
    if (!examples.has(key)) examples.set(key, example);
  });
  return [...examples.values()];
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

function mergePages(existing: NormalizedDocumentationPage, incoming: NormalizedDocumentationPage): NormalizedDocumentationPage {
  return {
    url: existing.url,
    title: existing.title || incoming.title,
    product: existing.product || incoming.product,
    apiVersion: existing.apiVersion || incoming.apiVersion,
    description: existing.description || incoming.description,
    sections: [...existing.sections, ...incoming.sections],
    apiEndpoints: asApiEndpoints([...existing.apiEndpoints, ...incoming.apiEndpoints]),
    codeExamples: asCodeExamples([...existing.codeExamples, ...incoming.codeExamples]),
  };
}

function normalizePage(raw: unknown, sourceUrl: string): NormalizedDocumentationPage | null {
  const record = asRecord(raw);
  if (!record) return null;
  const input = asRecord(record.input);
  const rawUrl = firstString(record, "url", "sourceUrl", "pageUrl", "product_page_url") || firstString(input ?? {}, "url");
  const page = {
    url: canonicalizeUrl(rawUrl || sourceUrl),
    title: firstString(record, "title", "pageTitle", "page_title", "name"),
    product: firstString(record, "product", "productName"),
    apiVersion: firstString(record, "apiVersion", "api_version", "version"),
    description: firstString(record, "description", "summary", "intro"),
    sections: asSections(record.sections),
    apiEndpoints: asApiEndpoints(record.apiEndpoints ?? record.api_endpoints),
    codeExamples: asCodeExamples(record.codeExamples ?? record.code_examples),
  };
  const hasMeaningfulContent = Boolean(page.title || page.description || page.sections.length || page.apiEndpoints.length || page.codeExamples.length);
  if (!rawUrl || !hasMeaningfulContent) return null;
  if (!page.url) return null;
  return page;
}

export function normalizeBrightDataResult(raw: unknown, sourceUrl: string, capturedAt = new Date().toISOString()): NormalizedDocumentationSnapshot {
  const pagesByUrl = new Map<string, NormalizedDocumentationPage>();
  for (const row of unwrapRows(raw)) {
    const page = normalizePage(row, sourceUrl);
    if (!page) continue;
    const existing = pagesByUrl.get(page.url);
    pagesByUrl.set(page.url, existing ? mergePages(existing, page) : page);
  }
  const canonicalSourceUrl = canonicalizeUrl(sourceUrl) || sourceUrl;
  const pages = [...pagesByUrl.values()].sort((left, right) => {
    if (left.url === canonicalSourceUrl) return -1;
    if (right.url === canonicalSourceUrl) return 1;
    return left.url.localeCompare(right.url);
  });
  return { sourceUrl: canonicalSourceUrl, capturedAt, pages };
}
