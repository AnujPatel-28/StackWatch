import type {
  NormalizedApiEndpoint,
  NormalizedCodeExample,
  NormalizedDocumentationPage,
  NormalizedDocumentationSnapshot,
  NormalizedSection,
} from "../scraper/types.ts";

export type DocumentationChangeType =
  | "page_added"
  | "page_removed"
  | "title_changed"
  | "description_changed"
  | "section_changed"
  | "api_change"
  | "code_example_changed";

export type ChangeSeverity = "low" | "medium" | "high";

export type DetectedChange = {
  type: DocumentationChangeType;
  page: string;
  summary: string;
  before: string;
  after: string;
  severity: ChangeSeverity;
};

export type ChangeReport = {
  changeDetected: boolean;
  changes: DetectedChange[];
};

const MAX_CHANGES = 25;
const EXCERPT_LENGTH = 240;

const SEVERITY_ORDER: Record<ChangeSeverity, number> = { high: 3, medium: 2, low: 1 };

const SEVERITY_BY_TYPE: Record<DocumentationChangeType, ChangeSeverity> = {
  page_removed: "high",
  api_change: "high",
  title_changed: "medium",
  section_changed: "medium",
  code_example_changed: "medium",
  page_added: "low",
  description_changed: "low",
};

function excerpt(value: string): string {
  const text = value.trim();
  return text.length <= EXCERPT_LENGTH ? text : `${text.slice(0, EXCERPT_LENGTH - 1)}\u2026`;
}

function change(type: DocumentationChangeType, page: string, summary: string, before: string, after: string): DetectedChange {
  return { type, page, summary, before: excerpt(before), after: excerpt(after), severity: SEVERITY_BY_TYPE[type] };
}

function pageLabel(page: NormalizedDocumentationPage): string {
  return page.title || page.url;
}

function sectionKey(section: NormalizedSection): string {
  return section.heading || section.content.slice(0, 60);
}

function endpointKey(endpoint: NormalizedApiEndpoint): string {
  return `${endpoint.method} ${endpoint.path}`.trim();
}

function exampleKey(example: NormalizedCodeExample): string {
  return example.label;
}

function indexBy<T>(items: T[], key: (item: T) => string): Map<string, T> {
  const index = new Map<string, T>();
  for (const item of items) {
    const itemKey = key(item);
    if (itemKey && !index.has(itemKey)) index.set(itemKey, item);
  }
  return index;
}

function comparePages(previous: NormalizedDocumentationPage, current: NormalizedDocumentationPage): DetectedChange[] {
  const label = pageLabel(current);
  const changes: DetectedChange[] = [];

  if (previous.title !== current.title) {
    changes.push(change("title_changed", label, "Page title changed.", previous.title, current.title));
  }
  if (previous.description !== current.description) {
    changes.push(change("description_changed", label, "Page description changed.", previous.description, current.description));
  }

  const previousSections = indexBy(previous.sections, sectionKey);
  const currentSections = indexBy(current.sections, sectionKey);
  for (const [key, section] of currentSections) {
    const before = previousSections.get(key);
    if (!before) changes.push(change("section_changed", label, `Section "${key}" was added.`, "", section.content));
    else if (before.content !== section.content) changes.push(change("section_changed", label, `Section "${key}" changed.`, before.content, section.content));
  }
  for (const [key, section] of previousSections) {
    if (!currentSections.has(key)) changes.push(change("section_changed", label, `Section "${key}" was removed.`, section.content, ""));
  }

  const previousEndpoints = indexBy(previous.apiEndpoints, endpointKey);
  const currentEndpoints = indexBy(current.apiEndpoints, endpointKey);
  for (const [key, endpoint] of currentEndpoints) {
    const before = previousEndpoints.get(key);
    if (!before) changes.push(change("api_change", label, `Endpoint ${key} was added.`, "", endpoint.description));
    else if (before.description !== endpoint.description) changes.push(change("api_change", label, `Endpoint ${key} changed.`, before.description, endpoint.description));
  }
  for (const [key, endpoint] of previousEndpoints) {
    if (!currentEndpoints.has(key)) changes.push(change("api_change", label, `Endpoint ${key} was removed.`, endpoint.description, ""));
  }

  const previousExamples = indexBy(previous.codeExamples, exampleKey);
  const currentExamples = indexBy(current.codeExamples, exampleKey);
  for (const [key, example] of currentExamples) {
    const before = previousExamples.get(key);
    if (!before) changes.push(change("code_example_changed", label, `Code example "${key}" was added.`, "", example.code));
    else if (before.code !== example.code) changes.push(change("code_example_changed", label, `Code example "${key}" changed.`, before.code, example.code));
  }
  for (const [key, example] of previousExamples) {
    if (!currentExamples.has(key)) changes.push(change("code_example_changed", label, `Code example "${key}" was removed.`, example.code, ""));
  }

  return changes;
}

export function detectDocumentationChanges(
  previous: NormalizedDocumentationSnapshot,
  current: NormalizedDocumentationSnapshot,
): ChangeReport {
  const previousPages = indexBy(previous.pages, (page) => page.url);
  const currentPages = indexBy(current.pages, (page) => page.url);
  const changes: DetectedChange[] = [];

  for (const [url, page] of currentPages) {
    const before = previousPages.get(url);
    if (!before) changes.push(change("page_added", pageLabel(page), `${url} was added to the documentation.`, "", page.description || page.title));
    else changes.push(...comparePages(before, page));
  }
  for (const [url, page] of previousPages) {
    if (!currentPages.has(url)) changes.push(change("page_removed", pageLabel(page), `${url} is no longer documented.`, page.description || page.title, ""));
  }

  const ranked = changes.sort((left, right) => SEVERITY_ORDER[right.severity] - SEVERITY_ORDER[left.severity]);
  return { changeDetected: ranked.length > 0, changes: ranked.slice(0, MAX_CHANGES) };
}
