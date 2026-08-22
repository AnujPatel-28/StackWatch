const BRIGHT_DATA_API = "https://api.brightdata.com";

export type BrightDataClientOptions = {
  apiKey: string;
  collectorId: string;
  triggerUrl?: string;
  resultUrl?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
};

export class BrightDataApiError extends Error {
  readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = "BrightDataApiError";
  }
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function responseIdFrom(value: unknown): string {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const responseId = record.response_id ?? record.responseId;
    return typeof responseId === "string" ? responseId : "";
  }
  return "";
}

function isPending(value: unknown): boolean {
  if (typeof value === "string") return /pending|building|processing|queued|running/i.test(value);
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const status = (value as Record<string, unknown>).status;
  return typeof status === "string" && /pending|building|processing|queued|running|in_progress/i.test(status);
}

export class BrightDataClient {
  private readonly options: BrightDataClientOptions;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly triggerUrl: string;
  private readonly resultUrl: string;
  private readonly timeoutMs: number;
  private readonly pollIntervalMs: number;

  constructor(options: BrightDataClientOptions) {
    this.options = options;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? defaultSleep;
    this.triggerUrl = options.triggerUrl ?? `${BRIGHT_DATA_API}/dca/trigger_immediate?collector=${encodeURIComponent(options.collectorId)}`;
    this.resultUrl = options.resultUrl ?? `${BRIGHT_DATA_API}/dca/get_result`;
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.pollIntervalMs = options.pollIntervalMs ?? 5_000;
  }

  async scrape(targetUrl: string): Promise<unknown> {
    const headers = {
      Authorization: `Bearer ${this.options.apiKey}`,
      "Content-Type": "application/json",
    };
    const triggerResponse = await this.fetchImpl(this.triggerUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ url: targetUrl }),
    });
    if (!triggerResponse.ok) throw new BrightDataApiError(`Bright Data trigger failed with HTTP ${triggerResponse.status}.`, triggerResponse.status);

    const triggerBody = await readBody(triggerResponse);
    const responseId = responseIdFrom(triggerBody);
    if (!responseId) throw new BrightDataApiError("Bright Data trigger did not return a response_id.");

    const deadline = Date.now() + this.timeoutMs;
    while (Date.now() <= deadline) {
      const resultEndpoint = `${this.resultUrl}?response_id=${encodeURIComponent(responseId)}`;
      const resultResponse = await this.fetchImpl(resultEndpoint, { headers: { Authorization: headers.Authorization } });
      const resultBody = await readBody(resultResponse);
      if (resultResponse.status === 202 || isPending(resultBody)) {
        await this.sleep(Math.min(this.pollIntervalMs, Math.max(0, deadline - Date.now())));
        continue;
      }
      if (!resultResponse.ok) throw new BrightDataApiError(`Bright Data result retrieval failed with HTTP ${resultResponse.status}.`, resultResponse.status);
      return resultBody;
    }
    throw new BrightDataApiError("Bright Data result polling timed out.");
  }
}
