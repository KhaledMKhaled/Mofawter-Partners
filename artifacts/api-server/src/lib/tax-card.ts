const TAX_CARD_SEPARATORS_REGEX = /[\s,،]+/g;

export function normalizeTaxCardNumber(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(TAX_CARD_SEPARATORS_REGEX, "");
}
