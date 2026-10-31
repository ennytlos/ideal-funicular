import { db } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  writeBatch,
  onSnapshot,
} from "firebase/firestore";

export interface BookmarkItem {
  surahId: number;
  surahName: string;
  verseId: number;
  arabic: string;
  translation: string;
}

export interface SavedAyahItem {
  id: string;
  surahId: number;
  surahName: string;
  verseId: number;
  arabic: string;
  translation: string;
  folder: string;
  savedAt: number;
}

export interface QuranReflectionItem {
  id: string;
  surahId: number;
  surahName: string;
  verseId: number;
  note: string;
  updatedAt: number;
}

export interface MemorizationPlanItem {
  id: string;
  surahId: number;
  surahName: string;
  startVerse: number;
  endVerse: number;
  repetitions: number;
  intervalSec: number;
  method: "repeat" | "blur" | "write";
  status: "new" | "in_progress" | "mastered";
  lastPracticedAt: number;
}

export interface QariProfile {
  id: string;
  name: string;
  arabicName: string;
  style: string;
  serverUrl: string; // Base URL for surah-level files
  everyayahPath: string; // EveryAyah CDN folder for verse files
  country: string;
}

export const QARIS_LIST: QariProfile[] = [
  {
    id: "mishary",
    name: "Mishary Rashid Alafasy",
    arabicName: "مشاري بن راشد العفاسي",
    style: "Murattal • Beautiful & Melodic",
    serverUrl: "https://server8.mp3quran.net/afs/",
    everyayahPath: "Alafasy_128kbps",
    country: "Kuwait",
  },
  {
    id: "sudais",
    name: "Abdul Rahman Al-Sudais",
    arabicName: "عبد الرحمن السديس",
    style: "Imam of Masjid al-Haram • Powerful",
    serverUrl: "https://server11.mp3quran.net/sds/",
    everyayahPath: "Abdurrahmaan_As-Sudais_192kbps",
    country: "Saudi Arabia",
  },
  {
    id: "husary",
    name: "Mahmoud Khalil Al-Husary",
    arabicName: "محمود خليل الحصري",
    style: "Master of Tajweed • Clear & Educational",
    serverUrl: "https://server13.mp3quran.net/husr/",
    everyayahPath: "Husary_128kbps",
    country: "Egypt",
  },
  {
    id: "ghamdi",
    name: "Saad Al-Ghamdi",
    arabicName: "سعد الغامدي",
    style: "Smooth, Gentle & Emotional",
    serverUrl: "https://server7.mp3quran.net/ghamdi/",
    everyayahPath: "Ghamadi_40kbps",
    country: "Saudi Arabia",
  },
  {
    id: "abdulbasit",
    name: "Abdulbasit Abdussamad",
    arabicName: "عبد الباسط عبد الصمد",
    style: "Legendary Mujawwad & Murattal",
    serverUrl: "https://server10.mp3quran.net/basit/",
    everyayahPath: "Abdul_Basit_Mujawwad_128kbps",
    country: "Egypt",
  },
];

export interface AudioTranslationProfile {
  id: string;
  language: string;
  speakerName: string;
  serverUrl: string;
  sizeLabel: string;
  isInstalled?: boolean;
}

export const AUDIO_TRANSLATIONS_LIST: AudioTranslationProfile[] = [
  {
    id: "en",
    language: "English",
    speakerName: "Saheeh International Audio Reciter",
    serverUrl: "https://everyayah.com/data/translations/",
    sizeLabel: "145 MB",
    isInstalled: true,
  },
  {
    id: "yoruba",
    language: "Yorùbá",
    speakerName: "Malam Yusuf Yorùbá Audio Translation",
    serverUrl: "https://everyayah.com/data/translations/",
    sizeLabel: "160 MB",
    isInstalled: false,
  },
  {
    id: "hausa",
    language: "Hausa",
    speakerName: "Sheikh Abubakar Gumi Hausa Audio",
    serverUrl: "https://everyayah.com/data/translations/",
    sizeLabel: "155 MB",
    isInstalled: false,
  },
  {
    id: "igbo",
    language: "Igbo (Coming soon)",
    speakerName: "Not available yet",
    serverUrl: "",
    sizeLabel: "N/A",
    isInstalled: false,
  },
];

export interface TranslationModuleInfo {
  id: string;
  language: string;
  title: string;
  translator: string;
  sizeBytes: number;
  sizeLabel: string;
  isBundled: boolean;
  isInstalled: boolean;
  isActive: boolean;
}

