// src/i18n/locales.ts

export const LOCALES = ["en", "ml", "ta", "te", "kn"] as const;

export type Locale = typeof LOCALES[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LABELS: Record<Locale, string> = {
  en: "English",
  ml: "മലയാളം",
  ta: "தமிழ்",
  te: "తెలుగు",
  kn: "ಕನ್ನಡ",
};

// Pages that have real per-locale translation JSON (src/i18n/pages/*.{locale}.json)
// and are served through the SSR `[lang]/[...slug]` catch-all. Everything else falls
// back to English content even when visited under a /ml, /ta, /te, or /kn prefix.
export const TRANSLATED_PAGES = [""];
