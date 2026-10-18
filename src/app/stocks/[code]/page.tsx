import Link from "next/link";
import { notFound } from "next/navigation";
import StockChart from "@/components/StockChart";
import { forecastLinearTrend } from "@/lib/forecast/linearRegression";
import { fetchUsdJpyHistory } from "@/lib/stocks/fxClient";
import { JQuantsConfigError, StockDataNotFoundError } from "@/lib/stocks/jquantsClient";
import { fetchStockHistory } from "@/lib/stocks/stockHistory";
import type { PricePoint } from "@/lib/stocks/types";
import { isValidStockCode } from "@/lib/stocks/validation";

// Wide enough to comfortably cover the forecast's 30-trading-day lookback
// window regardless of where it falls (recent history may run up to
// "today" or lag behind it — see stockHistory.ts).
const FX_HISTORY_CALENDAR_DAYS = 200;

async function fetchFxHistorySafely(): Promise<PricePoint[] | undefined> {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - FX_HISTORY_CALENDAR_DAYS);
  const toIso = to.toISOString().slice(0, 10);
  const fromIso = from.toISOString().slice(0, 10);

  try {
    return await fetchUsdJpyHistory(fromIso, toIso);
  } catch (error) {
    console.error("USD/JPY fetch failed, forecasting without FX adjustment:", error);
    return undefined;
  }
}

function formatYen(value: number): string {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

function formatSignedYen(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toLocaleString("ja-JP")}円`;
}

function formatRate(value: number): string {
  return value.toFixed(2);
}

export default async function StockDetailPage(props: PageProps<"/stocks/[code]">) {
  const { code } = await props.params;

  if (!isValidStockCode(code)) {
    notFound();
  }

  // Kicked off before awaiting the stock history so both requests fly
  // concurrently; fetchFxHistorySafely never rejects.
  const fxHistoryPromise = fetchFxHistorySafely();

  let errorMessage: string | null = null;
  let history: Awaited<ReturnType<typeof fetchStockHistory>> | null = null;

  try {
    history = await fetchStockHistory(code);
  } catch (error) {
    if (error instanceof StockDataNotFoundError) {
      errorMessage = `銘柄コード「${code}」のデータが見つかりませんでした。`;
    } else if (error instanceof JQuantsConfigError) {
      console.error(error);
      errorMessage = "株価データAPIが未設定です(JQUANTS_API_KEY)。管理者にご確認ください。";
    } else {
      console.error(error);
      errorMessage = "株価データの取得に失敗しました。時間をおいて再度お試しください。";
    }
  }

  const fxHistory = await fxHistoryPromise;
  const forecastSummary = history ? forecastLinearTrend(history, { fxHistory }) : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <Link href="/" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
        ← 銘柄コードを検索し直す
      </Link>

      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        銘柄コード {code}
      </h1>

      {errorMessage || !history || !forecastSummary ? (
        <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
      ) : (
        <>
          <StockChart history={history} forecast={forecastSummary.points} />

          {forecastSummary.basis && (
            <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-500">
              <strong className="text-zinc-600 dark:text-zinc-400">予測の根拠: </strong>
              {forecastSummary.basis.fx ? (
                <>
                  直近{forecastSummary.basis.lookbackTradingDays}
                  営業日の終値と米ドル/円の為替レートを用いた重回帰分析により、為替の影響を
                  統計的に取り除いた価格トレンド(1営業日あたり
                  {formatSignedYen(forecastSummary.basis.slopePerTradingDay)})を算出し、
                  直近の実績値({forecastSummary.basis.anchorDate} 時点{" "}
                  {formatYen(forecastSummary.basis.anchorClose)})を起点にこの傾きで延長しています。
                  為替は今後も直近レート(1ドル=
                  {formatRate(forecastSummary.basis.fx.anchorRate)}円)で横ばいと仮定しており、
                  為替相場自体の先行きは予測していません(参考:
                  この期間は為替が1円動くと株価が約
                  {formatSignedYen(forecastSummary.basis.fx.coefficientPerYen)}
                  動く傾向が見られました)。
                </>
              ) : (
                <>
                  直近{forecastSummary.basis.lookbackTradingDays}営業日の終値から、1営業日あたり
                  {formatSignedYen(forecastSummary.basis.slopePerTradingDay)}
                  の傾き(線形回帰)を算出し、直近の実績値({forecastSummary.basis.anchorDate} 時点{" "}
                  {formatYen(forecastSummary.basis.anchorClose)})を起点にこの傾きで延長しています。
                </>
              )}{" "}
              過去の値動きがそのまま続くと仮定した単純な機械的試算であり、決算発表や
              債券相場・ニュース等は考慮していません。期間が先になるほど誤差は大きくなります。
            </p>
          )}

          <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-500">
            過去の株価データは J-Quants API(無料プラン)から取得しています。無料プランの
            仕様上、直近約3ヶ月分のデータには遅延があるため、その期間は Yahoo!
            ファイナンスの非公式エンドポイントから補完を試みています(取得できない場合は
            空白のままになります)。本アプリの予測情報は投資助言ではありません。
            投資判断はご自身の責任で行ってください。
          </p>
        </>
      )}
    </main>
  );
}
