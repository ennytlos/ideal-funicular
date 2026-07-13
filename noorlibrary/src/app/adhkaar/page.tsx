"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface Supplication {
  order: number;
  content: string;
  translation: string;
  transliteration: string;
  count: number;
  count_description: string;
  fadl: string;
  source: string;
  type: number; // 0 = both, 1 = morning only, 2 = evening only
}

export default function AdhkarReader() {
  const [adhkar, setAdhkar] = useState<Supplication[]>([]);
  const [activeTab, setActiveTab] = useState<"morning" | "evening">("morning");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Counters State (supplication order -> current count)
  const [counts, setCounts] = useState<{ [key: number]: number }>({});

  // C2 fix: reset all counters when switching between Morning / Evening
  const [isConfirmReset, setIsConfirmReset] = useState(false);

  // Reader Customization State
  const [fontSizeArabic, setFontSizeArabic] = useState(30);
  const [fontSizeTranslation, setFontSizeTranslation] = useState(15);
  const [showTranslation, setShowTranslation] = useState(true);
  const [showTransliteration, setShowTransliteration] = useState(true);
  const [readerTheme, setReaderTheme] = useState<"light" | "sepia" | "dark">("light");
  const [showMobileControls, setShowMobileControls] = useState(false);
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
      title: "Daily Adhkar - Noor Library",
      text: "Read morning and evening Adhkar supplications with interactive counters on Noor Library.",
      url: `${baseUrl}/adhkaar`,
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
        alert("Adhkar page link copied to clipboard!");
      } catch (err) {
        // Clipboard failed
      }
    }
  };

  // 1. Fetch Adhkar and auto-detect time of day on mount
  useEffect(() => {
    async function fetchAdhkar() {
      try {
        const res = await fetch("/api/read/adhkar");
        if (!res.ok) throw new Error("Failed to load Adhkar supplications");
        const data = await res.json();
        setAdhkar(data);

        // Auto detect time of day: Fajr to Noon (5 AM - 12 PM) -> Morning. Rest -> Evening
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) {
          setActiveTab("morning");
        } else {
          setActiveTab("evening");
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    }
    fetchAdhkar();
  }, []);

  // 2. Filter supplications based on activeTab
  // Morning: type 0 (both) and type 1 (morning only)
  // Evening: type 0 (both) and type 2 (evening only)
  const filteredAdhkar = adhkar.filter((item) => {
    if (activeTab === "morning") {
      return item.type === 0 || item.type === 1;
    } else {
      return item.type === 0 || item.type === 2;
    }
  });

  // 3. Counter handlers
  const incrementCount = (order: number, maxCount: number) => {
    setCounts((prev) => {
      const current = prev[order] || 0;
      if (current >= maxCount) return prev; // cap at max
      return { ...prev, [order]: current + 1 };
    });
  };

  const handleTabChange = (tab: "morning" | "evening") => {
    // C2 fix: reset counts when switching tab so Evening items don't inherit Morning indices
    setCounts({});
    setActiveTab(tab);
  };

  const resetAllCounts = () => {
    // U1 fix: use inline confirmation state instead of blocking window.confirm
    setIsConfirmReset(true);
  };

  const confirmReset = () => {
    setCounts({});
    setIsConfirmReset(false);
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
        <p style={{ color: "var(--text-secondary)" }}>Loading Remembrances...</p>
        {/* C1 fix: plain <style> tag — styled-jsx not supported in Next.js App Router */}
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
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
            Unable to Load Adhkar
          </h3>
          <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
            {error}
          </p>
          <button onClick={() => window.location.reload()} className="btn btn-primary">
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  const themeStyles = {
    light: {
      bg: "var(--bg-secondary)",
      border: "var(--border-color)",
      text: "var(--text-primary)",
      textMuted: "var(--text-secondary)",
      verseBg: "transparent",
      arabic: "var(--text-primary)",
      cardBg: "var(--bg-secondary)",
      cardHover: "rgba(220, 38, 38, 0.02)",
      cardSuccess: "rgba(34, 197, 94, 0.04)"
    },
    sepia: {
      bg: "#fcf8ee",
      border: "#eadeca",
      text: "#433422",
      textMuted: "#6b583f",
      verseBg: "#f5edd6",
      arabic: "#2a1b0c",
      cardBg: "#fcf8ee",
      cardHover: "rgba(212, 175, 55, 0.08)",
      cardSuccess: "rgba(34, 197, 94, 0.08)"
    },
    dark: {
      bg: "#0b0f19",
      border: "#1e293b",
      text: "#f8fafc",
      textMuted: "#94a3b8",
      verseBg: "#161f30",
      arabic: "#f8fafc",
      cardBg: "#161f30",
      cardHover: "rgba(255, 255, 255, 0.01)",
      cardSuccess: "rgba(34, 197, 94, 0.06)"
    }
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
      {/* C1 fix: use plain <style> tag — styled-jsx not supported in Next.js App Router */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400;1,700&display=swap');
        .adhkar-arabic-text {
          font-family: 'Amiri', serif;
          line-height: 2.2;
          text-align: right;
          direction: rtl;
        }
      `}</style>

      {/* Local component styles for mobile controls responsiveness */}
      {/* C1 fix: use plain <style> tag for responsive controls */}
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
        .supplication-card {
          padding: 2.25rem !important;
        }
        @media (max-width: 480px) {
          .supplication-card {
            padding: 1.5rem 1.25rem !important;
          }
        }
        @media (max-width: 340px) {
          .supplication-card {
            padding: 1rem 0.75rem !important;
          }
        }
        .tabs-container {
          display: flex;
          flex-direction: row;
        }
        @media (max-width: 580px) {
          .tabs-container {
            flex-direction: column !important;
            gap: 0.5rem;
          }
        }
      `}</style>

      {/* Settings sticky control bar */}
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
          {/* Top Row: Back link, Reset, and mobile toggle */}
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
                href="/"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  color: themeStyles.textMuted,
                  fontSize: "0.9rem",
                  fontWeight: 600,
                }}
              >
                &larr; Home
              </Link>

              <button
                onClick={resetAllCounts}
                className="btn btn-secondary"
                style={{
                  padding: "0.4rem 0.8rem",
                  fontSize: "0.85rem",
                  borderRadius: "var(--radius-md)",
                  borderColor: themeStyles.border,
                  color: "var(--accent-red)",
                  backgroundColor: themeStyles.verseBg === "transparent" ? "var(--bg-primary)" : themeStyles.verseBg,
                  cursor: "pointer",
                }}
              >
                Reset Counters
              </button>

              <button
                onClick={handleShare}
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
                onClick={() => setFontSizeArabic(Math.max(20, fontSizeArabic - 3))}
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
                onClick={() => setFontSizeArabic(Math.min(50, fontSizeArabic + 3))}
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
                onClick={() => setFontSizeTranslation(Math.max(11, fontSizeTranslation - 2))}
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
                onClick={() => setFontSizeTranslation(Math.min(24, fontSizeTranslation + 2))}
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

      {/* Main Container */}
      <section className="container" style={{ marginTop: "2.5rem" }}>
        {/* Morning & Evening Segmented Tabs */}
        <div
          className="tabs-container"
          style={{
            background: themeStyles.bg,
            border: `1px solid ${themeStyles.border}`,
            borderRadius: "var(--radius-lg)",
            padding: "0.5rem",
            marginBottom: "2.5rem",
            boxShadow: "0 4px 15px rgba(0, 0, 0, 0.02)",
          }}
        >
          <button
            onClick={() => handleTabChange("morning")}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              padding: "1rem",
              fontSize: "1.05rem",
              fontFamily: "Outfit",
              fontWeight: 700,
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              transition: "var(--transition-smooth)",
              background: activeTab === "morning" ? "var(--accent-gold-gradient)" : "transparent",
              color: activeTab === "morning" ? "#000000" : themeStyles.text,
              border: "none",
            }}
          >
            <span>☀️</span> Morning Remembrances
          </button>
          <button
            onClick={() => handleTabChange("evening")}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              padding: "1rem",
              fontSize: "1.05rem",
              fontFamily: "Outfit",
              fontWeight: 700,
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              transition: "var(--transition-smooth)",
              background: activeTab === "evening" ? "linear-gradient(135deg, #4f46e5 0%, #1e1b4b 100%)" : "transparent",
              color: activeTab === "evening" ? "#ffffff" : themeStyles.text,
              border: "none",
            }}
          >
            <span>🌙</span> Evening Remembrances
          </button>
        </div>

        {/* U1 fix: inline confirmation for Reset Counters (no window.confirm) */}
        {isConfirmReset && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 999,
            backgroundColor: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <div className="glass-card" style={{
              padding: "2rem", borderRadius: "var(--radius-md)",
              maxWidth: "360px", width: "90%", textAlign: "center",
              border: "1px solid var(--border-color)",
            }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🔄</div>
              <h3 style={{ marginBottom: "0.5rem" }}>Reset all counters?</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
                This will set all recitation counters back to 0.
              </p>
              <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
                <button className="btn btn-secondary" onClick={() => setIsConfirmReset(false)}
                  style={{ padding: "0.5rem 1.5rem", cursor: "pointer" }}>Cancel</button>
                <button className="btn btn-primary" onClick={confirmReset}
                  style={{ padding: "0.5rem 1.5rem", cursor: "pointer", backgroundColor: "var(--accent-red)", color: "#fff" }}>Yes, Reset</button>
              </div>
            </div>
          </div>
        )}

        {/* Informative Header */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <h2 style={{ fontFamily: "Outfit", fontSize: "1.8rem", color: themeStyles.text, marginBottom: "0.5rem" }}>
            {activeTab === "morning" ? "Morning Adhkar" : "Evening Adhkar"}
          </h2>
          <p style={{ color: themeStyles.textMuted, fontSize: "0.95rem" }}>
            {activeTab === "morning"
              ? "Recited after Fajr prayer until sunrise."
              : "Recited after 'Asr prayer until sunset."}{" "}
            Tap any card to increase its recitation counter.
          </p>
        </div>

        {/* Supplications Cards Grid */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "2rem",
          }}
        >
          {filteredAdhkar.map((item, index) => {
            const currentCount = counts[item.order] || 0;
            const isCompleted = currentCount >= item.count;

            return (
              <div
                key={item.order}
                onClick={() => incrementCount(item.order, item.count)}
                className="supplication-card"
                style={{
                  backgroundColor: isCompleted ? themeStyles.cardSuccess : themeStyles.cardBg,
                  border: isCompleted
                    ? "1.5px solid rgb(34, 197, 94)"
                    : `1px solid ${themeStyles.border}`,
                  borderRadius: "var(--radius-lg)",
                  color: themeStyles.text,
                  boxShadow: isCompleted
                    ? "0 4px 20px rgba(34, 197, 94, 0.05)"
                    : "0 6px 20px rgba(0, 0, 0, 0.01)",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  cursor: isCompleted ? "default" : "pointer",
                  position: "relative",
                  opacity: isCompleted ? 0.75 : 1,
                }}
              >
                {/* Header Row: Index & Recitations Needed */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "0.75rem",
                    marginBottom: "1.5rem",
                    borderBottom: `1px solid ${themeStyles.border}`,
                    paddingBottom: "1rem",
                  }}
                >
                  <span style={{ fontSize: "0.85rem", color: themeStyles.textMuted, fontFamily: "Outfit", fontWeight: 600 }}>
                    Supplication {index + 1} of {filteredAdhkar.length}
                  </span>

                  {/* Interactive Counter Badge */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontSize: "0.8rem", color: themeStyles.textMuted }}>
                      {item.count_description}
                    </span>
                    <div
                      style={{
                        padding: "0.35rem 0.875rem",
                        borderRadius: "var(--radius-md)",
                        backgroundColor: isCompleted ? "rgb(34, 197, 94)" : "var(--accent-gold-gradient)",
                        color: isCompleted ? "#ffffff" : "#000000",
                        fontFamily: "Outfit",
                        fontWeight: 700,
                        fontSize: "0.9rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                      }}
                    >
                      {isCompleted ? (
                        <span>✓ Done</span>
                      ) : (
                        <span>
                          {currentCount} / {item.count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Content Sections */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1.25rem",
                  }}
                >
                  {/* Arabic supplication text */}
                  <div
                    className="adhkar-arabic-text"
                    style={{
                      fontSize: `${fontSizeArabic}px`,
                      color: themeStyles.arabic,
                      marginBottom: "0.5rem",
                    }}
                  >
                    {item.content}
                  </div>

                  {/* Transliteration */}
                  {showTransliteration && (
                    <div
                      style={{
                        fontSize: `${fontSizeTranslation * 0.95}px`,
                        color: "var(--accent-gold)",
                        fontStyle: "italic",
                        lineHeight: 1.5,
                      }}
                    >
                      {item.transliteration}
                    </div>
                  )}

                  {/* Translation */}
                  {showTranslation && (
                    <div
                      style={{
                        fontSize: `${fontSizeTranslation}px`,
                        color: themeStyles.text,
                        lineHeight: 1.6,
                      }}
                    >
                      {item.translation}
                    </div>
                  )}

                  {/* Virtues / Fadl */}
                  {item.fadl && (
                    <div
                      style={{
                        marginTop: "1rem",
                        padding: "1rem",
                        borderRadius: "var(--radius-md)",
                        background: readerTheme === "dark" ? "#0f172a" : "rgba(0, 0, 0, 0.02)",
                        borderLeft: "3px solid var(--accent-gold)",
                        fontSize: "0.85rem",
                        color: themeStyles.textMuted,
                        lineHeight: 1.5,
                      }}
                    >
                      <strong style={{ color: themeStyles.text, display: "block", marginBottom: "4px" }}>Virtue:</strong>
                      {item.fadl}
                    </div>
                  )}

                  {/* Source */}
                  {item.source && (
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: themeStyles.textMuted,
                        fontStyle: "italic",
                        textAlign: "right",
                      }}
                    >
                      Source: {item.source}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
      </section>
    </div>
  );
}
