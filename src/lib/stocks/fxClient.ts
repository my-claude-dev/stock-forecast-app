import type { PricePoint } from "./types";

const FRANKFURTER_API_URL = "https://api.frankfurter.dev/v1";

export class FxDataError extends Error {}

/**
 * Fetches daily USD/JPY reference rates (European Central Bank data, via
 * the free, keyless Frankfurter API) for the given date range (inclusive,
 * "yyyy-mm-dd" format).
 *
 * This is a secondary input to the forecast model (see
 * lib/forecast/linearRegression.ts) — it is not required for the app to
 * work, so callers should treat failures as non-fatal and fall back to
 * the single-factor trend model.
 */
export async function fetchUsdJpyHistory(fromDate: string, toDate: string): Promise<PricePoint[]> {
  const url = `${FRANKFURTER_API_URL}/${fromDate}..${toDate}?from=USD&to=JPY`;

  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new FxDataError(`Frankfurter request failed with status ${response.status}`);
  }

  const body = (await response.json()) as { rates?: Record<string, Record<string, number>> };
  const rates = body.rates;

  if (!rates || typeof rates !== "object") {
    throw new FxDataError("Frankfurter response had no recognizable rates object");
  }

  const points: PricePoint[] = [];
  for (const [date, currencies] of Object.entries(rates)) {
    const rate = currencies?.JPY;
    if (typeof rate === "number" && Number.isFinite(rate)) {
      points.push({ date, close: rate });
    }
  }

  if (points.length === 0) {
    throw new FxDataError("Frankfurter response had no usable JPY rates");
  }

  points.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return points;
}