export const DEFAULT_TRANSLATION_MODULES: TranslationModuleInfo[] = [
  {
    id: "en_saheeh",
    language: "English",
    title: "Saheeh International",
    translator: "Saheeh International (Clean Hafs)",
    sizeBytes: 1800000,
    sizeLabel: "Global English",
    isBundled: true,
    isInstalled: true,
    isActive: true,
  },
  {
    id: "yo_quran",
    language: "Yorùbá",
    title: "Al-Qur'an Ninu Ede Yoruba",
    translator: "Shaykh Abu Rahimah Mikaa'eel",
    sizeBytes: 2400000,
    sizeLabel: "Indigenous Yorùbá",
    isBundled: false,
    isInstalled: true,
    isActive: false,
  },
  {
    id: "ha_quran",
    language: "Hausa",
    title: "Alkur'ani Mai Girma",
    translator: "Abubakar Mahmoud Gumi",
    sizeBytes: 2200000,
    sizeLabel: "Indigenous Hausa",
    isBundled: false,
    isInstalled: true,
    isActive: false,
  },
  {
    id: "ig_quran",
    language: "Igbo (Coming soon)",
    title: "Koran N'Asụsụ Igbo (Coming soon)",
    translator: "Scholarly Review in Progress",
    sizeBytes: 0,
    sizeLabel: "Coming Soon",
    isBundled: false,
    isInstalled: false,
    isActive: false,
  },
  {
    id: "tafseer_ibnkathir",
    language: "Tafseer (Coming soon)",
    title: "Tafsir Ibn Kathir (Abridged - Coming soon)",
    translator: "Darussalam Publications",
    sizeBytes: 0,
    sizeLabel: "Coming Soon",
    isBundled: false,
    isInstalled: false,
    isActive: false,
  },
];

const KEYS = {
  BOOKMARKS: "noor_quran_bookmarks",
  SAVED_AYAHS: "noor_saved_ayahs",
  REFLECTIONS: "noor_quran_reflections",
  MEMORIZATION: "noor_quran_memorization_plans",
  MODULES: "noor_translation_modules",
  ACTIVE_QARI: "noor_active_qari_id",
  AVAILABLE_QARIS: "noor_available_qaris_v1",
  READER_SETTINGS: "noor_quran_settings",
};

function readLocalStorageJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed === undefined || parsed === null ? fallback : (parsed as T);
  } catch {
    return fallback;
  }
}

function writeLocalStorageJson<T>(key: string, value: T): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

type VerseRecord = { id: string; surahId: number; verseId: number };

function getVerseRecordKey(item: Pick<VerseRecord, "surahId" | "verseId">): string {
  return `${item.surahId}_${item.verseId}`;
}

function getCanonicalVerseRecordId(item: Pick<VerseRecord, "surahId" | "verseId">): string {
  return `${item.surahId}:${item.verseId}`;
}

function getVerseRecordsStorageKey(collectionKey: string, uid?: string): string {
  return uid ? `${collectionKey}_${uid}` : collectionKey;
}

function getDeletedRecordsKey(collectionKey: string, uid: string): string {
  return `${collectionKey}_deleted_${uid}`;
}

function readDeletedRecordKeys(collectionKey: string, uid: string): Set<string> {
  const keys = readLocalStorageJson<string[]>(getDeletedRecordsKey(collectionKey, uid), []);
  return new Set(Array.isArray(keys) ? keys.filter((key) => typeof key === "string") : []);
}

function writeDeletedRecordKeys(collectionKey: string, uid: string, keys: Set<string>): void {
  writeLocalStorageJson(getDeletedRecordsKey(collectionKey, uid), Array.from(keys));
}

function mergeVerseRecords<T extends VerseRecord>(
  cloudItems: T[],
  localItems: T[],
  deletedKeys: Set<string>,
  getTimestamp: (item: T) => number
): T[] {
  const merged = new Map<string, T>();
  for (const item of [...cloudItems, ...localItems]) {
    if (!Number.isInteger(item.surahId) || !Number.isInteger(item.verseId)) continue;
    const key = getVerseRecordKey(item);
    if (deletedKeys.has(key)) continue;
    const previous = merged.get(key);
    if (!previous || getTimestamp(item) >= getTimestamp(previous)) {
      merged.set(key, { ...item, id: getCanonicalVerseRecordId(item) });
    }
  }
  return Array.from(merged.values()).sort((a, b) => getTimestamp(b) - getTimestamp(a));
}

async function syncVerseRecords<T extends VerseRecord>(
  uid: string,
  collectionName: "quran_saved_ayahs" | "quran_reflections",
  localItems: T[],
  deletedKeys: Set<string>,
  getTimestamp: (item: T) => number,
  isValidRecord: (item: T) => boolean
): Promise<T[]> {
  const colRef = collection(db, "users", uid, collectionName);
  const snapshot = await getDocs(colRef);
  const cloudByKey = new Map<string, Array<{ id: string; item: T }>>();
  const cloudItems: T[] = [];

  for (const document of snapshot.docs) {
    const item = { ...document.data(), id: document.id } as T;
    if (!isValidRecord(item)) continue;
    cloudItems.push(item);
    const key = getVerseRecordKey(item);
    const group = cloudByKey.get(key) ?? [];
    group.push({ id: document.id, item });
    cloudByKey.set(key, group);
  }

  const records = mergeVerseRecords(cloudItems, localItems, deletedKeys, getTimestamp);
  const operations: Array<{ kind: "set"; id: string; item: T } | { kind: "delete"; id: string }> = [];
  for (const record of records) {
    operations.push({ kind: "set", id: getCanonicalVerseRecordId(record), item: record });
  }
  for (const [key, cloudRecords] of cloudByKey) {
    if (deletedKeys.has(key)) {
      for (const cloudRecord of cloudRecords) operations.push({ kind: "delete", id: cloudRecord.id });
      continue;
    }
    const canonicalId = getCanonicalVerseRecordId(cloudRecords[0].item);
    for (const cloudRecord of cloudRecords) {
      if (cloudRecord.id !== canonicalId) operations.push({ kind: "delete", id: cloudRecord.id });
    }
  }

  for (let start = 0; start < operations.length; start += 450) {
    const batch = writeBatch(db);
    for (const operation of operations.slice(start, start + 450)) {
      const ref = doc(colRef, operation.id);
      if (operation.kind === "set") {
        batch.set(ref, { ...operation.item, id: operation.id, userId: uid }, { merge: true });
      } else {
        batch.delete(ref);
      }
    }
    await batch.commit();
  }

  return records;
}

