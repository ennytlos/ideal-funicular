"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useApp } from "../../context/AppContext";
import { db } from "../../lib/firebase";
import { doc, updateDoc, onSnapshot } from "firebase/firestore";

interface PrayerTimings {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Sunset: string;
  Maghrib: string;
  Isha: string;
  Imsak: string;
  Midnight: string;
}

interface HijriDate {
  date: string;
  day: string;
  month: {
    number: number;
    ar: string;
    en: string;
  };
  year: string;
  designator: {
    abbreviated: string;
  };
}

const DEFAULT_CITIES = [
  { name: "Lagos, Nigeria", lat: 6.5244, lng: 3.3792 },
  { name: "Abuja, Nigeria", lat: 9.0765, lng: 7.3986 },
  { name: "Kano, Nigeria", lat: 12.0022, lng: 8.5919 },
  { name: "Ibadan, Nigeria", lat: 7.3775, lng: 3.9470 },
  { name: "Kaduna, Nigeria", lat: 10.5105, lng: 7.4165 },
  { name: "Ilorin, Nigeria", lat: 8.4799, lng: 4.5418 },
  { name: "Makkah, Saudi Arabia", lat: 21.3891, lng: 39.8579 },
  { name: "Cairo, Egypt", lat: 30.0444, lng: 31.2357 },
  { name: "London, UK", lat: 51.5074, lng: -0.1278 },
  { name: "New York, USA", lat: 40.7128, lng: -74.006 },
  { name: "Jakarta, Indonesia", lat: -6.2088, lng: 106.8456 },
  { name: "Riyadh, Saudi Arabia", lat: 24.7136, lng: 46.6753 },
  { name: "Karachi, Pakistan", lat: 24.8607, lng: 67.0011 },
  { name: "Dubai, UAE", lat: 25.2048, lng: 55.2708 },
  { name: "Kuala Lumpur, Malaysia", lat: 3.139, lng: 101.6869 },
];

const CALC_METHODS = [
  { id: 5, name: "Egyptian General Authority (Common in Nigeria & Africa)" },
  { id: 3, name: "Muslim World League (MWL) - Default" },
  { id: 4, name: "Umm Al-Qura University, Makkah" },
  { id: 2, name: "Islamic Society of North America (ISNA)" },
  { id: 1, name: "University of Islamic Sciences, Karachi" },
  { id: 8, name: "Gulf Region" },
  { id: 12, name: "Union des Organisations Islamiques de France" },
  { id: 13, name: "Diyanet İşleri Başkanlığı (Turkey)" },
];

const ADHAN_AUDIO_URL = "https://www.islamcan.com/audio/adhan/makkah.mp3";
const CHIME_AUDIO_URL = "https://assets.mixkit.co/active_storage/sfx/2568/2568-84.wav";

