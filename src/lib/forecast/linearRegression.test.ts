import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PricePoint } from "@/lib/stocks/types";
import { forecastLinearTrend } from "./linearRegression";

// 10 consecutive business days (2024-01-01 is a Monday), close = 100 + 2*i,
// so the trend is an exact line: slope 2, intercept 100.
const BUSINESS_DAY_DATES = [
  "2024-01-01",
  "2024-01-02",
  "2024-01-03",
  "2024-01-04",
  "2024-01-05",
  "2024-01-08",
  "2024-01-09",
  "2024-01-10",
  "2024-01-11",
  "2024-01-12",
];
const LAST_HISTORY_DATE = BUSINESS_DAY_DATES[BUSINESS_DAY_DATES.length - 1];
const LAST_HISTORY_CLOSE = 100 + 2 * (BUSINESS_DAY_DATES.length - 1);

const UPTREND_HISTORY: PricePoint[] = BUSINESS_DAY_DATES.map((date, i) => ({
  date,
  close: 100 + 2 * i,
}));

function isWeekday(isoDate: string): boolean {
  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return day !== 0 && day !== 6;
}

function setToday(isoDate: string) {
  vi.setSystemTime(new Date(`${isoDate}T00:00:00Z`));
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("forecastLinearTrend", () => {
  it("returns an empty forecast when there is fewer than 2 history points", () => {
    setToday(LAST_HISTORY_DATE);
    expect(forecastLinearTrend([])).toEqual({ points: [], basis: null });
    expect(forecastLinearTrend([{ date: "2024-01-01", close: 100 }])).toEqual({
      points: [],
      basis: null,
    });
  });

  it("extrapolates a perfect linear trend from today when today is right after the data", () => {
    // "Today" equal to the last history date is the gap=0 edge case: the
    // forecast should behave the same as extrapolating straight from the
    // last known close.
    setToday(LAST_HISTORY_DATE);
    const { points: forecast } = forecastLinearTrend(UPTREND_HISTORY, { forecastDays: 14 });

    expect(forecast).toHaveLength(14);
    expect(forecast[0]).toEqual({ date: "2024-01-15", predictedClose: 120 });
    expect(forecast[1]).toEqual({ date: "2024-01-16", predictedClose: 122 });

    for (const point of forecast) {
      expect(isWeekday(point.date)).toBe(true);
    }

    for (let i = 1; i < forecast.length; i++) {
      expect(forecast[i].predictedClose - forecast[i - 1].predictedClose).toBeCloseTo(2);
    }
  });

  it("defaults to a 90 trading-day forecast window", () => {
    setToday(LAST_HISTORY_DATE);
    const { points: forecast } = forecastLinearTrend(UPTREND_HISTORY);
    expect(forecast).toHaveLength(90);
  });

  it("anchors the forecast at today instead of the last history date when they differ", () => {
    // A 3-week gap between the last available close and "today" (e.g. a
    // delayed data source). The forecast should start just after today,
    // not just after the stale history.
    setToday("2024-02-01");
    const { points: forecast } = forecastLinearTrend(UPTREND_HISTORY);

    expect(forecast[0].date).toBe("2024-02-02");
    for (const point of forecast) {
      expect(new Date(`${point.date}T00:00:00Z`).getTime()).toBeGreaterThan(
        new Date(`${LAST_HISTORY_DATE}T00:00:00Z`).getTime(),
      );
      expect(isWeekday(point.date)).toBe(true);
    }
    // Extrapolating further out along the same trend yields a higher value
    // than the gap=0 case (120 for the first forecast point).
    expect(forecast[0].predictedClose).toBeGreaterThan(120);
  });

  it("joins the forecast seamlessly to the last actual close (gap=0)", () => {
    // The first forecast point should be exactly one trading day's worth
    // of slope away from the real last close, not from wherever the
    // regression line's own fitted value happens to land.
    setToday(LAST_HISTORY_DATE);
    const { points: forecast, basis } = forecastLinearTrend(UPTREND_HISTORY);

    expect(basis).not.toBeNull();
    expect(basis?.anchorClose).toBe(LAST_HISTORY_CLOSE);
    expect(basis?.anchorDate).toBe(LAST_HISTORY_DATE);
    expect(basis?.slopePerTradingDay).toBeCloseTo(2);
    expect(forecast[0].predictedClose - basis!.anchorClose).toBeCloseTo(
      basis!.slopePerTradingDay,
    );
  });

  it("respects the forecastDays option", () => {
    setToday(LAST_HISTORY_DATE);
    const { points: forecast } = forecastLinearTrend(UPTREND_HISTORY, { forecastDays: 3 });
    expect(forecast).toHaveLength(3);
  });

  it("clamps predicted prices at 0 instead of going negative", () => {
    setToday("2024-01-02");
    const history: PricePoint[] = [
      { date: "2024-01-01", close: 10 },
      { date: "2024-01-02", close: 0 },
    ];

    const { points: forecast } = forecastLinearTrend(history, { forecastDays: 1 });

    expect(forecast).toEqual([{ date: "2024-01-03", predictedClose: 0 }]);
  });

  describe("with fxHistory", () => {
    // fx has its own zigzag-but-rising pattern, not a pure linear function
    // of the trading-day index, so it's not collinear with it.
    const FX_RATES = [150, 151, 150, 152, 151, 153, 152, 154, 153, 155];
    // close is an exact linear combination of (index, fx): 100 + 2*i + 3*fx[i].
    const FX_HISTORY: PricePoint[] = BUSINESS_DAY_DATES.map((date, i) => ({
      date,
      close: FX_RATES[i],
    }));
    const PRICE_WITH_FX_HISTORY: PricePoint[] = BUSINESS_DAY_DATES.map((date, i) => ({
      date,
      close: 100 + 2 * i + 3 * FX_RATES[i],
    }));
    const LAST_CLOSE_WITH_FX = 100 + 2 * 9 + 3 * FX_RATES[9];

    it("separates the FX contribution from the pure time trend", () => {
      setToday(LAST_HISTORY_DATE);
      const { basis } = forecastLinearTrend(PRICE_WITH_FX_HISTORY, {
        fxHistory: FX_HISTORY,
        forecastDays: 1,
      });

      expect(basis?.fx).not.toBeNull();
      // Recovered coefficients should match the exact generating formula.
      expect(basis?.slopePerTradingDay).toBeCloseTo(2, 1);
      expect(basis?.fx?.coefficientPerYen).toBeCloseTo(3, 1);
      expect(basis?.anchorClose).toBeCloseTo(LAST_CLOSE_WITH_FX, 1);
      expect(basis?.fx?.anchorRate).toBe(FX_RATES[9]);
    });

    it("projects forward holding FX flat, using only the time-trend slope", () => {
      setToday(LAST_HISTORY_DATE);
      const { points: forecast, basis } = forecastLinearTrend(PRICE_WITH_FX_HISTORY, {
        fxHistory: FX_HISTORY,
        forecastDays: 1,
      });

      // FX held flat means the forecast step is anchorClose + slope*1, with
      // no separate FX-driven jump even though b2 is nonzero.
      expect(forecast[0].predictedClose).toBeCloseTo(
        basis!.anchorClose + basis!.slopePerTradingDay,
        0,
      );
    });

    it("falls back to the simple trend when FX data doesn't cover every date", () => {
      setToday(LAST_HISTORY_DATE);
      const incompleteFx = FX_HISTORY.slice(1); // missing the first date

      const { basis } = forecastLinearTrend(UPTREND_HISTORY, {
        fxHistory: incompleteFx,
        forecastDays: 1,
      });

      expect(basis?.fx).toBeNull();
      expect(basis?.slopePerTradingDay).toBeCloseTo(2);
    });
  });
});
