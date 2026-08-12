"use client";

import { useSyncExternalStore } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ForecastPoint, PricePoint } from "@/lib/stocks/types";

interface StockChartProps {
  history: PricePoint[];
  forecast: ForecastPoint[];
}

interface ChartRow {
  date: string;
  actual?: number;
  predicted?: number;
}

const PALETTE = {
  light: {
    actual: "#2a78d6",
    forecast: "#eb6834",
    grid: "#e1e0d9",
    axis: "#c3c2b7",
    mutedText: "#898781",
    secondaryText: "#52514e",
  },
  dark: {
    actual: "#3987e5",
    forecast: "#d95926",
    grid: "#2c2c2a",
    axis: "#383835",
    mutedText: "#898781",
    secondaryText: "#c3c2b7",
  },
};

function subscribeToColorScheme(callback: () => void): () => void {
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function getIsDarkSnapshot(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function getIsDarkServerSnapshot(): boolean {
  return false;
}

function useIsDarkMode(): boolean {
  return useSyncExternalStore(subscribeToColorScheme, getIsDarkSnapshot, getIsDarkServerSnapshot);
}

function buildChartRows(history: PricePoint[], forecast: ForecastPoint[]): ChartRow[] {
  const rows: ChartRow[] = history.map((point) => ({
    date: point.date,
    actual: point.close,
  }));

  const lastHistoryPoint = history.at(-1);
  if (lastHistoryPoint && forecast.length > 0) {
    // Bridge the two lines so the forecast appears to continue from the
    // last actual close, instead of leaving a visual gap.
    rows.push({ date: lastHistoryPoint.date, predicted: lastHistoryPoint.close });
  }

  for (const point of forecast) {
    rows.push({ date: point.date, predicted: point.predictedClose });
  }

  return rows;
}

function formatDateLabel(date: string): string {
  const [, month, day] = date.split("-");
  return `${month}/${day}`;
}

function formatYen(value: number): string {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

function ChartTooltip({
  active,
  label,
  payload,
  colors,
}: {
  active?: boolean;
  label?: string;
  payload?: { dataKey: string; value: number }[];
  colors: typeof PALETTE.light;
}) {
  if (!active || !payload || payload.length === 0 || !label) {
    return null;
  }

  return (
    <div className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm shadow-md dark:border-white/10 dark:bg-zinc-900">
      <div className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
      {payload.map((entry) => {
        const isActual = entry.dataKey === "actual";
        return (
          <div key={entry.dataKey} className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-0.5 w-3"
              style={{ backgroundColor: isActual ? colors.actual : colors.forecast }}
            />
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">
              {formatYen(entry.value)}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {isActual ? "実績" : "予測"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function StockChart({ history, forecast }: StockChartProps) {
  const isDark = useIsDarkMode();
  const colors = isDark ? PALETTE.dark : PALETTE.light;
  const rows = buildChartRows(history, forecast);
  const forecastStartDate = history.at(-1)?.date;

  return (
    <div className="w-full">
      <div className="h-72 w-full sm:h-96">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={colors.grid} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateLabel}
              stroke={colors.axis}
              tick={{ fill: colors.mutedText, fontSize: 12 }}
              minTickGap={24}
            />
            <YAxis
              stroke={colors.axis}
              tick={{ fill: colors.mutedText, fontSize: 12 }}
              tickFormatter={(value: number) => value.toLocaleString("ja-JP")}
              width={56}
              domain={["auto", "auto"]}
            />
            {forecastStartDate && (
              <ReferenceLine
                x={forecastStartDate}
                stroke={colors.axis}
                strokeDasharray="2 2"
                label={{
                  value: "予測開始",
                  position: "insideTopLeft",
                  fill: colors.secondaryText,
                  fontSize: 11,
                }}
              />
            )}
            <Tooltip
              content={(props) => (
                <ChartTooltip
                  active={props.active}
                  label={props.label as string | undefined}
                  payload={
                    props.payload?.map((entry) => ({
                      dataKey: String(entry.dataKey),
                      value: Number(entry.value),
                    })) ?? []
                  }
                  colors={colors}
                />
              )}
              cursor={{ stroke: colors.axis, strokeWidth: 1 }}
            />
            <Legend
              formatter={(value) => (
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  {value === "actual" ? "実績" : "予測"}
                </span>
              )}
            />
            <Line
              type="monotone"
              dataKey="actual"
              name="actual"
              stroke={colors.actual}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="predicted"
              name="predicted"
              stroke={colors.forecast}
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-zinc-600 dark:text-zinc-400">
          データを表で見る
        </summary>
        <div className="mt-2 max-h-64 overflow-y-auto rounded border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-2 py-1 font-medium text-zinc-500 dark:text-zinc-400">日付</th>
                <th className="px-2 py-1 font-medium text-zinc-500 dark:text-zinc-400">
                  終値
                </th>
                <th className="px-2 py-1 font-medium text-zinc-500 dark:text-zinc-400">区分</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.date} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-2 py-1 tabular-nums">{row.date}</td>
                  <td className="px-2 py-1 tabular-nums">
                    {formatYen((row.actual ?? row.predicted) as number)}
                  </td>
                  <td className="px-2 py-1">{row.actual !== undefined ? "実績" : "予測"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
