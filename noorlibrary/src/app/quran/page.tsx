"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useApp } from "../../context/AppContext";

interface SurahMeta {
  id: number;
  name: string;
  transliteration: string;
  translation: string;
  type: string;
  total_verses: number;
}

export default function QuranIndex() {
  const { quranBookmark } = useApp();
  const [surahs, setSurahs] = useState<SurahMeta[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "meccan" | "medinan">("all");
  const [sortBy, setSortBy] = useState<"id-asc" | "id-desc" | "verses-desc" | "verses-asc">("id-asc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
              <span>&rarr;</span>
            </Link>
          </div>
        </section>
      )}

      {/* Controls: Search, Filter, Sort */}
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
              placeholder="Search by Surah name, translation, or number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              style={{
                width: "100%",
                paddingLeft: "3rem",
                fontSize: "1rem",
              }}
            />
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

          {/* Filtering and Sorting Row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            {/* Filter Tabs */}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {(["all", "meccan", "medinan"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`btn ${
                    filterType === type ? "btn-primary" : "btn-secondary"
                  }`}
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

            {/* Sort Dropdown */}
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
        </div>
      </section>

      {/* Grid of Surahs */}
      <section className="container">
        {loading && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "4rem 0",
              flexDirection: "column",
              gap: "1rem",
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
            <p style={{ color: "var(--text-secondary)" }}>Loading Chapters...</p>
            <style jsx global>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
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
    </div>
  );
}
