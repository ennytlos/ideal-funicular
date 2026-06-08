'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  collection,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { auth, db, googleProvider, logFirebaseEvent } from '../lib/firebase';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface User {
  uid: string;
  email: string;
  displayName?: string;
  role?: 'admin' | 'user';
}

export const formatDisplayName = (user: User | null): string => {
  if (!user) return 'Reader';
  const name = user.displayName || user.email.split('@')[0];
  const cleanedName = name.includes('@') ? name.split('@')[0] : name;
  return cleanedName.charAt(0).toUpperCase() + cleanedName.slice(1);
};

export interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  coverUrl: string;
  /** Bunny CDN path for the PDF, e.g. "pdfs/book-123.pdf" */
  pdfPath: string;
  /** Content type of the book: 'pdf' or 'json' (default is 'pdf') */
  contentType?: 'pdf' | 'json';
  /** Bunny CDN path for the JSON, e.g. "json/book-123.json" */
  jsonPath?: string;
  price: number;        // 0 = free to read
  downloadPrice: number;
  category: string;
  pages: number;
  language: string;
  isPublished?: boolean;
  isSecure?: boolean;
  createdAt?: number;
}

export interface Episode {
  id: string;
  title: string;
  episodeNumber: number;
  contentType: 'pdf' | 'json';
  pdfPath?: string;
  jsonPath?: string;
  isPublished?: boolean;
  isSecure?: boolean;
  createdAt?: number;
}

export interface Series {
  id: string;
  title: string;
  author: string;
  description: string;
  coverUrl: string;
  category: string;
  price: number;
  isPublished?: boolean;
  createdAt?: number;
  episodes: Episode[];
}

interface AppContextType {
  user: User | null;
  isLoading: boolean;
  purchasedBooks: string[];
  purchasedSeries: string[];
  downloadedBooks: string[];
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  purchaseBook: (bookId: string) => Promise<boolean>;
  purchaseDownload: (bookId: string) => Promise<boolean>;
  purchaseSeries: (seriesId: string) => Promise<boolean>;
  removePurchasedBook: (bookId: string) => Promise<boolean>;
  removeDownloadedBook: (bookId: string) => Promise<boolean>;
  removePurchasedSeries: (seriesId: string) => Promise<boolean>;
  tipMe: (amount: number, message: string) => Promise<boolean>;
  books: Book[];
  addBook: (book: Omit<Book, 'id' | 'createdAt'>) => Promise<string>;
  updateBook: (book: Book) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;
  series: Series[];
  addSeries: (series: Omit<Series, 'id' | 'createdAt'>) => Promise<string>;
  updateSeries: (series: Series) => Promise<void>;
  deleteSeries: (id: string) => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AppContext = createContext<AppContextType | undefined>(undefined);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Map a Firebase user + Firestore profile into our User shape */
async function buildUser(firebaseUser: FirebaseUser): Promise<User> {
  const profileRef = doc(db, 'users', firebaseUser.uid);
  const profileSnap = await getDoc(profileRef);

  const role = profileSnap.exists() ? (profileSnap.data().role as 'admin' | 'user') : 'user';

  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email ?? '',
    displayName: firebaseUser.displayName ?? undefined,
    role,
  };
}

