export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-6 text-center dark:bg-black">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        株価予測アプリ
      </h1>
      <p className="max-w-sm text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        日本株の銘柄を指定して、過去の株価と将来の予測をグラフで確認できます。準備中です。
      </p>
      <p className="max-w-sm text-xs leading-5 text-zinc-500 dark:text-zinc-500">
        本アプリの予測情報は投資助言ではありません。投資判断はご自身の責任で行ってください。
      </p>
    </main>
  );
}
