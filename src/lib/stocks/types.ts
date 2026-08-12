export interface PricePoint {
  /** ISO date, yyyy-mm-dd */
  date: string;
  close: number;
}

export interface ForecastPoint {
  /** ISO date, yyyy-mm-dd */
  date: string;
  predictedClose: number;
}

export interface StockHistoryResult {
  code: string;
  history: PricePoint[];
  forecast: ForecastPoint[];
}
