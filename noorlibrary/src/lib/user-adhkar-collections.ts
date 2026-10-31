// src/lib/user-adhkar-collections.ts
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";
import { db, auth } from "./firebase";

export interface CustomAdhkarItem {
  id: string;
  title: string;
  arabic?: string;
  transliteration?: string;
  translation?: string;
  count: number;
  fadl?: string;
  source?: string;
  origin?: "system_adhkar" | "hisn_almuslim" | "custom";
}

export interface AdhkarCollection {
  id: string;
  userId?: string;
  title: string;
  description?: string;
  icon?: string;
  color?: string;
  items: CustomAdhkarItem[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY_COLLECTIONS = "@user_adhkar_collections_v1";
const STORAGE_KEY_DELETED_COLLECTIONS = "@user_adhkar_deleted_collections_v1";

let collectionWriteQueue = Promise.resolve();

async function enqueueCollectionWrite<T>(task: () => Promise<T>): Promise<T> {
  const previous = collectionWriteQueue;
  let result!: T;
  collectionWriteQueue = previous
    .then(async () => {
      result = await task();
    })
    .catch(async () => {
      result = await task();
    });

  await collectionWriteQueue;
  return result;
}

function getCollectionsStorageKey(userId?: string): string {
  if (userId) return `${STORAGE_KEY_COLLECTIONS}:${userId}`;
  return `${STORAGE_KEY_COLLECTIONS}:guest`;
}

function getDeletedCollectionsStorageKey(userId?: string): string {
  if (userId) return `${STORAGE_KEY_DELETED_COLLECTIONS}:${userId}`;
  return `${STORAGE_KEY_DELETED_COLLECTIONS}:guest`;
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

function sanitizeForFirestore(col: AdhkarCollection): AdhkarCollection {
  return {
    ...col,
    description: col.description ?? "",
    color: col.color ?? "#D4AF37",
    icon: col.icon ?? "bookmark",
    items: (col.items ?? []).map((item) => {
      return Object.fromEntries(
        Object.entries(item).filter(([, value]) => value !== undefined)
      ) as CustomAdhkarItem;
    }),
  };
}

function mergeCollectionsByUpdatedAt(...lists: AdhkarCollection[][]): AdhkarCollection[] {
  const merged = new Map<string, AdhkarCollection>();

  for (const list of lists) {
    for (const col of list) {
      const previous = merged.get(col.id);
      if (!previous) {
        merged.set(col.id, col);
        continue;
      }

      const previousTime = new Date(previous.updatedAt).getTime();
      const nextTime = new Date(col.updatedAt).getTime();
      if (Number.isNaN(nextTime) || nextTime >= previousTime) {
        merged.set(col.id, col);
      }
    }
  }

  return Array.from(merged.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

function getDeletedCollectionIds(userId?: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getDeletedCollectionsStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("Error reading deleted adhkar collections:", e);
    return [];
  }
}

function saveDeletedCollectionIds(ids: string[], userId?: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getDeletedCollectionsStorageKey(userId), JSON.stringify([...new Set(ids)]));
  } catch (e) {
    console.warn("Error saving deleted adhkar collections:", e);
  }
}

/**
 * Load collections from local localStorage.
 */
export function getLocalCollections(userId?: string): AdhkarCollection[] {
  if (typeof window === "undefined") return [];
  try {
    // Check user-scoped key first, then guest/legacy key
    const primaryKey = getCollectionsStorageKey(userId);
    let raw = localStorage.getItem(primaryKey);
    if (!raw && userId) {
      // Check legacy web storage key
      raw = localStorage.getItem("@web_user_adhkar_collections_v1");
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("Error reading local adhkar collections:", e);
    return [];
  }
}

/**
 * Save collections to local localStorage.
 */
export function saveLocalCollections(
  collections: AdhkarCollection[],
  userId?: string
): void {
  if (typeof window === "undefined") return;
  try {
    const key = getCollectionsStorageKey(userId);
    localStorage.setItem(key, JSON.stringify(collections));
    // Also update legacy key for backward compatibility
    localStorage.setItem("@web_user_adhkar_collections_v1", JSON.stringify(collections));
  } catch (e) {
    console.warn("Error saving local adhkar collections:", e);
  }
}

/**
 * Get all collections for the current user (local + Firestore cloud sync if logged in)
 */
export async function getUserCollections(currentUserId?: string): Promise<AdhkarCollection[]> {
  const uid = currentUserId || auth.currentUser?.uid;
  const localList = uid ? getLocalCollections(uid) : getLocalCollections();
  const guestList = getLocalCollections("guest");
  const deletedIds = new Set<string>([
    ...getDeletedCollectionIds(uid),
    ...getDeletedCollectionIds("guest"),
  ]);

  const mergedLocal = uid
    ? mergeCollectionsByUpdatedAt(localList, guestList.map((col) => ({ ...col, userId: uid })))
    : mergeCollectionsByUpdatedAt(localList, guestList);

  const filteredLocal = mergedLocal.filter((col) => !deletedIds.has(col.id));

  if (uid && guestList.length > 0) {
    saveLocalCollections(filteredLocal, uid);
    saveLocalCollections([], "guest");
  } else {
    saveLocalCollections(filteredLocal, uid);
  }

  if (!uid) {
    return filteredLocal;
  }

  try {
    const q = query(
      collection(db, "user_adhkar_collections"),
      where("userId", "==", uid)
    );
    const snap = await getDocs(q);
    const cloudList: AdhkarCollection[] = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as AdhkarCollection))
      .filter((col) => !deletedIds.has(col.id));

    const merged = mergeCollectionsByUpdatedAt(filteredLocal, cloudList);
    saveLocalCollections(merged, uid);
    return merged;
  } catch (err) {
    console.warn("Firestore fetch collections fallback to local:", err);
    return filteredLocal;
  }
}

/**
 * Create or update a collection
 */
export async function saveCollection(
  title: string,
  description?: string,
  existingId?: string,
  color?: string,
  icon?: string,
  initialItems: CustomAdhkarItem[] = [],
  currentUserId?: string
): Promise<AdhkarCollection> {
  return enqueueCollectionWrite(async () => {
    const uid = currentUserId || auth.currentUser?.uid;
    const now = new Date().toISOString();
    const collections = getLocalCollections(uid);

    let target: AdhkarCollection;

    if (existingId) {
      const idx = collections.findIndex((c) => c.id === existingId);
      if (idx !== -1) {
        target = {
          ...collections[idx],
          title: title.trim(),
          description: description?.trim() || "",
          color: color || collections[idx].color || "#D4AF37",
          icon: icon || collections[idx].icon || "bookmark",
          updatedAt: now,
        };
        collections[idx] = target;
      } else {
        target = {
          id: existingId,
          userId: uid,
          title: title.trim(),
          description: description?.trim() || "",
          color: color || "#D4AF37",
          icon: icon || "bookmark",
          items: initialItems,
          createdAt: now,
          updatedAt: now,
        };
        collections.unshift(target);
      }
    } else {
      target = {
        id: generateId(),
        userId: uid,
        title: title.trim(),
        description: description?.trim() || "",
        color: color || "#D4AF37",
        icon: icon || "bookmark",
        items: initialItems,
        createdAt: now,
        updatedAt: now,
      };
      collections.unshift(target);
    }

    saveLocalCollections(collections, uid);

    if (uid) {
      try {
        await setDoc(
          doc(db, "user_adhkar_collections", target.id),
          sanitizeForFirestore({ ...target, userId: uid })
        );
      } catch (e) {
        console.warn("Failed to sync collection to Firestore:", e);
      }
    }

    return target;
  });
}

/**
 * Delete a collection
 */
export async function deleteCollection(
  collectionId: string,
  currentUserId?: string
): Promise<void> {
  return enqueueCollectionWrite(async () => {
    const uid = currentUserId || auth.currentUser?.uid;
    const collections = getLocalCollections(uid);
    const filtered = collections.filter((c) => c.id !== collectionId);
    saveLocalCollections(filtered, uid);

    const deletedIds = new Set<string>(getDeletedCollectionIds(uid));
    deletedIds.add(collectionId);
    saveDeletedCollectionIds(Array.from(deletedIds), uid);

    if (uid) {
      try {
        await deleteDoc(doc(db, "user_adhkar_collections", collectionId));
      } catch (e) {
        console.warn("Failed to delete collection from Firestore:", e);
      }
    }
  });
}

/**
 * Add a supplication item to a collection
 */
export async function addItemToCollection(
  collectionId: string,
  item: Omit<CustomAdhkarItem, "id"> & { id?: string },
  currentUserId?: string
): Promise<CustomAdhkarItem> {
  return enqueueCollectionWrite(async () => {
    const uid = currentUserId || auth.currentUser?.uid;
    const collections = getLocalCollections(uid);
    const idx = collections.findIndex((c) => c.id === collectionId);
    if (idx === -1) {
      throw new Error("Collection not found");
    }

    const newItem: CustomAdhkarItem = {
      id: item.id || generateId(),
      title: item.title,
      arabic: item.arabic,
      transliteration: item.transliteration,
      translation: item.translation,
      count: Math.max(1, item.count || 1),
      fadl: item.fadl,
      source: item.source,
      origin: item.origin || "custom",
    };

    collections[idx].items.push(newItem);
    collections[idx].updatedAt = new Date().toISOString();

    saveLocalCollections(collections, uid);

    if (uid) {
      try {
        await setDoc(
          doc(db, "user_adhkar_collections", collectionId),
          sanitizeForFirestore({ ...collections[idx], userId: uid })
        );
      } catch (e) {
        console.warn("Failed to update collection in Firestore:", e);
      }
    }

    return newItem;
  });
}

/**
 * Remove an item from a collection
 */
export async function removeItemFromCollection(
  collectionId: string,
  itemId: string,
  currentUserId?: string
): Promise<void> {
  return enqueueCollectionWrite(async () => {
    const uid = currentUserId || auth.currentUser?.uid;
    const collections = getLocalCollections(uid);
    const idx = collections.findIndex((c) => c.id === collectionId);
    if (idx === -1) return;

    collections[idx].items = collections[idx].items.filter((it) => it.id !== itemId);
    collections[idx].updatedAt = new Date().toISOString();

    saveLocalCollections(collections, uid);

    if (uid) {
      try {
        await setDoc(
          doc(db, "user_adhkar_collections", collectionId),
          sanitizeForFirestore({ ...collections[idx], userId: uid })
        );
      } catch (e) {
        console.warn("Failed to update collection in Firestore:", e);
      }
    }
  });
}

const STORAGE_KEY_PREFS = "@user_adhkar_preferences_v1";

export interface AdhkarReaderPreferences {
  readerTheme?: "light" | "sepia" | "dark";
  fontSizeArabic?: number;
  fontSizeTranslation?: number;
  showTransliteration?: boolean;
  showTranslation?: boolean;
  viewMode?: "slider" | "list";
  autoAdvance?: boolean;
}

export async function getAdhkarReaderPreferences(userId?: string): Promise<AdhkarReaderPreferences> {
  const uid = userId || auth.currentUser?.uid;
  let local: AdhkarReaderPreferences = {};
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PREFS);
      if (raw) local = JSON.parse(raw);
    } catch {}
  }
  if (!uid) return local;

  try {
    const snap = await getDoc(doc(db, "users", uid, "settings", "adhkar_reader"));
    if (snap.exists()) {
      const cloud = snap.data() as AdhkarReaderPreferences;
      const merged = { ...local, ...cloud };
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(merged));
      }
      return merged;
    }
  } catch (err) {
    console.warn("Failed to fetch adhkar reader preferences from Firestore:", err);
  }
  return local;
}

export async function saveAdhkarReaderPreferences(
  prefs: AdhkarReaderPreferences,
  userId?: string
): Promise<AdhkarReaderPreferences> {
  const uid = userId || auth.currentUser?.uid;
  let current: AdhkarReaderPreferences = {};
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PREFS);
      if (raw) current = JSON.parse(raw);
    } catch {}
  }
  const merged = { ...current, ...prefs };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(merged));
  }

  if (uid) {
    try {
      await setDoc(doc(db, "users", uid, "settings", "adhkar_reader"), merged, { merge: true });
    } catch (err) {
      console.warn("Failed to sync adhkar reader preferences to Firestore:", err);
    }
  }
  return merged;
}

