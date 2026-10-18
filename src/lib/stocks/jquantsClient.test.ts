import { afterEach, describe, expect, it, vi } from "vitest";
import {
  InvalidStockCodeError,
  JQuantsConfigError,
  StockDataNotFoundError,
  fetchDailyHistory,
} from "./jquantsClient";

function jsonResponse(body: unknown, init: Partial<Response> = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
    ...init,
  } as Response;
}

function mockFetch(...responses: Response[]) {
  const fetchMock = vi.fn();
  for (const response of responses) {
    fetchMock.mockResolvedValueOnce(response);
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("fetchDailyHistory", () => {
  it("rejects invalid stock codes without making a network request", async () => {
    vi.stubEnv("JQUANTS_API_KEY", "test-key");
    const fetchMock = mockFetch(jsonResponse({}));

    await expect(fetchDailyHistory("not-a-code")).rejects.toBeInstanceOf(
      InvalidStockCodeError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws JQuantsConfigError when the API key is not configured", async () => {
    vi.stubEnv("JQUANTS_API_KEY", "");
    const fetchMock = mockFetch(jsonResponse({}));

    await expect(fetchDailyHistory("7203")).rejects.toBeInstanceOf(JQuantsConfigError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the API key and code as expected", async () => {
    vi.stubEnv("JQUANTS_API_KEY", "test-key");
    const fetchMock = mockFetch(
      jsonResponse({ daily_quotes: [{ Date: "2024-01-04", Close: 104 }] }),
    );

    await fetchDailyHistory("7203");

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/equities/bars/daily");
    expect(url).toContain("code=7203");
    expect((options.headers as Record<string, string>)["x-api-key"]).toBe("test-key");
  });

  it("parses bars under the daily_quotes wrapper key", async () => {
    vi.stubEnv("JQUANTS_API_KEY", "test-key");
    mockFetch(
      jsonResponse({
        daily_quotes: [
          { Date: "2024-01-04", Close: 104 },
          { Date: "2024-01-05", Close: 108 },
        ],
      }),
    );

    const history = await fetchDailyHistory("7203");

    expect(history).toEqual([
      { date: "2024-01-04", close: 104 },
      { date: "2024-01-05", close: 108 },
    ]);
  });

  it("falls back to abbreviated field names (e.g. C for close)", async () => {
    vi.stubEnv("JQUANTS_API_KEY", "test-key");
    mockFetch(jsonResponse({ bars: [{ Date: "20240104", C: 104 }] }));

    const history = await fetchDailyHistory("7203");

    expect(history).toEqual([{ date: "2024-01-04", close: 104 }]);
  });

  it("follows pagination_key across multiple pages", async () => {
    vi.stubEnv("JQUANTS_API_KEY", "test-key");
    const fetchMock = mockFetch(
      jsonResponse({
        daily_quotes: [{ Date: "2024-01-04", Close: 104 }],
        pagination_key: "page2",
      }),
      jsonResponse({ daily_quotes: [{ Date: "2024-01-05", Close: 108 }] }),
    );

    const history = await fetchDailyHistory("7203");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain("pagination_key=page2");
    expect(history).toEqual([
      { date: "2024-01-04", close: 104 },
      { date: "2024-01-05", close: 108 },
    ]);
  });

  it("throws StockDataNotFoundError when no bars are returned", async () => {
    vi.stubEnv("JQUANTS_API_KEY", "test-key");
    mockFetch(jsonResponse({ daily_quotes: [] }));

    await expect(fetchDailyHistory("9999")).rejects.toBeInstanceOf(StockDataNotFoundError);
  });

  it("throws a plain Error when the request fails", async () => {
    vi.stubEnv("JQUANTS_API_KEY", "test-key");
    mockFetch(jsonResponse({}, { ok: false, status: 403 }));

    await expect(fetchDailyHistory("7203")).rejects.toThrow("status 403");
  });
});
