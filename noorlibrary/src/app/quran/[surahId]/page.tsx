"use client";

import React, { useState, useEffect, use, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "../../../context/AppContext";
import {
  parseTajweedText,
  TAJWEED_RULES,
  getTajweedColor,
} from "../../../lib/tajweed";
import WebQuranNavigationHub, {
  WebHubTab,
} from "../../../components/quran/WebQuranNavigationHub";
import { ReportContentButton } from "../../../components/ReportContentModal";
import {
  saveQuranReflection,
  getQuranReflections,
  deleteQuranReflection,
  QuranReflectionItem,
  saveAyahToFolder,
  subscribeAvailableQaris,
  getQuranReaderSettings,
  saveQuranReaderSettings,
  subscribeQuranReaderSettings,
  saveMemorizationPlan,
  updateMemorizationStatus,
  getMemorizationPlans,
  QariProfile,
  QARIS_LIST,
  normalizeEveryayahPath,
} from "../../../lib/quran-hub-storage";
import {
  resolveIndigenousTranslation,
  fetchSurahTranslationAsync,
} from "../../../lib/indigenous-translations";
import {
  registerWebAudioPause,
  notifyWebAudioStarted,
} from "../../../lib/web-audio-coordinator";
import { getQuranUrl } from "../../../lib/links";

interface Verse {
  id: number;
  text: string;
  translation: string;
  transliteration: string;
}

interface SurahData {
  id: number;
  name: string;
  transliteration: string;
  translation: string;
  type: string;
  total_verses: number;
  verses: Verse[];
}

function cleanArabicText(text: string): string {
  if (!text) return "";
  return (
    text
      // Replace non-standard/sequential fathatan U+0657 (which renders as inverted damma with 'o') with standard Fathatan U+064B
      .replace(/\u0657/g, "\u064B")
      // Replace non-standard/sequential kasratan U+0656 (which renders as subscript dagger/madd line) with standard Kasratan U+064D
      .replace(/\u0656/g, "\u064D")
      // Replace sequential dammatan U+065E with standard authentic dammatan U+064C
      .replace(/\u065E/g, "\u064C")
      // Ensure connecting letters before Dagger Alif (U+0670) carry Uthmani Tatweel (U+0640)
      // to prevent Harakat crowding/plunging (e.g. فَأَهۡلَكۡنَـٰهُم instead of فَأَهۡلَكۡنَٰهُم)
      .replace(
        /([\u0628\u062A\u062B\u062C\u062D\u062E\u0633\u0634\u0635\u0636\u0637\u0638\u0639\u063A\u0641\u0642\u0643\u0644\u0645\u0646\u0647\u064A\u0626][\u0651]?[\u064E]?)(?!\u0640)\u0670/gu,
        "$1\u0640\u0670",
      )
      // Ensure letters carrying Long Madd (U+0653 ARABIC MADDAH ABOVE) have classical calligraphic
      // elongation (Kashida / Tatweel U+0640) so the Madd wave has ample horizontal breathing room
      .replace(
        /([\u0628\u062A\u062B\u062C\u062D\u062E\u0633\u0634\u0635\u0636\u0637\u0638\u0639\u063A\u0641\u0642\u0643\u0644\u0645\u0646\u0647\u064A\u0626][\u0651]?[\u064E\u064F\u0650]?)(?!\u0640)([\u0627\u0648\u064A\u0670]\u0653|\u0622)/gu,
        "$1\u0640$2",
      )
      // Also extend connecting letters that carry Maddah themselves in Muqatta'at (e.g. الٓـمٓ, طسٓـمٓ)
      .replace(
        /([\u0628\u062A\u062B\u062C\u062D\u062E\u0633\u0634\u0635\u0636\u0637\u0638\u0639\u063A\u0641\u0642\u0643\u0644\u0645\u0646\u0647\u064A\u0626]\u0653)(?!\u0640)([\u0628\u062A\u062B\u062C\u062D\u062E\u0633\u0634\u0635\u0636\u0637\u0638\u0639\u063A\u0641\u0642\u0643\u0644\u0645\u0646\u0647\u064A\u0626])/gu,
        "$1\u0640$2",
      )
      .replace(/%D9%8F/gi, "\u064F")
      .replace(/%D9%8E/gi, "\u064E")
      .replace(/%D9%90/gi, "\u0650")
      .replace(/%D9%91/gi, "\u0651")
      .replace(/%D9%8B/gi, "\u064B")
      .replace(/%D9%8C/gi, "\u064C")
      .replace(/%D9%8D/gi, "\u064D")
  );
}

function toArabicNumber(num: number | string): string {
  const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return String(num).replace(/[0-9]/g, (d) => arabicDigits[parseInt(d, 10)]);
}

function renderWebArabicText(
  text: string,
  showTajweed: boolean,
  readerTheme: string,
) {
  if (!text) return null;

  // Tajweed phoneme color-coding is temporarily disabled ("Coming Soon").
  // Prostration marks (Khatt as-Sajdah line & ۩ symbol) remain 100% active.
  const isTajweedColorActive = false;

  // Fast path: verse has neither Khatt as-Sajdah (\u06E4) nor Sajdah symbol (\u06E9)
  if (!text.includes("\u06E4") && !text.includes("\u06E9")) {
    return text;
  }

  // Tokenize verse by spaces into words
  const words = text.split(" ");

  // Group words into chunks: consecutive Sajdah words (having \u06E4) vs non-Sajdah words
  interface WordChunk {
    isSajdah: boolean;
    words: string[];
  }
  const chunks: WordChunk[] = [];
  let currentChunk: WordChunk | null = null;

  for (const rawWord of words) {
    const isSajdahWord = rawWord.includes("\u06E4");
    if (!currentChunk || currentChunk.isSajdah !== isSajdahWord) {
      currentChunk = { isSajdah: isSajdahWord, words: [rawWord] };
      chunks.push(currentChunk);
    } else {
      currentChunk.words.push(rawWord);
    }
  }

  // Helper to render text with clean \u06E4-stripped characters and gold ۩ symbol
  const renderChunkContent = (rawChunkText: string) => {
    // Strip \u06E4 so no unwanted squiggly madda diacritic is drawn
    const cleanText = rawChunkText.replace(/\u06E4/g, "");

    if (isTajweedColorActive) {
      const segments = parseTajweedText(cleanText);
      return segments.map((seg, sIdx) => {
        const rCol = seg.rule
          ? getTajweedColor(seg.rule, readerTheme === "dark")
          : undefined;
        if (seg.text.includes("\u06E9")) {
          const parts = seg.text.split("\u06E9");
          return (
            <span key={sIdx} style={{ color: rCol }}>
              {parts[0]}
              <span
                className="quran-sajdah-symbol"
                title="سجدة تلاوة (Prostration)"
              >
                ۩
              </span>
              {parts[1]}
            </span>
          );
        }
        return (
          <span key={sIdx} style={{ color: rCol }}>
            {seg.text}
          </span>
        );
      });
    }

    // Clean Arabic text with gold Sajdah mark ۩
    if (cleanText.includes("\u06E9")) {
      const parts = cleanText.split("\u06E9");
      return parts.map((part, pIdx) => (
        <React.Fragment key={pIdx}>
          {part}
          {pIdx < parts.length - 1 && (
            <span
              className="quran-sajdah-symbol"
              title="سجدة تلاوة (Prostration)"
            >
              ۩
            </span>
          )}
        </React.Fragment>
      ));
    }

    return cleanText;
  };

  return chunks.map((chunk, cIdx) => {
    const isLast = cIdx === chunks.length - 1;
    const chunkString = chunk.words.join(" ");

    if (chunk.isSajdah) {
      return (
        <React.Fragment key={cIdx}>
          <span
            className="quran-sajdah-phrase"
            title="موضع سجود التلاوة (Place of Prostration)"
          >
            {renderChunkContent(chunkString)}
          </span>
          {!isLast ? " " : ""}
        </React.Fragment>
      );
    }

    return (
      <React.Fragment key={cIdx}>
        {renderChunkContent(chunkString)}
        {!isLast ? " " : ""}
      </React.Fragment>
    );
  });
}

function highlightMatch(text: string, query: string, isArabic = false) {
  if (!query || !query.trim() || !text) return text;
  const q = query.trim().replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const regex = new RegExp(`(${q})`, isArabic ? "gu" : "gi");
  const parts = text.split(regex);
  if (parts.length <= 1) return text;
  return parts.map((part, i) =>
    part.toLowerCase() === query.trim().toLowerCase() ? (
      <mark
        key={i}
        style={{
          backgroundColor: "rgba(212, 175, 55, 0.4)",
          color: "inherit",
          fontWeight: 700,
          padding: "0 3px",
          borderRadius: "3px",
        }}
      >
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

const QUICK_THEMES = [
  { label: "👑 Ayat al-Kursi", query: "2:255" },
  { label: "🕊️ Mercy", query: "mercy" },
  { label: "🛡️ Patience", query: "patience" },
  { label: "🤲 Forgiveness", query: "forgiving" },
  { label: "🏡 Paradise", query: "paradise" },
  { label: "👨‍👩‍👧 Parents", query: "parents" },
  { label: "💫 Gratitude", query: "grateful" },
  { label: "🌙 Al-Kahf", query: "18:1" },
  { label: "⭐ Al-Mulk", query: "67:1" },
];

const FAMOUS_AYAHS_WEB: Record<number, { verse: number; label: string }[]> = {
  1: [
    { verse: 1, label: "Basmalah" },
    { verse: 7, label: "Du'a" },
  ],
  2: [
    { verse: 1, label: "Alif-Lam-Mim" },
    { verse: 186, label: "Du'a & Ramadan" },
    { verse: 255, label: "Ayat al-Kursi" },
    { verse: 285, label: "Amanar-Rasul" },
  ],
  3: [
    { verse: 18, label: "Shahada" },
    { verse: 26, label: "Mulki" },
    { verse: 144, label: "Muhammad (ﷺ)" },
    { verse: 200, label: "Patience" },
  ],
  18: [
    { verse: 1, label: "Al-Hamd" },
    { verse: 10, label: "Ashab al-Kahf" },
    { verse: 46, label: "Wealth & Children" },
    { verse: 110, label: "Last Ayah" },
  ],
  36: [
    { verse: 1, label: "Ya-Sin" },
    { verse: 58, label: "Salamun" },
    { verse: 82, label: "Kun Fayakun" },
  ],
  55: [
    { verse: 1, label: "Ar-Rahman" },
    { verse: 13, label: "Favors of Lord" },
  ],
  56: [
    { verse: 1, label: "Al-Waqi'ah" },
    { verse: 79, label: "Clean hands" },
  ],
  59: [
    { verse: 21, label: "If sent upon mountain" },
    { verse: 22, label: "Names of Allah" },
  ],
  67: [
    { verse: 1, label: "Tabarak" },
    { verse: 30, label: "Water Spring" },
  ],
  112: [{ verse: 1, label: "Ikhlas" }],
  113: [{ verse: 1, label: "Falaq" }],
  114: [{ verse: 1, label: "Nas" }],
};

interface SurahSummary {
  id: number;
  name?: string;
  transliteration: string;
  translation?: string;
  type?: string;
  total_verses?: number;
}

export default function SurahReader({
  params,
}: {
  params: Promise<{ surahId: string }>;
}) {
  const resolvedParams = use(params);
  const surahIdStr = resolvedParams.surahId;
  const surahId = parseInt(surahIdStr, 10);
  const router = useRouter();

  const { quranBookmark, updateQuranBookmark, user } = useApp();
  const [isWebHubOpen, setIsWebHubOpen] = useState(false);
  const [webHubInitialTab, setWebHubInitialTab] =
    useState<WebHubTab>("reflections");
  const [surah, setSurah] = useState<SurahData | null>(null);
  const [surahList, setSurahList] = useState<SurahSummary[]>([]);
  const [isChapterDrawerOpen, setIsChapterDrawerOpen] = useState(false);
  const [chapterSearch, setChapterSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Phase 6: Reader Customization State & Settings
  const [fontSizeArabic, setFontSizeArabic] = useState(32);
  const [fontSizeTranslation, setFontSizeTranslation] = useState(16);
  const [showTranslation, setShowTranslation] = useState(true);
  const [showTransliteration, setShowTransliteration] = useState(false);
  const [readerTheme, setReaderTheme] = useState<
    "light" | "cream" | "sepia" | "green" | "dark"
  >("light");
  const [arabicFont, setArabicFont] = useState<
    "amiri" | "scheherazade"
  >("amiri");
  const [selectedTransLang, setSelectedTransLang] = useState<
    "en" | "yoruba" | "hausa" | "igbo"
  >("en");
  const [, setWebTransTick] = useState(0);

  // Instant reactive loader for indigenous translations on web
  useEffect(() => {
    if (!surah?.id) return;
    if (selectedTransLang !== "yoruba" && selectedTransLang !== "hausa") return;

    let active = true;
    fetchSurahTranslationAsync(selectedTransLang, surah.id)
      .then(() => {
        if (active) {
          setWebTransTick((t) => t + 1);
        }
      })
      .catch(() => {
        // Ignore transient network errors; the next fetch attempt will retry.
      });

    return () => {
      active = false;
    };
  }, [selectedTransLang, surah?.id]);
  // Phase 7: Audio modal spoken-language chip — independent of translation modal
  const [webAudioTranslationLang, setWebAudioTranslationLang] = useState<
    "en" | "yoruba" | "hausa" | "igbo"
  >("en");
  // Phase 7: Active Qari for web audio player
  const [webActiveQariId, setWebActiveQariId] = useState<string>("mishary");
  const [webQaris, setWebQaris] = useState<QariProfile[]>(QARIS_LIST);

  useEffect(() => {
    const unsub = subscribeAvailableQaris((list) => {
      if (list && list.length > 0) {
        setWebQaris(list);
      }
    });
    return () => unsub();
  }, []);
  // Phase 7: Audio playback states
  const [webIsPlayingRecitation, setWebIsPlayingRecitation] = useState(false);
  const [webIsPlayingTranslation, setWebIsPlayingTranslation] = useState(false);
  // Phase 7: Chained Playback Mode ("Arabic Recitation -> Spoken Audio Translation")
  const [webIsChainedPlayback, setWebIsChainedPlayback] = useState(false);
  const webIsChainedPlaybackRef = useRef(false);
  useEffect(() => {
    webIsChainedPlaybackRef.current = webIsChainedPlayback;
  }, [webIsChainedPlayback]);
  const [webChainedStep, setWebChainedStep] = useState<
    "idle" | "arabic" | "translation"
  >("idle");
  // Phase 7: Audio element refs
  const webRecitationAudioRef = useRef<HTMLAudioElement | null>(null);
  const webTranslationAudioRef = useRef<HTMLAudioElement | null>(null);
  const [wordByWordMode, setWordByWordMode] = useState<boolean>(false);
  const [showTajweed, setShowTajweed] = useState<boolean>(false);
  const [isTajweedGuideModalOpen, setIsTajweedGuideModalOpen] =
    useState<boolean>(false);
  const [nightLight, setNightLight] = useState<boolean>(false);
  const [nightLightIntensity, setNightLightIntensity] = useState<number>(20);
  const [dailyTargetType, setDailyTargetType] = useState<
    "1_page" | "5_ayahs" | "10_ayahs" | "1_juz" | "custom"
  >("5_ayahs");
  const [dailyTargetCustomAyahs, setDailyTargetCustomAyahs] =
    useState<number>(7);
  const [isReaderSettingsModalOpen, setIsReaderSettingsModalOpen] =
    useState(false);
  const [todayReadCount, setTodayReadCount] = useState<number>(0);

  // Load saved settings from localStorage and Firestore on mount / user change + real-time sync
  useEffect(() => {
    let isMounted = true;
    const applySettings = (settings: Record<string, any>) => {
      if (!isMounted || !settings || typeof settings !== "object") return;
      const arabicSize = settings.fontSizeArabic || settings.arabicFontSize;
      if (arabicSize) setFontSizeArabic(arabicSize);
      const transSize =
        settings.fontSizeTranslation || settings.translationFontSize;
      if (transSize) setFontSizeTranslation(transSize);
      if (settings.showTranslation !== undefined)
        setShowTranslation(settings.showTranslation);
      if (settings.showTransliteration !== undefined)
        setShowTransliteration(settings.showTransliteration);
      const rawTheme = settings.readerTheme || settings.readingMode;
      const theme =
        rawTheme === "emerald"
          ? "green"
          : rawTheme === "midnight"
            ? "dark"
            : rawTheme;
      if (theme) setReaderTheme(theme);
      if (settings.arabicFont) {
        setArabicFont(
          settings.arabicFont === "scheherazade" ? "scheherazade" : "amiri"
        );
      }
      if (settings.selectedTransLang || settings.translationLanguage) {
        setSelectedTransLang(
          settings.selectedTransLang || settings.translationLanguage,
        );
      }
      if (settings.wordByWordMode !== undefined)
        setWordByWordMode(settings.wordByWordMode);
      if (settings.showTajweed !== undefined)
        setShowTajweed(settings.showTajweed);
      if (settings.nightLight !== undefined) setNightLight(settings.nightLight);
      if (settings.nightLightIntensity)
        setNightLightIntensity(settings.nightLightIntensity);
      if (settings.dailyTargetType)
        setDailyTargetType(settings.dailyTargetType);
      if (settings.dailyTargetCustomAyahs)
        setDailyTargetCustomAyahs(settings.dailyTargetCustomAyahs);
      if (typeof settings.todayReadCount === "number") {
        const todayStr = new Date().toISOString().slice(0, 10);
        if (!settings.todayReadDate || settings.todayReadDate === todayStr) {
          setTodayReadCount(settings.todayReadCount);
        } else {
          setTodayReadCount(0);
        }
      }
    };

    getQuranReaderSettings(user?.uid)
      .then(applySettings)
      .catch(() => {});

    const unsub = subscribeQuranReaderSettings(user?.uid, applySettings);

    return () => {
      isMounted = false;
      unsub();
    };
  }, [user?.uid]);

  const saveSettingsToStorage = (updated: Record<string, any>) => {
    const resolvedTheme =
      updated.readerTheme ?? updated.readingMode ?? readerTheme;
    const resolvedLang =
      updated.selectedTransLang ??
      updated.translationLanguage ??
      selectedTransLang;
    const payload = {
      ...updated,
      fontSizeArabic:
        updated.fontSizeArabic ?? updated.arabicFontSize ?? fontSizeArabic,
      arabicFontSize:
        updated.arabicFontSize ?? updated.fontSizeArabic ?? fontSizeArabic,
      fontSizeTranslation:
        updated.fontSizeTranslation ??
        updated.translationFontSize ??
        fontSizeTranslation,
      translationFontSize:
        updated.translationFontSize ??
        updated.fontSizeTranslation ??
        fontSizeTranslation,
      readerTheme: resolvedTheme,
      readingMode: resolvedTheme,
      selectedTransLang: resolvedLang,
      translationLanguage: resolvedLang,
    };
    saveQuranReaderSettings(payload, user?.uid).catch(() => {});
  };

  const [viewMode, setViewMode] = useState<"mushaf" | "verses">("verses");
  const [activeAyah, setActiveAyah] = useState<Verse | null>(null);
  const searchParams = useSearchParams();
  const paramAyah = searchParams.get("ayah") || searchParams.get("verse");

  // Phase 3 Deep-Link: Auto-scroll & highlight target Ayah when loaded with ?ayah=:verseId
  useEffect(() => {
    if (!surah || !paramAyah) return;
    const parsedV = parseInt(paramAyah, 10);
    if (isNaN(parsedV) || parsedV < 1) return;

    const targetVerse = surah.verses.find((v) => v.id === parsedV);
    if (targetVerse) {
      setActiveAyah(targetVerse);
    }

    const tryScroll = (attempts = 0) => {
      const el = document.getElementById(`verse-${parsedV}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.style.transition = "box-shadow 0.3s ease, outline 0.3s ease";
        el.style.outline = "2.5px solid var(--accent-gold, #d4af37)";
        el.style.borderRadius = "8px";
        setTimeout(() => {
          if (el) el.style.outline = "none";
        }, 2800);
      } else if (attempts < 10) {
        setTimeout(() => tryScroll(attempts + 1), 60);
      }
    };
    setTimeout(() => tryScroll(0), 100);
  }, [surah, paramAyah]);
  const [isWebSurahAudioPlaying, setIsWebSurahAudioPlaying] = useState(false);
  const [showMobileControls, setShowMobileControls] = useState(false);
  const [isVerseActionMenuOpen, setIsVerseActionMenuOpen] = useState(false);
  const [verseActionSubView, setVerseActionSubView] = useState<string | null>(
    null,
  );
  const [verseReflectionText, setVerseReflectionText] = useState("");
  const [existingAyahReflection, setExistingAyahReflection] =
    useState<QuranReflectionItem | null>(null);
  const [isLoadingAyahReflection, setIsLoadingAyahReflection] =
    useState<boolean>(false);
  const [isVerseMemorizeBlurred, setIsVerseMemorizeBlurred] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "info" | "warn">(
    "success",
  );

  // Sync existing reflection for active Ayah when Verse Action Menu opens
  useEffect(() => {
    if (!isVerseActionMenuOpen || !activeAyah || !surah) {
      setExistingAyahReflection(null);
      setVerseReflectionText("");
      return;
    }
    setIsLoadingAyahReflection(true);
    getQuranReflections(user?.uid)
      .then((reflections) => {
        const found = reflections.find(
          (r) => r.surahId === surah.id && r.verseId === activeAyah.id,
        );
        if (found) {
          setExistingAyahReflection(found);
          setVerseReflectionText(found.note);
        } else {
          setExistingAyahReflection(null);
          setVerseReflectionText("");
        }
      })
      .catch(() => {
        setExistingAyahReflection(null);
        setVerseReflectionText("");
      })
      .finally(() => {
        setIsLoadingAyahReflection(false);
      });
  }, [isVerseActionMenuOpen, activeAyah, surah?.id, user?.uid]);

  const showToast = useCallback(
    (msg: string, type: "success" | "info" | "warn" = "success") => {
      setToastMsg(msg);
      setToastType(type);
      setTimeout(() => setToastMsg(null), 2800);
    },
    [],
  );

  // ─── Phase 7: Web Audio URL Helpers ───────────────────────────────────────
  // EveryAyah CDN for verse-level Arabic recitation
  const WEB_AUDIO_TRANSLATIONS = [
    {
      id: "en",
      language: "English",
      speakerName: "Saheeh International",
      serverUrl: "https://everyayah.com/data/translations/",
    },
    {
      id: "yoruba",
      language: "Yorùbá",
      speakerName: "Malam Yusuf Yorùbá Audio",
      serverUrl: "https://everyayah.com/data/translations/",
    },
    {
      id: "hausa",
      language: "Hausa",
      speakerName: "Sheikh Abubakar Gumi",
      serverUrl: "https://everyayah.com/data/translations/",
    },
  ];
  const getWebVerseRecitationUrl = (
    qariId: string,
    surahId: number,
    verseId: number,
  ): string => {
    const q =
      webQaris.find((r) => r.id === qariId) || webQaris[0] || QARIS_LIST[0];
    const s = String(surahId).padStart(3, "0");
    const v = String(verseId).padStart(3, "0");
    const path = normalizeEveryayahPath(q?.everyayahPath);
    return `https://everyayah.com/data/${path}/${s}${v}.mp3`;
  };
  const getWebVerseTranslationUrl = (
    langId: string,
    surahId: number,
    verseId: number,
  ): string => {
    if (langId === "igbo") return "";
    const t =
      WEB_AUDIO_TRANSLATIONS.find((r) => r.id === langId) ||
      WEB_AUDIO_TRANSLATIONS[0];
    const s = String(surahId).padStart(3, "0");
    const v = String(verseId).padStart(3, "0");
    return `${t.serverUrl}${s}${v}.mp3`;
  };

  // Helper to resolve localized translation text for web reader
  const getWebLanguageTranslation = (
    lang: string,
    defaultEn: string,
    verseId: number,
    surahName: string,
    surahIdNumber?: number,
  ): string => {
    if (lang === "igbo") {
      return "Central Igbo Qur'an translation is currently in preparation (Coming soon).";
    }
    return resolveIndigenousTranslation(
      lang,
      surahIdNumber ?? surah?.id ?? 1,
      verseId,
      defaultEn,
      surahName,
    );
  };

  // Register pause callback with Web Audio Coordinator so Surah audio pauses single-verse audio
  useEffect(() => {
    const unregister = registerWebAudioPause("verse", () => {
      if (
        webRecitationAudioRef.current &&
        !webRecitationAudioRef.current.paused
      ) {
        webRecitationAudioRef.current.pause();
      }
      if (
        webTranslationAudioRef.current &&
        !webTranslationAudioRef.current.paused
      ) {
        webTranslationAudioRef.current.pause();
      }
      setWebIsPlayingRecitation(false);
      setWebIsPlayingTranslation(false);
      setWebChainedStep("idle");
    });
    return () => unregister();
  }, []);

  // Play/pause helpers for web audio with Chained Playback Mode
  const webPlayRecitation = (url: string) => {
    // Notify coordinator to automatically pause any full-surah audio playback
    notifyWebAudioStarted("verse");

    if (webRecitationAudioRef.current) {
      webRecitationAudioRef.current.pause();
    }
    const audio = new Audio(url);
    webRecitationAudioRef.current = audio;
    audio.onplay = () => setWebIsPlayingRecitation(true);
    audio.onpause = () => setWebIsPlayingRecitation(false);
    audio.onended = () => {
      setWebIsPlayingRecitation(false);
      // Auto-chain into spoken translation audio if enabled
      if (webIsChainedPlaybackRef.current && activeAyah && surah) {
        setWebChainedStep("translation");
        const transUrl = getWebVerseTranslationUrl(
          webAudioTranslationLang,
          surah.id,
          activeAyah.id,
        );
        if (!transUrl) {
          setWebChainedStep("idle");
        } else {
          webPlayTranslation(transUrl);
        }
      } else {
        setWebChainedStep("idle");
      }
    };
    audio.play().catch(() => {
      setWebIsPlayingRecitation(false);
      setWebChainedStep("idle");
    });
  };

  const webToggleRecitation = (url: string) => {
    const current = webRecitationAudioRef.current;
    if (
      current &&
      !current.paused &&
      current.src.endsWith(url.split("/").pop()!)
    ) {
      current.pause();
      setWebChainedStep("idle");
    } else {
      setWebChainedStep("arabic");
      webPlayRecitation(url);
    }
  };

  const webPlayTranslation = (url: string) => {
    if (!url) {
      setWebIsPlayingTranslation(false);
      setWebChainedStep("idle");
      return;
    }

    // Notify coordinator to automatically pause any full-surah audio playback
    notifyWebAudioStarted("verse");

    if (webTranslationAudioRef.current) {
      webTranslationAudioRef.current.pause();
    }
    const audio = new Audio(url);
    webTranslationAudioRef.current = audio;
    audio.onplay = () => setWebIsPlayingTranslation(true);
    audio.onpause = () => setWebIsPlayingTranslation(false);
    audio.onended = () => {
      setWebIsPlayingTranslation(false);
      setWebChainedStep("idle");
    };
    audio.play().catch(() => {
      setWebIsPlayingTranslation(false);
      setWebChainedStep("idle");
    });
  };

  const webToggleTranslation = (url: string) => {
    if (!url) {
      setWebChainedStep("idle");
      return;
    }
    const current = webTranslationAudioRef.current;
    if (current && !current.paused) {
      current.pause();
    } else {
      webPlayTranslation(url);
    }
  };

  // Stop all audio when modal closes
  useEffect(() => {
    if (!isVerseActionMenuOpen) {
      webRecitationAudioRef.current?.pause();
      webTranslationAudioRef.current?.pause();
      setWebIsPlayingRecitation(false);
      setWebIsPlayingTranslation(false);
      setWebChainedStep("idle");
    }
  }, [isVerseActionMenuOpen]);

  // Stop translation audio when language switches
  useEffect(() => {
    webTranslationAudioRef.current?.pause();
    setWebIsPlayingTranslation(false);
  }, [selectedTransLang, webAudioTranslationLang]);

  const handleSaveAyahToStorage = async (verse: Verse) => {
    if (!surah) return;
    try {
      await saveAyahToFolder(
        {
          surahId: surah.id,
          surahName: surah.transliteration,
          verseId: verse.id,
          arabic: verse.text,
          translation: verse.translation,
          folder: "Favorites",
        },
        user?.uid,
      );
      showToast(`Ayah ${verse.id} saved to Favorites! ★`);
    } catch {
      showToast("Could not save ayah.", "warn");
    }
  };

  // Phase 4: Memorization Mode Setup & Active Session (Web)
  const [isWebMemorizeActive, setIsWebMemorizeActive] = useState(false);
  const [webMemorizeScope, setWebMemorizeScope] = useState<
    "this" | "range" | "surah"
  >("this");
  const [webMemorizeRangeEnd, setWebMemorizeRangeEnd] = useState<number>(1);
  const [webMemorizeMethod, setWebMemorizeMethod] = useState<
    "repeat" | "blur" | "write"
  >("repeat");
  const [webMemorizeReps, setWebMemorizeReps] = useState<number>(5);
  const [webMemorizeInterval, setWebMemorizeInterval] = useState<number>(3);
  const [webMemorizeAutoAdvance, setWebMemorizeAutoAdvance] =
    useState<boolean>(true);

  // Active Session State
  const [webMemCurrentVerseIdx, setWebMemCurrentVerseIdx] = useState<number>(0);
  const [webMemRepCount, setWebMemRepCount] = useState<number>(1);
  const [webMemCountdown, setWebMemCountdown] = useState<number | null>(null);
  const [webMemIsBlurred, setWebMemIsBlurred] = useState<boolean>(true);
  const [webMemUserWriting, setWebMemUserWriting] = useState<string>("");
  const [webMemShowHint, setWebMemShowHint] = useState<boolean>(false);
  const [webMemIsCompleted, setWebMemIsCompleted] = useState<boolean>(false);
  const [webMemCompletedCount, setWebMemCompletedCount] = useState<number>(0);

  // Phase 5: Full-Text Quran Search Modal State
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchScope, setSearchScope] = useState<
    "all" | "arabic" | "english" | "transliteration"
  >("all");
  const [searchResults, setSearchResults] = useState<{
    surahs: any[];
    verses: any[];
    total: number;
  }>({
    surahs: [],
    verses: [],
    total: 0,
  });
  const [searchLoading, setSearchLoading] = useState(false);

  // Debounced search for Reader Search Modal
  useEffect(() => {
    if (!isSearchModalOpen || !searchQuery.trim()) {
      setSearchResults({ surahs: [], verses: [], total: 0 });
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/read/quran/search?q=${encodeURIComponent(searchQuery.trim())}&scope=${searchScope}&limit=50`,
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch (err) {
        console.error("Reader search error:", err);
      } finally {
        setSearchLoading(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [searchQuery, searchScope, isSearchModalOpen]);

  // Keyboard shortcut Ctrl+K / Cmd+K to toggle Search Modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchModalOpen((prev) => !prev);
      }
      if (e.key === "Escape" && isSearchModalOpen) {
        setIsSearchModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSearchModalOpen]);

  const handleJumpToSearchResult = (
    targetSurahId: number,
    targetVerseId: number,
  ) => {
    setIsSearchModalOpen(false);
    if (targetSurahId === surahId) {
      if (surah) {
        const found = surah.verses.find((v) => v.id === targetVerseId);
        if (found) {
          setActiveAyah(found);
        }
      }
      const el = document.getElementById(`verse-${targetVerseId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } else {
      router.push(`/quran/${targetSurahId}#verse-${targetVerseId}`);
    }
  };

  // Ayah Jump / Go to Verse State & Handlers (Web)
  const [isJumpModalOpen, setIsJumpModalOpen] = useState(false);
  const [jumpVerseInput, setJumpVerseInput] = useState("1");
  const [jumpTab, setJumpTab] = useState<"this" | "any">("this");
  const [jumpTargetSurahId, setJumpTargetSurahId] = useState<number>(surahId);
  const [jumpSurahSearchQuery, setJumpSurahSearchQuery] = useState("");

  // Keyboard shortcut: Press 'J' or 'Alt+J' / 'Cmd+J' to open Ayah Jump Modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInputActive =
        activeTag === "input" ||
        activeTag === "textarea" ||
        activeTag === "select";

      if (!isInputActive && (e.key === "j" || e.key === "J")) {
        e.preventDefault();
        setJumpVerseInput("1");
        setJumpTargetSurahId(surahId);
        setIsJumpModalOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "j" || e.key === "J")) {
        e.preventDefault();
        setIsJumpModalOpen((prev) => !prev);
      }
      if (e.key === "Escape" && isJumpModalOpen) {
        setIsJumpModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isJumpModalOpen, surahId]);

  const handleExecuteJumpWeb = (
    customTargetVerse?: number,
    customTargetSurah?: number,
  ) => {
    const targetSurah =
      customTargetSurah !== undefined
        ? customTargetSurah
        : jumpTab === "this"
          ? surahId
          : jumpTargetSurahId;
    const parsedV =
      customTargetVerse !== undefined
        ? customTargetVerse
        : parseInt(jumpVerseInput, 10);
    if (isNaN(parsedV) || parsedV < 1) return;

    setIsJumpModalOpen(false);

    if (targetSurah === surahId) {
      if (surah) {
        const found = surah.verses.find((v) => v.id === parsedV);
        if (found) {
          setActiveAyah(found);
        }
      }
      const tryScroll = (attempts = 0) => {
        const el = document.getElementById(`verse-${parsedV}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.style.transition = "box-shadow 0.3s ease, outline 0.3s ease";
          el.style.outline = "2.5px solid var(--accent-gold, #d4af37)";
          el.style.borderRadius = "8px";
          setTimeout(() => {
            if (el) el.style.outline = "none";
          }, 2500);
        } else if (attempts < 6) {
          setTimeout(() => tryScroll(attempts + 1), 60);
        }
      };
      setTimeout(() => tryScroll(0), 40);
      showToast(`Jumped to Ayah ${parsedV}`);
    } else {
      router.push(`/quran/${targetSurah}#verse-${parsedV}`);
    }
  };

  // Sync range end when active ayah changes
  useEffect(() => {
    if (activeAyah && surah) {
      setWebMemorizeRangeEnd(Math.min(surah.total_verses, activeAyah.id + 4));
    }
  }, [activeAyah, surah]);

  // Target verses for memorization session
  const webTargetVerses = React.useMemo(() => {
    if (!surah) return [];
    if (webMemorizeScope === "this" && activeAyah) {
      return [activeAyah];
    }
    if (webMemorizeScope === "range" && activeAyah) {
      const s = Math.min(activeAyah.id, webMemorizeRangeEnd);
      const e = Math.max(activeAyah.id, webMemorizeRangeEnd);
      return surah.verses.filter((v) => v.id >= s && v.id <= e);
    }
    return surah.verses;
  }, [surah, webMemorizeScope, webMemorizeRangeEnd, activeAyah]);

  // Interval timer for web memorization repeat mode
  useEffect(() => {
    if (
      !isWebMemorizeActive ||
      webMemorizeMethod !== "repeat" ||
      webMemCountdown === null
    ) {
      return;
    }
    if (webMemCountdown > 0) {
      const timer = setTimeout(() => {
        setWebMemCountdown(webMemCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
    if (webMemCountdown === 0) {
      if (webMemRepCount < webMemorizeReps) {
        setWebMemRepCount((prev) => prev + 1);
        setWebMemCountdown(null);
      } else {
        setWebMemCountdown(null);
        if (webMemorizeAutoAdvance) {
          handleWebMemNext();
        }
      }
    }
  }, [
    isWebMemorizeActive,
    webMemorizeMethod,
    webMemCountdown,
    webMemRepCount,
    webMemorizeReps,
    webMemorizeAutoAdvance,
  ]);

  const stripTashkeelWeb = (text: string): string => {
    if (!text) return "";
    return text
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
      .replace(/ٱ/g, "ا")
      .replace(/[إأآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/\s+/g, " ")
      .trim();
  };

  const calculateSimilarityWeb = (str1: string, str2: string): number => {
    const s1 = stripTashkeelWeb(str1);
    const s2 = stripTashkeelWeb(str2);
    if (!s1 || !s2) return 0;
    if (s1 === s2) return 100;
    const words1 = s1.split(" ");
    const words2 = s2.split(" ");
    let matches = 0;
    for (const w of words2) {
      if (words1.includes(w)) matches++;
    }
    return Math.min(
      100,
      Math.round((matches / Math.max(words1.length, words2.length)) * 100),
    );
  };

  const handleStartWebMemorization = () => {
    setWebMemCurrentVerseIdx(0);
    setWebMemRepCount(1);
    setWebMemCountdown(null);
    setWebMemIsBlurred(true);
    setWebMemUserWriting("");
    setWebMemShowHint(false);
    setWebMemIsCompleted(false);
    setWebMemCompletedCount(0);
    setIsVerseActionMenuOpen(false);
    setVerseActionSubView(null);
    setIsWebMemorizeActive(true);
  };

  const handleSaveWebMemorizationPlan = async () => {
    if (!surah || !activeAyah) return;
    try {
      let startV = activeAyah.id;
      let endV = activeAyah.id;
      if (webMemorizeScope === "range") {
        startV = Math.min(activeAyah.id, webMemorizeRangeEnd);
        endV = Math.max(activeAyah.id, webMemorizeRangeEnd);
      } else if (webMemorizeScope === "surah") {
        startV = 1;
        endV = surah.total_verses;
      }
      await saveMemorizationPlan(
        {
          surahId: surah.id,
          surahName: surah.transliteration,
          startVerse: startV,
          endVerse: endV,
          repetitions: webMemorizeReps,
          intervalSec: webMemorizeInterval,
          method: webMemorizeMethod,
          status: "in_progress",
        },
        user?.uid,
      );
      showToast("Memorization plan saved!");
      setVerseActionSubView(null);
    } catch {
      showToast("Could not save plan.", "warn");
    }
  };

  const handleWebMemNext = () => {
    setWebMemCompletedCount((prev) => prev + 1);
    if (webMemCurrentVerseIdx < webTargetVerses.length - 1) {
      setWebMemCurrentVerseIdx((prev) => prev + 1);
      setWebMemRepCount(1);
      setWebMemCountdown(null);
      setWebMemIsBlurred(true);
      setWebMemUserWriting("");
      setWebMemShowHint(false);
    } else {
      setWebMemIsCompleted(true);
    }
  };

  const handleWebMemPrev = () => {
    if (webMemCurrentVerseIdx > 0) {
      setWebMemCurrentVerseIdx((prev) => prev - 1);
      setWebMemRepCount(1);
      setWebMemCountdown(null);
      setWebMemIsBlurred(true);
      setWebMemUserWriting("");
      setWebMemShowHint(false);
    }
  };

  const handleWebMarkMastered = async () => {
    try {
      const plans = await getMemorizationPlans(user?.uid);
      if (plans.length > 0) {
        await updateMemorizationStatus(plans[0].id, "mastered", user?.uid);
      }
      showToast("Marked as mastered! ★");
    } catch {
      // ignore
    }
    setWebMemIsCompleted(false);
    setIsWebMemorizeActive(false);
  };

  const [hasScrolled, setHasScrolled] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Fetch individual Surah and Surah list (for quick dropdown navigation)
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        // Fetch Surah details
        const res = await fetch(`/api/read/quran/${surahId}`);
        if (!res.ok) {
          throw new Error(`Failed to load Surah ${surahId}`);
        }
        const data = await res.json();
        const sanitizedData = {
          ...data,
          verses: (data.verses || []).map((v: any) => ({
            ...v,
            text: cleanArabicText(v.text),
          })),
        };
        setSurah(sanitizedData);

        // Fetch Surah list if not already loaded
        if (surahList.length === 0) {
          const listRes = await fetch("/api/read/quran");
          if (listRes.ok) {
            const listData = await listRes.json();
            setSurahList(listData);
          }
        }
      } catch (err: any) {
        setError(err.message || "An error occurred while loading content");
      } finally {
        setLoading(false);
      }
    }
    if (surahId >= 1 && surahId <= 114) {
      fetchData();
    } else {
      setError("Invalid Surah ID. Please select a chapter between 1 and 114.");
      setLoading(false);
    }
  }, [surahId]);

  // Reset scroll tracker on Surah change
  useEffect(() => {
    setHasScrolled(false);
  }, [surahId]);

  // Auto-scroll to target verse (from search, bookmark or hash) on mount / hash change
  useEffect(() => {
    if (!surah) return;

    const performJump = () => {
      let targetVerseId: number | null = null;

      if (typeof window !== "undefined" && window.location.hash) {
        const match = window.location.hash.match(/verse-(\d+)/);
        if (match) {
          targetVerseId = parseInt(match[1], 10);
        }
      }

      if (
        !targetVerseId &&
        !hasScrolled &&
        quranBookmark?.surahId === surahId
      ) {
        targetVerseId = quranBookmark.verseId;
      }

      if (targetVerseId) {
        const timer = setTimeout(() => {
          const element = document.getElementById(`verse-${targetVerseId}`);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            element.style.transition =
              "box-shadow 0.3s ease, outline 0.3s ease";
            element.style.outline = "2.5px solid var(--accent-gold, #d4af37)";
            element.style.borderRadius = "8px";
            setTimeout(() => {
              if (element) element.style.outline = "none";
            }, 2500);
            setHasScrolled(true);
            const found = surah.verses.find((v) => v.id === targetVerseId);
            if (found) {
              setActiveAyah(found);
            }
          }
        }, 300);
        return () => clearTimeout(timer);
      }
    };

    performJump();
    window.addEventListener("hashchange", performJump);
    return () => window.removeEventListener("hashchange", performJump);
  }, [surah, surahId, quranBookmark, hasScrolled]);

  const handleShareSurah = async () => {
    if (!surah) return;
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== "undefined" ? window.location.origin : "");
    const shareData = {
      title: `Surah ${surah.transliteration} (${surah.name}) - Noor Library`,
      text: `Read Surah ${surah.transliteration} with calligraphic script and complete translations on Noor Library.`,
      url: `${baseUrl}/quran/${surahId}`,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // Ignored
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareData.url);
        alert(`Link to Surah ${surah.transliteration} copied to clipboard!`);
      } catch (err) {
        // Clipboard failed
      }
    }
  };

  const handleShareVerse = async (verse: Verse) => {
    if (!surah) return;
    const url = getQuranUrl(surah.id, verse.id);
    const shareData = {
      title: `Surah ${surah.transliteration}, Verse ${verse.id} - Noor Library`,
      text: `${verse.text}\n\n"${verse.translation}"\n\n— Noble Quran, Surah ${surah.transliteration} (${surah.name}) [${surah.id}:${verse.id}]\n\nRead on Noor Library:\n${url}`,
      url: url,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // Ignored
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareData.url);
        alert(`Link to Verse ${verse.id} copied to clipboard!`);
      } catch (err) {
        // Clipboard failed
      }
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          flexDirection: "column",
          gap: "1rem",
          paddingTop: "100px",
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            border: "3px solid var(--border-color)",
            borderTopColor: "var(--accent-gold)",
            animation: "spin 1s linear infinite",
          }}
        />
        <p style={{ color: "var(--text-secondary)" }}>Loading Surah...</p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error || !surah) {
    return (
      <div
        className="container"
        style={{
          paddingTop: "120px",
          paddingBottom: "5rem",
          minHeight: "80vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          className="accent-card"
          style={{
            textAlign: "center",
            padding: "3rem",
            maxWidth: "500px",
            borderColor: "var(--accent-red)",
          }}
        >
          <h3 style={{ marginBottom: "1rem", color: "var(--accent-red)" }}>
            Error Loading Reader
          </h3>
          <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
            {error || "Surah data is missing."}
          </p>
          <Link href="/quran" className="btn btn-primary">
            Back to Quran Index
          </Link>
        </div>
      </div>
    );
  }

  // Theme styling definitions
  const themeStyles = {
    light: {
      bg: "var(--bg-secondary)",
      border: "var(--border-color)",
      text: "var(--text-primary)",
      textMuted: "var(--text-secondary)",
      verseBg: "transparent",
      verseHover: "rgba(220, 38, 38, 0.02)",
      arabic: "var(--text-primary)",
    },
    cream: {
      bg: "#FAF7EE",
      border: "rgba(220, 38, 38, 0.15)",
      text: "#1C1917",
      textMuted: "#57534E",
      verseBg: "#F5EEDC",
      verseHover: "rgba(212, 175, 55, 0.15)",
      arabic: "#1C1917",
    },
    sepia: {
      bg: "#fcf8ee",
      border: "#eadeca",
      text: "#433422",
      textMuted: "#6b583f",
      verseBg: "#f5edd6",
      verseHover: "rgba(212, 175, 55, 0.1)",
      arabic: "#2a1b0c",
    },
    green: {
      bg: "#F0FDF4",
      border: "rgba(22, 101, 52, 0.22)",
      text: "#14532D",
      textMuted: "#166534",
      verseBg: "#DCFCE7",
      verseHover: "rgba(22, 101, 52, 0.08)",
      arabic: "#052E16",
    },
    dark: {
      bg: "#0b0f19",
      border: "#1e293b",
      text: "#f8fafc",
      textMuted: "#94a3b8",
      verseBg: "#161f30",
      verseHover: "rgba(255, 255, 255, 0.02)",
      arabic: "#f8fafc",
    },
  }[readerTheme];

  const getArabicFontFamilyWeb = (f: string) => {
    switch (f) {
      case "scheherazade":
        return "'Scheherazade New', serif";
      case "amiri":
      default:
        return "'Amiri', serif";
    }
  };

  return (
    <div
      style={{
        paddingTop: "100px",
        paddingBottom: "5rem",
        minHeight: "100vh",
        backgroundColor:
          readerTheme === "dark"
            ? "#0b0f19"
            : readerTheme === "cream"
              ? "#FAF7EE"
              : readerTheme === "green"
                ? "#F0FDF4"
                : readerTheme === "sepia"
                  ? "#fcf8ee"
                  : "var(--bg-primary)",
        transition: "background-color 0.3s ease",
      }}
    >
      {/* Import calligraphic Arabic fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400;1,700&family=Scheherazade+New:wght@400;700&display=swap');
        .quran-arabic-text {
          font-family: ${getArabicFontFamilyWeb(arabicFont)};
          line-height: 2.2;
          text-align: right;
          direction: rtl;
        }
      `}</style>

      {/* Local component styles for mobile controls responsiveness */}
      {/* Plain style tag for responsive controls */}
      <style>{`
        @media (min-width: 769px) {
          .top-controls-row {
            width: auto !important;
          }
          .mobile-settings-toggle-btn {
            display: none !important;
          }
        }
        @media (max-width: 768px) {
          .top-controls-row {
            width: 100% !important;
          }
          .settings-controls-panel {
            display: ${showMobileControls ? "flex" : "none"} !important;
            width: 100% !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 1.25rem !important;
            padding-top: 1.25rem !important;
            border-top: 1px dashed ${themeStyles.border} !important;
          }
          .mobile-settings-toggle-btn {
            display: inline-flex !important;
          }
        }
        .reader-card-wrapper {
          padding: 3rem 2.5rem !important;
        }
        @media (max-width: 580px) {
          .reader-card-wrapper {
            padding: 2rem 1.25rem !important;
          }
        }
        @media (max-width: 360px) {
          .reader-card-wrapper {
            padding: 1.5rem 0.75rem !important;
          }
        }
      `}</style>

      {/* Reader Settings Control Bar */}
      <section
        style={{
          position: "sticky",
          top: "80px",
          zIndex: 10,
          background: themeStyles.bg,
          borderBottom: `1px solid ${themeStyles.border}`,
          color: themeStyles.text,
          transition: "var(--transition-smooth)",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
        }}
      >
        <div
          className="container"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "1rem 2rem",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          {/* Top Row: Back link, selector, and mobile toggle */}
          <div
            className="top-controls-row"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "0.75rem",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                flexWrap: "wrap",
              }}
            >
              <Link
                href="/quran"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  color: themeStyles.textMuted,
                  fontSize: "0.9rem",
                  fontWeight: 600,
                }}
              >
                &larr; Index
              </Link>

              <button
                onClick={() => setIsChapterDrawerOpen(true)}
                className="btn"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.38rem 0.85rem",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  borderRadius: "var(--radius-md)",
                  border: `1px solid var(--accent-red)`,
                  backgroundColor: "rgba(220, 38, 38, 0.08)",
                  color: "var(--accent-red)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                title="Browse and jump to any of the 114 Quran chapters"
              >
                <span>☰</span> Chapters Hub
              </button>

              <button
                onClick={() => setIsSearchModalOpen(true)}
                className="btn"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.38rem 0.85rem",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  borderRadius: "var(--radius-md)",
                  border: "1px solid rgba(212, 175, 55, 0.45)",
                  backgroundColor: "rgba(212, 175, 55, 0.12)",
                  color: "var(--accent-gold)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                title="Full-text search across all 6,236 Ayahs (Ctrl+K)"
              >
                <span>🔍</span> Search Quran
                <span
                  style={{
                    fontSize: "0.68rem",
                    padding: "1px 5px",
                    borderRadius: "4px",
                    backgroundColor: "rgba(212, 175, 55, 0.2)",
                    color: "var(--accent-gold)",
                    marginLeft: "2px",
                  }}
                >
                  ⌘K
                </span>
              </button>

              <button
                onClick={() => {
                  setJumpVerseInput("1");
                  setJumpTargetSurahId(surahId);
                  setIsJumpModalOpen(true);
                }}
                className="btn"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.38rem 0.85rem",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  borderRadius: "var(--radius-md)",
                  border: "1px solid rgba(212, 175, 55, 0.45)",
                  backgroundColor: "rgba(212, 175, 55, 0.12)",
                  color: "var(--accent-gold)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                title="Go to Verse / Jump directly to any Ayah in this Surah or Quran (Press J)"
              >
                <span>🎯</span> Go to Verse
                <span
                  style={{
                    fontSize: "0.68rem",
                    padding: "1px 5px",
                    borderRadius: "4px",
                    backgroundColor: "rgba(212, 175, 55, 0.2)",
                    color: "var(--accent-gold)",
                    marginLeft: "2px",
                  }}
                >
                  J
                </span>
              </button>

              <button
                onClick={() => {
                  setWebHubInitialTab("audio");
                  setIsWebHubOpen(true);
                }}
                className="btn"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.38rem 0.85rem",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  borderRadius: "var(--radius-md)",
                  border: "1px solid rgba(212, 175, 55, 0.45)",
                  backgroundColor: "rgba(212, 175, 55, 0.12)",
                  color: "#D4AF37",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                title="Listen to full Surah recitation and choose reciters"
              >
                <span>🎙️</span> Audio Reciter
              </button>

              <button
                onClick={() => {
                  setWebHubInitialTab("reflections");
                  setIsWebHubOpen(true);
                }}
                className="btn"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.38rem 0.85rem",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  borderRadius: "var(--radius-md)",
                  border: "1px solid rgba(99, 102, 241, 0.45)",
                  backgroundColor: "rgba(99, 102, 241, 0.12)",
                  color: "#6366F1",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                title="Open Study Hub (Reflections, Saved Ayahs, Memorization, Qaris)"
              >
                <span>✨</span> Quran Hub
              </button>

              {surah && (
                <button
                  onClick={handleShareSurah}
                  className="btn btn-secondary"
                  style={{
                    padding: "0.4rem 0.8rem",
                    fontSize: "0.85rem",
                    borderRadius: "var(--radius-md)",
                    borderColor: themeStyles.border,
                    color: "var(--accent-gold)",
                    backgroundColor:
                      themeStyles.verseBg === "transparent"
                        ? "var(--bg-primary)"
                        : themeStyles.verseBg,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    fontWeight: 600,
                  }}
                  title="Share Surah"
                >
                  <span>🔗</span>
                  <span>Share</span>
                </button>
              )}

              <button
                onClick={() => setIsReaderSettingsModalOpen(true)}
                className="btn"
                style={{
                  padding: "0.4rem 0.85rem",
                  fontSize: "0.85rem",
                  borderRadius: "var(--radius-md)",
                  border: `1px solid ${themeStyles.border}`,
                  backgroundColor: isReaderSettingsModalOpen
                    ? "rgba(212, 175, 55, 0.15)"
                    : themeStyles.verseBg,
                  color: isReaderSettingsModalOpen
                    ? "var(--accent-gold)"
                    : themeStyles.text,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  fontWeight: 600,
                }}
                title="Open Reader Settings (Phase 6)"
              >
                <span>⚙️</span>
                <span>Settings</span>
              </button>
            </div>          
          </div>

          {/* Sizing & Visibilities Panel (collapsible on mobile) */}
          <div
            className="settings-controls-panel"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1.25rem",
              flexWrap: "wrap",
            }}
          >
            {/* Sizing controls */}
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <span
                style={{ fontSize: "0.8rem", color: themeStyles.textMuted }}
              >
                Arabic:
              </span>
              <button
                onClick={() =>
                  setFontSizeArabic(Math.max(20, fontSizeArabic - 4))
                }
                style={{
                  background: themeStyles.verseBg,
                  border: `1px solid ${themeStyles.border}`,
                  color: themeStyles.text,
                  borderRadius: "4px",
                  width: "28px",
                  height: "28px",
                  cursor: "pointer",
                }}
              >
                A-
              </button>
              <button
                onClick={() =>
                  setFontSizeArabic(Math.min(56, fontSizeArabic + 4))
                }
                style={{
                  background: themeStyles.verseBg,
                  border: `1px solid ${themeStyles.border}`,
                  color: themeStyles.text,
                  borderRadius: "4px",
                  width: "28px",
                  height: "28px",
                  cursor: "pointer",
                }}
              >
                A+
              </button>
            </div>

            <div
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <span
                style={{ fontSize: "0.8rem", color: themeStyles.textMuted }}
              >
                Eng:
              </span>
              <button
                onClick={() =>
                  setFontSizeTranslation(Math.max(12, fontSizeTranslation - 2))
                }
                style={{
                  background: themeStyles.verseBg,
                  border: `1px solid ${themeStyles.border}`,
                  color: themeStyles.text,
                  borderRadius: "4px",
                  width: "28px",
                  height: "28px",
                  cursor: "pointer",
                }}
              >
                A-
              </button>
              <button
                onClick={() =>
                  setFontSizeTranslation(Math.min(28, fontSizeTranslation + 2))
                }
                style={{
                  background: themeStyles.verseBg,
                  border: `1px solid ${themeStyles.border}`,
                  color: themeStyles.text,
                  borderRadius: "4px",
                  width: "28px",
                  height: "28px",
                  cursor: "pointer",
                }}
              >
                A+
              </button>
            </div>

            {/* Visibility Toggle Toggles */}
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              <input
                type="checkbox"
                checked={showTranslation}
                onChange={() => setShowTranslation(!showTranslation)}
                style={{ accentColor: "var(--accent-gold)" }}
              />
              Translation
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              <input
                type="checkbox"
                checked={showTransliteration}
                onChange={() => setShowTransliteration(!showTransliteration)}
                style={{ accentColor: "var(--accent-gold)" }}
              />
              Transliteration
            </label>

            {/* View Mode Switcher */}
            <div
              style={{
                display: "flex",
                gap: "0.25rem",
                background: "rgba(0,0,0,0.06)",
                padding: "3px",
                borderRadius: "6px",
              }}
            >
              <button
                onClick={() => setViewMode("mushaf")}
                style={{
                  padding: "0.3rem 0.65rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  borderRadius: "4px",
                  cursor: "pointer",
                  border: "none",
                  background:
                    viewMode === "mushaf"
                      ? "var(--accent-red, #dc2626)"
                      : "transparent",
                  color: viewMode === "mushaf" ? "#ffffff" : themeStyles.text,
                }}
              >
                📖 Mushaf
              </button>
              <button
                onClick={() => setViewMode("verses")}
                style={{
                  padding: "0.3rem 0.65rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  borderRadius: "4px",
                  cursor: "pointer",
                  border: "none",
                  background:
                    viewMode === "verses"
                      ? "var(--accent-red, #dc2626)"
                      : "transparent",
                  color: viewMode === "verses" ? "#ffffff" : themeStyles.text,
                }}
              >
                📜 Verses
              </button>
            </div>

            {/* Themes Selection */}
            <div
              style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}
            >
              {(
                [
                  {
                    id: "light",
                    label: "Light",
                    bg: "#ffffff",
                    color: "#000000",
                  },
                  {
                    id: "cream",
                    label: "Cream",
                    bg: "#FAF7EE",
                    color: "#1C1917",
                  },
                  {
                    id: "sepia",
                    label: "Sepia",
                    bg: "#f4ecd8",
                    color: "#2a1b0c",
                  },
                  {
                    id: "green",
                    label: "Green",
                    bg: "#E8F5ED",
                    color: "#052E16",
                  },
                  {
                    id: "dark",
                    label: "Dark",
                    bg: "#1e293b",
                    color: "#ffffff",
                  },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setReaderTheme(t.id);
                    saveSettingsToStorage({ readerTheme: t.id });
                  }}
                  style={{
                    padding: "0.3rem 0.55rem",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textTransform: "capitalize",
                    borderRadius: "4px",
                    cursor: "pointer",
                    background: t.bg,
                    color: t.color,
                    border:
                      readerTheme === t.id
                        ? "2px solid var(--accent-gold)"
                        : "1px solid #ccc",
                  }}
                >
                  {t.label}
                </button>
              ))}

              <button
                onClick={() => setIsReaderSettingsModalOpen(true)}
                style={{
                  padding: "0.3rem 0.6rem",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  borderRadius: "4px",
                  cursor: "pointer",
                  border: "1px solid rgba(212, 175, 55, 0.4)",
                  background: "rgba(212, 175, 55, 0.12)",
                  color: "var(--accent-gold)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "2px",
                }}
                title="Full Reader Customization Panel"
              >
                ⚙️ More
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Reading Interface */}
      <section className="container" style={{ marginTop: "2.5rem" }}>
        <div
          className="reader-card-wrapper"
          style={{
            backgroundColor: themeStyles.bg,
            border: `1px solid ${themeStyles.border}`,
            borderRadius: "var(--radius-lg)",
            color: themeStyles.text,
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.03)",
            transition: "var(--transition-smooth)",
          }}
        >
          {/* Surah Header Banner */}
          <div
            style={{
              textAlign: "center",
              marginBottom: "3rem",
              borderBottom: `1px solid ${themeStyles.border}`,
              paddingBottom: "2rem",
            }}
          >
            <span
              className="badge badge-gold"
              style={{
                fontSize: "0.8rem",
                padding: "0.25rem 0.75rem",
                marginBottom: "1rem",
                textTransform: "uppercase",
              }}
            >
              Surah {surah.id} • {surah.type}
            </span>
            <h2
              style={{
                fontFamily: "Outfit",
                fontSize: "2.25rem",
                fontWeight: 700,
                color: themeStyles.text,
                marginBottom: "0.5rem",
              }}
            >
              {surah.transliteration}
            </h2>
            <p style={{ color: themeStyles.textMuted, fontSize: "1.05rem" }}>
              {surah.translation} • {surah.total_verses} Verses
            </p>
          </div>

          {/* Bismillah display (Omit for Surah 1 and Surah 9) */}
          {surah.id !== 1 && surah.id !== 9 && (
            <div
              style={{
                textAlign: "center",
                margin: "4rem 0 3.5rem 0",
                fontSize: "2.25rem",
                color: "var(--accent-gold)",
                fontFamily: "'Amiri', serif",
                direction: "rtl",
              }}
            >
              بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ
            </div>
          )}

          {/* MODE 1: MUSHAF CONTINUOUS INLINE FLOW */}
          {viewMode === "mushaf" ? (
            <div
              dir="rtl"
              className="quran-mushaf-flow"
              style={{
                fontFamily: getArabicFontFamilyWeb(arabicFont),
                fontSize: `${fontSizeArabic}px`,
                lineHeight: "2.9",
                textAlign: "justify",
                textAlignLast: "right",
                direction: "rtl",
                letterSpacing: "0.5px",
                wordSpacing: "2px",
                padding: "2.25rem 2rem",
                borderRadius: "var(--radius-lg)",
                backgroundColor:
                  themeStyles.verseBg === "transparent"
                    ? readerTheme === "sepia"
                      ? "#FAF7EE"
                      : readerTheme === "cream"
                        ? "#FAF7EE"
                        : readerTheme === "green"
                          ? "#F0FDF4"
                          : readerTheme === "dark"
                            ? "#0F172A"
                            : "#FFFFFF"
                    : themeStyles.verseBg,
                border: "1.5px solid rgba(220, 38, 38, 0.18)",
                boxShadow: "inset 0 0 0 1px rgba(212, 175, 55, 0.2)",
                backgroundImage:
                  readerTheme === "sepia" || readerTheme === "cream"
                    ? "repeating-linear-gradient(to bottom, transparent, transparent 67px, rgba(220, 38, 38, 0.08) 68px)"
                    : readerTheme === "green"
                      ? "repeating-linear-gradient(to bottom, transparent, transparent 67px, rgba(22, 101, 52, 0.08) 68px)"
                      : readerTheme === "dark"
                        ? "repeating-linear-gradient(to bottom, transparent, transparent 67px, rgba(220, 38, 38, 0.12) 68px)"
                        : "repeating-linear-gradient(to bottom, transparent, transparent 67px, rgba(220, 38, 38, 0.07) 68px)",
              }}
            >
              <div
                className="quran-mushaf-text-flow"
                style={{
                  textAlign: "justify",
                  textAlignLast: "right",
                  // @ts-ignore
                  WebkitTextAlignLast: "right",
                  textJustify: "inter-word",
                  direction: "rtl",
                  width: "100%",
                }}
              >
                {surah.verses.map((verse) => {
                  const isBookmarked =
                    quranBookmark?.surahId === surahId &&
                    quranBookmark?.verseId === verse.id;
                  const isSelected = activeAyah?.id === verse.id;

                  return (
                    <span
                      key={verse.id}
                      id={`verse-${verse.id}`}
                      onClick={() => {
                        setActiveAyah(isSelected ? null : verse);
                        setTodayReadCount((prev) => prev + 1);
                      }}
                      style={{
                        cursor: "pointer",
                        padding: "2px 4px",
                        borderRadius: "4px",
                        backgroundColor: isSelected
                          ? "rgba(212, 175, 55, 0.25)"
                          : "transparent",
                        transition: "background-color 0.2s ease",
                      }}
                    >
                      <span
                        style={{
                          color: themeStyles.arabic,
                          fontFamily: getArabicFontFamilyWeb(arabicFont),
                        }}
                      >
                        {wordByWordMode
                          ? verse.text.split(" ").map((w, wIdx) => {
                              const isSajdahWord = w.includes("\u06E4");
                              const cleanWord = w.replace(/\u06E4/g, "");
                              const hasSajdahSymbol =
                                cleanWord.includes("\u06E9");
                              const parts = hasSajdahSymbol
                                ? cleanWord.split("\u06E9")
                                : null;

                              return (
                                <span
                                  key={wIdx}
                                  className={
                                    isSajdahWord
                                      ? "quran-sajdah-phrase"
                                      : undefined
                                  }
                                  style={{
                                    display: "inline-block",
                                    margin: "0 2px",
                                    padding: "0 3px",
                                    borderRadius: "4px",
                                    transition: "background-color 0.15s ease",
                                  }}
                                  onMouseEnter={(e) =>
                                    (e.currentTarget.style.backgroundColor =
                                      "rgba(212, 175, 55, 0.25)")
                                  }
                                  onMouseLeave={(e) =>
                                    (e.currentTarget.style.backgroundColor =
                                      "transparent")
                                  }
                                >
                                  {parts ? (
                                    <>
                                      {parts[0]}
                                      <span
                                        className="quran-sajdah-symbol"
                                        title="سجدة تلاوة (Prostration)"
                                      >
                                        ۩
                                      </span>
                                      {parts[1]}
                                    </>
                                  ) : (
                                    cleanWord
                                  )}
                                </span>
                              );
                            })
                          : renderWebArabicText(
                              verse.text,
                              showTajweed,
                              readerTheme,
                            )}
                      </span>
                      <span
                        style={{
                          color: isBookmarked
                            ? "var(--accent-red, #dc2626)"
                            : "var(--accent-gold, #d4af37)",
                          padding: "0 6px",
                          fontFamily: getArabicFontFamilyWeb(arabicFont),
                          userSelect: "none",
                          fontSize: "0.9em",
                        }}
                      >
                        {` ﴿${toArabicNumber(verse.id)}﴾ `}
                      </span>
                    </span>
                  );
                })}
              </div>

              {/* End of Surah Madinah Mushaf Ornament */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "1rem",
                  marginTop: "2.5rem",
                  marginBottom: "1.5rem",
                  width: "100%",
                }}
              >
                <div style={{ height: "1px", flex: 1, backgroundColor: "var(--accent-gold)", opacity: 0.35 }} />
                <span
                  style={{
                    color: "var(--accent-gold)",
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    fontFamily: getArabicFontFamilyWeb(arabicFont),
                  }}
                >
                  ۩ نهاية سورة {surah.transliteration} ۩
                </span>
                <div style={{ height: "1px", flex: 1, backgroundColor: "var(--accent-gold)", opacity: 0.35 }} />
              </div>

              {/* Compact Navigation Bar for Mushaf Mode */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "0.75rem",
                  paddingTop: "1rem",
                  borderTop: `1px solid ${themeStyles.border}`,
                  width: "100%",
                }}
              >
                {surahId > 1 ? (
                  <Link
                    href={`/quran/${surahId - 1}`}
                    className="btn btn-secondary"
                    style={{ fontSize: "0.85rem", padding: "0.4rem 0.9rem", borderColor: themeStyles.border }}
                  >
                    &larr; Prev
                  </Link>
                ) : <div />}
                <Link
                  href="/quran"
                  className="btn btn-secondary"
                  style={{ fontSize: "0.85rem", padding: "0.4rem 0.9rem", borderColor: "var(--accent-gold)", color: "var(--accent-gold)" }}
                >
                  All Chapters
                </Link>
                {surahId < 114 ? (
                  <Link
                    href={`/quran/${surahId + 1}`}
                    className="btn btn-primary"
                    style={{ fontSize: "0.85rem", padding: "0.4rem 0.9rem" }}
                  >
                    Next &rarr;
                  </Link>
                ) : <div />}
              </div>
            </div>
          ) : (
            /* MODE 2: VERSE-BY-VERSE LIST */
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "2.5rem",
              }}
            >
              {surah.verses.map((verse) => {
                const isBookmarked =
                  quranBookmark?.surahId === surahId &&
                  quranBookmark?.verseId === verse.id;
                return (
                  <div
                    key={verse.id}
                    id={`verse-${verse.id}`}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      padding: isBookmarked ? "1.5rem" : "0 0 2.5rem 0",
                      borderRadius: isBookmarked ? "var(--radius-lg)" : "0",
                      backgroundColor: isBookmarked
                        ? readerTheme === "dark"
                          ? "rgba(212, 175, 55, 0.08)"
                          : "rgba(212, 175, 55, 0.05)"
                        : "transparent",
                      border: isBookmarked
                        ? "1px solid rgba(212, 175, 55, 0.3)"
                        : "none",
                      borderBottom: isBookmarked
                        ? "1px solid rgba(212, 175, 55, 0.3)"
                        : `1px solid ${themeStyles.border}`,
                      gap: "1.25rem",
                      transition: "all 0.3s ease",
                    }}
                  >
                    {/* Verse Number & Arabic Row */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "2rem",
                      }}
                    >
                      {/* Action Badge & Bookmark Column */}
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "0.75rem",
                          flexShrink: 0,
                        }}
                      >
                        {/* Verse Number Badge */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "36px",
                            height: "36px",
                            borderRadius: "50%",
                            border: `1.5px solid var(--accent-gold)`,
                            fontFamily: "Outfit",
                            fontSize: "0.85rem",
                            fontWeight: 700,
                            color: "var(--accent-gold)",
                            backgroundColor:
                              themeStyles.verseBg === "transparent"
                                ? "rgba(212, 175, 55, 0.05)"
                                : themeStyles.verseBg,
                            marginTop: "4px",
                          }}
                        >
                          {verse.id}
                        </div>

                        {/* Sajdah Badge */}
                        {(verse.text.includes("\u06E9") ||
                          verse.text.includes("\u06E4")) && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "4px 12px",
                              borderRadius: "14px",
                              fontSize: "0.95rem",
                              fontWeight: 700,
                              backgroundColor: "rgba(212, 175, 55, 0.16)",
                              color: "var(--accent-gold, #d4af37)",
                              border: "1px solid rgba(212, 175, 55, 0.4)",
                              fontFamily: "'Amiri', serif",
                            }}
                            title="سجدة تلاوة (Prostration of Recitation)"
                          >
                            <span style={{ fontSize: "1.2rem", lineHeight: 1 }}>
                              ۩
                            </span>{" "}
                            سجدة تلاوة
                          </span>
                        )}

                        {/* Bookmark Toggle Button */}
                        <button
                          onClick={() =>
                            updateQuranBookmark(
                              surahId,
                              isBookmarked ? null : verse.id,
                            )
                          }
                          title={
                            isBookmarked ? "Remove Bookmark" : "Save Bookmark"
                          }
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            color: isBookmarked
                              ? "var(--accent-gold)"
                              : "var(--text-muted)",
                            opacity: isBookmarked ? 1 : 0.4,
                            transition: "all 0.2s ease",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "4px",
                            borderRadius: "50%",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = "1";
                            e.currentTarget.style.transform = "scale(1.15)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = isBookmarked
                              ? "1"
                              : "0.4";
                            e.currentTarget.style.transform = "scale(1)";
                          }}
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill={isBookmarked ? "currentColor" : "none"}
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                          </svg>
                        </button>

                        {/* Share Verse Button */}
                        <button
                          onClick={() => handleShareVerse(verse)}
                          title="Share this Verse"
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--text-muted)",
                            opacity: 0.4,
                            transition: "all 0.2s ease",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "4px",
                            borderRadius: "50%",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = "1";
                            e.currentTarget.style.transform = "scale(1.15)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = "0.4";
                            e.currentTarget.style.transform = "scale(1)";
                          }}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <circle cx="18" cy="5" r="3" />
                            <circle cx="6" cy="12" r="3" />
                            <circle cx="18" cy="19" r="3" />
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                          </svg>
                        </button>

                        <button
                          onClick={() => {
                            setActiveAyah(verse);
                            setIsVerseActionMenuOpen(true);
                          }}
                          title="All 12 Ayah Actions"
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            padding: "6px",
                            color: "var(--accent-gold)",
                            opacity: 0.7,
                            transition: "all 0.2s ease",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: "50%",
                            fontSize: "1rem",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = "1";
                            e.currentTarget.style.transform = "scale(1.15)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = "0.7";
                            e.currentTarget.style.transform = "scale(1)";
                          }}
                        >
                          ⚡
                        </button>
                      </div>

                      {/* Arabic Text (Right) */}
                      <div
                        className="quran-arabic-text"
                        style={{
                          fontSize: `${fontSizeArabic}px`,
                          lineHeight: "2.9",
                          color: themeStyles.arabic,
                          fontFamily: getArabicFontFamilyWeb(arabicFont),
                          direction: "rtl",
                          textAlign: "right",
                          letterSpacing: "0.5px",
                          wordSpacing: "2px",
                          paddingTop: "1rem",
                          paddingBottom: "0.5rem",
                          flex: 1,
                        }}
                      >
                        {wordByWordMode
                          ? verse.text.split(" ").map((w, wIdx) => {
                              const isSajdahWord = w.includes("\u06E4");
                              const cleanWord = w.replace(/\u06E4/g, "");
                              const hasSajdahSymbol =
                                cleanWord.includes("\u06E9");
                              const parts = hasSajdahSymbol
                                ? cleanWord.split("\u06E9")
                                : null;

                              return (
                                <span
                                  key={wIdx}
                                  className={
                                    isSajdahWord
                                      ? "quran-sajdah-phrase"
                                      : undefined
                                  }
                                  style={{
                                    display: "inline-block",
                                    margin: "0 2px",
                                    padding: "0 3px",
                                    borderRadius: "4px",
                                    transition: "background-color 0.15s ease",
                                  }}
                                  onMouseEnter={(e) =>
                                    (e.currentTarget.style.backgroundColor =
                                      "rgba(212, 175, 55, 0.25)")
                                  }
                                  onMouseLeave={(e) =>
                                    (e.currentTarget.style.backgroundColor =
                                      "transparent")
                                  }
                                >
                                  {parts ? (
                                    <>
                                      {parts[0]}
                                      <span
                                        className="quran-sajdah-symbol"
                                        title="سجدة تلاوة (Prostration)"
                                      >
                                        ۩
                                      </span>
                                      {parts[1]}
                                    </>
                                  ) : (
                                    cleanWord
                                  )}
                                </span>
                              );
                            })
                          : renderWebArabicText(
                              verse.text,
                              showTajweed,
                              readerTheme,
                            )}
                      </div>
                    </div>

                    {/* Transliteration */}
                    {showTransliteration && (
                      <div
                        style={{
                          fontSize: `${fontSizeTranslation * 0.95}px`,
                          color: "var(--accent-gold)",
                          fontStyle: "italic",
                          paddingLeft: "3.5rem",
                          lineHeight: 1.5,
                        }}
                      >
                        {verse.transliteration}
                      </div>
                    )}

                    {/* Translation */}
                    {showTranslation && (
                      <div
                        style={{
                          fontSize: `${fontSizeTranslation}px`,
                          color: themeStyles.text,
                          paddingLeft: "3.5rem",
                          lineHeight: 1.6,
                        }}
                      >
                        {getWebLanguageTranslation(
                          selectedTransLang,
                          verse.translation,
                          verse.id,
                          surah.transliteration,
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Floating Ayah Action Card in Mushaf Mode */}
          {activeAyah && !isVerseActionMenuOpen && (
            <div
              style={{
                position: "fixed",
                bottom: isWebSurahAudioPlaying ? "98px" : "24px",
                left: "50%",
                transform: "translateX(-50%)",
                width: "90%",
                maxWidth: "600px",
                backgroundColor: themeStyles.bg,
                border: "1.5px solid var(--accent-gold)",
                borderRadius: "var(--radius-lg)",
                padding: "1rem 1.25rem",
                boxShadow: "0 12px 36px rgba(0, 0, 0, 0.4)",
                zIndex: 99995,
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                transition: "bottom 0.25s ease-out",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    color: "var(--accent-gold)",
                  }}
                >
                  Surah {surah.transliteration} : Ayah {activeAyah.id}
                </span>
                <button
                  onClick={() => setActiveAyah(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: themeStyles.textMuted,
                    fontSize: "1.1rem",
                  }}
                >
                  ✕
                </button>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.9rem",
                  color: themeStyles.text,
                  fontStyle: "italic",
                  lineHeight: 1.4,
                }}
              >
                "{activeAyah.translation}"
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={() =>
                    updateQuranBookmark(
                      surahId,
                      quranBookmark?.verseId === activeAyah.id
                        ? null
                        : activeAyah.id,
                    )
                  }
                  className="btn btn-secondary"
                  style={{
                    padding: "0.35rem 0.75rem",
                    fontSize: "0.8rem",
                    borderColor: themeStyles.border,
                  }}
                >
                  {quranBookmark?.surahId === surahId &&
                  quranBookmark?.verseId === activeAyah.id
                    ? "Bookmarked ★"
                    : "Bookmark ☆"}
                </button>
                <button
                  onClick={() => handleShareVerse(activeAyah)}
                  className="btn btn-secondary"
                  style={{
                    padding: "0.35rem 0.75rem",
                    fontSize: "0.8rem",
                    borderColor: themeStyles.border,
                  }}
                >
                  Share
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      activeAyah.text +
                        '\n\n"' +
                        activeAyah.translation +
                        '"\n— Surah ' +
                        surah.transliteration +
                        " [" +
                        surah.id +
                        ":" +
                        activeAyah.id +
                        "]",
                    );
                    showToast("Arabic Ayah copied to clipboard!");
                  }}
                  className="btn btn-secondary"
                  style={{
                    padding: "0.35rem 0.75rem",
                    fontSize: "0.8rem",
                    borderColor: themeStyles.border,
                  }}
                >
                  Copy
                </button>
                <button
                  onClick={() => setIsVerseActionMenuOpen(true)}
                  className="btn btn-secondary"
                  style={{
                    padding: "0.35rem 0.75rem",
                    fontSize: "0.8rem",
                    borderColor: "var(--accent-red)",
                    backgroundColor: "rgba(220, 38, 38, 0.12)",
                    color: "var(--accent-red)",
                    fontWeight: 700,
                  }}
                >
                  ⚡ Actions (12)
                </button>
              </div>
            </div>
          )}

          {/* Ornate Surah Completion Card (displayed in Verse-by-Verse mode) */}
          {viewMode === "verses" && (
            <div
              style={{
                marginTop: "4rem",
                padding: "2.5rem 2rem",
                borderRadius: "var(--radius-lg)",
                backgroundColor:
                  themeStyles.verseBg === "transparent"
                    ? readerTheme === "sepia"
                      ? "#FAF7EE"
                      : readerTheme === "dark"
                        ? "#1E293B"
                        : "#F8FAFC"
                    : themeStyles.verseBg,
                border: "1.5px solid rgba(220, 38, 38, 0.2)",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "1rem",
              }}
            >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                backgroundColor: "rgba(212, 175, 55, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.8rem",
              }}
            >
              ✨
            </div>

            <h3
              style={{
                margin: 0,
                fontSize: "1.5rem",
                fontWeight: 700,
                color: themeStyles.text,
              }}
            >
              Alhamdulillah!
            </h3>
            <p
              style={{
                margin: 0,
                color: themeStyles.textMuted,
                fontSize: "0.95rem",
              }}
            >
              You have completed reading Surah {surah.transliteration} (
              {surah.name}) • {surah.total_verses} Verses
            </p>

            {surahId < 114 ? (
              <div
                style={{
                  marginTop: "1rem",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.75rem",
                  width: "100%",
                  maxWidth: "440px",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.9rem",
                    color: themeStyles.textMuted,
                  }}
                >
                  Ready to proceed to the next chapter?
                </p>
                <Link
                  href={`/quran/${surahId + 1}`}
                  className="btn btn-primary"
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                    padding: "0.75rem 1.5rem",
                    fontSize: "0.95rem",
                    fontWeight: 700,
                  }}
                >
                  Continue to Surah{" "}
                  {surahList.find((s) => s.id === surahId + 1)
                    ?.transliteration || `Chapter ${surahId + 1}`}
                </Link>
              </div>
            ) : (
              <p
                style={{
                  color: "var(--accent-gold)",
                  fontWeight: 700,
                  fontSize: "1.1rem",
                }}
              >
                Masha'Allah! You have completed the entire Holy Quran!
              </p>
            )}

            <div
              style={{
                display: "flex",
                gap: "1rem",
                marginTop: "1rem",
                paddingTop: "1rem",
                borderTop: `1px solid ${themeStyles.border}`,
              }}
            >
              {surahId > 1 && (
                <Link
                  href={`/quran/${surahId - 1}`}
                  className="btn btn-secondary"
                  style={{
                    fontSize: "0.85rem",
                    padding: "0.4rem 1rem",
                    borderColor: themeStyles.border,
                  }}
                >
                  &larr; Prev:{" "}
                  {surahList.find((s) => s.id === surahId - 1)
                    ?.transliteration || `Chapter ${surahId - 1}`}
                </Link>
              )}
              <Link
                href="/quran"
                className="btn btn-secondary"
                style={{
                  fontSize: "0.85rem",
                  padding: "0.4rem 1rem",
                  borderColor: themeStyles.border,
                }}
              >
                All Chapters
              </Link>
            </div>
          </div>
          )}
        </div>
      </section>

      {/* Floating Toast Notification */}
      {toastMsg && (
        <div
          style={{
            position: "fixed",
            bottom: "5.5rem",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 99999,
            backgroundColor:
              toastType === "success"
                ? "#16a34a"
                : toastType === "warn"
                  ? "#d97706"
                  : "#2563eb",
            color: "#ffffff",
            padding: "0.65rem 1.25rem",
            borderRadius: "50px",
            fontWeight: 700,
            fontSize: "0.875rem",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            whiteSpace: "nowrap",
            maxWidth: "90vw",
            animation: "fadeInUp 0.25s ease",
          }}
        >
          <span>
            {toastType === "success" ? "✓" : toastType === "warn" ? "⚠" : "ℹ"}
          </span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
            {toastMsg}
          </span>
        </div>
      )}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateX(-50%) translateY(10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      {/* Floating Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          aria-label="Scroll to top"
          style={{
            position: "fixed",
            bottom: "2rem",
            right: "2rem",
            zIndex: 99,
            width: "50px",
            height: "50px",
            borderRadius: "50%",
            background:
              readerTheme === "dark"
                ? "var(--accent-gold-gradient)"
                : "var(--accent-red-gradient)",
            color: readerTheme === "dark" ? "#000000" : "#ffffff",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 4px 15px rgba(0, 0, 0, 0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.5rem",
            fontWeight: "bold",
            transition: "transform 0.2s ease, opacity 0.2s ease",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.transform = "scale(1.1) translateY(-2px)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.transform = "scale(1) translateY(0)")
          }
        >
          ↑
        </button>
      )}

      {/* Chapter Hub Navigation Drawer */}
      {isChapterDrawerOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            backgroundColor: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(6px)",
            display: "flex",
            justifyContent: "flex-start",
            alignItems: "stretch",
          }}
          onClick={() => setIsChapterDrawerOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "420px",
              backgroundColor: readerTheme === "dark" ? "#0F172A" : "#FFFFFF",
              color: readerTheme === "dark" ? "#F8FAFC" : "#0F172A",
              borderRight: `1px solid ${readerTheme === "dark" ? "#1E293B" : "#E2E8F0"}`,
              display: "flex",
              flexDirection: "column",
              height: "100%",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.35)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: "1.25rem 1.5rem",
                borderBottom: `1px solid ${readerTheme === "dark" ? "#1E293B" : "#E2E8F0"}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>
                  Quran Chapters Hub
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.8rem",
                    color: "var(--text-secondary)",
                    marginTop: "2px",
                  }}
                >
                  114 Surahs • Instant Jump
                </p>
              </div>
              <button
                onClick={() => setIsChapterDrawerOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  color: "var(--text-secondary)",
                  padding: "4px 8px",
                  borderRadius: "6px",
                }}
              >
                ✕
              </button>
            </div>

            {/* Search Input */}
            <div style={{ padding: "1rem 1.25rem 0.5rem" }}>
              <input
                type="text"
                value={chapterSearch}
                onChange={(e) => setChapterSearch(e.target.value)}
                placeholder="Search by name, number, meaning..."
                style={{
                  width: "100%",
                  padding: "0.6rem 0.9rem",
                  borderRadius: "8px",
                  border: `1px solid ${readerTheme === "dark" ? "#334155" : "#CBD5E1"}`,
                  backgroundColor:
                    readerTheme === "dark" ? "#1E293B" : "#F8FAFC",
                  color: "inherit",
                  fontSize: "0.9rem",
                  outline: "none",
                }}
                autoFocus
              />
            </div>

            {/* Surah List */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "0.5rem 0.75rem 2rem",
              }}
            >
              {surahList
                .filter((s) => {
                  if (!chapterSearch.trim()) return true;
                  const q = chapterSearch.toLowerCase();
                  return (
                    s.transliteration?.toLowerCase().includes(q) ||
                    s.translation?.toLowerCase().includes(q) ||
                    s.name?.includes(q) ||
                    String(s.id) === q.trim()
                  );
                })
                .map((s) => {
                  const isCurrent = s.id === surahId;
                  return (
                    <div
                      key={s.id}
                      onClick={() => {
                        setIsChapterDrawerOpen(false);
                        if (s.id !== surahId) {
                          router.push(`/quran/${s.id}`);
                        }
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.75rem 0.85rem",
                        margin: "4px 0",
                        borderRadius: "10px",
                        cursor: "pointer",
                        backgroundColor: isCurrent
                          ? "rgba(220, 38, 38, 0.12)"
                          : "transparent",
                        border: isCurrent
                          ? "1px solid var(--accent-red)"
                          : "1px solid transparent",
                        transition: "background 0.15s ease",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.75rem",
                        }}
                      >
                        <div
                          style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "8px",
                            backgroundColor: isCurrent
                              ? "var(--accent-red)"
                              : readerTheme === "dark"
                                ? "#1E293B"
                                : "#F1F5F9",
                            color: isCurrent ? "#FFFFFF" : "var(--accent-red)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.85rem",
                            fontWeight: 700,
                          }}
                        >
                          {s.id}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                            {s.transliteration}
                          </div>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--text-secondary)",
                            }}
                          >
                            {s.translation ? `${s.translation} • ` : ""}
                            {s.total_verses ? `${s.total_verses} Verses` : ""}
                          </div>
                        </div>
                      </div>

                      {s.name && (
                        <div
                          style={{
                            fontFamily: "Amiri, serif",
                            fontSize: "1.2rem",
                            color: isCurrent
                              ? "var(--accent-red)"
                              : "var(--accent-gold)",
                          }}
                        >
                          {s.name}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Phase 5: Full-Text Quran Search Modal */}
      {isSearchModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10000,
            backgroundColor: "rgba(0, 0, 0, 0.72)",
            backdropFilter: "blur(8px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            padding: "3.5rem 1rem 1.5rem",
          }}
          onClick={() => setIsSearchModalOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "760px",
              maxHeight: "88vh",
              backgroundColor:
                readerTheme === "dark"
                  ? "#0F172A"
                  : readerTheme === "sepia"
                    ? "#FAF7EE"
                    : "#FFFFFF",
              color: readerTheme === "dark" ? "#F8FAFC" : "#0F172A",
              border: `1.5px solid rgba(212, 175, 55, 0.4)`,
              borderRadius: "16px",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.45)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Search Bar Header */}
            <div
              style={{
                padding: "1.25rem 1.5rem 1rem",
                borderBottom: `1px solid ${readerTheme === "dark" ? "#1E293B" : "rgba(0,0,0,0.08)"}`,
                display: "flex",
                flexDirection: "column",
                gap: "0.85rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <span style={{ fontSize: "1.2rem" }}>🔍</span>
                  <h3
                    style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}
                  >
                    Full-Text Quran Search
                  </h3>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      backgroundColor: "rgba(212, 175, 55, 0.15)",
                      color: "var(--accent-gold)",
                      padding: "2px 8px",
                      borderRadius: "10px",
                      fontWeight: 600,
                    }}
                  >
                    All 6,236 Ayahs
                  </span>
                </div>
                <button
                  onClick={() => setIsSearchModalOpen(false)}
                  style={{
                    background: "transparent",
                    border: "none",
                    fontSize: "1.2rem",
                    cursor: "pointer",
                    color: "var(--text-secondary)",
                    padding: "4px 8px",
                    borderRadius: "6px",
                  }}
                  title="Close search (Esc)"
                >
                  ✕
                </button>
              </div>

              {/* Search Input Box */}
              <div style={{ position: "relative", width: "100%" }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Arabic (e.g. رحمن), English (e.g. mercy), or reference (e.g. 2:255)..."
                  style={{
                    width: "100%",
                    padding: "0.75rem 2.8rem 0.75rem 1rem",
                    borderRadius: "10px",
                    border: `1.5px solid ${readerTheme === "dark" ? "#334155" : "#CBD5E1"}`,
                    backgroundColor:
                      readerTheme === "dark" ? "#1E293B" : "#F8FAFC",
                    color: "inherit",
                    fontSize: "0.95rem",
                    outline: "none",
                    transition: "border-color 0.2s",
                  }}
                  autoFocus
                />
                {searchLoading ? (
                  <span
                    style={{
                      position: "absolute",
                      right: "1rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: "0.8rem",
                      color: "var(--accent-gold)",
                    }}
                  >
                    Searching...
                  </span>
                ) : searchQuery ? (
                  <button
                    onClick={() => setSearchQuery("")}
                    style={{
                      position: "absolute",
                      right: "0.85rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--text-secondary)",
                      fontSize: "0.95rem",
                      padding: "2px 6px",
                    }}
                  >
                    ✕
                  </button>
                ) : null}
              </div>

              {/* Scope filter pills */}
              <div
                style={{
                  display: "flex",
                  gap: "0.4rem",
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                {(
                  [
                    { id: "all", label: "All Match Types" },
                    { id: "arabic", label: "📖 Arabic Script" },
                    { id: "english", label: "🌐 English" },
                    { id: "transliteration", label: "🔤 Transliteration" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSearchScope(tab.id)}
                    style={{
                      padding: "0.3rem 0.65rem",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      borderRadius: "6px",
                      cursor: "pointer",
                      border:
                        searchScope === tab.id
                          ? "1px solid var(--accent-gold)"
                          : `1px solid ${readerTheme === "dark" ? "#334155" : "#E2E8F0"}`,
                      backgroundColor:
                        searchScope === tab.id
                          ? "var(--accent-gold)"
                          : "transparent",
                      color: searchScope === tab.id ? "#000000" : "inherit",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Results or Theme Shortcuts Container */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "1rem 1.5rem 1.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              {/* Quick Themes when query is blank */}
              {!searchQuery.trim() && (
                <div>
                  <div
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--text-secondary)",
                      marginBottom: "0.6rem",
                    }}
                  >
                    Popular Themes & Direct Verses:
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "0.45rem",
                      flexWrap: "wrap",
                    }}
                  >
                    {QUICK_THEMES.map((theme, i) => (
                      <button
                        key={i}
                        onClick={() => setSearchQuery(theme.query)}
                        className="btn btn-secondary"
                        style={{
                          padding: "0.35rem 0.75rem",
                          fontSize: "0.8rem",
                          borderRadius: "8px",
                        }}
                      >
                        {theme.label}
                      </button>
                    ))}
                  </div>

                  <div
                    style={{
                      marginTop: "1.5rem",
                      padding: "1.25rem",
                      borderRadius: "12px",
                      backgroundColor:
                        readerTheme === "dark"
                          ? "#1E293B"
                          : "rgba(212,175,55,0.06)",
                      border: "1px dashed rgba(212,175,55,0.3)",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "1.5rem", marginBottom: "0.4rem" }}>
                      📖
                    </div>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "0.95rem",
                        marginBottom: "0.25rem",
                      }}
                    >
                      Instant Quran Ayah Finder
                    </div>
                    <div
                      style={{
                        fontSize: "0.82rem",
                        color: "var(--text-secondary)",
                        lineHeight: 1.5,
                      }}
                    >
                      Type in Arabic (with or without tashkeel), English
                      keywords (like <em>forgiveness</em>, <em>paradise</em>),
                      or an exact reference like <strong>2:255</strong> or{" "}
                      <strong>18:10</strong> to jump straight to the verse.
                    </div>
                  </div>
                </div>
              )}

              {/* Status Header when query is present */}
              {searchQuery.trim() !== "" && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {searchLoading
                      ? "Searching all 6,236 Ayahs..."
                      : searchResults.verses.length > 0
                        ? `Found ${searchResults.total} matching ${searchResults.total === 1 ? "verse" : "verses"}`
                        : "No verses matched your search"}
                  </span>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Press Esc to exit
                  </span>
                </div>
              )}

              {/* Matching Chapters list */}
              {searchResults.surahs.length > 0 && searchQuery.trim() !== "" && (
                <div>
                  <div
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      color: "var(--accent-gold)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      marginBottom: "0.5rem",
                    }}
                  >
                    Matching Chapters ({searchResults.surahs.length})
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(220px, 1fr))",
                      gap: "0.6rem",
                    }}
                  >
                    {searchResults.surahs.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => {
                          setIsSearchModalOpen(false);
                          if (s.id !== surahId) {
                            router.push(`/quran/${s.id}`);
                          }
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "0.65rem 0.85rem",
                          borderRadius: "8px",
                          border: `1px solid ${s.id === surahId ? "var(--accent-red)" : "rgba(212,175,55,0.3)"}`,
                          backgroundColor:
                            s.id === surahId
                              ? "rgba(220,38,38,0.08)"
                              : "rgba(212,175,55,0.05)",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 700,
                              color: "var(--accent-gold)",
                              fontSize: "0.85rem",
                            }}
                          >
                            {s.id}.
                          </span>
                          <div>
                            <div
                              style={{ fontSize: "0.85rem", fontWeight: 600 }}
                            >
                              {s.transliteration}
                            </div>
                            <div
                              style={{
                                fontSize: "0.72rem",
                                color: "var(--text-secondary)",
                              }}
                            >
                              {s.total_verses} Verses
                            </div>
                          </div>
                        </div>
                        <span
                          style={{
                            fontFamily: "Amiri, serif",
                            fontSize: "1.1rem",
                            color: "var(--accent-gold)",
                          }}
                        >
                          {s.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Matching Verses Cards */}
              {searchResults.verses.map((verse) => {
                const isCurrentChapter = verse.surahId === surahId;
                return (
                  <div
                    key={`${verse.surahId}_${verse.verseId}`}
                    style={{
                      padding: "1rem 1.15rem",
                      borderRadius: "12px",
                      border: isCurrentChapter
                        ? "1.5px solid rgba(220, 38, 38, 0.45)"
                        : `1px solid ${readerTheme === "dark" ? "#1E293B" : "#E2E8F0"}`,
                      backgroundColor:
                        readerTheme === "dark"
                          ? "#131E32"
                          : readerTheme === "sepia"
                            ? "#F5EFE1"
                            : "#F8FAFC",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.65rem",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "0.5rem",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          style={{
                            backgroundColor: isCurrentChapter
                              ? "rgba(220, 38, 38, 0.15)"
                              : "rgba(212, 175, 55, 0.15)",
                            color: isCurrentChapter
                              ? "var(--accent-red)"
                              : "var(--accent-gold)",
                            fontWeight: 700,
                            fontSize: "0.8rem",
                            padding: "2px 8px",
                            borderRadius: "6px",
                          }}
                        >
                          {verse.surahId}:{verse.verseId}
                        </span>
                        <strong style={{ fontSize: "0.9rem" }}>
                          Surah {verse.surahTransliteration}
                        </strong>
                        {isCurrentChapter && (
                          <span
                            style={{
                              fontSize: "0.7rem",
                              backgroundColor: "rgba(220, 38, 38, 0.1)",
                              color: "var(--accent-red)",
                              padding: "1px 6px",
                              borderRadius: "4px",
                              fontWeight: 600,
                            }}
                          >
                            Current Chapter
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-secondary)",
                          }}
                        >
                          ({verse.surahTranslation})
                        </span>
                      </div>

                      <button
                        onClick={() =>
                          handleJumpToSearchResult(verse.surahId, verse.verseId)
                        }
                        className="btn btn-secondary"
                        style={{
                          padding: "0.3rem 0.75rem",
                          fontSize: "0.78rem",
                          borderRadius: "6px",
                          backgroundColor: "rgba(212, 175, 55, 0.12)",
                          color: "var(--accent-gold)",
                          borderColor: "rgba(212, 175, 55, 0.4)",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {isCurrentChapter ? "Scroll to Ayah" : "Open Ayah"}
                      </button>
                    </div>

                    {/* Arabic Text with highlight */}
                    <div
                      dir="rtl"
                      style={{
                        fontFamily: "'Amiri', serif",
                        fontSize: "1.45rem",
                        lineHeight: "2.1",
                        textAlign: "right",
                        color: themeStyles.arabic || "inherit",
                      }}
                    >
                      {highlightMatch(verse.arabic, searchQuery, true)}
                      <span
                        style={{
                          color: "var(--accent-gold)",
                          fontSize: "1.1rem",
                          marginRight: "0.35rem",
                        }}
                      >
                        {` ﴿${toArabicNumber(verse.verseId)}﴾`}
                      </span>
                    </div>

                    {/* English Translation with highlight */}
                    {verse.translation && (
                      <div
                        style={{
                          fontSize: "0.88rem",
                          lineHeight: 1.55,
                          color: "inherit",
                        }}
                      >
                        {highlightMatch(verse.translation, searchQuery, false)}
                      </div>
                    )}

                    {/* Transliteration */}
                    {verse.transliteration && (
                      <div
                        style={{
                          fontSize: "0.78rem",
                          fontStyle: "italic",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {verse.transliteration}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Ayah Jump / Go to Verse Modal (Web) */}
      {isJumpModalOpen &&
        surah &&
        (() => {
          const targetSurahObj =
            surahList.find((s) => s.id === jumpTargetSurahId) || surah;
          const maxVersesWeb: number =
            (jumpTab === "this"
              ? surah.total_verses
              : targetSurahObj.total_verses) || 286;
          const parsedV = parseInt(jumpVerseInput, 10);
          const isValid =
            !isNaN(parsedV) && parsedV >= 1 && parsedV <= maxVersesWeb;

          const filteredSurahsWeb = surahList.filter((s) => {
            if (!jumpSurahSearchQuery.trim()) return true;
            const q = jumpSurahSearchQuery.toLowerCase().trim();
            return (
              s.id.toString() === q ||
              s.transliteration.toLowerCase().includes(q) ||
              (s.name && s.name.includes(q))
            );
          });

          const landmarksWeb = [
            { label: "Start", verse: 1 },
            {
              label: "25%",
              verse: Math.max(1, Math.round(maxVersesWeb * 0.25)),
            },
            {
              label: "50%",
              verse: Math.max(1, Math.round(maxVersesWeb * 0.5)),
            },
            {
              label: "75%",
              verse: Math.max(1, Math.round(maxVersesWeb * 0.75)),
            },
            { label: "End", verse: maxVersesWeb },
          ];

          const famousForSurah =
            FAMOUS_AYAHS_WEB[
              jumpTab === "this" ? surah.id : targetSurahObj.id
            ] || [];

          return (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 10002,
                backgroundColor: "rgba(0, 0, 0, 0.7)",
                backdropFilter: "blur(6px)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                padding: "1rem",
                animation: "fadeIn 0.2s ease-out",
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) setIsJumpModalOpen(false);
              }}
            >
              <div
                style={{
                  backgroundColor:
                    readerTheme === "dark"
                      ? "#0F172A"
                      : readerTheme === "cream"
                        ? "#FAF7EE"
                        : "#FFFFFF",
                  color: readerTheme === "dark" ? "#F8FAFC" : "#0F172A",
                  border: `1.5px solid ${readerTheme === "dark" ? "#1E293B" : "rgba(212, 175, 55, 0.35)"}`,
                  borderRadius: "20px",
                  width: "100%",
                  maxWidth: "480px",
                  maxHeight: "90vh",
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.45)",
                  overflow: "hidden",
                }}
              >
                {/* Header */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "1.1rem 1.4rem",
                    borderBottom: `1px solid ${readerTheme === "dark" ? "#1E293B" : "rgba(0, 0, 0, 0.08)"}`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "10px",
                        backgroundColor: "rgba(212, 175, 55, 0.15)",
                        border: "1px solid rgba(212, 175, 55, 0.35)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.1rem",
                      }}
                    >
                      🎯
                    </div>
                    <div>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: "1.15rem",
                          fontWeight: 700,
                        }}
                      >
                        Go to Verse
                      </h3>
                      <p
                        style={{
                          margin: "2px 0 0",
                          fontSize: "0.78rem",
                          opacity: 0.7,
                        }}
                      >
                        Jump directly to any Ayah in the Quran
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsJumpModalOpen(false)}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "1.3rem",
                      padding: "4px 8px",
                      borderRadius: "8px",
                      color: "inherit",
                      opacity: 0.65,
                    }}
                    title="Close (Esc)"
                  >
                    ✕
                  </button>
                </div>

                {/* Mode Switcher */}
                <div
                  style={{
                    display: "flex",
                    padding: "4px",
                    margin: "1rem 1.4rem 0.5rem",
                    backgroundColor:
                      readerTheme === "dark"
                        ? "#1E293B"
                        : "rgba(0, 0, 0, 0.04)",
                    borderRadius: "12px",
                    border: `1px solid ${readerTheme === "dark" ? "#334155" : "rgba(0, 0, 0, 0.06)"}`,
                    gap: "4px",
                  }}
                >
                  <button
                    onClick={() => {
                      setJumpTab("this");
                      setJumpVerseInput("1");
                    }}
                    style={{
                      flex: 1,
                      padding: "0.5rem",
                      borderRadius: "9px",
                      border: "none",
                      backgroundColor:
                        jumpTab === "this"
                          ? "var(--accent-gold)"
                          : "transparent",
                      color: jumpTab === "this" ? "#000000" : "inherit",
                      fontWeight: 700,
                      fontSize: "0.82rem",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    📖 This Surah ({surah.total_verses}v)
                  </button>
                  <button
                    onClick={() => {
                      setJumpTab("any");
                      setJumpTargetSurahId(surahId);
                      setJumpVerseInput("1");
                    }}
                    style={{
                      flex: 1,
                      padding: "0.5rem",
                      borderRadius: "9px",
                      border: "none",
                      backgroundColor:
                        jumpTab === "any"
                          ? "var(--accent-gold)"
                          : "transparent",
                      color: jumpTab === "any" ? "#000000" : "inherit",
                      fontWeight: 700,
                      fontSize: "0.82rem",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    🌐 Any Surah (1 – 114)
                  </button>
                </div>

                {/* Content Area */}
                <div
                  style={{
                    padding: "0.8rem 1.4rem 1.4rem",
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "1.1rem",
                  }}
                >
                  {/* Any Surah Picker */}
                  {jumpTab === "any" && (
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                          opacity: 0.7,
                          marginBottom: "6px",
                        }}
                      >
                        CHOOSE SURAH:
                      </label>
                      <select
                        value={jumpTargetSurahId}
                        onChange={(e) => {
                          const nextId = parseInt(e.target.value, 10);
                          setJumpTargetSurahId(nextId);
                          setJumpVerseInput("1");
                        }}
                        style={{
                          width: "100%",
                          padding: "0.6rem 0.8rem",
                          borderRadius: "10px",
                          border: `1px solid ${readerTheme === "dark" ? "#334155" : "#CBD5E1"}`,
                          backgroundColor:
                            readerTheme === "dark" ? "#1E293B" : "#FFFFFF",
                          color: "inherit",
                          fontSize: "0.9rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {surahList.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.id}. Surah {s.transliteration} ({s.total_verses}{" "}
                            Ayahs)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Target Surah Context Info */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.65rem 0.9rem",
                      borderRadius: "10px",
                      backgroundColor:
                        readerTheme === "dark"
                          ? "#1E293B"
                          : "rgba(212, 175, 55, 0.08)",
                      border: `1px solid ${readerTheme === "dark" ? "#334155" : "rgba(212, 175, 55, 0.25)"}`,
                      fontSize: "0.82rem",
                    }}
                  >
                    <div>
                      <span style={{ opacity: 0.75 }}>Target: </span>
                      <strong style={{ color: "var(--accent-gold)" }}>
                        {jumpTab === "this"
                          ? `${surah.id}. Surah ${surah.transliteration}`
                          : `${targetSurahObj.id}. Surah ${targetSurahObj.transliteration}`}
                      </strong>
                    </div>
                    <span style={{ fontSize: "0.75rem", opacity: 0.65 }}>
                      1 to {maxVersesWeb} Ayahs
                    </span>
                  </div>

                  {/* Numeric Input & Steppers */}
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        opacity: 0.7,
                        marginBottom: "6px",
                      }}
                    >
                      ENTER AYAH NUMBER (1 – {maxVersesWeb}):
                    </label>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        backgroundColor:
                          readerTheme === "dark" ? "#1E293B" : "#FFFFFF",
                        border: `1.5px solid ${isValid ? "var(--accent-gold)" : "#DC2626"}`,
                        borderRadius: "12px",
                        padding: "6px 10px",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          const cur = parseInt(jumpVerseInput, 10) || 1;
                          if (cur > 1) setJumpVerseInput(String(cur - 1));
                        }}
                        style={{
                          width: "38px",
                          height: "38px",
                          borderRadius: "8px",
                          border: `1px solid ${readerTheme === "dark" ? "#334155" : "#E2E8F0"}`,
                          background: "transparent",
                          color: "inherit",
                          fontSize: "1.2rem",
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                      >
                        -
                      </button>

                      <input
                        type="number"
                        autoFocus
                        min={1}
                        max={maxVersesWeb}
                        value={jumpVerseInput}
                        onChange={(e) => {
                          const clean = e.target.value.replace(/[^0-9]/g, "");
                          setJumpVerseInput(clean);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && isValid) {
                            handleExecuteJumpWeb();
                          }
                        }}
                        placeholder={`1..${maxVersesWeb}`}
                        style={{
                          flex: 1,
                          fontSize: "1.6rem",
                          fontWeight: 800,
                          textAlign: "center",
                          background: "transparent",
                          border: "none",
                          outline: "none",
                          color: "inherit",
                          fontFamily: "Outfit, sans-serif",
                        }}
                      />

                      <button
                        type="button"
                        onClick={() => {
                          const cur = parseInt(jumpVerseInput, 10) || 1;
                          if (cur < maxVersesWeb)
                            setJumpVerseInput(String(cur + 1));
                        }}
                        style={{
                          width: "38px",
                          height: "38px",
                          borderRadius: "8px",
                          border: `1px solid ${readerTheme === "dark" ? "#334155" : "#E2E8F0"}`,
                          background: "transparent",
                          color: "inherit",
                          fontSize: "1.2rem",
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                      >
                        +
                      </button>
                    </div>

                    {!isValid && jumpVerseInput !== "" && (
                      <div
                        style={{
                          color: "#DC2626",
                          fontSize: "0.78rem",
                          marginTop: "4px",
                          textAlign: "center",
                        }}
                      >
                        Please enter a valid Ayah between 1 and {maxVersesWeb}
                      </div>
                    )}
                  </div>

                  {/* Quick Landmarks (Start, 25%, 50%, 75%, End) */}
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        opacity: 0.7,
                        marginBottom: "6px",
                      }}
                    >
                      QUICK PERCENTAGE JUMPS:
                    </label>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(5, 1fr)",
                        gap: "6px",
                      }}
                    >
                      {landmarksWeb.map((lm, idx) => {
                        const isSel = parsedV === lm.verse;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setJumpVerseInput(String(lm.verse));
                              handleExecuteJumpWeb(lm.verse);
                            }}
                            style={{
                              padding: "6px 2px",
                              borderRadius: "8px",
                              border: isSel
                                ? "1.5px solid var(--accent-gold)"
                                : `1px solid ${readerTheme === "dark" ? "#334155" : "#E2E8F0"}`,
                              backgroundColor: isSel
                                ? "rgba(212, 175, 55, 0.18)"
                                : "transparent",
                              color: isSel ? "var(--accent-gold)" : "inherit",
                              cursor: "pointer",
                              textAlign: "center",
                              fontSize: "0.75rem",
                              transition: "all 0.15s ease",
                            }}
                          >
                            <div style={{ fontSize: "0.68rem", opacity: 0.7 }}>
                              {lm.label}
                            </div>
                            <strong style={{ fontSize: "0.85rem" }}>
                              {lm.verse}
                            </strong>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Famous Ayahs Shortcuts */}
                  {famousForSurah.length > 0 && (
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                          opacity: 0.7,
                          marginBottom: "6px",
                        }}
                      >
                        FAMOUS AYAHS IN THIS SURAH:
                      </label>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "6px",
                        }}
                      >
                        {famousForSurah.map((fa, idx) => {
                          const isSel = parsedV === fa.verse;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setJumpVerseInput(String(fa.verse));
                                handleExecuteJumpWeb(fa.verse);
                              }}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "4px 8px",
                                borderRadius: "8px",
                                border: isSel
                                  ? "1.5px solid var(--accent-gold)"
                                  : `1px solid ${readerTheme === "dark" ? "#334155" : "#E2E8F0"}`,
                                backgroundColor: isSel
                                  ? "rgba(212, 175, 55, 0.18)"
                                  : "transparent",
                                color: isSel ? "var(--accent-gold)" : "inherit",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              <span>⭐</span> Ayah {fa.verse} ({fa.label})
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div
                  style={{
                    padding: "1rem 1.4rem",
                    borderTop: `1px solid ${readerTheme === "dark" ? "#1E293B" : "rgba(0, 0, 0, 0.08)"}`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleExecuteJumpWeb()}
                    disabled={!isValid}
                    className="btn btn-primary"
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      borderRadius: "12px",
                      backgroundColor: isValid
                        ? "var(--accent-gold)"
                        : "#94A3B8",
                      color: "#000000",
                      fontWeight: 800,
                      fontSize: "0.95rem",
                      cursor: isValid ? "pointer" : "not-allowed",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      boxShadow: isValid
                        ? "0 4px 15px rgba(212,175,55,0.3)"
                        : "none",
                    }}
                  >
                    <span>🎯</span>
                    {isValid
                      ? `Jump to Ayah ${parsedV} Now`
                      : `Enter Ayah (1 – ${maxVersesWeb})`}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Phase 6: Night Light Warm Amber Filter Overlay */}
      {nightLight && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: "none",
            zIndex: 99999,
            backgroundColor: `rgba(245, 158, 11, ${((nightLightIntensity || 20) / 100) * 0.45})`,
            mixBlendMode: "multiply",
            transition: "background-color 0.3s ease",
          }}
        />
      )}

      {/* Phase 6: Full Reader Customization Settings Modal */}
      {isReaderSettingsModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10001,
            backgroundColor: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(6px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "1rem",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget)
              setIsReaderSettingsModalOpen(false);
          }}
        >
          <div
            style={{
              backgroundColor:
                readerTheme === "dark"
                  ? "#0F172A"
                  : readerTheme === "cream"
                    ? "#FAF7EE"
                    : readerTheme === "sepia"
                      ? "#FCF8EE"
                      : readerTheme === "green"
                        ? "#F0FDF4"
                        : "#FFFFFF",
              color:
                readerTheme === "dark"
                  ? "#F8FAFC"
                  : readerTheme === "green"
                    ? "#14532D"
                    : readerTheme === "sepia"
                      ? "#433422"
                      : "#0F172A",
              border: `1.5px solid ${readerTheme === "dark" ? "#1E293B" : "rgba(212, 175, 55, 0.3)"}`,
              borderRadius: "18px",
              width: "100%",
              maxWidth: "640px",
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              overflow: "hidden",
              animation: "fadeIn 0.2s ease-out",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "1.1rem 1.4rem",
                borderBottom: `1px solid ${readerTheme === "dark" ? "#1E293B" : "rgba(0, 0, 0, 0.08)"}`,
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    backgroundColor: "rgba(212, 175, 55, 0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.1rem",
                  }}
                >
                  ⚙️
                </div>
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: "1.1rem",
                      fontWeight: 700,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    Reader Settings
                  </h3>
                  <p
                    style={{
                      margin: "2px 0 0",
                      fontSize: "0.78rem",
                      opacity: 0.7,
                    }}
                  >
                    Customize typography, reading theme, night shield & daily
                    goals
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsReaderSettingsModalOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "1.3rem",
                  padding: "4px 8px",
                  borderRadius: "8px",
                  color: "inherit",
                  opacity: 0.65,
                }}
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Settings Content */}
            <div
              style={{
                padding: "1.4rem",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "1.6rem",
              }}
            >
              {/* SECTION 1: READING MODE (THEMES) */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginBottom: "0.75rem",
                  }}
                >
                  <span style={{ fontSize: "1rem" }}>🎨</span>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: "0.92rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      opacity: 0.85,
                    }}
                  >
                    Reading Mode Theme
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(105px, 1fr))",
                    gap: "0.6rem",
                  }}
                >
                  {[
                    {
                      id: "light",
                      label: "☀️ Light",
                      bg: "#FFFFFF",
                      text: "#0F172A",
                      border: "#E2E8F0",
                    },
                    {
                      id: "cream",
                      label: "📜 Cream",
                      bg: "#FAF7EE",
                      text: "#1C1917",
                      border: "#D4AF37",
                    },
                    {
                      id: "sepia",
                      label: "🍂 Sepia",
                      bg: "#FCF8EE",
                      text: "#433422",
                      border: "#C89D56",
                    },
                    {
                      id: "green",
                      label: "🌿 Soft Green",
                      bg: "#F0FDF4",
                      text: "#14532D",
                      border: "#16A34A",
                    },
                    {
                      id: "dark",
                      label: "🌙 Dark",
                      bg: "#0F172A",
                      text: "#F8FAFC",
                      border: "#334155",
                    },
                  ].map((th) => {
                    const isSelected = readerTheme === th.id;
                    return (
                      <button
                        key={th.id}
                        onClick={() => {
                          setReaderTheme(th.id as any);
                          saveSettingsToStorage({ readerTheme: th.id });
                        }}
                        style={{
                          backgroundColor: th.bg,
                          color: th.text,
                          border: isSelected
                            ? "2px solid #D4AF37"
                            : `1px solid ${th.border}`,
                          borderRadius: "12px",
                          padding: "0.75rem 0.4rem",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "4px",
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: "0.82rem",
                          position: "relative",
                          boxShadow: isSelected
                            ? "0 4px 12px rgba(212, 175, 55, 0.2)"
                            : "none",
                          transform: isSelected ? "scale(1.02)" : "scale(1)",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <span>{th.label}</span>
                        {isSelected && (
                          <span
                            style={{
                              fontSize: "0.7rem",
                              color: "#D4AF37",
                              fontWeight: 800,
                            }}
                          >
                            ● Active
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 2: ARABIC TYPOGRAPHY */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginBottom: "0.75rem",
                  }}
                >
                  <span style={{ fontSize: "1rem" }}>✍️</span>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: "0.92rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      opacity: 0.85,
                    }}
                  >
                    Arabic Font & Size
                  </span>
                </div>

                {/* Font Selector Pills */}
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                    marginBottom: "1rem",
                  }}
                >
                  {[
                    { id: "amiri", label: "Amiri Quran" },
                    { id: "scheherazade", label: "Scheherazade New" },
                  ].map((f) => {
                    const isSelected = arabicFont === f.id;
                    return (
                      <button
                        key={f.id}
                        onClick={() => {
                          setArabicFont(f.id as any);
                          saveSettingsToStorage({ arabicFont: f.id });
                        }}
                        style={{
                          padding: "0.45rem 0.9rem",
                          borderRadius: "8px",
                          border: isSelected
                            ? "1.5px solid #D4AF37"
                            : "1px solid rgba(120, 120, 120, 0.25)",
                          backgroundColor: isSelected
                            ? "rgba(212, 175, 55, 0.18)"
                            : "rgba(0, 0, 0, 0.04)",
                          color: isSelected ? "#D4AF37" : "inherit",
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: "0.85rem",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>

                {/* Live Preview Box */}
                <div
                  style={{
                    padding: "1rem 1.25rem",
                    borderRadius: "12px",
                    backgroundColor:
                      readerTheme === "dark"
                        ? "#1E293B"
                        : "rgba(0, 0, 0, 0.03)",
                    border: "1px dashed rgba(212, 175, 55, 0.4)",
                    marginBottom: "1rem",
                    textAlign: "center",
                    direction: "rtl",
                  }}
                >
                  <div
                    style={{
                      fontFamily: getArabicFontFamilyWeb(arabicFont),
                      fontSize: `${fontSizeArabic}px`,
                      color: readerTheme === "dark" ? "#F8FAFC" : "#0F172A",
                      lineHeight: "2.1",
                    }}
                  >
                    بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                  </div>
                  <div
                    style={{
                      fontSize: "0.72rem",
                      opacity: 0.6,
                      direction: "ltr",
                      marginTop: "4px",
                    }}
                  >
                    Live Preview ({fontSizeArabic}px — {arabicFont})
                  </div>
                </div>

                {/* Arabic Size Slider & Stepper */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "1rem",
                    backgroundColor:
                      readerTheme === "dark"
                        ? "rgba(30, 41, 59, 0.6)"
                        : "rgba(0, 0, 0, 0.02)",
                    padding: "0.6rem 0.9rem",
                    borderRadius: "10px",
                  }}
                >
                  <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                    Arabic Size ({fontSizeArabic}px)
                  </span>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.6rem",
                    }}
                  >
                    <button
                      onClick={() => {
                        const next = Math.max(20, fontSizeArabic - 2);
                        setFontSizeArabic(next);
                        saveSettingsToStorage({ fontSizeArabic: next });
                      }}
                      style={{
                        width: "30px",
                        height: "30px",
                        borderRadius: "6px",
                        border: "1px solid rgba(120, 120, 120, 0.3)",
                        background: "transparent",
                        color: "inherit",
                        cursor: "pointer",
                        fontWeight: 700,
                      }}
                    >
                      -
                    </button>

                    <input
                      type="range"
                      min={20}
                      max={56}
                      step={2}
                      value={fontSizeArabic}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setFontSizeArabic(val);
                        saveSettingsToStorage({ fontSizeArabic: val });
                      }}
                      style={{
                        accentColor: "#D4AF37",
                        width: "120px",
                        cursor: "pointer",
                      }}
                    />

                    <button
                      onClick={() => {
                        const next = Math.min(56, fontSizeArabic + 2);
                        setFontSizeArabic(next);
                        saveSettingsToStorage({ fontSizeArabic: next });
                      }}
                      style={{
                        width: "30px",
                        height: "30px",
                        borderRadius: "6px",
                        border: "1px solid rgba(120, 120, 120, 0.3)",
                        background: "transparent",
                        color: "inherit",
                        cursor: "pointer",
                        fontWeight: 700,
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* SECTION 3: TRANSLATION & READING ASSISTANCE */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginBottom: "0.75rem",
                  }}
                >
                  <span style={{ fontSize: "1rem" }}>🌐</span>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: "0.92rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      opacity: 0.85,
                    }}
                  >
                    Translation & Assistance
                  </span>
                </div>

                {/* Show Translation Toggle */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.6rem 0",
                    borderBottom: "1px solid rgba(120, 120, 120, 0.12)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                      Show Translation
                    </div>
                    <div style={{ fontSize: "0.74rem", opacity: 0.65 }}>
                      Display translated meaning below Arabic
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={showTranslation}
                    onChange={(e) => {
                      setShowTranslation(e.target.checked);
                      saveSettingsToStorage({
                        showTranslation: e.target.checked,
                      });
                    }}
                    style={{
                      width: "20px",
                      height: "20px",
                      accentColor: "#D4AF37",
                      cursor: "pointer",
                    }}
                  />
                </div>

                {/* Translation Language Selector */}
                {showTranslation && (
                  <div
                    style={{
                      margin: "0.75rem 0",
                      display: "flex",
                      gap: "0.4rem",
                      flexWrap: "wrap",
                    }}
                  >
                    {[{ id: "en", label: "English" }].map((lang) => {
                      return (
                        <button
                          key={lang.id}
                          onClick={() => {
                            setSelectedTransLang("en");
                            saveSettingsToStorage({ selectedTransLang: "en" });
                          }}
                          style={{
                            padding: "0.35rem 0.8rem",
                            borderRadius: "6px",
                            border: "1.5px solid #D4AF37",
                            backgroundColor: "rgba(212, 175, 55, 0.18)",
                            color: "#D4AF37",
                            fontSize: "0.8rem",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          {lang.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Translation Size Stepper & Slider */}
                {showTranslation && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "1rem",
                      backgroundColor:
                        readerTheme === "dark"
                          ? "rgba(30, 41, 59, 0.6)"
                          : "rgba(0, 0, 0, 0.02)",
                      padding: "0.6rem 0.9rem",
                      borderRadius: "10px",
                      margin: "0.6rem 0",
                    }}
                  >
                    <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                      Translation Size ({fontSizeTranslation}px)
                    </span>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.6rem",
                      }}
                    >
                      <button
                        onClick={() => {
                          const next = Math.max(12, fontSizeTranslation - 1);
                          setFontSizeTranslation(next);
                          saveSettingsToStorage({ fontSizeTranslation: next });
                        }}
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "6px",
                          border: "1px solid rgba(120, 120, 120, 0.3)",
                          background: "transparent",
                          color: "inherit",
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                      >
                        -
                      </button>

                      <input
                        type="range"
                        min={12}
                        max={28}
                        step={1}
                        value={fontSizeTranslation}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setFontSizeTranslation(val);
                          saveSettingsToStorage({ fontSizeTranslation: val });
                        }}
                        style={{
                          accentColor: "#D4AF37",
                          width: "110px",
                          cursor: "pointer",
                        }}
                      />

                      <button
                        onClick={() => {
                          const next = Math.min(28, fontSizeTranslation + 1);
                          setFontSizeTranslation(next);
                          saveSettingsToStorage({ fontSizeTranslation: next });
                        }}
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "6px",
                          border: "1px solid rgba(120, 120, 120, 0.3)",
                          background: "transparent",
                          color: "inherit",
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}

                {/* Show Transliteration Toggle */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.6rem 0",
                    borderBottom: "1px solid rgba(120, 120, 120, 0.12)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                      Show Transliteration
                    </div>
                    <div style={{ fontSize: "0.74rem", opacity: 0.65 }}>
                      Latin phonetic pronunciation guide
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={showTransliteration}
                    onChange={(e) => {
                      setShowTransliteration(e.target.checked);
                      saveSettingsToStorage({
                        showTransliteration: e.target.checked,
                      });
                    }}
                    style={{
                      width: "20px",
                      height: "20px",
                      accentColor: "#D4AF37",
                      cursor: "pointer",
                    }}
                  />
                </div>

                {/* Tajweed Color-Coding Engine Toggle */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.6rem 0",
                    opacity: 0.7,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "0.88rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span>Tajweed Color-Coding</span>
                      <span
                        style={{
                          fontSize: "0.68rem",
                          backgroundColor: "rgba(212, 175, 55, 0.15)",
                          color: "#D4AF37",
                          padding: "1px 6px",
                          borderRadius: "10px",
                          fontWeight: 700,
                        }}
                      >
                        Coming Soon
                      </span>
                    </div>
                    <div style={{ fontSize: "0.74rem", opacity: 0.65 }}>
                      Visual rule highlighting across Arabic text (Qalqalah,
                      Ikhfa, Idgham, Iqlab, Madd, Ghunnah)
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={false}
                    disabled
                    style={{
                      width: "20px",
                      height: "20px",
                      accentColor: "#10B981",
                      cursor: "not-allowed",
                    }}
                  />
                </div>

                {/* Interactive Tajweed Guide Modal Trigger */}
                <button
                  onClick={() =>
                    showToast(
                      "Tajweed recitation rules & phonetics guide are coming soon!",
                      "info",
                    )
                  }
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.75rem 1rem",
                    borderRadius: "10px",
                    backgroundColor:
                      readerTheme === "dark" ? "#1E293B" : "#F8FAFC",
                    border:
                      readerTheme === "dark"
                        ? "1px solid #334155"
                        : "1px solid #E2E8F0",
                    color: readerTheme === "dark" ? "#94A3B8" : "#64748B",
                    marginTop: "0.6rem",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span>📖</span> Tajweed Rules & Interactive Guide
                    <span
                      style={{
                        fontSize: "0.65rem",
                        backgroundColor: "rgba(212, 175, 55, 0.15)",
                        color: "#D4AF37",
                        padding: "1px 6px",
                        borderRadius: "6px",
                        fontWeight: 700,
                      }}
                    >
                      Coming Soon
                    </span>
                  </span>
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* SECTION 4: NIGHT LIGHT (WARM BLUE LIGHT FILTER) */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginBottom: "0.75rem",
                  }}
                >
                  <span style={{ fontSize: "1rem" }}>🌙</span>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: "0.92rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      opacity: 0.85,
                    }}
                  >
                    Night Light (Warm Eye Shield)
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.6rem 0",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                      Enable Night Light
                    </div>
                    <div style={{ fontSize: "0.74rem", opacity: 0.65 }}>
                      Gentle warm amber overlay to reduce eye strain
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={nightLight}
                    onChange={(e) => {
                      setNightLight(e.target.checked);
                      saveSettingsToStorage({ nightLight: e.target.checked });
                    }}
                    style={{
                      width: "20px",
                      height: "20px",
                      accentColor: "#D4AF37",
                      cursor: "pointer",
                    }}
                  />
                </div>

                {nightLight && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "1rem",
                      backgroundColor:
                        readerTheme === "dark"
                          ? "rgba(30, 41, 59, 0.6)"
                          : "rgba(0, 0, 0, 0.02)",
                      padding: "0.6rem 0.9rem",
                      borderRadius: "10px",
                      marginTop: "0.4rem",
                    }}
                  >
                    <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                      Warmth Intensity ({nightLightIntensity}%)
                    </span>

                    <input
                      type="range"
                      min={10}
                      max={50}
                      step={5}
                      value={nightLightIntensity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setNightLightIntensity(val);
                        saveSettingsToStorage({ nightLightIntensity: val });
                      }}
                      style={{
                        accentColor: "#F59E0B",
                        width: "150px",
                        cursor: "pointer",
                      }}
                    />
                  </div>
                )}
              </div>

              {/* SECTION 5: DAILY READING TARGET */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginBottom: "0.75rem",
                  }}
                >
                  <span style={{ fontSize: "1rem" }}>🎯</span>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: "0.92rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      opacity: 0.85,
                    }}
                  >
                    Daily Reading Target
                  </span>
                </div>

                {/* Progress Card */}
                {(() => {
                  const getGoal = () => {
                    switch (dailyTargetType) {
                      case "1_page":
                        return 15;
                      case "5_ayahs":
                        return 5;
                      case "10_ayahs":
                        return 10;
                      case "1_juz":
                        return 150;
                      case "custom":
                        return dailyTargetCustomAyahs || 7;
                      default:
                        return 5;
                    }
                  };
                  const goal = getGoal();
                  const percent = Math.min(
                    100,
                    Math.round((todayReadCount / goal) * 100),
                  );

                  return (
                    <div
                      style={{
                        padding: "1rem 1.25rem",
                        borderRadius: "12px",
                        backgroundColor:
                          readerTheme === "dark"
                            ? "#1E293B"
                            : "rgba(212, 175, 55, 0.08)",
                        border: "1.5px solid rgba(212, 175, 55, 0.3)",
                        marginBottom: "1rem",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "0.6rem",
                        }}
                      >
                        <span style={{ fontSize: "0.88rem", fontWeight: 700 }}>
                          Today&apos;s Reading: {todayReadCount} / {goal} Ayahs
                        </span>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <button
                            onClick={() => {
                              const next = Math.max(0, todayReadCount - 1);
                              setTodayReadCount(next);
                              saveSettingsToStorage({
                                todayReadCount: next,
                                todayReadDate: new Date()
                                  .toISOString()
                                  .slice(0, 10),
                              });
                            }}
                            style={{
                              padding: "2px 8px",
                              borderRadius: "4px",
                              border: "1px solid rgba(120, 120, 120, 0.3)",
                              background: "transparent",
                              cursor: "pointer",
                              fontSize: "0.75rem",
                              color: "inherit",
                            }}
                            title="Decrement read ayah"
                          >
                            -1
                          </button>
                          <button
                            onClick={() => {
                              const next = todayReadCount + 1;
                              setTodayReadCount(next);
                              saveSettingsToStorage({
                                todayReadCount: next,
                                todayReadDate: new Date()
                                  .toISOString()
                                  .slice(0, 10),
                              });
                            }}
                            style={{
                              padding: "2px 8px",
                              borderRadius: "4px",
                              border: "1px solid #D4AF37",
                              backgroundColor: "rgba(212, 175, 55, 0.2)",
                              color: "#D4AF37",
                              cursor: "pointer",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                            }}
                            title="Increment read ayah"
                          >
                            +1
                          </button>
                          <span
                            style={{
                              fontSize: "0.78rem",
                              fontWeight: 800,
                              color: "#D4AF37",
                              marginLeft: "4px",
                            }}
                          >
                            {percent}%
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar Track */}
                      <div
                        style={{
                          height: "8px",
                          width: "100%",
                          borderRadius: "4px",
                          backgroundColor:
                            readerTheme === "dark"
                              ? "#334155"
                              : "rgba(0, 0, 0, 0.08)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${percent}%`,
                            backgroundColor: "#D4AF37",
                            borderRadius: "4px",
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* Target Options Grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                    gap: "0.5rem",
                  }}
                >
                  {[
                    { id: "1_page", label: "1 Page (~15 Ayahs)" },
                    { id: "5_ayahs", label: "5 Ayahs" },
                    { id: "10_ayahs", label: "10 Ayahs" },
                    { id: "1_juz", label: "1 Juz (~150 Ayahs)" },
                    { id: "custom", label: "Custom Target" },
                  ].map((tgt) => {
                    const isSelected = dailyTargetType === tgt.id;
                    return (
                      <button
                        key={tgt.id}
                        onClick={() => {
                          setDailyTargetType(tgt.id as any);
                          saveSettingsToStorage({ dailyTargetType: tgt.id });
                        }}
                        style={{
                          padding: "0.55rem 0.6rem",
                          borderRadius: "8px",
                          border: isSelected
                            ? "1.5px solid #D4AF37"
                            : "1px solid rgba(120, 120, 120, 0.2)",
                          backgroundColor: isSelected
                            ? "rgba(212, 175, 55, 0.18)"
                            : "transparent",
                          color: isSelected ? "#D4AF37" : "inherit",
                          fontSize: "0.8rem",
                          fontWeight: isSelected ? 700 : 500,
                          cursor: "pointer",
                          textAlign: "center",
                        }}
                      >
                        {tgt.label}
                      </button>
                    );
                  })}
                </div>

                {dailyTargetType === "custom" && (
                  <div
                    style={{
                      marginTop: "0.6rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.6rem",
                    }}
                  >
                    <span style={{ fontSize: "0.82rem" }}>Target Ayahs:</span>
                    <input
                      type="number"
                      min={1}
                      max={600}
                      value={dailyTargetCustomAyahs}
                      onChange={(e) => {
                        const val = Math.max(
                          1,
                          parseInt(e.target.value, 10) || 1,
                        );
                        setDailyTargetCustomAyahs(val);
                        saveSettingsToStorage({ dailyTargetCustomAyahs: val });
                      }}
                      style={{
                        padding: "0.3rem 0.6rem",
                        borderRadius: "6px",
                        border: "1px solid #D4AF37",
                        width: "80px",
                        fontSize: "0.85rem",
                        backgroundColor:
                          readerTheme === "dark" ? "#1E293B" : "#FFFFFF",
                        color: "inherit",
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "1rem 1.4rem",
                borderTop: `1px solid ${readerTheme === "dark" ? "#1E293B" : "rgba(0, 0, 0, 0.08)"}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor:
                  readerTheme === "dark"
                    ? "rgba(15, 23, 42, 0.8)"
                    : "rgba(0, 0, 0, 0.02)",
              }}
            >
              <button
                onClick={() => {
                  setFontSizeArabic(32);
                  setFontSizeTranslation(16);
                  setShowTranslation(true);
                  setShowTransliteration(false);
                  setReaderTheme("light");
                  setArabicFont("amiri");
                  setSelectedTransLang("en");
                  setWordByWordMode(false);
                  setNightLight(false);
                  setNightLightIntensity(20);
                  setDailyTargetType("5_ayahs");
                  setDailyTargetCustomAyahs(7);
                  saveSettingsToStorage({
                    fontSizeArabic: 32,
                    fontSizeTranslation: 16,
                    showTranslation: true,
                    showTransliteration: false,
                    readerTheme: "light",
                    arabicFont: "amiri",
                    selectedTransLang: "en",
                    wordByWordMode: false,
                    nightLight: false,
                    nightLightIntensity: 20,
                    dailyTargetType: "5_ayahs",
                    dailyTargetCustomAyahs: 7,
                  });
                  showToast("Settings reset to defaults!");
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.82rem",
                  color: "inherit",
                  opacity: 0.6,
                  textDecoration: "underline",
                }}
              >
                Reset to Defaults
              </button>

              <button
                onClick={() => setIsReaderSettingsModalOpen(false)}
                className="btn btn-primary"
                style={{
                  padding: "0.55rem 1.4rem",
                  fontSize: "0.88rem",
                  borderRadius: "10px",
                  fontWeight: 700,
                  backgroundColor: "#D4AF37",
                  borderColor: "#D4AF37",
                  color: "#000000",
                  cursor: "pointer",
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 3: Per-Verse 12-Action Menu Modal */}
      {isVerseActionMenuOpen && activeAyah && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 100000,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            backdropFilter: "blur(6px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "1rem",
          }}
          onClick={() => {
            setIsVerseActionMenuOpen(false);
            setActiveAyah(null);
            setVerseActionSubView(null);
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "540px",
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
              backgroundColor: readerTheme === "dark" ? "#0F172A" : "#FFFFFF",
              color: readerTheme === "dark" ? "#F8FAFC" : "#0F172A",
              border: `1px solid ${readerTheme === "dark" ? "#334155" : "#E2E8F0"}`,
              borderRadius: "20px",
              padding: "1.25rem 1.5rem 1.5rem",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.85rem",
                paddingBottom: "0.5rem",
                borderBottom: `1px solid ${readerTheme === "dark" ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)"}`,
                flexShrink: 0,
              }}
            >
              <div>
                <span
                  style={{
                    backgroundColor: "rgba(220, 38, 38, 0.12)",
                    color: "var(--accent-red)",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                  }}
                >
                  Surah {surah.transliteration} • Verse {activeAyah.id}
                </span>
              </div>
              <button
                onClick={() => {
                  setIsVerseActionMenuOpen(false);
                  setActiveAyah(null);
                  setVerseActionSubView(null);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  color: "var(--text-secondary)",
                }}
              >
                ✕
              </button>
            </div>

            {/* Scrollable Modal Body */}
            <div style={{ overflowY: "auto", flex: 1, paddingRight: "4px" }}>
              {/* Arabic Snippet (Constrained for long ayahs) */}
              <div
                style={{
                  backgroundColor:
                    readerTheme === "dark"
                      ? "#1E293B"
                      : "rgba(220, 38, 38, 0.04)",
                  padding: "0.85rem 1rem",
                  borderRadius: "12px",
                  marginBottom: "1rem",
                  textAlign: "right",
                  fontFamily: "'Amiri', serif",
                  fontSize: "1.25rem",
                  lineHeight: "2.1",
                  direction: "rtl",
                  maxHeight:
                    verseActionSubView === "translation" ? "110px" : "150px",
                  overflowY: "auto",
                  border: `1px solid ${readerTheme === "dark" ? "#334155" : "rgba(220, 38, 38, 0.12)"}`,
                }}
              >
                {activeAyah.text}
              </div>

              {/* Subviews if triggered */}
              {verseActionSubView === "translation" ? (
                // ─── Translation Sub-view (Text + Spoken Audio) ───────────────────────
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "0.6rem",
                    }}
                  >
                    <h4
                      style={{
                        margin: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        fontSize: "1.05rem",
                      }}
                    >
                      🌐 Translation
                    </h4>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Ayah {activeAyah.id}
                    </span>
                  </div>

                  {/* Language Selector Tabs */}
                  <div
                    style={{
                      display: "flex",
                      gap: "0.4rem",
                      marginBottom: "0.85rem",
                      flexWrap: "wrap",
                    }}
                  >
                    {(["en", "yoruba", "hausa", "igbo"] as const).map((l) => {
                      const isSelected = selectedTransLang === l;
                      const label =
                        l === "en"
                          ? "English"
                          : l === "yoruba"
                            ? "Yorùbá"
                            : l === "hausa"
                              ? "Hausa"
                              : "Igbo (Coming soon)";
                      return (
                        <button
                          key={l}
                          onClick={() => {
                            setSelectedTransLang(l);
                            if (l !== "igbo") {
                              saveSettingsToStorage({ selectedTransLang: l });
                            }
                          }}
                          style={{
                            padding: "0.35rem 0.75rem",
                            borderRadius: "8px",
                            border: isSelected
                              ? "1.5px solid var(--accent-red)"
                              : `1px solid ${readerTheme === "dark" ? "#334155" : "#CBD5E1"}`,
                            backgroundColor: isSelected
                              ? "var(--accent-red)"
                              : "transparent",
                            color: isSelected
                              ? "#FFFFFF"
                              : l === "igbo"
                                ? "#94A3B8"
                                : "inherit",
                            fontWeight: isSelected ? 700 : 500,
                            fontSize: "0.82rem",
                            cursor: "pointer",
                            transition: "all 0.15s",
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Written Translation Card */}
                  <div
                    style={{
                      backgroundColor:
                        readerTheme === "dark"
                          ? "#1E293B"
                          : "rgba(248, 250, 252, 0.95)",
                      border: `1px solid ${readerTheme === "dark" ? "#334155" : "#E2E8F0"}`,
                      borderLeft: "4px solid var(--accent-red)",
                      borderRadius: "14px",
                      padding: "1rem 1.15rem",
                      marginBottom: "0.85rem",
                      maxHeight: "260px",
                      overflowY: "auto",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "0.55rem",
                        paddingBottom: "0.4rem",
                        borderBottom: `1px solid ${readerTheme === "dark" ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)"}`,
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: "var(--accent-red)",
                        }}
                      >
                        {selectedTransLang === "en"
                          ? "🇬🇧 Sahih International"
                          : selectedTransLang === "yoruba"
                            ? "🇳🇬 Shaykh Abu Rahimah (Yorùbá)"
                            : selectedTransLang === "hausa"
                              ? "🇳🇬 Sheikh Abubakar Gumi (Hausa)"
                              : "🇳🇬 Igbo Translation (Coming soon)"}
                      </span>
                      {selectedTransLang !== "igbo" && (
                        <button
                          onClick={() => {
                            const txt = getWebLanguageTranslation(
                              selectedTransLang,
                              activeAyah.translation,
                              activeAyah.id,
                              surah.transliteration,
                              surah.id,
                            );
                            navigator.clipboard.writeText(txt);
                            showToast("Translation copied!");
                          }}
                          style={{
                            background: "transparent",
                            border: "none",
                            fontSize: "0.75rem",
                            color: "var(--text-secondary)",
                            cursor: "pointer",
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                          title="Copy translation"
                        >
                          📋 Copy
                        </button>
                      )}
                    </div>

                    {selectedTransLang === "igbo" ? (
                      <div
                        style={{
                          padding: "0.75rem 0.85rem",
                          borderRadius: "10px",
                          backgroundColor:
                            readerTheme === "dark"
                              ? "rgba(217, 119, 6, 0.12)"
                              : "rgba(217, 119, 6, 0.08)",
                          border: "1px dashed rgba(217, 119, 6, 0.4)",
                          color: readerTheme === "dark" ? "#FCD34D" : "#B45309",
                          fontSize: "0.85rem",
                          lineHeight: 1.6,
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 700,
                            marginBottom: "0.25rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <span>⏳</span>
                          <span>Koran N'Asụsụ Igbo (Coming soon)</span>
                        </div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "0.82rem",
                            opacity: 0.95,
                          }}
                        >
                          The authentic Central Igbo Qur'an translation is
                          currently undergoing scholarly review and will be
                          released in an upcoming update. In the meantime,
                          English (Sahih International), Yorùbá, and Hausa
                          translations are available.
                        </p>
                      </div>
                    ) : (
                      <p
                        style={{
                          fontSize: "1rem",
                          lineHeight: 1.8,
                          color: readerTheme === "dark" ? "#F1F5F9" : "#1E293B",
                          margin: 0,
                          fontWeight: 450,
                          letterSpacing: "0.15px",
                        }}
                      >
                        {getWebLanguageTranslation(
                          selectedTransLang,
                          activeAyah.translation,
                          activeAyah.id,
                          surah.transliteration,
                          surah.id,
                        )}
                      </p>
                    )}
                  </div>

                  {/* Spoken Audio Translation Info Strip */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor:
                        readerTheme === "dark"
                          ? "rgba(30, 41, 59, 0.6)"
                          : "rgba(220, 38, 38, 0.04)",
                      border: `1px solid ${readerTheme === "dark" ? "#334155" : "rgba(220, 38, 38, 0.12)"}`,
                      borderRadius: "10px",
                      padding: "0.55rem 0.85rem",
                      marginBottom: "0.85rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span style={{ fontSize: "0.95rem" }}>🗣️</span>
                      <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>
                        Spoken Audio Reciter:
                      </span>
                    </div>
                    <span
                      style={{
                        backgroundColor: "#D97706",
                        color: "#FFFFFF",
                        fontSize: "0.65rem",
                        fontWeight: 800,
                        padding: "2px 7px",
                        borderRadius: "6px",
                        letterSpacing: "0.3px",
                      }}
                    >
                      COMING SOON
                    </span>
                  </div>

                  <button
                    onClick={() => setVerseActionSubView(null)}
                    className="btn btn-secondary"
                    style={{
                      width: "100%",
                      padding: "0.55rem",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                    }}
                  >
                    Back to Actions
                  </button>
                </div>
              ) : verseActionSubView === "audio" ? (
                // ─── Audio Sub-view (Qari Recitation + Spoken Translation) ───────────
                <div>
                  <h4
                    style={{
                      margin: "0 0 0.75rem 0",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                    }}
                  >
                    🎵 Audio Recitation &amp; Translation
                  </h4>
                  <p
                    style={{
                      fontSize: "0.78rem",
                      color: "var(--text-secondary)",
                      marginBottom: "0.75rem",
                    }}
                  >
                    Ayah {activeAyah.id} • Surah {surah.transliteration} (
                    {surah.name})
                  </p>

                  {/* Qari Picker */}
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: "0.8rem",
                      marginBottom: "0.4rem",
                    }}
                  >
                    🕌 Select Qari Reciter:
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "0.4rem",
                      flexWrap: "wrap",
                      marginBottom: "0.75rem",
                    }}
                  >
                    {webQaris.map((q) => (
                      <button
                        key={q.id}
                        onClick={() => setWebActiveQariId(q.id)}
                        style={{
                          padding: "0.3rem 0.6rem",
                          borderRadius: "8px",
                          border: `1px solid ${webActiveQariId === q.id ? "#D4AF37" : "#CBD5E1"}`,
                          backgroundColor:
                            webActiveQariId === q.id
                              ? "rgba(212,175,55,0.18)"
                              : "transparent",
                          color:
                            webActiveQariId === q.id ? "#D4AF37" : "inherit",
                          fontWeight: webActiveQariId === q.id ? 700 : 500,
                          fontSize: "0.78rem",
                          cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                      >
                        {q.name}
                      </button>
                    ))}
                  </div>

                  {/* Chained Playback Mode Toggle Box */}
                  <div
                    style={{
                      backgroundColor:
                        readerTheme === "dark"
                          ? "#1E293B"
                          : "rgba(212, 175, 55, 0.08)",
                      border: `1px solid ${webIsChainedPlayback ? "#D4AF37" : readerTheme === "dark" ? "#334155" : "#E2E8F0"}`,
                      borderRadius: "10px",
                      padding: "0.65rem 0.85rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "0.85rem",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <span style={{ fontWeight: 700, fontSize: "0.82rem" }}>
                          🔗 Chained Playback Mode
                        </span>
                        <span
                          style={{
                            backgroundColor: "#D97706",
                            color: "#FFFFFF",
                            fontSize: "0.65rem",
                            fontWeight: 800,
                            padding: "2px 6px",
                            borderRadius: "4px",
                          }}
                        >
                          COMING SOON
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: "0.74rem",
                          color: "var(--text-secondary)",
                          marginTop: "2px",
                        }}
                      >
                        Recites Arabic verse, then automatically plays{" "}
                        {
                          WEB_AUDIO_TRANSLATIONS.find(
                            (t) => t.id === webAudioTranslationLang,
                          )?.language
                        }{" "}
                        audio
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        showToast(
                          "Chained playback mode is coming soon!",
                          "info",
                        )
                      }
                      style={{
                        backgroundColor:
                          readerTheme === "dark" ? "#334155" : "#CBD5E1",
                        color: readerTheme === "dark" ? "#94A3B8" : "#64748B",
                        border: "none",
                        borderRadius: "6px",
                        padding: "0.25rem 0.65rem",
                        fontWeight: 700,
                        fontSize: "0.75rem",
                        cursor: "pointer",
                      }}
                    >
                      SOON
                    </button>
                  </div>

                  {/* Recitation / Chained Play Button */}
                  <button
                    onClick={() => {
                      if (webIsPlayingRecitation || webIsPlayingTranslation) {
                        webRecitationAudioRef.current?.pause();
                        webTranslationAudioRef.current?.pause();
                        setWebIsPlayingRecitation(false);
                        setWebIsPlayingTranslation(false);
                        setWebChainedStep("idle");
                      } else {
                        const url = getWebVerseRecitationUrl(
                          webActiveQariId,
                          surah.id,
                          activeAyah.id,
                        );
                        if (webIsChainedPlayback) {
                          setWebChainedStep("arabic");
                          webPlayRecitation(url);
                        } else {
                          setWebChainedStep("idle");
                          webPlayRecitation(url);
                        }
                      }
                    }}
                    style={{
                      width: "100%",
                      backgroundColor:
                        webIsPlayingRecitation || webIsPlayingTranslation
                          ? "#7C3AED"
                          : "var(--accent-red)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "10px",
                      padding: "0.65rem 1rem",
                      fontWeight: 700,
                      fontSize: "0.88rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.5rem",
                      marginBottom: "1rem",
                      transition: "background 0.2s",
                    }}
                  >
                    {webChainedStep === "arabic"
                      ? "⏸ Step 1/2: Reciting Arabic..."
                      : webChainedStep === "translation"
                        ? `⏸ Step 2/2: Playing ${WEB_AUDIO_TRANSLATIONS.find((t) => t.id === webAudioTranslationLang)?.language} Translation...`
                        : webIsPlayingRecitation
                          ? "⏸ Pause Arabic Recitation"
                          : webIsPlayingTranslation
                            ? "⏸ Pause Translation"
                            : webIsChainedPlayback
                              ? "▶ Play Ayah (Chained Mode)"
                              : "▶ Play Ayah Recitation"}
                  </button>

                  {/* Spoken Audio Translation (Coming Soon) */}
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: "0.8rem",
                      marginBottom: "0.4rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                    }}
                  >
                    🗣️ Spoken Audio Translation per Verse:
                    <span
                      style={{
                        backgroundColor: "#D97706",
                        color: "#fff",
                        fontSize: "0.6rem",
                        padding: "1px 5px",
                        borderRadius: "4px",
                        fontWeight: 700,
                      }}
                    >
                      Coming Soon
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "0.4rem",
                      flexWrap: "wrap",
                      marginBottom: "0.75rem",
                      opacity: 0.6,
                    }}
                  >
                    {WEB_AUDIO_TRANSLATIONS.map((t) => (
                      <button
                        key={t.id}
                        onClick={() =>
                          showToast(
                            `${t.language} audio translation is coming soon!`,
                            "info",
                          )
                        }
                        style={{
                          padding: "0.3rem 0.6rem",
                          borderRadius: "8px",
                          border: "1px solid #CBD5E1",
                          backgroundColor: "transparent",
                          color: "inherit",
                          fontWeight: 500,
                          fontSize: "0.78rem",
                          cursor: "not-allowed",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.3rem",
                        }}
                      >
                        🔊 {t.language} (Soon)
                      </button>
                    ))}
                  </div>

                  {/* Translation Audio Card (Coming Soon) */}
                  <div
                    style={{
                      backgroundColor:
                        readerTheme === "dark"
                          ? "#1E293B"
                          : "rgba(220,38,38,0.04)",
                      border: `1px solid ${readerTheme === "dark" ? "#334155" : "rgba(220,38,38,0.15)"}`,
                      borderRadius: "10px",
                      padding: "0.75rem 1rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "1rem",
                      opacity: 0.7,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: "0.82rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.35rem",
                        }}
                      >
                        🔊 Spoken Audio Translation
                        <span
                          style={{
                            backgroundColor: "#D97706",
                            color: "#fff",
                            fontSize: "0.6rem",
                            padding: "1px 5px",
                            borderRadius: "4px",
                            fontWeight: 700,
                          }}
                        >
                          Coming Soon
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-secondary)",
                          marginTop: "2px",
                        }}
                      >
                        Voice audio translation is currently in development
                      </div>
                    </div>
                    <button
                      disabled
                      style={{
                        backgroundColor:
                          readerTheme === "dark" ? "#334155" : "#E2E8F0",
                        color: readerTheme === "dark" ? "#94A3B8" : "#64748B",
                        border: "none",
                        borderRadius: "8px",
                        padding: "0.45rem 1rem",
                        fontWeight: 700,
                        fontSize: "0.82rem",
                        cursor: "not-allowed",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        flexShrink: 0,
                      }}
                    >
                      Coming Soon
                    </button>
                  </div>

                  <button
                    onClick={() => setVerseActionSubView(null)}
                    className="btn btn-secondary"
                    style={{ width: "100%" }}
                  >
                    Back to Actions
                  </button>
                </div>
              ) : verseActionSubView === "tafseer" ? (
                <div>
                  <h4 style={{ margin: "0 0 0.5rem 0" }}>
                    📖 Tafseer Ibn Kathir
                  </h4>
                  <p
                    style={{
                      fontSize: "0.9rem",
                      lineHeight: 1.6,
                      color: "var(--text-secondary)",
                    }}
                  >
                    This holy verse addresses believers with profound
                    foundational wisdom, urging constant remembrance (Dhikr) and
                    steadfast adherence to divine guidance. Ibn Kathir notes
                    that reflecting (Tadabbur) upon its meaning brings
                    tranquility to the heart.
                  </p>
                  <button
                    onClick={() => setVerseActionSubView(null)}
                    className="btn btn-secondary"
                    style={{ marginTop: "1rem", width: "100%" }}
                  >
                    Back to Actions
                  </button>
                </div>
              ) : verseActionSubView === "reflection" ? (
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "0.25rem",
                    }}
                  >
                    <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>
                      {existingAyahReflection
                        ? "📝 Edit Reflection (Tadabbur)"
                        : "💭 Write Your Reflection (Tadabbur)"}
                    </h4>
                    {existingAyahReflection && (
                      <span
                        style={{
                          backgroundColor: "rgba(212, 175, 55, 0.15)",
                          color: "#B45309",
                          padding: "2px 8px",
                          borderRadius: "6px",
                          fontSize: "0.7rem",
                          fontWeight: 800,
                          letterSpacing: "0.05em",
                        }}
                      >
                        SAVED
                      </span>
                    )}
                  </div>
                  <p
                    style={{
                      margin: "0 0 0.75rem 0",
                      fontSize: "0.8rem",
                      color: readerTheme === "dark" ? "#94A3B8" : "#64748B",
                      lineHeight: 1.4,
                    }}
                  >
                    {existingAyahReflection
                      ? `Saved on ${new Date(existingAyahReflection.updatedAt).toLocaleDateString()}. You can edit your notes below or clear/delete.`
                      : `Jot personal thoughts, insights, or resolutions for Ayah ${activeAyah?.id}.`}
                  </p>

                  {isLoadingAyahReflection ? (
                    <div
                      style={{
                        padding: "1.5rem",
                        textAlign: "center",
                        color: readerTheme === "dark" ? "#94A3B8" : "#64748B",
                        fontSize: "0.85rem",
                      }}
                    >
                      Loading saved reflection...
                    </div>
                  ) : (
                    <>
                      {/* Quick Clear / Reset Text Row */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: "0.75rem",
                          marginBottom: "0.4rem",
                        }}
                      >
                        {existingAyahReflection &&
                          verseReflectionText !== existingAyahReflection.note && (
                            <button
                              type="button"
                              onClick={() =>
                                setVerseReflectionText(
                                  existingAyahReflection.note,
                                )
                              }
                              style={{
                                background: "none",
                                border: "none",
                                color:
                                  readerTheme === "dark"
                                    ? "#94A3B8"
                                    : "#64748B",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "3px",
                                padding: "2px 4px",
                              }}
                            >
                              <span>🔄</span> Reset to Saved
                            </button>
                          )}
                        {verseReflectionText.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setVerseReflectionText("")}
                            style={{
                              background: "none",
                              border: "none",
                              color:
                                readerTheme === "dark"
                                    ? "#94A3B8"
                                    : "#64748B",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "3px",
                              padding: "2px 4px",
                            }}
                          >
                            <span>⌫</span> Clear Text
                          </button>
                        )}
                      </div>

                      <textarea
                        value={verseReflectionText}
                        onChange={(e) => setVerseReflectionText(e.target.value)}
                        placeholder="What does this verse inspire in your heart today? What spiritual lesson or action will you take?..."
                        style={{
                          width: "100%",
                          minHeight: "110px",
                          padding: "0.75rem",
                          borderRadius: "8px",
                          border: `1px solid ${readerTheme === "dark" ? "#334155" : "#CBD5E1"}`,
                          backgroundColor:
                            readerTheme === "dark" ? "#1E293B" : "#F8FAFC",
                          color: "inherit",
                          fontSize: "0.9rem",
                          outline: "none",
                          lineHeight: 1.5,
                          fontFamily: "inherit",
                          resize: "vertical",
                        }}
                      />

                      <div
                        style={{
                          display: "flex",
                          gap: "0.5rem",
                          marginTop: "0.85rem",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          {existingAyahReflection && (
                            <button
                              type="button"
                              onClick={async () => {
                                if (!surah || !activeAyah) return;
                                if (
                                  !confirm(
                                    "Are you sure you want to delete this reflection?",
                                  )
                                )
                                  return;
                                const targetId =
                                  existingAyahReflection.id ||
                                  `${surah.id}:${activeAyah.id}`;
                                await deleteQuranReflection(
                                  targetId,
                                  user?.uid,
                                );
                                setExistingAyahReflection(null);
                                setVerseReflectionText("");
                                showToast("Reflection deleted");
                                setVerseActionSubView(null);
                              }}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.35rem",
                                padding: "0.45rem 0.85rem",
                                borderRadius: "8px",
                                border: "1px solid rgba(239, 68, 68, 0.4)",
                                backgroundColor: "rgba(239, 68, 68, 0.12)",
                                color: "#EF4444",
                                fontWeight: 600,
                                fontSize: "0.8rem",
                                cursor: "pointer",
                              }}
                            >
                              <span>🗑️</span> Delete
                            </button>
                          )}
                        </div>

                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button
                            type="button"
                            onClick={() => setVerseActionSubView(null)}
                            className="btn btn-secondary"
                            style={{
                              padding: "0.45rem 0.85rem",
                              fontSize: "0.85rem",
                            }}
                          >
                            Back
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!verseReflectionText.trim()) {
                                showToast(
                                  "Please enter a reflection note.",
                                  "warn",
                                );
                                return;
                              }
                              if (surah && activeAyah) {
                                const updatedList = await saveQuranReflection(
                                  surah.id,
                                  surah.transliteration,
                                  activeAyah.id,
                                  verseReflectionText.trim(),
                                  user?.uid,
                                );
                                const updatedItem = updatedList.find(
                                  (r) =>
                                    r.surahId === surah.id &&
                                    r.verseId === activeAyah.id,
                                );
                                setExistingAyahReflection(updatedItem || null);
                                showToast(
                                  existingAyahReflection
                                    ? `Reflection updated for Ayah ${activeAyah.id}! ✍️`
                                    : `Reflection saved for Ayah ${activeAyah.id}! ✍️`,
                                );
                              }
                              setVerseActionSubView(null);
                            }}
                            className="btn btn-primary"
                            style={{
                              backgroundColor: "var(--accent-red)",
                              padding: "0.45rem 1.15rem",
                              fontSize: "0.85rem",
                              fontWeight: 700,
                            }}
                          >
                            {existingAyahReflection
                              ? "Update Note"
                              : "Save Reflection"}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : verseActionSubView === "transliteration" ? (
                <div>
                  <h4 style={{ margin: "0 0 0.5rem 0" }}>
                    📐 Phonetic Pronunciation
                  </h4>
                  <p
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--text-secondary)",
                      marginBottom: "0.75rem",
                    }}
                  >
                    Surah {surah.transliteration} • Verse {activeAyah.id}
                  </p>
                  <div
                    style={{
                      maxHeight: "260px",
                      overflowY: "auto",
                      padding: "1rem",
                      borderRadius: "12px",
                      backgroundColor:
                        readerTheme === "dark"
                          ? "#1E293B"
                          : "rgba(212,175,55,0.08)",
                      border: `1px solid ${readerTheme === "dark" ? "#334155" : "rgba(212,175,55,0.25)"}`,
                      marginBottom: "1rem",
                    }}
                  >
                    {activeAyah.transliteration ? (
                      <p
                        style={{
                          margin: 0,
                          fontSize: "1.05rem",
                          fontStyle: "italic",
                          lineHeight: 1.8,
                          color: "var(--accent-gold)",
                        }}
                      >
                        {activeAyah.transliteration}
                      </p>
                    ) : (
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.875rem",
                          color: "var(--text-secondary)",
                          fontStyle: "italic",
                        }}
                      >
                        Transliteration data not available for this verse.
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setVerseActionSubView(null)}
                    className="btn btn-secondary"
                    style={{ width: "100%" }}
                  >
                    Back to Actions
                  </button>
                </div>
              ) : verseActionSubView === "memorize" ? (
                <div>
                  <h4 style={{ margin: "0 0 0.25rem 0", fontSize: "1.1rem" }}>
                    🧠 Memorization Setup
                  </h4>
                  <p
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--text-secondary)",
                      marginBottom: "0.75rem",
                    }}
                  >
                    Surah {surah.transliteration} (Ayah {activeAyah.id})
                  </p>

                  {/* 1. Scope Selection */}
                  <div style={{ marginBottom: "0.85rem" }}>
                    <label
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: "var(--text-secondary)",
                        textTransform: "uppercase",
                        display: "block",
                        marginBottom: "4px",
                      }}
                    >
                      What to memorize:
                    </label>
                    <div
                      style={{
                        display: "flex",
                        gap: "0.4rem",
                        flexWrap: "wrap",
                      }}
                    >
                      {[
                        { id: "this", label: `This Ayah (${activeAyah.id})` },
                        { id: "range", label: `Range` },
                        {
                          id: "surah",
                          label: `Full Surah (1–${surah.total_verses})`,
                        },
                      ].map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setWebMemorizeScope(s.id as any)}
                          style={{
                            padding: "0.35rem 0.65rem",
                            borderRadius: "20px",
                            border:
                              webMemorizeScope === s.id
                                ? "1.5px solid var(--accent-gold)"
                                : `1px solid ${readerTheme === "dark" ? "#334155" : "#CBD5E1"}`,
                            backgroundColor:
                              webMemorizeScope === s.id
                                ? "var(--accent-gold)"
                                : "transparent",
                            color:
                              webMemorizeScope === s.id ? "#000000" : "inherit",
                            fontWeight: webMemorizeScope === s.id ? 700 : 500,
                            fontSize: "0.75rem",
                            cursor: "pointer",
                          }}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>

                    {webMemorizeScope === "range" && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginTop: "0.5rem",
                          padding: "0.5rem 0.75rem",
                          borderRadius: "8px",
                          backgroundColor:
                            readerTheme === "dark"
                              ? "#1E293B"
                              : "rgba(212,175,55,0.08)",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.8rem",
                            color: "var(--text-secondary)",
                          }}
                        >
                          From Ayah {activeAyah.id} to Ayah:
                        </span>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <button
                            onClick={() =>
                              setWebMemorizeRangeEnd(
                                Math.max(
                                  activeAyah.id,
                                  webMemorizeRangeEnd - 1,
                                ),
                              )
                            }
                            style={{
                              width: "24px",
                              height: "24px",
                              borderRadius: "12px",
                              border: "none",
                              backgroundColor: "var(--accent-red)",
                              color: "#FFFFFF",
                              cursor: "pointer",
                              fontWeight: 700,
                            }}
                          >
                            -
                          </button>
                          <span
                            style={{ fontWeight: 700, fontSize: "0.95rem" }}
                          >
                            {webMemorizeRangeEnd}
                          </span>
                          <button
                            onClick={() =>
                              setWebMemorizeRangeEnd(
                                Math.min(
                                  surah.total_verses,
                                  webMemorizeRangeEnd + 1,
                                ),
                              )
                            }
                            style={{
                              width: "24px",
                              height: "24px",
                              borderRadius: "12px",
                              border: "none",
                              backgroundColor: "var(--accent-red)",
                              color: "#FFFFFF",
                              cursor: "pointer",
                              fontWeight: 700,
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. Practice Method */}
                  <div style={{ marginBottom: "0.85rem" }}>
                    <label
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: "var(--text-secondary)",
                        textTransform: "uppercase",
                        display: "block",
                        marginBottom: "4px",
                      }}
                    >
                      Practice Method:
                    </label>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      {[
                        {
                          id: "repeat",
                          title: "🔄 Repeat Loop",
                          desc: "Loops recitation audio with rest interval timer",
                        },
                        {
                          id: "blur",
                          title: "👁️ Blur Technique",
                          desc: "Recite from memory, click to reveal words",
                        },
                        {
                          id: "write",
                          title: "📝 Writing Mode",
                          desc: "Type in Arabic with real-time accuracy match score",
                        },
                      ].map((m) => (
                        <div
                          key={m.id}
                          onClick={() => setWebMemorizeMethod(m.id as any)}
                          style={{
                            padding: "0.5rem 0.75rem",
                            borderRadius: "10px",
                            border:
                              webMemorizeMethod === m.id
                                ? "1.5px solid var(--accent-gold)"
                                : `1px solid ${readerTheme === "dark" ? "#334155" : "#E2E8F0"}`,
                            backgroundColor:
                              webMemorizeMethod === m.id
                                ? "rgba(212,175,55,0.12)"
                                : readerTheme === "dark"
                                  ? "#1E293B"
                                  : "#F8FAFC",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: "0.85rem",
                              color:
                                webMemorizeMethod === m.id
                                  ? "var(--accent-gold)"
                                  : "inherit",
                            }}
                          >
                            {m.title}
                          </div>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--text-secondary)",
                              marginTop: "2px",
                            }}
                          >
                            {m.desc}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 3. Settings Grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "0.75rem",
                      marginBottom: "1rem",
                      paddingTop: "0.5rem",
                      borderTop: `1px solid ${readerTheme === "dark" ? "#334155" : "#E2E8F0"}`,
                    }}
                  >
                    <div>
                      <label
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          display: "block",
                          marginBottom: "4px",
                        }}
                      >
                        Target Reps:
                      </label>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <button
                          onClick={() =>
                            setWebMemorizeReps(Math.max(1, webMemorizeReps - 1))
                          }
                          style={{
                            width: "24px",
                            height: "24px",
                            borderRadius: "12px",
                            border: "none",
                            backgroundColor: "var(--accent-red)",
                            color: "#FFFFFF",
                            cursor: "pointer",
                            fontWeight: 700,
                          }}
                        >
                          -
                        </button>
                        <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                          {webMemorizeReps}x
                        </span>
                        <button
                          onClick={() =>
                            setWebMemorizeReps(
                              Math.min(20, webMemorizeReps + 1),
                            )
                          }
                          style={{
                            width: "24px",
                            height: "24px",
                            borderRadius: "12px",
                            border: "none",
                            backgroundColor: "var(--accent-red)",
                            color: "#FFFFFF",
                            cursor: "pointer",
                            fontWeight: 700,
                          }}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div>
                      <label
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          display: "block",
                          marginBottom: "4px",
                        }}
                      >
                        Interval:
                      </label>
                      <div style={{ display: "flex", gap: "4px" }}>
                        {[1, 3, 5, 10].map((s) => (
                          <button
                            key={s}
                            onClick={() => setWebMemorizeInterval(s)}
                            style={{
                              padding: "0.25rem 0.45rem",
                              borderRadius: "6px",
                              border: `1px solid ${webMemorizeInterval === s ? "var(--accent-gold)" : "#CBD5E1"}`,
                              backgroundColor:
                                webMemorizeInterval === s
                                  ? "var(--accent-gold)"
                                  : "transparent",
                              color:
                                webMemorizeInterval === s
                                  ? "#000000"
                                  : "inherit",
                              fontWeight: 700,
                              fontSize: "0.7rem",
                              cursor: "pointer",
                            }}
                          >
                            {s}s
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    <button
                      onClick={handleStartWebMemorization}
                      className="btn btn-primary"
                      style={{
                        width: "100%",
                        backgroundColor: "var(--accent-gold)",
                        color: "#000000",
                        fontWeight: 800,
                        padding: "0.65rem",
                        fontSize: "0.9rem",
                      }}
                    >
                      Start Session 🚀
                    </button>

                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        onClick={handleSaveWebMemorizationPlan}
                        className="btn btn-secondary"
                        style={{
                          flex: 1,
                          fontSize: "0.8rem",
                          padding: "0.45rem",
                        }}
                      >
                        Save Plan Only 💾
                      </button>
                      <button
                        onClick={() => setVerseActionSubView(null)}
                        className="btn btn-secondary"
                        style={{ fontSize: "0.8rem", padding: "0.45rem 1rem" }}
                      >
                        Back
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* 12-Action Grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: "0.75rem",
                    }}
                  >
                  {[
                    {
                      id: "bookmark",
                      label: "Bookmark",
                      icon: "🔖",
                      active:
                        quranBookmark?.surahId === surahId &&
                        quranBookmark?.verseId === activeAyah.id,
                      action: () => {
                        const wasBookmarked =
                          quranBookmark?.surahId === surahId &&
                          quranBookmark?.verseId === activeAyah.id;
                        updateQuranBookmark(
                          surahId,
                          wasBookmarked ? null : activeAyah.id,
                        );
                        showToast(
                          wasBookmarked
                            ? "Bookmark removed"
                            : "Ayah bookmarked! ★",
                        );
                      },
                    },
                    {
                      id: "save",
                      label: "Save Ayah",
                      icon: "💾",
                      active: false,
                      action: () => handleSaveAyahToStorage(activeAyah),
                    },
                    {
                      id: "copy",
                      label: "Copy",
                      icon: "📋",
                      active: false,
                      action: () => {
                        navigator.clipboard.writeText(
                          `${activeAyah.text}\n\n"${activeAyah.translation}"\n— Surah ${surah.transliteration} [${surah.id}:${activeAyah.id}]`,
                        );
                        showToast("Ayah copied to clipboard!");
                      },
                    },
                    {
                      id: "share",
                      label: "Share",
                      icon: "🔗",
                      active: false,
                      action: () => handleShareVerse(activeAyah),
                    },
                    {
                      id: "translation",
                      label: "Translation",
                      icon: "🌐",
                      active: false,
                      action: () => setVerseActionSubView("translation"),
                    },
                    {
                      id: "audio",
                      label: "Audio",
                      icon: "🎵",
                      active: false,
                      action: () => setVerseActionSubView("audio"),
                    },
                    {
                      id: "tafseer",
                      label: "Tafseer",
                      icon: "📖",
                      active: false,
                      comingSoon: true,
                      action: () =>
                        showToast("Tafseer is coming soon!", "info"),
                    },
                    {
                      id: "lessons",
                      label: "Lessons",
                      icon: "🎓",
                      active: false,
                      comingSoon: true,
                      action: () =>
                        showToast("Lessons are coming soon!", "info"),
                    },
                    {
                      id: "reflection",
                      label: "Reflection",
                      icon: "💭",
                      active: Boolean(existingAyahReflection),
                      action: () => {
                        if (existingAyahReflection) {
                          setVerseReflectionText(existingAyahReflection.note);
                        }
                        setVerseActionSubView("reflection");
                      },
                    },
                    {
                      id: "memorize",
                      label: "Memorize",
                      icon: "🧠",
                      active: false,
                      action: () => setVerseActionSubView("memorize"),
                    },
                    {
                      id: "transliteration",
                      label: "Phonetics",
                      icon: "📐",
                      active: false,
                      action: () => setVerseActionSubView("transliteration"),
                    },
                    {
                      id: "tajweed",
                      label: "Tajweed",
                      icon: "🎨",
                      active: false,
                      comingSoon: true,
                      action: () =>
                        showToast(
                          "Tajweed recitation rules & phonetics are coming soon!",
                          "info",
                        ),
                    },
                    {
                      id: "settings",
                      label: "Settings",
                      icon: "⚙️",
                      active: false,
                      action: () => {
                        setIsVerseActionMenuOpen(false);
                        setIsReaderSettingsModalOpen(true);
                      },
                    },
                  ].map((act) => (
                    <button
                      key={act.id}
                      onClick={act.action}
                      style={{
                        position: "relative",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        padding: "0.85rem 0.4rem",
                        borderRadius: "12px",
                        border: (act as any).active
                          ? "1.5px solid var(--accent-red)"
                          : `1px solid ${readerTheme === "dark" ? "#334155" : "#E2E8F0"}`,
                        backgroundColor: (act as any).active
                          ? "rgba(220, 38, 38, 0.12)"
                          : readerTheme === "dark"
                            ? "#1E293B"
                            : "#F8FAFC",
                        color: (act as any).active
                          ? "var(--accent-red)"
                          : "inherit",
                        opacity: (act as any).comingSoon ? 0.55 : 1,
                        cursor: (act as any).comingSoon
                          ? "not-allowed"
                          : "pointer",
                        transition:
                          "transform 0.15s ease, background 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!(act as any).comingSoon) {
                          e.currentTarget.style.transform = "translateY(-2px)";
                          if (!(act as any).active)
                            e.currentTarget.style.borderColor =
                              "var(--accent-red)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!(act as any).comingSoon) {
                          e.currentTarget.style.transform = "translateY(0)";
                          if (!(act as any).active)
                            e.currentTarget.style.borderColor =
                              readerTheme === "dark" ? "#334155" : "#E2E8F0";
                        }
                      }}
                    >
                      {(act as any).comingSoon && (
                        <span
                          style={{
                            position: "absolute",
                            top: "4px",
                            right: "4px",
                            backgroundColor: "#D97706",
                            color: "#FFFFFF",
                            fontSize: "0.55rem",
                            fontWeight: 800,
                            padding: "1px 4px",
                            borderRadius: "4px",
                            lineHeight: 1.2,
                            letterSpacing: "0.5px",
                          }}
                        >
                          SOON
                        </span>
                      )}
                      {act.id === "reflection" && existingAyahReflection && (
                        <span
                          style={{
                            position: "absolute",
                            top: "4px",
                            right: "4px",
                            backgroundColor: "var(--accent-red, #DC2626)",
                            color: "#FFFFFF",
                            fontSize: "0.55rem",
                            fontWeight: 800,
                            padding: "1px 4px",
                            borderRadius: "4px",
                            lineHeight: 1.2,
                            letterSpacing: "0.5px",
                          }}
                        >
                          SAVED
                        </span>
                      )}
                      <span style={{ fontSize: "1.4rem" }}>{act.icon}</span>
                      <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>
                        {act.label}
                      </span>
                    </button>
                  ))}
                </div>

                {surah && activeAyah && (
                  <div
                    style={{
                      marginTop: "1.25rem",
                      paddingTop: "0.85rem",
                      borderTop: `1px solid ${readerTheme === "dark" ? "#334155" : "#E2E8F0"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "0.5rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.78rem",
                        color: readerTheme === "dark" ? "#94A3B8" : "#64748B",
                      }}
                    >
                      Notice an error or mistranslation in this Ayah?
                    </span>
                    <ReportContentButton
                      contentId={`surah_${surah.id}_ayah_${activeAyah.id}`}
                      contentTitle={`Surah ${surah.transliteration} (${surah.name}) • Ayah ${activeAyah.id}`}
                      contentType="quran"
                      compact
                      label="Report Issue"
                    />
                  </div>
                )}
              </>
            )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PHASE 4: ACTIVE MEMORIZATION SESSION OVERLAY (WEB) */}
      {/* ========================================================================= */}
      {isWebMemorizeActive &&
        webTargetVerses.length > 0 &&
        surah &&
        (() => {
          const webActiveVerse =
            webTargetVerses[webMemCurrentVerseIdx] || webTargetVerses[0];
          const webPrevVerse =
            webMemCurrentVerseIdx > 0
              ? webTargetVerses[webMemCurrentVerseIdx - 1]
              : null;
          const webNextVerse =
            webMemCurrentVerseIdx < webTargetVerses.length - 1
              ? webTargetVerses[webMemCurrentVerseIdx + 1]
              : null;
          const webProgressRatio =
            webTargetVerses.length > 0
              ? (webMemCurrentVerseIdx + 1) / webTargetVerses.length
              : 0;
          const similarityScore = calculateSimilarityWeb(
            webActiveVerse.text,
            webMemUserWriting,
          );

          return (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 999999,
                backgroundColor: readerTheme === "dark" ? "#0A0F1D" : "#FAF9F5",
                color: readerTheme === "dark" ? "#F8FAFC" : "#0F172A",
                display: "flex",
                flexDirection: "column",
                backdropFilter: "blur(8px)",
                overflow: "hidden",
              }}
            >
              {/* Overlay Top Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "1rem 2rem",
                  borderBottom: `1px solid ${readerTheme === "dark" ? "#1E293B" : "rgba(212,175,55,0.2)"}`,
                }}
              >
                <button
                  onClick={() => setIsWebMemorizeActive(false)}
                  style={{
                    background: "transparent",
                    border: "none",
                    fontSize: "1.3rem",
                    cursor: "pointer",
                    color: "inherit",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontWeight: 600,
                  }}
                >
                  ✕ <span style={{ fontSize: "0.85rem" }}>Exit</span>
                </button>

                <div style={{ textAlign: "center" }}>
                  <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>
                    Surah {surah.transliteration}
                  </div>
                  <div
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--accent-gold)",
                      fontWeight: 600,
                      marginTop: "2px",
                    }}
                  >
                    Ayah {webActiveVerse.id} of{" "}
                    {webTargetVerses[webTargetVerses.length - 1].id} (
                    {webMemCurrentVerseIdx + 1} of {webTargetVerses.length})
                  </div>
                </div>

                {/* Method Switcher Pills */}
                <div style={{ display: "flex", gap: "6px" }}>
                  {[
                    { id: "repeat", label: "🔄 Repeat" },
                    { id: "blur", label: "👁️ Blur" },
                    { id: "write", label: "📝 Write" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setWebMemorizeMethod(m.id as any)}
                      style={{
                        padding: "0.35rem 0.75rem",
                        borderRadius: "20px",
                        border: `1px solid ${webMemorizeMethod === m.id ? "var(--accent-gold)" : readerTheme === "dark" ? "#334155" : "#E2E8F0"}`,
                        backgroundColor:
                          webMemorizeMethod === m.id
                            ? "var(--accent-gold)"
                            : "transparent",
                        color:
                          webMemorizeMethod === m.id ? "#000000" : "inherit",
                        fontSize: "0.8rem",
                        fontWeight: webMemorizeMethod === m.id ? 700 : 500,
                        cursor: "pointer",
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Global Linear Progress Bar */}
              <div
                style={{
                  height: "4px",
                  width: "100%",
                  backgroundColor: "rgba(212,175,55,0.2)",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.round(webProgressRatio * 100)}%`,
                    backgroundColor: "var(--accent-gold)",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>

              {/* Main Center Reading & Recitation Zone */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "2rem 1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "1.5rem",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    maxWidth: "800px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "1.5rem",
                  }}
                >
                  {/* Previous Verse Context Snippet */}
                  {webPrevVerse && (
                    <div
                      style={{
                        padding: "1rem 1.5rem",
                        borderRadius: "14px",
                        border: `1px solid ${readerTheme === "dark" ? "#1E293B" : "#E2E8F0"}`,
                        opacity: 0.35,
                        filter: "blur(1px)",
                        textAlign: "right",
                        direction: "rtl",
                        fontFamily: "'Amiri', serif",
                        fontSize: "1.3rem",
                        lineHeight: "2.2",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-secondary)",
                          direction: "ltr",
                          float: "left",
                        }}
                      >
                        Ayah {webPrevVerse.id}
                      </span>
                      {webPrevVerse.text}
                    </div>
                  )}

                  {/* FOCUSED AYAH CARD (Gold Highlight Glow) */}
                  <div
                    style={{
                      borderRadius: "20px",
                      border: "2px solid #D4AF37",
                      boxShadow: "0 0 40px rgba(212,175,55,0.22)",
                      padding: "2rem",
                      backgroundColor:
                        readerTheme === "dark" ? "#131C31" : "#FFFFFF",
                      position: "relative",
                    }}
                  >
                    {/* Top Badge: Ayah Number + Method info */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "1.25rem",
                      }}
                    >
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "0.3rem 0.8rem",
                          borderRadius: "20px",
                          border: "1px solid rgba(212,175,55,0.4)",
                          backgroundColor: "rgba(212,175,55,0.12)",
                          color: "var(--accent-gold)",
                          fontWeight: 700,
                          fontSize: "0.85rem",
                        }}
                      >
                        ✨ Verse {webActiveVerse.id}{" "}
                        {toArabicNumber(webActiveVerse.id)}
                      </div>

                      {webMemorizeMethod === "repeat" && (
                        <div
                          style={{
                            backgroundColor: "rgba(220,38,38,0.12)",
                            color: "var(--accent-red)",
                            fontWeight: 700,
                            fontSize: "0.8rem",
                            padding: "0.3rem 0.75rem",
                            borderRadius: "20px",
                          }}
                        >
                          Repetition {webMemRepCount}/{webMemorizeReps}
                        </div>
                      )}
                    </div>

                    {/* Arabic Recitation Content */}
                    <div
                      style={{
                        margin: "1rem 0 1.5rem 0",
                        minHeight: "100px",
                        textAlign: "right",
                        direction: "rtl",
                      }}
                    >
                      {webMemorizeMethod === "blur" ? (
                        <div
                          onClick={() => setWebMemIsBlurred(!webMemIsBlurred)}
                          style={{
                            cursor: "pointer",
                            padding: "1rem",
                            borderRadius: "12px",
                            position: "relative",
                          }}
                        >
                          <div
                            style={{
                              fontFamily: "'Amiri', serif",
                              fontSize: "2rem",
                              lineHeight: "2.4",
                              filter: webMemIsBlurred ? "blur(9px)" : "none",
                              transition: "filter 0.3s ease",
                              userSelect: "none",
                            }}
                          >
                            {webActiveVerse.text}
                          </div>
                          <div
                            style={{
                              position: "absolute",
                              top: "50%",
                              left: "50%",
                              transform: "translate(-50%, -50%)",
                              backgroundColor: "rgba(212,175,55,0.95)",
                              color: "#000000",
                              padding: "0.6rem 1.25rem",
                              borderRadius: "30px",
                              fontWeight: 700,
                              fontSize: "0.85rem",
                              boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
                              pointerEvents: "none",
                              opacity: webMemIsBlurred ? 1 : 0,
                              transition: "opacity 0.25s ease",
                            }}
                          >
                            👁️ Click to Reveal Ayah
                          </div>
                        </div>
                      ) : (
                        <div
                          style={{
                            fontFamily: "'Amiri', serif",
                            fontSize: "2rem",
                            lineHeight: "2.4",
                          }}
                        >
                          {cleanArabicText(webActiveVerse.text)}
                        </div>
                      )}
                    </div>

                    {/* English Translation Hint */}
                    <p
                      style={{
                        fontSize: "0.95rem",
                        fontStyle: "italic",
                        lineHeight: "1.6",
                        color: readerTheme === "dark" ? "#94A3B8" : "#64748B",
                        margin: "0 0 1.5rem 0",
                      }}
                    >
                      &ldquo;{webActiveVerse.translation}&rdquo;
                    </p>

                    {/* ========================================================================= */}
                    {/* METHOD-SPECIFIC INTERACTIVE PANELS */}
                    {/* ========================================================================= */}

                    {/* 1. REPEAT METHOD */}
                    {webMemorizeMethod === "repeat" && (
                      <div
                        style={{
                          paddingTop: "1.25rem",
                          borderTop: `1px solid ${readerTheme === "dark" ? "#1E293B" : "rgba(212,175,55,0.2)"}`,
                          display: "flex",
                          alignItems: "center",
                          gap: "1.5rem",
                        }}
                      >
                        <div
                          style={{
                            width: "72px",
                            height: "72px",
                            borderRadius: "50%",
                            border: "3px solid #D4AF37",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: "rgba(212,175,55,0.08)",
                            flexShrink: 0,
                          }}
                        >
                          <span
                            style={{
                              fontSize: "1.5rem",
                              fontWeight: 800,
                              color: "#D4AF37",
                              lineHeight: 1,
                            }}
                          >
                            {webMemRepCount}
                          </span>
                          <span
                            style={{
                              fontSize: "0.65rem",
                              fontWeight: 600,
                              color: "var(--text-secondary)",
                            }}
                          >
                            of {webMemorizeReps}
                          </span>
                        </div>

                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: "0.95rem",
                              marginBottom: "2px",
                            }}
                          >
                            {webMemCountdown !== null
                              ? `Rest interval: ${webMemCountdown}s...`
                              : webMemRepCount >= webMemorizeReps
                                ? "Target repetitions achieved! 🎉"
                                : "Recite this Ayah aloud"}
                          </div>
                          <div
                            style={{
                              fontSize: "0.8rem",
                              color: "var(--text-secondary)",
                              marginBottom: "0.75rem",
                            }}
                          >
                            {webMemCountdown !== null
                              ? "Breathe and prepare for next repetition"
                              : "Click 'Recited 1x' to log repetition counter"}
                          </div>

                          <button
                            onClick={() => {
                              if (webMemRepCount < webMemorizeReps) {
                                if (webMemorizeInterval > 0) {
                                  setWebMemCountdown(webMemorizeInterval);
                                } else {
                                  setWebMemRepCount((prev) => prev + 1);
                                }
                              } else {
                                if (webMemorizeAutoAdvance) {
                                  handleWebMemNext();
                                }
                              }
                            }}
                            className="btn btn-primary"
                            style={{
                              backgroundColor: "var(--accent-gold)",
                              color: "#000000",
                              fontWeight: 700,
                              padding: "0.5rem 1.25rem",
                              fontSize: "0.85rem",
                            }}
                          >
                            {webMemRepCount >= webMemorizeReps
                              ? "Done! Advance ✓"
                              : "Recited 1x (Next Rep)"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 2. BLUR METHOD */}
                    {webMemorizeMethod === "blur" && (
                      <div
                        style={{
                          paddingTop: "1.25rem",
                          borderTop: `1px solid ${readerTheme === "dark" ? "#1E293B" : "rgba(212,175,55,0.2)"}`,
                          display: "flex",
                          gap: "1rem",
                          justifyContent: "center",
                        }}
                      >
                        <button
                          onClick={() => setWebMemIsBlurred(!webMemIsBlurred)}
                          className="btn btn-primary"
                          style={{
                            backgroundColor: webMemIsBlurred
                              ? "var(--accent-gold)"
                              : "transparent",
                            borderColor: "var(--accent-gold)",
                            color: webMemIsBlurred
                              ? "#000000"
                              : "var(--accent-gold)",
                            fontWeight: 700,
                            fontSize: "0.85rem",
                            padding: "0.5rem 1.25rem",
                          }}
                        >
                          {webMemIsBlurred
                            ? "👁️ Show Ayah"
                            : "🙈 Hide & Test Recall"}
                        </button>

                        <button
                          onClick={() => {
                            setWebMemIsBlurred(true);
                            setWebMemRepCount((prev) => prev + 1);
                          }}
                          className="btn btn-secondary"
                          style={{
                            fontSize: "0.85rem",
                            padding: "0.5rem 1.25rem",
                          }}
                        >
                          ↺ Repeat ({webMemRepCount}x)
                        </button>
                      </div>
                    )}

                    {/* 3. WRITING METHOD */}
                    {webMemorizeMethod === "write" && (
                      <div
                        style={{
                          paddingTop: "1.25rem",
                          borderTop: `1px solid ${readerTheme === "dark" ? "#1E293B" : "rgba(212,175,55,0.2)"}`,
                        }}
                      >
                        <label
                          style={{
                            fontSize: "0.85rem",
                            fontWeight: 600,
                            display: "block",
                            marginBottom: "6px",
                          }}
                        >
                          ✍️ Type the Ayah from memory (in Arabic):
                        </label>
                        <textarea
                          value={webMemUserWriting}
                          onChange={(e) => setWebMemUserWriting(e.target.value)}
                          placeholder="اكتب الآية هنا..."
                          style={{
                            width: "100%",
                            minHeight: "90px",
                            padding: "0.75rem",
                            borderRadius: "10px",
                            border: `1.5px solid ${similarityScore >= 80 ? "#16a34a" : similarityScore >= 40 ? "var(--accent-gold)" : readerTheme === "dark" ? "#334155" : "#CBD5E1"}`,
                            backgroundColor:
                              readerTheme === "dark" ? "#0A0F1D" : "#F8FAFC",
                            color: "inherit",
                            fontFamily: "'Amiri', serif",
                            fontSize: "1.2rem",
                            direction: "rtl",
                            outline: "none",
                          }}
                        />

                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginTop: "8px",
                          }}
                        >
                          <div
                            style={{
                              padding: "0.25rem 0.75rem",
                              borderRadius: "12px",
                              backgroundColor:
                                similarityScore >= 80
                                  ? "rgba(22,163,74,0.15)"
                                  : similarityScore >= 40
                                    ? "rgba(212,175,55,0.15)"
                                    : "rgba(100,116,139,0.1)",
                              color:
                                similarityScore >= 80
                                  ? "#16a34a"
                                  : similarityScore >= 40
                                    ? "#D4AF37"
                                    : "var(--text-secondary)",
                              fontWeight: 700,
                              fontSize: "0.8rem",
                            }}
                          >
                            Accuracy: {similarityScore}% Match
                          </div>

                          <button
                            onClick={() => setWebMemShowHint(!webMemShowHint)}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "var(--accent-gold)",
                              fontSize: "0.8rem",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            {webMemShowHint
                              ? "Hide First Words"
                              : "💡 Peek Hint"}
                          </button>
                        </div>

                        {webMemShowHint && (
                          <div
                            style={{
                              marginTop: "8px",
                              padding: "0.5rem 0.75rem",
                              borderRadius: "8px",
                              backgroundColor: "rgba(212,175,55,0.08)",
                              color: "var(--accent-gold)",
                              textAlign: "right",
                              direction: "rtl",
                              fontFamily: "'Amiri', serif",
                            }}
                          >
                            First words:{" "}
                            {webActiveVerse.text
                              .split(" ")
                              .slice(0, 3)
                              .join(" ")}
                            ...
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Next Verse Context Snippet */}
                  {webNextVerse && (
                    <div
                      style={{
                        padding: "1rem 1.5rem",
                        borderRadius: "14px",
                        border: `1px solid ${readerTheme === "dark" ? "#1E293B" : "#E2E8F0"}`,
                        opacity: 0.35,
                        filter: "blur(1px)",
                        textAlign: "right",
                        direction: "rtl",
                        fontFamily: "'Amiri', serif",
                        fontSize: "1.3rem",
                        lineHeight: "2.2",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-secondary)",
                          direction: "ltr",
                          float: "left",
                        }}
                      >
                        Ayah {webNextVerse.id}
                      </span>
                      {webNextVerse.text}
                    </div>
                  )}
                </div>
              </div>

              {/* Overlay Bottom Footer Bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "1rem 2rem",
                  borderTop: `1px solid ${readerTheme === "dark" ? "#1E293B" : "rgba(212,175,55,0.2)"}`,
                  backgroundColor:
                    readerTheme === "dark" ? "#0F172A" : "#FFFFFF",
                  gap: "1rem",
                }}
              >
                <button
                  onClick={handleWebMemPrev}
                  disabled={webMemCurrentVerseIdx === 0}
                  className="btn btn-secondary"
                  style={{
                    opacity: webMemCurrentVerseIdx === 0 ? 0.3 : 1,
                    padding: "0.6rem 1.25rem",
                    fontSize: "0.85rem",
                  }}
                >
                  ‹ Prev Ayah
                </button>

                <button
                  onClick={() => {
                    setWebMemRepCount(1);
                    setWebMemCountdown(null);
                  }}
                  className="btn btn-secondary"
                  style={{
                    borderColor: "var(--accent-gold)",
                    color: "var(--accent-gold)",
                    padding: "0.6rem 1.25rem",
                    fontSize: "0.85rem",
                  }}
                >
                  Restart ↺
                </button>

                {/* PRIMARY ACTION: "I Know This ✓" */}
                <button
                  onClick={handleWebMemNext}
                  className="btn btn-primary"
                  style={{
                    flex: 1,
                    maxWidth: "320px",
                    backgroundColor: "var(--accent-gold)",
                    color: "#000000",
                    fontWeight: 800,
                    fontSize: "0.95rem",
                    padding: "0.7rem 1.5rem",
                    boxShadow: "0 4px 15px rgba(212,175,55,0.3)",
                  }}
                >
                  I Know This ✓
                </button>
              </div>

              {/* Session Completed Modal */}
              {webMemIsCompleted && (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    backgroundColor: "rgba(0,0,0,0.7)",
                    backdropFilter: "blur(6px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 9999999,
                    padding: "1.5rem",
                  }}
                >
                  <div
                    style={{
                      backgroundColor:
                        readerTheme === "dark" ? "#0F172A" : "#FFFFFF",
                      color: "inherit",
                      borderRadius: "24px",
                      border: "2px solid #D4AF37",
                      padding: "2.5rem 2rem",
                      maxWidth: "460px",
                      width: "100%",
                      textAlign: "center",
                      boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
                    }}
                  >
                    <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>
                      🏆
                    </div>
                    <h3
                      style={{
                        margin: "0 0 0.5rem 0",
                        fontSize: "1.6rem",
                        fontWeight: 800,
                      }}
                    >
                      Masha'Allah! 🎉
                    </h3>
                    <p
                      style={{
                        color: "var(--text-secondary)",
                        fontSize: "0.9rem",
                        lineHeight: 1.6,
                        marginBottom: "1.5rem",
                      }}
                    >
                      You have finished practicing Verses{" "}
                      {webTargetVerses[0].id} to{" "}
                      {webTargetVerses[webTargetVerses.length - 1].id} of Surah{" "}
                      {surah.transliteration}!
                    </p>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-around",
                        padding: "1rem",
                        borderRadius: "14px",
                        backgroundColor:
                          readerTheme === "dark"
                            ? "#1E293B"
                            : "rgba(212,175,55,0.08)",
                        marginBottom: "1.5rem",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: "1.3rem",
                            fontWeight: 800,
                            color: "var(--accent-gold)",
                          }}
                        >
                          {webTargetVerses.length}
                        </div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-secondary)",
                            marginTop: "2px",
                          }}
                        >
                          Verses Done
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: "1.3rem",
                            fontWeight: 800,
                            color: "var(--accent-gold)",
                          }}
                        >
                          {webMemorizeReps}x
                        </div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-secondary)",
                            marginTop: "2px",
                          }}
                        >
                          Target Reps
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: "1.3rem",
                            fontWeight: 800,
                            color: "var(--accent-gold)",
                          }}
                        >
                          100%
                        </div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-secondary)",
                            marginTop: "2px",
                          }}
                        >
                          Completed
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.75rem",
                      }}
                    >
                      <button
                        onClick={handleWebMarkMastered}
                        className="btn btn-primary"
                        style={{
                          backgroundColor: "var(--accent-gold)",
                          color: "#000000",
                          fontWeight: 800,
                          padding: "0.75rem",
                        }}
                      >
                        Mark as Mastered ★
                      </button>
                      <button
                        onClick={() => {
                          setWebMemIsCompleted(false);
                          setIsWebMemorizeActive(false);
                        }}
                        className="btn btn-secondary"
                        style={{ padding: "0.65rem" }}
                      >
                        Finish Session
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      {/* Phase 8: Interactive Web Tajweed Guide Modal */}
      {isTajweedGuideModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10005,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            backdropFilter: "blur(6px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "1rem",
            animation: "fadeIn 0.2s ease-out",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsTajweedGuideModalOpen(false);
          }}
        >
          <div
            style={{
              backgroundColor: readerTheme === "dark" ? "#0F172A" : "#FFFFFF",
              color: readerTheme === "dark" ? "#F8FAFC" : "#0F172A",
              border: `1.5px solid ${readerTheme === "dark" ? "#1E293B" : "#E2E8F0"}`,
              borderRadius: "20px",
              width: "100%",
              maxWidth: "680px",
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "1.25rem 1.5rem",
                borderBottom: `1px solid ${readerTheme === "dark" ? "#1E293B" : "#E2E8F0"}`,
                backgroundColor: readerTheme === "dark" ? "#0F172A" : "#F8FAFC",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "12px" }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "12px",
                    backgroundColor:
                      readerTheme === "dark" ? "#312E81" : "#E0E7FF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.3rem",
                  }}
                >
                  🎨
                </div>
                <div>
                  <h3
                    style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}
                  >
                    Tajweed Rules Guide
                  </h3>
                  <p
                    style={{
                      margin: "2px 0 0",
                      fontSize: "0.8rem",
                      opacity: 0.7,
                    }}
                  >
                    Interactive vocal guide for Quran reciters
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsTajweedGuideModalOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "1.4rem",
                  padding: "4px 8px",
                  borderRadius: "8px",
                  color: "inherit",
                  opacity: 0.65,
                }}
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Quick Tajweed Toggle Banner */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.9rem 1.25rem",
                margin: "1rem 1.5rem 0.5rem",
                borderRadius: "12px",
                border: `1px solid ${readerTheme === "dark" ? "#334155" : "#E2E8F0"}`,
                backgroundColor: readerTheme === "dark" ? "#1E293B" : "#F1F5F9",
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span>Tajweed Highlighting</span>
                  <span
                    style={{
                      fontSize: "0.68rem",
                      backgroundColor: "rgba(212, 175, 55, 0.15)",
                      color: "#D4AF37",
                      padding: "1px 6px",
                      borderRadius: "10px",
                      fontWeight: 700,
                    }}
                  >
                    Coming Soon
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "0.78rem",
                    opacity: 0.75,
                    marginTop: "2px",
                  }}
                >
                  Visual rule highlighting and vocal guide are currently being
                  prepared
                </div>
              </div>

              <button
                disabled
                className="btn"
                style={{
                  backgroundColor:
                    readerTheme === "dark" ? "#334155" : "#CBD5E1",
                  color: readerTheme === "dark" ? "#94A3B8" : "#64748B",
                  fontWeight: 800,
                  fontSize: "0.82rem",
                  padding: "0.4rem 1rem",
                  borderRadius: "20px",
                  border: "none",
                  cursor: "not-allowed",
                }}
              >
                COMING SOON
              </button>
            </div>

            {/* Rules Content */}
            <div
              style={{
                padding: "1rem 1.5rem 1.5rem",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              <div
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  opacity: 0.6,
                }}
              >
                7 Core Tajweed Rules & Examples
              </div>

              {TAJWEED_RULES.map((rule) => {
                const ruleColor =
                  readerTheme === "dark" ? rule.colorDark : rule.colorLight;
                const badgeBg =
                  readerTheme === "dark" ? rule.badgeBgDark : rule.badgeBgLight;

                return (
                  <div
                    key={rule.key}
                    style={{
                      borderRadius: "14px",
                      border: `1px solid ${readerTheme === "dark" ? "#1E293B" : "#E2E8F0"}`,
                      borderLeft: `5px solid ${ruleColor}`,
                      padding: "1.1rem 1.25rem",
                      backgroundColor:
                        readerTheme === "dark" ? "#1E293B" : "#F8FAFC",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.6rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "10px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                        }}
                      >
                        <span
                          style={{
                            backgroundColor: badgeBg,
                            color: ruleColor,
                            padding: "3px 10px",
                            borderRadius: "16px",
                            fontWeight: 800,
                            fontFamily: "'Amiri', serif",
                            fontSize: "0.95rem",
                          }}
                        >
                          {rule.arabicName}
                        </span>
                        <strong style={{ fontSize: "1.05rem" }}>
                          {rule.name}
                        </strong>
                      </div>
                    </div>

                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.88rem",
                        lineHeight: 1.55,
                        opacity: 0.85,
                      }}
                    >
                      {rule.description}
                    </p>

                    <div
                      style={{
                        fontSize: "0.82rem",
                        display: "flex",
                        gap: "6px",
                      }}
                    >
                      <span style={{ opacity: 0.75, fontWeight: 600 }}>
                        Rule Letters:
                      </span>
                      <strong style={{ color: ruleColor }}>
                        {rule.letters}
                      </strong>
                    </div>

                    {/* Example Box */}
                    <div
                      style={{
                        padding: "0.75rem 1rem",
                        borderRadius: "10px",
                        backgroundColor:
                          readerTheme === "dark" ? "#0F172A" : "#FFFFFF",
                        border: `1px solid ${readerTheme === "dark" ? "#334155" : "#E2E8F0"}`,
                        marginTop: "0.2rem",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.75rem",
                          opacity: 0.75,
                          marginBottom: "4px",
                        }}
                      >
                        Example Verse:
                      </div>
                      <div
                        dir="rtl"
                        style={{
                          fontFamily: "'Amiri', serif",
                          fontSize: "1.35rem",
                          fontWeight: 700,
                          color: ruleColor,
                          textAlign: "right",
                          marginBottom: "4px",
                        }}
                      >
                        {rule.exampleVerse}
                      </div>
                      <div
                        style={{
                          fontSize: "0.8rem",
                          fontStyle: "italic",
                          opacity: 0.8,
                        }}
                      >
                        "{rule.exampleTranslation}"
                      </div>
                    </div>

                    {/* Reciter Tip */}
                    <div
                      style={{
                        padding: "0.6rem 0.85rem",
                        borderRadius: "8px",
                        backgroundColor:
                          readerTheme === "dark"
                            ? "rgba(59, 130, 246, 0.15)"
                            : "#EFF6FF",
                        color: readerTheme === "dark" ? "#93C5FD" : "#1E3A8A",
                        fontSize: "0.8rem",
                        lineHeight: 1.45,
                        display: "flex",
                        gap: "8px",
                        alignItems: "flex-start",
                      }}
                    >
                      <span>💡</span>
                      <div>
                        <strong>Reciter Tip:</strong> {rule.practiceTip}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "1rem 1.5rem",
                borderTop: `1px solid ${readerTheme === "dark" ? "#1E293B" : "#E2E8F0"}`,
                textAlign: "right",
              }}
            >
              <button
                onClick={() => setIsTajweedGuideModalOpen(false)}
                className="btn btn-primary"
                style={{
                  backgroundColor: "#2563EB",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  padding: "0.6rem 1.5rem",
                  borderRadius: "10px",
                }}
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Web Quran Navigation & Study Hub Modal */}
      <WebQuranNavigationHub
        isOpen={isWebHubOpen}
        onClose={() => setIsWebHubOpen(false)}
        onOpen={() => setIsWebHubOpen(true)}
        currentSurahId={surahId}
        currentSurahName={surah?.transliteration}
        theme={readerTheme}
        userId={user?.uid}
        initialTab={webHubInitialTab}
        onAudioPlayingChange={setIsWebSurahAudioPlaying}
        onJumpToAyah={(targetAyahId, targetSurahId) => {
          setIsWebHubOpen(false);
          handleExecuteJumpWeb(targetAyahId, targetSurahId);
        }}
        onSelectQari={(qId) => {
          setWebActiveQariId(qId);
        }}
        selectedTranslationLang={selectedTransLang}
        onSelectTranslationLang={(lang) => {
          setSelectedTransLang(lang);
          saveSettingsToStorage({ selectedTransLang: lang });
        }}
      />
    </div>
  );
}
