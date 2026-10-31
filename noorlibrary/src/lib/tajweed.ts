// src/lib/tajweed.ts
// Phase 8: Interactive Tajweed Color-Coding Engine for Web & Mobile

export type TajweedRuleKey =
  | "ikhfa"
  | "idgham"
  | "iqlab"
  | "qalqalah"
  | "madd"
  | "ghunnah"
  | "silent";

export interface TajweedSegment {
  text: string;
  rule?: TajweedRuleKey;
}

export interface TajweedRuleInfo {
  key: TajweedRuleKey;
  name: string;
  arabicName: string;
  colorLight: string;
  colorDark: string;
  badgeBgLight: string;
  badgeBgDark: string;
  description: string;
  letters: string;
  exampleVerse: string;
  exampleTranslation: string;
  practiceTip: string;
}

export const TAJWEED_RULES: TajweedRuleInfo[] = [
  {
    key: "ikhfa",
    name: "Ikhfa (Concealment)",
    arabicName: "إِخْفَاء",
    colorLight: "#dc2626", // Red / Coral
    colorDark: "#f87171",
    badgeBgLight: "#fee2e2",
    badgeBgDark: "#7f1d1d",
    description: "Hiding the sound of Noon Sakinah (نْ) or Tanween (ً ٍ ٌ) between Izhar and Idgham with a 2-count nasal ghunnah before 15 specific letters.",
    letters: "ت ث ج د ذ ز س ش ص ض ط ظ ف ق ك",
    exampleVerse: "مِن قَبْلِكُمْ (Min qablikum)",
    exampleTranslation: "Before you",
    practiceTip: "Position your tongue near the exit point of the next letter without fully touching the roof of the mouth, holding the nasal sound for 2 counts.",
  },
  {
    key: "idgham",
    name: "Idgham (Assimilation)",
    arabicName: "إِدْغَام",
    colorLight: "#059669", // Emerald Green
    colorDark: "#34d399",
    badgeBgLight: "#d1fae5",
    badgeBgDark: "#064e3b",
    description: "Merging Noon Sakinah or Tanween into the following letter so they become a single doubled letter. Divided into Idgham with Ghunnah (ي ن م و) and without Ghunnah (ر ل).",
    letters: "ي ر م ل و ن (يَرْمَلُون)",
    exampleVerse: "مَن يَقُولُ (May-yaqool)",
    exampleTranslation: "Whoever says",
    practiceTip: "Merge the Noon completely into the next letter. For (ي ن م و), maintain a smooth 2-count nasal resonance.",
  },
  {
    key: "iqlab",
    name: "Iqlab (Conversion)",
    arabicName: "إِقْلَاب",
    colorLight: "#2563eb", // Royal Blue
    colorDark: "#60a5fa",
    badgeBgLight: "#dbeafe",
    badgeBgDark: "#1e3a8a",
    description: "Converting the sound of Noon Sakinah or Tanween into a light Meem (م) sound with ghunnah when followed by the letter Ba (ب). Often marked with a small Meem (ۘ / ۢ).",
    letters: "ب",
    exampleVerse: "مِن بَعْدِ (Mim-ba'di)",
    exampleTranslation: "After",
    practiceTip: "Close the lips softly without pressing hard, pronouncing a gentle Meem sound with a 2-count ghunnah before sounding the Ba.",
  },
  {
    key: "qalqalah",
    name: "Qalqalah (Echoing / Bouncing)",
    arabicName: "قَلْقَلَة",
    colorLight: "#d97706", // Gold / Amber
    colorDark: "#facc15",
    badgeBgLight: "#fef3c7",
    badgeBgDark: "#78350f",
    description: "A strong echoing or rebounding vocal vibration produced when pronouncing any of the 5 Qalqalah letters when they carry a Sukun or when stopping upon them.",
    letters: "ق ط ب ج د (قُطْبُ جَدٍّ)",
    exampleVerse: "قُلْ هُوَ اللَّهُ أَحَدٌ ۝ (Qul huwa Allahu ahad)",
    exampleTranslation: "Say, He is Allah, [who is] One",
    practiceTip: "Release the articulation point instantly without adding a vowel (harakah) to produce a crisp, reverberating bounce.",
  },
  {
    key: "madd",
    name: "Madd (Elongation)",
    arabicName: "مَدّ",
    colorLight: "#7c3aed", // Violet / Purple
    colorDark: "#a78bfa",
    badgeBgLight: "#ede9fe",
    badgeBgDark: "#4c1d95",
    description: "Prolonging the vocal stretch of Madd letters (ا, و, ي) beyond standard 2 counts up to 4, 5, or 6 counts, indicated by the wavy Maddah sign (ٓ).",
    letters: "ا , و , ي (with Maddah ٓ)",
    exampleVerse: "إِذَا جَاءَ نَصْرُ اللَّهِ (Idha jaaa'a nasrullah)",
    exampleTranslation: "When the victory of Allah comes",
    practiceTip: "Stretch your voice smoothly for 4 to 6 counts depending on whether it is Madd Muttasil, Munfasil, or Lazim.",
  },
  {
    key: "ghunnah",
    name: "Ghunnah (Nasalization)",
    arabicName: "غُنَّة",
    colorLight: "#ea580c", // Warm Orange
    colorDark: "#fb923c",
    badgeBgLight: "#ffedd5",
    badgeBgDark: "#7c2d12",
    description: "A resonant nasal tone produced from the nasal cavity whenever Noon or Meem carries a Shaddah (نّ / مّ).",
    letters: "نّ , مّ",
    exampleVerse: "إِنَّ مَعَ الْعُسْرِ يُسْرًا (Inna ma'al-'usri yusra)",
    exampleTranslation: "Indeed, with hardship comes ease",
    practiceTip: "Hold the double Noon or Meem firmly for a full 2 counts while directing the sound through your nose.",
  },
  {
    key: "silent",
    name: "Silent / Wasla",
    arabicName: "صِلَة / وَصْل",
    colorLight: "#64748b", // Slate Gray
    colorDark: "#94a3b8",
    badgeBgLight: "#f1f5f9",
    badgeBgDark: "#1e293b",
    description: "Letters that are written in the Mushaf text but skipped or unpronounced during continuous recitation (e.g. Hamzat al-Wasl ٱ or silent Alif).",
    letters: "ٱ , ا (Silent)",
    exampleVerse: "وَٱلشَّمْسِ وَضُحَىٰهَا (Wash-shamsi waduhaha)",
    exampleTranslation: "By the sun and its brightness",
    practiceTip: "Pass directly over Hamzat al-Wasl to the next pronounced letter during continuous reading.",
  },
];

