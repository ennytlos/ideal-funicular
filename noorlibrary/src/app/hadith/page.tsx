"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useApp } from "../../context/AppContext";
import { db } from "../../lib/firebase";
import { doc, updateDoc, arrayUnion, arrayRemove, onSnapshot } from "firebase/firestore";
import { STATIC_HADITHS, COLLECTIONS, Hadith } from "../../lib/hadith-data";

// In-memory cache to avoid duplicate network fetches
const hadithCache: Record<string, { eng: any; ara?: any }> = {};

export default function HadithHaven() {
  const { user } = useApp();
  const [activeCollection, setActiveCollection] = useState<string>("all"); // "all" represents local Highlights
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [showBookmarksOnly, setShowBookmarksOnly] = useState<boolean>(false);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState<number>(10);

  // Bug#12 fix: use retryKey state instead of setTimeout hack to re-trigger collection fetch
  const [retryKey, setRetryKey] = useState<number>(0);

  // Font sizing (Arabic and English)
  const [arabicFontSize, setArabicFontSize] = useState<number>(28);
  const [englishFontSize, setEnglishFontSize] = useState<number>(16);

  // Dynamic API loading state
  const [loading, setLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [collectionHadiths, setCollectionHadiths] = useState<Hadith[]>([]);

  // State to track if Arabic texts are currently loading in background
  const [loadingArabic, setLoadingArabic] = useState<boolean>(false);

  // Track scroll position to show back to top
  const [showScrollTop, setShowScrollTop] = useState<boolean>(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // 1. Sync bookmarks from Firestore (logged in) or LocalStorage (guest)
  useEffect(() => {
    if (!user) {
      const local = localStorage.getItem("hadithBookmarks");
      if (local) {
        try {
          setBookmarks(JSON.parse(local));
        } catch (e) {
          setBookmarks([]);
        }
      } else {
        setBookmarks([]);
      }
      return;
    }

    const userDocRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(
      userDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setBookmarks(data.hadithBookmarks || []);
        }
      },
      (error) => {
        console.error("Error listening to user doc for bookmarks:", error);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // 2. Toggle Hadith Bookmark
  const toggleBookmark = async (hadithId: string) => {
    const isBookmarked = bookmarks.includes(hadithId);
    if (!user) {
      const newBookmarks = isBookmarked
        ? bookmarks.filter((id) => id !== hadithId)
        : [...bookmarks, hadithId];
      setBookmarks(newBookmarks);
      localStorage.setItem("hadithBookmarks", JSON.stringify(newBookmarks));
      return;
    }

    const userDocRef = doc(db, "users", user.uid);
    try {
      if (isBookmarked) {
        await updateDoc(userDocRef, {
          hadithBookmarks: arrayRemove(hadithId),
        });
      } else {
        await updateDoc(userDocRef, {
          hadithBookmarks: arrayUnion(hadithId),
        });
      }
    } catch (err) {
      console.error("Error updating user bookmarks:", err);
      alert("Failed to update bookmark in your profile.");
    }
  };

  // 3. Dynamic Hadith Loader (JSdelivr CDN)
  useEffect(() => {
    if (activeCollection === "all") {
      setCollectionHadiths([]);
      setApiError(null);
      setPageSize(10);
      return;
    }

    const fetchCollection = async () => {
      setLoading(true);
      setApiError(null);
      setPageSize(10);
      setCollectionHadiths([]);

      try {
        const cached = hadithCache[activeCollection];
        let engData = cached?.eng;
        let araData = cached?.ara;

        // 1. Fetch English version if not cached
        if (!engData) {
          const engRes = await fetch(
            `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/eng-${activeCollection}.min.json`
          );
          if (!engRes.ok) {
            throw new Error(`Failed to fetch English Hadiths for ${activeCollection}`);
          }
          // Evict oldest cache entry if size exceeds 3 to prevent unbounded memory growth on low-end devices
          const cacheKeys = Object.keys(hadithCache);
          if (cacheKeys.length >= 3 && !hadithCache[activeCollection]) {
            delete hadithCache[cacheKeys[0]];
          }
          hadithCache[activeCollection] = { eng: engData };
        }

        // Map and set English hadiths first so the user gets fast visual feedback
        const initialMapped = mapHadiths(activeCollection, engData, null);
        setCollectionHadiths(initialMapped);
        setLoading(false); // fast load done

        // 2. Fetch Arabic version in the background if not cached
        if (!araData) {
          setLoadingArabic(true);
          try {
            const araRes = await fetch(
              `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-${activeCollection}.min.json`
            );
            if (araRes.ok) {
              araData = await araRes.json();
              hadithCache[activeCollection].ara = araData;
            }
          } catch (araErr) {
            console.warn("Could not load Arabic text for collection", araErr);
          } finally {
            setLoadingArabic(false);
          }
        }

        // 3. If Arabic is now loaded, merge it with English and refresh list
        if (araData) {
          const mergedMapped = mapHadiths(activeCollection, engData, araData);
          setCollectionHadiths(mergedMapped);
        }
      } catch (err: any) {
        console.error(err);
        setApiError(err.message || "Failed to load Hadiths. Please check your connection.");
        setLoading(false);
      }
    };

    fetchCollection();
  }, [activeCollection, retryKey]);

  // Helper: map Fawaz Ahmed API to our local Hadith schema
  const mapHadiths = (colKey: string, engJSON: any, araJSON: any): Hadith[] => {
    const list = engJSON.hadiths || [];
    const araList = araJSON?.hadiths || [];

    const sections = engJSON.metadata?.sections || {};

    return list.map((h: any, idx: number) => {
      // Find matching Arabic index or item
      const matchingAra = araList[idx]?.hadithnumber === h.hadithnumber
        ? araList[idx]
        : araList.find((ah: any) => ah.hadithnumber === h.hadithnumber);

      const sectionId = h.reference?.book;
      const chapterName = sections[String(sectionId)] || "General";

      // Grading extraction
      let grade: 'Sahih' | 'Hasan' | 'Da\'if' | 'Mawdu\'' = 'Sahih';
      let gradedBy = 'Sahih';

      if (h.grades && h.grades.length > 0) {
        const primaryGrade = h.grades[0];
        gradedBy = primaryGrade.name || 'Scholar';
        const gLower = (primaryGrade.grade || '').toLowerCase();
        if (gLower.includes('sahih')) grade = 'Sahih';
        else if (gLower.includes('hasan')) grade = 'Hasan';
        else if (gLower.includes('daif') || gLower.includes('weak') || gLower.includes('da\'if')) grade = 'Da\'if';
        else if (gLower.includes('maudu') || gLower.includes('fabricated')) grade = 'Mawdu\'';
      } else {
        // Fallbacks for Bukhari and Muslim which are fully Sahih
        if (colKey === 'bukhari' || colKey === 'muslim') {
          grade = 'Sahih';
          gradedBy = colKey === 'bukhari' ? 'Sahih al-Bukhari' : 'Sahih Muslim';
        }
      }

      return {
        id: `${colKey}:${h.hadithnumber}`,
        collection: colKey,
        hadithNumber: String(h.hadithnumber),
        arabicText: matchingAra ? matchingAra.text : "",
        englishText: h.text || "",
        chapterName: chapterName,
        grade,
        gradedBy,
      };
    });
  };

  // 4. Combined source list (Curated Highlights vs Dynamic API results)
  const sourceHadiths = useMemo(() => {
    return activeCollection === "all" ? STATIC_HADITHS : collectionHadiths;
  }, [activeCollection, collectionHadiths]);

  // 5. Client-Side Search and Filter Logic
  const filteredHadiths = useMemo(() => {
    return sourceHadiths.filter((hadith) => {
      // A. Bookmark Filter
      if (showBookmarksOnly && !bookmarks.includes(hadith.id)) {
        return false;
      }

      // B. Grade Filter
      if (gradeFilter !== "all" && hadith.grade.toLowerCase() !== gradeFilter.toLowerCase()) {
        return false;
      }

      // C. Search Query
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const engText = (hadith.englishText || "").toLowerCase();
        const araText = (hadith.arabicText || "");
        const num = (hadith.hadithNumber || "");
        const chap = (hadith.chapterName || "").toLowerCase();
        const col = (hadith.collection || "").toLowerCase();

        const matchText = engText.includes(query) || 
                          araText.includes(query) || 
                          num === query || 
                          chap.includes(query) ||
                          col.includes(query);
        if (!matchText) return false;
      }

      return true;
    });
  }, [sourceHadiths, showBookmarksOnly, bookmarks, gradeFilter, searchQuery]);

  // Bug#8 fix: reset pageSize to 10 whenever search, grade, or bookmark filter changes
  useEffect(() => {
    setPageSize(10);
  }, [searchQuery, gradeFilter, showBookmarksOnly]);

  const displayedHadiths = useMemo(() => {
    return filteredHadiths.slice(0, pageSize);
  }, [filteredHadiths, pageSize]);

  const handleShare = async (hadith: Hadith) => {
    const text = `Hadith #${hadith.hadithNumber} (${hadith.collection.toUpperCase()}) — Graded: ${hadith.grade}\n\n"${hadith.englishText}"\n\nRead more authentic treasures on Noor Library.`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Hadith Haven - Noor Library",
          text: text,
          url: window.location.href,
        });
      } catch (err) {
        // Ignored
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        alert("Hadith copied to clipboard!");
      } catch (err) {
        alert("Failed to copy Hadith.");
      }
    }
  };

  const getGradeColor = (grade: string) => {
    switch (grade.toLowerCase()) {
      case "sahih":
        return "#10b981"; // emerald green
      case "hasan":
        return "var(--accent-gold)"; // gold
      case "da'if":
        return "#f97316"; // orange
      case "mawdu'":
        return "#ef4444"; // red
      default:
        return "var(--text-muted)";
    }
  };

  return (
    <div className="container" style={{ paddingTop: "100px", paddingBottom: "5rem" }}>
      {/* Banner */}
      <section
        className="glass-card"
        style={{
          position: "relative",
          padding: "3.5rem 2rem",
          borderRadius: "var(--radius-lg)",
          marginBottom: "2.5rem",
          background: "var(--accent-card-bg)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          border: "1px solid var(--border-color)",
          marginTop: "20px"
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "350px",
            height: "350px",
            background: "radial-gradient(circle, rgba(212, 175, 55, 0.1) 0%, rgba(0, 0, 0, 0) 70%)",
            zIndex: 0,
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", zIndex: 1 }}>
          <h1
            style={{
              fontSize: "clamp(2rem, 4vw, 3rem)",
              fontFamily: "Outfit",
              fontWeight: 700,
              marginBottom: "1rem",
              background: "var(--accent-gold-gradient)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Hadith Haven 📜
          </h1>
          <p style={{ color: "var(--text-secondary)", maxWidth: "600px", margin: "0 auto", lineHeight: 1.6 }}>
            Explore, search, and bookmark authentic Prophetic traditions from the canonical six books of Hadith. 
            Adjust layouts to your reading preferences and sync favorites.
          </p>
        </div>
      </section>

      {/* Font & Customization controls (Floating panel style) */}
      <div
        className="glass-card"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1.5rem",
          padding: "1rem 1.5rem",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
          border: "1px solid var(--border-color)",
          borderRadius: "var(--radius-md)",
        }}
      >
        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", flex: 1 }}>
          {/* Arabic scale */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: "180px" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>عربي Font:</span>
            <input
              type="range"
              min="20"
              max="48"
              value={arabicFontSize}
              onChange={(e) => setArabicFontSize(Number(e.target.value))}
              style={{
                flex: 1,
                cursor: "pointer",
                accentColor: "var(--accent-gold)",
                height: "6px",
                borderRadius: "3px",
              }}
            />
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>
              {arabicFontSize}px
            </span>
          </div>

          {/* English scale */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: "180px" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Eng Font:</span>
            <input
              type="range"
              min="13"
              max="24"
              value={englishFontSize}
              onChange={(e) => setEnglishFontSize(Number(e.target.value))}
              style={{
                flex: 1,
                cursor: "pointer",
                accentColor: "var(--accent-red)",
                height: "6px",
                borderRadius: "3px",
              }}
            />
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>
              {englishFontSize}px
            </span>
          </div>
        </div>

        {/* Sync Status Badge */}
        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: user ? "#10b981" : "#d4af37" }} />
          {user ? "Synced to cloud profile" : "Guest Mode (Local storage)"}
        </div>
      </div>

      {/* Main Grid: Collections Sidebar + Hadith List */}
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "2rem", alignItems: "start" }} className="hadith-grid-layout">
        
        {/* Sidebar: Collections list */}
        <aside style={{ display: "flex", flexDirection: "column", gap: "1rem" }} className="hadith-sidebar">
          <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text-muted)", textTransform: "uppercase", paddingLeft: "0.5rem" }}>
            Collections
          </div>
          <button
            onClick={() => setActiveCollection("all")}
            className="glass-card"
            style={{
              padding: "1rem 1.25rem",
              textAlign: "left",
              cursor: "pointer",
              borderRadius: "var(--radius-md)",
              border: activeCollection === "all" ? "2px solid var(--accent-gold)" : "1px solid var(--border-color)",
              background: activeCollection === "all" ? "rgba(212, 175, 55, 0.08)" : "var(--glass-bg)",
              fontWeight: activeCollection === "all" ? 600 : 500,
              color: activeCollection === "all" ? "var(--text-primary)" : "var(--text-secondary)",
              transition: "var(--transition-fast)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
            }}
          >
            <span>⭐ Curated Highlights</span>
            <span style={{ fontSize: "0.75rem", color: "var(--accent-gold)" }}>Featured</span>
          </button>

          {COLLECTIONS.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCollection(c.id)}
              className="glass-card"
              style={{
                padding: "1rem 1.25rem",
                textAlign: "left",
                cursor: "pointer",
                borderRadius: "var(--radius-md)",
                border: activeCollection === c.id ? "2px solid var(--accent-red)" : "1px solid var(--border-color)",
                background: activeCollection === c.id ? "rgba(220, 38, 38, 0.05)" : "var(--glass-bg)",
                fontWeight: activeCollection === c.id ? 600 : 500,
                color: activeCollection === c.id ? "var(--text-primary)" : "var(--text-secondary)",
                transition: "var(--transition-fast)",
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
                width: "100%",
              }}
            >
              <span style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                <span>{c.name}</span>
                {hadithCache[c.id] && <span style={{ fontSize: "0.65rem", color: "#10b981" }}>✓ Cached</span>}
              </span>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{c.size}</span>
            </button>
          ))}
        </aside>

        {/* Content Area */}
        <main style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="hadith-content">
          
          {/* Controls Bar: Search, Grade, Bookmarks toggle */}
          <div
            className="glass-card"
            style={{
              padding: "1.25rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-color)",
              display: "flex",
              gap: "1rem",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {/* Search Input */}
            <div style={{ flex: 2, minWidth: "220px", position: "relative" }}>
              <input
                type="text"
                placeholder="Search Hadith by keyword, number, topic..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "rgba(255, 255, 255, 0.15)",
                  color: "var(--text-primary)",
                  fontSize: "0.95rem",
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    cursor: "pointer",
                    fontSize: "1rem",
                    color: "var(--text-muted)",
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Authenticity Grade Filter */}
            <div style={{ flex: 1, minWidth: "150px" }}>
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "rgba(255, 255, 255, 0.15)",
                  color: "var(--text-primary)",
                  fontSize: "0.95rem",
                  cursor: "pointer",
                }}
              >
                <option value="all">🔍 All Authenticity Grades</option>
                <option value="sahih">🟢 Sahih (Authentic)</option>
                <option value="hasan">🟡 Hasan (Good)</option>
                <option value="da'if">🟠 Da'if (Weak)</option>
                <option value="mawdu'">🔴 Mawdu' (Fabricated)</option>
              </select>
            </div>

            {/* Bookmarks Toggle button */}
            <button
              onClick={() => setShowBookmarksOnly(!showBookmarksOnly)}
              className="btn"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.75rem 1.25rem",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-color)",
                background: showBookmarksOnly ? "var(--accent-red)" : "transparent",
                color: showBookmarksOnly ? "#ffffff" : "var(--text-primary)",
                fontWeight: 600,
                cursor: "pointer",
                transition: "var(--transition-fast)",
              }}
            >
              <span>{showBookmarksOnly ? "🔖 Showing Bookmarks" : "🔖 Bookmarks Only"}</span>
              {bookmarks.length > 0 && (
                <span
                  style={{
                    backgroundColor: showBookmarksOnly ? "#ffffff" : "var(--accent-red)",
                    color: showBookmarksOnly ? "var(--accent-red)" : "#ffffff",
                    fontSize: "0.75rem",
                    padding: "0.1rem 0.4rem",
                    borderRadius: "10px",
                    fontWeight: 700,
                  }}
                >
                  {bookmarks.length}
                </span>
              )}
            </button>
          </div>

          {/* Loader/States */}
          {loading && (
            <div
              className="glass-card"
              style={{
                padding: "4rem",
                textAlign: "center",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-color)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "1rem",
              }}
            >
              <div className="loader" style={{ fontSize: "2rem" }}>🌀</div>
              <div style={{ fontWeight: 600 }}>Downloading {activeCollection.toUpperCase()} Collection...</div>
              <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                This is a one-time download and will be cached for instant access.
              </div>
            </div>
          )}

          {apiError && !loading && (
            <div
              className="glass-card"
              style={{
                padding: "3rem 2rem",
                textAlign: "center",
                borderRadius: "var(--radius-md)",
                border: "1px solid rgba(220,38,38,0.2)",
                color: "var(--accent-red)",
                backgroundColor: "rgba(220,38,38,0.02)",
              }}
            >
              <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⚠️</div>
              <h3 style={{ marginBottom: "0.5rem" }}>Network Connection Issue</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", marginBottom: "1.5rem" }}>
                {apiError}
              </p>
              <button
                onClick={() => {
                  // Bug#12 fix: use retryKey increment instead of setTimeout hack
                  setRetryKey((k) => k + 1);
                }}
                className="btn btn-primary"
                style={{ padding: "0.5rem 1.5rem" }}
              >
                Try Reconnecting
              </button>
            </div>
          )}

          {/* Background loading of Arabic text loader indicator */}
          {loadingArabic && (
            <div
              style={{
                fontSize: "0.8rem",
                color: "var(--accent-gold)",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 1rem",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "rgba(212, 175, 55, 0.05)",
                border: "1px solid rgba(212, 175, 55, 0.15)",
              }}
            >
              <span>⏳ Loading corresponding Arabic texts in the background...</span>
            </div>
          )}

          {/* List display */}
          {!loading && !apiError && (
            <>
              {displayedHadiths.length > 0 ? (
                displayedHadiths.map((hadith) => {
                  const isBookmarked = bookmarks.includes(hadith.id);
                  return (
                    <article
                      key={hadith.id}
                      className="glass-card"
                      style={{
                        padding: "2rem 2.25rem",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-color)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "1.5rem",
                        transition: "var(--transition-smooth)",
                        position: "relative",
                      }}
                    >
                      {/* Card Header metadata */}
                      <header
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: "1rem",
                          borderBottom: "1px solid var(--border-color)",
                          paddingBottom: "1rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                          <span style={{ fontWeight: 700, fontSize: "1.1rem", textTransform: "capitalize", color: "var(--text-primary)" }}>
                            {hadith.collection === "bukhari" || hadith.collection === "muslim" ? "Sahih " : ""}
                            {hadith.collection} • Hadith #{hadith.hadithNumber}
                          </span>
                          <span style={{ fontSize: "0.825rem", color: "var(--text-muted)" }}>
                            Chapter: <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{hadith.chapterName}</span>
                          </span>
                        </div>

                        {/* Badges and Actions */}
                        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                          {/* Grading Badge */}
                          <div
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              padding: "0.25rem 0.65rem",
                              borderRadius: "20px",
                              backgroundColor: `${getGradeColor(hadith.grade)}20`,
                              border: `1px solid ${getGradeColor(hadith.grade)}35`,
                              color: getGradeColor(hadith.grade),
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                            }}
                            title={`Graded by ${hadith.gradedBy || "scholars"}`}
                          >
                            {hadith.grade}
                          </div>

                          {/* Bookmark trigger button */}
                          <button
                            onClick={() => toggleBookmark(hadith.id)}
                            style={{
                              background: "none",
                              cursor: "pointer",
                              fontSize: "1.3rem",
                              padding: "0.25rem",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: isBookmarked ? "var(--accent-red)" : "var(--text-muted)",
                              transition: "transform 0.15s ease",
                            }}
                            className="bookmark-btn"
                            title={isBookmarked ? "Remove Bookmark" : "Add Bookmark"}
                          >
                            {isBookmarked ? "🔖" : "📑"}
                          </button>

                          {/* Share button */}
                          <button
                            onClick={() => handleShare(hadith)}
                            style={{
                              background: "none",
                              cursor: "pointer",
                              fontSize: "1.15rem",
                              padding: "0.25rem",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "var(--text-muted)",
                            }}
                            title="Share Hadith"
                          >
                            🔗
                          </button>
                        </div>
                      </header>

                      {/* Arabic Content (Right-aligned, large font) */}
                      {hadith.arabicText && (
                        <div
                          dir="rtl"
                          className="hadith-arabic-text"
                          style={{
                            fontFamily: "Amiri, 'Traditional Arabic', 'Noto Naskh Arabic', serif",
                            fontSize: `${arabicFontSize}px`,
                            lineHeight: 1.8,
                            color: "var(--text-primary)",
                            textAlign: "justify",
                            padding: "0.5rem 0 1rem 0",
                            wordSpacing: "0.05em",
                          }}
                        >
                          {hadith.arabicText}
                        </div>
                      )}

                      {/* English Content */}
                      <div
                        style={{
                          fontSize: `${englishFontSize}px`,
                          lineHeight: 1.65,
                          color: "var(--text-secondary)",
                          textAlign: "justify",
                        }}
                      >
                        {hadith.englishText}
                      </div>

                      {/* Card Footer */}
                      <footer
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          alignItems: "center",
                          fontSize: "0.775rem",
                          color: "var(--text-muted)",
                          borderTop: "1px dotted var(--border-color)",
                          paddingTop: "0.75rem",
                        }}
                      >
                        <span>Grading Source: {hadith.gradedBy || "Universal consensus"}</span>
                      </footer>
                    </article>
                  );
                })
              ) : (
                <div
                  className="glass-card"
                  style={{
                    padding: "5rem 2rem",
                    textAlign: "center",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔍</div>
                  <h3 style={{ marginBottom: "0.5rem" }}>No Hadiths Found</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
                    We couldn't find any Hadiths matching your current filters or search query. 
                    Try adjusting your criteria or switching collections.
                  </p>
                </div>
              )}

              {/* Load More Button */}
              {filteredHadiths.length > pageSize && (
                <div style={{ display: "flex", justifyContent: "center", marginTop: "1rem" }}>
                  <button
                    onClick={() => setPageSize((prev) => prev + 10)}
                    className="btn btn-primary"
                    style={{ padding: "0.85rem 2.5rem", borderRadius: "var(--radius-sm)", fontWeight: 600 }}
                  >
                    Load More Hadiths ({filteredHadiths.length - pageSize} remaining)
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Floating Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          style={{
            position: "fixed",
            bottom: "30px",
            right: "30px",
            width: "50px",
            height: "50px",
            borderRadius: "50%",
            backgroundColor: "var(--accent-red)",
            color: "#ffffff",
            border: "none",
            cursor: "pointer",
            fontSize: "1.25rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            zIndex: 100,
            transition: "all 0.2s ease",
          }}
          title="Back to Top"
        >
          ▲
        </button>
      )}

      {/* Embedded CSS custom class styles for responsiveness */}
      {/* Bug#9 fix: style jsx/style jsx global not supported in Next.js App Router — use plain <style> */}
      <style>{`
        @media (max-width: 820px) {
          .hadith-grid-layout {
            grid-template-columns: 1fr !important;
          }
          .hadith-sidebar {
            flex-direction: row !important;
            flex-wrap: wrap !important;
            overflow-x: auto;
            padding-bottom: 0.5rem;
          }
          .hadith-sidebar button {
            width: auto !important;
            flex: 1 1 180px;
          }
          .hadith-content {
            min-width: 0;
          }
        }
        .bookmark-btn:hover {
          transform: scale(1.2);
        }
      `}</style>
    </div>
  );
}
