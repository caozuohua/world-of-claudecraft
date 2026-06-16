import {
  translations,
  en, es, es_ES, fr_FR, fr_CA, en_CA, it_IT, de_DE, zh_CN, zh_TW, ko_KR, ja_JP, pt_BR, ru_RU,
} from './i18n.resolved.generated';
import type { Leaves, TranslationKey, InterpolationValue, InterpolationValues, DeepPartial } from './i18n.en';

// The translation table is the generated dense artifact
// (src/ui/i18n.resolved.generated.ts), where every locale is overlaid onto `en`
// and filled from English. Every read-path below (t, translationValue,
// hasTranslation, tOptional) reads that dense table, never the raw per-locale
// objects - those go sparse in later phases, so a direct read of them would
// return undefined or the wrong value.
//
// Re-export the dense per-locale objects, gameStrings, and the type machinery so
// importers of './i18n' keep an unchanged public surface.
export { en, es, es_ES, fr_FR, fr_CA, en_CA, it_IT, de_DE, zh_CN, zh_TW, ko_KR, ja_JP, pt_BR, ru_RU };
// gameStrings is the post-cap/XP/leaderboard layer, which the table carries under
// the `game` key. Source it from the generated dense `en` rather than re-exporting
// from i18n.en, so importing './i18n' does not pull the full i18n.en base (en +
// shared content layers, ~1 MB) into the client bundle - that module now exists
// only to feed the generator. Same content, same export name.
export const gameStrings = en.game;
export type { Leaves, TranslationKey, InterpolationValue, InterpolationValues, DeepPartial };

export type SupportedLanguage = keyof typeof translations;

export const supportedLanguages = Object.keys(translations) as SupportedLanguage[];

let currentLanguage: SupportedLanguage = "en";

export function isSupportedLanguage(value: string): value is SupportedLanguage {
  return Object.prototype.hasOwnProperty.call(translations, value);
}

export function languageTag(lang: SupportedLanguage): string {
  return lang.replace("_", "-");
}

function browserStorage(): Storage | null {
  try {
    const storage = globalThis.localStorage;
    return storage && typeof storage === "object" ? storage : null;
  } catch {
    return null;
  }
}

function getStoredLanguage(): SupportedLanguage | null {
  const storage = browserStorage();
  if (!storage || typeof storage.getItem !== "function") return null;
  try {
    const saved = storage.getItem("locale") as SupportedLanguage | null;
    return saved && translations[saved] ? saved : null;
  } catch {
    return null;
  }
}

function setStoredLanguage(lang: SupportedLanguage): void {
  const storage = browserStorage();
  if (!storage || typeof storage.setItem !== "function") return;
  try {
    storage.setItem("locale", lang);
  } catch {
    // Storage may be disabled or unavailable in test/browser privacy modes.
  }
}

// Initialize language from URL query or localStorage if available (browser environments)
if (typeof window !== "undefined" && window.location) {
  const params = new URLSearchParams(window.location.search);
  const langParam = params.get("lang");
  if (langParam && isSupportedLanguage(langParam)) {
    currentLanguage = langParam;
  } else {
    currentLanguage = getStoredLanguage() ?? currentLanguage;
  }
} else {
  currentLanguage = getStoredLanguage() ?? currentLanguage;
}

export function getLanguage(): SupportedLanguage {
  return currentLanguage;
}

export function setLanguage(lang: SupportedLanguage): void {
  currentLanguage = lang;
  setStoredLanguage(lang);
}

function interpolate(template: string, values?: InterpolationValues): string {
  if (!values) return template;
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (match, name: string) => {
    const value = values[name];
    return value === undefined ? match : String(value);
  });
}

export function t(key: TranslationKey, values?: InterpolationValues): string {
  const parts = key.split(".");
  let current: unknown = translations[currentLanguage];
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return key;
    }
  }
  return typeof current === "string" ? interpolate(current, values) : key;
}

function translationValue(key: string, lang: SupportedLanguage): string | null {
  const parts = key.split(".");
  let current: unknown = translations[lang];
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }
  return typeof current === "string" ? current : null;
}

export function hasTranslation(key: string, lang: SupportedLanguage = currentLanguage): boolean {
  return translationValue(key, lang) !== null;
}

export function tOptional(key: string, values?: InterpolationValues, lang: SupportedLanguage = currentLanguage): string | null {
  const value = translationValue(key, lang);
  return value === null ? null : interpolate(value, values);
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions, lang: SupportedLanguage = currentLanguage): string {
  return new Intl.NumberFormat(languageTag(lang), options).format(value);
}

export function formatDateTime(value: Date | number, options?: Intl.DateTimeFormatOptions, lang: SupportedLanguage = currentLanguage): string {
  return new Intl.DateTimeFormat(languageTag(lang), options).format(value);
}

export interface MoneyParts {
  gold: number;
  silver: number;
  copper: number;
}

export type MoneyDisplayStyle = "compact" | "long";

export function moneyParts(copper: number): MoneyParts {
  const safeCopper = Number.isFinite(copper) ? Math.max(0, Math.floor(copper)) : 0;
  return {
    gold: Math.floor(safeCopper / 10000),
    silver: Math.floor((safeCopper % 10000) / 100),
    copper: safeCopper % 100,
  };
}

export function formatMoney(copper: number, style: MoneyDisplayStyle = "compact"): string {
  const parts = moneyParts(copper);
  const unitKeys = style === "compact"
    ? {
      gold: "itemUi.money.goldShort",
      silver: "itemUi.money.silverShort",
      copper: "itemUi.money.copperShort",
    } satisfies Record<keyof MoneyParts, TranslationKey>
    : {
      gold: "itemUi.money.gold",
      silver: "itemUi.money.silver",
      copper: "itemUi.money.copper",
    } satisfies Record<keyof MoneyParts, TranslationKey>;
  const rows: { value: number; unit: TranslationKey }[] = [];
  if (parts.gold > 0) rows.push({ value: parts.gold, unit: unitKeys.gold });
  if (parts.silver > 0 || parts.gold > 0) rows.push({ value: parts.silver, unit: unitKeys.silver });
  if (parts.copper > 0 || rows.length === 0) rows.push({ value: parts.copper, unit: unitKeys.copper });
  return rows.map(({ value, unit }) => {
    const amount = formatNumber(value, { maximumFractionDigits: 0 });
    return style === "compact" ? `${amount}${t(unit)}` : `${amount} ${t(unit)}`;
  }).join(" ");
}