/**
 * Returns the color for a given Tajweed rule key based on dark mode setting.
 */
export function getTajweedColor(ruleKey: TajweedRuleKey, isDark: boolean): string {
  const info = TAJWEED_RULES.find((r) => r.key === ruleKey);
  if (!info) return isDark ? "#e2e8f0" : "#1e293b";
  return isDark ? info.colorDark : info.colorLight;
}

const parseCache = new Map<string, TajweedSegment[]>();

// Arabic characters that do NOT connect to the following letter on the left
const NON_LEFT_JOINING = new Set([
  "\u0627", // ا Alif
  "\u0622", // آ Alif with Madda
  "\u0623", // أ Alif with Hamza Above
  "\u0625", // إ Alif with Hamza Below
  "\u0671", // ٱ Alif Wasla
  "\u062F", // د Dal
  "\u0630", // ذ Thal
  "\u0631", // ر Reh
  "\u0632", // ز Zain
  "\u0648", // و Waw
  "\u0624", // ؤ Waw with Hamza
  "\u0629", // ة Teh Marbuta
  "\u0649", // ى Alef Maksura
  " ", "\n", "\t", "\r",
]);

function isArabicDiacritic(code: number): boolean {
  return (
    (code >= 0x064b && code <= 0x065f) ||
    code === 0x0670 ||
    (code >= 0x06d6 && code <= 0x06ed)
  );
}

function getLastBaseChar(str: string): string {
  for (let i = str.length - 1; i >= 0; i--) {
    const code = str.charCodeAt(i);
    if (!isArabicDiacritic(code)) {
      return str[i];
    }
  }
  return "";
}

function getFirstBaseChar(str: string): string {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (!isArabicDiacritic(code)) {
      return str[i];
    }
  }
  return "";
}

/**
 * Injects Zero-Width Joiners (\u200D) at boundaries between adjacent segments
 * within the same Arabic word so the cursive shaper connects letters seamlessly.
 */