function isSavedAyahRecord(item: SavedAyahItem): boolean {
  return Boolean(
    item &&
      typeof item === "object" &&
      Number.isInteger(item.surahId) &&
      Number.isInteger(item.verseId) &&
      Number.isFinite(item.savedAt)
  );
}

function isReflectionRecord(item: QuranReflectionItem): boolean {
  return Boolean(
    item &&
      typeof item === "object" &&
      Number.isInteger(item.surahId) &&
      Number.isInteger(item.verseId) &&
      Number.isFinite(item.updatedAt)
  );
}

// --- Storage API with LocalStorage & Firestore Dual Persistence ---

export async function getSavedAyahs(uid?: string): Promise<SavedAyahItem[]> {
  const deletedKeys = uid ? readDeletedRecordKeys(KEYS.SAVED_AYAHS, uid) : new Set<string>();
  const storageKey = getVerseRecordsStorageKey(KEYS.SAVED_AYAHS, uid);
  const cached = readLocalStorageJson<SavedAyahItem[]>(storageKey, []);
  const localItems = Array.isArray(cached) ? cached.filter(isSavedAyahRecord) : [];
  const visibleLocalItems = mergeVerseRecords(
    [],
    localItems,
    deletedKeys,
    (item) => item.savedAt
  );

  if (!uid) return visibleLocalItems;

  try {
    const merged = await syncVerseRecords(
      uid,
      "quran_saved_ayahs",
      localItems,
      deletedKeys,
      (item) => item.savedAt,
      isSavedAyahRecord
    );
    deletedKeys.clear();
    writeDeletedRecordKeys(KEYS.SAVED_AYAHS, uid, deletedKeys);
    writeLocalStorageJson(storageKey, merged);
    return merged;
  } catch (err) {
    console.warn("Failed to reconcile saved ayahs with Firestore:", err);
    return visibleLocalItems;
  }
}

export async function saveAyahToFolder(
  item: Omit<SavedAyahItem, "id" | "savedAt">,
  uid?: string
): Promise<SavedAyahItem[]> {
  const current = await getSavedAyahs(uid);
  const verseKey = getVerseRecordKey(item);
  const id = getCanonicalVerseRecordId(item);
  const newItem: SavedAyahItem = { ...item, id, savedAt: Date.now() };
  const updated = [newItem, ...current.filter((x) => !(x.surahId === item.surahId && x.verseId === item.verseId))];

  if (uid) {
    const deletedKeys = readDeletedRecordKeys(KEYS.SAVED_AYAHS, uid);
    deletedKeys.delete(verseKey);
    writeDeletedRecordKeys(KEYS.SAVED_AYAHS, uid, deletedKeys);
  }

  if (typeof window !== "undefined") {
    writeLocalStorageJson(getVerseRecordsStorageKey(KEYS.SAVED_AYAHS, uid), updated);
  }

  if (uid) {
    try {
      const deletedKeys = readDeletedRecordKeys(KEYS.SAVED_AYAHS, uid);
      const merged = await syncVerseRecords(
        uid,
        "quran_saved_ayahs",
        updated,
        deletedKeys,
        (record) => record.savedAt,
        isSavedAyahRecord
      );
      deletedKeys.clear();
      writeDeletedRecordKeys(KEYS.SAVED_AYAHS, uid, deletedKeys);
      writeLocalStorageJson(getVerseRecordsStorageKey(KEYS.SAVED_AYAHS, uid), merged);
      return merged;
    } catch (err) {
      console.warn("Failed to sync saved ayah with Firestore:", err);
    }
  }

  return updated;
}

export async function deleteSavedAyah(id: string, uid?: string): Promise<SavedAyahItem[]> {
  const current = await getSavedAyahs(uid);
  const removed = current.find((item) => item.id === id);
  const updated = current.filter((x) => x.id !== id);

  const deletedKeys = uid ? readDeletedRecordKeys(KEYS.SAVED_AYAHS, uid) : new Set<string>();
  if (uid && removed) {
    deletedKeys.add(getVerseRecordKey(removed));
    writeDeletedRecordKeys(KEYS.SAVED_AYAHS, uid, deletedKeys);
  }

  if (typeof window !== "undefined") {
    writeLocalStorageJson(getVerseRecordsStorageKey(KEYS.SAVED_AYAHS, uid), updated);
  }

  if (uid) {
    try {
      await syncVerseRecords(
        uid,
        "quran_saved_ayahs",
        updated,
        deletedKeys,
        (item) => item.savedAt,
        isSavedAyahRecord
      );
      deletedKeys.clear();
      writeDeletedRecordKeys(KEYS.SAVED_AYAHS, uid, deletedKeys);
    } catch (err) {
      console.warn("Failed to sync saved ayah deletion with Firestore:", err);
    }
  }

  return updated;
}