export default function SolatAndQiyamPortal() {
  const { user } = useApp();

  // Coordinates & Location details
  const [lat, setLat] = useState<number>(21.3891); // Makkah default
  const [lng, setLng] = useState<number>(39.8579);
  const [cityName, setCityName] = useState<string>("Makkah, Saudi Arabia");
  const [selectedMethod, setSelectedMethod] = useState<number>(3); // MWL default

  // Loading and error states
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Timings & Hijri data from API
  const [timings, setTimings] = useState<PrayerTimings | null>(null);
  const [hijriDate, setHijriDate] = useState<HijriDate | null>(null);

  // Settings: Audio alerts, push notifications, and Qiyam settings
  const [audioAlert, setAudioAlert] = useState<"adhan" | "chime" | "none">("chime");
  const [pushEnabled, setPushEnabled] = useState<boolean>(false);
  
  // Qiyam settings
  const [qiyamEnabled, setQiyamEnabled] = useState<boolean>(true);
  const [qiyamOption, setQiyamOption] = useState<"third" | "midnight" | "fajr1h" | "custom">("third");
  const [qiyamCustomTime, setQiyamCustomTime] = useState<string>("03:30");

  // Real-time Clock states
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [nextPrayerName, setNextPrayerName] = useState<string>("");
  const [nextPrayerCountdown, setNextPrayerCountdown] = useState<string>("");
  const [currentPrayerName, setCurrentPrayerName] = useState<string>("");
  const [prayerProgress, setPrayerProgress] = useState<number>(0);

  // Audio elements references
  const adhanAudioRef = useRef<HTMLAudioElement | null>(null);
  const chimeAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingTestAdhan, setIsPlayingTestAdhan] = useState<boolean>(false);
  const [isPlayingTestChime, setIsPlayingTestChime] = useState<boolean>(false);

  // Geolocation lookup state
  const [isLocating, setIsLocating] = useState<boolean>(false);

  // Bug#4 fix: separate triggered refs for prayer vs Qiyam to avoid shared guard race
  const lastTriggeredPrayerRef = useRef<string>("");
  const lastTriggeredQiyamRef = useRef<string>("");

  // Bug#10 fix: track the calendar date so we can auto-refresh timings at midnight
  const lastFetchedDateRef = useRef<string>("");

  // Set up audio objects on mount
  useEffect(() => {
    adhanAudioRef.current = new Audio(ADHAN_AUDIO_URL);
    chimeAudioRef.current = new Audio(CHIME_AUDIO_URL);
    return () => {
      adhanAudioRef.current?.pause();
      chimeAudioRef.current?.pause();
    };
  }, []);

  // 1. Sync state/settings from profile if logged in
  useEffect(() => {
    if (!user) {
      // Load settings from localStorage
      const cachedSettings = localStorage.getItem("noorPrayerSettings");
      if (cachedSettings) {
        try {
          const s = JSON.parse(cachedSettings);
          setLat(s.lat ?? 21.3891);
          setLng(s.lng ?? 39.8579);
          setCityName(s.cityName ?? "Makkah, Saudi Arabia");
          setSelectedMethod(s.method ?? 3);
          setAudioAlert(s.audioAlert ?? "chime");
          setPushEnabled(s.pushEnabled ?? false);
          setQiyamEnabled(s.qiyamEnabled ?? true);
          setQiyamOption(s.qiyamOption ?? "third");
          setQiyamCustomTime(s.qiyamCustomTime ?? "03:30");
        } catch (e) {
          // ignore
        }
      }
      return;
    }

    const userDocRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const s = data.prayerSettings;
        if (s) {
          setLat(s.lat ?? 21.3891);
          setLng(s.lng ?? 39.8579);
          setCityName(s.cityName ?? "Makkah, Saudi Arabia");
          setSelectedMethod(s.method ?? 3);
          setAudioAlert(s.audioAlert ?? "chime");
          setPushEnabled(s.pushEnabled ?? false);
          setQiyamEnabled(s.qiyamEnabled ?? true);
          setQiyamOption(s.qiyamOption ?? "third");
          setQiyamCustomTime(s.qiyamCustomTime ?? "03:30");
        }
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Helper: Persist Settings to Cloud (Firestore) or Local
  const saveSettings = async (updates: Record<string, any>) => {
    // Merge updates into current state values for localStorage / Firestore
    const current = {
      lat,
      lng,
      cityName,
      method: selectedMethod,
      audioAlert,
      pushEnabled,
      qiyamEnabled,
      qiyamOption,
      qiyamCustomTime,
      ...updates,
    };

    if (!user) {
      localStorage.setItem("noorPrayerSettings", JSON.stringify(current));
      return;
    }

    const userDocRef = doc(db, "users", user.uid);
    try {
      await updateDoc(userDocRef, {
        prayerSettings: current,
      });
    } catch (err) {
      console.error("Failed to sync prayer settings with cloud profile", err);
    }
  };

  // 2. Fetch Daily timings from Aladhan API
  // Bug#1 fix: re-sample date inside fetch (not from stale state) so timings refresh after midnight
  const fetchTimings = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      const dateStr = formatDateForAPI(now);
      lastFetchedDateRef.current = dateStr;
      const url = `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${lat}&longitude=${lng}&method=${selectedMethod}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Could not retrieve prayer timings from Aladhan server.");
      
      const data = await res.json();
      if (data.code === 200 && data.data) {
        const apiTimings = data.data.timings as PrayerTimings;
        setTimings(apiTimings);
        setHijriDate(data.data.date.hijri as HijriDate);
      } else {
        throw new Error("Invalid API response format");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load timings. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, [lat, lng, selectedMethod]);

  useEffect(() => {
    fetchTimings();
  }, [fetchTimings]);

  // Bug#10 fix: auto-refresh timings at midnight (when the calendar date changes)
  useEffect(() => {
    const midnightCheck = setInterval(() => {
      const todayStr = formatDateForAPI(new Date());
      if (lastFetchedDateRef.current && lastFetchedDateRef.current !== todayStr) {
        fetchTimings();
      }
    }, 60 * 1000); // check every minute
    return () => clearInterval(midnightCheck);
  }, [fetchTimings]);

  // Format Helper: DD-MM-YYYY
  const formatDateForAPI = (date: Date) => {
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  // 3. Geolocation Auto-Detection
  const detectLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        setLat(latitude);
        setLng(longitude);
        setCityName("Auto-Detected GPS Location");
        setIsLocating(false);

        // Try to reverse geocode name using openstreetmap Nominatim (No API key needed)
        // Bug#14 fix: add required User-Agent header per Nominatim usage policy
        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`,
            { headers: { "User-Agent": "NoorLibrary/1.0 (contact@noorlibrary.com)" } }
          );
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            const displayName = geoData.address.city || geoData.address.town || geoData.address.village || geoData.address.county || geoData.address.country || "Detected Location";
            const fullStr = `${displayName} (${latitude.toFixed(2)}, ${longitude.toFixed(2)})`;
            setCityName(fullStr);
            saveSettings({ lat: latitude, lng: longitude, cityName: fullStr });
          } else {
            saveSettings({ lat: latitude, lng: longitude, cityName: "Auto-Detected GPS Location" });
          }
        } catch (e) {
          saveSettings({ lat: latitude, lng: longitude, cityName: "Auto-Detected GPS Location" });
        }
      },
      (err) => {
        console.error("GPS error:", err);
        alert(`Location access failed: ${err.message}. Please select a city manually.`);
        setIsLocating(false);
      },
      { timeout: 10000 }
    );
  };

  const handleCitySelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "gps") {
      detectLocation();
      return;
    }
    const city = DEFAULT_CITIES.find((c) => c.name === val);
    if (city) {
      setLat(city.lat);
      setLng(city.lng);
      setCityName(city.name);
      saveSettings({ lat: city.lat, lng: city.lng, cityName: city.name });
    }
  };

  const requestNotificationPermission = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setPushEnabled(true);
        saveSettings({ pushEnabled: true });
        new Notification("Notifications Enabled!", {
          body: "Noor Library will now notify you when it's time for prayer.",
          icon: "/noor_logo.png",
        });
      } else {
        setPushEnabled(false);
        saveSettings({ pushEnabled: false });
        alert("Notification permissions denied. Enable them in your browser settings.");
      }
    } else {
      alert("Desktop notifications are not supported on this browser.");
    }
  };

  const togglePushNotifications = () => {
    if (pushEnabled) {
      setPushEnabled(false);
      saveSettings({ pushEnabled: false });
    } else {
      requestNotificationPermission();
    }
  };

  // 4. Night Prayer (Qiyam al-Layl) timing calculations
  const nightCalculations = useMemo(() => {
    if (!timings) return null;

    // Helper: Parse time string "HH:MM" to minutes from midnight
    const parseTime = (tStr: string) => {
      const clean = tStr.split(" ")[0]; // strip timezone names if any
      const [h, m] = clean.split(":").map(Number);
      return h * 60 + m;
    };

    const formatMins = (mins: number) => {
      const h = Math.floor((mins % 1440) / 60);
      const m = Math.floor(mins % 60);
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    };

    const maghribMins = parseTime(timings.Maghrib);
    const fajrMins = parseTime(timings.Fajr);

    let nightLength = 0;
    if (fajrMins < maghribMins) {
      // Night crosses calendar day
      nightLength = (1440 - maghribMins) + fajrMins;
    } else {
      nightLength = fajrMins - maghribMins;
    }

    const halfNight = nightLength / 2;
    const thirdNight = nightLength / 3;

    // Islamic Midnight: exactly halfway between Maghrib and Fajr
    const midnightMins = (maghribMins + halfNight) % 1440;

    // Start of the Last Third of the Night: Fajr minus one third of night length
    let lastThirdMins = fajrMins - thirdNight;
    if (lastThirdMins < 0) lastThirdMins += 1440;

    // Calculated time based on chosen option
    let calculatedQiyamMins = lastThirdMins;
    if (qiyamOption === "midnight") {
      calculatedQiyamMins = midnightMins;
    } else if (qiyamOption === "fajr1h") {
      calculatedQiyamMins = fajrMins - 60;
      if (calculatedQiyamMins < 0) calculatedQiyamMins += 1440;
    } else if (qiyamOption === "custom") {
      calculatedQiyamMins = parseTime(qiyamCustomTime);
    }

    return {
      durationStr: `${Math.floor(nightLength / 60)}h ${Math.floor(nightLength % 60)}m`,
      midnightStr: formatMins(midnightMins),
      lastThirdStartStr: formatMins(lastThirdMins),
      qiyamAlertTimeStr: formatMins(calculatedQiyamMins),
      maghribMins,
      fajrMins,
      nightLength,
    };
  }, [timings, qiyamOption, qiyamCustomTime]);

  // Audio players test toggles
  const playTestAdhan = () => {
    if (isPlayingTestAdhan) {
      adhanAudioRef.current?.pause();
      if (adhanAudioRef.current) adhanAudioRef.current.currentTime = 0;
      setIsPlayingTestAdhan(false);
    } else {
      chimeAudioRef.current?.pause();
      setIsPlayingTestChime(false);
      adhanAudioRef.current?.play().catch((e) => alert("Audio playback blocked by browser policies. Please click on the page first."));
      setIsPlayingTestAdhan(true);
    }
  };

  const playTestChime = () => {
    if (isPlayingTestChime) {
      chimeAudioRef.current?.pause();
      if (chimeAudioRef.current) chimeAudioRef.current.currentTime = 0;
      setIsPlayingTestChime(false);
    } else {
      adhanAudioRef.current?.pause();
      setIsPlayingTestAdhan(false);
      chimeAudioRef.current?.play().catch((e) => alert("Audio playback failed."));
      setIsPlayingTestChime(true);
    }
  };

  // Bug#8 fix: move formatMinsToHHMM here so the setInterval closure can reference it
  const formatMinsToHHMM = (totalMins: number) => {
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  // 5. Active countdown ticker and time-based alerts trigger

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);

      if (!timings) return;

      const currentMins = now.getHours() * 60 + now.getMinutes();
      const currentSeconds = now.getSeconds();

      const timeNames = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;
      
      const parseTime = (tStr: string) => {
        const clean = tStr.split(" ")[0];
        const [h, m] = clean.split(":").map(Number);
        return h * 60 + m;
      };

      const prayerMinsMap = timeNames.map((name) => ({
        name,
        minutes: parseTime(timings[name]),
      }));

      // Find current and next prayer
      let activeIdx = 0;
      let nextIdx = 0;

      // Wrap-around check: If it is after Isha, current is Isha, next is tomorrow's Fajr
      const ishaMins = prayerMinsMap[5].minutes;
      const fajrMins = prayerMinsMap[0].minutes;

      if (currentMins >= ishaMins || currentMins < fajrMins) {
        setCurrentPrayerName("Isha");
        setNextPrayerName("Fajr");
        
        let diff = 0;
        let elapsed = 0;
        let totalWindow = 0;

        if (currentMins >= ishaMins) {
          // Time is between Isha and Midnight/Sunrise tomorrow
          diff = (1440 - currentMins) + fajrMins;
          elapsed = currentMins - ishaMins;
          totalWindow = (1440 - ishaMins) + fajrMins;
        } else {
          // Time is between Midnight and Fajr today
          diff = fajrMins - currentMins;
          elapsed = (1440 - ishaMins) + currentMins;
          totalWindow = (1440 - ishaMins) + fajrMins;
        }

        const hrs = Math.floor(diff / 60);
        const mns = diff % 60;
        setNextPrayerCountdown(`${hrs}h ${mns}m ${59 - currentSeconds}s`);
        setPrayerProgress(Math.min(100, Math.max(0, (elapsed / totalWindow) * 100)));
      } else {
        // Find index that matches
        for (let i = 0; i < prayerMinsMap.length - 1; i++) {
          if (currentMins >= prayerMinsMap[i].minutes && currentMins < prayerMinsMap[i + 1].minutes) {
            activeIdx = i;
            nextIdx = i + 1;
            break;
          }
        }

        const activePrayer = prayerMinsMap[activeIdx];
        const nextPrayer = prayerMinsMap[nextIdx];

        setCurrentPrayerName(activePrayer.name);
        setNextPrayerName(nextPrayer.name);

        const diff = nextPrayer.minutes - currentMins;
        const totalWindow = nextPrayer.minutes - activePrayer.minutes;
        const elapsed = currentMins - activePrayer.minutes;

        const hrs = Math.floor(diff / 60);
        const mns = diff % 60;
        setNextPrayerCountdown(`${hrs}h ${mns}m ${59 - currentSeconds}s`);
        setPrayerProgress(Math.min(100, Math.max(0, (elapsed / totalWindow) * 100)));
      }

      // 6. Check for daily alerts trigger on the exact minute entry (second 0)
      // Bug#4 fix: use independent refs for prayer vs qiyam so they can't cancel each other
      if (currentSeconds === 0) {
        const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        
        // Check if this timeStr matches any fardh prayer
        if (lastTriggeredPrayerRef.current !== timeStr) {
          const matchingPrayer = prayerMinsMap.find(
            (p) => p.name !== "Sunrise" && formatMinsToHHMM(p.minutes) === timeStr
          );
          if (matchingPrayer) {
            lastTriggeredPrayerRef.current = timeStr;
            triggerPrayerNotification(matchingPrayer.name);
          }
        }

        // Check if matches Qiyam al-Layl alert time (independent guard)
        if (qiyamEnabled && nightCalculations && lastTriggeredQiyamRef.current !== timeStr) {
          if (nightCalculations.qiyamAlertTimeStr === timeStr) {
            lastTriggeredQiyamRef.current = timeStr;
            triggerQiyamNotification();
          }
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timings, audioAlert, pushEnabled, qiyamEnabled, nightCalculations]);

  // (formatMinsToHHMM moved above setInterval — see line ~406)

  // Trigger Action: Fardh Prayer time entry
  // Bug#3 fix: removed blocking alert() fallback — audio + push only
  // Bug#5 fix: reset currentTime = 0 before play so audio always starts from beginning
  const triggerPrayerNotification = (prayerName: string) => {
    // 1. Play audio from start
    if (audioAlert === "adhan" && adhanAudioRef.current) {
      adhanAudioRef.current.currentTime = 0;
      adhanAudioRef.current.play().catch((e) => console.log("Adhan audio play blocked", e));
    } else if (audioAlert === "chime" && chimeAudioRef.current) {
      chimeAudioRef.current.currentTime = 0;
      chimeAudioRef.current.play().catch((e) => console.log("Chime audio play blocked", e));
    }

    // 2. Trigger push notification only — no blocking alert()
    if (pushEnabled && "Notification" in window && Notification.permission === "granted") {
      new Notification(`It's time for ${prayerName}! 🕌`, {
        body: `The time for ${prayerName} prayer has started in ${cityName.split(",")[0]}.`,
        icon: "/noor_logo.png",
      });
    }
  };

  // Trigger Action: Qiyam al-Layl alert
  // Bug#3 fix: removed blocking alert() fallback
  const triggerQiyamNotification = () => {
    // Play chime from start
    if (chimeAudioRef.current) {
      chimeAudioRef.current.currentTime = 0;
      chimeAudioRef.current.play().catch((e) => console.log("Qiyam chime audio blocked", e));
    }

    if (pushEnabled && "Notification" in window && Notification.permission === "granted") {
      new Notification("Qiyam al-Layl Reminder 🌙", {
        body: "Worship in the deep of the night. Stand before your Lord for Tahajjud and Qiyam.",
        icon: "/noor_logo.png",
      });
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
            background: "radial-gradient(circle, rgba(220, 38, 38, 0.08) 0%, rgba(0, 0, 0, 0) 70%)",
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
              background: "var(--accent-red-gradient)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Prayer Times & Qiyam Portal 🕌
          </h1>
          <p style={{ color: "var(--text-secondary)", maxWidth: "600px", margin: "0 auto", lineHeight: 1.6 }}>
            Accurate location-based prayer timings, daily Hijri details, Qiyam al-Layl night prayer calculators, and real-time reminders.
          </p>
        </div>
      </section>

      {/* Main Grid: Clock & Timings + Settings */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "2rem", alignItems: "start" }} className="solat-layout-grid">
        
        {/* Left Side: Timings & Visual indicators */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          
          {/* Live countdown card */}
          {timings && !loading && (
            <div
              className="glass-card"
              style={{
                padding: "2rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-color)",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                background: "linear-gradient(135deg, rgba(22,31,48,0.2) 0%, rgba(15,23,42,0.1) 100%)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                <span>📍 {cityName}</span>
                <span>📅 {hijriDate ? `${hijriDate.day} ${hijriDate.month?.en || ""} ${hijriDate.year} ${hijriDate.designator?.abbreviated || "AH"}` : ""}</span>
              </div>

              <div>
                <span style={{ fontSize: "1.1rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Next Prayer: <strong style={{ color: "var(--accent-red)" }}>{nextPrayerName}</strong>
                </span>
                <div
                  style={{
                    fontSize: "3rem",
                    fontFamily: "Outfit",
                    fontWeight: 800,
                    margin: "0.5rem 0",
                    background: "var(--accent-red-gradient)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {nextPrayerCountdown}
                </div>
              </div>

              {/* Progress bar to next prayer */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <div style={{ width: "100%", height: "8px", backgroundColor: "rgba(255, 255, 255, 0.1)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${prayerProgress}%`,
                      height: "100%",
                      background: "var(--accent-red-gradient)",
                      borderRadius: "var(--radius-full)",
                      transition: "width 1s linear",
                    }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  <span>Entered {currentPrayerName}</span>
                  <span>{nextPrayerName} Incoming</span>
                </div>
              </div>
            </div>
          )}

          {/* Timings Table */}
          <div
            className="glass-card"
            style={{
              padding: "2rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-color)",
            }}
          >
            <h2 style={{ fontSize: "1.35rem", marginBottom: "1.5rem", fontFamily: "Outfit", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Daily Prayer Timings</span>
              {loading && <span style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>Updating...</span>}
            </h2>

            {error && (
              <div style={{ color: "var(--accent-red)", padding: "1rem", borderRadius: "var(--radius-sm)", border: "1px solid rgba(220,38,38,0.15)", backgroundColor: "rgba(220,38,38,0.02)", textAlign: "center", marginBottom: "1rem" }}>
                {error}
              </div>
            )}

            {timings && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {(["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"] as const).map((name) => {
                  const isActive = currentPrayerName === name && name !== "Sunrise";
                  return (
                    <div
                      key={name}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "1rem 1.25rem",
                        borderRadius: "var(--radius-sm)",
                        border: isActive ? "1px solid var(--accent-red)" : "1px solid var(--border-color)",
                        background: isActive ? "rgba(220,38,38,0.03)" : "rgba(255,255,255,0.03)",
                        fontWeight: isActive ? 700 : 500,
                        transition: "var(--transition-fast)",
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: isActive ? "var(--accent-red)" : "var(--text-primary)" }}>
                        {name === "Fajr" && "🌅"}
                        {name === "Sunrise" && "☀️"}
                        {name === "Dhuhr" && "☀️"}
                        {name === "Asr" && "⛅"}
                        {name === "Maghrib" && "🌇"}
                        {name === "Isha" && "🌙"}
                        <span>{name}</span>
                        {isActive && <span style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem", borderRadius: "10px", backgroundColor: "var(--accent-red)", color: "#ffffff", fontWeight: 700 }}>ACTIVE</span>}
                      </span>
                      <span style={{ fontSize: "1.1rem", fontFamily: "Outfit", color: isActive ? "var(--accent-red)" : "var(--text-secondary)" }}>
                        {timings[name]}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Setup & Qiyam al-Layl Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          
          {/* Location & Calculation selector */}
          <div
            className="glass-card"
            style={{
              padding: "2rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-color)",
              display: "flex",
              flexDirection: "column",
              gap: "1.5rem",
            }}
          >
            <h2 style={{ fontSize: "1.35rem", fontFamily: "Outfit" }}>Location & Calculation</h2>

            {/* Select City dropdown */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>Select City / Region:</label>
              {/* Bug#11 fix: use a select-only value (not cityName which becomes GPS freeform text) */}
              <select
                onChange={handleCitySelect}
                value={DEFAULT_CITIES.find(c => c.name === cityName)?.name ?? "gps"}
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "rgba(255, 255, 255, 0.15)",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  fontSize: "0.95rem",
                }}
              >
                <option value="gps">📡 {cityName.startsWith("Auto") || !DEFAULT_CITIES.find(c => c.name === cityName) ? cityName : "Auto-detect GPS Coordinates"}</option>
                {DEFAULT_CITIES.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Manual Lat/Lng inputs */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Latitude:</label>
                <input
                  type="number"
                  step="0.0001"
                  value={lat}
                  onChange={(e) => {
                    const l = Number(e.target.value);
                    setLat(l);
                    setCityName(`Custom (${l.toFixed(2)}, ${lng.toFixed(2)})`);
                    saveSettings({ lat: l, cityName: `Custom (${l.toFixed(2)}, ${lng.toFixed(2)})` });
                  }}
                  style={{
                    padding: "0.7rem",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-color)",
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Longitude:</label>
                <input
                  type="number"
                  step="0.0001"
                  value={lng}
                  onChange={(e) => {
                    const ln = Number(e.target.value);
                    setLng(ln);
                    setCityName(`Custom (${lat.toFixed(2)}, ${ln.toFixed(2)})`);
                    saveSettings({ lng: ln, cityName: `Custom (${lat.toFixed(2)}, ${ln.toFixed(2)})` });
                  }}
                  style={{
                    padding: "0.7rem",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-color)",
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
            </div>

            {/* Calculation Method Dropdown */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>Calculation Method:</label>
              <select
                value={selectedMethod}
                onChange={(e) => {
                  const m = Number(e.target.value);
                  setSelectedMethod(m);
                  saveSettings({ method: m });
                }}
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "rgba(255, 255, 255, 0.15)",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  fontSize: "0.95rem",
                }}
              >
                {CALC_METHODS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Alarm, Notification, and Adhan Settings */}
          <div
            className="glass-card"
            style={{
              padding: "2rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-color)",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
            }}
          >
            <h2 style={{ fontSize: "1.35rem", fontFamily: "Outfit" }}>Adhan & Alerts</h2>

            {/* Audio alarm selector */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>Audio Alert Sound:</label>
              <div style={{ display: "flex", gap: "1rem" }}>
                {(["chime", "adhan", "none"] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => {
                      setAudioAlert(opt);
                      saveSettings({ audioAlert: opt });
                    }}
                    className="btn"
                    style={{
                      flex: 1,
                      padding: "0.6rem 0.5rem",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border-color)",
                      background: audioAlert === opt ? "var(--accent-red)" : "transparent",
                      color: audioAlert === opt ? "#ffffff" : "var(--text-primary)",
                      fontWeight: 600,
                      cursor: "pointer",
                      fontSize: "0.85rem",
                      textTransform: "capitalize",
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Audio Test triggers */}
            <div style={{ display: "flex", gap: "1rem", marginTop: "0.25rem" }}>
              <button
                onClick={playTestChime}
                style={{
                  flex: 1,
                  padding: "0.5rem",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid rgba(220,38,38,0.2)",
                  background: isPlayingTestChime ? "var(--accent-red-hover)" : "rgba(220,38,38,0.05)",
                  color: isPlayingTestChime ? "#ffffff" : "var(--text-primary)",
                  fontWeight: 600,
                }}
              >
                {isPlayingTestChime ? "⏹️ Stop Test Sound" : "🎵 Test Chime Sound"}
              </button>

              <button
                onClick={playTestAdhan}
                style={{
                  flex: 1,
                  padding: "0.5rem",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid rgba(212,175,55,0.2)",
                  background: isPlayingTestAdhan ? "var(--accent-gold)" : "rgba(212,175,55,0.05)",
                  color: isPlayingTestAdhan ? "#ffffff" : "var(--text-primary)",
                  fontWeight: 600,
                }}
              >
                {isPlayingTestAdhan ? "⏹️ Stop Test Adhan" : "🕌 Test Adhan Sound"}
              </button>
            </div>

            {/* Desktop Notification Toggle */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: "1px solid var(--border-color)",
                paddingTop: "1.25rem",
                marginTop: "0.5rem",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>Desktop Notifications</div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Push browser popup when prayer starts</div>
              </div>
              <button
                onClick={togglePushNotifications}
                className="btn"
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-color)",
                  background: pushEnabled ? "#10b981" : "transparent",
                  color: pushEnabled ? "#ffffff" : "var(--text-primary)",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {pushEnabled ? "Active ✓" : "Enable"}
              </button>
            </div>
          </div>

          {/* Qiyam al-Layl Reminder Panel */}
          {nightCalculations && (
            <div
              className="glass-card"
              style={{
                padding: "2rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-color)",
                background: "linear-gradient(to bottom, #0f172a 0%, #020617 100%)", // Night Theme
                color: "#f8fafc",
                display: "flex",
                flexDirection: "column",
                gap: "1.5rem",
                boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ fontSize: "1.35rem", fontFamily: "Outfit", color: "var(--accent-gold)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span>Qiyam al-Layl Night Portal</span> 🌙
                </h2>
                
                {/* Active Switch Toggle */}
                <input
                  type="checkbox"
                  checked={qiyamEnabled}
                  onChange={(e) => {
                    setQiyamEnabled(e.target.checked);
                    saveSettings({ qiyamEnabled: e.target.checked });
                  }}
                  style={{
                    width: "44px",
                    height: "22px",
                    cursor: "pointer",
                    accentColor: "var(--accent-gold)",
                  }}
                />
              </div>

              <p style={{ color: "#cbd5e1", fontSize: "0.875rem", lineHeight: 1.5 }}>
                Stand in night prayer. It is the practice of the righteous, a source of peace, and the time when the doors of supplication are opened.
              </p>

              {/* Night Math Info table */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1rem",
                  padding: "1rem",
                  borderRadius: "var(--radius-sm)",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <div>
                  <div style={{ color: "#94a3b8", fontSize: "0.75rem" }}>Night Length:</div>
                  <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{nightCalculations.durationStr}</div>
                </div>

                <div>
                  <div style={{ color: "#94a3b8", fontSize: "0.75rem" }}>Islamic Midnight:</div>
                  <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{nightCalculations.midnightStr}</div>
                </div>

                <div style={{ gridColumn: "span 2", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "0.5rem" }}>
                  <div style={{ color: "#94a3b8", fontSize: "0.75rem" }}>Last Third of the Night Starts:</div>
                  <div style={{ fontWeight: 700, fontSize: "1.15rem", color: "var(--accent-gold)" }}>
                    {nightCalculations.lastThirdStartStr}
                  </div>
                </div>
              </div>

              {/* Qiyam options */}
              {qiyamEnabled && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <label style={{ fontSize: "0.85rem", color: "#94a3b8", fontWeight: 600 }}>Set Reminder For:</label>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {[
                      { id: "third", label: `Start of Last Third (${nightCalculations.lastThirdStartStr})` },
                      { id: "midnight", label: `Islamic Midnight (${nightCalculations.midnightStr})` },
                      { id: "fajr1h", label: "1 Hour Before Fajr" },
                      { id: "custom", label: "Custom Time Setup" },
                    ].map((opt) => (
                      <label
                        key={opt.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          fontSize: "0.9rem",
                          cursor: "pointer",
                          color: qiyamOption === opt.id ? "var(--accent-gold)" : "#f8fafc",
                          fontWeight: qiyamOption === opt.id ? 700 : 400,
                        }}
                      >
                        <input
                          type="radio"
                          name="qiyamOption"
                          value={opt.id}
                          checked={qiyamOption === opt.id}
                          onChange={() => {
                            setQiyamOption(opt.id as any);
                            saveSettings({ qiyamOption: opt.id });
                          }}
                          style={{ accentColor: "var(--accent-gold)" }}
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>

                  {qiyamOption === "custom" && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Set Custom Alert Time:</span>
                      <input
                        type="time"
                        value={qiyamCustomTime}
                        onChange={(e) => {
                          setQiyamCustomTime(e.target.value);
                          saveSettings({ qiyamCustomTime: e.target.value });
                        }}
                        style={{
                          padding: "0.4rem 0.6rem",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid rgba(255,255,255,0.2)",
                          backgroundColor: "#0b0f19",
                          color: "#f8fafc",
                          cursor: "pointer",
                        }}
                      />
                    </div>
                  )}

                  <div
                    style={{
                      borderTop: "1px dotted rgba(255,255,255,0.15)",
                      paddingTop: "0.75rem",
                      fontSize: "0.8rem",
                      color: "var(--accent-gold)",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>Scheduled Alert:</span>
                    <strong>{nightCalculations.qiyamAlertTimeStr} Daily</strong>
                  </div>
                </div>
              )}

              {/* Quranic Quote block */}
              <div
                style={{
                  borderLeft: "2px solid var(--accent-gold)",
                  paddingLeft: "0.75rem",
                  fontSize: "0.825rem",
                  color: "#94a3b8",
                  fontStyle: "italic",
                  lineHeight: 1.5,
                  marginTop: "0.5rem",
                }}
              >
                "And from the night, pray with it as additional worship for you; it is expected that your Lord will resurrect you to a praised station." (Quran 17:79)
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bug#9 fix: style jsx is not supported in Next.js App Router — use plain <style> */}
      <style>{`
        @media (max-width: 820px) {
          .solat-layout-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
