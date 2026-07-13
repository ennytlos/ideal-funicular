'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
  query,
  where,
} from 'firebase/firestore';
import { auth, db, googleProvider, logFirebaseEvent } from '../lib/firebase';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

export interface User {
  uid: string;
  email: string;
  displayName?: string;
  role?: 'admin' | 'creator' | 'user';
  subscriptions?: Record<string, number>; // itemId -> expiryTimestamp
}

// C6 fix: exposed subscriptions type (was already in User but never populated from Firestore)

export const formatDisplayName = (user: User | null): string => {
  if (!user) return 'Reader';
  const name = user.displayName || user.email.split('@')[0];
  const cleanedName = name.includes('@') ? name.split('@')[0] : name;
  return cleanedName.charAt(0).toUpperCase() + cleanedName.slice(1);
};

export interface AppNotification {
  id: string;
  senderId: string;     // 'admin' or creatorUserId
  senderName: string;
  title: string;
  message: string;
  type: 'global' | 'direct' | 'outreach';
  targetId?: string;    // recipient userId (for direct), contentId/creatorId (for outreach)
  createdAt: number;
}

export interface ConversationMessage {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;  // 'admin' or creatorUserId or studentUserId
  messageText: string;
  subject?: string;
  createdAt: number;
}

export interface ContentReport {
  id: string;
  contentId: string;
  contentTitle: string;
  contentType: 'book' | 'course' | 'series';
  reporterId: string;
  reporterEmail: string;
  reason: 'stolen' | 'abusive' | 'inaccurate' | 'other';
  details: string;
  createdAt: number;
  status: 'pending' | 'resolved';
}

export interface FollowRecord {
  id: string; // userId_creatorId
  userId: string;
  creatorId: string;
  createdAt: number;
}

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
  paymentInterval?: 'once' | 'monthly' | 'yearly';
  creatorId?: string;
}

export interface Episode {
  id: string;
  title: string;
  episodeNumber: number;
  contentType: 'pdf' | 'plaintext';
  pdfPath?: string;
  plainTextContent?: string;
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
  creatorId?: string;
}

export interface Lesson {
  id: string;
  title: string;
  lessonNumber: number;
  contentType: 'video' | 'audio' | 'pdf' | 'plaintext';
  videoUrl?: string; // YouTube, Vimeo, BunnyCDN embed URL
  audioUrl?: string; // Audio URL (Bunny CDN path or external URL)
  pdfPath?: string;
  plainTextContent?: string;
  isPublished?: boolean;
  isSecure?: boolean;
  createdAt?: number;
  description?: string;
  attachmentPath?: string;
  attachmentName?: string;
  audioSize?: number;
  pdfSize?: number;
  attachmentSize?: number;
  assignmentAttachmentSize?: number;
  assignment?: {
    description: string;
    attachmentPath?: string;
    attachmentName?: string;
  };
}

export interface Course {
  id: string;
  title: string;
  instructor: string;
  description: string;
  coverUrl: string;
  category: string;
  price: number;
  isPublished?: boolean;
  createdAt?: number;
  lessons: Lesson[];
  attachmentPath?: string;
  attachmentName?: string;
  paymentInterval?: 'once' | 'monthly' | 'yearly';
  creatorId?: string;
  isPaid?: boolean;
  paymentStatus?: 'pending' | 'paid' | 'failed';
  maxContentSize?: number;
  currentContentSize?: number;
  coverSize?: number;
  attachmentSize?: number;
}

export interface ShortRead {
  id: string;
  content: string;
  category: string;
  isPublished?: boolean;
  createdAt?: any;
}

export interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  targetUrl: string;
  isActive: boolean;
  createdAt: any;
}

export interface AssignmentSubmission {
  id: string;
  userId: string;
  userEmail: string;
  courseId: string;
  lessonId: string;
  imageUrl: string;
  imagePath: string;
  submittedAt: number;
}

