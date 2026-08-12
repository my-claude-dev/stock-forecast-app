import { describe, expect, it } from "vitest";
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

const UPTREND_HISTORY: PricePoint[] = BUSINESS_DAY_DATES.map((date, i) => ({
  date,
  close: 100 + 2 * i,
}));

function isWeekday(isoDate: string): boolean {
  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return day !== 0 && day !== 6;
}

describe("forecastLinearTrend", () => {
  it("returns an empty forecast when there is fewer than 2 history points", () => {
    expect(forecastLinearTrend([])).toEqual([]);
    expect(forecastLinearTrend([{ date: "2024-01-01", close: 100 }])).toEqual([]);
  });

  it("extrapolates a perfect linear trend and skips weekends", () => {
    const forecast = forecastLinearTrend(UPTREND_HISTORY);

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

  it("respects the forecastDays option", () => {
    const forecast = forecastLinearTrend(UPTREND_HISTORY, { forecastDays: 3 });
    expect(forecast).toHaveLength(3);
  });

  it("clamps predicted prices at 0 instead of going negative", () => {
    const history: PricePoint[] = [
      { date: "2024-01-01", close: 10 },
      { date: "2024-01-02", close: 0 },
    ];

    const forecast = forecastLinearTrend(history, { forecastDays: 1 });

    expect(forecast).toEqual([{ date: "2024-01-03", predictedClose: 0 }]);
  });
});