export async function getQuranReflections(uid?: string): Promise<QuranReflectionItem[]> {
  const deletedKeys = uid ? readDeletedRecordKeys(KEYS.REFLECTIONS, uid) : new Set<string>();
  const storageKey = getVerseRecordsStorageKey(KEYS.REFLECTIONS, uid);
  const cached = readLocalStorageJson<QuranReflectionItem[]>(storageKey, []);
  const localItems = Array.isArray(cached) ? cached.filter(isReflectionRecord) : [];
  const visibleLocalItems = mergeVerseRecords(
    [],
    localItems,
    deletedKeys,
    (item) => item.updatedAt
  );

  if (!uid) return visibleLocalItems;

  try {
    const merged = await syncVerseRecords(
      uid,
      "quran_reflections",
      localItems,
      deletedKeys,
      (item) => item.updatedAt,
      isReflectionRecord
    );
    deletedKeys.clear();
    writeDeletedRecordKeys(KEYS.REFLECTIONS, uid, deletedKeys);
    writeLocalStorageJson(storageKey, merged);
    return merged;
  } catch (err) {
    console.warn("Failed to reconcile reflections with Firestore:", err);
    return visibleLocalItems;
  }
}

export async function saveQuranReflection(
  surahId: number,
  surahName: string,
  verseId: number,
  note: string,
  uid?: string
): Promise<QuranReflectionItem[]> {
  const current = await getQuranReflections(uid);
  const verseKey = `${surahId}_${verseId}`;
  const savedDocId = getCanonicalVerseRecordId({ surahId, verseId });
  const updated = [
    {
      id: savedDocId,
      surahId,
      surahName,
      verseId,
      note,
      updatedAt: Date.now(),
    },
    ...current.filter((item) => getVerseRecordKey(item) !== verseKey),
  ];

  if (uid) {
    const deletedKeys = readDeletedRecordKeys(KEYS.REFLECTIONS, uid);
    deletedKeys.delete(verseKey);
    writeDeletedRecordKeys(KEYS.REFLECTIONS, uid, deletedKeys);
  }

  if (typeof window !== "undefined") {
    writeLocalStorageJson(getVerseRecordsStorageKey(KEYS.REFLECTIONS, uid), updated);
  }

  if (uid) {
    try {
      const deletedKeys = readDeletedRecordKeys(KEYS.REFLECTIONS, uid);
      const merged = await syncVerseRecords(
        uid,
        "quran_reflections",
        updated,
        deletedKeys,
        (item) => item.updatedAt,
        isReflectionRecord
      );
      deletedKeys.clear();
      writeDeletedRecordKeys(KEYS.REFLECTIONS, uid, deletedKeys);
      writeLocalStorageJson(getVerseRecordsStorageKey(KEYS.REFLECTIONS, uid), merged);
      return merged;
    } catch (err) {
      console.warn("Failed to sync reflection with Firestore:", err);
    }
  }

  return updated;
}

export async function deleteQuranReflection(id: string, uid?: string): Promise<QuranReflectionItem[]> {
  const current = await getQuranReflections(uid);
  const removed = current.find((item) => item.id === id);
  const updated = current.filter((r) => r.id !== id);

  const deletedKeys = uid ? readDeletedRecordKeys(KEYS.REFLECTIONS, uid) : new Set<string>();
  if (uid && removed) {
    deletedKeys.add(getVerseRecordKey(removed));
    writeDeletedRecordKeys(KEYS.REFLECTIONS, uid, deletedKeys);
  }

  if (typeof window !== "undefined") {
    writeLocalStorageJson(getVerseRecordsStorageKey(KEYS.REFLECTIONS, uid), updated);
  }

  if (uid) {
    try {
      await syncVerseRecords(
        uid,
        "quran_reflections",
        updated,
        deletedKeys,
        (item) => item.updatedAt,
        isReflectionRecord
      );
      deletedKeys.clear();
      writeDeletedRecordKeys(KEYS.REFLECTIONS, uid, deletedKeys);
    } catch (err) {
      console.warn("Failed to sync reflection deletion with Firestore:", err);
    }
  }

  return updated;
}

export function getCachedBookmarks(uid?: string): BookmarkItem[] {
  const storageKey = uid ? `${KEYS.BOOKMARKS}_${uid}` : KEYS.BOOKMARKS;
  const items = readLocalStorageJson<BookmarkItem[]>(storageKey, []);
  if (Array.isArray(items) && items.length > 0) return items;
  // Also check legacy single bookmark
  const single = readLocalStorageJson<{ surahId: number; verseId: number } | null>("quran_bookmark", null);
  if (single && single.surahId && single.verseId) {
    return [
      {
        surahId: single.surahId,
        surahName: `Surah ${single.surahId}`,
        verseId: single.verseId,
        arabic: "",
        translation: `Bookmarked Ayah ${single.verseId}`,
      },
    ];
  }
  return [];
}

