'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, doc, setDoc, deleteDoc, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  QARIS_LIST,
  AUDIO_TRANSLATIONS_LIST,
  DEFAULT_TRANSLATION_MODULES,
  QariProfile,
  AudioTranslationProfile,
  TranslationModuleInfo,
} from '../../lib/quran-hub-storage';

// Curated list of EveryAyah public CDN reciter presets
interface QariPreset {
  id: string;
  name: string;
  arabicName: string;
  style: string;
  country: string;
  everyayahPath: string;
  serverUrl: string;
}

const POPULAR_QARI_PRESETS: QariPreset[] = [
  {
    id: 'mishary',
    name: 'Mishary Rashid Alafasy',
    arabicName: 'مشاري بن راشد العفاسي',
    style: 'Murattal • Beautiful & Melodic',
    country: 'Kuwait',
    everyayahPath: 'Alafasy_128kbps',
    serverUrl: 'https://server8.mp3quran.net/afs/',
  },
  {
    id: 'sudais',
    name: 'Abdul Rahman Al-Sudais',
    arabicName: 'عبد الرحمن السديس',
    style: 'Imam of Masjid al-Haram • Powerful',
    country: 'Saudi Arabia',
    everyayahPath: 'Abdurrahmaan_As-Sudais_192kbps',
    serverUrl: 'https://server11.mp3quran.net/sds/',
  },
  {
    id: 'husary',
    name: 'Mahmoud Khalil Al-Husary',
    arabicName: 'محمود خليل الحصري',
    style: 'Master of Tajweed • Clear & Educational',
    country: 'Egypt',
    everyayahPath: 'Husary_128kbps',
    serverUrl: 'https://server13.mp3quran.net/husr/',
  },
  {
    id: 'husary_mujawwad',
    name: 'Mahmoud Khalil Al-Husary (Mujawwad)',
    arabicName: 'محمود خليل الحصري (مجود)',
    style: 'Mujawwad • Deep Reverence & Mastery',
    country: 'Egypt',
    everyayahPath: 'Husary_Mujawwad_128kbps',
    serverUrl: 'https://server13.mp3quran.net/husr/',
  },
  {
    id: 'ghamdi',
    name: 'Saad Al-Ghamdi',
    arabicName: 'سعد الغامدي',
    style: 'Smooth, Gentle & Emotional',
    country: 'Saudi Arabia',
    everyayahPath: 'Ghamadi_40kbps',
    serverUrl: 'https://server7.mp3quran.net/ghamdi/',
  },
  {
    id: 'abdulbasit',
    name: 'Abdulbasit Abdussamad (Mujawwad)',
    arabicName: 'عبد الباسط عبد الصمد (مجود)',
    style: 'Legendary Mujawwad & Dramatic Resonance',
    country: 'Egypt',
    everyayahPath: 'Abdul_Basit_Mujawwad_128kbps',
    serverUrl: 'https://server10.mp3quran.net/basit/',
  },
  {
    id: 'abdulbasit_murattal',
    name: 'Abdulbasit Abdussamad (Murattal)',
    arabicName: 'عبد الباسط عبد الصمد (مرتل)',
    style: 'Murattal • Classic & Steady',
    country: 'Egypt',
    everyayahPath: 'Abdul_Basit_Murattal_192kbps',
    serverUrl: 'https://server10.mp3quran.net/basit/',
  },
  {
    id: 'minshawi_murattal',
    name: 'Mohamed Siddiq El-Minshawi (Murattal)',
    arabicName: 'محمد صديق المنشاوي (مرتل)',
    style: 'Heartfelt Murattal • Renowned Sobbing Style',
    country: 'Egypt',
    everyayahPath: 'Minshawy_Murattal_128kbps',
    serverUrl: 'https://server10.mp3quran.net/minsh/',
  },
  {
    id: 'minshawi_mujawwad',
    name: 'Mohamed Siddiq El-Minshawi (Mujawwad)',
    arabicName: 'محمد صديق المنشاوي (مجود)',
    style: 'Masterpiece Mujawwad • Deep Emotion',
    country: 'Egypt',
    everyayahPath: 'Minshawy_Mujawwad_192kbps',
    serverUrl: 'https://server10.mp3quran.net/minsh/',
  },
  {
    id: 'maher',
    name: 'Maher Al-Muaiqly',
    arabicName: 'ماهر المعيقلي',
    style: 'Imam of Masjid al-Haram • Inspiring Murattal',
    country: 'Saudi Arabia',
    everyayahPath: 'Maher_AlMuaiqly_64kbps',
    serverUrl: 'https://server12.mp3quran.net/maher/',
  },
  {
    id: 'shatri',
    name: 'Abu Bakr Al-Shatri',
    arabicName: 'أبو بكر الشاطري',
    style: 'Melodic, Soothing & Modern',
    country: 'Saudi Arabia',
    everyayahPath: 'Abu_Bakr_Ash-Shaatree_128kbps',
    serverUrl: 'https://server11.mp3quran.net/shatri/',
  },
  {
    id: 'rifai',
    name: 'Hani Ar-Rifai',
    arabicName: 'هاني الرفاعي',
    style: 'Emotional, Tender & Moving',
    country: 'Saudi Arabia',
    everyayahPath: 'Hani_Rifai_192kbps',
    serverUrl: 'https://server8.mp3quran.net/rifai/',
  },
  {
    id: 'hudhaify',
    name: 'Ali Al-Hudhaify',
    arabicName: 'علي بن عبد الرحمن الحذيفي',
    style: 'Imam of Prophet’s Mosque • Slow & Deliberate',
    country: 'Saudi Arabia',
    everyayahPath: 'Hudhaify_128kbps',
    serverUrl: 'https://server9.mp3quran.net/hthfi/',
  },
  {
    id: 'shuraim',
    name: 'Saud Al-Shuraim',
    arabicName: 'سعود الشريم',
    style: 'Former Grand Mosque Imam • Rhythmic & Quick',
    country: 'Saudi Arabia',
    everyayahPath: 'Saood_ash-Shuraym_128kbps',
    serverUrl: 'https://server7.mp3quran.net/shur/',
  },
  {
    id: 'yasser_dossari',
    name: 'Yasser Al-Dosari',
    arabicName: 'ياسر الدوسري',
    style: 'Grand Mosque Imam • Powerful Resonating Tone',
    country: 'Saudi Arabia',
    everyayahPath: 'Yasser_Ad-Dussary_128kbps',
    serverUrl: 'https://server11.mp3quran.net/yasser/',
  },
  {
    id: 'basfar',
    name: 'Abdullah Basfar',
    arabicName: 'عبد الله بصفر',
    style: 'Clear Educational Pace for Students',
    country: 'Saudi Arabia',
    everyayahPath: 'Abdullah_Basfar_192kbps',
    serverUrl: 'https://server6.mp3quran.net/bsfr/',
  },
];

