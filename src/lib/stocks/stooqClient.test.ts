import { afterEach, describe, expect, it, vi } from "vitest";
import {
  InvalidStockCodeError,
  StockDataNotFoundError,
  fetchDailyHistory,
} from "./stooqClient";

function mockFetchOnce(response: Partial<Response> & { text: () => Promise<string> }) {
  const fetchMock = vi.fn().mockResolvedValue(response as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchDailyHistory", () => {
  it("rejects invalid stock codes without making a network request", async () => {
    const fetchMock = mockFetchOnce({ ok: true, text: async () => "" });

    await expect(fetchDailyHistory("not-a-code")).rejects.toBeInstanceOf(
      InvalidStockCodeError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("parses a Stooq CSV response into price points", async () => {
    const csv = [
      "Date,Open,High,Low,Close,Volume",
      "2024-01-04,100,105,99,104,1000",
      "2024-01-05,104,110,103,108,1200",
    ].join("\n");
    mockFetchOnce({ ok: true, text: async () => csv });

    const history = await fetchDailyHistory("7203");

    expect(history).toEqual([
      { date: "2024-01-04", close: 104 },
      { date: "2024-01-05", close: 108 },
    ]);
  });

  it("requests the .jp ticker suffix for the given code", async () => {
    const fetchMock = mockFetchOnce({
      ok: true,
      text: async () => "Date,Open,High,Low,Close,Volume\n2024-01-04,100,105,99,104,1000",
    });

    await fetchDailyHistory("7203");

    const requestedUrl = fetchMock.mock.calls[0][0] as string;
    expect(requestedUrl).toContain("s=7203.jp");
  });

  it("throws StockDataNotFoundError when Stooq returns no data rows", async () => {
    mockFetchOnce({ ok: true, text: async () => "No data" });

    await expect(fetchDailyHistory("9999")).rejects.toBeInstanceOf(StockDataNotFoundError);
  });

  it("throws a plain Error when the request fails", async () => {
    mockFetchOnce({ ok: false, status: 500, text: async () => "" });

    await expect(fetchDailyHistory("7203")).rejects.toThrow("status 500");
  });
});
