import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { en } from "./locales/en";
import { ar } from "./locales/ar";

export type Locale = "ar" | "en";
export type Translations = typeof en;

const STORAGE_KEY = "mofawter_lang";

const translations: Record<Locale, Translations> = { en, ar };

type I18nContextType = {
  locale: Locale;
  dir: "rtl" | "ltr";
  t: Translations;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
};

const I18nContext = createContext<I18nContextType | null>(null);

function getInitialLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "ar") return stored;
  } catch {}
  return "ar"; // Arabic is the default
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === "ar" ? "en" : "ar");
  }, [locale, setLocale]);

  // Apply dir and lang to <html> on every locale change
  useEffect(() => {
    const dir = locale === "ar" ? "rtl" : "ltr";
    document.documentElement.dir = dir;
    document.documentElement.lang = locale;
    // Also set the font class for conditional font loading
    document.documentElement.classList.toggle("lang-ar", locale === "ar");
    document.documentElement.classList.toggle("lang-en", locale === "en");
  }, [locale]);

  const value: I18nContextType = {
    locale,
    dir: locale === "ar" ? "rtl" : "ltr",
    t: translations[locale],
    setLocale,
    toggleLocale,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextType {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function useT(): Translations {
  return useI18n().t;
}