interface AppContextType {
  user: User | null;
  isLoading: boolean;
  purchasedBooks: string[];
  purchasedSeries: string[];
  downloadedBooks: string[];
  enrolledCourses: string[];
  courseProgress: Record<string, string[]>;
  quranBookmark: { surahId: number; verseId: number } | null;
  updateQuranBookmark: (surahId: number, verseId: number | null) => Promise<boolean>;
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
  enrollCourse: (courseId: string) => Promise<boolean>;
  removeEnrolledCourse: (courseId: string) => Promise<boolean>;
  updateCourseProgress: (courseId: string, lessonId: string) => Promise<boolean>;
  tipMe: (amount: number, message: string) => Promise<boolean>;
  books: Book[];
  addBook: (book: Omit<Book, 'id' | 'createdAt'>) => Promise<string>;
  updateBook: (book: Book) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;
  series: Series[];
  addSeries: (series: Omit<Series, 'id' | 'createdAt'>) => Promise<string>;
  updateSeries: (series: Series) => Promise<void>;
  deleteSeries: (id: string) => Promise<void>;
  courses: Course[];
  addCourse: (course: Omit<Course, 'id' | 'createdAt'>) => Promise<string>;
  updateCourse: (course: Course) => Promise<void>;
  deleteCourse: (id: string) => Promise<void>;
  shortReads: ShortRead[];
  addShortRead: (sr: Omit<ShortRead, 'id' | 'createdAt'>) => Promise<string>;
  updateShortRead: (sr: ShortRead) => Promise<void>;
  deleteShortRead: (id: string) => Promise<void>;
  banners: Banner[];
  addBanner: (banner: Omit<Banner, 'id' | 'createdAt'>) => Promise<string>;
  updateBanner: (banner: Banner) => Promise<void>;
  deleteBanner: (id: string) => Promise<void>;
  mySubmissions: AssignmentSubmission[];
  submitAssignment: (courseId: string, lessonId: string, imageUrl: string, imagePath: string) => Promise<boolean>;
  toasts: Toast[];
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  removeToast: (id: string) => void;
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
      enrolledCourses: [],
      courseProgress: {},
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
  const [enrolledCourses, setEnrolledCourses] = useState<string[]>([]);
  const [courseProgress, setCourseProgress] = useState<Record<string, string[]>>({});
  const [quranBookmark, setQuranBookmark] = useState<{ surahId: number; verseId: number } | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [shortReads, setShortReads] = useState<ShortRead[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [mySubmissions, setMySubmissions] = useState<AssignmentSubmission[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    const timer = setTimeout(() => {
      removeToast(id);
      toastTimersRef.current.delete(timer);
    }, 4000);
    toastTimersRef.current.add(timer);
  }, [removeToast]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const originalAlert = window.alert;
    window.alert = (message: string) => {
      let type: 'success' | 'error' | 'warning' | 'info' = 'info';
      const msgLower = String(message).toLowerCase();
      if (msgLower.includes('success') || msgLower.includes('successful') || msgLower.includes('copied') || msgLower.includes('saved') || msgLower.includes('added') || msgLower.includes('completed')) {
        type = 'success';
      } else if (msgLower.includes('fail') || msgLower.includes('error') || msgLower.includes('wrong') || msgLower.includes('invalid') || msgLower.includes('cannot') || msgLower.includes('denied')) {
        type = 'error';
      } else if (msgLower.includes('warn') || msgLower.includes('attention') || msgLower.includes('alert') || msgLower.includes('missing')) {
        type = 'warning';
      }
      showToast(message, type);
    };
    return () => {
      window.alert = originalAlert;
    };
  }, [showToast]);

  useEffect(() => {
    return () => {
      toastTimersRef.current.forEach((t) => clearTimeout(t));
      toastTimersRef.current.clear();
    };
  }, []);

  // Register Service Worker for offline PWA support
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const handleRegister = async () => {
        try {
          const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
          console.log('Noor ServiceWorker registered with scope:', reg.scope);
          
          // Handle updates
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'activated') {
                  console.log('Service Worker updated');
                }
              });
            }
          });
        } catch (err) {
          console.warn('Noor ServiceWorker registration failed:', err);
        }
      };
      
      if (document.readyState === 'complete') {
        handleRegister();
      } else {
        window.addEventListener('load', handleRegister);
        return () => window.removeEventListener('load', handleRegister);
      }
    }
  }, []);

  // Listen to Firebase Auth state + sync user profile + purchases from Firestore
  useEffect(() => {
    let unsubscribeUser: (() => void) | null = null;
    let unsubscribeSubmissions: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubscribeUser) {
        unsubscribeUser();
        unsubscribeUser = null;
      }
      if (unsubscribeSubmissions) {
        unsubscribeSubmissions();
        unsubscribeSubmissions = null;
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
              const data = snap.data();
              setPurchasedBooks(data.purchasedBooks ?? []);
              setPurchasedSeries(data.purchasedSeries ?? []);
              setDownloadedBooks(data.downloadedBooks ?? []);
              setEnrolledCourses(data.enrolledCourses ?? []);
              setCourseProgress(data.courseProgress ?? {});
              setQuranBookmark(data.quranBookmark ?? null);
              // C6 fix: sync subscriptions so monthly/yearly access gates work correctly
              setUser(prev => prev ? { ...prev, subscriptions: data.subscriptions ?? {} } : prev);
            }
          },
          (err) => {
            console.warn("Firestore user onSnapshot failed:", err.message);
          }
        );

        // Live-listen to the user's submissions
        const submissionsQuery = query(collection(db, 'submissions'), where('userId', '==', firebaseUser.uid));
        unsubscribeSubmissions = onSnapshot(
          submissionsQuery,
          (snap) => {
            const fetched: AssignmentSubmission[] = snap.docs.map(d => ({
              id: d.id,
              ...(d.data() as Omit<AssignmentSubmission, 'id'>)
            }));
            setMySubmissions(fetched);
          },
          (err) => {
            console.warn("Firestore submissions onSnapshot failed:", err.message);
          }
        );

        setIsLoading(false);
      } else {
        setUser(null);
        setPurchasedBooks([]);
        setPurchasedSeries([]);
        setDownloadedBooks([]);
        setEnrolledCourses([]);
        setCourseProgress({});
        setMySubmissions([]);
        // Load guest bookmark from localStorage
        try {
          const guestBookmark = localStorage.getItem('quran_bookmark');
          if (guestBookmark) {
            setQuranBookmark(JSON.parse(guestBookmark));
          } else {
            setQuranBookmark(null);
          }
        } catch {
          setQuranBookmark(null);
        }
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) {
        unsubscribeUser();
      }
      if (unsubscribeSubmissions) {
        unsubscribeSubmissions();
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

  // Live-listen to the courses collection in Firestore
  useEffect(() => {
    const unsubscribeCourses = onSnapshot(
      collection(db, 'courses'),
      (snap) => {
        const fetched: Course[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Course, 'id'>),
        }));
        setCourses(fetched);
      },
      (err) => {
        console.warn("Firestore courses snapshot failed:", err.message);
      }
    );

    return () => unsubscribeCourses();
  }, []);

  // Live-listen to the banners collection in Firestore
  useEffect(() => {
    const unsubscribeBanners = onSnapshot(
      collection(db, 'banners'),
      (snap) => {
        const fetched: Banner[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Banner, 'id'>),
        }));
        // Sort by createdAt descending
        fetched.sort((a, b) => {
          const tA = a.createdAt && typeof a.createdAt === 'object' && 'seconds' in a.createdAt 
            ? a.createdAt.seconds * 1000 
            : typeof a.createdAt === 'number' 
              ? a.createdAt 
              : 0;
          const tB = b.createdAt && typeof b.createdAt === 'object' && 'seconds' in b.createdAt 
            ? b.createdAt.seconds * 1000 
            : typeof b.createdAt === 'number' 
              ? b.createdAt 
              : 0;
          return tB - tA;
        });
        setBanners(fetched);
      },
      (err) => {
        console.warn("Firestore banners snapshot failed:", err.message);
      }
    );

    return () => unsubscribeBanners();
  }, []);

  // Live-listen to the short_reads collection in Firestore with API fallback
  useEffect(() => {
    const fetchShortReadsFallback = async () => {
      try {
        const res = await fetch('/api/reminder');
        if (res.ok) {
          const data = await res.json();
          setShortReads(data);
        }
      } catch (err) {
        console.error("Failed to fetch reminders via fallback API:", err);
      }
    };

    const unsubscribeShortReads = onSnapshot(
      collection(db, 'short_reads'),
      (snap) => {
        const fetched: ShortRead[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ShortRead, 'id'>),
        }));
        // Sort by createdAt descending (newest first)
        fetched.sort((a, b) => {
          const tA = a.createdAt && typeof a.createdAt === 'object' && 'seconds' in a.createdAt 
            ? a.createdAt.seconds * 1000 
            : typeof a.createdAt === 'number' 
              ? a.createdAt 
              : 0;
          const tB = b.createdAt && typeof b.createdAt === 'object' && 'seconds' in b.createdAt 
            ? b.createdAt.seconds * 1000 
            : typeof b.createdAt === 'number' 
              ? b.createdAt 
              : 0;
          return tB - tA;
        });
        setShortReads(fetched);
      },
      (err) => {
        console.warn("Firestore short_reads snapshot failed, trying API fallback:", err.message);
        fetchShortReadsFallback();
      }
    );

    return () => unsubscribeShortReads();
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
    try {
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
    } catch (err: any) {
      console.error("purchaseBook error:", err);
      showToast(err.message || "Failed to complete book purchase.", "error");
      return false;
    }
  };

  const purchaseDownload = async (bookId: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { downloadedBooks: arrayUnion(bookId) });
      await addDoc(collection(db, 'user_downloads'), {
        userId: user.uid,
        bookId,
        purchasedAt: serverTimestamp(),
      });
      logFirebaseEvent('purchase_book_download', { bookId });
      return true;
    } catch (err: any) {
      console.error("purchaseDownload error:", err);
      showToast(err.message || "Failed to complete download purchase.", "error");
      return false;
    }
  };

  const removePurchasedBook = async (bookId: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { purchasedBooks: arrayRemove(bookId) });
      return true;
    } catch (err: any) {
      console.error("removePurchasedBook error:", err);
      return false;
    }
  };

  const removeDownloadedBook = async (bookId: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { downloadedBooks: arrayRemove(bookId) });
      return true;
    } catch (err: any) {
      console.error("removeDownloadedBook error:", err);
      return false;
    }
  };

  const purchaseSeries = async (seriesId: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { purchasedSeries: arrayUnion(seriesId) });
      await addDoc(collection(db, 'user_series'), {
        userId: user.uid,
        seriesId,
        purchasedAt: serverTimestamp(),
      });
      logFirebaseEvent('purchase_series', { seriesId });
      return true;
    } catch (err: any) {
      console.error("purchaseSeries error:", err);
      showToast(err.message || "Failed to purchase book series.", "error");
      return false;
    }
  };

  const removePurchasedSeries = async (seriesId: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { purchasedSeries: arrayRemove(seriesId) });
      return true;
    } catch (err: any) {
      console.error("removePurchasedSeries error:", err);
      return false;
    }
  };

  const enrollCourse = async (courseId: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { enrolledCourses: arrayUnion(courseId) });
      await addDoc(collection(db, 'user_courses'), {
        userId: user.uid,
        courseId,
        enrolledAt: serverTimestamp(),
      });
      logFirebaseEvent('enroll_course', { courseId });
      return true;
    } catch (err: any) {
      console.error("enrollCourse error:", err);
      showToast(err.message || "Failed to enroll in course.", "error");
      return false;
    }
  };

  const removeEnrolledCourse = async (courseId: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { enrolledCourses: arrayRemove(courseId) });
      return true;
    } catch (err: any) {
      console.error("removeEnrolledCourse error:", err);
      return false;
    }
  };

  const updateCourseProgress = async (courseId: string, lessonId: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const userRef = doc(db, 'users', user.uid);
      const fieldPath = `courseProgress.${courseId}`;
      await updateDoc(userRef, { [fieldPath]: arrayUnion(lessonId) });
      return true;
    } catch (err: any) {
      console.error("updateCourseProgress error:", err);
      return false;
    }
  };

  const tipMe = async (amount: number, message: string): Promise<boolean> => {
    if (!user) return false;
    try {
      await addDoc(collection(db, 'tips'), {
        userId: user.uid,
        email: user.email,
        amount,
        message,
        createdAt: serverTimestamp(),
      });
      logFirebaseEvent('tip_author', { amount, message });
      return true;
    } catch (err: any) {
      console.error("tipMe error:", err);
      showToast(err.message || "Failed to send tip.", "error");
      return false;
    }
  };

  const submitAssignment = async (courseId: string, lessonId: string, imageUrl: string, imagePath: string): Promise<boolean> => {
    if (!user) return false;
    const submissionId = `${courseId}_${lessonId}_${user.uid}`;
    
    // Find if there's an existing submission and delete it from Bunny
    const existing = mySubmissions.find(s => s.courseId === courseId && s.lessonId === lessonId);
    if (existing && existing.imagePath) {
      try {
        await fetch(`/api/upload?path=${encodeURIComponent(existing.imagePath)}`, {
          method: 'DELETE'
        });
      } catch (err) {
        console.warn("Failed to delete previous submission file from Bunny:", err);
      }
    }

    try {
      const subRef = doc(db, 'submissions', submissionId);
      await setDoc(subRef, {
        userId: user.uid,
        userEmail: user.email,
        courseId,
        lessonId,
        imageUrl,
        imagePath,
        submittedAt: Date.now()
      });
      logFirebaseEvent('submit_assignment', { courseId, lessonId });
      return true;
    } catch (err) {
      console.error("Failed to save assignment submission:", err);
      throw err;
    }
  };

  const updateQuranBookmark = async (surahId: number, verseId: number | null): Promise<boolean> => {
    const bookmarkValue = (surahId === 0 || verseId === null) ? null : { surahId, verseId };
    setQuranBookmark(bookmarkValue);

    if (!user) {
      try {
        if (!bookmarkValue) {
          localStorage.removeItem('quran_bookmark');
        } else {
          localStorage.setItem('quran_bookmark', JSON.stringify(bookmarkValue));
        }
        return true;
      } catch (err) {
        console.error("Failed to write quran_bookmark to localStorage:", err);
        return false;
      }
    }

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { quranBookmark: bookmarkValue });
      return true;
    } catch (err) {
      console.error("Failed to update Quran bookmark in Firestore:", err);
      return false;
    }
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

  // ─── Course Catalog Actions (admin-only) ──────────────────────────────────

  const addCourse = async (c: Omit<Course, 'id' | 'createdAt'>): Promise<string> => {
    const docRef = await addDoc(collection(db, 'courses'), {
      ...c,
      isPublished: true,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  };

  const updateCourse = async (c: Course): Promise<void> => {
    const { id, ...rest } = c;
    await updateDoc(doc(db, 'courses', id), rest);
  };

  const deleteCourse = async (id: string): Promise<void> => {
    await deleteDoc(doc(db, 'courses', id));
  };

  // ─── Short Reads / Reminders Actions (admin-only) ──────────────────────────

  const addShortRead = async (sr: Omit<ShortRead, 'id' | 'createdAt'>): Promise<string> => {
    try {
      const docRef = await addDoc(collection(db, 'short_reads'), {
        ...sr,
        isPublished: true,
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (err: any) {
      if (err.code === 'permission-denied' || err.message?.includes('permission')) {
        console.warn("Firestore client write failed, trying API fallback...");
        const res = await fetch('/api/reminder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sr),
        });
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Failed to save reminder via API');
        }
        const data = await res.json();
        // Refetch manually to sync state
        const refetchRes = await fetch('/api/reminder');
        if (refetchRes.ok) {
          setShortReads(await refetchRes.json());
        }
        return data.id;
      }
      throw err;
    }
  };

  const updateShortRead = async (sr: ShortRead): Promise<void> => {
    try {
      const { id, ...rest } = sr;
      await updateDoc(doc(db, 'short_reads', id), rest);
    } catch (err: any) {
      if (err.code === 'permission-denied' || err.message?.includes('permission')) {
        console.warn("Firestore client update failed, trying API fallback...");
        const res = await fetch('/api/reminder', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sr),
        });
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Failed to update reminder via API');
        }
        // Refetch manually to sync state
        const refetchRes = await fetch('/api/reminder');
        if (refetchRes.ok) {
          setShortReads(await refetchRes.json());
        }
        return;
      }
      throw err;
    }
  };

  const deleteShortRead = async (id: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, 'short_reads', id));
    } catch (err: any) {
      if (err.code === 'permission-denied' || err.message?.includes('permission')) {
        console.warn("Firestore client delete failed, trying API fallback...");
        const res = await fetch(`/api/reminder?id=${id}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Failed to delete reminder via API');
        }
        // Refetch manually to sync state
        const refetchRes = await fetch('/api/reminder');
        if (refetchRes.ok) {
          setShortReads(await refetchRes.json());
        }
        return;
      }
      throw err;
    }
  };

  // ─── Banner Actions (admin-only) ──────────────────────────────────────────

  const addBanner = async (banner: Omit<Banner, 'id' | 'createdAt'>): Promise<string> => {
    const docRef = await addDoc(collection(db, 'banners'), {
      ...banner,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  };

  const updateBanner = async (banner: Banner): Promise<void> => {
    const { id, ...rest } = banner;
    await updateDoc(doc(db, 'banners', id), rest as any);
  };

  const deleteBanner = async (id: string): Promise<void> => {
    await deleteDoc(doc(db, 'banners', id));
  };

  return (
    <AppContext.Provider
      value={{
        user,
        isLoading,
        purchasedBooks,
        purchasedSeries,
        downloadedBooks,
        enrolledCourses,
        courseProgress,
        quranBookmark,
        updateQuranBookmark,
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
        enrollCourse,
        removeEnrolledCourse,
        updateCourseProgress,
        tipMe,
        books,
        series,
        courses,
        addBook,
        updateBook,
        deleteBook,
        addSeries,
        updateSeries,
        deleteSeries,
        addCourse,
        updateCourse,
        deleteCourse,
        shortReads,
        addShortRead,
        updateShortRead,
        deleteShortRead,
        banners,
        addBanner,
        updateBanner,
        deleteBanner,
        mySubmissions,
        submitAssignment,
        toasts,
        showToast,
        removeToast,
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
