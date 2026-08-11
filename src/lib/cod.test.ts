import { describe, expect, it } from "vitest";
import { formatRupees, hasCodField, parseCodAmount } from "./cod";

describe("parseCodAmount", () => {
  it("accepts the decimal strings the wallet endpoints send", () => {
    expect(parseCodAmount("640.50")).toBe(640.5);
    expect(parseCodAmount(640)).toBe(640);
  });

  it("treats nothing-to-collect as no amount", () => {
    expect(parseCodAmount(0)).toBeNull();
    expect(parseCodAmount("0.00")).toBeNull();
    expect(parseCodAmount(null)).toBeNull();
    expect(parseCodAmount(undefined)).toBeNull();
  });

  it("refuses values a rider could not collect", () => {
    expect(parseCodAmount(-100)).toBeNull();
    expect(parseCodAmount("not a number")).toBeNull();
  });
});

describe("hasCodField", () => {
  it("separates a prepaid order from a backend that hasn't shipped the field", () => {
    // null is a statement about the order; undefined is a statement about the API.
    expect(hasCodField(null)).toBe(true);
    expect(hasCodField(0)).toBe(true);
    expect(hasCodField(undefined)).toBe(false);
  });
});

describe("formatRupees", () => {
  it("shows paise only when there are paise, and shows both digits when there are", () => {
    expect(formatRupees(640)).toBe("₹640");
    expect(formatRupees(640.5)).toBe("₹640.50");
  });

  it("groups in the Indian numbering system", () => {
    expect(formatRupees(120000)).toBe("₹1,20,000");
  });
});
