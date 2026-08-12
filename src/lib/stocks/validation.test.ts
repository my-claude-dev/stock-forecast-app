import { describe, expect, it } from "vitest";
import { isValidStockCode } from "./validation";

describe("isValidStockCode", () => {
  it("accepts 4-digit codes", () => {
    expect(isValidStockCode("7203")).toBe(true);
    expect(isValidStockCode("0001")).toBe(true);
  });

  it("rejects codes that are not exactly 4 digits", () => {
    expect(isValidStockCode("720")).toBe(false);
    expect(isValidStockCode("72033")).toBe(false);
    expect(isValidStockCode("")).toBe(false);
  });

  it("rejects non-numeric input", () => {
    expect(isValidStockCode("abcd")).toBe(false);
    expect(isValidStockCode("720a")).toBe(false);
    expect(isValidStockCode("72 3")).toBe(false);
  });

  it("rejects injection-style input", () => {
    expect(isValidStockCode("7203.jp&x=1")).toBe(false);
    expect(isValidStockCode("../../etc/passwd")).toBe(false);
  });
});
