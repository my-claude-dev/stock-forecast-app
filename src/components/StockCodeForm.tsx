"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { isValidStockCode } from "@/lib/stocks/validation";

export default function StockCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = code.trim();

    if (!isValidStockCode(trimmed)) {
      setError("銘柄コードは4桁の数字で入力してください(例: 7203)");
      return;
    }

    setError(null);
    router.push(`/stocks/${trimmed}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-2">
      <label htmlFor="stock-code" className="text-sm text-zinc-600 dark:text-zinc-400">
        銘柄コード(4桁)
      </label>
      <div className="flex gap-2">
        <input
          id="stock-code"
          name="code"
          inputMode="numeric"
          pattern="[0-9]{4}"
          maxLength={4}
          placeholder="7203"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <button
          type="submit"
          className="shrink-0 rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          表示
        </button>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
