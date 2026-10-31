"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { ReportContentButton } from "../../components/ReportContentModal";
import localHisnChapters from "../../data/hisn-almuslim.json";
import localAdhkarData from "../../data/adhkar.json";
import { useApp } from "../../context/AppContext";
import {
  getUserCollections,
  saveCollection,
  deleteCollection,
  addItemToCollection,
  removeItemFromCollection,
  getAdhkarReaderPreferences,
  saveAdhkarReaderPreferences,
  AdhkarCollection,
  CustomAdhkarItem,
} from "../../lib/user-adhkar-collections";

type CustomDuaItem = CustomAdhkarItem;
type UserCollection = AdhkarCollection;

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
  audio?: string;
}

interface HisnItem {
  id: number;
  arabic: string;
  transliteration: string;
  translation: string;
  count: number;
  audio?: string;
}

interface HisnChapter {
  id: number;
  title: string;
  category: string;
  audioUrl?: string;
  items: HisnItem[];
}


const HISN_CATEGORIES = [
  "All",
  "Weather & Nature",
  "Daily Routine",
  "Sleep & Waking",
  "Prayer & Mosque",
  "Emotions & Hardship",
  "Food & Fasting",
  "Travel & Journey",
  "Health & Loss",
  "Praise & Remembrance",
] as const;

const STORAGE_KEY_COLLECTIONS = "@web_user_adhkar_collections_v1";
const STORAGE_KEY_ACTIVE_TAB = "@web_adhkar_active_tab_v1";

function getDefaultAdhkarTab(): "morning" | "evening" {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const isEveningWindow = hour > 15 || (hour === 15 && minute >= 30) || hour >= 16;
  return isEveningWindow ? "evening" : "morning";
}