/** Ensure a Firestore user document exists */
async function ensureUserDoc(firebaseUser: FirebaseUser, displayName?: string) {
  const ref = doc(db, 'users', firebaseUser.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      email: firebaseUser.email,
      displayName: displayName || firebaseUser.displayName || '',
      role: 'user',
      purchasedBooks: [],
      purchasedSeries: [],
      downloadedBooks: [],
      createdAt: serverTimestamp(),
    });
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [purchasedBooks, setPurchasedBooks] = useState<string[]>([]);
  const [purchasedSeries, setPurchasedSeries] = useState<string[]>([]);
  const [downloadedBooks, setDownloadedBooks] = useState<string[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [series, setSeries] = useState<Series[]>([]);

  // Listen to Firebase Auth state + sync user profile + purchases from Firestore
  useEffect(() => {
    let unsubscribeUser: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubscribeUser) {
        unsubscribeUser();
        unsubscribeUser = null;
      }

      if (firebaseUser) {
        // Sync session cookie so Next.js middleware can protect routes
        try {
          const idToken = await firebaseUser.getIdToken();
          await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
          });
        } catch {
          // Non-fatal — middleware falls back gracefully
        }

        const appUser = await buildUser(firebaseUser);
        setUser(appUser);

        // Live-listen to the user's purchased/downloaded books
        const userRef = doc(db, 'users', firebaseUser.uid);
        unsubscribeUser = onSnapshot(
          userRef,
          (snap) => {
            if (snap.exists()) {
              setPurchasedBooks(snap.data().purchasedBooks ?? []);
              setPurchasedSeries(snap.data().purchasedSeries ?? []);
              setDownloadedBooks(snap.data().downloadedBooks ?? []);
            }
          },
          (err) => {
            console.warn("Firestore user onSnapshot failed:", err.message);
          }
        );

        setIsLoading(false);
      } else {
        setUser(null);
        setPurchasedBooks([]);
        setPurchasedSeries([]);
        setDownloadedBooks([]);
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) {
        unsubscribeUser();
      }
    };
  }, []);

  // Live-listen to the books collection in Firestore with server fallback
  useEffect(() => {
    const fetchBooksFallback = async () => {
      try {
        const res = await fetch('/api/books');
        if (res.ok) {
          const data = await res.json();
          setBooks(data);
        }
      } catch (err) {
        console.error("Failed to fetch books catalog via fallback API:", err);
      }
    };

    const unsubscribeBooks = onSnapshot(
      collection(db, 'books'),
      (snap) => {
        const fetched: Book[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Book, 'id'>),
        }));
        setBooks(fetched);
      },
      (err) => {
        console.warn("Firestore books snapshot failed (likely permissions), trying API fallback:", err.message);
        fetchBooksFallback();
      }
    );

    return () => unsubscribeBooks();
  }, []);

  // Live-listen to the series collection in Firestore
  useEffect(() => {
    const unsubscribeSeries = onSnapshot(
      collection(db, 'series'),
      (snap) => {
        const fetched: Series[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Series, 'id'>),
        }));
        setSeries(fetched);
      },
      (err) => {
        console.warn("Firestore series snapshot failed:", err.message);
      }
    );

    return () => unsubscribeSeries();
  }, []);

  // ─── Auth Actions ────────────────────────────────────────────────────────

  const login = async (email: string, password: string) => {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    await ensureUserDoc(credential.user);
    logFirebaseEvent('login', { method: 'email' });
  };

  const loginWithGoogle = async () => {
    const credential = await signInWithPopup(auth, googleProvider);
    await ensureUserDoc(credential.user, credential.user.displayName ?? undefined);
    logFirebaseEvent('login', { method: 'google' });
  };

  const register = async (email: string, name: string, password: string) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName: name });
    await ensureUserDoc(credential.user, name);
    logFirebaseEvent('sign_up', { method: 'email' });
  };

  const logout = async () => {
    await signOut(auth);
    // Clear session cookie
    await fetch('/api/auth/session', { method: 'DELETE' });
  };

  // ─── Purchase Actions ────────────────────────────────────────────────────

  const purchaseBook = async (bookId: string): Promise<boolean> => {
    if (!user) return false;
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { purchasedBooks: arrayUnion(bookId) });
    // Also log in user_books sub-collection for records
    await addDoc(collection(db, 'user_books'), {
      userId: user.uid,
      bookId,
      purchasedAt: serverTimestamp(),
    });
    logFirebaseEvent('purchase_book_read', { bookId });
    return true;
  };

  const purchaseDownload = async (bookId: string): Promise<boolean> => {
    if (!user) return false;
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { downloadedBooks: arrayUnion(bookId) });
    await addDoc(collection(db, 'user_downloads'), {
      userId: user.uid,
      bookId,
      purchasedAt: serverTimestamp(),
    });
    logFirebaseEvent('purchase_book_download', { bookId });
    return true;
  };

  const removePurchasedBook = async (bookId: string): Promise<boolean> => {
    if (!user) return false;
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { purchasedBooks: arrayRemove(bookId) });
    return true;
  };

  const removeDownloadedBook = async (bookId: string): Promise<boolean> => {
    if (!user) return false;
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { downloadedBooks: arrayRemove(bookId) });
    return true;
  };

  const purchaseSeries = async (seriesId: string): Promise<boolean> => {
    if (!user) return false;
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { purchasedSeries: arrayUnion(seriesId) });
    await addDoc(collection(db, 'user_series'), {
      userId: user.uid,
      seriesId,
      purchasedAt: serverTimestamp(),
    });
    logFirebaseEvent('purchase_series', { seriesId });
    return true;
  };

  const removePurchasedSeries = async (seriesId: string): Promise<boolean> => {
    if (!user) return false;
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { purchasedSeries: arrayRemove(seriesId) });
    return true;
  };

  const tipMe = async (amount: number, message: string): Promise<boolean> => {
    if (!user) return false;
    await addDoc(collection(db, 'tips'), {
      userId: user.uid,
      email: user.email,
      amount,
      message,
      createdAt: serverTimestamp(),
    });
    logFirebaseEvent('tip_author', { amount, message });
    return true;
  };

  // ─── Book Catalog Actions (admin-only) ────────────────────────────────────

  const addBook = async (book: Omit<Book, 'id' | 'createdAt'>): Promise<string> => {
    const docRef = await addDoc(collection(db, 'books'), {
      ...book,
      isPublished: true,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  };

  const updateBook = async (book: Book): Promise<void> => {
    const { id, ...rest } = book;
    await updateDoc(doc(db, 'books', id), rest);
  };

  const deleteBook = async (id: string): Promise<void> => {
    await deleteDoc(doc(db, 'books', id));
  };

  // ─── Series Catalog Actions (admin-only) ──────────────────────────────────

  const addSeries = async (s: Omit<Series, 'id' | 'createdAt'>): Promise<string> => {
    const docRef = await addDoc(collection(db, 'series'), {
      ...s,
      isPublished: true,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  };

  const updateSeries = async (s: Series): Promise<void> => {
    const { id, ...rest } = s;
    await updateDoc(doc(db, 'series', id), rest);
  };

  const deleteSeries = async (id: string): Promise<void> => {
    await deleteDoc(doc(db, 'series', id));
  };

  return (
    <AppContext.Provider
      value={{
        user,
        isLoading,
        purchasedBooks,
        purchasedSeries,
        downloadedBooks,
        login,
        loginWithGoogle,
        register,
        logout,
        purchaseBook,
        purchaseDownload,
        purchaseSeries,
        removePurchasedBook,
        removeDownloadedBook,
        removePurchasedSeries,
        tipMe,
        books,
        series,
        addBook,
        updateBook,
        deleteBook,
        addSeries,
        updateSeries,
        deleteSeries,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