export async function getBookmarks(uid?: string): Promise<BookmarkItem[]> {
  const cached = getCachedBookmarks(uid);
  if (!uid) return cached;

  try {
    const colRef = collection(db, "users", uid, "quran_bookmarks");
    const snap = await getDocs(colRef);
    if (!snap.empty) {
      const remoteMap = new Map<string, BookmarkItem>();
      snap.docs.forEach((d) => {
        const data = d.data() as BookmarkItem;
        if (Number.isInteger(data.surahId) && Number.isInteger(data.verseId)) {
          remoteMap.set(`${data.surahId}:${data.verseId}`, data);
        }
      });

      const merged = new Map<string, BookmarkItem>();
      remoteMap.forEach((v, k) => merged.set(k, v));
      for (const local of cached) {
        const key = `${local.surahId}:${local.verseId}`;
        if (!merged.has(key)) {
          merged.set(key, local);
        }
      }

      const mergedList = Array.from(merged.values());
      const storageKey = `${KEYS.BOOKMARKS}_${uid}`;
      writeLocalStorageJson(storageKey, mergedList);
      return mergedList;
    }
  } catch (err) {
    console.warn("Failed to fetch bookmarks from Firestore:", err);
  }

  return cached;
}

export async function saveBookmark(bookmark: BookmarkItem, uid?: string): Promise<BookmarkItem[]> {
  const current = await getBookmarks(uid);
  const key = `${bookmark.surahId}:${bookmark.verseId}`;
  const now = Date.now();
  const newItem = { ...bookmark, updatedAt: now };
  const updated = [
    newItem,
    ...current.filter((b) => !(b.surahId === bookmark.surahId && b.verseId === bookmark.verseId)),
  ];
  const storageKey = uid ? `${KEYS.BOOKMARKS}_${uid}` : KEYS.BOOKMARKS;
  writeLocalStorageJson(storageKey, updated);

  if (uid) {
    try {
      const docRef = doc(db, "users", uid, "quran_bookmarks", key);
      await setDoc(docRef, newItem, { merge: true });
    } catch (err) {
      console.warn("Failed to sync bookmark to Firestore:", err);
    }
  }
  return updated;
}

export async function deleteBookmark(surahId: number, verseId: number, uid?: string): Promise<BookmarkItem[]> {
  const current = await getBookmarks(uid);
  const updated = current.filter((b) => !(b.surahId === surahId && b.verseId === verseId));
  const storageKey = uid ? `${KEYS.BOOKMARKS}_${uid}` : KEYS.BOOKMARKS;
  writeLocalStorageJson(storageKey, updated);
  if (typeof window !== "undefined") {
    const single = readLocalStorageJson<{ surahId: number; verseId: number } | null>("quran_bookmark", null);
    if (single && single.surahId === surahId && single.verseId === verseId) {
      localStorage.removeItem("quran_bookmark");
    }
  }

  if (uid) {
    try {
      const docRef = doc(db, "users", uid, "quran_bookmarks", `${surahId}:${verseId}`);
      await deleteDoc(docRef);
      // Clean up legacy doc id format if present
      const legacyRef = doc(db, "users", uid, "quran_bookmarks", `verse_${surahId}_${verseId}`);
      deleteDoc(legacyRef).catch(() => {});
    } catch (err) {
      console.warn("Failed to delete bookmark from Firestore:", err);
    }
  }

  return updated;
}

const webSettingsListeners = new Set<(settings: Record<string, any>) => void>();

export function normalizeWebQuranSettings(
  base: Record<string, any>,
  incoming?: Record<string, any>
): Record<string, any> {
  const raw = { ...base, ...(incoming || {}) };
  const todayStr = new Date().toISOString().slice(0, 10);

  const arabicSize =
    incoming?.fontSizeArabic ??
    incoming?.arabicFontSize ??
    base.fontSizeArabic ??
    base.arabicFontSize ??
    32;
  const transSize =
    incoming?.fontSizeTranslation ??
    incoming?.translationFontSize ??
    base.fontSizeTranslation ??
    base.translationFontSize ??
    16;

  const rawTheme =
    incoming?.readerTheme ??
    incoming?.readingMode ??
    base.readerTheme ??
    base.readingMode ??
    "cream";
  const normalizedTheme =
    rawTheme === "emerald"
      ? "green"
      : rawTheme === "midnight"
      ? "dark"
      : rawTheme;

  const transLang =
    incoming?.selectedTransLang ??
    incoming?.translationLanguage ??
    base.selectedTransLang ??
    base.translationLanguage ??
    "en";

  const savedDate = raw.todayReadDate || todayStr;
  const todayReadCount =
    incoming?.todayReadCount !== undefined
      ? incoming.todayReadCount
      : savedDate === todayStr
      ? raw.todayReadCount ?? 0
      : 0;

  return {
    ...raw,
    arabicFontSize: arabicSize,
    fontSizeArabic: arabicSize,
    translationFontSize: transSize,
    fontSizeTranslation: transSize,
    readingMode: normalizedTheme,
    readerTheme: normalizedTheme,
    translationLanguage: transLang,
    selectedTransLang: transLang,
    todayReadCount,
    todayReadDate: todayStr,
  };
}

