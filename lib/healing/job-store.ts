import { randomUUID } from "node:crypto";
import type { BrightDataHealProgress } from "../scraper/bright-data-heal";

export type HealingState = "healing" | "awaiting_approval" | "rerunning" | "recovered" | "failed";

export type HealingJob = {
  id: string;
  sourceUrl: string;
  prompt: string;
  state: HealingState;
  previousQualityScore?: number;
  currentQualityScore?: number;
  progress?: BrightDataHealProgress;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

type HealingStore = Map<string, HealingJob>;

function store(): HealingStore {
  const root = globalThis as typeof globalThis & { __stackwatchHealingStore?: HealingStore };
  root.__stackwatchHealingStore ??= new Map<string, HealingJob>();
  return root.__stackwatchHealingStore;
}

export function createHealingJob(input: Pick<HealingJob, "sourceUrl" | "prompt" | "previousQualityScore">): HealingJob {
  const now = new Date().toISOString();
  const job: HealingJob = { id: randomUUID(), ...input, state: "healing", createdAt: now, updatedAt: now };
  store().set(job.id, job);
  return job;
}

export function getHealingJob(jobId: string): HealingJob | null {
  return store().get(jobId) ?? null;
}

export function updateHealingJob(jobId: string, patch: Partial<Omit<HealingJob, "id" | "sourceUrl" | "prompt" | "createdAt">>): HealingJob | null {
  const existing = store().get(jobId);
  if (!existing) return null;
  const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  store().set(jobId, updated);
  return updated;
}
