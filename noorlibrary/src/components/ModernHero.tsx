"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./ModernHero.module.css";

// Quick surah lookup for natural language jumping
const SURAH_MAP: Record<string, number> = {
  fatihah: 1,
  baqarah: 2,
  "ali imran": 3,
  imran: 3,
  nisa: 4,
  maidah: 5,
  anam: 6,
  araf: 7,
  anfal: 8,
  tawbah: 9,
  yunus: 10,
  hud: 11,
  yusuf: 12,
  rad: 13,
  ibrahim: 14,
  hijr: 15,
  nahl: 16,
  isra: 17,
  kahf: 18,
  maryam: 19,
  taha: 20,
  anbiya: 21,
  hajj: 22,
  muminun: 23,
  nur: 24,
  furqan: 25,
  yasin: 36,
  rahman: 55,
  waqiah: 56,
  mulk: 67,
  qalam: 68,
  jinn: 72,
  muzzammil: 73,
  muddathir: 74,
  insan: 76,
  naba: 78,
  duha: 93,
  sharh: 94,
  inshirah: 94,
  tin: 95,
  alaq: 96,
  qadr: 97,
  asr: 103,
  kawthar: 108,
  kafirun: 109,
  ikhlas: 112,
  falaq: 113,
  nas: 114,
};

