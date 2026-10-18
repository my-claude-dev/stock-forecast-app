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
  /**
   * Optional daily USD/JPY rates. When every lookback-window date can be
   * matched to a rate, the trend is fit as a multiple regression
   * (trading-day index + FX rate) instead of a simple one, so the time
   * trend is estimated net of FX's historical pull on the price. Future FX
   * is assumed flat at its last known value — forecasting FX itself is a
   * separate, harder problem this app doesn't attempt — so FX only
   * affects *how the historical trend is estimated*, not an independent
   * swing in the projection.
   */
  fxHistory?: PricePoint[];
}

export interface ForecastSummary {
  points: ForecastPoint[];
  /** Human-readable basis for the projection, for display alongside the chart. */
  basis: {
    lookbackTradingDays: number;
    slopePerTradingDay: number;
    anchorDate: string;
    anchorClose: number;
    /** Present only when the FX-adjusted model was used (see fxHistory). */
    fx: {
      coefficientPerYen: number;
      anchorRate: number;
    } | null;
  } | null;
}

/**
 * Phase-1 forecast: fits a linear trend over the most recent closing
 * prices — optionally controlling for USD/JPY as a second variable — then
 * projects that trend forward from the latest actual close, not from the
 * regression line's own fitted value, so the forecast joins the
 * actual-price line seamlessly instead of jumping to wherever the
 * best-fit line happens to sit. This is a deliberately naive baseline,
 * not a statistical or ML model — see the project README for the planned
 * upgrade path.
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

  const fxAligned = options.fxHistory ? alignFxToDates(recent, options.fxHistory) : null;

  const fit = fxAligned
    ? fitFxAdjustedTrend(recent, fxAligned)
    : { slope: fitSimpleTrendSlope(recent), fx: null };

  const slope = fit.slope;

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
    // FX's own future value is held flat at its last known rate (see
    // ForecastOptions.fxHistory doc comment), so it contributes nothing to
    // the projected *change* from here — only `slope` (already estimated
    // net of FX's historical pull, when FX data was usable) does.
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
      fx: fit.fx,
    },
  };
}

function fitSimpleTrendSlope(recent: PricePoint[]): number {
  const n = recent.length;
  const xMean = (n - 1) / 2;
  const yMean = recent.reduce((sum, p) => sum + p.close, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - xMean;
    numerator += dx * (recent[i].close - yMean);
    denominator += dx * dx;
  }

  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Fits close ~ b0 + b1*tradingDayIndex + b2*fxRate by ordinary least
 * squares, and returns b1 (the time-trend slope, net of FX) plus the FX
 * coefficient for display. Falls back to the simple (time-only) slope if
 * the system is singular — e.g. FX barely moved during the window, which
 * makes b2 statistically indeterminate.
 */
function fitFxAdjustedTrend(
  recent: PricePoint[],
  fxRates: number[],
): { slope: number; fx: { coefficientPerYen: number; anchorRate: number } | null } {
  const rows = recent.map((point, i) => ({ x1: i, x2: fxRates[i], y: point.close }));
  const solved = solveMultipleRegression(rows);

  if (!solved) {
    return { slope: fitSimpleTrendSlope(recent), fx: null };
  }

  return {
    slope: solved.b1,
    fx: {
      coefficientPerYen: Number(solved.b2.toFixed(2)),
      anchorRate: fxRates[fxRates.length - 1],
    },
  };
}

/** Solves y = b0 + b1*x1 + b2*x2 via the normal equations (Cramer's rule). */
function solveMultipleRegression(
  rows: { x1: number; x2: number; y: number }[],
): { b0: number; b1: number; b2: number } | null {
  const n = rows.length;
  let sX1 = 0;
  let sX2 = 0;
  let sY = 0;
  let sX1X1 = 0;
  let sX2X2 = 0;
  let sX1X2 = 0;
  let sX1Y = 0;
  let sX2Y = 0;

  for (const { x1, x2, y } of rows) {
    sX1 += x1;
    sX2 += x2;
    sY += y;
    sX1X1 += x1 * x1;
    sX2X2 += x2 * x2;
    sX1X2 += x1 * x2;
    sX1Y += x1 * y;
    sX2Y += x2 * y;
  }

  const a = [
    [n, sX1, sX2],
    [sX1, sX1X1, sX1X2],
    [sX2, sX1X2, sX2X2],
  ];
  const b = [sY, sX1Y, sX2Y];

  const solution = solve3x3(a, b);
  if (!solution) {
    return null;
  }

  return { b0: solution[0], b1: solution[1], b2: solution[2] };
}

function determinant3x3(m: number[][]): number {
  return (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  );
}

function solve3x3(a: number[][], b: number[]): number[] | null {
  const det = determinant3x3(a);
  if (Math.abs(det) < 1e-9) {
    return null;
  }

  const solution: number[] = [];
  for (let col = 0; col < 3; col++) {
    const replaced = a.map((row, i) => row.map((value, j) => (j === col ? b[i] : value)));
    solution.push(determinant3x3(replaced) / det);
  }
  return solution;
}

/**
 * Looks up the FX rate on (or, if the market was closed, immediately
 * before) each history date. Returns null if any date can't be matched —
 * the caller then skips the FX-adjusted model rather than fit one on
 * incomplete data.
 */
function alignFxToDates(history: PricePoint[], fxHistory: PricePoint[]): number[] | null {
  if (fxHistory.length === 0) {
    return null;
  }

  const sortedFx = [...fxHistory].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const aligned: number[] = [];

  for (const point of history) {
    let rate: number | undefined;
    for (const fxPoint of sortedFx) {
      if (fxPoint.date > point.date) break;
      rate = fxPoint.close;
    }
    if (rate === undefined) {
      return null;
    }
    aligned.push(rate);
  }

  return aligned;
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
