import { afterEach, describe, expect, it, vi } from "vitest";

const fetchDailyHistoryMock = vi.fn();
const fetchRecentHistoryMock = vi.fn();

vi.mock("./jquantsClient", () => ({
  fetchDailyHistory: (...args: unknown[]) => fetchDailyHistoryMock(...args),
}));
vi.mock("./yahooFinanceClient", () => ({
  fetchRecentHistory: (...args: unknown[]) => fetchRecentHistoryMock(...args),
}));

const { fetchStockHistory } = await import("./stockHistory");

afterEach(() => {
  vi.resetAllMocks();
});

describe("fetchStockHistory", () => {
  it("appends Yahoo data that is newer than the last J-Quants date", async () => {
    fetchDailyHistoryMock.mockResolvedValue([
      { date: "2024-01-04", close: 100 },
      { date: "2024-01-05", close: 102 },
    ]);
    fetchRecentHistoryMock.mockResolvedValue([
      { date: "2024-01-05", close: 999 }, // overlaps J-Quants' last date, should be dropped
      { date: "2024-01-08", close: 110 },
      { date: "2024-01-09", close: 112 },
    ]);

    const history = await fetchStockHistory("7203");

    expect(history).toEqual([
      { date: "2024-01-04", close: 100 },
      { date: "2024-01-05", close: 102 },
      { date: "2024-01-08", close: 110 },
      { date: "2024-01-09", close: 112 },
    ]);
  });

  it("falls back to J-Quants-only data when Yahoo fails", async () => {
    const jquantsHistory = [
      { date: "2024-01-04", close: 100 },
      { date: "2024-01-05", close: 102 },
    ];
    fetchDailyHistoryMock.mockResolvedValue(jquantsHistory);
    fetchRecentHistoryMock.mockRejectedValue(new Error("boom"));

    const history = await fetchStockHistory("7203");

    expect(history).toEqual(jquantsHistory);
  });

  it("propagates J-Quants failures without calling Yahoo", async () => {
    fetchDailyHistoryMock.mockRejectedValue(new Error("jquants down"));


    await expect(fetchStockHistory("7203")).rejects.toThrow("jquants down");
    expect(fetchRecentHistoryMock).not.toHaveBeenCalled();
  });
});
