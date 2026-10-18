import type { ForecastPoint, PricePoint } from "@/lib/stocks/types";

const DEFAULT_LOOKBACK_DAYS = 30;
const DEFAULT_FORECAST_DAYS = 14;

interface ForecastOptions {
  /** How many of the most recent history points to fit the trend line on. */
  lookbackDays?: number;
  /** How many future trading days to project. */
  forecastDays?: number;
}

/**
 * Phase-1 forecast: fits a simple linear trend line over the most recent
 * closing prices and extrapolates it forward. This is a deliberately naive
 * baseline, not a statistical or ML model — see the project README for the
 * planned upgrade path.
 */
export function forecastLinearTrend(
  history: PricePoint[],
  options: ForecastOptions = {},
): ForecastPoint[] {
  const lookbackDays = options.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const forecastDays = options.forecastDays ?? DEFAULT_FORECAST_DAYS;

  const recent = history.slice(-lookbackDays);
  const n = recent.length;
  if (n < 2) {
    return [];
  }

  const xMean = (n - 1) / 2;
  const yMean = recent.reduce((sum, p) => sum + p.close, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - xMean;
    numerator += dx * (recent[i].close - yMean);
    denominator += dx * dx;
  }

  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = yMean - slope * xMean;

  // Anchor the forecast at "now" rather than at the last available history
  // date: free data sources often lag by weeks/months (see
  // jquantsClient.ts), so the most recent close on hand may be old. The
  // trend itself still comes entirely from real historical closes; only
  // the projection target shifts to cover the actual future from today.
  const lastDate = new Date(`${recent[n - 1].date}T00:00:00Z`);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const gapTradingDays = countTradingDaysBetween(lastDate, today);

  const forecast: ForecastPoint[] = [];

  for (let step = 1; step <= forecastDays; step++) {
    const x = n - 1 + gapTradingDays + step;
    const predictedClose = intercept + slope * x;
    forecast.push({
      date: toIsoDate(addTradingDays(today, step)),
      predictedClose: Math.max(0, Number(predictedClose.toFixed(2))),
    });
  }

  return forecast;
}

function addTradingDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setUTCDate(result.getUTCDate() + 1);
    const dayOfWeek = result.getUTCDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      added++;
    }
  }
  return result;
}

// Counts weekdays strictly between `from` (exclusive) and `to` (inclusive).
// Returns 0 (or negative, clamped to 0) if `to` is not after `from`.
function countTradingDaysBetween(from: Date, to: Date): number {
  let count = 0;
  const cursor = new Date(from);
  while (cursor.getTime() < to.getTime()) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const dayOfWeek = cursor.getUTCDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
  }
  return Math.max(0, count);
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
