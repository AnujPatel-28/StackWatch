import type { ChangeReport } from "../change-detection/detect.ts";

function percentage(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function buildChangeMessage(sourceUrl: string, report: ChangeReport): string {
  const change = report.changes[0];
  const summary = change?.summary ?? "Meaningful documentation content changed.";
  const severity = change?.severity.toUpperCase() ?? "MEDIUM";
  return `🚨 StackWatch Documentation Change\n\nSource:\n${sourceUrl}\n\nChange:\n${summary}\n\nSeverity:\n${severity}\n\nRecommendation:\nReview integrations using the affected API.`;
}

export function buildDegradationMessage(sourceUrl: string, reason: string, qualityScore: number): string {
  return `⚠️ StackWatch Extraction Degraded\n\nSource:\n${sourceUrl}\n\nReason:\n${reason}\n\nQuality:\n${percentage(qualityScore)}\n\nThe scraper returned incomplete structured documentation. Healing can now be started.`;
}

export function buildRecoveryMessage(sourceUrl: string, previousQualityScore: number, currentQualityScore: number): string {
  return `✅ StackWatch Scraper Recovered\n\nSource:\n${sourceUrl}\n\nQuality:\n${percentage(previousQualityScore)} → ${percentage(currentQualityScore)}\n\nThe scraper was successfully repaired and re-run.`;
}
