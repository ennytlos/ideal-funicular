'use client';

import React, { useState, useEffect } from 'react';
import { useApp, Banner } from '../../context/AppContext';
import { db, auth } from '../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface MobileHeroConfig {
  isEnabled: boolean;
  badge: string;
  title: string;
  subtitle: string;
  buttonText: string;
  targetUrl: string;
  imageUrl: string;
}

const DEFAULT_MOBILE_HERO: MobileHeroConfig = {
  isEnabled: true,
  badge: 'FEATURED SPOTLIGHT',
  title: 'Illuminating Minds with Authentic Knowledge',
  subtitle: '',
  buttonText: 'Explore Spotlight',
  targetUrl: '/(tabs)/explore',
  imageUrl: '',
};

const DESTINATION_PRESETS = [
  { label: 'Explore Catalog', value: '/(tabs)/explore' },
  { label: 'Quran Hub', value: '/(tabs)/quran' },
  { label: '40 Hadith', value: '/hadith' },
  { label: 'Prayer Times', value: '/solat' },
  { label: 'Personal Library', value: '/library' },
  { label: 'Support & Sadaqah', value: '/tip' },
  { label: 'Creator Hub', value: '/creator-hub' },
];

export default function ManageBannersTab() {
  const { banners, addBanner, updateBanner, deleteBanner } = useApp();

  // Sub-tab selection: Mobile App Spotlight vs Web Banners
  const [activePlatform, setActivePlatform] = useState<'mobile' | 'web'>('mobile');

  // ----------------------------------------------------
  // MOBILE HERO SPOTLIGHT STATE
  // ----------------------------------------------------
  const [mobileHero, setMobileHero] = useState<MobileHeroConfig>(DEFAULT_MOBILE_HERO);
  const [isHeroLoading, setIsHeroLoading] = useState(true);
  const [isHeroSaving, setIsHeroSaving] = useState(false);
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null);
  const [isHeroUploading, setIsHeroUploading] = useState(false);
  const [heroFeedback, setHeroFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [previewTheme, setPreviewTheme] = useState<'dark' | 'light'>('dark');

  // Load Mobile Hero configuration on mount
  useEffect(() => {
    let mounted = true;
    const fetchMobileHero = async () => {
      try {
        setIsHeroLoading(true);
        // Try reading directly from Firestore
        const docRef = doc(db, 'app_config', 'mobile_hero');
        const snap = await getDoc(docRef);
        if (snap.exists() && mounted) {
          const data = snap.data();
          setMobileHero({
            isEnabled: data.isEnabled !== false,
            badge: data.badge || DEFAULT_MOBILE_HERO.badge,
            title: data.title || DEFAULT_MOBILE_HERO.title,
            subtitle: data.subtitle || '',
            buttonText: data.buttonText || DEFAULT_MOBILE_HERO.buttonText,
            targetUrl: data.targetUrl || DEFAULT_MOBILE_HERO.targetUrl,
            imageUrl: data.imageUrl || '',
          });
        }
      } catch (err) {
        console.warn('Could not read mobile_hero from client Firestore, trying API route...', err);
        try {
          const token = await auth.currentUser?.getIdToken();
          const res = await fetch('/api/admin/mobile-hero', {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (res.ok) {
            const json = await res.json();
            if (json.mobileHero && mounted) {
              setMobileHero(json.mobileHero);
            }
          }
        } catch (apiErr) {
          console.error('Failed to fetch mobile hero config:', apiErr);
        }
      } finally {
        if (mounted) setIsHeroLoading(false);
      }
    };

    fetchMobileHero();
    return () => {
      mounted = false;
    };
  }, []);

  const handleHeroImageUpload = async (file: File): Promise<string> => {
    setIsHeroUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'cover');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Image upload failed');
      const data = await res.json();
      return data.url;
    } finally {
      setIsHeroUploading(false);
    }
  };

  const handleSaveMobileHero = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsHeroSaving(true);
    setHeroFeedback(null);

    try {
      let finalImageUrl = mobileHero.imageUrl;
      if (heroImageFile) {
        finalImageUrl = await handleHeroImageUpload(heroImageFile);
      }

      const payload = {
        ...mobileHero,
        imageUrl: finalImageUrl,
      };

      // 1. Send to server API route with admin credentials
      let apiSuccess = false;
      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch('/api/admin/mobile-hero', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        });
        if (res.ok) apiSuccess = true;
      } catch (e) {
        console.warn('API route failed, falling back to direct Firestore write:', e);
      }

      // 2. Fallback to direct client Firestore SDK if needed
      if (!apiSuccess) {
        await setDoc(doc(db, 'app_config', 'mobile_hero'), payload, { merge: true });
      }

      setMobileHero(payload);
      setHeroImageFile(null);
      setHeroFeedback({
        type: 'success',
        message: 'Mobile Hero Spotlight updated successfully! The mobile app will display these changes immediately.',
      });
      setTimeout(() => setHeroFeedback(null), 5000);
    } catch (err: any) {
      console.error('Error saving mobile hero:', err);
      setHeroFeedback({
        type: 'error',
        message: err.message || 'Failed to save mobile hero configuration',
      });
    } finally {
      setIsHeroSaving(false);
    }
  };

  const handleResetMobileHero = () => {
    if (confirm('Reset mobile spotlight back to original Noor Library defaults?')) {
      setMobileHero(DEFAULT_MOBILE_HERO);
      setHeroImageFile(null);
    }
  };

  // ----------------------------------------------------
  // WEB PROMOTIONAL BANNERS STATE
  // ----------------------------------------------------
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [title, setTitle] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const openAddModal = () => {
    setTitle('');
    setTargetUrl('');
    setImageUrl('');
    setIsActive(true);
    setImageFile(null);
    setEditingBanner(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (banner: Banner) => {
    setEditingBanner(banner);
    setTitle(banner.title);
    setTargetUrl(banner.targetUrl);
    setImageUrl(banner.imageUrl);
    setIsActive(banner.isActive);
    setImageFile(null);
    setIsAddModalOpen(true);
  };

  const handleWebImageUpload = async (file: File): Promise<string> => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'cover');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Image upload failed');
      const data = await res.json();
      return data.url;
    } finally {
      setIsUploading(false);
    }
  };

  const handleWebSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let finalImageUrl = imageUrl;
      if (imageFile) {
        finalImageUrl = await handleWebImageUpload(imageFile);
      }

      if (!finalImageUrl) {
        alert('Please select an image file or provide an image URL');
        setIsSaving(false);
        return;
      }

      if (editingBanner) {
        await updateBanner({
          ...editingBanner,
          title,
          targetUrl,
          imageUrl: finalImageUrl,
          isActive,
        });
        alert('Web banner updated successfully!');
      } else {
        await addBanner({
          title,
          targetUrl,
          imageUrl: finalImageUrl,
          isActive,
        });
        alert('Web banner added successfully!');
      }
      setIsAddModalOpen(false);
    } catch (err: any) {
      alert(`Error saving banner: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (banner: Banner) => {
    try {
      await updateBanner({
        ...banner,
        isActive: !banner.isActive,
      });
      alert(`Banner ${!banner.isActive ? 'activated' : 'deactivated'} successfully!`);
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this promotional banner?')) return;
    try {
      await deleteBanner(id);
      alert('Banner deleted successfully!');
    } catch (err: any) {
      alert(`Failed to delete banner: ${err.message}`);
    }
  };

  return (
    <div>
      {/* Platform Sub-Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          marginBottom: '2rem',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '0.75rem',
        }}
      >
        <button
          type="button"
          onClick={() => setActivePlatform('mobile')}
          className={`btn ${activePlatform === 'mobile' ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.65rem 1.25rem',
            fontWeight: 700,
          }}
        >
          <span>📱</span>
          <span>Mobile App Hero Spotlight</span>
          <span
            style={{
              fontSize: '0.7rem',
              padding: '2px 8px',
              borderRadius: '12px',
              background: 'rgba(212, 175, 55, 0.2)',
              color: 'var(--accent-gold)',
              fontWeight: 800,
            }}
          >
            Mobile Only
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActivePlatform('web')}
          className={`btn ${activePlatform === 'web' ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.65rem 1.25rem',
            fontWeight: 700,
          }}
        >
          <span>💻</span>
          <span>Web Homepage Banners Carousel</span>
          <span
            style={{
              fontSize: '0.7rem',
              padding: '2px 8px',
              borderRadius: '12px',
              background: 'rgba(59, 130, 246, 0.2)',
              color: '#3b82f6',
              fontWeight: 800,
            }}
          >
            Web Only
          </span>
        </button>
      </div>

      {/* ==================================================== */}
      {/* MOBILE HERO SPOTLIGHT SECTION */}
      {/* ==================================================== */}
      {activePlatform === 'mobile' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 className="admin-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>📱</span> Mobile Hero Spotlight Banner
              </h1>
              <p className="admin-subtitle" style={{ color: 'var(--text-secondary)' }}>
                Configure the spotlight card displayed at the very top of the mobile home screen. This configuration applies strictly to the mobile application.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleResetMobileHero}
              style={{ fontSize: '0.85rem' }}
            >
              ↺ Reset to Defaults
            </button>
          </div>

          {heroFeedback && (
            <div
              style={{
                padding: '1rem 1.25rem',
                borderRadius: '8px',
                marginBottom: '1.5rem',
                background: heroFeedback.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: `1px solid ${heroFeedback.type === 'success' ? '#22c55e' : '#ef4444'}`,
                color: heroFeedback.type === 'success' ? '#86efac' : '#fca5a5',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>{heroFeedback.type === 'success' ? '✓' : '⚠'}</span>
              <span>{heroFeedback.message}</span>
            </div>
          )}

          {isHeroLoading ? (
            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading mobile spotlight settings...
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '2rem' }}>
              {/* Form Controls Column */}
              <div className="glass-card" style={{ padding: '1.75rem' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>
                  Spotlight Settings
                </h2>

                <form onSubmit={handleSaveMobileHero}>
                  {/* Enable Switch */}
                  <div style={{ marginBottom: '1.5rem', padding: '0.85rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={mobileHero.isEnabled}
                        onChange={e => setMobileHero(prev => ({ ...prev, isEnabled: e.target.checked }))}
                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-gold)' }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                          Display Banner on Mobile Home
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          When unchecked, the spotlight banner is hidden entirely on the mobile app.
                        </div>
                      </div>
                    </label>
                  </div>

                  {/* Badge Text */}
                  <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                    <label className="form-label" style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                      <span>Badge Tag Label</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Top gold pill</span>
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      required
                      placeholder="e.g. FEATURED SPOTLIGHT, RAMADAN SPECIAL, NEW COURSE"
                      value={mobileHero.badge}
                      onChange={e => setMobileHero(prev => ({ ...prev, badge: e.target.value }))}
                    />
                  </div>

                  {/* Headline Title */}
                  <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>
                      Headline Title
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      required
                      placeholder="e.g. Illuminating Minds with Authentic Knowledge"
                      value={mobileHero.title}
                      onChange={e => setMobileHero(prev => ({ ...prev, title: e.target.value }))}
                    />
                  </div>

                  {/* Optional Subtitle / Details */}
                  <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                    <label className="form-label" style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                      <span>Details / Subtitle</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Optional secondary text</span>
                    </label>
                    <textarea
                      rows={2}
                      className="form-input"
                      placeholder="e.g. Explore our curated Islamic books, lessons, and spiritual tools."
                      value={mobileHero.subtitle}
                      onChange={e => setMobileHero(prev => ({ ...prev, subtitle: e.target.value }))}
                      style={{ resize: 'vertical' }}
                    />
                  </div>

                  {/* Button Label */}
                  <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>
                      Action Button Text
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      required
                      placeholder="e.g. Explore Spotlight, Start Reading, Enroll Now"
                      value={mobileHero.buttonText}
                      onChange={e => setMobileHero(prev => ({ ...prev, buttonText: e.target.value }))}
                    />
                  </div>

                  {/* Button Target Route / URL */}
                  <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>
                      Button Navigation Target
                    </label>
                    
                    {/* Quick Presets */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.6rem' }}>
                      {DESTINATION_PRESETS.map(preset => (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => setMobileHero(prev => ({ ...prev, targetUrl: preset.value }))}
                          style={{
                            fontSize: '0.75rem',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: mobileHero.targetUrl === preset.value ? 'var(--accent-gold)' : 'rgba(255,255,255,0.06)',
                            color: mobileHero.targetUrl === preset.value ? '#000' : 'var(--text-secondary)',
                            border: '1px solid var(--border-color)',
                            cursor: 'pointer',
                            fontWeight: mobileHero.targetUrl === preset.value ? 700 : 500,
                          }}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <input
                      type="text"
                      className="form-input"
                      required
                      placeholder="e.g. /(tabs)/explore, /library, or https://..."
                      value={mobileHero.targetUrl}
                      onChange={e => setMobileHero(prev => ({ ...prev, targetUrl: e.target.value }))}
                    />
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Enter a mobile in-app route (e.g. `/(tabs)/explore`) or an external URL (`https://...`).
                    </div>
                  </div>

                  {/* Spotlight Image */}
                  <div className="form-group" style={{ marginBottom: '1.75rem' }}>
                    <label className="form-label" style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                      <span>Spotlight Graphic / Image</span>
                      <button
                        type="button"
                        onClick={() => {
                          setMobileHero(prev => ({ ...prev, imageUrl: '' }));
                          setHeroImageFile(null);
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Reset to Noor Logo
                      </button>
                    </label>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <input
                        type="file"
                        accept="image/*"
                        className="form-input"
                        onChange={e => setHeroImageFile(e.target.files ? e.target.files[0] : null)}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>or image URL:</span>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="https://..."
                          value={mobileHero.imageUrl}
                          onChange={e => {
                            setMobileHero(prev => ({ ...prev, imageUrl: e.target.value }));
                            setHeroImageFile(null);
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isHeroUploading || isHeroSaving}
                    style={{
                      width: '100%',
                      padding: '0.85rem',
                      fontWeight: 700,
                      background: 'var(--accent-gold)',
                      color: '#000',
                      border: 'none',
                      cursor: isHeroUploading || isHeroSaving ? 'not-allowed' : 'pointer',
                      opacity: isHeroUploading || isHeroSaving ? 0.7 : 1,
                    }}
                  >
                    {isHeroUploading ? 'Uploading Image...' : isHeroSaving ? 'Saving to Mobile App...' : 'Save Mobile Hero Spotlight'}
                  </button>
                </form>
              </div>

              {/* Live Preview Column */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Live Mobile Preview
                  </h2>
                  <div style={{ display: 'flex', gap: '0.35rem', background: 'rgba(255,255,255,0.05)', padding: '3px', borderRadius: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setPreviewTheme('dark')}
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        borderRadius: '4px',
                        border: 'none',
                        cursor: 'pointer',
                        background: previewTheme === 'dark' ? '#000' : 'transparent',
                        color: previewTheme === 'dark' ? '#fff' : 'var(--text-muted)',
                      }}
                    >
                      🌙 Dark
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTheme('light')}
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        borderRadius: '4px',
                        border: 'none',
                        cursor: 'pointer',
                        background: previewTheme === 'light' ? '#fff' : 'transparent',
                        color: previewTheme === 'light' ? '#000' : 'var(--text-muted)',
                      }}
                    >
                      ☀️ Light
                    </button>
                  </div>
                </div>

                {/* Mock Mobile Device Screen */}
                <div
                  style={{
                    maxWidth: '420px',
                    margin: '0 auto',
                    borderRadius: '28px',
                    border: '3px solid #334155',
                    background: previewTheme === 'dark' ? '#0b1120' : '#f8fafc',
                    padding: '24px 16px',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                    position: 'relative',
                  }}
                >
                  {/* Phone Speaker Notch */}
                  <div
                    style={{
                      width: '60px',
                      height: '5px',
                      borderRadius: '3px',
                      background: previewTheme === 'dark' ? '#334155' : '#cbd5e1',
                      margin: '0 auto 16px',
                    }}
                  />

                  {/* Inactive Badge Indicator */}
                  {!mobileHero.isEnabled && (
                    <div
                      style={{
                        marginBottom: '12px',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid #ef4444',
                        color: '#ef4444',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textAlign: 'center',
                      }}
                    >
                      ⚠ Banner currently DISABLED (Hidden on mobile)
                    </div>
                  )}

                  {/* Spotlight Banner Card (Exact Mobile Replica) */}
                  <div
                    style={{
                      borderRadius: '16px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'row',
                      gap: '12px',
                      background: previewTheme === 'dark' ? '#1e293b' : '#ffffff',
                      border: `1px solid ${previewTheme === 'dark' ? '#334155' : '#e2e8f0'}`,
                      boxShadow: previewTheme === 'dark' ? '0 8px 16px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.06)',
                      minHeight: '160px',
                      opacity: mobileHero.isEnabled ? 1 : 0.45,
                    }}
                  >
                    {/* Left Column */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        {/* Gold Badge */}
                        <div
                          style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: 'rgba(212, 175, 55, 0.15)',
                            color: '#d4af37',
                            fontSize: '9px',
                            fontWeight: 800,
                            letterSpacing: '0.5px',
                            marginBottom: '6px',
                          }}
                        >
                          {mobileHero.badge || 'FEATURED SPOTLIGHT'}
                        </div>

                        {/* Title */}
                        <div
                          style={{
                            fontSize: '15px',
                            fontWeight: 'bold',
                            lineHeight: '1.25',
                            color: previewTheme === 'dark' ? '#f8fafc' : '#0f172a',
                            marginBottom: mobileHero.subtitle ? '4px' : '0',
                          }}
                        >
                          {mobileHero.title || 'Illuminating Minds with Authentic Knowledge'}
                        </div>

                        {/* Optional Subtitle */}
                        {mobileHero.subtitle && (
                          <div
                            style={{
                              fontSize: '11px',
                              lineHeight: '1.35',
                              color: previewTheme === 'dark' ? '#94a3b8' : '#64748b',
                              marginTop: '2px',
                            }}
                          >
                            {mobileHero.subtitle}
                          </div>
                        )}
                      </div>

                      {/* Red Button */}
                      <div
                        style={{
                          marginTop: '10px',
                          alignSelf: 'flex-start',
                          padding: '6px 14px',
                          borderRadius: '6px',
                          background: '#dc2626',
                          color: '#ffffff',
                          fontSize: '11px',
                          fontWeight: 700,
                          textAlign: 'center',
                        }}
                      >
                        {mobileHero.buttonText || 'Explore Spotlight'}
                      </div>
                    </div>

                    {/* Right Column (Image) */}
                    <div
                      style={{
                        width: '74px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          heroImageFile
                            ? URL.createObjectURL(heroImageFile)
                            : mobileHero.imageUrl && mobileHero.imageUrl.trim()
                            ? mobileHero.imageUrl
                            : '/noor_logo.png'
                        }
                        alt="Spotlight"
                        style={{
                          width: '68px',
                          height: '68px',
                          borderRadius: '12px',
                          objectFit: 'contain',
                        }}
                      />
                    </div>
                  </div>

                  {/* Mock Navigation Hint */}
                  <div style={{ marginTop: '14px', fontSize: '11px', color: previewTheme === 'dark' ? '#64748b' : '#94a3b8', textAlign: 'center' }}>
                    Target Action: <strong style={{ color: 'var(--accent-gold)' }}>{mobileHero.targetUrl || '/(tabs)/explore'}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* WEB PROMOTIONAL BANNERS CAROUSEL SECTION */}
      {/* ==================================================== */}
      {activePlatform === 'web' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <div>
              <h1 className="admin-title">Manage Web Promotional Banners</h1>
              <p className="admin-subtitle" style={{ color: 'var(--text-secondary)' }}>
                Configure promotional banners and sliding cards that appear on the library web homepage.
              </p>
            </div>
            <button className="btn btn-primary" onClick={openAddModal}>Add Promotion Banner</button>
          </div>

          <div className="glass-card admin-table-container">
            <table className="admin-table">
              <thead>
                <tr className="admin-table-header">
                  <th className="admin-table-th">Preview</th>
                  <th className="admin-table-th">Banner Details</th>
                  <th className="admin-table-th">Redirection Target</th>
                  <th className="admin-table-th">Status</th>
                  <th className="admin-table-th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {banners.length === 0 ? (
                  <tr className="admin-table-header">
                    <td colSpan={5} className="admin-table-td" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                      No web banner promotions configured yet.
                    </td>
                  </tr>
                ) : (
                  banners.map((banner) => (
                    <tr key={banner.id} className="admin-table-row admin-table-header">
                      <td className="admin-table-td" style={{ width: '120px' }}>
                        <div style={{ width: '100px', height: '50px', position: 'relative', borderRadius: '4px', overflow: 'hidden', background: '#000', border: '1px solid var(--border-color)' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={banner.imageUrl} alt={banner.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      </td>
                      <td className="admin-table-td" style={{ fontWeight: 600 }}>{banner.title}</td>
                      <td className="admin-table-td-muted" style={{ fontSize: '0.85rem' }}>
                        <a href={banner.targetUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-gold)', textDecoration: 'underline' }}>
                          {banner.targetUrl}
                        </a>
                      </td>
                      <td className="admin-table-td">
                        <button
                          onClick={() => handleToggleActive(banner)}
                          style={{
                            padding: '0.25rem 0.6rem',
                            fontSize: '0.75rem',
                            borderRadius: '20px',
                            fontWeight: 600,
                            border: '1px solid transparent',
                            cursor: 'pointer',
                            background: banner.isActive ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.05)',
                            color: banner.isActive ? '#3b82f6' : 'var(--text-muted)',
                          }}
                        >
                          {banner.isActive ? '● Active' : '○ Inactive'}
                        </button>
                      </td>
                      <td className="admin-table-td admin-table-actions-cell">
                        <button onClick={() => openEditModal(banner)} className="admin-action-btn">Edit</button>
                        <button onClick={() => handleDelete(banner.id)} className="admin-action-btn-danger">Delete</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Add/Edit Web Banner Modal */}
          {isAddModalOpen && (
            <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <div className="modal-header">
                  <h2 className="modal-title">{editingBanner ? 'Edit Promotional Banner' : 'Create New Promotion'}</h2>
                  <button onClick={() => setIsAddModalOpen(false)} className="modal-close-btn">&times;</button>
                </div>

                <form onSubmit={handleWebSubmit} className="modal-form">
                  <div className="form-group">
                    <label className="form-label" htmlFor="banner-title">Promotion Title</label>
                    <input
                      id="banner-title"
                      type="text"
                      className="form-input"
                      required
                      placeholder="e.g. Ramadan Lecture Series 2026"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="banner-target">Redirection Target URL</label>
                    <input
                      id="banner-target"
                      type="text"
                      className="form-input"
                      required
                      placeholder="e.g. /courses/course_id or https://sponsor.site"
                      value={targetUrl}
                      onChange={e => setTargetUrl(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Banner Image</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <input
                        type="file"
                        accept="image/*"
                        className="form-input"
                        onChange={e => setImageFile(e.target.files ? e.target.files[0] : null)}
                      />
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>or specify URL:</span>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="https://images.unsplash.com/..."
                        value={imageUrl}
                        onChange={e => setImageUrl(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        id="banner-active"
                        type="checkbox"
                        checked={isActive}
                        onChange={e => setIsActive(e.target.checked)}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      <label htmlFor="banner-active" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>
                        Publish immediately (Show on Homepage)
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary modal-form-submit-btn"
                    disabled={isUploading || isSaving}
                    style={{
                      opacity: isUploading || isSaving ? 0.7 : 1,
                      cursor: isUploading || isSaving ? 'not-allowed' : 'pointer',
                      background: 'var(--accent-gold)',
                      border: 'none',
                    }}
                  >
                    {isUploading ? 'Uploading Image...' : isSaving ? 'Saving Banner...' : editingBanner ? 'Update Banner' : 'Create Banner'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
