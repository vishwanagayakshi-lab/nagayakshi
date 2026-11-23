// src/i18n/pageMessages.ts
const dicts = import.meta.glob("./pages/**/*.json", { eager: true }) as Record<string, any>;

export function tPage(pageId: string, locale: string): Record<string, any> {
  const keyLocale = `./pages/${pageId}.${locale}.json`;
  const keyEn = `./pages/${pageId}.en.json`;
  return dicts[keyLocale]?.default ?? dicts[keyEn]?.default ?? {};
}
