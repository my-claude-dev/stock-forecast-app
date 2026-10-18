import Link from "next/link";
import { notFound } from "next/navigation";
import StockChart from "@/components/StockChart";
import { forecastLinearTrend } from "@/lib/forecast/linearRegression";
import {
  JQuantsConfigError,
  StockDataNotFoundError,
  fetchDailyHistory,
} from "@/lib/stocks/jquantsClient";
import { isValidStockCode } from "@/lib/stocks/validation";

export default async function StockDetailPage(props: PageProps<"/stocks/[code]">) {
  const { code } = await props.params;

  if (!isValidStockCode(code)) {
    notFound();
  }

  let errorMessage: string | null = null;
  let history: Awaited<ReturnType<typeof fetchDailyHistory>> | null = null;

  try {
    history = await fetchDailyHistory(code);
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

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <Link href="/" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
        ← 銘柄コードを検索し直す
      </Link>

      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        銘柄コード {code}
      </h1>

      {errorMessage || !history ? (
        <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
      ) : (
        <>
          <StockChart history={history} forecast={forecastLinearTrend(history)} />
          <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-500">
            過去の株価データは J-Quants API(無料プラン)から取得しています。無料プランの仕様上、
            直近約3ヶ月分のデータには遅延があるため、グラフは数ヶ月前までの情報が中心になります。
            予測は直近30営業日の終値から算出した単純な線形トレンドであり、投資助言ではありません。
            投資判断はご自身の責任で行ってください。
          </p>
        </>
      )}
    </main>
  );
}
