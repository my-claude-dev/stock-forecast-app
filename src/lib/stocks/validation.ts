// Tokyo Stock Exchange codes are 4-digit numbers today (e.g. 7203 = Toyota).
const STOCK_CODE_PATTERN = /^[0-9]{4}$/;

export function isValidStockCode(code: string): boolean {
  return STOCK_CODE_PATTERN.test(code);
}
