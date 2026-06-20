"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "../../../context/AppContext";

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

export default function SurahReader({ params }: { params: Promise<{ surahId: string }> }) {
  const resolvedParams = use(params);
  const surahIdStr = resolvedParams.surahId;
  const surahId = parseInt(surahIdStr, 10);
  const router = useRouter();

  const { quranBookmark, updateQuranBookmark } = useApp();
  const [surah, setSurah] = useState<SurahData | null>(null);
  const [surahList, setSurahList] = useState<{ id: number; transliteration: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Reader Customization State
  const [fontSizeArabic, setFontSizeArabic] = useState(32);
  const [fontSizeTranslation, setFontSizeTranslation] = useState(16);
  const [showTranslation, setShowTranslation] = useState(true);
  const [showTransliteration, setShowTransliteration] = useState(false);
  const [readerTheme, setReaderTheme] = useState<"light" | "sepia" | "dark">("light");
  const [showMobileControls, setShowMobileControls] = useState(false);
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
        setSurah(data);

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

  // Auto-scroll to bookmark on mount / when surah loads
  useEffect(() => {
    if (surah && quranBookmark?.surahId === surahId && !hasScrolled) {
      const timer = setTimeout(() => {
        const element = document.getElementById(`verse-${quranBookmark.verseId}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          setHasScrolled(true);
        }
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [surah, surahId, quranBookmark, hasScrolled]);

  const handleShareSurah = async () => {
    if (!surah) return;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");
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
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");
    const shareData = {
      title: `Surah ${surah.transliteration}, Verse ${verse.id} - Noor Library`,
      text: `${verse.text}\n\n"${verse.translation}"\n\n— Read Surah ${surah.transliteration}, Verse ${verse.id} on Noor Library.`,
      url: `${baseUrl}/quran/${surahId}#verse-${verse.id}`,
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
        <style jsx global>{`
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
    sepia: {
      bg: "#fcf8ee",
      border: "#eadeca",
      text: "#433422",
      textMuted: "#6b583f",
      verseBg: "#f5edd6",
      verseHover: "rgba(212, 175, 55, 0.1)",
      arabic: "#2a1b0c",
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

  return (
    <div
      style={{
        paddingTop: "100px",
        paddingBottom: "5rem",
        minHeight: "100vh",
        backgroundColor: readerTheme === "dark" ? "#0b0f19" : "var(--bg-primary)",
        transition: "background-color 0.3s ease",
      }}
    >
      {/* Import calligraphic Arabic font */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400;1,700&display=swap');
        .quran-arabic-text {
          font-family: 'Amiri', serif;
          line-height: 2.2;
          text-align: right;
          direction: rtl;
        }
      `}</style>

      {/* Local component styles for mobile controls responsiveness */}
      <style jsx>{`
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
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
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

              {surahList.length > 0 && (
                <select
                  value={surahId}
                  onChange={(e) => router.push(`/quran/${e.target.value}`)}
                  style={{
                    padding: "0.4rem 2rem 0.4rem 0.8rem",
                    fontSize: "0.9rem",
                    borderRadius: "var(--radius-md)",
                    border: `1px solid ${themeStyles.border}`,
                    backgroundColor: themeStyles.verseBg === "transparent" ? "var(--bg-primary)" : themeStyles.verseBg,
                    color: themeStyles.text,
                    cursor: "pointer",
                  }}
                >
                  {surahList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.id}. {s.transliteration}
                    </option>
                  ))}
                </select>
              )}

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
                    backgroundColor: themeStyles.verseBg === "transparent" ? "var(--bg-primary)" : themeStyles.verseBg,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span>🔗</span> Share
                </button>
              )}
            </div>

            <button
              onClick={() => setShowMobileControls(!showMobileControls)}
              className="mobile-settings-toggle-btn btn"
              style={{
                padding: "0.4rem 0.75rem",
                fontSize: "0.85rem",
                borderRadius: "var(--radius-md)",
                border: `1px solid ${themeStyles.border}`,
                backgroundColor: showMobileControls ? "rgba(212, 175, 55, 0.15)" : themeStyles.verseBg,
                color: showMobileControls ? "var(--accent-gold)" : themeStyles.text,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
            >
              <span>⚙️</span>
              <span>{showMobileControls ? "Hide Options" : "Settings"}</span>
            </button>
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
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.8rem", color: themeStyles.textMuted }}>Arabic:</span>
              <button
                onClick={() => setFontSizeArabic(Math.max(20, fontSizeArabic - 4))}
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
                onClick={() => setFontSizeArabic(Math.min(56, fontSizeArabic + 4))}
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

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.8rem", color: themeStyles.textMuted }}>Eng:</span>
              <button
                onClick={() => setFontSizeTranslation(Math.max(12, fontSizeTranslation - 2))}
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
                onClick={() => setFontSizeTranslation(Math.min(28, fontSizeTranslation + 2))}
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
            <label style={{ display: "flex", alignItems: "center", gap: "0.25rem", cursor: "pointer", fontSize: "0.85rem" }}>
              <input
                type="checkbox"
                checked={showTranslation}
                onChange={() => setShowTranslation(!showTranslation)}
                style={{ accentColor: "var(--accent-gold)" }}
              />
              Translation
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: "0.25rem", cursor: "pointer", fontSize: "0.85rem" }}>
              <input
                type="checkbox"
                checked={showTransliteration}
                onChange={() => setShowTransliteration(!showTransliteration)}
                style={{ accentColor: "var(--accent-gold)" }}
              />
              Transliteration
            </label>

            {/* Themes Selection */}
            <div style={{ display: "flex", gap: "0.25rem" }}>
              {(["light", "sepia", "dark"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setReaderTheme(t)}
                  style={{
                    padding: "0.3rem 0.6rem",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textTransform: "capitalize",
                    borderRadius: "4px",
                    cursor: "pointer",
                    background: t === "light" ? "#ffffff" : t === "sepia" ? "#f4ecd8" : "#1e293b",
                    color: t === "dark" ? "#ffffff" : "#000000",
                    border: readerTheme === t ? "2px solid var(--accent-gold)" : "1px solid #ccc",
                  }}
                >
                  {t}
                </button>
              ))}
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
              بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
            </div>
          )}

          {/* Verses List */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "2.5rem",
            }}
          >
            {surah.verses.map((verse) => {
              const isBookmarked = quranBookmark?.surahId === surahId && quranBookmark?.verseId === verse.id;
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
                      ? (readerTheme === "dark" ? "rgba(212, 175, 55, 0.08)" : "rgba(212, 175, 55, 0.05)")
                      : "transparent",
                    border: isBookmarked ? "1px solid rgba(212, 175, 55, 0.3)" : "none",
                    borderBottom: isBookmarked ? "1px solid rgba(212, 175, 55, 0.3)" : `1px solid ${themeStyles.border}`,
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
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
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
                          backgroundColor: themeStyles.verseBg === "transparent" ? "rgba(212, 175, 55, 0.05)" : themeStyles.verseBg,
                          marginTop: "4px",
                        }}
                      >
                        {verse.id}
                      </div>

                      {/* Bookmark Toggle Button */}
                      <button
                        onClick={() => updateQuranBookmark(surahId, isBookmarked ? null : verse.id)}
                        title={isBookmarked ? "Remove Bookmark" : "Save Bookmark"}
                        style={{
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          color: isBookmarked ? "var(--accent-gold)" : "var(--text-muted)",
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
                          e.currentTarget.style.opacity = isBookmarked ? "1" : "0.4";
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
                    </div>

                    {/* Arabic Text (Right) */}
                    <div
                      className="quran-arabic-text"
                      style={{
                        fontSize: `${fontSizeArabic}px`,
                        color: themeStyles.arabic,
                        flex: 1,
                      }}
                    >
                      {verse.text}
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
                      {verse.translation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom Pagination controls */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "4rem",
              borderTop: `1px solid ${themeStyles.border}`,
              paddingTop: "2rem",
            }}
          >
            {surahId > 1 ? (
              <Link
                href={`/quran/${surahId - 1}`}
                className="btn btn-secondary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  borderColor: themeStyles.border,
                  color: themeStyles.text,
                  fontSize: "0.9rem",
                }}
              >
                &larr; Previous Surah
              </Link>
            ) : (
              <div />
            )}

            <Link
              href="/quran"
              style={{
                color: "var(--accent-gold)",
                fontWeight: 600,
                fontSize: "0.95rem",
              }}
            >
              Surah Index
            </Link>

            {surahId < 114 ? (
              <Link
                href={`/quran/${surahId + 1}`}
                className="btn btn-secondary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  borderColor: themeStyles.border,
                  color: themeStyles.text,
                  fontSize: "0.9rem",
                }}
              >
                Next Surah &rarr;
              </Link>
            ) : (
              <div />
            )}
          </div>
        </div>
      </section>

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
            background: readerTheme === "dark" 
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
          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1) translateY(-2px)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1) translateY(0)")}
        >
          ↑
        </button>
      )}
    </div>
  );
}
