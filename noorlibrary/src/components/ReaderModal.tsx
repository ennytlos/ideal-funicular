"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Book, Episode, useApp } from "../context/AppContext";
import { pdfjs, Document, Page } from "react-pdf";
import { logFirebaseEvent, db } from "../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

// Configure react-pdf worker source using Next.js bundler-resolved local worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface ReaderModalProps {
  book: Book | Episode;
  seriesId?: string;
  onClose: () => void;
}

interface Chapter {
  title: string;
  pages: string[];
}


const DEFAULT_CHAPTERS: Chapter[] = [
  {
    title: "Introduction",
    pages: [
      "Welcome to the reader. The content for this book is currently loading or preparing. Please check back shortly for the full text.",
      "In the meantime, you can explore the settings panel at the top to customize your reading layout, fonts, and theme.",
    ],
  },
];

export default function ReaderModal({ book, seriesId, onClose }: ReaderModalProps) {
  const { user } = useApp();
  const isTextBook = book.contentType === 'plaintext';
  const isBook = (b: Book | Episode): b is Book => (b as Book).author !== undefined;
  const [chapters, setChapters] = useState<Chapter[]>(DEFAULT_CHAPTERS);

  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [progressLoaded, setProgressLoaded] = useState(false);

  // Load reading progress from Firestore (for logged in users) or localStorage (for guests)
  useEffect(() => {
    if (!book.id) return;
    
    let active = true;
    setProgressLoaded(false);

    const loadProgress = async () => {
      if (user) {
        try {
          const docRef = doc(db, 'reading_progress', `${user.uid}_${book.id}`);
          const snap = await getDoc(docRef);
          if (active && snap.exists()) {
            const data = snap.data();
            setCurrentPageIndex(data.pageIndex || 0);
            if (data.chapterIndex !== undefined) {
              setCurrentChapterIndex(data.chapterIndex);
            }
            setProgressLoaded(true);
            return;
          }
        } catch (err) {
          console.warn("Failed to load progress from Firestore:", err);
        }
      }

      try {
        const local = localStorage.getItem(`noor_progress_${book.id}`);
        if (active && local) {
          const { pageIndex, chapterIndex } = JSON.parse(local);
          setCurrentPageIndex(pageIndex || 0);
          if (chapterIndex !== undefined) {
            setCurrentChapterIndex(chapterIndex);
          }
        }
      } catch (err) {
        console.warn("Failed to load progress from localStorage:", err);
      }
      if (active) {
        setProgressLoaded(true);
      }
    };

    loadProgress();

    return () => {
      active = false;
    };
  }, [book.id, user]);

  // Save reading progress to local storage and Firestore (debounced)
  useEffect(() => {
    if (!progressLoaded || !book.id) return;

    const saveProgress = async () => {
      try {
        localStorage.setItem(
          `noor_progress_${book.id}`,
          JSON.stringify({ pageIndex: currentPageIndex, chapterIndex: currentChapterIndex })
        );
      } catch (e) {
        console.warn("Failed to save progress to localStorage:", e);
      }

      if (user) {
        try {
          await setDoc(doc(db, 'reading_progress', `${user.uid}_${book.id}`), {
            userId: user.uid,
            bookId: book.id,
            pageIndex: currentPageIndex,
            chapterIndex: currentChapterIndex,
            updatedAt: Date.now()
          }, { merge: true });
        } catch (err) {
          console.warn("Failed to save progress to Firestore:", err);
        }
      }
    };

    const timer = setTimeout(saveProgress, 1500);
    return () => clearTimeout(timer);
  }, [currentPageIndex, currentChapterIndex, book.id, user, progressLoaded]);

  // PDF specific states
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(!isTextBook);
  const [loadingText, setLoadingText] = useState(isTextBook);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfScale, setPdfScale] = useState(1.0);
  const [containerWidth, setContainerWidth] = useState(500);

  // Customization states
  const [theme, setTheme] = useState<"day" | "sepia" | "night">("sepia");
  const [fontFamily, setFontFamily] = useState<"serif" | "sans-serif">("serif");
  const [fontSize, setFontSize] = useState(1.2); // rem

  // Panel states
  const [isNavOpen, setIsNavOpen] = useState(true);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [noteText, setNoteText] = useState("");

  // Load notes from local storage on mount/book change
  useEffect(() => {
    const savedNotes = localStorage.getItem(`noor_notes_${book.id}`) || "";
    const timer = setTimeout(() => {
      setNoteText(savedNotes);
    }, 0);
    return () => clearTimeout(timer);
  }, [book.id]);

  // Log reading start to Firebase Analytics
  useEffect(() => {
    logFirebaseEvent('read_book', { bookId: book.id, title: book.title });
  }, [book.id, book.title]);

  // Fetch content directly (bypassing CORS)
  useEffect(() => {
    let active = true;
    let currentBlobUrl: string | null = null;

    const fetchContent = async () => {
      if (isTextBook) setLoadingText(true);
      else setLoadingPdf(true);
      
      setPdfError(null);
      try {
        const queryParams = seriesId ? `?seriesId=${seriesId}` : '';
        const res = await fetch(`/api/read/${book.id}${queryParams}`);
        if (!active) return;

        if (!res.ok) {
          let errMsg = 'Failed to retrieve the book content.';
          try {
            const data = await res.json();
            errMsg = data.error || errMsg;
          } catch {}
          setPdfError(errMsg);
          return;
        }

        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (active) {
            if (data.url) {
              setPdfUrl(data.url);
            } else {
              // JSON text book chapters
              if (Array.isArray(data)) {
                setChapters(data);
              } else if (data.chapters) {
                setChapters(data.chapters);
              }
            }
          }
        } else {
          // Binary stream (PDF)
          const blob = await res.blob();
          if (!active) return;
          currentBlobUrl = URL.createObjectURL(blob);
          setPdfUrl(currentBlobUrl);
        }
      } catch (err: unknown) {
        if (active) {
          setPdfError(
            book.isSecure !== false
              ? 'Failed to fetch secure book content.'
              : 'Failed to fetch book content.'
          );
          if (err instanceof Error) {
            console.error('ReaderModal fetch error:', err.message);
          }
        }
      } finally {
        if (active) {
          if (isTextBook) setLoadingText(false);
          else setLoadingPdf(false);
        }
      }
    };

    fetchContent();

    return () => {
      active = false;
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [book.id, isTextBook, book.isSecure, seriesId]);

  const handleNextPage = useCallback(() => {
    if (isTextBook) {
      const currentChapter = chapters[currentChapterIndex];
      if (currentChapter && currentPageIndex < currentChapter.pages.length - 1) {
        setCurrentPageIndex((prev) => prev + 1);
      } else if (currentChapterIndex < chapters.length - 1) {
        setCurrentChapterIndex((prev) => prev + 1);
        setCurrentPageIndex(0);
      }
    } else {
      if (numPages && currentPageIndex < numPages - 1) {
        setCurrentPageIndex((prev) => prev + 1);
      }
    }
  }, [currentChapterIndex, currentPageIndex, chapters, isTextBook, numPages]);

  const handlePrevPage = useCallback(() => {
    if (isTextBook) {
      if (currentPageIndex > 0) {
        setCurrentPageIndex((prev) => prev - 1);
      } else if (currentChapterIndex > 0) {
        const prevChapterIndex = currentChapterIndex - 1;
        setCurrentChapterIndex(prevChapterIndex);
        setCurrentPageIndex(Math.max(0, (chapters[prevChapterIndex]?.pages.length || 1) - 1));
      }
    } else {
      if (currentPageIndex > 0) {
        setCurrentPageIndex((prev) => prev - 1);
      }
    }
  }, [currentChapterIndex, currentPageIndex, chapters, isTextBook]);

  // Handle keyboard arrow keys navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't flip page if user is actively writing a note or in an settings popup
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }
      if (e.key === "ArrowRight") {
        handleNextPage();
      } else if (e.key === "ArrowLeft") {
        handlePrevPage();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentChapterIndex, currentPageIndex, chapters, handleNextPage, handlePrevPage]);

  // Click outside listener for typography settings popup
  useEffect(() => {
    if (!isSettingsOpen) return;
    const handleOutsideClick = () => setIsSettingsOpen(false);
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [isSettingsOpen]);

  // Adjust panels on mobile screen sizes automatically
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      setContainerWidth(Math.min(600, w - 32));
      if (w < 768) {
        setIsNavOpen(false);
      } else {
        setIsNavOpen(true);
      }
    };

    handleResize(); // trigger initially
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleNoteChange = (text: string) => {
    setNoteText(text);
    localStorage.setItem(`noor_notes_${book.id}`, text);
  };

  // Color scheme bindings
  const themeStyles = {
    day: {
      bg: "#fcfbf7",
      text: "#1c1917",
      sidebarBg: "#f5f4ef",
      border: "#e7e5e4",
      mutedText: "#78716c",
    },
    sepia: {
      bg: "#f4ecd8",
      text: "#4a3b32",
      sidebarBg: "#ebdcb9",
      border: "#dcc69e",
      mutedText: "#7d6855",
    },
    night: {
      bg: "#121214",
      text: "#e4e4e7",
      sidebarBg: "#18181b",
      border: "#27272a",
      mutedText: "#a1a1aa",
    },
  }[theme];

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: themeStyles.bg,
        color: themeStyles.text,
        zIndex: 250,
        display: "flex",
        flexDirection: "column",
        fontFamily:
          fontFamily === "serif"
            ? "Georgia, serif"
            : "var(--font-sans, system-ui, sans-serif)",
        transition: "background-color 0.3s ease, color 0.3s ease",
        overflow: "hidden",
      }}
    >
      {/* Top Header Controls */}
      <header
        style={{
          height: "64px",
          padding: "0 0.75rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${themeStyles.border}`,
          backgroundColor: themeStyles.sidebarBg,
          fontFamily: "Outfit, sans-serif",
          zIndex: 30,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              color: themeStyles.text,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
              fontSize: "0.9rem",
              fontWeight: 600,
              padding: "0.5rem",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
            </svg>
            <span className="hidden-mobile">Exit</span>
          </button>

          <button
            onClick={() => {
              setIsNavOpen(!isNavOpen);
              if (isNotesOpen) setIsNotesOpen(false); // close other drawer
            }}
            style={{
              background: "transparent",
              color: themeStyles.text,
              cursor: "pointer",
              padding: "0.5rem",
              borderRadius: "var(--radius-sm)",
              display: "flex",
              alignItems: "center",
            }}
            title="Table of Contents"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>
        </div>

        {/* Center Title */}
        <div
          className="reader-header-title-container"
          style={{
            flex: 1,
            minWidth: 0,
            textAlign: "center",
            padding: "0 1rem",
          }}
        >
          <h4 
            style={{ 
              fontSize: "1rem", 
              fontWeight: 700, 
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }} 
            title={book.title}
          >
            {book.title}
          </h4>
          <p
            style={{
              fontSize: "0.75rem",
              color: themeStyles.mutedText,
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}
          >
            {isBook(book) ? book.author : ''}
          </p>
        </div>

        {/* Toolbar Right: Settings & Notepad */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
          {/* Zoom Controls (only for PDF reader) */}
          {!isTextBook && (
            <div 
              className="hidden-mobile"
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.25rem',
                marginRight: '0.5rem',
                border: `1px solid ${themeStyles.border}`,
                borderRadius: 'var(--radius-sm)',
                padding: '2px',
                background: 'rgba(0,0,0,0.02)'
              }}
            >
              <button
                onClick={() => setPdfScale(prev => Math.max(0.5, prev - 0.1))}
                style={{
                  background: "transparent",
                  color: themeStyles.text,
                  border: "none",
                  borderRadius: "2px",
                  padding: "0.25rem 0.5rem",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                title="Zoom Out"
              >
                &minus;
              </button>
              <span 
                style={{ 
                  fontSize: '0.8rem', 
                  minWidth: '40px', 
                  textAlign: 'center', 
                  fontFamily: 'Outfit, sans-serif',
                  fontWeight: 600,
                  color: themeStyles.text
                }}
              >
                {Math.round(pdfScale * 100)}%
              </span>
              <button
                onClick={() => setPdfScale(prev => Math.min(2.0, prev + 0.1))}
                style={{
                  background: "transparent",
                  color: themeStyles.text,
                  border: "none",
                  borderRadius: "2px",
                  padding: "0.25rem 0.5rem",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                title="Zoom In"
              >
                +
              </button>
            </div>
          )}

          {/* Format Settings Popover */}
          <div style={{ position: "relative" }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsSettingsOpen(!isSettingsOpen);
              }}
              style={{
                background: isSettingsOpen
                  ? "rgba(220, 38, 38, 0.1)"
                  : "transparent",
                color: isSettingsOpen ? "var(--accent-red)" : themeStyles.text,
                cursor: "pointer",
                padding: "0.5rem",
                borderRadius: "var(--radius-sm)",
                display: "flex",
                alignItems: "center",
                border: isSettingsOpen
                  ? "1px solid var(--accent-red)"
                  : "1px solid transparent",
                fontFamily: "Outfit, sans-serif",
                fontWeight: 600,
                fontSize: "1rem",
                width: "32px",
                height: "32px",
                justifyContent: "center",
              }}
              title="Typography & Appearance"
            >
              Aa
            </button>

            {isSettingsOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "absolute",
                  top: "calc(100% + 12px)",
                  right: 0,
                  width: "260px",
                  backgroundColor: themeStyles.sidebarBg,
                  border: `1px solid ${themeStyles.border}`,
                  borderRadius: "var(--radius-md)",
                  padding: "1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                  zIndex: 100,
                  fontFamily: "Outfit, sans-serif",
                  animation: "fadeIn 0.15s ease",
                }}
              >
                {/* Font Size Row */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: themeStyles.mutedText,
                      textTransform: "uppercase",
                    }}
                  >
                    Font Size
                  </span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.25rem",
                      borderRadius: "var(--radius-sm)",
                      background: "rgba(0,0,0,0.04)",
                    }}
                  >
                    <button
                      onClick={() =>
                        setFontSize((prev) => Math.max(0.9, prev - 0.1))
                      }
                      style={{
                        background: "transparent",
                        color: themeStyles.text,
                        border: "none",
                        cursor: "pointer",
                        padding: "0.5rem",
                        flex: 1,
                        fontSize: "0.9rem",
                        fontWeight: "bold",
                      }}
                    >
                      A-
                    </button>
                    <div
                      style={{
                        width: "1px",
                        height: "16px",
                        backgroundColor: themeStyles.border,
                      }}
                    />
                    <button
                      onClick={() =>
                        setFontSize((prev) => Math.min(2.0, prev + 0.1))
                      }
                      style={{
                        background: "transparent",
                        color: themeStyles.text,
                        border: "none",
                        cursor: "pointer",
                        padding: "0.5rem",
                        flex: 1,
                        fontSize: "1.1rem",
                        fontWeight: "bold",
                      }}
                    >
                      A+
                    </button>
                  </div>
                </div>

                {/* Font Family Row */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: themeStyles.mutedText,
                      textTransform: "uppercase",
                    }}
                  >
                    Font Family
                  </span>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      onClick={() => setFontFamily("serif")}
                      style={{
                        flex: 1,
                        padding: "0.5rem",
                        borderRadius: "var(--radius-sm)",
                        border: `1px solid ${fontFamily === "serif" ? "var(--accent-red)" : themeStyles.border}`,
                        background:
                          fontFamily === "serif"
                            ? "rgba(220, 38, 38, 0.05)"
                            : "transparent",
                        color:
                          fontFamily === "serif"
                            ? "var(--accent-red)"
                            : themeStyles.text,
                        cursor: "pointer",
                        fontFamily: "Georgia, serif",
                        fontSize: "0.9rem",
                        fontWeight: 600,
                      }}
                    >
                      Serif
                    </button>
                    <button
                      onClick={() => setFontFamily("sans-serif")}
                      style={{
                        flex: 1,
                        padding: "0.5rem",
                        borderRadius: "var(--radius-sm)",
                        border: `1px solid ${fontFamily === "sans-serif" ? "var(--accent-red)" : themeStyles.border}`,
                        background:
                          fontFamily === "sans-serif"
                            ? "rgba(220, 38, 38, 0.05)"
                            : "transparent",
                        color:
                          fontFamily === "sans-serif"
                            ? "var(--accent-red)"
                            : themeStyles.text,
                        cursor: "pointer",
                        fontFamily: "system-ui, sans-serif",
                        fontSize: "0.9rem",
                        fontWeight: 600,
                      }}
                    >
                      Sans
                    </button>
                  </div>
                </div>

                {/* Theme Row */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: themeStyles.mutedText,
                      textTransform: "uppercase",
                    }}
                  >
                    Theme
                  </span>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                    }}
                  >
                    <button
                      onClick={() => setTheme("day")}
                      style={{
                        flex: 1,
                        padding: "0.5rem",
                        borderRadius: "var(--radius-sm)",
                        border: `1px solid ${theme === "day" ? "var(--accent-red)" : themeStyles.border}`,
                        background: "#fcfbf7",
                        color: "#1c1917",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                      }}
                    >
                      Day
                    </button>
                    <button
                      onClick={() => setTheme("sepia")}
                      style={{
                        flex: 1,
                        padding: "0.5rem",
                        borderRadius: "var(--radius-sm)",
                        border: `1px solid ${theme === "sepia" ? "var(--accent-red)" : themeStyles.border}`,
                        background: "#f4ecd8",
                        color: "#4a3b32",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                      }}
                    >
                      Sepia
                    </button>
                    <button
                      onClick={() => setTheme("night")}
                      style={{
                        flex: 1,
                        padding: "0.5rem",
                        borderRadius: "var(--radius-sm)",
                        border: `1px solid ${theme === "night" ? "var(--accent-red)" : themeStyles.border}`,
                        background: "#18181b",
                        color: "#e4e4e7",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                      }}
                    >
                      Night
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div
            style={{
              width: "1px",
              height: "20px",
              backgroundColor: themeStyles.border,
            }}
          />

          {/* Reflections notepad toggler */}
          <button
            onClick={() => {
              setIsNotesOpen(!isNotesOpen);
              if (isNavOpen) setIsNavOpen(false); // close other drawer
            }}
            style={{
              background: isNotesOpen
                ? "rgba(220, 38, 38, 0.1)"
                : "transparent",
              color: isNotesOpen ? "var(--accent-red)" : themeStyles.text,
              cursor: "pointer",
              padding: "0.5rem",
              borderRadius: "var(--radius-sm)",
              display: "flex",
              alignItems: "center",
              border: isNotesOpen
                ? "1px solid var(--accent-red)"
                : "1px solid transparent",
            }}
            title="Reflections Note"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div
        style={{
          flex: 1,
          display: "flex",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Mobile Backdrop Overlay (Clicking outside closes active mobile drawers) */}
        {(isNavOpen || isNotesOpen) && (
          <div
            className="drawer-backdrop"
            onClick={() => {
              setIsNavOpen(false);
              setIsNotesOpen(false);
            }}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              background: "rgba(0, 0, 0, 0.4)",
              zIndex: 15,
            }}
          />
        )}

        {/* Left Drawer: Table of Contents */}
        <nav
          className={`reader-toc ${isNavOpen ? "open" : ""}`}
          style={
            {
              "--sidebar-bg": themeStyles.sidebarBg,
              "--border-color": themeStyles.border,
            } as React.CSSProperties
          }
        >
          <div
            style={{
              padding: "1.25rem",
              borderBottom: `1px solid ${themeStyles.border}`,
            }}
          >
            <h5
              style={{
                fontWeight: 700,
                textTransform: "uppercase",
                fontSize: "0.8rem",
                letterSpacing: "0.05em",
                color: themeStyles.mutedText,
                margin: 0,
              }}
            >
              Table of Contents
            </h5>
          </div>
          <ul style={{ listStyle: "none", padding: "0.5rem 0", margin: 0 }}>
            {isTextBook ? (
              chapters.map((ch, idx) => (
                <li key={idx}>
                  <button
                    onClick={() => {
                      setCurrentChapterIndex(idx);
                      setCurrentPageIndex(0);
                      // On mobile, close drawer after selection
                      if (window.innerWidth < 768) setIsNavOpen(false);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "0.85rem 1.25rem",
                      background:
                        currentChapterIndex === idx
                          ? "rgba(220, 38, 38, 0.08)"
                          : "transparent",
                      color:
                        currentChapterIndex === idx
                          ? "var(--accent-red)"
                          : themeStyles.text,
                      border: "none",
                      borderLeft:
                        currentChapterIndex === idx
                          ? "4px solid var(--accent-red)"
                          : "4px solid transparent",
                      cursor: "pointer",
                      fontSize: "0.9rem",
                      fontWeight: currentChapterIndex === idx ? 600 : 500,
                      transition: "var(--transition-fast)",
                    }}
                  >
                    {ch.title}
                  </button>
                </li>
              ))
            ) : (
              numPages && Array.from({ length: numPages }).map((_, idx) => (
                <li key={idx}>
                  <button
                    onClick={() => {
                      setCurrentPageIndex(idx);
                      // On mobile, close drawer after selection
                      if (window.innerWidth < 768) setIsNavOpen(false);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "0.6rem 1.25rem",
                      background:
                        currentPageIndex === idx
                          ? "rgba(220, 38, 38, 0.08)"
                          : "transparent",
                      color:
                        currentPageIndex === idx
                          ? "var(--accent-red)"
                          : themeStyles.text,
                      border: "none",
                      borderLeft:
                        currentPageIndex === idx
                          ? "4px solid var(--accent-red)"
                          : "4px solid transparent",
                      cursor: "pointer",
                      fontSize: "0.9rem",
                      fontWeight: currentPageIndex === idx ? 600 : 500,
                      transition: "var(--transition-fast)",
                    }}
                  >
                    Page {idx + 1}
                  </button>
                </li>
              ))
            )}
          </ul>
        </nav>

        {/* Center: Book Content Panel */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start", // changed from center to allow scrolling to the top when overflowing
            padding: "1.5rem 1rem",
            position: "relative",
            overflowY: "auto",
            overflowX: "auto", // allow horizontal scrolling for zoomed PDF
            width: "100%",
            height: "100%",
          }}
        >
          {/* Main Book Page Content Area */}
          <div
            style={{
              maxWidth: "650px",
              width: "100%",
              margin: "0 auto", // changed from auto 0 to prevent cutoff
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            {/* Chapter Header */}
            <span
              style={{
                fontFamily: "Outfit, sans-serif",
                fontSize: "0.85rem",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "var(--accent-red)",
                fontWeight: 700,
              }}
            >
              {isTextBook ? chapters[currentChapterIndex].title : `Page ${currentPageIndex + 1}`}
            </span>

            {/* Body Text / PDF Document */}
            {isTextBook ? (
              <p
                className="reading-text"
                style={{
                  fontSize: `${fontSize}rem`,
                  lineHeight: 1.8,
                  textAlign: "justify",
                  margin: 0,
                  transition: "font-size 0.2s ease",
                  wordBreak: "break-word",
                }}
              >
                {chapters[currentChapterIndex].pages[currentPageIndex]}
              </p>
            ) : (
              <div 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  width: '100%', 
                  minHeight: '400px',
                  position: 'relative'
                }}
              >
                {loadingPdf && (
                  <p style={{ fontFamily: 'Outfit, sans-serif' }}>
                    {book.isSecure !== false
                      ? 'Retrieving secure reader connection...'
                      : 'Retrieving reader connection...'}
                  </p>
                )}
                {pdfError && <p style={{ color: 'var(--accent-red)', fontFamily: 'Outfit, sans-serif' }}>{pdfError}</p>}
                {pdfUrl && (
                  <Document
                    file={pdfUrl}
                    onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                    loading={
                      <p style={{ fontFamily: 'Outfit, sans-serif' }}>
                        {book.isSecure !== false
                          ? 'Decrypting book pages...'
                          : 'Loading book pages...'}
                      </p>
                    }
                    error={<p style={{ color: 'var(--accent-red)', fontFamily: 'Outfit, sans-serif' }}>Could not load PDF content. Please close and re-open.</p>}
                  >
                    <div 
                      style={{ 
                        filter: theme === "night" 
                          ? "invert(0.9) hue-rotate(180deg) contrast(0.9)" 
                          : theme === "sepia" 
                          ? "sepia(0.4) contrast(0.95) brightness(0.95)" 
                          : "none",
                        transition: "filter 0.3s ease",
                        boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
                        borderRadius: "var(--radius-md)",
                        overflow: "hidden"
                      }}
                    >
                      <Page 
                        pageNumber={currentPageIndex + 1} 
                        width={containerWidth} 
                        scale={pdfScale}
                        renderTextLayer={false} 
                        renderAnnotationLayer={false}
                      />
                    </div>
                  </Document>
                )}
              </div>
            )}
          </div>

          {/* Bottom Navigation and Progress Controls */}
          <div
            style={{
              width: "100%",
              maxWidth: "650px",
              marginTop: "auto",
              paddingTop: "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              fontFamily: "Outfit, sans-serif",
            }}
          >
            {/* Progress bar */}
            <div
              style={{
                width: "100%",
                height: "4px",
                backgroundColor: themeStyles.border,
                borderRadius: "2px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  backgroundColor: "var(--accent-red)",
                  width: `${((currentPageIndex + 1) / (isTextBook ? chapters[currentChapterIndex].pages.length : (numPages || 1))) * 100}%`,
                  transition: "width 0.2s ease",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "0.85rem",
                color: themeStyles.mutedText,
              }}
            >
              <button
                onClick={handlePrevPage}
                disabled={currentPageIndex === 0}
                style={{
                  background: "transparent",
                  color: currentPageIndex === 0 ? themeStyles.border : themeStyles.text,
                  border: "none",
                  cursor: currentPageIndex === 0 ? "default" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  fontWeight: 600,
                }}
              >
                &larr; Prev
              </button>

              <span>
                Page {currentPageIndex + 1} of{" "}
                {isTextBook ? chapters[currentChapterIndex].pages.length : (numPages || "?")}
              </span>

              <button
                onClick={handleNextPage}
                disabled={
                  isTextBook 
                    ? (currentChapterIndex === chapters.length - 1 && currentPageIndex === chapters[currentChapterIndex].pages.length - 1)
                    : (numPages !== null && currentPageIndex === numPages - 1)
                }
                style={{
                  background: "transparent",
                  color: (
                    isTextBook 
                      ? (currentChapterIndex === chapters.length - 1 && currentPageIndex === chapters[currentChapterIndex].pages.length - 1)
                      : (numPages !== null && currentPageIndex === numPages - 1)
                  ) ? themeStyles.border : themeStyles.text,
                  border: "none",
                  cursor: (
                    isTextBook 
                      ? (currentChapterIndex === chapters.length - 1 && currentPageIndex === chapters[currentChapterIndex].pages.length - 1)
                      : (numPages !== null && currentPageIndex === numPages - 1)
                  ) ? "default" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  fontWeight: 600,
                }}
              >
                Next &rarr;
              </button>
            </div>
          </div>
        </div>

        {/* Right Drawer: Reflections Notepad */}
        <div
          className={`reader-notes ${isNotesOpen ? "open" : ""}`}
          style={
            {
              "--sidebar-bg": themeStyles.sidebarBg,
              "--border-color": themeStyles.border,
            } as React.CSSProperties
          }
        >
          <div
            style={{
              padding: "1.25rem",
              borderBottom: `1px solid ${themeStyles.border}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h5
              style={{
                fontWeight: 700,
                textTransform: "uppercase",
                fontSize: "0.8rem",
                letterSpacing: "0.05em",
                color: themeStyles.mutedText,
                margin: 0,
              }}
            >
              My Reflections
            </h5>
            <button
              onClick={() => setIsNotesOpen(false)}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: themeStyles.mutedText,
                fontSize: "1.1rem",
              }}
            >
              &times;
            </button>
          </div>

          <div
            style={{
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              flex: 1,
            }}
          >
            <p
              style={{
                fontSize: "0.8rem",
                color: themeStyles.mutedText,
                lineHeight: "1.4",
                margin: 0,
              }}
            >
              Write down your personal reflections, verses, or quotes as you
              read. Notes are automatically saved.
            </p>
            <textarea
              value={noteText}
              onChange={(e) => handleNoteChange(e.target.value)}
              placeholder="Start typing your reflections here..."
              style={{
                flex: 1,
                width: "100%",
                padding: "0.75rem",
                borderRadius: "var(--radius-md)",
                backgroundColor:
                  theme === "night"
                    ? "rgba(255,255,255,0.03)"
                    : "rgba(0,0,0,0.02)",
                color: themeStyles.text,
                border: `1px solid ${themeStyles.border}`,
                fontFamily: "Inter, sans-serif",
                fontSize: "0.9rem",
                lineHeight: "1.6",
                resize: "none",
                outline: "none",
              }}
            />
          </div>
        </div>
      </div>

      {/* Responsive layout stylesheets — plain style tag (styled-jsx not supported in App Router) */}
      <style>{`
        .reader-toc {
          width: 0;
          overflow: hidden;
          background-color: var(--sidebar-bg);
          border-right: none;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          z-index: 20;
        }
        .reader-toc.open {
          width: 260px;
          border-right: 1px solid var(--border-color);
        }

        .reader-notes {
          width: 0;
          overflow: hidden;
          background-color: var(--sidebar-bg);
          border-left: none;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          z-index: 20;
        }
        .reader-notes.open {
          width: 320px;
          border-left: 1px solid var(--border-color);
        }

        .drawer-backdrop {
          display: none;
        }

        @media (max-width: 500px) {
          .reader-header-title-container {
            display: none !important;
          }
        }

        @media (max-width: 768px) {
          .hidden-mobile {
            display: none !important;
          }

          .reader-toc {
            position: absolute;
            top: 0;
            bottom: 0;
            left: 0;
            width: 280px !important;
            max-width: 85vw;
            transform: translateX(-100%);
            border-right: 1px solid var(--border-color) !important;
            box-shadow: 10px 0 25px rgba(0, 0, 0, 0.15);
          }
          .reader-toc.open {
            transform: translateX(0);
          }

          .reader-notes {
            position: absolute;
            top: 0;
            bottom: 0;
            right: 0;
            width: 280px !important;
            max-width: 85vw;
            transform: translateX(100%);
            border-left: 1px solid var(--border-color) !important;
            box-shadow: -10px 0 25px rgba(0, 0, 0, 0.15);
          }
          .reader-notes.open {
            transform: translateX(0);
          }

          .drawer-backdrop {
            display: block !important;
          }

          .reading-text {
            text-align: left !important;
          }
        }
      `}</style>
    </div>
  );
}
