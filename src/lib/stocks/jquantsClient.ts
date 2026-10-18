import { isValidStockCode } from "./validation";
import type { PricePoint } from "./types";

const JQUANTS_API_BASE_URL = "https://api.jquants.com/v2";
// The Free plan embargoes the most recent ~12 weeks of data (confirmed via
// a live 400 response: "Your subscription covers ... 2024-07-26 ~
// 2026-07-26" on a request made 2026-10-18, exactly 84 days earlier). A
// few extra days of buffer avoid tripping the boundary again due to
// timezone/day-boundary rounding between our clock and J-Quants'.
const FREE_PLAN_DELAY_DAYS = 90;
// Calendar days of history to request on top of the delay offset;
// comfortably covers the ~30 trading days the forecast model looks back
// on, with room for weekends/holidays.
const HISTORY_DAYS = 200;
const MAX_PAGES = 20;

export class InvalidStockCodeError extends Error {}
export class StockDataNotFoundError extends Error {}
export class JQuantsConfigError extends Error {}

type JQuantsBar = Record<string, unknown>;

function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function normalizeDate(raw: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  return raw;
}

function pickString(bar: JQuantsBar, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = bar[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

function pickNumber(bar: JQuantsBar, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = bar[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

// The exact response shape (wrapper key, field name casing) isn't confirmed
// against live docs — this reads defensively across the plausible key names
// rather than assuming one. See README for how to adjust if logs show a
// different shape in production.
function extractBars(body: unknown): JQuantsBar[] {
  if (Array.isArray(body)) return body as JQuantsBar[];
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    for (const key of ["daily_quotes", "daily_bars", "bars", "data"]) {
      const value = record[key];
      if (Array.isArray(value)) return value as JQuantsBar[];
    }
  }
  return [];
}

function extractPaginationKey(body: unknown): string | undefined {
  if (body && typeof body === "object") {
    const value = (body as Record<string, unknown>).pagination_key;
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

export async function fetchDailyHistory(code: string): Promise<PricePoint[]> {
  if (!isValidStockCode(code)) {
    throw new InvalidStockCodeError(`Invalid stock code: ${code}`);
  }

  const apiKey = process.env.JQUANTS_API_KEY;
  if (!apiKey) {
    throw new JQuantsConfigError("JQUANTS_API_KEY is not configured.");
  }

  const to = new Date();
  to.setUTCDate(to.getUTCDate() - FREE_PLAN_DELAY_DAYS);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - HISTORY_DAYS);

  const points: PricePoint[] = [];
  let paginationKey: string | undefined;
  let page = 0;

  do {
    const params = new URLSearchParams({
      code,
      from: formatDate(from),
      to: formatDate(to),
    });
    if (paginationKey) {
      params.set("pagination_key", paginationKey);
    }

    const response = await fetch(`${JQUANTS_API_BASE_URL}/equities/bars/daily?${params}`, {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    });

    if (!response.ok) {
      const bodyText = await response.text();
      console.error(`J-Quants request failed (${response.status}):`, bodyText.slice(0, 500));
      throw new Error(`J-Quants request failed with status ${response.status}`);
    }

    const body: unknown = await response.json();
    const bars = extractBars(body);

    if (bars.length === 0 && page === 0) {
      console.error(
        "J-Quants response had no recognizable data array:",
        JSON.stringify(body).slice(0, 500),
      );
    }

    for (const bar of bars) {
      const rawDate = pickString(bar, ["Date", "date"]);
      const close = pickNumber(bar, ["Close", "C", "AdjustmentClose", "AdjClose", "close"]);
      if (rawDate && close !== undefined) {
        points.push({ date: normalizeDate(rawDate), close });
      }
    }

    paginationKey = extractPaginationKey(body);
    page += 1;
  } while (paginationKey && page < MAX_PAGES);

  if (points.length === 0) {
    throw new StockDataNotFoundError(`No data found for code: ${code}`);
  }

  points.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return points;
}