function preserveArabicCursiveLigatures(segments: TajweedSegment[]): TajweedSegment[] {
  if (segments.length <= 1) return segments;

  const result: TajweedSegment[] = [];
  const ZWJ = "\u200D";

  for (let i = 0; i < segments.length; i++) {
    let text = segments[i].text;
    const rule = segments[i].rule;

    // Check boundary with previous segment
    if (i > 0) {
      const prevText = segments[i - 1].text;
      const prevBase = getLastBaseChar(prevText);
      const currBase = getFirstBaseChar(text);

      if (prevBase && currBase && !NON_LEFT_JOINING.has(prevBase) && prevBase !== " " && currBase !== " ") {
        if (!text.startsWith(ZWJ)) {
          text = ZWJ + text;
        }
      }
    }

    // Check boundary with next segment
    if (i < segments.length - 1) {
      const nextText = segments[i + 1].text;
      const currBase = getLastBaseChar(text);
      const nextBase = getFirstBaseChar(nextText);

      if (currBase && nextBase && !NON_LEFT_JOINING.has(currBase) && currBase !== " " && nextBase !== " ") {
        if (!text.endsWith(ZWJ)) {
          text = text + ZWJ;
        }
      }
    }

    result.push({ text, rule });
  }

  return result;
}

/**
 * Parses Uthmani Arabic verse text into styled Tajweed segments.
 * Supports both raw Uthmani diacritics regex matching and pre-tagged HTML tags.
 * Results are cached in memory for high-performance reader rendering.
 */
