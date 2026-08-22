import "server-only";
import { BrightDataApiError, BrightDataClient } from "./bright-data-client";

export * from "./bright-data-client";

export function createBrightDataClientFromEnv(): BrightDataClient {
  const apiKey = process.env.BRIGHTDATA_API_KEY;
  const collectorId = process.env.BRIGHTDATA_COLLECTOR_ID;
  if (!apiKey) throw new BrightDataApiError("BRIGHTDATA_API_KEY is not configured.");
  if (!collectorId) throw new BrightDataApiError("BRIGHTDATA_COLLECTOR_ID is not configured.");
  return new BrightDataClient({ apiKey, collectorId });
}
