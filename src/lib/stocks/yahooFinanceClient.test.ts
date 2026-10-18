import { afterEach, describe, expect, it, vi } from "vitest";
import { YahooFinanceError, fetchRecentHistory } from "./yahooFinanceClient";

function jsonResponse(body: unknown, init: Partial<Response> = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    ...init,
  } as Response;
}

function mockFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchRecentHistory", () => {
  it("requests the .T ticker suffix", async () => {
    const fetchMock = mockFetch(
      jsonResponse({
        chart: {
          result: [{ timestamp: [1704326400], indicators: { quote: [{ close: [100] }] } }],
        },
      }),
    );

    await fetchRecentHistory("7203");

    expect(fetchMock.mock.calls[0][0]).toContain("/chart/7203.T");
  });

  it("parses timestamps and closes into price points", async () => {
    mockFetch(
      jsonResponse({
        chart: {
          result: [
            {
              // 2024-01-04T00:00:00Z and 2024-01-05T00:00:00Z
              timestamp: [1704326400, 1704412800],
              indicators: { quote: [{ close: [104.456, 108.1] }] },
            },
          ],
        },
      }),
    );

    const history = await fetchRecentHistory("7203");

    expect(history).toEqual([
      { date: "2024-01-04", close: 104.46 },
      { date: "2024-01-05", close: 108.1 },
    ]);
  });

  it("skips null closes (non-trading days within the range)", async () => {
    mockFetch(
      jsonResponse({
        chart: {
          result: [
            {
              timestamp: [1704326400, 1704412800],
              indicators: { quote: [{ close: [null, 108.1] }] },
            },
          ],
        },
      }),
    );

    const history = await fetchRecentHistory("7203");

    expect(history).toEqual([{ date: "2024-01-05", close: 108.1 }]);
  });

  it("throws YahooFinanceError when the response has no result", async () => {
    mockFetch(jsonResponse({ chart: { result: [] } }));

    await expect(fetchRecentHistory("7203")).rejects.toBeInstanceOf(YahooFinanceError);
  });

  it("throws YahooFinanceError when the request fails", async () => {
    mockFetch(jsonResponse({}, { ok: false, status: 429 }));

    await expect(fetchRecentHistory("7203")).rejects.toBeInstanceOf(YahooFinanceError);
  });
});
