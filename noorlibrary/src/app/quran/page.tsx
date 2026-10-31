"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "../../context/AppContext";
import WebQuranNavigationHub, { WebHubTab } from "../../components/quran/WebQuranNavigationHub";

interface SurahMeta {
  id: number;
  name: string;
  transliteration: string;
  translation: string;
  type: string;
  total_verses: number;
}

function toArabicNumber(num: number | string): string {
  const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return String(num).replace(/[0-9]/g, (d) => arabicDigits[parseInt(d, 10)]);
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
          backgroundColor: "rgba(212, 175, 55, 0.35)",
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
    )
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

export default function QuranIndex() {
  const router = useRouter();
  const { quranBookmark, user } = useApp();
  const [isWebHubOpen, setIsWebHubOpen] = useState(false);
  const [webHubTab, setWebHubTab] = useState<WebHubTab>("reflections");
  const [surahs, setSurahs] = useState<SurahMeta[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "meccan" | "medinan">("all");
  const [sortBy, setSortBy] = useState<"id-asc" | "id-desc" | "verses-desc" | "verses-asc">("id-asc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Full-Text Quran Search State
  const [searchMode, setSearchMode] = useState<"surahs" | "fulltext">("surahs");
  const [searchScope, setSearchScope] = useState<"all" | "arabic" | "english" | "transliteration">("all");
  const [searchResults, setSearchResults] = useState<{ surahs: any[]; verses: any[]; total: number }>({
    surahs: [],
    verses: [],
    total: 0,
  });
  const [searchLoading, setSearchLoading] = useState(false);

  // Debounced Full-Text Search
  useEffect(() => {
    if (searchMode !== "fulltext" || !searchQuery.trim()) {
      setSearchResults({ surahs: [], verses: [], total: 0 });
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/read/quran/search?q=${encodeURIComponent(searchQuery.trim())}&scope=${searchScope}&limit=60`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch (err) {
        console.error("Full text search error:", err);
      } finally {
        setSearchLoading(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [searchQuery, searchMode, searchScope]);

  const bookmarkedSurah = quranBookmark
    ? surahs.find((s) => s.id === quranBookmark.surahId)
    : null;

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

  const handleShare = async () => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");
    const shareData = {
      title: "The Holy Quran - Noor Library",
      text: "The best of your day is the one you spend in reading and studying the Holy Quran. \n Read now with clear Arabic script and complete English translations on Noor Library.",
      url: `${baseUrl}/quran`,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // Ignored or cancelled
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareData.url);
        alert("Quran portal link copied to clipboard!");
      } catch (err) {
        // Clipboard failed
      }
    }
  };

  useEffect(() => {
    async function fetchSurahs() {
      try {
        const res = await fetch("/api/read/quran");
        if (!res.ok) {
          throw new Error("Failed to load Surah index");
        }
        const data = await res.json();
        setSurahs(data);
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    }
    fetchSurahs();
  }, []);

  // Filter & Sort Logic
  const filteredSurahs = surahs
    .filter((surah) => {
      const matchesSearch =
        surah.transliteration.toLowerCase().includes(searchQuery.toLowerCase()) ||
        surah.translation.toLowerCase().includes(searchQuery.toLowerCase()) ||
        surah.name.includes(searchQuery) ||
        surah.id.toString() === searchQuery.trim();

      const matchesType =
        filterType === "all" || surah.type.toLowerCase() === filterType;

      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      if (sortBy === "id-asc") return a.id - b.id;
      if (sortBy === "id-desc") return b.id - a.id;
      if (sortBy === "verses-desc") return b.total_verses - a.total_verses;
      if (sortBy === "verses-asc") return a.total_verses - b.total_verses;
      return 0;
    });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "2.5rem",
        paddingTop: "100px",
        paddingBottom: "5rem",
        minHeight: "100vh",
      }}
    >
      {/* Hero Banner */}
      <section
        style={{
          position: "relative",
          textAlign: "center",
          padding: "3rem 1.5rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(to bottom, rgba(220, 38, 38, 0.03) 0%, transparent 100%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "50vw",
            height: "50vw",
            background: "radial-gradient(circle, rgba(212, 175, 55, 0.08) 0%, rgba(0, 0, 0, 0) 70%)",
            zIndex: -1,
            pointerEvents: "none",
          }}
        />
        <h1
          style={{
            fontSize: "clamp(2rem, 5vw, 3.5rem)",
            fontWeight: 800,
            marginBottom: "1rem",
            fontFamily: "Outfit",
          }}
        >
          The Holy <span className="text-gradient-gold">Quran</span>
        </h1>
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "1.1rem",
            maxWidth: "600px",
            lineHeight: 1.6,
          }}
        >
          Read and study the word of Allah with clear Arabic script and complete English translations.
        </p>
        <button
          onClick={handleShare}
          className="btn btn-secondary"
          style={{
            marginTop: "1.25rem",
            padding: "0.5rem 1.25rem",
            fontSize: "0.9rem",
            borderRadius: "var(--radius-md)",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            border: "1px solid rgba(212, 175, 55, 0.2)",
            color: "var(--accent-gold)",
            background: "transparent",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(212, 175, 55, 0.05)";
            e.currentTarget.style.borderColor = "var(--accent-gold)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderColor = "rgba(212, 175, 55, 0.2)";
          }}
        >
          <span>🔗</span> Share Portal
        </button>
      </section>

      {/* Resume Reading Banner */}
      {quranBookmark && (
        <section className="container" style={{ marginBottom: "-1rem" }}>
          <div
            className="glass-card"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "1.5rem 2rem",
              borderRadius: "var(--radius-lg)",
              border: "1px solid rgba(212, 175, 55, 0.3)",
              background: "linear-gradient(135deg, rgba(212, 175, 55, 0.08) 0%, rgba(220, 38, 38, 0.04) 100%)",
              boxShadow: "0 8px 32px rgba(212, 175, 55, 0.05)",
              flexWrap: "wrap",
              gap: "1.5rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: "var(--accent-gold-gradient)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.5rem",
                  boxShadow: "0 4px 15px rgba(212, 175, 55, 0.3)",
                }}
              >
                🔖
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  Resume Reading
                </h3>
                <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                  You were reading{" "}
                  <strong style={{ color: "var(--accent-gold)" }}>
                    {bookmarkedSurah
                      ? `Surah ${bookmarkedSurah.transliteration} (${bookmarkedSurah.name})`
                      : `Surah ${quranBookmark.surahId}`}
                  </strong>{" "}
                  • Verse {quranBookmark.verseId}
                </p>
              </div>
            </div>
            <Link
              href={`/quran/${quranBookmark.surahId}#verse-${quranBookmark.verseId}`}
              className="btn btn-gold"
              style={{
                padding: "0.6rem 1.5rem",
                fontSize: "0.9rem",
                borderRadius: "var(--radius-md)",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <span>Continue</span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
          </div>
        </section>
      )}

      {/* Controls: Mode Switcher, Search, Filter, Sort */}
      <section className="container">
        <div
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-lg)",
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.02)",
          }}
        >
          {/* Top Segmented Controls: Chapters vs Full Quran Search */}
          <div
            style={{
              display: "flex",
              gap: "0.6rem",
              borderBottom: "1px solid var(--border-color)",
              paddingBottom: "1.25rem",
              overflowX: "auto",
              WebkitOverflowScrolling: "touch",
              scrollbarWidth: "none",
            }}
          >
            <button
              onClick={() => setSearchMode("surahs")}
              className={`btn ${searchMode === "surahs" ? "btn-primary" : "btn-secondary"}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                borderRadius: "var(--radius-md)",
                padding: "0.6rem 1.15rem",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              <span>📑</span>
              <span>Chapters (114)</span>
            </button>
            <button
              onClick={() => setSearchMode("fulltext")}
              className={`btn ${searchMode === "fulltext" ? "btn-primary" : "btn-secondary"}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                borderRadius: "var(--radius-md)",
                padding: "0.6rem 1.15rem",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              <span>🔍</span>
              <span>Full-Text Search</span>
              <span
                style={{
                  fontSize: "0.75rem",
                  padding: "2px 8px",
                  borderRadius: "10px",
                  background: searchMode === "fulltext" ? "rgba(255, 255, 255, 0.25)" : "rgba(212, 175, 55, 0.2)",
                  color: searchMode === "fulltext" ? "#ffffff" : "var(--accent-gold)",
                  fontWeight: 700,
                }}
              >
                6,236
              </span>
            </button>

            <button
              onClick={() => {
                setWebHubTab("audio");
                setIsWebHubOpen(true);
              }}
              className="btn btn-secondary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                borderRadius: "var(--radius-md)",
                padding: "0.6rem 1.15rem",
                border: "1px solid rgba(212, 175, 55, 0.45)",
                backgroundColor: "rgba(212, 175, 55, 0.08)",
                color: "#D4AF37",
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
              title="Listen to full Surah recitations and browse Qaris"
            >
              <span>🎙️</span>
              <span>Audio Reciters</span>
            </button>

            <button
              onClick={() => {
                setWebHubTab("reflections");
                setIsWebHubOpen(true);
              }}
              className="btn btn-secondary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                borderRadius: "var(--radius-md)",
                padding: "0.6rem 1.15rem",
                border: "1px solid rgba(99, 102, 241, 0.45)",
                backgroundColor: "rgba(99, 102, 241, 0.08)",
                color: "#6366F1",
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              <span>✨</span>
              <span>Quran Hub</span>
            </button>
          </div>

          {/* Search Box */}
          <div style={{ position: "relative", width: "100%" }}>
            <span
              style={{
                position: "absolute",
                left: "1rem",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </span>
            <input
              type="text"
              placeholder={
                searchMode === "fulltext"
                  ? "Search Arabic script, English translation, transliteration, or direct 2:255..."
                  : "Search by Surah name, translation, or number (e.g. Mulk, 18, Baqarah)..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              style={{
                width: "100%",
                paddingLeft: "3rem",
                paddingRight: "6rem",
                fontSize: "1rem",
              }}
            />
            {searchLoading && (
              <span
                style={{
                  position: "absolute",
                  right: searchQuery ? "3rem" : "1rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "0.85rem",
                  color: "var(--accent-gold)",
                }}
              >
                Searching...
              </span>
            )}
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: "1rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  padding: "4px",
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Mode 1: Surah Browser Filtering & Sorting */}
          {searchMode === "surahs" ? (
            <>
              {searchQuery.trim() !== "" && (
                <div
                  onClick={() => setSearchMode("fulltext")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.75rem 1rem",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "rgba(212, 175, 55, 0.12)",
                    border: "1px solid rgba(212, 175, 55, 0.3)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span>✨</span>
                    <span style={{ fontSize: "0.9rem", color: "var(--accent-gold)", fontWeight: 600 }}>
                      Search &quot;{searchQuery}&quot; across all 6,236 Ayahs in the entire Quran
                    </span>
                  </div>
                  <span style={{ fontSize: "0.85rem", color: "var(--accent-gold)" }}>Switch to Full Search</span>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "1rem",
                }}
              >
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {(["all", "meccan", "medinan"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setFilterType(type)}
                      className={`btn ${filterType === type ? "btn-primary" : "btn-secondary"}`}
                      style={{
                        padding: "0.5rem 1rem",
                        fontSize: "0.85rem",
                        borderRadius: "var(--radius-md)",
                        textTransform: "capitalize",
                      }}
                    >
                      {type === "all" ? "All Chapters" : `${type}`}
                    </button>
                  ))}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                    Sort By:
                  </span>
                  <select
                    value={sortBy}
                    onChange={(e: any) => setSortBy(e.target.value)}
                    className="form-input"
                    style={{
                      padding: "0.5rem 2rem 0.5rem 1rem",
                      fontSize: "0.875rem",
                      borderRadius: "var(--radius-md)",
                      cursor: "pointer",
                      backgroundColor: "var(--bg-secondary)",
                    }}
                  >
                    <option value="id-asc">Surah Number (1-114)</option>
                    <option value="id-desc">Surah Number (114-1)</option>
                    <option value="verses-desc">Verses (Most first)</option>
                    <option value="verses-asc">Verses (Least first)</option>
                  </select>
                </div>
              </div>
            </>
          ) : (
            /* Mode 2: Full-Text Quran Search Scope Tabs & Popular Themes */
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {(
                  [
                    { id: "all", label: "All Match Types" },
                    { id: "arabic", label: "📖 Arabic Script" },
                    { id: "english", label: "🌐 English Translation" },
                    { id: "transliteration", label: "🔤 Phonetic Transliteration" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSearchScope(tab.id)}
                    className={`btn ${searchScope === tab.id ? "btn-primary" : "btn-secondary"}`}
                    style={{
                      padding: "0.4rem 0.85rem",
                      fontSize: "0.8rem",
                      borderRadius: "var(--radius-md)",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Popular Themes Shortcuts */}
              {searchQuery.trim() === "" && (
                <div style={{ marginTop: "0.5rem" }}>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
                    Popular Themes & Direct Verses:
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {QUICK_THEMES.map((theme, i) => (
                      <button
                        key={i}
                        onClick={() => setSearchQuery(theme.query)}
                        className="btn btn-secondary"
                        style={{
                          padding: "0.35rem 0.75rem",
                          fontSize: "0.8rem",
                          borderRadius: "var(--radius-md)",
                        }}
                      >
                        {theme.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Results Content Area */}
      {searchMode === "fulltext" ? (
        <section className="container">
          {/* Header Stats */}
          {searchQuery.trim() !== "" && (
            <div style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "0.95rem" }}>
                {searchLoading
                  ? "Searching across all 6,236 Ayahs..."
                  : searchResults.verses.length > 0
                  ? `Found ${searchResults.total} matching ${searchResults.total === 1 ? "verse" : "verses"}`
                  : "No verses matched your search"}
              </p>
            </div>
          )}

          {/* Matching Chapters Banner */}
          {searchResults.surahs.length > 0 && searchQuery.trim() !== "" && (
            <div style={{ marginBottom: "2rem" }}>
              <h4 style={{ fontSize: "0.9rem", color: "var(--accent-gold)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "0.75rem" }}>
                Matching Chapters ({searchResults.surahs.length})
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
                {searchResults.surahs.map((s) => (
                  <Link key={s.id} href={`/quran/${s.id}`}>
                    <div
                      className="glass-card"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "1rem 1.25rem",
                        border: "1px solid rgba(212, 175, 55, 0.4)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <span style={{ fontWeight: 700, color: "var(--accent-gold)", width: "24px" }}>{s.id}</span>
                        <div>
                          <div style={{ fontWeight: 600 }}>Surah {s.transliteration}</div>
                          <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{s.translation} • {s.total_verses} verses</div>
                        </div>
                      </div>
                      <span style={{ fontFamily: "var(--font-arabic, sans-serif)", fontSize: "1.3rem", color: "var(--accent-gold)" }}>{s.name}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Verses Results List */}
          {searchResults.verses.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {searchResults.verses.map((verse) => (
                <div
                  key={`${verse.surahId}_${verse.verseId}`}
                  className="glass-card"
                  style={{
                    padding: "1.5rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                    border: "1px solid var(--border-color)",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span
                        style={{
                          backgroundColor: "rgba(220, 38, 38, 0.12)",
                          color: "var(--accent-red)",
                          fontWeight: 700,
                          fontSize: "0.85rem",
                          padding: "3px 8px",
                          borderRadius: "var(--radius-sm)",
                        }}
                      >
                        {verse.surahId}:{verse.verseId}
                      </span>
                      <strong style={{ fontSize: "0.95rem" }}>Surah {verse.surahTransliteration}</strong>
                      <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                        ({verse.surahTranslation} • {verse.surahType === "meccan" ? "Makki" : "Madani"})
                      </span>
                    </div>

                    <Link
                      href={`/quran/${verse.surahId}#verse-${verse.verseId}`}
                      className="btn btn-secondary"
                      style={{ padding: "0.35rem 0.85rem", fontSize: "0.8rem", borderRadius: "var(--radius-sm)", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
                    >
                      <span>Read in Reader</span>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14" />
                        <path d="m12 5 7 7-7 7" />
                      </svg>
                    </Link>
                  </div>

                  {/* Arabic text with match highlight */}
                  <div
                    dir="rtl"
                    style={{
                      fontFamily: "var(--font-arabic, serif)",
                      fontSize: "1.75rem",
                      lineHeight: "2.2",
                      color: "var(--text-primary)",
                      textAlign: "right",
                    }}
                  >
                    {highlightMatch(verse.arabic, searchQuery, true)}
                    <span style={{ color: "var(--accent-gold)", fontSize: "1.3rem", marginRight: "0.5rem" }}>
                      {` ﴿${toArabicNumber(verse.verseId)}﴾`}
                    </span>
                  </div>

                  {/* English translation with match highlight */}
                  {verse.translation && (
                    <div style={{ fontSize: "0.95rem", color: "var(--text-primary)", lineHeight: 1.6 }}>
                      {highlightMatch(verse.translation, searchQuery, false)}
                    </div>
                  )}

                  {/* Transliteration */}
                  {verse.transliteration && (
                    <div style={{ fontSize: "0.85rem", fontStyle: "italic", color: "var(--text-secondary)" }}>
                      {verse.transliteration}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : searchQuery.trim() === "" ? (
            <div className="glass-card" style={{ textAlign: "center", padding: "4rem 2rem" }}>
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  backgroundColor: "rgba(220, 38, 38, 0.1)",
                  color: "var(--accent-red)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.75rem",
                  margin: "0 auto 1.5rem auto",
                }}
              >
                🔍
              </div>
              <h3 style={{ marginBottom: "0.75rem", fontSize: "1.4rem" }}>Full Quran Text Search</h3>
              <p style={{ color: "var(--text-secondary)", maxWidth: "480px", margin: "0 auto 1.5rem auto", lineHeight: 1.6 }}>
                Search any word or phrase in Arabic script, English translation, transliteration, or direct chapter and verse numbers like <strong>2:255</strong>.
              </p>
            </div>
          ) : !searchLoading ? (
            <div className="glass-card" style={{ textAlign: "center", padding: "4rem 2rem" }}>
              <h3 style={{ marginBottom: "0.5rem" }}>No Verses Found</h3>
              <p style={{ color: "var(--text-secondary)" }}>
                Try adjusting your search terms or switching the search scope buttons above.
              </p>
            </div>
          ) : null}
        </section>
      ) : (
        /* Grid of Surahs (Chapters mode) */
        <section className="container">
          {loading && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
                gap: "1.5rem",
              }}
            >
              {Array.from({ length: 12 }).map((_, idx) => (
                <div
                  key={idx}
                  className="glass-card skeleton-pulse"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1.25rem",
                    padding: "1.5rem",
                    height: "90px",
                    pointerEvents: "none",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <div style={{ width: "48px", height: "48px", borderRadius: "var(--radius-md)", backgroundColor: "var(--border-color)", opacity: 0.4 }} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <div style={{ height: "16px", width: "60%", backgroundColor: "var(--border-color)", borderRadius: "4px", opacity: 0.4 }} />
                    <div style={{ height: "12px", width: "40%", backgroundColor: "var(--border-color)", borderRadius: "3px", opacity: 0.4 }} />
                  </div>
                </div>
              ))}
              <style>{`
                @keyframes pulse {
                  0%, 100% { opacity: 0.6; }
                  50% { opacity: 0.3; }
                }
                .skeleton-pulse {
                  animation: pulse 1.5s infinite ease-in-out;
                }
              `}</style>
            </div>
          )}

          {error && (
            <div
              className="accent-card"
              style={{
                textAlign: "center",
                padding: "3rem",
                borderColor: "var(--accent-red)",
              }}
            >
              <h3 style={{ marginBottom: "1rem", color: "var(--accent-red)" }}>
                Unable to load Quran
              </h3>
              <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
                {error}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="btn btn-primary"
              >
                Retry Loading
              </button>
            </div>
          )}

          {!loading && !error && filteredSurahs.length === 0 && (
            <div
              className="glass-card"
              style={{
                textAlign: "center",
                padding: "4rem 2rem",
              }}
            >
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-muted)"
                strokeWidth="1.5"
                style={{ marginBottom: "1.5rem" }}
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3M8 11h6" />
              </svg>
              <h3 style={{ marginBottom: "0.5rem" }}>No Surahs Found</h3>
              <p style={{ color: "var(--text-secondary)" }}>
                Try adjusting your search keywords or active filter tabs.
              </p>
            </div>
          )}

          {!loading && !error && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
                gap: "1.5rem",
              }}
            >
              {filteredSurahs.map((surah) => (
                <Link key={surah.id} href={`/quran/${surah.id}`}>
                  <div
                    className="glass-card"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1.25rem",
                      padding: "1.5rem",
                      height: "100%",
                      cursor: "pointer",
                    }}
                  >
                    {/* Surah Number Icon */}
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "var(--radius-md)",
                        background: "linear-gradient(135deg, rgba(212, 175, 55, 0.1) 0%, rgba(220, 38, 38, 0.05) 100%)",
                        border: "1px solid rgba(212, 175, 55, 0.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "Outfit",
                        fontWeight: 700,
                        color: "var(--accent-gold)",
                        fontSize: "1.1rem",
                        flexShrink: 0,
                      }}
                    >
                      {surah.id}
                    </div>

                    {/* Names & Meaning */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                          marginBottom: "0.25rem",
                        }}
                      >
                        <h3
                          style={{
                            fontSize: "1.1rem",
                            fontWeight: 600,
                            color: "var(--text-primary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {surah.transliteration}
                        </h3>
                        <span
                          style={{
                            fontSize: "1.25rem",
                            fontFamily: "var(--font-arabic, sans-serif)",
                            fontWeight: 500,
                            color: "var(--accent-gold)",
                            textAlign: "right",
                          }}
                        >
                          {surah.name}
                        </span>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: "0.825rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            marginRight: "0.5rem",
                          }}
                        >
                          {surah.translation}
                        </span>
                        <span
                          className={
                            surah.type.toLowerCase() === "meccan"
                              ? "badge badge-premium"
                              : "badge badge-gold"
                          }
                          style={{
                            fontSize: "0.7rem",
                            padding: "0.15rem 0.5rem",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {surah.type}
                        </span>
                      </div>

                      <div
                        style={{
                          marginTop: "0.75rem",
                          fontSize: "0.75rem",
                          color: "var(--text-muted)",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
                          <path d="M12 7v5l3 3" />
                        </svg>
                        {surah.total_verses} Verses
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

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
            background: "var(--accent-gold-gradient)",
            color: "#000000",
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

      {/* Web Quran Navigation & Study Hub Modal */}
      <WebQuranNavigationHub
        key={`web-quran-hub-${webHubTab}`}
        isOpen={isWebHubOpen}
        onClose={() => setIsWebHubOpen(false)}
        currentSurahId={quranBookmark?.surahId || 1}
        currentSurahName={
          surahs.find((s) => s.id === (quranBookmark?.surahId || 1))?.transliteration ||
          "Al-Fatihah"
        }
        userId={user?.uid}
        initialTab={webHubTab}
        onJumpToAyah={(targetAyahId, targetSurahId) => {
          setIsWebHubOpen(false);
          const sId = targetSurahId || quranBookmark?.surahId || 1;
          router.push(`/quran/${sId}#verse-${targetAyahId}`);
        }}
      />
    </div>
  );
}
