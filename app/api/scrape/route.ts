import { NextResponse } from "next/server";
import { createBrightDataClientFromEnv, BrightDataApiError } from "@/lib/scraper/bright-data";
import { normalizeBrightDataResult } from "@/lib/scraper/normalize";
import { evaluateExtractionQuality } from "@/lib/scraper/quality";
import type { ScrapeApiResponse } from "@/lib/scraper/types";

export const runtime = "nodejs";

export async function POST() {
  const sourceUrl = process.env.BRIGHTDATA_DOCS_URL;
  if (!sourceUrl) {
    return NextResponse.json<ScrapeApiResponse>({ success: false, error: "BRIGHTDATA_DOCS_URL is not configured." }, { status: 500 });
  }

  try {
    const rawResult = await createBrightDataClientFromEnv().scrape(sourceUrl);
    const snapshot = normalizeBrightDataResult(rawResult, sourceUrl);
    const quality = evaluateExtractionQuality(snapshot);
    return NextResponse.json<ScrapeApiResponse>({ success: true, quality, snapshot });
  } catch (error) {
    const message = error instanceof BrightDataApiError ? error.message : "The documentation scrape failed.";
    return NextResponse.json<ScrapeApiResponse>({ success: false, error: message }, { status: 502 });
  }
}
