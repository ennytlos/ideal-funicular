"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  SavedAyahItem,
  QuranReflectionItem,
  MemorizationPlanItem,
  TranslationModuleInfo,
  BookmarkItem,
  QARIS_LIST,
  QariProfile,
  getSurahAudioUrl,
  subscribeAvailableQaris,
  getSavedAyahs,
  deleteSavedAyah,
  getQuranReflections,
  saveQuranReflection,
  deleteQuranReflection,
  getMemorizationPlans,
  saveMemorizationPlan,
  updateMemorizationStatus,
  deleteMemorizationPlan,
  getTranslationModules,
  toggleInstallTranslationModule,
  toggleActiveTranslationModule,
  setActiveTranslationModule,
  saveQuranReaderSettings,
  getActiveQariId,
  setActiveQariId,
  getBookmarks,
  deleteBookmark,
  estimateAyahFromAudioProgress,
} from "../../lib/quran-hub-storage";
import {
  registerWebAudioPause,
  notifyWebAudioStarted,
} from "../../lib/web-audio-coordinator";

export type WebHubTab =
  | "chapters"
  | "bookmarks"
  | "saved"
  | "reflections"
  | "memorize"
  | "audio"
  | "translations"
  | "tajweed";

interface WebQuranNavigationHubProps {
  isOpen: boolean;
  onClose: () => void;
  currentSurahId: number;
  currentSurahName?: string;
  theme?: "light" | "cream" | "sepia" | "green" | "dark";
  userId?: string;
  initialTab?: WebHubTab;
  onJumpToAyah?: (ayahId: number, targetSurahId?: number) => void;
  onSelectQari?: (qariId: string) => void;
  onOpen?: () => void;
  onAudioPlayingChange?: (isPlaying: boolean) => void;
  selectedTranslationLang?: "en" | "yoruba" | "hausa" | "igbo";
  onSelectTranslationLang?: (lang: "en" | "yoruba" | "hausa" | "igbo") => void;
}

// Module-level persistent audio instance for continuous playback across navigation
let globalSurahAudio: HTMLAudioElement | null = null;
let globalSurahAudioUrl = "";
let globalSurahId = 1;