export default function AdhkarReader() {
  const { user } = useApp();
  const [adhkar, setAdhkar] = useState<Supplication[]>(localAdhkarData as Supplication[]);
  const [activeTab, setActiveTab] = useState<"morning" | "evening" | "hisn" | "collections">(() => {
    if (typeof window === "undefined") return "morning";
    const saved = window.localStorage.getItem(STORAGE_KEY_ACTIVE_TAB);
    if (saved === "morning" || saved === "evening") return saved;
    return getDefaultAdhkarTab();
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Counters State
  const STORAGE_KEY_COUNTS = "@web_adhkar_counts_v1";
  const [counts, setCounts] = useState<{ [key: string]: number }>({});
  const [isConfirmReset, setIsConfirmReset] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_COUNTS);
      if (stored) setCounts(JSON.parse(stored));
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_COUNTS, JSON.stringify(counts));
    } catch {
      // no-op
    }
  }, [counts]);

  useEffect(() => {
    if (activeTab === "morning" || activeTab === "evening") {
      try {
        localStorage.setItem(STORAGE_KEY_ACTIVE_TAB, activeTab);
      } catch {
        // no-op
      }
    }
  }, [activeTab]);

  // Reader Customization State
  const [fontSizeArabic, setFontSizeArabic] = useState(30);
  const [fontSizeTranslation, setFontSizeTranslation] = useState(15);
  const [showTranslation, setShowTranslation] = useState(true);
  const [showTransliteration, setShowTransliteration] = useState(true);
  const [readerTheme, setReaderTheme] = useState<"light" | "sepia" | "dark">("light");
  const [showSettings, setShowSettings] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const hasLoadedAdhkarPrefs = useRef(false);

  useEffect(() => {
    let isMounted = true;
    getAdhkarReaderPreferences(user?.uid)
      .then((prefs) => {
        if (!isMounted || !prefs) return;
        if (prefs.readerTheme) setReaderTheme(prefs.readerTheme);
        if (typeof prefs.fontSizeArabic === "number") setFontSizeArabic(prefs.fontSizeArabic);
        if (typeof prefs.fontSizeTranslation === "number") setFontSizeTranslation(prefs.fontSizeTranslation);
        if (typeof prefs.showTranslation === "boolean") setShowTranslation(prefs.showTranslation);
        if (typeof prefs.showTransliteration === "boolean") setShowTransliteration(prefs.showTransliteration);
        hasLoadedAdhkarPrefs.current = true;
      })
      .catch(() => {
        hasLoadedAdhkarPrefs.current = true;
      });

    return () => {
      isMounted = false;
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!hasLoadedAdhkarPrefs.current) return;
    saveAdhkarReaderPreferences(
      {
        readerTheme,
        fontSizeArabic,
        fontSizeTranslation,
        showTranslation,
        showTransliteration,
      },
      user?.uid
    ).catch(() => {});
  }, [readerTheme, fontSizeArabic, fontSizeTranslation, showTranslation, showTransliteration, user?.uid]);

  // Hisn al-Muslim State
  const [hisnChapters, setHisnChapters] = useState<HisnChapter[]>(localHisnChapters as HisnChapter[]);
  const [hisnSearch, setHisnSearch] = useState("");
  const [selectedHisnCategory, setSelectedHisnCategory] = useState<string>("All");
  const [activeHisnChapter, setActiveHisnChapter] = useState<HisnChapter | null>(null);

  // Custom Collections State
  const [collections, setCollections] = useState<UserCollection[]>([]);
  const [activeCollection, setActiveCollection] = useState<UserCollection | null>(null);
  const [showNewCollectionModal, setShowNewCollectionModal] = useState(false);
  const [newColTitle, setNewColTitle] = useState("");
  const [newColDesc, setNewColDesc] = useState("");

  // Add-to-Collection Modal State (for saving items from daily/hisn)
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [itemToSave, setItemToSave] = useState<CustomDuaItem | null>(null);

  // Custom Dua Creator Modal State
  const [customDuaModalVisible, setCustomDuaModalVisible] = useState(false);
  const [duaTitle, setDuaTitle] = useState("");
  const [duaArabic, setDuaArabic] = useState("");
  const [duaTransliteration, setDuaTransliteration] = useState("");
  const [duaTranslation, setDuaTranslation] = useState("");
  const [duaCount, setDuaCount] = useState(1);
  const [duaNotes, setDuaNotes] = useState("");
  const [targetColIdForDua, setTargetColIdForDua] = useState<string>("");

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

  // Load User Collections from Firestore (with LocalStorage cache/guest fallback)
  useEffect(() => {
    let isMounted = true;
    getUserCollections(user?.uid)
      .then((cols) => {
        if (isMounted) {
          setCollections(cols);
        }
      })
      .catch((e) => console.warn("Error loading user collections:", e));

    return () => {
      isMounted = false;
    };
  }, [user?.uid]);


  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleShare = async () => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");
    const shareData = {
      title: "Daily Adhkar & Hisn al-Muslim - Noor Library",
      text: "Read morning, evening and Hisn al-Muslim supplications with interactive counters on Noor Library.",
      url: `${baseUrl}/adhkaar`,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // cancelled
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareData.url);
        alert("Adhkar page link copied to clipboard!");
      } catch (err) {
        // clipboard failed
      }
    }
  };

  // Web Audio Playback state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isContinuousAudio, setIsContinuousAudio] = useState(false);
  const [activeAudioTitle, setActiveAudioTitle] = useState<string>("");

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingKey(null);
    setIsAudioPlaying(false);
  }, []);

  const togglePlayAudio = useCallback(
    (key: string, url: string, title?: string, onEnded?: () => void) => {
      if (!url) {
        alert("Audio recitation is not available for this supplication.");
        return;
      }

      if (playingKey === key && audioRef.current) {
        if (audioRef.current.paused) {
          audioRef.current
            .play()
            .then(() => setIsAudioPlaying(true))
            .catch(console.error);
        } else {
          audioRef.current.pause();
          setIsAudioPlaying(false);
        }
        return;
      }

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const audio = new Audio(url);
      audioRef.current = audio;
      setPlayingKey(key);
      setActiveAudioTitle(title || "Supplication Recitation");
      setIsAudioPlaying(true);

      audio.onplay = () => setIsAudioPlaying(true);
      audio.onpause = () => setIsAudioPlaying(false);
      audio.onended = () => {
        setIsAudioPlaying(false);
        if (onEnded) {
          onEnded();
        } else {
          setPlayingKey(null);
        }
      };
      audio.onerror = () => {
        setIsAudioPlaying(false);
        setPlayingKey(null);
      };

      audio.play().catch((err) => {
        console.error("Audio playback error:", err);
        setIsAudioPlaying(false);
      });
    },
    [playingKey]
  );

  // 1. Fetch Adhkar and auto-detect time of day on mount
  useEffect(() => {
    async function fetchData() {
      try {
        const [adhkarRes, hisnRes] = await Promise.all([
          fetch("/api/read/adhkar"),
          fetch("/api/read/hisn"),
        ]);

        if (adhkarRes.ok) {
          const data = await adhkarRes.json();
          if (Array.isArray(data) && data.length > 0) {
            const merged = data.map((item: any) => {
              const local = (localAdhkarData as any[]).find((l) => l.order === item.order);
              return {
                ...item,
                transliteration: item.transliteration || local?.transliteration || '',
                audio: item.audio || local?.audio || '',
              };
            });
            setAdhkar(merged);
          }
        }
        if (hisnRes.ok) {
          const hisnData = await hisnRes.json();
          setHisnChapters(hisnData);
        }

        // Respect the user's already-selected tab. Only auto-default once when no saved preference exists.
        const savedTab = localStorage.getItem(STORAGE_KEY_ACTIVE_TAB);
        if (!savedTab || (savedTab !== "morning" && savedTab !== "evening")) {
          setActiveTab(getDefaultAdhkarTab());
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // 2. Filter supplications based on activeTab
  const filteredAdhkar = adhkar.filter((item) => {
    if (activeTab === "morning") {
      return item.type === 0 || item.type === 1;
    } else {
      return item.type === 0 || item.type === 2;
    }
  });

  const handleDailyAudioEnded = useCallback(
    (currentOrder: number) => {
      if (!isContinuousAudio) {
        setPlayingKey(null);
        setIsAudioPlaying(false);
        return;
      }

      const currentIndex = filteredAdhkar.findIndex((it) => it.order === currentOrder);
      if (currentIndex !== -1) {
        const nextItem = filteredAdhkar.slice(currentIndex + 1).find((it) => !!it.audio);
        if (nextItem && nextItem.audio) {
          togglePlayAudio(
            `daily-${nextItem.order}`,
            nextItem.audio,
            `Supplication #${nextItem.order} (${nextItem.source || "Adhkar"})`,
            () => handleDailyAudioEnded(nextItem.order)
          );
        } else {
          setPlayingKey(null);
          setIsAudioPlaying(false);
        }
      }
    },
    [isContinuousAudio, filteredAdhkar, togglePlayAudio]
  );

  const togglePlayAllDaily = useCallback(() => {
    if (isAudioPlaying && playingKey?.startsWith("daily-")) {
      if (audioRef.current) audioRef.current.pause();
      setIsAudioPlaying(false);
    } else {
      setIsContinuousAudio(true);
      if (playingKey && playingKey.startsWith("daily-") && audioRef.current) {
        audioRef.current.play().then(() => setIsAudioPlaying(true)).catch(console.error);
      } else {
        const first = filteredAdhkar.find((it) => !!it.audio);
        if (first && first.audio) {
          togglePlayAudio(
            `daily-${first.order}`,
            first.audio,
            `Supplication #${first.order} (${first.source || "Adhkar"})`,
            () => handleDailyAudioEnded(first.order)
          );
        }
      }
    }
  }, [isAudioPlaying, playingKey, filteredAdhkar, togglePlayAudio, handleDailyAudioEnded]);

  const handleHisnAudioEnded = useCallback(
    (currentItemId: number) => {
      if (!isContinuousAudio || !activeHisnChapter) {
        setPlayingKey(null);
        setIsAudioPlaying(false);
        return;
      }

      const currentIndex = activeHisnChapter.items.findIndex((it) => it.id === currentItemId);
      if (currentIndex !== -1) {
        const nextItem = activeHisnChapter.items.slice(currentIndex + 1).find((it) => !!it.audio);
        if (nextItem && nextItem.audio) {
          togglePlayAudio(
            `hisn-${activeHisnChapter.id}-${nextItem.id}`,
            nextItem.audio,
            `${activeHisnChapter.title} - Dua #${nextItem.id}`,
            () => handleHisnAudioEnded(nextItem.id)
          );
        } else {
          setPlayingKey(null);
          setIsAudioPlaying(false);
        }
      }
    },
    [isContinuousAudio, activeHisnChapter, togglePlayAudio]
  );

  // Filter Hisn Chapters based on search and category
  const filteredHisn = useMemo(() => {
    const q = hisnSearch.trim().toLowerCase();
    return hisnChapters.filter((ch) => {
      if (selectedHisnCategory !== "All" && ch.category !== selectedHisnCategory) {
        return false;
      }
      if (!q) return true;
      const titleMatch = ch.title.toLowerCase().includes(q);
      const catMatch = ch.category.toLowerCase().includes(q);
      if (titleMatch || catMatch) return true;
      return ch.items.some(
        (it) =>
          it.translation.toLowerCase().includes(q) ||
          it.transliteration.toLowerCase().includes(q) ||
          it.arabic.includes(q)
      );
    });
  }, [hisnChapters, hisnSearch, selectedHisnCategory]);

  // 3. Counter handlers
  const incrementCount = (key: string | number, maxCount: number) => {
    setCounts((prev) => {
      const current = prev[key] || 0;
      if (current >= maxCount) return prev;
      return { ...prev, [key]: current + 1 };
    });
  };

  const handleTabChange = (tab: "morning" | "evening" | "hisn" | "collections") => {
    stopAudio();
    setActiveTab(tab);
    setActiveHisnChapter(null);
    setActiveCollection(null);
  };

  const resetAllCounts = () => {
    setIsConfirmReset(true);
  };

  const confirmReset = () => {
    setCounts({});
    setIsConfirmReset(false);
  };

  // Collection creation
  const handleCreateCollection = async () => {
    if (!newColTitle.trim()) return;
    try {
      const col = await saveCollection(
        newColTitle.trim(),
        newColDesc.trim(),
        undefined,
        undefined,
        undefined,
        [],
        user?.uid
      );
      setCollections((prev) => [col, ...prev.filter((c) => c.id !== col.id)]);
      setNewColTitle("");
      setNewColDesc("");
      setShowNewCollectionModal(false);
    } catch (err) {
      console.warn("Failed to create collection:", err);
    }
  };

  // Delete collection
  const handleDeleteCollection = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this collection?")) {
      try {
        await deleteCollection(id, user?.uid);
        setCollections((prev) => prev.filter((c) => c.id !== id));
        if (activeCollection?.id === id) setActiveCollection(null);
      } catch (err) {
        console.warn("Failed to delete collection:", err);
      }
    }
  };

  // Add Item to Collection from Modal
  const handleSaveItemToCollection = async (collectionId: string) => {
    if (!itemToSave) return;
    try {
      await addItemToCollection(collectionId, itemToSave, user?.uid);
      const updated = await getUserCollections(user?.uid);
      setCollections(updated);
      if (activeCollection && activeCollection.id === collectionId) {
        setActiveCollection(updated.find((c) => c.id === collectionId) || null);
      }
      setSaveModalVisible(false);
      setItemToSave(null);
      alert("Saved to collection! ✨");
    } catch (err) {
      console.warn("Failed to save to collection:", err);
    }
  };

  // Save Custom Typed Dua
  const handleSaveCustomDua = async () => {
    if (!duaTitle.trim() && !duaArabic.trim() && !duaTranslation.trim()) return;
    let targetId = targetColIdForDua;
    let currentCols = [...collections];

    if (!targetId) {
      if (currentCols.length > 0) {
        targetId = currentCols[0].id;
      } else {
        try {
          const defaultCol = await saveCollection(
            "My Personal Duas",
            "Custom supplications",
            undefined,
            undefined,
            undefined,
            [],
            user?.uid
          );
          currentCols = [defaultCol];
          targetId = defaultCol.id;
        } catch (err) {
          console.warn("Failed to create default collection:", err);
          return;
        }
      }
    }

    const newItem: Omit<CustomAdhkarItem, "id"> = {
      title: duaTitle.trim() || "Custom Supplication",
      arabic: duaArabic.trim(),
      transliteration: duaTransliteration.trim(),
      translation: duaTranslation.trim(),
      count: Math.max(1, duaCount),
      fadl: duaNotes.trim(),
      origin: "custom",
    };

    try {
      await addItemToCollection(targetId, newItem, user?.uid);
      const updated = await getUserCollections(user?.uid);
      setCollections(updated);
      if (activeCollection && activeCollection.id === targetId) {
        setActiveCollection(updated.find((c) => c.id === targetId) || null);
      }

      setDuaTitle("");
      setDuaArabic("");
      setDuaTransliteration("");
      setDuaTranslation("");
      setDuaCount(1);
      setDuaNotes("");
      setCustomDuaModalVisible(false);
      alert("Supplication added to collection! ✨");
    } catch (err) {
      console.warn("Failed to add custom dua:", err);
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
        <p style={{ color: "var(--text-secondary)" }}>Loading Remembrances & Hisn al-Muslim...</p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
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
      cardSuccess: "rgba(34, 197, 94, 0.04)",
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
      cardSuccess: "rgba(34, 197, 94, 0.08)",
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
      cardSuccess: "rgba(34, 197, 94, 0.06)",
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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400;1,700&display=swap');
        .adhkar-arabic-text {
          font-family: 'Amiri', serif;
          line-height: 2.2;
          text-align: right;
          direction: rtl;
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
            flexDirection: "column",
            padding: "0.85rem 2rem",
            gap: "0.75rem",
          }}
        >
          {/* Top Row: Back link, Reset, Share on Left | Settings Toggle on Right */}
          <div
            className="top-controls-row"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "0.75rem",
              width: "100%",
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

            {/* Reader Settings Toggle Button */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="btn"
              style={{
                padding: "0.4rem 0.85rem",
                fontSize: "0.85rem",
                fontWeight: 600,
                borderRadius: "var(--radius-md)",
                border: `1px solid ${showSettings ? "var(--accent-gold)" : themeStyles.border}`,
                backgroundColor: showSettings ? "rgba(212, 175, 55, 0.15)" : (themeStyles.verseBg === "transparent" ? "var(--bg-primary)" : themeStyles.verseBg),
                color: showSettings ? "var(--accent-gold)" : themeStyles.text,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                transition: "all 0.2s ease",
              }}
              aria-expanded={showSettings}
              title="Toggle reader customization settings"
            >
              <span>⚙️</span>
              <span>{showSettings ? "Hide Settings" : "Settings"}</span>
              <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>{showSettings ? "▲" : "▼"}</span>
            </button>
          </div>

          {/* Sizing & Visibilities Panel (Expandable on click) */}
          {showSettings && (
            <div
              className="settings-controls-panel"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1.25rem",
                flexWrap: "wrap",
                paddingTop: "0.75rem",
                borderTop: `1px solid ${themeStyles.border}`,
              }}
            >
              {/* Arabic sizing */}
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
                  title="Decrease Arabic font size"
                >
                  A-
                </button>
                <span style={{ fontSize: "0.8rem", fontWeight: 600, minWidth: "32px", textAlign: "center" }}>
                  {fontSizeArabic}px
                </span>
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
                  title="Increase Arabic font size"
                >
                  A+
                </button>
              </div>

              {/* English sizing */}
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
                  title="Decrease English font size"
                >
                  A-
                </button>
                <span style={{ fontSize: "0.8rem", fontWeight: 600, minWidth: "32px", textAlign: "center" }}>
                  {fontSizeTranslation}px
                </span>
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
                  title="Increase English font size"
                >
                  A+
                </button>
              </div>

              {/* Visibility Toggles */}
              <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", cursor: "pointer", fontSize: "0.85rem" }}>
                <input
                  type="checkbox"
                  checked={showTranslation}
                  onChange={() => setShowTranslation(!showTranslation)}
                  style={{ accentColor: "var(--accent-gold)" }}
                />
                Translation
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", cursor: "pointer", fontSize: "0.85rem" }}>
                <input
                  type="checkbox"
                  checked={showTransliteration}
                  onChange={() => setShowTransliteration(!showTransliteration)}
                  style={{ accentColor: "var(--accent-gold)" }}
                />
                Transliteration
              </label>

              {/* Themes */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <span style={{ fontSize: "0.8rem", color: themeStyles.textMuted, marginRight: "0.25rem" }}>Theme:</span>
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
          )}
        </div>
      </section>

      {/* Main Container */}
      <section className="container" style={{ marginTop: "2.5rem" }}>
        {/* Navigation Tabs Bar: Morning | Evening | Hisn al-Muslim | Collections */}
        <div
          className="tabs-container"
          style={{
            background: themeStyles.bg,
            border: `1px solid ${themeStyles.border}`,
            borderRadius: "var(--radius-lg)",
            padding: "0.5rem",
            marginBottom: "2.5rem",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "0.5rem",
          }}
        >
          <button
            onClick={() => handleTabChange("morning")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              padding: "0.85rem 1rem",
              fontSize: "1rem",
              fontFamily: "Outfit",
              fontWeight: 700,
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              background: activeTab === "morning" ? "var(--accent-gold-gradient)" : "transparent",
              color: activeTab === "morning" ? "#000000" : themeStyles.text,
              border: "none",
            }}
          >
            <span>☀️</span> Morning Adhkar
          </button>

          <button
            onClick={() => handleTabChange("evening")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              padding: "0.85rem 1rem",
              fontSize: "1rem",
              fontFamily: "Outfit",
              fontWeight: 700,
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              background: activeTab === "evening" ? "linear-gradient(135deg, #4f46e5 0%, #1e1b4b 100%)" : "transparent",
              color: activeTab === "evening" ? "#ffffff" : themeStyles.text,
              border: "none",
            }}
          >
            <span>🌙</span> Evening Adhkar
          </button>

          <button
            onClick={() => handleTabChange("hisn")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              padding: "0.85rem 1rem",
              fontSize: "1rem",
              fontFamily: "Outfit",
              fontWeight: 700,
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              background: activeTab === "hisn" ? "var(--accent-gold-gradient)" : "transparent",
              color: activeTab === "hisn" ? "#000000" : themeStyles.text,
              border: "none",
            }}
          >
            <span>⚡</span> Hisn al-Muslim (132)
          </button>

          <button
            onClick={() => handleTabChange("collections")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              padding: "0.85rem 1rem",
              fontSize: "1rem",
              fontFamily: "Outfit",
              fontWeight: 700,
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              background: activeTab === "collections" ? "var(--accent-gold-gradient)" : "transparent",
              color: activeTab === "collections" ? "#000000" : themeStyles.text,
              border: "none",
            }}
          >
            <span>🔖</span> My Collections ({collections.length})
          </button>
        </div>

        {/* Reset Confirmation Dialog */}
        {isConfirmReset && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 999,
              backgroundColor: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              className="glass-card"
              style={{
                padding: "2rem",
                borderRadius: "var(--radius-md)",
                maxWidth: "360px",
                width: "90%",
                textAlign: "center",
                border: "1px solid var(--border-color)",
                background: themeStyles.cardBg,
                color: themeStyles.text,
              }}
            >
              <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🔄</div>
              <h3 style={{ marginBottom: "0.5rem" }}>Reset all counters?</h3>
              <p style={{ color: themeStyles.textMuted, fontSize: "0.9rem", marginBottom: "1.5rem" }}>
                This will set all recitation counters back to 0.
              </p>
              <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setIsConfirmReset(false)}
                  style={{ padding: "0.5rem 1.5rem", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={confirmReset}
                  style={{ padding: "0.5rem 1.5rem", cursor: "pointer", backgroundColor: "var(--accent-red)", color: "#fff" }}
                >
                  Yes, Reset
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────── */}
        {/* TAB 1 & 2: MORNING & EVENING DAILY ADHKAR       */}
        {/* ─────────────────────────────────────────────── */}
        {(activeTab === "morning" || activeTab === "evening") && (
          <div>
            <div style={{ textAlign: "center", marginBottom: "2rem" }}>
              <h2 style={{ fontFamily: "Outfit", fontSize: "1.8rem", color: themeStyles.text, marginBottom: "0.5rem" }}>
                {activeTab === "morning" ? "Morning Adhkar" : "Evening Adhkar"}
              </h2>
              <p style={{ color: themeStyles.textMuted, fontSize: "0.95rem" }}>
                {activeTab === "morning"
                  ? "Recited after Fajr prayer until sunrise (5:00 AM – 11:59 AM)."
                  : "Recited after 'Asr prayer until sunset (12:00 PM – 4:59 AM)."}{" "}
                Tap any card to increase recitation counter.
              </p>
            </div>

            {/* Audio Playback Ribbon */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "1rem",
                padding: "1rem 1.5rem",
                borderRadius: "var(--radius-lg)",
                border: isAudioPlaying && playingKey?.startsWith("daily-") ? "1.5px solid var(--accent-gold)" : `1px solid ${themeStyles.border}`,
                background: themeStyles.cardBg,
                marginBottom: "2rem",
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.02)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <button
                  onClick={togglePlayAllDaily}
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: isAudioPlaying && playingKey?.startsWith("daily-") ? "var(--accent-gold-gradient)" : themeStyles.verseBg,
                    color: isAudioPlaying && playingKey?.startsWith("daily-") ? "#000000" : "var(--accent-gold)",
                    border: `1px solid ${themeStyles.border}`,
                    cursor: "pointer",
                    fontSize: "1.1rem",
                    transition: "all 0.2s ease",
                  }}
                  title={isAudioPlaying && playingKey?.startsWith("daily-") ? "Pause Audio" : "Play All Daily Adhkar"}
                >
                  {isAudioPlaying && playingKey?.startsWith("daily-") ? "⏸" : "▶"}
                </button>
                <div>
                  <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: themeStyles.text }}>
                    {isAudioPlaying && playingKey?.startsWith("daily-")
                      ? activeAudioTitle || "Reciting Adhkar..."
                      : `Listen to ${activeTab === "morning" ? "Morning" : "Evening"} Adhkar`}
                  </h4>
                  <p style={{ margin: "2px 0 0 0", fontSize: "0.85rem", color: themeStyles.textMuted }}>
                    {isAudioPlaying && playingKey?.startsWith("daily-")
                      ? isContinuousAudio
                        ? "Continuous playback enabled • Auto-advancing"
                        : "Single recitation playing"
                      : "Sequential authentic Arabic recitation for every supplication"}
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", fontSize: "0.85rem", color: themeStyles.text }}>
                  <input
                    type="checkbox"
                    checked={isContinuousAudio}
                    onChange={(e) => setIsContinuousAudio(e.target.checked)}
                    style={{ accentColor: "var(--accent-gold)" }}
                  />
                  Auto-Advance
                </label>
                {isAudioPlaying && playingKey?.startsWith("daily-") && (
                  <button
                    onClick={stopAudio}
                    className="btn btn-secondary"
                    style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem", cursor: "pointer" }}
                  >
                    ⏹ Stop
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
              {filteredAdhkar.map((item, index) => {
                const currentCount = counts[item.order] || 0;
                const isCompleted = currentCount >= item.count;
                const isThisPlaying = playingKey === `daily-${item.order}` && isAudioPlaying;

                return (
                  <div
                    key={item.order}
                    onClick={() => incrementCount(item.order, item.count)}
                    className="supplication-card"
                    style={{
                      backgroundColor: isCompleted ? themeStyles.cardSuccess : themeStyles.cardBg,
                      border: isThisPlaying
                        ? "2px solid var(--accent-gold)"
                        : isCompleted
                        ? "1.5px solid rgb(34, 197, 94)"
                        : `1px solid ${themeStyles.border}`,
                      borderRadius: "var(--radius-lg)",
                      color: themeStyles.text,
                      boxShadow: isThisPlaying
                        ? "0 0 25px rgba(212, 175, 55, 0.25)"
                        : "0 6px 20px rgba(0, 0, 0, 0.01)",
                      transition: "all 0.3s ease",
                      cursor: isCompleted ? "default" : "pointer",
                      padding: "2rem",
                    }}
                  >
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

                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        {item.audio && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsContinuousAudio(false);
                              togglePlayAudio(
                                `daily-${item.order}`,
                                item.audio!,
                                `Supplication #${item.order} (${item.source || "Adhkar"})`
                              );
                            }}
                            title={isThisPlaying ? "Pause recitation" : "Play recitation"}
                            aria-label={isThisPlaying ? "Pause recitation" : "Play recitation"}
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "var(--radius-sm)",
                              border: isThisPlaying ? "1px solid var(--accent-gold)" : `1px solid ${themeStyles.border}`,
                              background: isThisPlaying ? "var(--accent-gold-gradient)" : themeStyles.verseBg,
                              color: isThisPlaying ? "#000000" : themeStyles.text,
                              cursor: "pointer",
                              fontSize: "1rem",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "all 0.2s ease",
                            }}
                          >
                            <span>{isThisPlaying ? "⏸" : "🔊"}</span>
                          </button>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setItemToSave({
                              id: item.order.toString(),
                              title: `${activeTab === "morning" ? "Morning" : "Evening"} Adhkar #${item.order}`,
                              arabic: item.content,
                              transliteration: item.transliteration,
                              translation: item.translation,
                              count: item.count,
                              fadl: item.fadl,
                              source: item.source,
                            });
                            setSaveModalVisible(true);
                          }}
                          title="Save to Collection"
                          aria-label="Save to Collection"
                          style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "var(--radius-sm)",
                            border: `1px solid ${themeStyles.border}`,
                            background: themeStyles.verseBg,
                            color: themeStyles.text,
                            cursor: "pointer",
                            fontSize: "1rem",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 0.2s ease",
                          }}
                        >
                          <span>🔖</span>
                        </button>

                        <ReportContentButton
                          contentId={`adhkar-${activeTab}-${item.order}`}
                          contentTitle={`${activeTab === "morning" ? "Morning" : "Evening"} Adhkar #${item.order}`}
                          contentType="adhkaar"
                          iconOnly
                          style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "var(--radius-sm)",
                            border: `1px solid ${themeStyles.border}`,
                            background: themeStyles.verseBg,
                            color: themeStyles.text,
                          }}
                        />

                        <div
                          style={{
                            minHeight: "36px",
                            padding: isCompleted ? "0 0.65rem" : "0 0.75rem",
                            borderRadius: "var(--radius-sm)",
                            backgroundColor: isCompleted ? "rgb(34, 197, 94)" : "var(--accent-gold-gradient)",
                            color: isCompleted ? "#ffffff" : "#000000",
                            fontFamily: "Outfit",
                            fontWeight: 700,
                            fontSize: "0.85rem",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "0.35rem",
                          }}
                          title={`Number of times: ${item.count} (${currentCount} completed)`}
                        >
                          {isCompleted ? (
                            <span style={{ fontSize: "1.05rem", fontWeight: 800 }}>✓</span>
                          ) : (
                            <>
                              <span style={{ fontSize: "0.85rem" }}>🔁</span>
                              <span>{currentCount} / {item.count}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {isThisPlaying && (
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "3px 10px",
                          borderRadius: "12px",
                          backgroundColor: "rgba(212, 175, 55, 0.15)",
                          color: "var(--accent-gold)",
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          marginBottom: "0.75rem",
                        }}
                      >
                        <span>🎵</span> Reciting Now...
                      </div>
                    )}

                    <div className="adhkar-arabic-text" style={{ fontSize: `${fontSizeArabic}px`, color: themeStyles.arabic, marginBottom: "0.75rem" }}>
                      {item.content}
                    </div>

                    {showTransliteration && item.transliteration && (
                      <div
                        style={{
                          padding: "0.75rem 1rem",
                          borderRadius: "var(--radius-md)",
                          backgroundColor: readerTheme === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                          borderLeft: "3px solid var(--accent-gold)",
                          marginBottom: "0.75rem",
                        }}
                      >
                        <span style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "var(--accent-gold)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "3px" }}>
                          Transliteration
                        </span>
                        <div style={{ fontSize: `${fontSizeTranslation * 0.95}px`, color: themeStyles.text, fontStyle: "italic", lineHeight: 1.55 }}>
                          {item.transliteration}
                        </div>
                      </div>
                    )}

                    {showTranslation && (
                      <div style={{ fontSize: `${fontSizeTranslation}px`, color: themeStyles.text, lineHeight: 1.6 }}>
                        {item.translation}
                      </div>
                    )}

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
                        }}
                      >
                        <strong style={{ color: themeStyles.text, display: "block", marginBottom: "4px" }}>Virtue:</strong>
                        {item.fadl}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────── */}
        {/* TAB 3: HISN AL-MUSLIM DIRECTORY & READER        */}
        {/* ─────────────────────────────────────────────── */}
        {activeTab === "hisn" && (
          <div>
            {activeHisnChapter ? (
              /* Single Chapter Reader View */
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                  <button
                    onClick={() => setActiveHisnChapter(null)}
                    className="btn btn-secondary"
                    style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem", cursor: "pointer" }}
                  >
                    &larr; Back to Hisn Directory
                  </button>

                  <span style={{ fontSize: "0.9rem", color: themeStyles.textMuted }}>
                    Chapter {activeHisnChapter.id} of 132
                  </span>
                </div>

                <div
                  style={{
                    padding: "1.5rem",
                    borderRadius: "var(--radius-lg)",
                    border: `1px solid ${themeStyles.border}`,
                    background: themeStyles.cardBg,
                    marginBottom: "2rem",
                  }}
                >
                  <span style={{ fontSize: "0.8rem", color: "var(--accent-gold)", fontWeight: 700, textTransform: "uppercase" }}>
                    {activeHisnChapter.category}
                  </span>
                  <h2 style={{ fontSize: "1.6rem", color: themeStyles.text, marginTop: "0.3rem", marginBottom: "0.5rem" }}>
                    {activeHisnChapter.title}
                  </h2>

                  {/* Chapter Audio Recitation Button */}
                  {(activeHisnChapter.audioUrl || activeHisnChapter.items.some((it) => !!it.audio)) && (
                    <button
                      onClick={() => {
                        if (activeHisnChapter.audioUrl) {
                          togglePlayAudio(
                            `hisn-chapter-${activeHisnChapter.id}`,
                            activeHisnChapter.audioUrl!,
                            `${activeHisnChapter.title} (Chapter Recitation)`
                          );
                        } else {
                          const first = activeHisnChapter.items.find((it) => !!it.audio);
                          if (first && first.audio) {
                            setIsContinuousAudio(true);
                            togglePlayAudio(
                              `hisn-${activeHisnChapter.id}-${first.id}`,
                              first.audio,
                              `${activeHisnChapter.title} - Dua #${first.id}`,
                              () => handleHisnAudioEnded(first.id)
                            );
                          }
                        }
                      }}
                      className="btn btn-primary"
                      style={{
                        marginTop: "0.5rem",
                        padding: "0.45rem 1rem",
                        fontSize: "0.85rem",
                        borderRadius: "var(--radius-md)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        cursor: "pointer",
                      }}
                    >
                      <span>
                        {playingKey === `hisn-chapter-${activeHisnChapter.id}` && isAudioPlaying
                          ? "⏸ Pause Chapter Audio"
                          : "▶ Listen to Chapter Recitation"}
                      </span>
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
                  {activeHisnChapter.items.map((item, index) => {
                    const countKey = `hisn-${activeHisnChapter.id}-${item.id}`;
                    const currentCount = counts[countKey] || 0;
                    const isCompleted = currentCount >= item.count;
                    const isThisItemPlaying = playingKey === `hisn-${activeHisnChapter.id}-${item.id}` && isAudioPlaying;

                    return (
                      <div
                        key={item.id}
                        onClick={() => incrementCount(countKey, item.count)}
                        style={{
                          backgroundColor: isCompleted ? themeStyles.cardSuccess : themeStyles.cardBg,
                          border: isThisItemPlaying
                            ? "2px solid var(--accent-gold)"
                            : isCompleted
                            ? "1.5px solid rgb(34, 197, 94)"
                            : `1px solid ${themeStyles.border}`,
                          borderRadius: "var(--radius-lg)",
                          padding: "2rem",
                          cursor: isCompleted ? "default" : "pointer",
                          color: themeStyles.text,
                          boxShadow: isThisItemPlaying
                            ? "0 0 25px rgba(212, 175, 55, 0.25)"
                            : "0 6px 20px rgba(0, 0, 0, 0.01)",
                          transition: "all 0.3s ease",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
                          <span style={{ fontSize: "0.85rem", color: themeStyles.textMuted }}>
                            Supplication #{index + 1}
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            {item.audio && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsContinuousAudio(false);
                                  togglePlayAudio(
                                    `hisn-${activeHisnChapter.id}-${item.id}`,
                                    item.audio!,
                                    `${activeHisnChapter.title} - Dua #${item.id}`
                                  );
                                }}
                                title={isThisItemPlaying ? "Pause recitation" : "Play recitation"}
                                aria-label={isThisItemPlaying ? "Pause recitation" : "Play recitation"}
                                style={{
                                  width: "36px",
                                  height: "36px",
                                  borderRadius: "var(--radius-sm)",
                                  border: isThisItemPlaying ? "1px solid var(--accent-gold)" : `1px solid ${themeStyles.border}`,
                                  background: isThisItemPlaying ? "var(--accent-gold-gradient)" : themeStyles.verseBg,
                                  color: isThisItemPlaying ? "#000000" : themeStyles.text,
                                  cursor: "pointer",
                                  fontSize: "1rem",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  transition: "all 0.2s ease",
                                }}
                              >
                                <span>{isThisItemPlaying ? "⏸" : "🔊"}</span>
                              </button>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setItemToSave({
                                  id: item.id.toString(),
                                  title: activeHisnChapter.title,
                                  arabic: item.arabic,
                                  transliteration: item.transliteration,
                                  translation: item.translation,
                                  count: item.count,
                                  source: `Hisn al-Muslim #${activeHisnChapter.id}`,
                                });
                                setSaveModalVisible(true);
                              }}
                              title="Save to Collection"
                              aria-label="Save to Collection"
                              style={{
                                width: "36px",
                                height: "36px",
                                borderRadius: "var(--radius-sm)",
                                border: `1px solid ${themeStyles.border}`,
                                background: themeStyles.verseBg,
                                color: themeStyles.text,
                                cursor: "pointer",
                                fontSize: "1rem",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "all 0.2s ease",
                              }}
                            >
                              <span>🔖</span>
                            </button>

                            <ReportContentButton
                              contentId={`hisn-${activeHisnChapter.id}-${item.id}`}
                              contentTitle={`${activeHisnChapter.title} - Dua #${item.id}`}
                              contentType="adhkaar"
                              iconOnly
                              style={{
                                width: "36px",
                                height: "36px",
                                borderRadius: "var(--radius-sm)",
                                border: `1px solid ${themeStyles.border}`,
                                background: themeStyles.verseBg,
                                color: themeStyles.text,
                              }}
                            />

                            <div
                              style={{
                                minHeight: "36px",
                                padding: isCompleted ? "0 0.65rem" : "0 0.75rem",
                                borderRadius: "var(--radius-sm)",
                                backgroundColor: isCompleted ? "rgb(34, 197, 94)" : "var(--accent-gold-gradient)",
                                color: isCompleted ? "#ffffff" : "#000000",
                                fontFamily: "Outfit",
                                fontWeight: 700,
                                fontSize: "0.85rem",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "0.35rem",
                              }}
                              title={`Number of times: ${item.count} (${currentCount} completed)`}
                            >
                              {isCompleted ? (
                                <span style={{ fontSize: "1.05rem", fontWeight: 800 }}>✓</span>
                              ) : (
                                <>
                                  <span style={{ fontSize: "0.85rem" }}>🔁</span>
                                  <span>{currentCount} / {item.count}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {isThisItemPlaying && (
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "3px 10px",
                              borderRadius: "12px",
                              backgroundColor: "rgba(212, 175, 55, 0.15)",
                              color: "var(--accent-gold)",
                              fontSize: "0.8rem",
                              fontWeight: 700,
                              marginBottom: "0.75rem",
                            }}
                          >
                            <span>🎵</span> Reciting Now...
                          </div>
                        )}

                        <div className="adhkar-arabic-text" style={{ fontSize: `${fontSizeArabic}px`, color: themeStyles.arabic, marginBottom: "0.75rem" }}>
                          {item.arabic}
                        </div>

                        {showTransliteration && item.transliteration && (
                          <div
                            style={{
                              padding: "0.75rem 1rem",
                              borderRadius: "var(--radius-md)",
                              backgroundColor: readerTheme === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                              borderLeft: "3px solid var(--accent-gold)",
                              marginBottom: "0.75rem",
                            }}
                          >
                            <span style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "var(--accent-gold)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "3px" }}>
                              Transliteration
                            </span>
                            <div style={{ fontSize: `${fontSizeTranslation * 0.95}px`, color: themeStyles.text, fontStyle: "italic", lineHeight: 1.55 }}>
                              {item.transliteration}
                            </div>
                          </div>
                        )}

                        {showTranslation && item.translation && (
                          <div style={{ fontSize: `${fontSizeTranslation}px`, color: themeStyles.text, lineHeight: 1.6 }}>
                            {item.translation}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Searchable Directory View */
              <div>
                <div style={{ textAlign: "center", marginBottom: "2rem" }}>
                  <h2 style={{ fontFamily: "Outfit", fontSize: "1.8rem", color: themeStyles.text, marginBottom: "0.5rem" }}>
                    Fortress of the Muslim (Hisn al-Muslim)
                  </h2>
                  <p style={{ color: themeStyles.textMuted, fontSize: "0.95rem" }}>
                    132 authentic situational supplications. Search for any occasion e.g. thunder, rain, sleep, travel, or distress.
                  </p>
                </div>

                {/* Search Bar */}
                <div style={{ marginBottom: "1.5rem" }}>
                  <input
                    type="text"
                    value={hisnSearch}
                    onChange={(e) => setHisnSearch(e.target.value)}
                    placeholder="Search e.g. thunder, rain, travel, sleeping, fear, mosque, athan..."
                    style={{
                      width: "100%",
                      padding: "0.85rem 1.25rem",
                      borderRadius: "var(--radius-md)",
                      border: `1px solid ${themeStyles.border}`,
                      background: themeStyles.cardBg,
                      color: themeStyles.text,
                      fontSize: "1rem",
                    }}
                  />
                </div>

                {/* Category Pills */}
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "2rem" }}>
                  {HISN_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedHisnCategory(cat)}
                      style={{
                        padding: "0.4rem 0.9rem",
                        borderRadius: "20px",
                        border: selectedHisnCategory === cat ? "1px solid var(--accent-gold)" : `1px solid ${themeStyles.border}`,
                        background: selectedHisnCategory === cat ? "var(--accent-gold-gradient)" : themeStyles.cardBg,
                        color: selectedHisnCategory === cat ? "#000" : themeStyles.text,
                        cursor: "pointer",
                        fontSize: "0.85rem",
                        fontWeight: selectedHisnCategory === cat ? 700 : 500,
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Chapters Grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                    gap: "1.25rem",
                  }}
                >
                  {filteredHisn.map((ch) => (
                    <div
                      key={ch.id}
                      onClick={() => setActiveHisnChapter(ch)}
                      style={{
                        padding: "1.25rem",
                        borderRadius: "var(--radius-md)",
                        border: `1px solid ${themeStyles.border}`,
                        background: themeStyles.cardBg,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.75rem",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent-gold)")}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = themeStyles.border)}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--accent-gold)", fontWeight: 700 }}>
                          #{ch.id} • {ch.category}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: themeStyles.textMuted }}>
                          {ch.items.length} {ch.items.length === 1 ? "item" : "items"}
                        </span>
                      </div>

                      <h4 style={{ fontSize: "1.05rem", color: themeStyles.text, margin: 0 }}>
                        {ch.title}
                      </h4>

                      {ch.items[0]?.arabic && (
                        <p
                          className="adhkar-arabic-text"
                          style={{
                            fontSize: "1rem",
                            color: themeStyles.textMuted,
                            margin: 0,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {ch.items[0].arabic}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────── */}
        {/* TAB 4: MY COLLECTIONS & CUSTOM DUAS             */}
        {/* ─────────────────────────────────────────────── */}
        {activeTab === "collections" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <h2 style={{ fontFamily: "Outfit", fontSize: "1.8rem", color: themeStyles.text, margin: 0 }}>
                  My Adhkar Collections
                </h2>
                <p style={{ color: themeStyles.textMuted, fontSize: "0.95rem", margin: "4px 0 0 0" }}>
                  Create personal collections, pick from system supplications, or type your own custom duas.
                </p>
              </div>

              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  onClick={() => setShowNewCollectionModal(true)}
                  className="btn btn-secondary"
                  style={{ padding: "0.5rem 1rem", fontSize: "0.9rem", cursor: "pointer" }}
                >
                  + New Collection
                </button>
                <button
                  onClick={() => {
                    setTargetColIdForDua(collections[0]?.id || "");
                    setCustomDuaModalVisible(true);
                  }}
                  className="btn btn-primary"
                  style={{ padding: "0.5rem 1rem", fontSize: "0.9rem", cursor: "pointer", backgroundColor: "var(--accent-gold)", color: "#000" }}
                >
                  + Type Custom Dua
                </button>
              </div>
            </div>

            {activeCollection ? (
              /* Active Collection View */
              <div>
                <button
                  onClick={() => setActiveCollection(null)}
                  className="btn btn-secondary"
                  style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem", marginBottom: "1.5rem", cursor: "pointer" }}
                >
                  &larr; Back to Collections List
                </button>

                <div style={{ padding: "1.5rem", borderRadius: "var(--radius-lg)", border: `1px solid ${themeStyles.border}`, background: themeStyles.cardBg, marginBottom: "2rem" }}>
                  <h3 style={{ color: themeStyles.text, margin: 0 }}>{activeCollection.title}</h3>
                  {activeCollection.description && (
                    <p style={{ color: themeStyles.textMuted, margin: "6px 0 0 0", fontSize: "0.9rem" }}>{activeCollection.description}</p>
                  )}
                </div>

                {activeCollection.items.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "3rem", background: themeStyles.cardBg, borderRadius: "var(--radius-md)" }}>
                    <p style={{ color: themeStyles.textMuted }}>No supplications in this collection yet.</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
                    {activeCollection.items.map((item, index) => {
                      const countKey = `col-${activeCollection.id}-${item.id}`;
                      const currentCount = counts[countKey] || 0;
                      const isCompleted = currentCount >= item.count;

                      return (
                        <div
                          key={item.id}
                          onClick={() => incrementCount(countKey, item.count)}
                          style={{
                            backgroundColor: isCompleted ? themeStyles.cardSuccess : themeStyles.cardBg,
                            border: isCompleted ? "1.5px solid rgb(34, 197, 94)" : `1px solid ${themeStyles.border}`,
                            borderRadius: "var(--radius-lg)",
                            padding: "2rem",
                            cursor: isCompleted ? "default" : "pointer",
                            color: themeStyles.text,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
                            <h4 style={{ margin: 0, fontSize: "1.05rem" }}>{item.title}</h4>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    await removeItemFromCollection(activeCollection.id, item.id, user?.uid);
                                    const updated = await getUserCollections(user?.uid);
                                    setCollections(updated);
                                    if (activeCollection) {
                                      setActiveCollection(updated.find((c) => c.id === activeCollection.id) || null);
                                    }
                                  } catch (err) {
                                    console.warn("Failed to remove item from collection:", err);
                                  }
                                }}
                                title="Remove from collection"
                                aria-label="Remove from collection"
                                style={{
                                  width: "36px",
                                  height: "36px",
                                  borderRadius: "var(--radius-sm)",
                                  border: `1px solid ${themeStyles.border}`,
                                  background: themeStyles.verseBg,
                                  color: "var(--accent-red)",
                                  cursor: "pointer",
                                  fontSize: "0.95rem",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  transition: "all 0.2s ease",
                                }}
                              >
                                <span>🗑️</span>
                              </button>

                              <div
                                style={{
                                  minHeight: "36px",
                                  padding: isCompleted ? "0 0.65rem" : "0 0.75rem",
                                  borderRadius: "var(--radius-sm)",
                                  backgroundColor: isCompleted ? "rgb(34, 197, 94)" : "var(--accent-gold-gradient)",
                                  color: isCompleted ? "#ffffff" : "#000000",
                                  fontFamily: "Outfit",
                                  fontWeight: 700,
                                  fontSize: "0.85rem",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: "0.35rem",
                                }}
                                title={`Number of times: ${item.count} (${currentCount} completed)`}
                              >
                                {isCompleted ? (
                                  <span style={{ fontSize: "1.05rem", fontWeight: 800 }}>✓</span>
                                ) : (
                                  <>
                                    <span style={{ fontSize: "0.85rem" }}>🔁</span>
                                    <span>{currentCount} / {item.count}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {item.arabic && (
                            <div className="adhkar-arabic-text" style={{ fontSize: `${fontSizeArabic}px`, color: themeStyles.arabic, marginBottom: "0.75rem" }}>
                              {item.arabic}
                            </div>
                          )}

                          {item.transliteration && (
                            <div style={{ fontSize: `${fontSizeTranslation * 0.95}px`, color: "var(--accent-gold)", fontStyle: "italic", marginBottom: "0.5rem" }}>
                              {item.transliteration}
                            </div>
                          )}

                          {item.translation && (
                            <div style={{ fontSize: `${fontSizeTranslation}px`, color: themeStyles.text, lineHeight: 1.6 }}>
                              "{item.translation}"
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Collections List View */
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.5rem" }}>
                {collections.length === 0 ? (
                  <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "4rem", background: themeStyles.cardBg, borderRadius: "var(--radius-md)" }}>
                    <p style={{ color: themeStyles.textMuted, marginBottom: "1rem" }}>You haven't created any collections yet.</p>
                    <button
                      onClick={() => setShowNewCollectionModal(true)}
                      className="btn btn-primary"
                      style={{ padding: "0.6rem 1.25rem", cursor: "pointer", backgroundColor: "var(--accent-gold)", color: "#000" }}
                    >
                      Create First Collection
                    </button>
                  </div>
                ) : (
                  collections.map((col) => (
                    <div
                      key={col.id}
                      onClick={() => setActiveCollection(col)}
                      style={{
                        padding: "1.5rem",
                        borderRadius: "var(--radius-md)",
                        border: `1px solid ${themeStyles.border}`,
                        background: themeStyles.cardBg,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                        <h4 style={{ margin: 0, color: themeStyles.text, fontSize: "1.1rem" }}>{col.title}</h4>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCollection(col.id);
                          }}
                          style={{ background: "none", border: "none", color: "var(--accent-red)", cursor: "pointer" }}
                        >
                          ✕
                        </button>
                      </div>
                      <p style={{ color: themeStyles.textMuted, fontSize: "0.85rem", margin: "0 0 1rem 0" }}>
                        {col.description || "Personal collection"}
                      </p>
                      <span style={{ fontSize: "0.8rem", color: "var(--accent-gold)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                        <span>{col.items.length} supplications</span>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14" />
                          <path d="m12 5 7 7-7 7" />
                        </svg>
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────── */}
        {/* MODAL: Save to Collection (from Daily or Hisn)  */}
        {/* ─────────────────────────────────────────────── */}
        {saveModalVisible && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1000,
              backgroundColor: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                background: themeStyles.cardBg,
                padding: "2rem",
                borderRadius: "var(--radius-lg)",
                maxWidth: "420px",
                width: "90%",
                border: `1px solid ${themeStyles.border}`,
              }}
            >
              <h3 style={{ margin: "0 0 0.5rem 0", color: themeStyles.text }}>Save to Collection</h3>
              <p style={{ color: themeStyles.textMuted, fontSize: "0.85rem", marginBottom: "1.5rem" }}>
                Select the collection you want to add this supplication to:
              </p>

              {collections.length === 0 ? (
                <div>
                  <p style={{ color: themeStyles.textMuted, fontSize: "0.9rem" }}>No collections created yet.</p>
                  <button
                    onClick={() => {
                      setSaveModalVisible(false);
                      setShowNewCollectionModal(true);
                    }}
                    className="btn btn-primary"
                    style={{ padding: "0.5rem 1rem", backgroundColor: "var(--accent-gold)", color: "#000", cursor: "pointer", width: "100%" }}
                  >
                    Create a Collection
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "250px", overflowY: "auto", marginBottom: "1.5rem" }}>
                  {collections.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleSaveItemToCollection(c.id)}
                      style={{
                        padding: "0.85rem",
                        borderRadius: "var(--radius-md)",
                        border: `1px solid ${themeStyles.border}`,
                        background: themeStyles.verseBg,
                        color: themeStyles.text,
                        cursor: "pointer",
                        textAlign: "left",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span>{c.title}</span>
                      <span style={{ fontSize: "0.8rem", color: themeStyles.textMuted }}>{c.items.length} items</span>
                    </button>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setSaveModalVisible(false)}
                  className="btn btn-secondary"
                  style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────── */}
        {/* MODAL: New Collection Form                      */}
        {/* ─────────────────────────────────────────────── */}
        {showNewCollectionModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1000,
              backgroundColor: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                background: themeStyles.cardBg,
                padding: "2rem",
                borderRadius: "var(--radius-lg)",
                maxWidth: "420px",
                width: "90%",
                border: `1px solid ${themeStyles.border}`,
              }}
            >
              <h3 style={{ margin: "0 0 1rem 0", color: themeStyles.text }}>New Collection</h3>
              <input
                type="text"
                placeholder="Collection Title (e.g. Before Exam, My Shifa Duas)..."
                value={newColTitle}
                onChange={(e) => setNewColTitle(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  borderRadius: "var(--radius-sm)",
                  border: `1px solid ${themeStyles.border}`,
                  background: themeStyles.verseBg,
                  color: themeStyles.text,
                  marginBottom: "1rem",
                }}
              />
              <textarea
                placeholder="Description / Intention (optional)..."
                value={newColDesc}
                onChange={(e) => setNewColDesc(e.target.value)}
                rows={3}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  borderRadius: "var(--radius-sm)",
                  border: `1px solid ${themeStyles.border}`,
                  background: themeStyles.verseBg,
                  color: themeStyles.text,
                  marginBottom: "1.5rem",
                }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  onClick={() => setShowNewCollectionModal(false)}
                  className="btn btn-secondary"
                  style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateCollection}
                  className="btn btn-primary"
                  style={{ padding: "0.5rem 1.25rem", cursor: "pointer", backgroundColor: "var(--accent-gold)", color: "#000" }}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────── */}
        {/* MODAL: Custom Dua Creator                       */}
        {/* ─────────────────────────────────────────────── */}
        {customDuaModalVisible && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1000,
              backgroundColor: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                background: themeStyles.cardBg,
                padding: "2rem",
                borderRadius: "var(--radius-lg)",
                maxWidth: "480px",
                width: "90%",
                border: `1px solid ${themeStyles.border}`,
                maxHeight: "85vh",
                overflowY: "auto",
              }}
            >
              <h3 style={{ margin: "0 0 1rem 0", color: themeStyles.text }}>Type Custom Supplication</h3>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: themeStyles.textMuted, marginBottom: "4px" }}>
                  Title / Occasion:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dua for my Parents, Istighfar 100x..."
                  value={duaTitle}
                  onChange={(e) => setDuaTitle(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.65rem",
                    borderRadius: "var(--radius-sm)",
                    border: `1px solid ${themeStyles.border}`,
                    background: themeStyles.verseBg,
                    color: themeStyles.text,
                  }}
                />
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: themeStyles.textMuted, marginBottom: "4px" }}>
                  Arabic Text (Optional):
                </label>
                <textarea
                  className="adhkar-arabic-text"
                  placeholder="اكتب الدعاء باللغة العربية..."
                  value={duaArabic}
                  onChange={(e) => setDuaArabic(e.target.value)}
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "0.65rem",
                    borderRadius: "var(--radius-sm)",
                    border: `1px solid ${themeStyles.border}`,
                    background: themeStyles.verseBg,
                    color: themeStyles.text,
                    fontSize: "1.2rem",
                  }}
                />
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: themeStyles.textMuted, marginBottom: "4px" }}>
                  Translation / Meaning:
                </label>
                <textarea
                  placeholder="English meaning or personal prayer..."
                  value={duaTranslation}
                  onChange={(e) => setDuaTranslation(e.target.value)}
                  rows={2}
                  style={{
                    width: "100%",
                    padding: "0.65rem",
                    borderRadius: "var(--radius-sm)",
                    border: `1px solid ${themeStyles.border}`,
                    background: themeStyles.verseBg,
                    color: themeStyles.text,
                  }}
                />
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: themeStyles.textMuted, marginBottom: "4px" }}>
                  Transliteration (Optional):
                </label>
                <input
                  type="text"
                  placeholder="Pronunciation in Latin letters..."
                  value={duaTransliteration}
                  onChange={(e) => setDuaTransliteration(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.65rem",
                    borderRadius: "var(--radius-sm)",
                    border: `1px solid ${themeStyles.border}`,
                    background: themeStyles.verseBg,
                    color: themeStyles.text,
                  }}
                />
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: themeStyles.textMuted, marginBottom: "4px" }}>
                  Target Recitation Count:
                </label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {[1, 3, 7, 33, 100].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setDuaCount(num)}
                      style={{
                        flex: 1,
                        padding: "0.5rem",
                        borderRadius: "var(--radius-sm)",
                        border: duaCount === num ? "2px solid var(--accent-gold)" : `1px solid ${themeStyles.border}`,
                        background: duaCount === num ? "var(--accent-gold-gradient)" : themeStyles.verseBg,
                        color: duaCount === num ? "#000" : themeStyles.text,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {num}x
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  onClick={() => setCustomDuaModalVisible(false)}
                  className="btn btn-secondary"
                  style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCustomDua}
                  className="btn btn-primary"
                  style={{ padding: "0.5rem 1.25rem", cursor: "pointer", backgroundColor: "var(--accent-gold)", color: "#000" }}
                >
                  Save Supplication
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Floating Audio Player Capsule Bar */}
        {playingKey && (
          <div
            style={{
              position: "fixed",
              bottom: "2rem",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 990,
              background: themeStyles.cardBg,
              border: "1.5px solid var(--accent-gold)",
              boxShadow: "0 10px 35px rgba(0, 0, 0, 0.25)",
              borderRadius: "50px",
              padding: "0.6rem 1.4rem",
              display: "flex",
              alignItems: "center",
              gap: "1.2rem",
              maxWidth: "92vw",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ fontSize: "1.3rem" }}>🎵</span>
              <div style={{ maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <strong style={{ fontSize: "0.85rem", color: themeStyles.text, display: "block" }}>
                  {activeAudioTitle || "Adhkar Recitation"}
                </strong>
                <span style={{ fontSize: "0.75rem", color: "var(--accent-gold)" }}>
                  {isAudioPlaying ? (isContinuousAudio ? "Playing • Auto-Advance ON" : "Playing Recitation") : "Paused"}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <button
                onClick={() => {
                  if (audioRef.current) {
                    if (audioRef.current.paused) {
                      audioRef.current.play().then(() => setIsAudioPlaying(true)).catch(console.error);
                    } else {
                      audioRef.current.pause();
                      setIsAudioPlaying(false);
                    }
                  }
                }}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "var(--accent-gold-gradient)",
                  border: "none",
                  color: "#000000",
                  fontSize: "0.95rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontWeight: 700,
                  boxShadow: "0 2px 10px rgba(212, 175, 55, 0.3)",
                }}
                title={isAudioPlaying ? "Pause Audio" : "Resume Audio"}
              >
                {isAudioPlaying ? "⏸" : "▶"}
              </button>
              <button
                onClick={stopAudio}
                style={{
                  background: "transparent",
                  border: "none",
                  color: themeStyles.textMuted,
                  cursor: "pointer",
                  padding: "4px",
                  fontSize: "1.1rem",
                }}
                title="Stop & Close Player"
              >
                ✕
              </button>
            </div>
          </div>
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
              background: readerTheme === "dark" ? "var(--accent-gold-gradient)" : "var(--accent-red-gradient)",
              color: readerTheme === "dark" ? "#000000" : "#ffffff",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 15px rgba(0, 0, 0, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.5rem",
              fontWeight: "bold",
            }}
          >
            ↑
          </button>
        )}
      </section>
    </div>
  );
}