export async function getQuranReaderSettings(uid?: string): Promise<Record<string, any>> {
  const local = normalizeWebQuranSettings(
    readLocalStorageJson<Record<string, any>>(KEYS.READER_SETTINGS, {})
  );
  if (!uid) return local;

  try {
    const docRef = doc(db, "users", uid, "settings", "quran_reader");
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const cloudSettings = snap.data() || {};
      const merged = normalizeWebQuranSettings(local, cloudSettings);
      writeLocalStorageJson(KEYS.READER_SETTINGS, merged);
      return merged;
    }
  } catch (err) {
    console.warn("Failed to fetch quran reader settings from Firestore:", err);
  }
  return local;
}

export async function saveQuranReaderSettings(
  settings: Record<string, any>,
  uid?: string
): Promise<Record<string, any>> {
  const current = readLocalStorageJson<Record<string, any>>(KEYS.READER_SETTINGS, {});
  const merged = {
    ...normalizeWebQuranSettings(current, settings),
    updatedAt: Date.now(),
  };
  writeLocalStorageJson(KEYS.READER_SETTINGS, merged);
  webSettingsListeners.forEach((cb) => cb(merged));

  if (uid) {
    try {
      const docRef = doc(db, "users", uid, "settings", "quran_reader");
      await setDoc(docRef, merged, { merge: true });
    } catch (err) {
      console.warn("Failed to sync quran reader settings to Firestore:", err);
    }
  }
  return merged;
}

export function subscribeQuranReaderSettings(
  uid: string | undefined,
  callback: (settings: Record<string, any>) => void
): () => void {
  webSettingsListeners.add(callback);

  let unsubSnapshot: (() => void) | null = null;
  if (uid && typeof window !== "undefined") {
    try {
      const docRef = doc(db, "users", uid, "settings", "quran_reader");
      unsubSnapshot = onSnapshot(
        docRef,
        (snap) => {
          if (snap.exists()) {
            const current = readLocalStorageJson<Record<string, any>>(KEYS.READER_SETTINGS, {});
            const merged = normalizeWebQuranSettings(current, snap.data() || {});
            writeLocalStorageJson(KEYS.READER_SETTINGS, merged);
            callback(merged);
          }
        },
        (err) => {
          console.warn("Error listening to quran_reader settings on web:", err);
        }
      );
    } catch (err) {
      console.warn("Failed to subscribe to quran_reader settings on web:", err);
    }
  }

  return () => {
    webSettingsListeners.delete(callback);
    if (unsubSnapshot) unsubSnapshot();
  };
}


function isValidMemorizationPlan(item: any): item is MemorizationPlanItem {
  return Boolean(
    item &&
      typeof item === "object" &&
      typeof item.id === "string" &&
      Number.isInteger(item.surahId) &&
      Number.isInteger(item.startVerse) &&
      Number.isInteger(item.endVerse) &&
      typeof item.surahName === "string"
  );
}

export async function getMemorizationPlans(uid?: string): Promise<MemorizationPlanItem[]> {
  const defaultPlan: MemorizationPlanItem = {
    id: "plan_alkahf_first10",
    surahId: 18,
    surahName: "Al-Kahf",
    startVerse: 1,
    endVerse: 10,
    repetitions: 5,
    intervalSec: 3,
    method: "repeat",
    status: "in_progress",
    lastPracticedAt: Date.now(),
  };

  // 1. Read primary local items
  let localItems: MemorizationPlanItem[] = readLocalStorageJson<MemorizationPlanItem[]>(KEYS.MEMORIZATION, []);
  if (!Array.isArray(localItems)) localItems = [];
  localItems = localItems.filter(isValidMemorizationPlan);

  // 2. Backward compatibility migration from legacy key used in reader page
  if (typeof window !== "undefined") {
    try {
      const legacyRaw = localStorage.getItem("noor_memorization_plans");
      if (legacyRaw) {
        const legacyParsed = JSON.parse(legacyRaw);
        if (Array.isArray(legacyParsed)) {
          for (const leg of legacyParsed) {
            if (isValidMemorizationPlan(leg) && !localItems.some((l) => l.id === leg.id)) {
              localItems.push(leg);
            }
          }
        }
      }
    } catch {}
  }

  if (localItems.length === 0) localItems = [defaultPlan];
  if (!uid) {
    writeLocalStorageJson(KEYS.MEMORIZATION, localItems);
    return localItems;
  }

  // 3. Bidirectional Firestore Sync
  try {
    const colRef = collection(db, "users", uid, "quran_memorization");
    const snap = await getDocs(query(colRef, orderBy("lastPracticedAt", "desc")));
    const cloudItems: MemorizationPlanItem[] = [];

    for (const d of snap.docs) {
      const raw = { ...d.data(), id: d.id };
      if (isValidMemorizationPlan(raw)) {
        cloudItems.push(raw);
      }
    }

    // Merge cloud & local by id (higher timestamp wins)
    const mergedMap = new Map<string, MemorizationPlanItem>();
    for (const item of [...cloudItems, ...localItems]) {
      const existing = mergedMap.get(item.id);
      if (!existing || (item.lastPracticedAt || 0) >= (existing.lastPracticedAt || 0)) {
        mergedMap.set(item.id, item);
      }
    }

    const merged = Array.from(mergedMap.values()).sort(
      (a, b) => (b.lastPracticedAt || 0) - (a.lastPracticedAt || 0)
    );

    // Save back to local storage
    writeLocalStorageJson(KEYS.MEMORIZATION, merged);

    // Push any local-only plans to cloud in background
    const cloudIds = new Set(cloudItems.map((c) => c.id));
    for (const plan of merged) {
      if (!cloudIds.has(plan.id)) {
        const docRef = doc(db, "users", uid, "quran_memorization", plan.id);
        setDoc(docRef, { ...plan, userId: uid }, { merge: true }).catch(() => {});
      }
    }

    return merged;
  } catch (err) {
    console.warn("Failed to sync memorization plans with Firestore:", err);
  }

  writeLocalStorageJson(KEYS.MEMORIZATION, localItems);
  return localItems;
}