export default function ModernHero() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showAppModal, setShowAppModal] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<"apple" | "google" | "general">("general");
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim().toLowerCase();
    if (!q) return;

    // 1. Ayah Jump: "2:255" or "18:10"
    const ayahMatch = q.match(/^(\d{1,3}):(\d{1,3})$/);
    if (ayahMatch) {
      const surahId = parseInt(ayahMatch[1], 10);
      const verseId = parseInt(ayahMatch[2], 10);
      if (surahId >= 1 && surahId <= 114) {
        router.push(`/quran/${surahId}#verse-${verseId}`);
        return;
      }
    }

    // 2. Surah Number: "18" or "67"
    const num = parseInt(q, 10);
    if (!isNaN(num) && num >= 1 && num <= 114 && String(num) === q) {
      router.push(`/quran/${num}`);
      return;
    }

    // 3. Surah Name: "Kahf", "Mulk", etc.
    for (const [name, id] of Object.entries(SURAH_MAP)) {
      if (q.includes(name)) {
        router.push(`/quran/${id}`);
        return;
      }
    }

    // 4. Adhkar keywords
    if (
      q.includes("adhkar") ||
      q.includes("dua") ||
      q.includes("hisn") ||
      q.includes("morning") ||
      q.includes("evening")
    ) {
      router.push("/adhkaar");
      return;
    }

    // 5. Default search query in Quran
    router.push(`/quran?q=${encodeURIComponent(query.trim())}`);
  };

  const openAppModal = (platform: "apple" | "google") => {
    setSelectedPlatform(platform);
    setShowAppModal(true);
    setSubscribed(false);
  };

  const handleNotifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) return;

    // Store in localStorage for notification readiness
    try {
      const existing = JSON.parse(localStorage.getItem("@noor_app_waitlist") || "[]");
      existing.push({ email: email.trim(), platform: selectedPlatform, date: new Date().toISOString() });
      localStorage.setItem("@noor_app_waitlist", JSON.stringify(existing));
    } catch {
      // safe fallback
    }

    setSubscribed(true);
  };

  return (
    <section className={styles.heroSection}>
      {/* ── Ambient Glow Backplates ── */}
      <div className={styles.ambientGlowPrimary} aria-hidden="true" />
      <div className={styles.ambientGlowSecondary} aria-hidden="true" />

      <div className={styles.heroContainer}>
        {/* ──────── LEFT COLUMN: Content & Interactive Controls ──────── */}
        <div className={styles.leftColumn}>
          {/* 1. Sacred Bismillah */}
          <div className={styles.bismillah}>
            Assalamu Alaikum,
          </div>

          {/* 2. Sanctuary Badge */}
          <div className={styles.pillBadge}>
            <span className={styles.liveDot} />
            <span>Digital Islamic Sanctuary</span>
          </div>

          {/* 3. Main Headline */}
          <h1 className={styles.headline}>
            Illuminating Minds with
            <span className={styles.gradientText}> Authentic Knowledge</span>
          </h1>

          {/* 4. Subtitle */}
          <p className={styles.subheadline}>
            A digital Islamic sanctuary dedicated to preserving and disseminating
            authentic Islamic knowledge. Immerse yourself in the Noble Quran, authentic
            Hadith, daily Adhkar, verified prayer times, and classical treatises in a peaceful,
            intuitive space.
          </p>

          {/* 5. Unified Search & Verse Jump */}
          <form onSubmit={handleSearch} className={styles.searchForm}>
            <div className={styles.searchBox}>
              <span className={styles.searchIcon} aria-hidden="true">
                🔍
              </span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Jump to verse (e.g. 2:255) or search Surah / Dua..."
                className={styles.searchInput}
                aria-label="Search Quran or jump to verse"
              />
              <button type="submit" className={styles.jumpButton} style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                <span>Jump</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </button>
            </div>
          </form>

          {/* 6. Quick Jump Pills */}
          <div className={styles.quickPills}>
            {[
              { label: "Ayat al-Kursi (2:255)", href: "/quran/2#verse-255" },
              { label: "Surah Al-Kahf (18)", href: "/quran/18" },
              { label: "Morning Adhkar", href: "/adhkaar" },
              { label: "Surah Al-Mulk (67)", href: "/quran/67" },
            ].map((item, idx) => (
              <Link key={idx} href={item.href} className={styles.quickPillLink}>
                {item.label}
              </Link>
            ))}
          </div>

          {/* 7. Action CTAs */}
          <div className={styles.ctaRow}>
            <Link href="/quran" className={styles.primaryCta}>
              <span>Read Holy Quran</span>
              <span aria-hidden="true">📖</span>
            </Link>
            <Link href="/adhkaar" className={styles.secondaryCta}>
              <span>Daily Adhkar</span>
              <span aria-hidden="true">🤲</span>
            </Link>
            <Link href="/books" className={styles.secondaryCta}>
              <span>Browse Library</span>
              <span aria-hidden="true">📚</span>
            </Link>
          </div>

          {/* 8. Temporary / Coming Soon Mobile App Section */}
          <div className={styles.storeSection}>
            <div className={styles.storeHeader}>
              <span className={styles.storeTitle}>📱 Mobile App Coming Soon</span>
              <span className={styles.storeBadgePill}>Store Review</span>
            </div>

            <div className={styles.storeButtons}>
              {/* Apple App Store Button */}
              <button
                type="button"
                onClick={() => openAppModal("apple")}
                className={styles.storeBtn}
                title="Noor Library for iOS - Coming soon to the App Store"
              >
                <div className={styles.storeBtnIcon}>
                  {/* Apple SVG Logo */}
                  <svg width="20" height="24" viewBox="0 0 170 170" fill="currentColor">
                    <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.67-7.81-11.96-14.31-7.85-11.96-13.88-25.75-18.08-41.38-4.2-15.63-6.3-30.08-6.3-43.34 0-16.1 3.91-29.62 11.73-40.56 7.82-10.94 17.84-16.51 30.07-16.71 4.58 0 9.87 1.25 15.86 3.75 5.99 2.5 9.94 3.75 11.85 3.75 1.5 0 5.48-1.28 11.96-3.85 6.47-2.57 11.53-3.72 15.17-3.45 14.15.82 25.13 6.07 32.96 15.75-12.44 7.54-18.52 17.89-18.25 31.06.27 10.28 4.23 18.89 11.88 25.82 7.64 6.93 16.73 10.97 27.27 12.13-2.31 7.21-5.11 14.77-8.41 22.68zM119.22 33.56c0-7.39 2.68-14.41 8.04-21.06 5.37-6.65 11.97-10.87 19.8-12.66.41 1.77.62 3.48.62 5.13 0 7.39-2.82 14.54-8.46 21.46-5.63 6.92-12.28 11.13-19.93 12.63-.07-1.74-.07-3.57-.07-5.5z" />
                  </svg>
                </div>
                <div className={styles.storeBtnText}>
                  <span className={styles.storeBtnSub}>Download on the</span>
                  <span className={styles.storeBtnMain}>App Store</span>
                </div>
                {/* <span className={styles.storeBtnStatus}>Coming Soon</span> */}
              </button>

              {/* Google Play Store Button */}
              <button
                type="button"
                onClick={() => openAppModal("google")}
                className={styles.storeBtn}
                title="Noor Library for Android - Coming soon to Google Play"
              >
                <div className={styles.storeBtnIcon}>
                  {/* Google Play SVG Logo */}
                  <svg width="22" height="24" viewBox="0 0 512 512" fill="none">
                    <path
                      d="M325.3 234.3L104.6 13l280.8 161.2-60.1 59.1z"
                      fill="#EA4335"
                    />
                    <path
                      d="M47 38.6c-5.8 8.4-9.3 19-9.3 31.4v372c0 12.4 3.5 23 9.3 31.4L266 256 47 38.6z"
                      fill="#4285F4"
                    />
                    <path
                      d="M325.3 277.7l60.1 59.1L104.6 499l220.7-221.3z"
                      fill="#34A853"
                    />
                    <path
                      d="M456.8 238.4l-71.4-41-60.1 59.1 60.1 59.1 71.4-41c14.3-8.2 23.2-22.9 23.2-38.1s-8.9-29.9-23.2-38.1z"
                      fill="#FBBC04"
                    />
                  </svg>
                </div>
                <div className={styles.storeBtnText}>
                  <span className={styles.storeBtnSub}>GET IT ON</span>
                  <span className={styles.storeBtnMain}>Google Play</span>
                </div>
                {/* <span className={styles.storeBtnStatus}>Coming Soon</span> */}
              </button>
            </div>
          </div>
        </div>

        {/* ──────── RIGHT COLUMN: High-Fidelity Mobile App Showcase ──────── */}
        <div className={styles.rightColumn}>
          {/* Ambient Rim Backlight */}
          <div className={styles.phoneBacklight} aria-hidden="true" />

          {/* Floating Pill Top Right */}
          <div className={styles.floatingBadgeTop}>
            <span style={{ color: "#D4AF37" }}>✦</span>
            <span>Authentic &amp; Verified Knowledge</span>
          </div>

          {/* Floating Badge Bottom Left */}
          <div className={styles.floatingBadgeBottom}>
            <div className={styles.floatingBadgeIcon}>🔔</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.78rem" }}>Adhan & Solat</div>
              <div style={{ fontSize: "0.65rem", color: "#94a3b8" }}>Lagos Verified Alarms</div>
            </div>
          </div>

          {/* Realistic Smartphone Chassis */}
          <div className={styles.phoneWrapper}>
            <div className={styles.phoneFrame}>
              {/* Dynamic Island */}
              <div className={styles.dynamicIsland}>
                <div className={styles.cameraLens} />
                <div className={styles.sensorIndicator} />
              </div>

              {/* Status Bar */}
              <div className={styles.phoneStatusBar}>
                <span>9:41</span>
                <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
                  <span>📶</span>
                  <span>5G</span>
                  <span>🔋</span>
                </div>
              </div>

              {/* Screen Content */}
              <div className={styles.phoneScreen}>
                {/* App Top Bar */}
                <div className={styles.appHeader}>
                  <div className={styles.appBrand}>
                    <div className={styles.appLogoIcon}>ن</div>
                    <span className={styles.appName}>Noor Library</span>
                  </div>
                  <div className={styles.prayerPill}>
                    <span>🕌 Asr in 35m</span>
                  </div>
                </div>

                {/* Verse of the Day Card */}
                <div className={styles.ayahCard}>
                  <div className={styles.ayahHeader}>
                    <span className={styles.ayahTag}>Ayah of the Day</span>
                    <span className={styles.ayahNumber}>Al-Baqarah 2:152</span>
                  </div>
                  <div className={styles.arabicVerse}>
                    فَاذْكُرُونِي أَذْكُرْكُمْ وَاشْكُرُوا لِي وَلَا تَكْفُرُونِ
                  </div>
                  <div className={styles.translationVerse}>
                    &ldquo;So remember Me; I will remember you. And be grateful to Me and do not deny Me.&rdquo;
                  </div>
                </div>

                {/* Audio Recitation Widget */}
                <div className={styles.audioWidget}>
                  <div className={styles.audioHeader}>
                    <div className={styles.audioInfo}>
                      <span className={styles.audioTitle}>Surah Ar-Rahman (Recitation)</span>
                      <span className={styles.audioReciter}>Mishary Rashid Alafasy</span>
                    </div>
                    {/* Animated Equalizer Wave Bars */}
                    <div className={styles.audioEqualizer}>
                      <span className={styles.waveBar} />
                      <span className={styles.waveBar} />
                      <span className={styles.waveBar} />
                      <span className={styles.waveBar} />
                      <span className={styles.waveBar} />
                    </div>
                  </div>

                  <div className={styles.audioProgressRow}>
                    <div className={styles.audioProgressBar}>
                      <div className={styles.audioProgressFill} />
                    </div>
                    <span className={styles.audioTime}>02:14 / 09:30</span>
                  </div>
                </div>

                {/* Features Mini Grid */}
                <div className={styles.phoneFeaturesGrid}>
                  <div className={styles.phoneFeatureCard}>
                    <span className={styles.featureCardIcon}>📖</span>
                    <span className={styles.featureCardTitle}>114 Surahs</span>
                    <span className={styles.featureCardDesc}>Offline Audio & Translation</span>
                  </div>
                  <div className={styles.phoneFeatureCard}>
                    <span className={styles.featureCardIcon}>🤲</span>
                    <span className={styles.featureCardTitle}>Daily Adhkar</span>
                    <span className={styles.featureCardDesc}>Haptic Counter & Duas</span>
                  </div>
                  <div className={styles.phoneFeatureCard}>
                    <span className={styles.featureCardIcon}>🕋</span>
                    <span className={styles.featureCardTitle}>Qibla & Solat</span>
                    <span className={styles.featureCardDesc}>Accurate GPS Timings</span>
                  </div>
                  <div className={styles.phoneFeatureCard}>
                    <span className={styles.featureCardIcon}>📚</span>
                    <span className={styles.featureCardTitle}>Islamic Library</span>
                    <span className={styles.featureCardDesc}>Offline PDF Treatises</span>
                  </div>
                </div>
              </div>

              {/* Bottom Nav */}
              <div className={styles.phoneBottomNav}>
                <div className={styles.navItem}>
                  <span className={styles.navIcon}>🏠</span>
                  <span>Home</span>
                </div>
                <div className={`${styles.navItem} ${styles.navItemActive}`}>
                  <span className={styles.navIcon}>📖</span>
                  <span>Quran</span>
                </div>
                <div className={styles.navItem}>
                  <span className={styles.navIcon}>🤲</span>
                  <span>Adhkar</span>
                </div>
                <div className={styles.navItem}>
                  <span className={styles.navIcon}>📚</span>
                  <span>Library</span>
                </div>
                <div className={styles.navItem}>
                  <span className={styles.navIcon}>👤</span>
                  <span>Profile</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ──────── STORE PRE-REGISTER / NOTIFY MODAL ──────── */}
      {showAppModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.2rem",
          }}
          onClick={() => setShowAppModal(false)}
        >
          <div
            style={{
              backgroundColor: "var(--bg-secondary, #111827)",
              border: "1px solid var(--border-color, rgba(212, 175, 55, 0.3))",
              borderRadius: "20px",
              padding: "2rem",
              maxWidth: "460px",
              width: "100%",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.5)",
              position: "relative",
              color: "var(--text-primary, #f8fafc)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowAppModal(false)}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                background: "transparent",
                border: "none",
                fontSize: "1.3rem",
                color: "var(--text-muted, #94a3b8)",
                cursor: "pointer",
              }}
              aria-label="Close dialog"
            >
              ✕
            </button>

            {/* Modal Header */}
            <div style={{ textAlign: "center", marginBottom: "1.4rem" }}>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "16px",
                  background: "linear-gradient(135deg, #DC2626 0%, #D4AF37 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.7rem",
                  color: "#FFFFFF",
                  margin: "0 auto 0.9rem",
                  boxShadow: "0 8px 20px rgba(220, 38, 38, 0.3)",
                }}
              >
                ن
              </div>
              <h3
                style={{
                  fontFamily: "Outfit, sans-serif",
                  fontSize: "1.45rem",
                  fontWeight: 700,
                  marginBottom: "0.4rem",
                }}
              >
                Noor Library Mobile App
              </h3>
              <p
                style={{
                  fontSize: "0.88rem",
                  color: "var(--text-secondary, #cbd5e1)",
                  lineHeight: 1.5,
                }}
              >
                {selectedPlatform === "apple"
                  ? "Currently in final review for the Apple App Store."
                  : "Currently preparing for publication on Google Play Store."}
                <br />
                Pre-register to be alerted the exact moment it becomes available!
              </p>
            </div>

            {/* Feature Highlights */}
            <div
              style={{
                backgroundColor: "rgba(212, 175, 55, 0.06)",
                border: "1px solid rgba(212, 175, 55, 0.2)",
                borderRadius: "12px",
                padding: "0.85rem 1rem",
                marginBottom: "1.5rem",
                fontSize: "0.82rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.4rem",
              }}
            >
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <span>✨</span>
                <span>Complete offline Holy Quran with verse-by-verse audio</span>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <span>🔔</span>
                <span>Automatic Adhan alarms and daily prayer timings</span>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <span>🤲</span>
                <span>Daily morning & evening Adhkar with haptic counter</span>
              </div>
            </div>

            {/* Pre-Register Form */}
            {subscribed ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "1rem",
                  backgroundColor: "rgba(16, 185, 129, 0.12)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  borderRadius: "12px",
                  color: "#10b981",
                  fontWeight: 600,
                  fontSize: "0.92rem",
                }}
              >
                🎉 Alhamdulillah! You are on the early access list. We will email you upon public release!
              </div>
            ) : (
              <form onSubmit={handleNotifySubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email for launch notification..."
                  required
                  style={{
                    padding: "0.75rem 1rem",
                    borderRadius: "10px",
                    border: "1px solid var(--border-color, #334155)",
                    backgroundColor: "var(--bg-primary, #0b0f19)",
                    color: "#f8fafc",
                    fontSize: "0.9rem",
                    outline: "none",
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: "0.75rem",
                    borderRadius: "10px",
                    border: "none",
                    background: "linear-gradient(135deg, #DC2626 0%, #D4AF37 100%)",
                    color: "#FFFFFF",
                    fontWeight: 700,
                    fontSize: "0.95rem",
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(220, 38, 38, 0.35)",
                    transition: "opacity 0.2s ease",
                  }}
                >
                  Notify Me When Live 🚀
                </button>
              </form>
            )}

            <div
              style={{
                marginTop: "1.2rem",
                textAlign: "center",
                fontSize: "0.74rem",
                color: "var(--text-muted, #94a3b8)",
              }}
            >
              No spam ever. 100% free sacred knowledge sanctuary.
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
