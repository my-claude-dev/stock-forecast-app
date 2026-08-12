import { isValidStockCode } from "./validation";
import type { PricePoint } from "./types";

const STOOQ_HISTORY_URL = "https://stooq.com/q/d/l/";

export class InvalidStockCodeError extends Error {}
export class StockDataNotFoundError extends Error {}

/**
 * Fetches daily close prices for a Tokyo Stock Exchange ticker from Stooq
 * (no API key required). This is a stopgap data source for early
 * development; the plan is to move to the official J-Quants API once
 * registered.
 */
export async function fetchDailyHistory(code: string): Promise<PricePoint[]> {
  if (!isValidStockCode(code)) {
    throw new InvalidStockCodeError(`Invalid stock code: ${code}`);
  }

  const symbol = `${code}.jp`;
  const url = `${STOOQ_HISTORY_URL}?s=${encodeURIComponent(symbol)}&i=d`;

  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; stock-forecast-app)" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Stooq request failed with status ${response.status}`);
  }

  const csv = await response.text();
  const points = parseStooqCsv(csv);

  if (points.length === 0) {
    throw new StockDataNotFoundError(`No data found for code: ${code}`);
  }

  return points;
}

function parseStooqCsv(csv: string): PricePoint[] {
  const lines = csv.trim().split("\n");
  if (lines.length <= 1) {
    return [];
  }

  const points: PricePoint[] = [];
  for (const line of lines.slice(1)) {
    const columns = line.split(",");
    const date = columns[0];
    const close = Number(columns[4]);
    if (date && Number.isFinite(close)) {
      points.push({ date, close });
    }
  }

  return points;
}