export default function ManageQuranTab() {
  const [qaris, setQaris] = useState<QariProfile[]>(QARIS_LIST);
  const [isCloudSynced, setIsCloudSynced] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [audioTranslations] = useState<AudioTranslationProfile[]>(AUDIO_TRANSLATIONS_LIST);
  const [translationModules] = useState<TranslationModuleInfo[]>(DEFAULT_TRANSLATION_MODULES);

  // Audio stream testing state
  const [testingAudioId, setTestingAudioId] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQariId, setEditingQariId] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [formName, setFormName] = useState('');
  const [formArabicName, setFormArabicName] = useState('');
  const [formStyle, setFormStyle] = useState('');
  const [formCountry, setFormCountry] = useState('');
  const [formEveryayahPath, setFormEveryayahPath] = useState('');
  const [formServerUrl, setFormServerUrl] = useState('');
  const [formSlugId, setFormSlugId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // In-modal audio preview testing state
  const [modalTestUrl, setModalTestUrl] = useState<string | null>(null);
  const [isModalAudioPlaying, setIsModalAudioPlaying] = useState(false);
  const [modalAudioError, setModalAudioError] = useState<string | null>(null);

  // Real-time listener for Firestore `quran_qaris` collection
  useEffect(() => {
    setIsLoading(true);
    const unsub = onSnapshot(
      collection(db, 'quran_qaris'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list = snapshot.docs.map((d) => d.data() as QariProfile);
          setQaris(list);
          setIsCloudSynced(true);
        } else {
          // If no documents exist in Firestore yet, show default QARIS_LIST
          setQaris(QARIS_LIST);
          setIsCloudSynced(false);
        }
        setIsLoading(false);
      },
      (err) => {
        console.warn('Failed to load quran_qaris from Firestore:', err);
        setQaris(QARIS_LIST);
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const testQariStream = (qari: QariProfile) => {
    setAudioError(null);
    setTestingAudioId(qari.id);
    // Test with Surah Al-Fatihah, Verse 1 (001001.mp3)
    const url = `https://everyayah.com/data/${qari.everyayahPath}/001001.mp3`;
    setPlayingAudioUrl(url);
  };

  const openAddModal = () => {
    setEditingQariId(null);
    setSelectedPreset('');
    setFormName('');
    setFormArabicName('');
    setFormStyle('Murattal • Beautiful Recitation');
    setFormCountry('Saudi Arabia');
    setFormEveryayahPath('');
    setFormServerUrl('https://server8.mp3quran.net/');
    setFormSlugId('');
    setModalTestUrl(null);
    setIsModalAudioPlaying(false);
    setModalAudioError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (qari: QariProfile) => {
    setEditingQariId(qari.id);
    setSelectedPreset('');
    setFormName(qari.name);
    setFormArabicName(qari.arabicName);
    setFormStyle(qari.style);
    setFormCountry(qari.country);
    setFormEveryayahPath(qari.everyayahPath);
    setFormServerUrl(qari.serverUrl);
    setFormSlugId(qari.id);
    setModalTestUrl(null);
    setIsModalAudioPlaying(false);
    setModalAudioError(null);
    setIsModalOpen(true);
  };

  const handleSelectPreset = (presetId: string) => {
    setSelectedPreset(presetId);
    if (!presetId) return;

    const preset = POPULAR_QARI_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setFormName(preset.name);
      setFormArabicName(preset.arabicName);
      setFormStyle(preset.style);
      setFormCountry(preset.country);
      setFormEveryayahPath(preset.everyayahPath);
      setFormServerUrl(preset.serverUrl);
      if (!editingQariId) {
        setFormSlugId(preset.id);
      }
      setModalTestUrl(null);
      setModalAudioError(null);
    }
  };

  const testModalAudio = () => {
    if (!formEveryayahPath.trim()) {
      setModalAudioError('Please enter or select an EveryAyah CDN path first.');
      return;
    }
    setModalAudioError(null);
    const testUrl = `https://everyayah.com/data/${formEveryayahPath.trim()}/001001.mp3`;
    setModalTestUrl(testUrl);
    setIsModalAudioPlaying(true);
  };

  const handleSaveQari = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEveryayahPath.trim()) {
      alert('Please provide at least a Reciter Name and an EveryAyah CDN path.');
      return;
    }

    setIsSaving(true);
    try {
      const qariId = editingQariId
        ? editingQariId
        : (formSlugId.trim() || formName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_'));

      const profile: QariProfile = {
        id: qariId,
        name: formName.trim(),
        arabicName: formArabicName.trim() || formName.trim(),
        style: formStyle.trim() || 'Murattal • Authentic Recitation',
        country: formCountry.trim() || 'International',
        everyayahPath: formEveryayahPath.trim(),
        serverUrl: formServerUrl.trim() || 'https://everyayah.com/data/',
      };

      // If this is the very first custom save and cloud was unseeded, ensure other defaults are seeded too
      if (!isCloudSynced) {
        const batch = writeBatch(db);
        QARIS_LIST.forEach((def) => {
          if (def.id !== profile.id) {
            batch.set(doc(db, 'quran_qaris', def.id), def);
          }
        });
        batch.set(doc(db, 'quran_qaris', profile.id), profile);
        await batch.commit();
      } else {
        await setDoc(doc(db, 'quran_qaris', profile.id), profile);
      }

      alert(`Qari "${profile.name}" saved successfully!`);
      setIsModalOpen(false);
      setModalTestUrl(null);
    } catch (err: any) {
      alert('Failed to save Qari module: ' + (err.message || String(err)));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteQari = async (qari: QariProfile) => {
    if (
      !confirm(
        `Are you sure you want to remove "${qari.name}"?\n\nThis will remove this Qari audio module from the library and Quran reader immediately.`
      )
    ) {
      return;
    }

    try {
      if (!isCloudSynced) {
        // Seed remaining defaults into Firestore minus the deleted one
        const batch = writeBatch(db);
        const remaining = QARIS_LIST.filter((q) => q.id !== qari.id);
        remaining.forEach((q) => {
          batch.set(doc(db, 'quran_qaris', q.id), q);
        });
        await batch.commit();
      } else {
        await deleteDoc(doc(db, 'quran_qaris', qari.id));
      }

      // If the currently playing audio was from this Qari, stop it
      if (testingAudioId === qari.id) {
        setPlayingAudioUrl(null);
        setTestingAudioId(null);
      }

      alert(`Qari "${qari.name}" has been removed.`);
    } catch (err: any) {
      alert('Failed to remove Qari: ' + (err.message || String(err)));
    }
  };

  const handleSeedDefaults = async () => {
    if (
      !confirm(
        'This will sync all default Qari reciters to the cloud database so you can customize or remove any of them individually. Proceed?'
      )
    ) {
      return;
    }

    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      QARIS_LIST.forEach((q) => {
        batch.set(doc(db, 'quran_qaris', q.id), q);
      });
      await batch.commit();
      alert('Default Qari modules synced to cloud successfully!');
    } catch (err: any) {
      alert('Failed to sync defaults: ' + (err.message || String(err)));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Overview Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.25rem',
        }}
      >
        <div className="admin-stat-card" style={{ borderLeft: '4px solid #16A34A' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>CDN Architecture</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#16A34A', marginTop: '0.25rem' }}>
            Zero Egress CDN
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            EveryAyah Distributed Edge Network
          </div>
        </div>

        <div className="admin-stat-card" style={{ borderLeft: '4px solid var(--accent-gold)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Active Reciters</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-gold)', marginTop: '0.25rem' }}>
            {qaris.length} Qaris Configured
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {isCloudSynced ? '☁️ Cloud Database Active' : '📦 Default Presets Active'}
          </div>
        </div>

        <div className="admin-stat-card" style={{ borderLeft: '4px solid var(--accent-red)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nigerian Localizations</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-red)', marginTop: '0.25rem' }}>
            4 Languages
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Yorùbá, Hausa, Igbo & English
          </div>
        </div>

        <div className="admin-stat-card" style={{ borderLeft: '4px solid #6366F1' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Study Hub Sync</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#6366F1', marginTop: '0.25rem' }}>
            Firestore Rules Live
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Reflections, Bookmarks & Reciter Sync
          </div>
        </div>
      </div>

      {/* Live Audio Stream Testing Banner */}
      {playingAudioUrl && (
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--accent-gold)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--accent-gold)' }}>
              🔊 Live CDN Audio Stream Preview (Surah Al-Fatihah, Ayah 1)
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', wordBreak: 'break-all' }}>
              URL: {playingAudioUrl}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <audio
              src={playingAudioUrl}
              autoPlay
              controls
              onError={() => setAudioError('Unable to load audio from CDN URL. Please verify network access.')}
              style={{ height: '36px' }}
            />
            <button
              onClick={() => {
                setPlayingAudioUrl(null);
                setTestingAudioId(null);
              }}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
            >
              Stop
            </button>
          </div>
          {audioError && (
            <div style={{ width: '100%', color: '#EF4444', fontSize: '0.8rem' }}>
              ⚠️ {audioError}
            </div>
          )}
        </div>
      )}

      {/* Section 1: Qaris & Audio Modules */}
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem',
          border: '1px solid var(--border-color)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.25rem',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                🎙️ Quran Reciters & Audio Modules
              </h3>
              {isCloudSynced ? (
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(22, 163, 74, 0.15)',
                    color: '#16A34A',
                  }}
                >
                  Cloud Synced
                </span>
              ) : (
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(212, 175, 55, 0.15)',
                    color: 'var(--accent-gold)',
                  }}
                >
                  Default Presets
                </span>
              )}
            </div>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Add new Qari audio modules or remove any reciter at any time. Changes sync across all web and mobile readers.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {!isCloudSynced && (
              <button
                onClick={handleSeedDefaults}
                disabled={isSaving}
                className="btn btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.85rem',
                  padding: '0.45rem 0.9rem',
                }}
                title="Save default reciters to the cloud database"
              >
                <span>☁️</span> Sync Defaults to Cloud
              </button>
            )}

            <button
              onClick={openAddModal}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.85rem',
                padding: '0.45rem 1rem',
                fontWeight: 700,
                borderRadius: 'var(--radius-md)',
              }}
            >
              <span>➕</span> Add Qari Module
            </button>
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading Qari audio modules...
          </div>
        ) : qaris.length === 0 ? (
          <div
            style={{
              padding: '2.5rem',
              textAlign: 'center',
              backgroundColor: 'var(--bg-primary)',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--border-color)',
            }}
          >
            <p style={{ margin: '0 0 1rem', color: 'var(--text-muted)' }}>
              No Qari reciters currently configured.
            </p>
            <button onClick={openAddModal} className="btn btn-primary">
              Add First Qari Module
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {qaris.map((qari) => {
              const isTesting = testingAudioId === qari.id;
              return (
                <div
                  key={qari.id}
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem 1.25rem',
                    border: `1px solid ${isTesting ? 'var(--accent-gold)' : 'var(--border-color)'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ flex: '1 1 300px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                        {qari.name}
                      </span>
                      {qari.arabicName && (
                        <span
                          style={{
                            fontFamily: 'Amiri, serif',
                            color: 'var(--accent-gold)',
                            fontSize: '1.05rem',
                          }}
                        >
                          {qari.arabicName}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(22, 163, 74, 0.15)',
                          color: '#16A34A',
                        }}
                      >
                        Active
                      </span>
                    </div>

                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                      {qari.style} • Origin: <strong>{qari.country}</strong>
                    </div>

                    <div
                      style={{
                        fontSize: '0.75rem',
                        fontFamily: 'monospace',
                        color: 'var(--text-muted)',
                        marginTop: '0.25rem',
                      }}
                    >
                      CDN Folder: <strong>{qari.everyayahPath}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => testQariStream(qari)}
                      className="btn btn-secondary"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.4rem 0.85rem',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                      }}
                      title="Test streaming Verse 1 (Al-Fatihah)"
                    >
                      <span>▶️</span> Test Stream
                    </button>

                    <button
                      onClick={() => openEditModal(qari)}
                      className="btn btn-secondary"
                      style={{
                        padding: '0.4rem 0.8rem',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                      }}
                      title="Edit this reciter's details"
                    >
                      ✏️ Edit
                    </button>

                    <button
                      onClick={() => handleDeleteQari(qari)}
                      style={{
                        padding: '0.4rem 0.8rem',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        backgroundColor: 'rgba(239, 68, 68, 0.12)',
                        color: '#EF4444',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        transition: 'all 0.2s ease',
                      }}
                      title="Remove this reciter from the library"
                    >
                      <span>🗑️</span> Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2: Local Nigerian Translation Modules */}
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
            🌍 Nigerian Translation Modules & Status
          </h3>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Text translations and spoken audio translations for Nigerian local communities.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {translationModules.map((mod) => (
            <div
              key={mod.id}
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                border: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '1rem' }}>{mod.title}</span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(220, 38, 38, 0.12)',
                      color: 'var(--accent-red)',
                    }}
                  >
                    {mod.language}
                  </span>
                  {mod.isBundled ? (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(22, 163, 74, 0.15)',
                        color: '#16A34A',
                      }}
                    >
                      Bundled
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(59, 130, 246, 0.15)',
                        color: '#3B82F6',
                      }}
                    >
                      On-Demand Module
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Translator: {mod.translator} • Package Size: {mod.sizeLabel}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#16A34A', fontWeight: 600 }}>
                  ✓ Available to Web & Mobile
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: Cost-Effectiveness & CDN Architecture Guide */}
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem',
          border: '1px solid rgba(22, 163, 74, 0.3)',
        }}
      >
        <h4 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: '#16A34A', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>💡</span> CDN Cost Effectiveness & Zero-Egress Architecture
        </h4>
        <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--text-muted)' }}>
          To ensure long-term sustainability and keep bandwidth costs at <strong>$0</strong>, all Quran recitation audio files are routed directly to <strong>EveryAyah.com CDN mirrors</strong>. Verse-level playback requests bypass Noor Library app servers completely, meaning thousands of concurrent readers streaming hours of recitation generate zero origin bandwidth bills.
        </p>
      </div>

      {/* Add / Edit Qari Modal */}
      {isModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => {
            setIsModalOpen(false);
            setModalTestUrl(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              border: '1px solid var(--border-color)',
              padding: '1.75rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.25rem',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '0.75rem',
              }}
            >
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                {editingQariId ? '✏️ Edit Qari Reciter Module' : '➕ Add Qari Reciter Module'}
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setModalTestUrl(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveQari} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Quick Preset Selector */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                  ⚡ Quick Pick from Renowned Reciter Presets:
                </label>
                <select
                  value={selectedPreset}
                  onChange={(e) => handleSelectPreset(e.target.value)}
                  className="form-input"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    padding: '0.6rem 0.8rem',
                    borderRadius: 'var(--radius-sm)',
                    width: '100%',
                    fontSize: '0.88rem',
                  }}
                >
                  <option value="">-- Choose a Preset Reciter (or fill manually) --</option>
                  {POPULAR_QARI_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.arabicName}) - {p.country}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                  Selecting a preset will auto-fill verified EveryAyah audio paths and URLs.
                </span>
              </div>

              {/* Reciter Name (English) */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                  Reciter Name (English) <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Mohamed Siddiq El-Minshawi"
                  className="form-input"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    padding: '0.6rem 0.8rem',
                    borderRadius: 'var(--radius-sm)',
                    width: '100%',
                    fontSize: '0.88rem',
                  }}
                />
              </div>

              {/* Arabic Name */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                  Arabic Name
                </label>
                <input
                  type="text"
                  value={formArabicName}
                  onChange={(e) => setFormArabicName(e.target.value)}
                  placeholder="e.g. محمد صديق المنشاوي"
                  dir="rtl"
                  className="form-input"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    padding: '0.6rem 0.8rem',
                    borderRadius: 'var(--radius-sm)',
                    width: '100%',
                    fontSize: '0.95rem',
                    fontFamily: 'Amiri, serif',
                  }}
                />
              </div>

              {/* Recitation Style & Country */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Recitation Style
                  </label>
                  <input
                    type="text"
                    value={formStyle}
                    onChange={(e) => setFormStyle(e.target.value)}
                    placeholder="e.g. Mujawwad • Deep Tajweed"
                    className="form-input"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      padding: '0.6rem 0.8rem',
                      borderRadius: 'var(--radius-sm)',
                      width: '100%',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Country of Origin
                  </label>
                  <input
                    type="text"
                    value={formCountry}
                    onChange={(e) => setFormCountry(e.target.value)}
                    placeholder="e.g. Egypt / Saudi Arabia / Nigeria"
                    className="form-input"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      padding: '0.6rem 0.8rem',
                      borderRadius: 'var(--radius-sm)',
                      width: '100%',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>
              </div>

              {/* EveryAyah CDN Folder Path */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                  EveryAyah CDN Folder Path <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formEveryayahPath}
                  onChange={(e) => setFormEveryayahPath(e.target.value)}
                  placeholder="e.g. Minshawy_Mujawwad_192kbps or Alafasy_128kbps"
                  className="form-input"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    padding: '0.6rem 0.8rem',
                    borderRadius: 'var(--radius-sm)',
                    width: '100%',
                    fontSize: '0.85rem',
                    fontFamily: 'monospace',
                  }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                  Verse format: <code>https://everyayah.com/data/[folder]/001001.mp3</code>
                </span>
              </div>

              {/* Surah Base URL */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                  Surah-Level Audio Base URL (mp3quran / EveryAyah)
                </label>
                <input
                  type="url"
                  value={formServerUrl}
                  onChange={(e) => setFormServerUrl(e.target.value)}
                  placeholder="e.g. https://server10.mp3quran.net/minsh/"
                  className="form-input"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    padding: '0.6rem 0.8rem',
                    borderRadius: 'var(--radius-sm)',
                    width: '100%',
                    fontSize: '0.85rem',
                    fontFamily: 'monospace',
                  }}
                />
              </div>

              {/* Identifier Slug */}
              {!editingQariId && (
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Identifier / Slug (Optional, auto-generated from name)
                  </label>
                  <input
                    type="text"
                    value={formSlugId}
                    onChange={(e) => setFormSlugId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="e.g. minshawi_mujawwad"
                    className="form-input"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      padding: '0.6rem 0.8rem',
                      borderRadius: 'var(--radius-sm)',
                      width: '100%',
                      fontSize: '0.85rem',
                      fontFamily: 'monospace',
                    }}
                  />
                </div>
              )}

              {/* Live Audio Test in Modal */}
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                    🎵 Test Audio Recitation (Ayah 1:1)
                  </span>
                  <button
                    type="button"
                    onClick={testModalAudio}
                    className="btn btn-secondary"
                    style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', fontWeight: 600 }}
                  >
                    ▶️ Test Path
                  </button>
                </div>

                {modalTestUrl && (
                  <audio
                    src={modalTestUrl}
                    controls
                    autoPlay={isModalAudioPlaying}
                    onError={() => setModalAudioError('Failed to load audio from this EveryAyah folder path.')}
                    style={{ width: '100%', height: '32px' }}
                  />
                )}

                {modalAudioError && (
                  <span style={{ fontSize: '0.75rem', color: '#EF4444' }}>
                    ⚠️ {modalAudioError}
                  </span>
                )}
              </div>

              {/* Modal Action Buttons */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  marginTop: '0.75rem',
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '1rem',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setModalTestUrl(null);
                  }}
                  className="btn btn-secondary"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSaving}
                  style={{
                    fontWeight: 700,
                    padding: '0.5rem 1.5rem',
                    backgroundColor: 'var(--accent-red)',
                    color: '#FFFFFF',
                  }}
                >
                  {isSaving ? 'Saving...' : editingQariId ? 'Update Qari Module' : 'Save Qari Module'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