export async function saveMemorizationPlan(
  plan: Omit<MemorizationPlanItem, "id" | "lastPracticedAt">,
  uid?: string
): Promise<MemorizationPlanItem[]> {
  const current = await getMemorizationPlans(uid);
  const id = `plan_${plan.surahId}_${Date.now()}`;
  const newItem: MemorizationPlanItem = {
    ...plan,
    id,
    lastPracticedAt: Date.now(),
  };
  const updated = [newItem, ...current.filter((p) => p.id !== id)];

  if (typeof window !== "undefined") {
    writeLocalStorageJson(KEYS.MEMORIZATION, updated);
  }

  if (uid) {
    try {
      const docRef = doc(db, "users", uid, "quran_memorization", id);
      await setDoc(docRef, { ...newItem, userId: uid }, { merge: true });
    } catch (err) {
      console.warn("Failed to sync memorization plan to Firestore:", err);
    }
  }

  return updated;
}

export async function updateMemorizationStatus(
  planId: string,
  status: "new" | "in_progress" | "mastered",
  uid?: string
): Promise<MemorizationPlanItem[]> {
  const current = await getMemorizationPlans(uid);
  let targetPlan: MemorizationPlanItem | undefined;

  const updated = current.map((p) => {
    if (p.id === planId) {
      targetPlan = { ...p, status, lastPracticedAt: Date.now() };
      return targetPlan;
    }
    return p;
  });

  if (typeof window !== "undefined") {
    writeLocalStorageJson(KEYS.MEMORIZATION, updated);
  }

  if (uid && targetPlan) {
    try {
      const docRef = doc(db, "users", uid, "quran_memorization", planId);
      // Write full validated plan object to prevent malformed/partial cloud documents
      await setDoc(docRef, { ...targetPlan, userId: uid }, { merge: true });
    } catch (err) {
      console.warn("Failed to update memorization status in Firestore:", err);
    }
  }

  return updated;
}

export async function deleteMemorizationPlan(planId: string, uid?: string): Promise<MemorizationPlanItem[]> {
  const current = await getMemorizationPlans(uid);
  const updated = current.filter((p) => p.id !== planId);

  if (typeof window !== "undefined") {
    writeLocalStorageJson(KEYS.MEMORIZATION, updated);
  }

  if (uid) {
    try {
      const docRef = doc(db, "users", uid, "quran_memorization", planId);
      await deleteDoc(docRef);
    } catch (err) {
      console.warn("Failed to delete memorization plan from Firestore:", err);
    }
  }

  return updated;
}

export async function getTranslationModules(): Promise<TranslationModuleInfo[]> {
  if (typeof window !== "undefined") {
    const saved = readLocalStorageJson<TranslationModuleInfo[]>(KEYS.MODULES, []);
    if (Array.isArray(saved) && saved.length > 0) return saved;
    writeLocalStorageJson(KEYS.MODULES, DEFAULT_TRANSLATION_MODULES);
    return DEFAULT_TRANSLATION_MODULES;
  }
  return DEFAULT_TRANSLATION_MODULES;
}

export async function toggleInstallTranslationModule(moduleId: string): Promise<TranslationModuleInfo[]> {
  const current = await getTranslationModules();
  const updated = current.map((m) => {
    if (m.id === moduleId) {
      if (m.isBundled) return m;
      const nextInstalled = !m.isInstalled;
      return { ...m, isInstalled: nextInstalled, isActive: nextInstalled ? m.isActive : false };
    }
    return m;
  });
  if (typeof window !== "undefined") {
    writeLocalStorageJson(KEYS.MODULES, updated);
  }
  return updated;
}

export async function setActiveTranslationModule(moduleId: string): Promise<TranslationModuleInfo[]> {
  const current = await getTranslationModules();
  const updated = current.map((m) => {
    if (m.id === "ig_quran" || m.id === "tafseer_ibnkathir") return { ...m, isActive: false };
    return { ...m, isActive: m.id === moduleId };
  });
  if (typeof window !== "undefined") {
    writeLocalStorageJson(KEYS.MODULES, updated);
  }
  return updated;
}

export async function toggleActiveTranslationModule(moduleId: string): Promise<TranslationModuleInfo[]> {
  return setActiveTranslationModule(moduleId);
}

export async function getActiveQariId(): Promise<string> {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(KEYS.ACTIVE_QARI);
      return typeof raw === "string" && raw.trim() ? raw : "mishary";
    } catch {
      return "mishary";
    }
  }
  return "mishary";
}

export async function setActiveQariId(qariId: string): Promise<void> {
  if (typeof window !== "undefined" && typeof qariId === "string" && qariId.trim()) {
    localStorage.setItem(KEYS.ACTIVE_QARI, qariId);
  }
}

