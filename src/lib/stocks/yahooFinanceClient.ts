import type { PricePoint } from "./types";

const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";

// Same rationale as jquantsClient's Stooq-era headers: an unofficial
// endpoint is more likely to respond normally to a request that looks
// like it came from a browser.
const BROWSER_LIKE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
};

export class YahooFinanceError extends Error {}

interface YahooChartResponse {
  chart?: {
    result?:
      | {
          timestamp?: number[];
          indicators?: {
            quote?: { close?: (number | null)[] }[];
          };
        }[]
      | null;
  };
}

/**
 * Fetches recent daily closes for a Tokyo Stock Exchange ticker from
 * Yahoo Finance's unofficial, unauthenticated chart endpoint.
 *
 * This exists only to fill the gap left by J-Quants' Free-plan data
 * embargo (see jquantsClient.ts) — it is not the primary data source.
 * The endpoint is undocumented and can change or rate-limit without
 * notice, so callers should treat failures as non-fatal.
 */
export async function fetchRecentHistory(code: string): Promise<PricePoint[]> {
  const symbol = `${code}.T`;
  const url = `${YAHOO_CHART_URL}/${symbol}?range=6mo&interval=1d`;

  const response = await fetch(url, {
    headers: BROWSER_LIKE_HEADERS,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new YahooFinanceError(`Yahoo Finance request failed with status ${response.status}`);
  }

  const body = (await response.json()) as YahooChartResponse;
  const result = body.chart?.result?.[0];
  const timestamps = result?.timestamp;
  const closes = result?.indicators?.quote?.[0]?.close;

  if (!timestamps || !closes || timestamps.length === 0) {
    throw new YahooFinanceError(`Yahoo Finance returned no data for ${symbol}`);
  }

  const points: PricePoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    const timestamp = timestamps[i];
    if (typeof close === "number" && Number.isFinite(close) && typeof timestamp === "number") {
      points.push({
        date: new Date(timestamp * 1000).toISOString().slice(0, 10),
        close: Number(close.toFixed(2)),
      });
    }
  }

  if (points.length === 0) {
    throw new YahooFinanceError(`Yahoo Finance returned no usable closes for ${symbol}`);
  }

  return points;
}
