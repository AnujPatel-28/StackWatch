import { BrightDataApiError } from "./bright-data-client.ts";

const BRIGHT_DATA_API = "https://api.brightdata.com";

export type BrightDataHealProgress = {
  status: string;
  step?: string;
  completedSteps?: string[];
  previewResult?: unknown;
  payload: unknown;
};

export type BrightDataHealClientOptions = {
  apiKey: string;
  collectorId: string;
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  pollIntervalMs?: number;
};

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text) as unknown; } catch { return text; }
}

function progressFrom(payload: unknown): BrightDataHealProgress {
  const record = payload !== null && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
  return {
    status: typeof record.status === "string" ? record.status : "unknown",
    step: typeof record.step === "string" ? record.step : undefined,
    completedSteps: Array.isArray(record.completed_steps) && record.completed_steps.every((step) => typeof step === "string")
      ? record.completed_steps as string[]
      : undefined,
    previewResult: record.preview_result,
    payload,
  };
}

function responseBodyForError(payload: unknown): string {
  if (payload === null) return "empty response body";
  if (typeof payload === "string") return payload;
  try {
    return JSON.stringify(payload);
  } catch {
    return "unserializable response body";
  }
}

function isTerminal(status: string): boolean {
  return status === "done" || status === "failed" || status === "error" || status === "cancelled";
}

export class BrightDataHealClient {
  private readonly apiKey: string;
  private readonly collectorId: string;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly pollIntervalMs: number;

  constructor(options: BrightDataHealClientOptions) {
    this.apiKey = options.apiKey;
    this.collectorId = options.collectorId;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? defaultSleep;
    this.pollIntervalMs = options.pollIntervalMs ?? 5_000;
  }

  async start(prompt: string): Promise<BrightDataHealProgress> {
    try {
      return await this.request(`/dca/collectors/${encodeURIComponent(this.collectorId)}/refactor_template`, { prompt, custom_input: [] });
    } catch (error) {
      if (error instanceof BrightDataApiError && error.statusCode === 409) return this.progress();
      throw error;
    }
  }

  async progress(): Promise<BrightDataHealProgress> {
    return this.request(`/dca/collectors/${encodeURIComponent(this.collectorId)}/refactor_template/progress`);
  }

  async approve(approved: boolean): Promise<BrightDataHealProgress> {
    return this.request(`/dca/collectors/${encodeURIComponent(this.collectorId)}/resume_automation_job`, { message: approved, ...(approved ? { auto_save: true } : {}) });
  }

  async pollUntilGate(onProgress: (progress: BrightDataHealProgress) => void): Promise<BrightDataHealProgress> {
    while (true) {
      const current = await this.progress();
      onProgress(current);
      if (current.status === "pending_answer" || isTerminal(current.status)) return current;
      await this.sleep(this.pollIntervalMs);
    }
  }

  private async request(path: string, body?: Record<string, unknown>): Promise<BrightDataHealProgress> {
    const response = await this.fetchImpl(`${BRIGHT_DATA_API}${path}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await readBody(response);
    if (!response.ok) {
      throw new BrightDataApiError(
        `Bright Data healing request failed with HTTP ${response.status}: ${responseBodyForError(payload)}`,
        response.status,
        payload,
      );
    }
    return progressFrom(payload);
  }
}

export function createBrightDataHealClientFromEnv(): BrightDataHealClient {
  const apiKey = process.env.BRIGHTDATA_API_KEY;
  const collectorId = process.env.BRIGHTDATA_COLLECTOR_ID;
  if (!apiKey) throw new BrightDataApiError("BRIGHTDATA_API_KEY is not configured.");
  if (!collectorId) throw new BrightDataApiError("BRIGHTDATA_COLLECTOR_ID is not configured.");
  return new BrightDataHealClient({ apiKey, collectorId });
}
