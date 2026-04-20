import type { Locale } from "./i18n";

/**
 * Format currency in EGP — ج.م
 * Arabic: ١٬٢٣٤٫٥٦ ج.م
 * English: 1,234.56 EGP
 */
export function formatCurrency(amount: number | string, locale: Locale = "ar"): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(n)) return locale === "ar" ? "٠٫٠٠ ج.م" : "0.00 EGP";

  if (locale === "ar") {
    const formatted = n.toLocaleString("ar-EG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${formatted} ج.م`;
  }

  const formatted = n.toLocaleString("en-EG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatted} EGP`;
}

/**
 * Format a date string (ISO) to locale-appropriate display.
 * Arabic: ٢٠ أبريل ٢٠٢٦
 * English: Apr 20, 2026
 */
export function formatDate(iso: string | Date | null | undefined, locale: Locale = "ar"): string {
  if (!iso) return "—";
  try {
    const date = typeof iso === "string" ? new Date(iso) : iso;
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

/**
 * Format a date+time string.
 */
export function formatDateTime(iso: string | Date | null | undefined, locale: Locale = "ar"): string {
  if (!iso) return "—";
  try {
    const date = typeof iso === "string" ? new Date(iso) : iso;
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

/**
 * Format a plain number.
 */
export function formatNumber(n: number | string, locale: Locale = "ar"): string {
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(num)) return locale === "ar" ? "٠" : "0";
  return num.toLocaleString(locale === "ar" ? "ar-EG" : "en-US");
}

/**
 * Format a percentage.
 */
export function formatPercent(n: number | string, locale: Locale = "ar"): string {
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(num)) return "0%";
  return `${num.toLocaleString(locale === "ar" ? "ar-EG" : "en-US")}%`;
}
