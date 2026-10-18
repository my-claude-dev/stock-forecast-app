import Link from "next/link";
import { notFound } from "next/navigation";
import StockChart from "@/components/StockChart";
import { forecastLinearTrend } from "@/lib/forecast/linearRegression";
import { JQuantsConfigError, StockDataNotFoundError } from "@/lib/stocks/jquantsClient";
import { fetchStockHistory } from "@/lib/stocks/stockHistory";
import { isValidStockCode } from "@/lib/stocks/validation";

function formatYen(value: number): string {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

function formatSignedYen(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toLocaleString("ja-JP")}円`;
}

export default async function StockDetailPage(props: PageProps<"/stocks/[code]">) {
  const { code } = await props.params;

  if (!isValidStockCode(code)) {
    notFound();
  }

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

  const forecastSummary = history ? forecastLinearTrend(history) : null;

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
              直近{forecastSummary.basis.lookbackTradingDays}営業日の終値から、1営業日あたり
              {formatSignedYen(forecastSummary.basis.slopePerTradingDay)}
              の傾き(線形回帰)を算出し、直近の実績値({forecastSummary.basis.anchorDate} 時点{" "}
              {formatYen(forecastSummary.basis.anchorClose)})を起点にこの傾きで延長しています。
              過去の値動きがそのまま続くと仮定した単純な機械的試算であり、決算発表や
              相場全体の変動などは一切考慮していません。期間が先になるほど誤差は大きくなります。
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
