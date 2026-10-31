import { configureTranslationCacheStorage } from "@noorlibrary/quran-translations";
export {
  AUTHENTIC_INDIGENOUS_VERSES,
  dynamicCache,
  fetchSurahTranslationAsync,
  getTranslationFallbackNotice,
  resolveIndigenousTranslation,
  resolveIndigenousTranslationDetailed,
  TRANSLATION_SOURCES,
} from "@noorlibrary/quran-translations";
export type {
  IndigenousLanguage,
  ResolvedTranslation,
  SupportedLanguage,
  TranslationCacheStorage,
} from "@noorlibrary/quran-translations";

if (typeof window !== "undefined") {
  configureTranslationCacheStorage({
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
  });
}
