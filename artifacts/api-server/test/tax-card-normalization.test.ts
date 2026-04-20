import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeTaxCardNumber } from "../src/lib/tax-card.ts";

describe("normalizeTaxCardNumber", () => {
  it("trims surrounding whitespace", () => {
    assert.equal(normalizeTaxCardNumber("  12345  "), "12345");
  });

  it("removes spaces between digits", () => {
    assert.equal(normalizeTaxCardNumber("12 34 56"), "123456");
  });

  it("removes english and arabic commas", () => {
    assert.equal(normalizeTaxCardNumber("12,34،56"), "123456");
  });

  it("normalizes different user inputs to the same stored value", () => {
    const canonical = "123456789";
    assert.equal(normalizeTaxCardNumber("123456789"), canonical);
    assert.equal(normalizeTaxCardNumber("123 456 789"), canonical);
    assert.equal(normalizeTaxCardNumber("123,456،789"), canonical);
    assert.equal(normalizeTaxCardNumber(" 123, 456 ،789 "), canonical);
  });

  it("returns empty string for non-string input", () => {
    assert.equal(normalizeTaxCardNumber(null), "");
    assert.equal(normalizeTaxCardNumber(undefined), "");
    assert.equal(normalizeTaxCardNumber(123456), "");
  });
});
