import { fetchDailyHistory } from "./jquantsClient";
import type { PricePoint } from "./types";
import { fetchRecentHistory } from "./yahooFinanceClient";

/**
 * Combines J-Quants (reliable long history, but embargoes the most
 * recent ~12 weeks on the Free plan) with Yahoo Finance's unofficial
 * endpoint (no embargo, but unofficial and unstable) to fill that recent
 * gap. Yahoo failures are non-fatal: the merge just falls back to the
 * J-Quants-only data, same as before this supplement existed.
 */
export async function fetchStockHistory(code: string): Promise<PricePoint[]> {
  const jquantsHistory = await fetchDailyHistory(code);

  let recentHistory: PricePoint[];
  try {
    recentHistory = await fetchRecentHistory(code);
  } catch (error) {
    console.error("Yahoo Finance supplement failed, falling back to J-Quants only:", error);
    return jquantsHistory;
  }

  const lastJQuantsDate = jquantsHistory.at(-1)?.date ?? "";
  const supplement = recentHistory.filter((point) => point.date > lastJQuantsDate);

  if (supplement.length === 0) {
    return jquantsHistory;
  }

  const merged = [...jquantsHistory, ...supplement];
  merged.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return merged;
}