export function parseTajweedText(text: string): TajweedSegment[] {
  if (!text) return [];

  const cached = parseCache.get(text);
  if (cached) return cached;

  // Check if text has embedded HTML tags like <span class="rule"> or <tajweed class="...">
  if (text.includes("<") && text.includes(">")) {
    const segments: TajweedSegment[] = [];
    const tagRegex = /<([a-z0-9]+)\b[^>]*?class=["']?([^"'>\s]+)[^>]*>([^<]+)<\/\1>/gi;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ text: text.substring(lastIndex, match.index) });
      }
      const rawClass = match[2].toLowerCase();
      let ruleKey: TajweedRuleKey | undefined;
      if (rawClass.includes("ikhfa")) ruleKey = "ikhfa";
      else if (rawClass.includes("idgham")) ruleKey = "idgham";
      else if (rawClass.includes("iqlab")) ruleKey = "iqlab";
      else if (rawClass.includes("qalqalah") || rawClass.includes("qalaqah")) ruleKey = "qalqalah";
      else if (rawClass.includes("madd")) ruleKey = "madd";
      else if (rawClass.includes("ghunnah")) ruleKey = "ghunnah";
      else if (rawClass.includes("slnt") || rawClass.includes("silent") || rawClass.includes("wasl")) ruleKey = "silent";

      segments.push({ text: match[3], rule: ruleKey });
      lastIndex = tagRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      segments.push({ text: text.substring(lastIndex) });
    }

    if (segments.length > 0) {
      const preserved = preserveArabicCursiveLigatures(segments);
      if (parseCache.size > 2000) parseCache.clear();
      parseCache.set(text, preserved);
      return preserved;
    }
  }

  // Refined non-destructive Uthmani Tajweed rules:
  // Using lookaheads and consonant bindings so rules NEVER swallow following consonants across word boundaries,
  // and NEVER isolate combining diacritics (like Maddah \u0653, small high meem \u06E2 / \u06ED, sukun \u06DF/\u06E4) without their base letter.
  // 1. Madd: Vowel or consonant letters carrying Maddah mark (\u0653) or \u0622 (Alif Maddah)
  // Keeps base consonant + vowels + tatweel + dagger alif + maddah unified (e.g. يَـٰٓ in يَـٰٓأَيُّهَا, آ in جَآءَ)
  const P_MADD = /([\u0622]|(?:[^\s\u064B-\u065F\u0670\u06D6-\u06ED][\u064B-\u065F\u0670\u06D6-\u06ED]*[\u0640]?[\u064B-\u065F\u0670\u06D6-\u06ED]*[\u0653])|(?:[\u0640]?[\u064B-\u065F\u0670\u06D6-\u06ED]*[\u0653]))/;
  // 2. Ghunnah: Noon/Meem with Shaddah (نّ / مّ) and optional vowel OR Tanween (e.g. مًّ in مُّسَمًّى)
  const P_GHUNNAH = /([\u0646\u0645][\u0651][\u064E\u064F\u0650\u064B\u064C\u064D\u0656\u0657\u065E]?)/;
  // 3. Qalqalah: قطبجد carrying Sukun (\u0652\u06E1) or at Waqf / verse pause
  const P_QALQALAH = /([قطبجد][\u0651]?[\u0652\u06E1]|(?:[قطبجد][\u0651]?[\u064B-\u0650]?(?=\s*(?:[۩ۚۖۗۘۙۛۜ۝]|$))))/;
  // 4. Iqlab: Noon/Consonant with small high/low Meem (\u06E2 / \u06ED), or Noon/Tanween before Ba (ب)
  const P_IQLAB = /((?:[\u0646][\u0652\u064E\u064F\u0650]?[\u06E2\u06ED]|(?:[^\s\u064B-\u065F\u0670\u06D6-\u06ED][\u0651]?[\u064B\u064C\u064D\u0656\u0657\u065E]*[\u06E2\u06ED])|(?:[\u0646][\u0652]?)(?=\s*ب)|(?:[^\s\u064B-\u065F\u0670\u06D6-\u06ED][\u0651]?[\u064B\u064C\u064D\u0656\u0657\u065E][\u0627\u0649\u0670]?)(?=\s*ب)|[\u06E2\u06ED]))/;
  // 5. Idgham: Noon Sakinah or Tanween (both aligned \u064B/\u064C/\u064D and sequential \u0656/\u0657, with optional Shaddah) before [يرملون]
  const P_IDGHAM = /((?:[\u0646][\u0652]?|(?:[^\s\u064B-\u065F\u0670\u06D6-\u06ED][\u0651]?[\u064B\u064C\u064D\u0656\u0657\u065E][\u0627\u0649\u0670]?|[\u0627\u0649][\u064B\u064C\u064D\u0656\u0657\u065E]))(?=\s+[يرملون]))/;
  // 6. Ikhfa: Noon Sakinah or Tanween (both aligned \u064B/\u064C/\u064D and sequential \u0656/\u0657, with optional Shaddah) before [تثجدذزسشصضطظفقك]
  const P_IKHFA = /((?:[\u0646][\u0652]?|(?:[^\s\u064B-\u065F\u0670\u06D6-\u06ED][\u0651]?[\u064B\u064C\u064D\u0656\u0657\u065E][\u0627\u0649\u0670]?|[\u0627\u0649][\u064B\u064C\u064D\u0656\u0657\u065E]))(?=\s*[تثجدذزسشصضطظفقك]))/;
  // 7. Silent: Letters carrying Sukun Mustadeer \u06DF
  const P_SILENT = /((?:[^\s\u064B-\u065F\u0670\u06D6-\u06ED]?[\u06DF]))/;

  const pattern = new RegExp(
    [
      P_MADD.source,
      P_GHUNNAH.source,
      P_QALQALAH.source,
      P_IQLAB.source,
      P_IDGHAM.source,
      P_IKHFA.source,
      P_SILENT.source,
    ].join("|"),
    "g"
  );

  const result: TajweedSegment[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;

  while ((m = pattern.exec(text)) !== null) {
    if (m.index > lastIdx) {
      result.push({ text: text.substring(lastIdx, m.index) });
    }

    const matchedStr = m[0];
    let rule: TajweedRuleKey = "madd";

    if (m[1]) rule = "madd";
    else if (m[2]) rule = "ghunnah";
    else if (m[3]) rule = "qalqalah";
    else if (m[4]) rule = "iqlab";
    else if (m[5]) rule = "idgham";
    else if (m[6]) rule = "ikhfa";
    else if (m[7]) rule = "silent";

    result.push({ text: matchedStr, rule });
    lastIdx = pattern.lastIndex;
  }

  if (lastIdx < text.length) {
    result.push({ text: text.substring(lastIdx) });
  }

  const finalSegments = result.length > 0 ? result : [{ text }];
  const preserved = preserveArabicCursiveLigatures(finalSegments);

  if (parseCache.size > 2000) parseCache.clear();
  parseCache.set(text, preserved);
  return preserved;
}