export function getSurahAudioUrl(serverUrl: string, surahId: number): string {
  const paddedId = String(surahId).padStart(3, "0");
  return `${serverUrl}${paddedId}.mp3`;
}

/**
 * Loads dynamic list of Qaris from Firestore `quran_qaris` collection,
 * falling back to localStorage cache, and finally default QARIS_LIST.
 */
export async function getAvailableQaris(): Promise<QariProfile[]> {
  const cached = readLocalStorageJson<QariProfile[] | null>(KEYS.AVAILABLE_QARIS, null);

  if (typeof window === "undefined") {
    return cached && cached.length > 0 ? cached : QARIS_LIST;
  }

  try {
    const snap = await getDocs(collection(db, "quran_qaris"));
    if (!snap.empty) {
      const fetched = snap.docs.map((d) => d.data() as QariProfile);
      writeLocalStorageJson(KEYS.AVAILABLE_QARIS, fetched);
      return fetched;
    }
  } catch (err) {
    console.warn("Failed to fetch quran_qaris from Firestore, using cache/defaults:", err);
  }

  return cached && cached.length > 0 ? cached : QARIS_LIST;
}

/**
 * Subscribes to real-time updates for available Qaris.
 */
export function subscribeAvailableQaris(
  callback: (qaris: QariProfile[]) => void
): () => void {
  const cached = readLocalStorageJson<QariProfile[]>(KEYS.AVAILABLE_QARIS, QARIS_LIST);
  callback(cached.length > 0 ? cached : QARIS_LIST);

  if (typeof window === "undefined") {
    return () => {};
  }

  try {
    const unsub = onSnapshot(
      collection(db, "quran_qaris"),
      (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => d.data() as QariProfile);
          writeLocalStorageJson(KEYS.AVAILABLE_QARIS, list);
          callback(list);
        } else {
          // If Firestore collection has no documents yet, fall back to default QARIS_LIST
          callback(QARIS_LIST);
        }
      },
      (err) => {
        console.warn("Error listening to quran_qaris:", err);
      }
    );
    return unsub;
  } catch (err) {
    console.warn("Failed to set up quran_qaris snapshot listener:", err);
    return () => {};
  }
}

export function normalizeEveryayahPath(path?: string): string {
  if (!path) return "Alafasy_128kbps";
  if (path === "Sudais_192kbps") return "Abdurrahmaan_As-Sudais_192kbps";
  if (path === "AbdulBaset_Mujawwad_128kbps") return "Abdul_Basit_Mujawwad_128kbps";
  if (path === "Shuraym_128kbps") return "Saood_ash-Shuraym_128kbps";
  return path;
}

/**
 * Returns a verse-level audio URL using the EveryAyah CDN.
 * EveryAyah format: https://everyayah.com/data/{path}/{surah3}{verse3}.mp3
 */
export function getVerseAudioUrl(
  qariId: string,
  surahId: number,
  verseId: number,
  customQaris?: QariProfile[]
): string {
  const list = customQaris && customQaris.length > 0 ? customQaris : QARIS_LIST;
  const qari = list.find((q) => q.id === qariId) || list[0] || QARIS_LIST[0];
  const sPadded = String(surahId).padStart(3, "0");
  const vPadded = String(verseId).padStart(3, "0");
  const path = normalizeEveryayahPath(qari.everyayahPath);
  return `https://everyayah.com/data/${path}/${sPadded}${vPadded}.mp3`;
}

/**
 * Returns the verse-level spoken audio translation URL from the Noor Library CDN / mirror.
 */
export function getVerseAudioTranslationUrl(langId: string, surahId: number, verseId: number): string {
  const trans = AUDIO_TRANSLATIONS_LIST.find((t) => t.id === langId) || AUDIO_TRANSLATIONS_LIST[0];
  const sPadded = String(surahId).padStart(3, "0");
  const vPadded = String(verseId).padStart(3, "0");
  return `${trans.serverUrl}${sPadded}${vPadded}.mp3`;
}

/**
 * Estimates the current Ayah number from playback position and duration.
 * If verses array with Arabic text is provided, uses cumulative character length weighting;
 * otherwise calculates proportional verse from total verses count.
 */
export function estimateAyahFromAudioProgress(
  currentTime: number,
  duration: number,
  verses?: { id: number; text?: string; ar?: string }[],
  totalVerses?: number
): number {
  if (!duration || duration <= 0 || !currentTime || currentTime <= 0) {
    return 1;
  }
  const ratio = Math.max(0, Math.min(1, currentTime / duration));

  // If verses array is provided with text, use cumulative Arabic text weight
  if (verses && verses.length > 0) {
    const totalWeight = verses.reduce((sum, v) => sum + (v.text?.length || v.ar?.length || 30), 0);
    const targetWeight = ratio * totalWeight;
    let accumulated = 0;
    for (const v of verses) {
      accumulated += (v.text?.length || v.ar?.length || 30);
      if (accumulated >= targetWeight) {
        return v.id;
      }
    }
    return verses[verses.length - 1].id;
  }

  // Fallback: proportional calculation from total verses
  const count = totalVerses || 1;
  return Math.max(1, Math.min(count, Math.ceil(ratio * count)));
}
