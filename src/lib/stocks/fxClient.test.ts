import { afterEach, describe, expect, it, vi } from "vitest";
import { FxDataError, fetchUsdJpyHistory } from "./fxClient";

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

describe("fetchUsdJpyHistory", () => {
  it("requests the given date range for USD to JPY", async () => {
    const fetchMock = mockFetch(jsonResponse({ rates: { "2024-01-04": { JPY: 144.5 } } }));

    await fetchUsdJpyHistory("2024-01-01", "2024-01-05");

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("2024-01-01..2024-01-05");
    expect(url).toContain("from=USD");
    expect(url).toContain("to=JPY");
  });

  it("parses and sorts the rates object into price points", async () => {
    mockFetch(
      jsonResponse({
        rates: {
          "2024-01-05": { JPY: 145.2 },
          "2024-01-04": { JPY: 144.5 },
        },
      }),
    );

    const history = await fetchUsdJpyHistory("2024-01-01", "2024-01-05");

    expect(history).toEqual([
      { date: "2024-01-04", close: 144.5 },
      { date: "2024-01-05", close: 145.2 },
    ]);
  });

  it("throws FxDataError when the request fails", async () => {
    mockFetch(jsonResponse({}, { ok: false, status: 500 }));

    await expect(fetchUsdJpyHistory("2024-01-01", "2024-01-05")).rejects.toBeInstanceOf(
      FxDataError,
    );
  });

  it("throws FxDataError when the response has no rates", async () => {
    mockFetch(jsonResponse({}));

    await expect(fetchUsdJpyHistory("2024-01-01", "2024-01-05")).rejects.toBeInstanceOf(
      FxDataError,
    );
  });
});
