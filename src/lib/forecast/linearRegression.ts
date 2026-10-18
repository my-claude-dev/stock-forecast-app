import type { ForecastPoint, PricePoint } from "@/lib/stocks/types";

const DEFAULT_LOOKBACK_DAYS = 30;
// How far out a single linear trend from 30 days of data can plausibly mean
// anything — this is already a stretch for a naive model; further than this
// the projection is extrapolation in name only. See ForecastSummary.basis
// for the figures behind a given forecast.
const DEFAULT_FORECAST_DAYS = 90;

interface ForecastOptions {
  /** How many of the most recent history points to fit the trend line on. */
  lookbackDays?: number;
  /** How many future trading days to project. */
  forecastDays?: number;
}

export interface ForecastSummary {
  points: ForecastPoint[];
  /** Human-readable basis for the projection, for display alongside the chart. */
  basis: {
    lookbackTradingDays: number;
    slopePerTradingDay: number;
    anchorDate: string;
    anchorClose: number;
  } | null;
}

/**
 * Phase-1 forecast: fits a simple linear trend line (slope) over the most
 * recent closing prices, then projects that slope forward from the latest
 * actual close — not from the regression line's own fitted value — so the
 * forecast joins the actual-price line seamlessly instead of jumping to
 * wherever the best-fit line happens to sit. This is a deliberately naive
 * baseline, not a statistical or ML model — see the project README for the
 * planned upgrade path.
 */
export function forecastLinearTrend(
  history: PricePoint[],
  options: ForecastOptions = {},
): ForecastSummary {
  const lookbackDays = options.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const forecastDays = options.forecastDays ?? DEFAULT_FORECAST_DAYS;

  const recent = history.slice(-lookbackDays);
  const n = recent.length;
  if (n < 2) {
    return { points: [], basis: null };
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

  // Anchor point: the actual last known close, not the regression line's
  // fitted value at that index (which will differ slightly from the real
  // price due to day-to-day noise). Projecting from the real last price
  // keeps the forecast visually and numerically continuous with it.
  const anchorClose = recent[n - 1].close;

  // Anchor the forecast dates at "now" rather than at the last available
  // history date: free data sources can lag (see jquantsClient.ts), so the
  // most recent close on hand may be a few days old. The slope still comes
  // entirely from real historical closes; only the projection's target
  // dates shift to cover the actual future from today.
  const lastDate = new Date(`${recent[n - 1].date}T00:00:00Z`);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const gapTradingDays = countTradingDaysBetween(lastDate, today);

  const points: ForecastPoint[] = [];

  for (let step = 1; step <= forecastDays; step++) {
    const tradingDaysFromAnchor = gapTradingDays + step;
    const predictedClose = anchorClose + slope * tradingDaysFromAnchor;
    points.push({
      date: toIsoDate(addTradingDays(today, step)),
      predictedClose: Math.max(0, Number(predictedClose.toFixed(2))),
    });
  }

  return {
    points,
    basis: {
      lookbackTradingDays: n,
      slopePerTradingDay: Number(slope.toFixed(2)),
      anchorDate: recent[n - 1].date,
      anchorClose,
    },
  };
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