export default function WebQuranNavigationHub({
  isOpen,
  onClose,
  onOpen,
  onAudioPlayingChange,
  currentSurahId,
  currentSurahName = "Current Chapter",
  theme = "cream",
  userId,
  initialTab = "reflections",
  onJumpToAyah,
  onSelectQari,
  selectedTranslationLang,
  onSelectTranslationLang,
}: WebQuranNavigationHubProps) {
  const [activeTab, setActiveTab] = useState<WebHubTab>(initialTab);

  // Sync tab when opened
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);
  const [savedAyahs, setSavedAyahs] = useState<SavedAyahItem[]>([]);
  const [reflections, setReflections] = useState<QuranReflectionItem[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [memorizationPlans, setMemorizationPlans] = useState<MemorizationPlanItem[]>([]);
  const [modules, setModules] = useState<TranslationModuleInfo[]>([]);
  const [activeQari, setActiveQari] = useState<string>("mishary");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // New & Edit Reflection Modal State
  const [isNewNoteOpen, setIsNewNoteOpen] = useState(false);
  const [editingReflectionId, setEditingReflectionId] = useState<string | null>(null);
  const [noteSurahId, setNoteSurahId] = useState<number>(currentSurahId || 1);
  const [noteVerseNum, setNoteVerseNum] = useState<number>(1);
  const [noteContent, setNoteContent] = useState("");
  const [isSurahPickerOpen, setIsSurahPickerOpen] = useState(false);
  const [noteSurahSearch, setNoteSurahSearch] = useState("");

  // New Memorization Plan Modal
  const [isNewPlanOpen, setIsNewPlanOpen] = useState(false);
  const [planStart, setPlanStart] = useState<number>(1);
  const [planEnd, setPlanEnd] = useState<number>(10);
  const [planReps, setPlanReps] = useState<number>(5);

  const isDark = theme === "dark";
  const [availableQaris, setAvailableQaris] = useState<QariProfile[]>(QARIS_LIST);

  // ─── Surah Audio Player State for Web Hub ──────────────────────────────────
  interface SurahMeta {
    id: number;
    name: string;
    transliteration: string;
    translation: string;
    total_verses: number;
  }
  const [surahList, setSurahList] = useState<SurahMeta[]>([]);
  const [audioSurahId, setAudioSurahId] = useState<number>(() => {
    return (globalSurahAudio && !globalSurahAudio.paused) ? globalSurahId : (currentSurahId || 1);
  });
  const [isSurahAudioPlaying, setIsSurahAudioPlaying] = useState<boolean>(() => {
    return Boolean(globalSurahAudio && !globalSurahAudio.paused);
  });
  const [audioCurrentTime, setAudioCurrentTime] = useState<number>(() => {
    return globalSurahAudio ? globalSurahAudio.currentTime : 0;
  });
  const [audioDuration, setAudioDuration] = useState<number>(() => {
    return globalSurahAudio?.duration || 0;
  });
  const [audioPlaybackRate, setAudioPlaybackRate] = useState(1.0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const surahAudioRef = useRef<HTMLAudioElement | null>(globalSurahAudio);

  // Register pause callback with Web Audio Coordinator so single-Ayah audio pauses Surah audio
  useEffect(() => {
    const unregister = registerWebAudioPause("surah", () => {
      if (globalSurahAudio && !globalSurahAudio.paused) {
        globalSurahAudio.pause();
      }
      setIsSurahAudioPlaying(false);
    });
    return () => unregister();
  }, []);

  // Re-bind listeners to persistent audio instance on mount
  useEffect(() => {
    if (globalSurahAudio) {
      surahAudioRef.current = globalSurahAudio;
      setIsSurahAudioPlaying(!globalSurahAudio.paused);
      setAudioCurrentTime(globalSurahAudio.currentTime);
      setAudioDuration(globalSurahAudio.duration || 0);

      globalSurahAudio.ontimeupdate = () => setAudioCurrentTime(globalSurahAudio?.currentTime || 0);
      globalSurahAudio.onloadedmetadata = () => setAudioDuration(globalSurahAudio?.duration || 0);
      globalSurahAudio.onplay = () => setIsSurahAudioPlaying(true);
      globalSurahAudio.onpause = () => setIsSurahAudioPlaying(false);
      globalSurahAudio.onended = () => {
        setIsSurahAudioPlaying(false);
        if (globalSurahId < 114) {
          setAudioSurahId((prev) => prev + 1);
        }
      };
      globalSurahAudio.onerror = () => {
        setIsSurahAudioPlaying(false);
        setAudioError("Unable to stream full Surah recitation from this mirror.");
      };
    }
  }, []);

  // Notify parent about audio playing state
  useEffect(() => {
    onAudioPlayingChange?.(isSurahAudioPlaying);
  }, [isSurahAudioPlaying, onAudioPlayingChange]);

  // Sync audioSurahId with incoming currentSurahId only if audio is not already playing another surah
  useEffect(() => {
    if (currentSurahId && (!globalSurahAudio || globalSurahAudio.paused)) {
      setAudioSurahId(currentSurahId);
    }
  }, [currentSurahId]);

  // Load complete 114 Surahs metadata from API
  useEffect(() => {
    fetch("/api/read/quran")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setSurahList(data);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const unsub = subscribeAvailableQaris((list) => {
      if (list && list.length > 0) {
        setAvailableQaris(list);
      }
    });
    return () => unsub();
  }, []);

  const activeQariProfile = useMemo(() => {
    return availableQaris.find((q) => q.id === activeQari) || availableQaris[0] || QARIS_LIST[0];
  }, [availableQaris, activeQari]);

  const currentAudioSurah = useMemo(() => {
    return surahList.find((s) => s.id === audioSurahId) || {
      id: audioSurahId,
      name: currentSurahName || "",
      transliteration: currentSurahName || `Surah ${audioSurahId}`,
      translation: "",
      total_verses: 0,
    };
  }, [surahList, audioSurahId, currentSurahName]);

  const surahAudioUrl = useMemo(() => {
    return getSurahAudioUrl(activeQariProfile.serverUrl, audioSurahId);
  }, [activeQariProfile.serverUrl, audioSurahId]);

  const audioSurahInfo = useMemo(() => {
    return surahList.find((s) => s.id === audioSurahId);
  }, [surahList, audioSurahId]);

  // Estimate the active playing Ayah based on playback progress
  const activeEstimatedAyah = useMemo(() => {
    return estimateAyahFromAudioProgress(
      audioCurrentTime,
      audioDuration,
      undefined,
      audioSurahInfo?.total_verses || 1
    );
  }, [audioCurrentTime, audioDuration, audioSurahInfo?.total_verses]);

  const formatAudioTime = (seconds: number) => {
    if (!seconds || isNaN(seconds) || !isFinite(seconds)) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const toggleSurahAudio = () => {
    setAudioError(null);
    let audio = globalSurahAudio;
    if (!audio) {
      const newAudio = new Audio(surahAudioUrl);
      newAudio.playbackRate = audioPlaybackRate;
      globalSurahAudio = newAudio;
      globalSurahAudioUrl = surahAudioUrl;
      globalSurahId = audioSurahId;
      surahAudioRef.current = newAudio;
      audio = newAudio;
    }

    audio.playbackRate = audioPlaybackRate;
    audio.ontimeupdate = () => setAudioCurrentTime(audio?.currentTime || 0);
    audio.onloadedmetadata = () => setAudioDuration(audio?.duration || 0);
    audio.onplay = () => setIsSurahAudioPlaying(true);
    audio.onpause = () => setIsSurahAudioPlaying(false);
    audio.onended = () => {
      setIsSurahAudioPlaying(false);
      // Auto-advance to next Surah if available
      if (audioSurahId < 114) {
        setAudioSurahId((prev) => prev + 1);
      }
    };
    audio.onerror = () => {
      setIsSurahAudioPlaying(false);
      setAudioError("Unable to stream full Surah recitation from this mirror.");
    };

    if (isSurahAudioPlaying) {
      audio.pause();
      setIsSurahAudioPlaying(false);
    } else {
      // Pause any single-verse audio playback immediately
      notifyWebAudioStarted("surah");

      if (audio.src !== surahAudioUrl) {
        audio.src = surahAudioUrl;
        globalSurahAudioUrl = surahAudioUrl;
        globalSurahId = audioSurahId;
      }
      audio.play().catch((err) => {
        console.warn("Audio playback blocked:", err);
        setAudioError("Playback was interrupted or blocked by the browser. Click Play to resume.");
      });
      setIsSurahAudioPlaying(true);
    }
  };

  const handleAudioSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setAudioCurrentTime(newTime);
    if (globalSurahAudio) {
      globalSurahAudio.currentTime = newTime;
    }
  };

  const handleSetSpeed = (rate: number) => {
    setAudioPlaybackRate(rate);
    if (globalSurahAudio) {
      globalSurahAudio.playbackRate = rate;
    }
  };

  const handlePrevSurah = () => {
    if (audioSurahId > 1) {
      setAudioSurahId((prev) => prev - 1);
    }
  };

  const handleNextSurah = () => {
    if (audioSurahId < 114) {
      setAudioSurahId((prev) => prev + 1);
    }
  };

  const handleAudioSkipBack = () => {
    if (globalSurahAudio) {
      const target = Math.max(0, globalSurahAudio.currentTime - 10);
      globalSurahAudio.currentTime = target;
      setAudioCurrentTime(target);
    }
  };

  const handleAudioSkipForward = () => {
    if (globalSurahAudio) {
      const dur = globalSurahAudio.duration || 0;
      const target = dur > 0 ? Math.min(dur, globalSurahAudio.currentTime + 10) : globalSurahAudio.currentTime + 10;
      globalSurahAudio.currentTime = target;
      setAudioCurrentTime(target);
    }
  };

  // Switch stream when surahAudioUrl changes while playing
  useEffect(() => {
    globalSurahId = audioSurahId;
    const audio = globalSurahAudio;
    if (audio && audio.src !== surahAudioUrl) {
      const wasPlaying = isSurahAudioPlaying || !audio.paused;
      audio.src = surahAudioUrl;
      globalSurahAudioUrl = surahAudioUrl;
      setAudioCurrentTime(0);
      if (wasPlaying) {
        notifyWebAudioStarted("surah");
        audio.play().catch(() => {});
      }
    }
  }, [surahAudioUrl, audioSurahId, isSurahAudioPlaying]);

  useEffect(() => {
    if (!isOpen) return;

    // Load user Quran hub data
    getSavedAyahs(userId).then(setSavedAyahs);
    getQuranReflections(userId).then(setReflections);
    getBookmarks(userId).then(setBookmarks);
    getMemorizationPlans(userId).then(setMemorizationPlans);
    getTranslationModules().then(setModules);
    getActiveQariId().then(setActiveQari);
  }, [isOpen, userId]);


  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleDeleteBookmark = async (surahId: number, verseId: number) => {
    const updated = await deleteBookmark(surahId, verseId, userId);
    setBookmarks(updated);
    showStatus("Bookmark removed!");
  };

  const handleDeleteSaved = async (id: string) => {
    const updated = await deleteSavedAyah(id, userId);
    setSavedAyahs(updated);
    showStatus("Ayah removed from saved collection.");
  };

  const handleDeleteRefl = async (id: string) => {
    const updated = await deleteQuranReflection(id, userId);
    setReflections(updated);
    showStatus("Reflection note deleted.");
  };

  const selectedNoteSurah = useMemo(() => {
    return (
      surahList.find((s) => s.id === noteSurahId) || {
        id: noteSurahId,
        name: currentSurahName || "",
        transliteration: currentSurahName || `Surah ${noteSurahId}`,
        translation: "",
        total_verses: 286,
      }
    );
  }, [surahList, noteSurahId, currentSurahName]);

  const filteredNoteSurahs = useMemo(() => {
    const q = noteSurahSearch.toLowerCase().trim();
    if (!q) return surahList;
    return surahList.filter(
      (s) =>
        s.transliteration.toLowerCase().includes(q) ||
        s.name.includes(q) ||
        String(s.id).includes(q)
    );
  }, [surahList, noteSurahSearch]);

  const existingReflectionForSelectedVerse = useMemo(() => {
    return reflections.find(
      (r) => r.surahId === noteSurahId && r.verseId === Number(noteVerseNum)
    );
  }, [reflections, noteSurahId, noteVerseNum]);

  const handleOpenNewNote = () => {
    setEditingReflectionId(null);
    setNoteSurahId(currentSurahId || 1);
    setNoteVerseNum(1);
    setNoteContent("");
    setIsSurahPickerOpen(false);
    setIsNewNoteOpen(true);
  };

  const handleEditReflection = (refl: QuranReflectionItem) => {
    setEditingReflectionId(refl.id);
    setNoteSurahId(refl.surahId);
    setNoteVerseNum(refl.verseId);
    setNoteContent(refl.note);
    setIsSurahPickerOpen(false);
    setIsNewNoteOpen(true);
  };

  const handleSaveNewNote = async () => {
    const vId = Number(noteVerseNum);
    const maxV = selectedNoteSurah.total_verses || 286;
    if (isNaN(vId) || vId < 1 || vId > maxV) {
      alert(`Please enter a valid verse number between 1 and ${maxV}.`);
      return;
    }
    if (!noteContent.trim()) {
      alert("Please write a reflection note.");
      return;
    }
    const updated = await saveQuranReflection(
      noteSurahId,
      selectedNoteSurah.transliteration,
      vId,
      noteContent.trim(),
      userId
    );
    setReflections(updated);
    setNoteContent("");
    setEditingReflectionId(null);
    setIsNewNoteOpen(false);
    showStatus(
      editingReflectionId
        ? `Reflection updated for Ayah ${vId}! ✍️`
        : `Reflection saved for Ayah ${vId}! ✍️`
    );
  };

  const handleDeleteCurrentEditingReflection = async () => {
    const targetId = editingReflectionId || existingReflectionForSelectedVerse?.id;
    if (!targetId) return;
    if (!confirm("Are you sure you want to delete this reflection note?")) return;
    const updated = await deleteQuranReflection(targetId, userId);
    setReflections(updated);
    setIsNewNoteOpen(false);
    setEditingReflectionId(null);
    setNoteContent("");
    showStatus("Reflection note deleted.");
  };

  const handleSaveNewPlan = async () => {
    const updated = await saveMemorizationPlan(
      {
        surahId: currentSurahId,
        surahName: currentSurahName,
        startVerse: Number(planStart),
        endVerse: Number(planEnd),
        repetitions: Number(planReps),
        intervalSec: 3,
        method: "repeat",
        status: "in_progress",
      },
      userId
    );
    setMemorizationPlans(updated);
    setIsNewPlanOpen(false);
    showStatus("Memorization plan added to Hub! 📖");
  };

  const MODULE_TO_LANG_MAP: Record<string, "en" | "yoruba" | "hausa" | "igbo"> = {
    en_saheeh: "en",
    yo_quran: "yoruba",
    ha_quran: "hausa",
    ig_quran: "igbo",
  };

  const handleToggleModuleActive = async (modId: string) => {
    if (modId === "ig_quran") {
      showStatus("Central Igbo translation is currently undergoing scholarly review (Coming soon). ⏳");
      return;
    }
    if (modId === "tafseer_ibnkathir") {
      showStatus("Tafsir Ibn Kathir commentary engine is currently in development (Coming soon). ⏳");
      return;
    }

    const updated = await setActiveTranslationModule(modId);
    setModules(updated);

    const targetLang = MODULE_TO_LANG_MAP[modId];
    if (targetLang) {
      if (onSelectTranslationLang) {
        onSelectTranslationLang(targetLang);
      }
      await saveQuranReaderSettings({ selectedTransLang: targetLang }, userId);
      const targetMod = updated.find((m) => m.id === modId);
      showStatus(`Qur'an reader translation set to ${targetMod?.title || targetMod?.language}! ✨`);
    }
  };

  const handleSelectQari = async (qId: string) => {
    setActiveQari(qId);
    await setActiveQariId(qId);
    if (onSelectQari) onSelectQari(qId);
    const qari = availableQaris.find((q) => q.id === qId);
    showStatus(`Reciter set to ${qari?.name || qId}`);

    // If audio is playing or initialized, switch the stream seamlessly
    if (surahAudioRef.current && qari) {
      const newUrl = getSurahAudioUrl(qari.serverUrl, audioSurahId);
      const wasPlaying = isSurahAudioPlaying || !surahAudioRef.current.paused;
      const curTime = surahAudioRef.current.currentTime;
      surahAudioRef.current.src = newUrl;
      surahAudioRef.current.currentTime = curTime;
      if (wasPlaying) {
        surahAudioRef.current.play().catch(() => {});
      }
    }
  };

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.72)",
          zIndex: 99999,
          display: isOpen ? "flex" : "none",
          alignItems: "center",
          justifyContent: "center",
          backdropFilter: "blur(6px)",
          padding: "1rem",
        }}
        onClick={onClose}
      >
      <div
        style={{
          width: "100%",
          maxWidth: "840px",
          maxHeight: "90vh",
          backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
          color: isDark ? "#F8FAFC" : "#0F172A",
          borderRadius: "20px",
          border: `1px solid ${isDark ? "#334155" : "#E2E8F0"}`,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "1.25rem 1.5rem",
            borderBottom: `1px solid ${isDark ? "#1E293B" : "#F1F5F9"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "1.25rem" }}>✨</span>
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>
                Quran Study & Reflection Hub
              </h2>
            </div>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: isDark ? "#94A3B8" : "#64748B" }}>
              Surah {currentSurahId} • {currentSurahName} • Seamlessly synced across Web and Mobile
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: isDark ? "#94A3B8" : "#64748B",
              fontSize: "1.5rem",
              cursor: "pointer",
              lineHeight: 1,
              padding: "0.4rem",
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab Ribbon */}
        <div
          style={{
            display: "flex",
            overflowX: "auto",
            padding: "0.75rem 1.5rem",
            gap: "0.5rem",
            borderBottom: `1px solid ${isDark ? "#1E293B" : "#F1F5F9"}`,
            backgroundColor: isDark ? "#090D16" : "#F8FAFC",
          }}
        >
          {[
            { id: "reflections", label: "Reflections", icon: "💭", count: reflections.length },
            { id: "saved", label: "Saved Ayahs", icon: "🔖", count: savedAyahs.length },
            { id: "bookmarks", label: "Bookmarks", icon: "📌", count: bookmarks.length },
            { id: "memorize", label: "Memorization", icon: "🎯", count: memorizationPlans.length },
            { id: "audio", label: "Audio & Qaris", icon: "🎙️", count: availableQaris.length },
            { id: "translations", label: "Translations", icon: "🌐", count: modules.length },
            { id: "tajweed", label: "Tajweed (Soon)", icon: "🎨" },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as WebHubTab)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.5rem 0.9rem",
                  borderRadius: "9999px",
                  fontSize: "0.85rem",
                  fontWeight: isActive ? 700 : 500,
                  border: "none",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  backgroundColor: isActive
                    ? "var(--accent-red, #DC2626)"
                    : isDark
                    ? "#1E293B"
                    : "#E2E8F0",
                  color: isActive ? "#FFFFFF" : isDark ? "#E2E8F0" : "#334155",
                  transition: "all 0.15s ease",
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    style={{
                      fontSize: "0.7rem",
                      backgroundColor: isActive ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.08)",
                      padding: "0.1rem 0.4rem",
                      borderRadius: "9999px",
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Toast status alert */}
        {statusMessage && (
          <div
            style={{
              padding: "0.5rem 1.5rem",
              backgroundColor: "#16A34A",
              color: "#FFFFFF",
              fontSize: "0.85rem",
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            {statusMessage}
          </div>
        )}

        {/* Tab Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
          {/* TAB: REFLECTIONS */}
          {activeTab === "reflections" && (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1rem",
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
                    Quranic Reflections & Tadabbur ({reflections.length})
                  </h3>
                  <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", opacity: 0.7 }}>
                    Your recorded spiritual lessons, preserved locally and synced to your cloud account.
                  </p>
                </div>
                <button
                  onClick={handleOpenNewNote}
                  style={{
                    backgroundColor: "var(--accent-red, #DC2626)",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "8px",
                    padding: "0.5rem 0.9rem",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                  }}
                >
                  <span>✍️</span> New Note
                </button>
              </div>

              {reflections.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "3rem 1rem",
                    backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                    borderRadius: "12px",
                    border: `1px dashed ${isDark ? "#334155" : "#CBD5E1"}`,
                  }}
                >
                  <span style={{ fontSize: "2.5rem" }}>💭</span>
                  <h4 style={{ margin: "0.75rem 0 0.25rem", fontSize: "1rem" }}>No reflections yet</h4>
                  <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.7 }}>
                    Click &ldquo;New Note&rdquo; or tap Reflection on any Ayah while reading to record your lessons.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {reflections.map((refl) => (
                    <div
                      key={refl.id}
                      onClick={() => {
                        if (onJumpToAyah) {
                          onJumpToAyah(refl.verseId, refl.surahId);
                          onClose();
                        }
                      }}
                      style={{
                        backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                        borderRadius: "12px",
                        padding: "1rem",
                        border: `1px solid ${isDark ? "#334155" : "#E2E8F0"}`,
                        cursor: onJumpToAyah ? "pointer" : "default",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "var(--accent-gold, #D4AF37)";
                        e.currentTarget.style.transform = "translateY(-1px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = isDark ? "#334155" : "#E2E8F0";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "0.5rem",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span
                            style={{
                              backgroundColor: "rgba(212, 175, 55, 0.15)",
                              color: "#D4AF37",
                              padding: "0.2rem 0.5rem",
                              borderRadius: "6px",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                            }}
                          >
                            Surah {refl.surahName} • Verse {refl.verseId}
                          </span>
                          <span style={{ fontSize: "0.75rem", opacity: 0.6 }}>
                            {new Date(refl.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          {onJumpToAyah && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onJumpToAyah(refl.verseId, refl.surahId);
                                onClose();
                              }}
                              style={{
                                background: "none",
                                border: "none",
                                color: "#D4AF37",
                                cursor: "pointer",
                                fontSize: "0.8rem",
                                fontWeight: 600,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <span>Jump to Ayah</span>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 12h14" />
                                <path d="m12 5 7 7-7 7" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditReflection(refl);
                            }}
                            style={{
                              backgroundColor: "rgba(212, 175, 55, 0.15)",
                              border: "1px solid rgba(212, 175, 55, 0.4)",
                              color: "#D4AF37",
                              padding: "0.22rem 0.55rem",
                              borderRadius: "6px",
                              cursor: "pointer",
                              fontSize: "0.78rem",
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                            }}
                            title="Edit reflection note"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(
                                `Reflection on Surah ${refl.surahName} [Verse ${refl.verseId}]:\n\n"${refl.note}"\n\n- Noor Library Quran Notes`
                              );
                              showStatus("Reflection note copied to clipboard!");
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              color: isDark ? "#94A3B8" : "#64748B",
                              cursor: "pointer",
                              fontSize: "0.8rem",
                            }}
                            title="Copy note"
                          >
                            📋 Copy
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteRefl(refl.id);
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              color: "#EF4444",
                              cursor: "pointer",
                              fontSize: "0.8rem",
                            }}
                            title="Delete note"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.9rem",
                          lineHeight: 1.6,
                          color: isDark ? "#E2E8F0" : "#1E293B",
                        }}
                      >
                        {refl.note}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: SAVED AYAHS */}
          {activeTab === "saved" && (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1rem",
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Saved Ayahs ({savedAyahs.length})</h3>
                  <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", opacity: 0.7 }}>
                    Organized by folder for revision, recitation, and memorization.
                  </p>
                </div>
              </div>

              {savedAyahs.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "3rem 1rem",
                    backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                    borderRadius: "12px",
                    border: `1px dashed ${isDark ? "#334155" : "#CBD5E1"}`,
                  }}
                >
                  <span style={{ fontSize: "2.5rem" }}>🔖</span>
                  <h4 style={{ margin: "0.75rem 0 0.25rem", fontSize: "1rem" }}>No saved ayahs yet</h4>
                  <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.7 }}>
                    Save verses by clicking &ldquo;Save to Favorites&rdquo; in the Ayah Actions menu.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {savedAyahs.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (onJumpToAyah) {
                          onJumpToAyah(item.verseId, item.surahId);
                          onClose();
                        }
                      }}
                      style={{
                        backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                        borderRadius: "12px",
                        padding: "1rem",
                        border: `1px solid ${isDark ? "#334155" : "#E2E8F0"}`,
                        cursor: onJumpToAyah ? "pointer" : "default",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "var(--accent-gold, #D4AF37)";
                        e.currentTarget.style.transform = "translateY(-1px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = isDark ? "#334155" : "#E2E8F0";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "0.5rem",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span
                            style={{
                              backgroundColor: "rgba(220, 38, 38, 0.12)",
                              color: "#DC2626",
                              padding: "0.2rem 0.5rem",
                              borderRadius: "6px",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                            }}
                          >
                            {item.folder || "Favorites"}
                          </span>
                          <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>
                            Surah {item.surahName} • {item.surahId}:{item.verseId}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          {onJumpToAyah && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onJumpToAyah(item.verseId, item.surahId);
                                onClose();
                              }}
                              style={{
                                background: "none",
                                border: "none",
                                color: "#D4AF37",
                                cursor: "pointer",
                                fontSize: "0.8rem",
                                fontWeight: 600,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <span>Jump to Ayah</span>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 12h14" />
                                <path d="m12 5 7 7-7 7" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSaved(item.id);
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              color: "#EF4444",
                              cursor: "pointer",
                              fontSize: "0.8rem",
                            }}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                      <p
                        style={{
                          margin: "0.5rem 0",
                          fontFamily: "Amiri, serif",
                          fontSize: "1.25rem",
                          textAlign: "right",
                          lineHeight: 1.8,
                          color: isDark ? "#F8FAFC" : "#0F172A",
                        }}
                        dir="rtl"
                      >
                        {item.arabic}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.85rem",
                          lineHeight: 1.5,
                          opacity: 0.8,
                        }}
                      >
                        {item.translation}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: BOOKMARKS */}
          {activeTab === "bookmarks" && (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1rem",
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
                    Quranic Bookmarks ({bookmarks.length})
                  </h3>
                  <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", opacity: 0.7 }}>
                    Your active reading positions and marked Ayahs.
                  </p>
                </div>
              </div>

              {bookmarks.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "3rem 1rem",
                    backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                    borderRadius: "12px",
                    border: `1px dashed ${isDark ? "#334155" : "#CBD5E1"}`,
                  }}
                >
                  <span style={{ fontSize: "2.5rem" }}>📌</span>
                  <h4 style={{ margin: "0.75rem 0 0.25rem", fontSize: "1rem" }}>No bookmarks saved yet</h4>
                  <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.7 }}>
                    Click the bookmark ribbon on any Ayah while reading to mark your place.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {bookmarks.map((bm) => (
                    <div
                      key={`${bm.surahId}_${bm.verseId}`}
                      onClick={() => {
                        if (onJumpToAyah) {
                          onJumpToAyah(bm.verseId, bm.surahId);
                          onClose();
                        }
                      }}
                      style={{
                        backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                        borderRadius: "12px",
                        padding: "1rem",
                        border: `1px solid ${isDark ? "#334155" : "#E2E8F0"}`,
                        cursor: onJumpToAyah ? "pointer" : "default",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "var(--accent-gold, #D4AF37)";
                        e.currentTarget.style.transform = "translateY(-1px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = isDark ? "#334155" : "#E2E8F0";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "0.5rem",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span
                            style={{
                              backgroundColor: "rgba(220, 38, 38, 0.12)",
                              color: "#DC2626",
                              padding: "0.2rem 0.5rem",
                              borderRadius: "6px",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                            }}
                          >
                            Bookmark
                          </span>
                          <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>
                            Surah {bm.surahName} • Verse {bm.verseId}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          {onJumpToAyah && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onJumpToAyah(bm.verseId, bm.surahId);
                                onClose();
                              }}
                              style={{
                                background: "none",
                                border: "none",
                                color: "#D4AF37",
                                cursor: "pointer",
                                fontSize: "0.8rem",
                                fontWeight: 600,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <span>Jump to Ayah</span>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 12h14" />
                                <path d="m12 5 7 7-7 7" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteBookmark(bm.surahId, bm.verseId);
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              color: "#EF4444",
                              cursor: "pointer",
                              fontSize: "0.8rem",
                            }}
                            title="Remove Bookmark"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                      {bm.arabic && (
                        <p
                          style={{
                            margin: "0.5rem 0",
                            fontFamily: "Amiri, serif",
                            fontSize: "1.25rem",
                            textAlign: "right",
                            lineHeight: 1.8,
                            color: isDark ? "#F8FAFC" : "#0F172A",
                          }}
                          dir="rtl"
                        >
                          {bm.arabic}
                        </p>
                      )}
                      {bm.translation && (
                        <p
                          style={{
                            margin: 0,
                            fontSize: "0.85rem",
                            lineHeight: 1.5,
                            opacity: 0.8,
                          }}
                        >
                          {bm.translation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: MEMORIZATION */}
          {activeTab === "memorize" && (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1rem",
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
                    Memorization & Hifz Goals ({memorizationPlans.length})
                  </h3>
                  <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", opacity: 0.7 }}>
                    Active targets with repetition tracking and mastery milestones.
                  </p>
                </div>
                <button
                  onClick={() => setIsNewPlanOpen(true)}
                  style={{
                    backgroundColor: "var(--accent-red, #DC2626)",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "8px",
                    padding: "0.5rem 0.9rem",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  + Add Target
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {memorizationPlans.map((plan) => {
                  const isMastered = plan.status === "mastered";
                  return (
                    <div
                      key={plan.id}
                      style={{
                        backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                        borderRadius: "12px",
                        padding: "1rem",
                        border: `1px solid ${
                          isMastered ? "#16A34A" : isDark ? "#334155" : "#E2E8F0"
                        }`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "0.5rem",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span
                            style={{
                              backgroundColor: isMastered ? "#16A34A" : "#D97706",
                              color: "#FFFFFF",
                              padding: "0.2rem 0.5rem",
                              borderRadius: "6px",
                              fontSize: "0.7rem",
                              fontWeight: 700,
                              textTransform: "uppercase",
                            }}
                          >
                            {plan.status.replace("_", " ")}
                          </span>
                          <span style={{ fontSize: "0.95rem", fontWeight: 700 }}>
                            Surah {plan.surahName} (Ayahs {plan.startVerse} - {plan.endVerse})
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button
                            onClick={async () => {
                              const nextStatus = isMastered ? "in_progress" : "mastered";
                              const updated = await updateMemorizationStatus(plan.id, nextStatus, userId);
                              setMemorizationPlans(updated);
                              showStatus(`Target marked as ${nextStatus.replace("_", " ")}!`);
                            }}
                            style={{
                              background: "none",
                              border: `1px solid ${isMastered ? "#D97706" : "#16A34A"}`,
                              color: isMastered ? "#D97706" : "#16A34A",
                              borderRadius: "6px",
                              padding: "0.2rem 0.6rem",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            {isMastered ? "Mark In Progress" : "✓ Mark Mastered"}
                          </button>
                          <button
                            onClick={async () => {
                              const updated = await deleteMemorizationPlan(plan.id, userId);
                              setMemorizationPlans(updated);
                              showStatus("Target deleted.");
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              color: "#EF4444",
                              cursor: "pointer",
                              fontSize: "0.8rem",
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "1.5rem",
                          fontSize: "0.8rem",
                          color: isDark ? "#94A3B8" : "#64748B",
                        }}
                      >
                        <span>🔄 {plan.repetitions} repetitions per Ayah</span>
                        <span>⏱️ {plan.intervalSec}s delay</span>
                        <span>
                          📅 Last practiced: {new Date(plan.lastPracticedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: AUDIO & QARIS */}
          {activeTab === "audio" && (
            <div>
              {/* Surah Audio Player Card */}
              <div
                style={{
                  background: isDark
                    ? "linear-gradient(135deg, #1E293B 0%, #0F172A 100%)"
                    : "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)",
                  border: "1.5px solid #D4AF37",
                  borderRadius: "16px",
                  padding: "1.25rem",
                  marginBottom: "1.5rem",
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
                }}
              >
                {/* Player Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "1rem",
                    marginBottom: "1rem",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <span
                        style={{
                          backgroundColor: "#D4AF37",
                          color: "#000000",
                          fontSize: "0.72rem",
                          fontWeight: 800,
                          padding: "0.2rem 0.55rem",
                          borderRadius: "6px",
                          letterSpacing: "0.5px",
                        }}
                      >
                        FULL SURAH AUDIO
                      </span>
                      <span style={{ fontSize: "0.85rem", opacity: 0.8 }}>
                        Chapter {audioSurahId} of 114
                      </span>
                    </div>

                    <h3
                      style={{
                        margin: "0.4rem 0 0.15rem",
                        fontSize: "1.3rem",
                        fontWeight: 800,
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <span>Surah {currentAudioSurah.transliteration}</span>
                      <span
                        style={{
                          fontFamily: "Amiri, serif",
                          color: "#D4AF37",
                          fontSize: "1.2rem",
                        }}
                      >
                        {currentAudioSurah.name}
                      </span>
                    </h3>

                    <p style={{ margin: 0, fontSize: "0.82rem", opacity: 0.85 }}>
                      🎙️ Reciter: <strong>{activeQariProfile.name}</strong> • {activeQariProfile.country} ({activeQariProfile.style})
                    </p>
                  </div>

                  {/* Surah Selector Dropdown */}
                  {surahList.length > 0 && (
                    <select
                      value={audioSurahId}
                      onChange={(e) => setAudioSurahId(Number(e.target.value))}
                      style={{
                        padding: "0.4rem 0.75rem",
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        borderRadius: "8px",
                        border: `1px solid ${isDark ? "#475569" : "#CBD5E1"}`,
                        backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
                        color: "inherit",
                        cursor: "pointer",
                        outline: "none",
                      }}
                    >
                      {surahList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.id}. {s.transliteration} ({s.name})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {audioError && (
                  <div
                    style={{
                      padding: "0.5rem 0.75rem",
                      borderRadius: "8px",
                      backgroundColor: "rgba(220, 38, 38, 0.15)",
                      color: "#EF4444",
                      fontSize: "0.78rem",
                      marginBottom: "0.75rem",
                      border: "1px solid rgba(220, 38, 38, 0.3)",
                    }}
                  >
                    ⚠️ {audioError}
                  </div>
                )}

                {/* Progress Scrubber */}
                <div style={{ marginBottom: "0.75rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span style={{ fontSize: "0.78rem", fontFamily: "monospace", minWidth: "40px" }}>
                      {formatAudioTime(audioCurrentTime)}
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={audioDuration || 100}
                      step={0.5}
                      value={audioCurrentTime}
                      onChange={handleAudioSeek}
                      style={{
                        flex: 1,
                        accentColor: "var(--accent-red, #DC2626)",
                        cursor: "pointer",
                        height: "6px",
                      }}
                    />
                    <span style={{ fontSize: "0.78rem", fontFamily: "monospace", minWidth: "40px", textAlign: "right" }}>
                      {formatAudioTime(audioDuration)}
                    </span>
                  </div>
                </div>

                {/* Main Controls Row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "0.75rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {/* Prev Surah */}
                    <button
                      onClick={handlePrevSurah}
                      disabled={audioSurahId <= 1}
                      title="Previous Surah"
                      style={{
                        padding: "0.45rem 0.75rem",
                        borderRadius: "8px",
                        border: `1px solid ${isDark ? "#475569" : "#CBD5E1"}`,
                        backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                        color: "inherit",
                        cursor: audioSurahId <= 1 ? "not-allowed" : "pointer",
                        opacity: audioSurahId <= 1 ? 0.4 : 1,
                        fontSize: "0.85rem",
                        fontWeight: 600,
                      }}
                    >
                      ⏮ Prev
                    </button>

                    {/* Big Play/Pause Button */}
                    <button
                      onClick={toggleSurahAudio}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.55rem 1.4rem",
                        borderRadius: "50px",
                        border: "none",
                        backgroundColor: isSurahAudioPlaying ? "#DC2626" : "#D4AF37",
                        color: isSurahAudioPlaying ? "#FFFFFF" : "#000000",
                        fontSize: "0.95rem",
                        fontWeight: 800,
                        cursor: "pointer",
                        boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span>{isSurahAudioPlaying ? "⏸ Pause" : "▶ Play Surah"}</span>
                    </button>

                    {/* Next Surah */}
                    <button
                      onClick={handleNextSurah}
                      disabled={audioSurahId >= 114}
                      title="Next Surah"
                      style={{
                        padding: "0.45rem 0.75rem",
                        borderRadius: "8px",
                        border: `1px solid ${isDark ? "#475569" : "#CBD5E1"}`,
                        backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                        color: "inherit",
                        cursor: audioSurahId >= 114 ? "not-allowed" : "pointer",
                        opacity: audioSurahId >= 114 ? 0.4 : 1,
                        fontSize: "0.85rem",
                        fontWeight: 600,
                      }}
                    >
                      Next ⏭
                    </button>
                  </div>

                  {/* Speed & Jump Controls */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span style={{ fontSize: "0.75rem", opacity: 0.7, marginRight: "2px" }}>Speed:</span>
                    {[0.75, 1.0, 1.25, 1.5].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => handleSetSpeed(rate)}
                        style={{
                          padding: "0.25rem 0.5rem",
                          fontSize: "0.74rem",
                          fontWeight: audioPlaybackRate === rate ? 800 : 500,
                          borderRadius: "6px",
                          border: audioPlaybackRate === rate ? "1.5px solid #D4AF37" : `1px solid ${isDark ? "#475569" : "#CBD5E1"}`,
                          backgroundColor: audioPlaybackRate === rate ? "rgba(212,175,55,0.2)" : "transparent",
                          color: audioPlaybackRate === rate ? "#D4AF37" : "inherit",
                          cursor: "pointer",
                        }}
                      >
                        {rate}x
                      </button>
                    ))}

                    {/* Read Along Button */}
                    {onJumpToAyah && (
                      <button
                        onClick={() => {
                          onJumpToAyah(activeEstimatedAyah, audioSurahId);
                          onClose();
                        }}
                        style={{
                          marginLeft: "0.5rem",
                          padding: "0.35rem 0.75rem",
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          borderRadius: "8px",
                          border: "1px solid #10B981",
                          backgroundColor: "rgba(16, 185, 129, 0.15)",
                          color: "#10B981",
                          cursor: "pointer",
                        }}
                        title={`Read Surah ${audioSurahId} starting at current Ayah ${activeEstimatedAyah}`}
                      >
                        📖 Read Along (Ayah {activeEstimatedAyah})
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Reciters Selection Section */}
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Select Qari Reciter ({availableQaris.length})</h3>
                    <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", opacity: 0.7 }}>
                      Click any reciter to switch recitation audio for Surah {currentAudioSurah.transliteration} in real time.
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.75rem" }}>
                {availableQaris.map((qari) => {
                  const isSelected = activeQari === qari.id;
                  const isThisPlaying = isSelected && isSurahAudioPlaying;
                  return (
                    <div
                      key={qari.id}
                      onClick={() => handleSelectQari(qari.id)}
                      style={{
                        backgroundColor: isSelected
                          ? isDark
                            ? "#1E293B"
                            : "#FEF2F2"
                          : isDark
                          ? "#0F172A"
                          : "#F8FAFC",
                        borderRadius: "12px",
                        padding: "1rem",
                        border: `1.5px solid ${
                          isSelected ? "var(--accent-red, #DC2626)" : isDark ? "#334155" : "#E2E8F0"
                        }`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ fontSize: "1rem", fontWeight: 700 }}>{qari.name}</span>
                          <span
                            style={{
                              fontSize: "0.95rem",
                              fontFamily: "Amiri, serif",
                              color: "#D4AF37",
                            }}
                          >
                            {qari.arabicName}
                          </span>
                          {isThisPlaying && (
                            <span
                              style={{
                                backgroundColor: "#DC2626",
                                color: "#FFFFFF",
                                fontSize: "0.68rem",
                                fontWeight: 800,
                                padding: "2px 6px",
                                borderRadius: "4px",
                              }}
                            >
                              🔊 PLAYING NOW
                            </span>
                          )}
                        </div>
                        <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", opacity: 0.7 }}>
                          {qari.style} • {qari.country}
                        </p>
                        <p
                          style={{
                            margin: "0.2rem 0 0",
                            fontSize: "0.7rem",
                            fontFamily: "monospace",
                            color: isDark ? "#64748B" : "#94A3B8",
                          }}
                        >
                          Server: {qari.serverUrl}
                        </p>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isSelected) {
                            toggleSurahAudio();
                          } else {
                            handleSelectQari(qari.id);
                            // If paused, also start playing
                            if (!isSurahAudioPlaying) {
                              setTimeout(() => toggleSurahAudio(), 50);
                            }
                          }
                        }}
                        style={{
                          backgroundColor: isSelected
                            ? "var(--accent-red, #DC2626)"
                            : isDark
                            ? "#334155"
                            : "#E2E8F0",
                          color: isSelected ? "#FFFFFF" : isDark ? "#F8FAFC" : "#0F172A",
                          border: "none",
                          borderRadius: "8px",
                          padding: "0.45rem 0.85rem",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.35rem",
                        }}
                      >
                        {isThisPlaying
                          ? "⏸ Pause"
                          : isSelected
                          ? "▶ Play This Qari"
                          : "Select Reciter"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: TRANSLATION PREFERENCES */}
          {activeTab === "translations" && (
            <div>
              <div style={{ marginBottom: "1.25rem" }}>
                <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>Translation & Tafsir Preferences</h3>
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem", opacity: 0.75 }}>
                  Select your primary Qur'an translation for reading and verse reflection across Noor Library.
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.85rem" }}>
                {modules.map((mod) => {
                  const targetLang = MODULE_TO_LANG_MAP[mod.id];
                  const isComingSoon = mod.id === "ig_quran" || mod.id === "tafseer_ibnkathir";
                  const isCurrentActive = isComingSoon
                    ? false
                    : selectedTranslationLang
                    ? targetLang === selectedTranslationLang
                    : mod.isActive;

                  return (
                    <div
                      key={mod.id}
                      style={{
                        backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                        borderRadius: "14px",
                        padding: "1rem 1.15rem",
                        border: isCurrentActive
                          ? "2px solid var(--accent-red, #DC2626)"
                          : `1px solid ${isDark ? "#334155" : "#E2E8F0"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "1rem",
                        boxShadow: isCurrentActive
                          ? "0 4px 12px rgba(220, 38, 38, 0.08)"
                          : "none",
                        opacity: isComingSoon ? 0.75 : 1,
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "1rem", fontWeight: 700 }}>{mod.title}</span>
                          <span
                            style={{
                              backgroundColor: "rgba(212, 175, 55, 0.15)",
                              color: "#D4AF37",
                              padding: "0.15rem 0.45rem",
                              borderRadius: "4px",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                            }}
                          >
                            {mod.language}
                          </span>
                          {mod.id === "tafseer_ibnkathir" ? (
                            <span
                              style={{
                                backgroundColor: "rgba(99, 102, 241, 0.15)",
                                color: "#6366F1",
                                padding: "0.15rem 0.45rem",
                                borderRadius: "4px",
                                fontSize: "0.7rem",
                                fontWeight: 700,
                              }}
                            >
                              Tafseer
                            </span>
                          ) : isComingSoon ? (
                            <span
                              style={{
                                backgroundColor: "rgba(217, 119, 6, 0.15)",
                                color: "#D97706",
                                padding: "0.15rem 0.45rem",
                                borderRadius: "4px",
                                fontSize: "0.7rem",
                                fontWeight: 700,
                              }}
                            >
                              Scholarly Review
                            </span>
                          ) : (
                            <span
                              style={{
                                backgroundColor: "rgba(22, 163, 74, 0.15)",
                                color: "#16A34A",
                                padding: "0.15rem 0.45rem",
                                borderRadius: "4px",
                                fontSize: "0.7rem",
                                fontWeight: 700,
                              }}
                            >
                              Verified
                            </span>
                          )}
                        </div>
                        <p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem", opacity: 0.8 }}>
                          {mod.translator} • {mod.sizeLabel}
                        </p>
                      </div>

                      <div>
                        {isComingSoon ? (
                          <button
                            disabled
                            style={{
                              backgroundColor: isDark ? "rgba(148, 163, 184, 0.12)" : "rgba(148, 163, 184, 0.15)",
                              color: "#94A3B8",
                              border: "none",
                              borderRadius: "8px",
                              padding: "0.5rem 1rem",
                              fontSize: "0.82rem",
                              fontWeight: 600,
                              cursor: "not-allowed",
                              display: "flex",
                              alignItems: "center",
                              gap: "5px",
                            }}
                          >
                            <span>⏳</span>
                            <span>Coming Soon</span>
                          </button>
                        ) : isCurrentActive ? (
                          <button
                            disabled
                            style={{
                              backgroundColor: "var(--accent-red, #DC2626)",
                              color: "#FFFFFF",
                              border: "none",
                              borderRadius: "8px",
                              padding: "0.5rem 1rem",
                              fontSize: "0.82rem",
                              fontWeight: 700,
                              cursor: "default",
                              boxShadow: "0 2px 8px rgba(220, 38, 38, 0.25)",
                            }}
                          >
                            ✓ Active in Reader
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleModuleActive(mod.id)}
                            style={{
                              backgroundColor: isDark ? "#334155" : "#E2E8F0",
                              color: isDark ? "#F8FAFC" : "#0F172A",
                              border: `1px solid ${isDark ? "#475569" : "#CBD5E1"}`,
                              borderRadius: "8px",
                              padding: "0.5rem 1rem",
                              fontSize: "0.82rem",
                              fontWeight: 600,
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                          >
                            Use Translation
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: TAJWEED (COMING SOON) */}
          {activeTab === "tajweed" && (
            <div style={{ textAlign: "center", padding: "4rem 1.5rem" }}>
              <div
                style={{
                  width: "72px",
                  height: "72px",
                  borderRadius: "36px",
                  backgroundColor: "rgba(212, 175, 55, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 1.25rem",
                  fontSize: "2rem",
                }}
              >
                🎨
              </div>
              <h3 style={{ fontSize: "1.35rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
                Tajweed Recitation & Rule Engine
              </h3>
              <div style={{ margin: "0.5rem 0 1rem" }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "4px 12px",
                    borderRadius: "12px",
                    backgroundColor: "rgba(212, 175, 55, 0.2)",
                    color: "var(--accent-gold, #D4AF37)",
                    fontWeight: 800,
                    fontSize: "0.75rem",
                    letterSpacing: "0.05em",
                  }}
                >
                  COMING SOON
                </span>
              </div>
              <p
                style={{
                  maxWidth: "460px",
                  margin: "0 auto",
                  fontSize: "0.9rem",
                  color: isDark ? "#94A3B8" : "#64748B",
                  lineHeight: 1.6,
                }}
              >
                Interactive Tajweed color-coding, articulation points (Makharij), and pronunciation audio guides are currently under active development. Prostration marks (Sajdah) remain fully enabled in your reader.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* SUB-MODAL: NEW NOTE */}
      {isNewNoteOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.8)",
            zIndex: 100000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={() => {
            setIsNewNoteOpen(false);
            setEditingReflectionId(null);
            setIsSurahPickerOpen(false);
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "540px",
              backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
              borderRadius: "16px",
              padding: "1.5rem",
              border: `1px solid ${isDark ? "#334155" : "#E2E8F0"}`,
              boxShadow: "0 20px 40px -10px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.25rem" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "inherit" }}>
                  {editingReflectionId ? "Edit Quran Reflection (Tadabbur)" : "Add Quran Reflection"}
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: isDark ? "#94A3B8" : "#64748B" }}>
                  Surah {selectedNoteSurah.transliteration} ({selectedNoteSurah.name}) • Ayah {noteVerseNum}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsNewNoteOpen(false);
                  setEditingReflectionId(null);
                  setIsSurahPickerOpen(false);
                }}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.25rem",
                  cursor: "pointer",
                  color: isDark ? "#94A3B8" : "#64748B",
                  padding: "4px 8px",
                  lineHeight: 1,
                }}
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Surah Selector */}
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.35rem", color: isDark ? "#94A3B8" : "#475569" }}>
                Select Surah:
              </label>
              <button
                type="button"
                onClick={() => setIsSurahPickerOpen(true)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.6rem 0.85rem",
                  borderRadius: "8px",
                  border: `1px solid ${isDark ? "#334155" : "#CBD5E1"}`,
                  backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                  color: "inherit",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "1.1rem" }}>📖</span>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                    Surah {selectedNoteSurah.id}. {selectedNoteSurah.transliteration} ({selectedNoteSurah.name})
                  </span>
                </div>
                <span
                  style={{
                    backgroundColor: "rgba(212, 175, 55, 0.15)",
                    color: "var(--accent-gold, #D4AF37)",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                  }}
                >
                  Change ▾
                </span>
              </button>
            </div>

            {/* Ayah Selector with Stepper */}
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.35rem", color: isDark ? "#94A3B8" : "#475569" }}>
                Ayah Number (1 – {selectedNoteSurah.total_verses || 286}):
              </label>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  type="number"
                  min={1}
                  max={selectedNoteSurah.total_verses || 286}
                  value={noteVerseNum}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setNoteVerseNum(val);
                  }}
                  style={{
                    flex: 1,
                    padding: "0.6rem 0.75rem",
                    borderRadius: "8px",
                    border: `1px solid ${isDark ? "#334155" : "#CBD5E1"}`,
                    backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                    color: "inherit",
                    fontSize: "0.95rem",
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const currentV = Number(noteVerseNum) || 1;
                    if (currentV > 1) {
                      setNoteVerseNum(currentV - 1);
                    }
                  }}
                  disabled={Number(noteVerseNum) <= 1}
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "8px",
                    border: `1px solid ${isDark ? "#334155" : "#CBD5E1"}`,
                    backgroundColor: isDark ? "#1E293B" : "#F1F5F9",
                    color: "inherit",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: Number(noteVerseNum) <= 1 ? "not-allowed" : "pointer",
                    opacity: Number(noteVerseNum) <= 1 ? 0.5 : 1,
                    fontSize: "1.2rem",
                    fontWeight: "bold",
                  }}
                  title="Previous Ayah"
                >
                  –
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const currentV = Number(noteVerseNum) || 1;
                    const maxV = selectedNoteSurah.total_verses || 286;
                    if (currentV < maxV) {
                      setNoteVerseNum(currentV + 1);
                    }
                  }}
                  disabled={Number(noteVerseNum) >= (selectedNoteSurah.total_verses || 286)}
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "8px",
                    border: `1px solid ${isDark ? "#334155" : "#CBD5E1"}`,
                    backgroundColor: isDark ? "#1E293B" : "#F1F5F9",
                    color: "inherit",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: Number(noteVerseNum) >= (selectedNoteSurah.total_verses || 286) ? "not-allowed" : "pointer",
                    opacity: Number(noteVerseNum) >= (selectedNoteSurah.total_verses || 286) ? 0.5 : 1,
                    fontSize: "1.2rem",
                    fontWeight: "bold",
                  }}
                  title="Next Ayah"
                >
                  +
                </button>
              </div>
            </div>

            {/* Existing Note Detection Banner */}
            {existingReflectionForSelectedVerse && existingReflectionForSelectedVerse.id !== editingReflectionId && (
              <div
                style={{
                  backgroundColor: "rgba(212, 175, 55, 0.12)",
                  border: "1px solid rgba(212, 175, 55, 0.35)",
                  borderRadius: "8px",
                  padding: "0.6rem 0.85rem",
                  marginBottom: "1rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.5rem",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--accent-gold, #D4AF37)" }}>
                    Existing Reflection Saved
                  </div>
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: isDark ? "#94A3B8" : "#64748B",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    "{existingReflectionForSelectedVerse.note}"
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNoteContent(existingReflectionForSelectedVerse.note);
                    setEditingReflectionId(existingReflectionForSelectedVerse.id);
                  }}
                  style={{
                    backgroundColor: "var(--accent-gold, #D4AF37)",
                    color: "#000000",
                    border: "none",
                    borderRadius: "6px",
                    padding: "4px 10px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  Load Note
                </button>
              </div>
            )}

            {/* Reflection Note Input */}
            <div style={{ marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: isDark ? "#94A3B8" : "#475569" }}>
                  Your Tadabbur / Spiritual Lesson:
                </label>
                {noteContent.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setNoteContent("")}
                    style={{
                      background: "none",
                      border: "none",
                      color: isDark ? "#94A3B8" : "#64748B",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      padding: "2px 4px",
                    }}
                  >
                    Clear text
                  </button>
                )}
              </div>
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="What did this verse teach you today? What personal action or spiritual lesson did you take from it?..."
                style={{
                  width: "100%",
                  minHeight: "120px",
                  padding: "0.75rem",
                  borderRadius: "8px",
                  border: `1px solid ${isDark ? "#334155" : "#CBD5E1"}`,
                  backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                  color: "inherit",
                  fontFamily: "inherit",
                  fontSize: "0.9rem",
                  lineHeight: 1.5,
                  resize: "vertical",
                }}
              />
            </div>

            {/* Buttons Row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                {(editingReflectionId || existingReflectionForSelectedVerse) && (
                  <button
                    type="button"
                    onClick={handleDeleteCurrentEditingReflection}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      padding: "0.55rem 0.9rem",
                      borderRadius: "8px",
                      border: "1px solid rgba(239, 68, 68, 0.4)",
                      backgroundColor: "rgba(239, 68, 68, 0.12)",
                      color: "#EF4444",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                    }}
                  >
                    <span>🗑️</span> Delete
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsNewNoteOpen(false);
                    setEditingReflectionId(null);
                    setIsSurahPickerOpen(false);
                  }}
                  style={{
                    padding: "0.55rem 1rem",
                    borderRadius: "8px",
                    border: `1px solid ${isDark ? "#334155" : "#CBD5E1"}`,
                    background: "none",
                    color: "inherit",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveNewNote}
                  style={{
                    padding: "0.55rem 1.25rem",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: "var(--accent-red, #DC2626)",
                    color: "#FFFFFF",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(220, 38, 38, 0.3)",
                  }}
                >
                  {editingReflectionId ? "Update Note" : "Save Reflection"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OVERLAY: SURAH PICKER FOR REFLECTION NOTE */}
      {isSurahPickerOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.85)",
            zIndex: 100002,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={() => {
            setIsSurahPickerOpen(false);
            setNoteSurahSearch("");
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "480px",
              maxHeight: "80vh",
              backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
              borderRadius: "16px",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              border: `1px solid ${isDark ? "#334155" : "#E2E8F0"}`,
              boxShadow: "0 20px 40px -10px rgba(0,0,0,0.6)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "1rem 1.25rem",
                borderBottom: `1px solid ${isDark ? "#1E293B" : "#F1F5F9"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>Select Surah</h4>
                <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: isDark ? "#94A3B8" : "#64748B" }}>
                  Currently: Surah {selectedNoteSurah.id}. {selectedNoteSurah.transliteration}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSurahPickerOpen(false);
                  setNoteSurahSearch("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  color: isDark ? "#94A3B8" : "#64748B",
                  padding: "4px",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "0.75rem 1.25rem", borderBottom: `1px solid ${isDark ? "#1E293B" : "#F1F5F9"}` }}>
              <input
                type="text"
                value={noteSurahSearch}
                onChange={(e) => setNoteSurahSearch(e.target.value)}
                placeholder="Search by name or number (e.g. 18, Kahf, Baqarah)..."
                autoFocus
                style={{
                  width: "100%",
                  padding: "0.6rem 0.85rem",
                  borderRadius: "8px",
                  border: `1px solid ${isDark ? "#334155" : "#CBD5E1"}`,
                  backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                  color: "inherit",
                  fontSize: "0.85rem",
                }}
              />
            </div>

            <div style={{ overflowY: "auto", flex: 1, maxHeight: "55vh", padding: "0.5rem" }}>
              {filteredNoteSurahs.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center", color: isDark ? "#94A3B8" : "#64748B", fontSize: "0.85rem" }}>
                  No matching Surah found
                </div>
              ) : (
                filteredNoteSurahs.map((s) => {
                  const isSelected = s.id === noteSurahId;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setNoteSurahId(s.id);
                        if (noteVerseNum > (s.total_verses || 286)) {
                          setNoteVerseNum(1);
                        }
                        setIsSurahPickerOpen(false);
                        setNoteSurahSearch("");
                      }}
                      style={{
                        width: "100%",
                        padding: "0.65rem 0.85rem",
                        borderRadius: "8px",
                        border: "none",
                        backgroundColor: isSelected
                          ? isDark
                            ? "rgba(212, 175, 55, 0.2)"
                            : "rgba(212, 175, 55, 0.15)"
                          : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: "pointer",
                        color: "inherit",
                        marginBottom: "2px",
                        textAlign: "left",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <span
                          style={{
                            width: "30px",
                            height: "30px",
                            borderRadius: "6px",
                            backgroundColor: isSelected
                              ? "var(--accent-gold, #D4AF37)"
                              : isDark
                              ? "#1E293B"
                              : "#F1F5F9",
                            color: isSelected ? "#000000" : isDark ? "#E2E8F0" : "#475569",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.8rem",
                            fontWeight: 700,
                          }}
                        >
                          {s.id}
                        </span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{s.transliteration}</div>
                          <div style={{ fontSize: "0.75rem", color: isDark ? "#94A3B8" : "#64748B" }}>
                            {s.total_verses} verses
                          </div>
                        </div>
                      </div>
                      <span
                        style={{
                          fontFamily: "var(--font-amiri, serif)",
                          fontSize: "1.1rem",
                          color: "var(--accent-gold, #D4AF37)",
                        }}
                      >
                        {s.name}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL: NEW MEMORIZATION PLAN */}
      {isNewPlanOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.8)",
            zIndex: 100000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={() => setIsNewPlanOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "520px",
              backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
              borderRadius: "16px",
              padding: "1.5rem",
              border: `1px solid ${isDark ? "#334155" : "#E2E8F0"}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 1rem" }}>New Memorization Target</h3>
            <div style={{ display: "flex", gap: "1rem", marginBottom: "0.75rem" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.3rem" }}>
                  Start Ayah:
                </label>
                <input
                  type="number"
                  min={1}
                  value={planStart}
                  onChange={(e) => setPlanStart(Number(e.target.value))}
                  style={{
                    width: "100%",
                    padding: "0.6rem",
                    borderRadius: "8px",
                    border: `1px solid ${isDark ? "#334155" : "#CBD5E1"}`,
                    backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                    color: "inherit",
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.3rem" }}>
                  End Ayah:
                </label>
                <input
                  type="number"
                  min={1}
                  value={planEnd}
                  onChange={(e) => setPlanEnd(Number(e.target.value))}
                  style={{
                    width: "100%",
                    padding: "0.6rem",
                    borderRadius: "8px",
                    border: `1px solid ${isDark ? "#334155" : "#CBD5E1"}`,
                    backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                    color: "inherit",
                  }}
                />
              </div>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.3rem" }}>
                Target Repetitions per Ayah:
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={planReps}
                onChange={(e) => setPlanReps(Number(e.target.value))}
                style={{
                  width: "100%",
                  padding: "0.6rem",
                  borderRadius: "8px",
                  border: `1px solid ${isDark ? "#334155" : "#CBD5E1"}`,
                  backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                  color: "inherit",
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                onClick={() => setIsNewPlanOpen(false)}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "8px",
                  border: `1px solid ${isDark ? "#334155" : "#CBD5E1"}`,
                  background: "none",
                  color: "inherit",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNewPlan}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: "var(--accent-red, #DC2626)",
                  color: "#FFFFFF",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Create Target
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

      {/* Floating Bottom Audio Player Bar when Hub is Closed and Audio is Playing */}
      {!isOpen && isSurahAudioPlaying && (
        <div
          style={{
            position: "fixed",
            bottom: "1.25rem",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 99990,
            width: "calc(100% - 2rem)",
            maxWidth: "760px",
            backgroundColor: isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(255, 255, 255, 0.97)",
            color: isDark ? "#F8FAFC" : "#0F172A",
            borderRadius: "16px",
            border: `1px solid ${isDark ? "#334155" : "#E2E8F0"}`,
            boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.45)",
            backdropFilter: "blur(12px)",
            padding: "0.6rem 1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.35rem",
          }}
        >
          {/* Top row: Info & Action Buttons */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: "1.1rem" }}>🎙️</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  Surah {audioSurahId}: {audioSurahInfo?.transliteration} ({audioSurahInfo?.name})
                </div>
                <div style={{ fontSize: "0.72rem", color: isDark ? "#94A3B8" : "#64748B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {activeQariProfile.name} • {audioPlaybackRate}x
                </div>
              </div>
            </div>

            {/* Quick Controls */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexShrink: 0 }}>
              {/* Prev Surah */}
              <button
                onClick={() => setAudioSurahId((prev) => Math.max(1, prev - 1))}
                disabled={audioSurahId <= 1}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: audioSurahId <= 1 ? "not-allowed" : "pointer",
                  color: audioSurahId <= 1 ? "rgba(100,116,139,0.3)" : isDark ? "#CBD5E1" : "#475569",
                  fontSize: "0.8rem",
                  padding: "0.2rem 0.35rem",
                  borderRadius: "6px",
                }}
                title="Previous Surah"
              >
                ⏮
              </button>

              {/* Skip Back 10s */}
              <button
                onClick={handleAudioSkipBack}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: isDark ? "#CBD5E1" : "#475569",
                  fontSize: "0.72rem",
                  padding: "0.25rem 0.35rem",
                  borderRadius: "6px",
                }}
                title="Rewind 10s"
              >
                ↺ 10s
              </button>

              {/* Play / Pause button */}
              <button
                onClick={toggleSurahAudio}
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  border: "none",
                  backgroundColor: "#DC2626",
                  color: "#FFFFFF",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.85rem",
                  boxShadow: "0 2px 6px rgba(220, 38, 38, 0.4)",
                }}
                title={isSurahAudioPlaying ? "Pause" : "Play"}
              >
                {isSurahAudioPlaying ? "❚❚" : "▶"}
              </button>

              {/* Skip Forward 10s */}
              <button
                onClick={handleAudioSkipForward}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: isDark ? "#CBD5E1" : "#475569",
                  fontSize: "0.72rem",
                  padding: "0.25rem 0.35rem",
                  borderRadius: "6px",
                }}
                title="Forward 10s"
              >
                ↻ 10s
              </button>

              {/* Next Surah */}
              <button
                onClick={() => setAudioSurahId((prev) => Math.min(114, prev + 1))}
                disabled={audioSurahId >= 114}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: audioSurahId >= 114 ? "not-allowed" : "pointer",
                  color: audioSurahId >= 114 ? "rgba(100,116,139,0.3)" : isDark ? "#CBD5E1" : "#475569",
                  fontSize: "0.8rem",
                  padding: "0.2rem 0.35rem",
                  borderRadius: "6px",
                }}
                title="Next Surah"
              >
                ⏭
              </button>

              {/* Jump to Active Ayah / Read Along Button */}
              {onJumpToAyah && (
                <button
                  onClick={() => {
                    onJumpToAyah(activeEstimatedAyah, audioSurahId);
                  }}
                  style={{
                    marginLeft: "0.25rem",
                    padding: "0.22rem 0.55rem",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    borderRadius: "6px",
                    border: "1px solid #10B981",
                    backgroundColor: "rgba(16, 185, 129, 0.15)",
                    color: "#10B981",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                  title={`Jump to currently playing Ayah ${activeEstimatedAyah}`}
                >
                  📖 Ayah {activeEstimatedAyah}
                </button>
              )}

              {/* Open Hub Button */}
              {onOpen && (
                <button
                  onClick={() => {
                    setActiveTab("audio");
                    onOpen();
                  }}
                  style={{
                    marginLeft: "0.25rem",
                    padding: "0.22rem 0.55rem",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    borderRadius: "6px",
                    border: "1px solid #D4AF37",
                    backgroundColor: "rgba(212, 175, 55, 0.15)",
                    color: "#D4AF37",
                    cursor: "pointer",
                  }}
                  title="Open full audio reciter controls"
                >
                  Expand
                </button>
              )}

              {/* Stop & Close Mini Player */}
              <button
                onClick={() => {
                  if (surahAudioRef.current) {
                    surahAudioRef.current.pause();
                    surahAudioRef.current.currentTime = 0;
                  }
                  setIsSurahAudioPlaying(false);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: isDark ? "#94A3B8" : "#94A3B8",
                  fontSize: "1rem",
                  padding: "0.2rem 0.4rem",
                  marginLeft: "0.2rem",
                }}
                title="Stop Audio"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Bottom row: Scrubber and timestamps */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.7rem", fontFamily: "monospace", color: isDark ? "#94A3B8" : "#64748B", minWidth: "35px" }}>
              {formatAudioTime(audioCurrentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={audioDuration || 100}
              step={0.5}
              value={audioCurrentTime}
              onChange={handleAudioSeek}
              style={{
                flex: 1,
                accentColor: "#DC2626",
                cursor: "pointer",
                height: "4px",
              }}
            />
            <span style={{ fontSize: "0.7rem", fontFamily: "monospace", color: isDark ? "#94A3B8" : "#64748B", minWidth: "35px", textAlign: "right" }}>
              {formatAudioTime(audioDuration)}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
