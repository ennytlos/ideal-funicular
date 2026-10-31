'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';

interface AudienceStats {
  totalTokens: number;
  androidCount: number;
  iosCount: number;
  webCount: number;
  totalUsers: number;
}

interface BroadcastHistoryItem {
  id: string;
  title: string;
  message: string;
  type: string;
  targetId?: string;
  senderName?: string;
  deepLink?: string;
  createdAt: number;
}

export default function BroadcastNotificationTab() {
  const { user } = useApp();
  const [testTokenInput, setTestTokenInput] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'creators' | 'societies' | 'specific'>('all');
  const [targetUid, setTargetUid] = useState('');
  const [deepLink, setDeepLink] = useState('/hadith');
  const [customDeepLink, setCustomDeepLink] = useState('');
  const [sendPush, setSendPush] = useState(true);
  const [saveInApp, setSaveInApp] = useState(true);

  // Users list for specific targeting
  const [usersList, setUsersList] = useState<Array<{ id: string; email: string; displayName?: string }>>([]);

  // Stats and History
  const [stats, setStats] = useState<AudienceStats>({
    totalTokens: 0,
    androidCount: 0,
    iosCount: 0,
    webCount: 0,
    totalUsers: 0,
  });
  const [history, setHistory] = useState<BroadcastHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<{
    success: boolean;
    sentCount: number;
    totalDevicesFound: number;
    inAppSaved: boolean;
    message: string;
  } | null>(null);

  // Fetch Stats, Broadcast History, and Real User Picker List
  const fetchStatsAndHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications/send');
      if (res.ok) {
        const data = await res.json();
        if (data.stats) setStats(data.stats);
        if (data.recentBroadcasts) setHistory(data.recentBroadcasts);
        if (data.usersList) setUsersList(data.usersList);
      }
    } catch (err) {
      console.error('Failed to fetch notification stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatsAndHistory();
  }, []);

  const handleBroadcastSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      alert('Please provide both notification title and message body.');
      return;
    }

    if (targetType === 'specific' && !targetUid) {
      alert('Please select or specify a target user UID.');
      return;
    }

    const effectiveDeepLink = deepLink === 'custom' ? customDeepLink : deepLink;
    const targetLabel =
      targetType === 'all'
        ? 'ALL registered mobile devices & users'
        : targetType === 'creators'
        ? 'all Content Creators'
        : targetType === 'societies'
        ? 'all Islamic Societies'
        : `user (${targetUid})`;

    const confirmMsg = `🚀 Dispatch broadcast notification to ${targetLabel}?\n\n• Title: "${title}"\n• Native Push: ${
      sendPush ? 'YES (Expo Push API)' : 'NO'
    }\n• In-App Alert: ${saveInApp ? 'YES (Firestore)' : 'NO'}`;

    if (!confirm(confirmMsg)) return;

    setIsBroadcasting(true);
    setDispatchResult(null);

    try {
      const res = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          message,
          targetType,
          targetUid: targetType === 'specific' ? targetUid : undefined,
          deepLink: effectiveDeepLink,
          sendPush,
          saveInApp,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to dispatch notification');
      }

      setDispatchResult({
        success: true,
        sentCount: data.sentCount ?? 0,
        totalDevicesFound: data.totalDevicesFound ?? 0,
        inAppSaved: data.inAppSaved ?? false,
        message: data.message || 'Broadcast completed successfully.',
      });

      // Clear input fields on success
      setTitle('');
      setMessage('');

      // Refresh recent history
      fetchStatsAndHistory();
    } catch (err: any) {
      alert(err.message || 'Broadcast transmission error');
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleTestSelfPush = async () => {
    const trimmedToken = testTokenInput.trim();
    if (!user?.uid && !trimmedToken) {
      alert('Please sign in with an admin account or paste an Expo Push Token below.');
      return;
    }

    const testTitle = '🧪 Test Lock Screen Push';
    const testMsg = `Test signal dispatched at ${new Date().toLocaleTimeString()}. Noor Library Push Engine is operating normally.`;

    setIsBroadcasting(true);
    try {
      const payload: Record<string, any> = {
        title: testTitle,
        message: testMsg,
        sendPush: true,
        saveInApp: false, // Don't pollute in-app history for a quick test
      };

      if (trimmedToken) {
        payload.testPushToken = trimmedToken;
      } else {
        // Target ONLY the current admin's registered device(s), NEVER 'all'
        payload.targetType = 'specific';
        payload.targetUid = user?.uid;
      }

      const res = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        if (data.sentCount > 0) {
          alert(`✓ Test Push Dispatched!\n\nDelivered to ${data.sentCount} connected admin device(s). Check your mobile lock screen.`);
        } else {
          alert(
            `⚠️ No registered device found for admin account (${user?.email || user?.uid}).\n\n` +
            `To receive test notifications:\n` +
            `1. Open the mobile app logged in as this admin to automatically register your device token.\n` +
            `2. Or paste your Expo Push Token in the input box below.`
          );
        }
      } else {
        alert(data.error || 'Test push failed');
      }
    } catch (e: any) {
      alert(e.message || 'Network error');
    } finally {
      setIsBroadcasting(false);
    }
  };

  return (
    <div className="admin-content-fade" style={{ width: '100%', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
          <span style={{ fontSize: '1.85rem' }}>📲</span>
          <h1 className="admin-title" style={{ margin: 0, fontSize: '1.85rem', fontWeight: 800 }}>
            Broadcast Push Notification Engine
          </h1>
        </div>
        <p className="admin-subtitle" style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Dispatch native OS push notifications to mobile lock screens (iOS & Android) via Expo Push API and synchronise in-app notification center alerts.
        </p>
      </div>

      {/* Audience Reach Overview Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        {/* Card 1: Registered Mobile Devices */}
        <div
          className="glass-card"
          style={{
            padding: '1.35rem',
            borderRadius: '16px',
            borderLeft: '4px solid #10b981',
            background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(255,255,255,0.02))',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
              Registered Mobile Devices
            </p>
            <span style={{ fontSize: '1.25rem' }}>📱</span>
          </div>
          <p style={{ margin: '0.4rem 0 0.15rem 0', fontSize: '1.85rem', fontWeight: 800, color: '#34d399' }}>
            {stats.totalTokens}
          </p>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Active Expo Push Tokens registered
          </span>
        </div>

        {/* Card 2: Platform Breakdown */}
        <div
          className="glass-card"
          style={{
            padding: '1.35rem',
            borderRadius: '16px',
            borderLeft: '4px solid #3b82f6',
            background: 'linear-gradient(135deg, rgba(59,130,246,0.06), rgba(255,255,255,0.02))',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
              Device Breakdown
            </p>
            <span style={{ fontSize: '1.25rem' }}>🤖</span>
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', alignItems: 'baseline' }}>
            <div>
              <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#60a5fa' }}>{stats.androidCount}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '4px' }}>Android</span>
            </div>
            <div>
              <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#a78bfa' }}>{stats.iosCount}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '4px' }}>iOS</span>
            </div>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
            Ready for background lock-screen alerts
          </span>
        </div>

        {/* Card 3: Registered Users */}
        <div
          className="glass-card"
          style={{
            padding: '1.35rem',
            borderRadius: '16px',
            borderLeft: '4px solid #f59e0b',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(255,255,255,0.02))',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
              Total Library Users
            </p>
            <span style={{ fontSize: '1.25rem' }}>👥</span>
          </div>
          <p style={{ margin: '0.4rem 0 0.15rem 0', fontSize: '1.85rem', fontWeight: 800, color: '#fbbf24' }}>
            {stats.totalUsers}
          </p>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Registered reader and creator accounts
          </span>
        </div>

        {/* Card 4: Delivery Engine */}
        <div
          className="glass-card"
          style={{
            padding: '1.35rem',
            borderRadius: '16px',
            borderLeft: '4px solid #dc2626',
            background: 'linear-gradient(135deg, rgba(220,38,38,0.06), rgba(255,255,255,0.02))',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
              Dispatch Protocol
            </p>
            <span style={{ fontSize: '1.25rem' }}>⚡</span>
          </div>
          <p style={{ margin: '0.4rem 0 0.15rem 0', fontSize: '1.35rem', fontWeight: 800, color: '#f87171' }}>
            Expo Push API
          </p>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            High priority • Sub-second delivery
          </span>
        </div>
      </div>

      {/* Dispatch Success Alert Banner */}
      {dispatchResult && (
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderRadius: '14px',
            marginBottom: '2rem',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#34d399', fontWeight: 800, fontSize: '1rem' }}>
              <span>✓</span>
              <span>Broadcast Successfully Dispatched!</span>
            </div>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Delivered lock screen push alerts to <strong>{dispatchResult.sentCount}</strong> mobile devices. Recorded in Firestore notification history.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDispatchResult(null)}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Composer + Live Mobile Mockup */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '2rem',
          marginBottom: '3rem',
        }}
      >
        {/* Composer Form Card */}
        <div className="glass-card" style={{ padding: '2rem', borderRadius: '18px' }}>
          <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Compose Broadcast Notification
          </h3>

          <form onSubmit={handleBroadcastSubmit} className="modal-form">
            {/* Title */}
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <label className="form-label" htmlFor="broadcast-title" style={{ margin: 0, fontWeight: 600 }}>
                  Notification Title
                </label>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {title.length}/60 chars
                </span>
              </div>
              <input
                id="broadcast-title"
                type="text"
                className="form-input"
                required
                maxLength={60}
                placeholder="e.g. 🌙 40 Hadith of Imam An-Nawawi Live!"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ width: '100%', borderRadius: '10px' }}
              />
            </div>

            {/* Message Body */}
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <label className="form-label" htmlFor="broadcast-message" style={{ margin: 0, fontWeight: 600 }}>
                  Notification Message Body
                </label>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {message.length}/200 chars
                </span>
              </div>
              <textarea
                id="broadcast-message"
                className="form-input"
                rows={4}
                required
                maxLength={200}
                placeholder="e.g. Explore the authentic 40 Hadith with Arabic text, English translation, narrator chains, and audio. Tap to open Hadith Haven."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                style={{ width: '100%', borderRadius: '10px', resize: 'vertical' }}
              />
            </div>

            {/* Target Audience */}
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
                Audience Target
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                {[
                  { id: 'all', label: '🌍 All Users & Devices', desc: 'Global mobile blast' },
                  { id: 'creators', label: '🎨 Content Creators', desc: 'Authors and uploader accounts' },
                  { id: 'societies', label: '🏛️ Islamic Societies', desc: 'Registered societies & mosques' },
                  { id: 'specific', label: '👤 Specific User', desc: 'Target individual account' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTargetType(opt.id as any)}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '10px',
                      textAlign: 'left',
                      border: targetType === opt.id ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.08)',
                      background: targetType === opt.id ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.03)',
                      color: targetType === opt.id ? '#34d399' : 'var(--text-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{opt.label}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{opt.desc}</div>
                  </button>
                ))}
              </div>

              {/* Audience Preview Badge */}
              <div
                style={{
                  marginTop: '0.75rem',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'rgba(212, 175, 55, 0.08)',
                  border: '1px solid rgba(212, 175, 55, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.8rem',
                  color: 'var(--accent-gold)',
                }}
              >
                <span>🎯</span>
                <span>
                  <strong>Audience Preview: </strong>
                  {targetType === 'all'
                    ? `~${stats.totalTokens} registered mobile devices across ~${stats.totalUsers} accounts`
                    : targetType === 'creators'
                    ? 'All approved content creators & authors'
                    : targetType === 'societies'
                    ? 'All registered Islamic societies & organizations'
                    : targetUid
                    ? `Single account (${targetUid})`
                    : '1 specific user (enter UID or select below)'}
                </span>
              </div>
            </div>

            {/* Specific User Selector (if targetType === 'specific') */}
            {targetType === 'specific' && (
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>
                  Target User UID or Email
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Enter User UID or select from list..."
                    value={targetUid}
                    onChange={(e) => setTargetUid(e.target.value)}
                    style={{ flex: 1, borderRadius: '8px' }}
                  />
                  {usersList.length > 0 && (
                    <select
                      className="form-input"
                      value={targetUid}
                      onChange={(e) => setTargetUid(e.target.value)}
                      style={{ maxWidth: '180px', borderRadius: '8px', cursor: 'pointer' }}
                    >
                      <option value="">Quick Select User</option>
                      {usersList.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.email}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )}

            {/* Deep Link Navigation Route */}
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>
                Action Screen / Deep Link URL (When Tapped on Mobile)
              </label>
              <select
                className="form-input"
                value={deepLink}
                onChange={(e) => setDeepLink(e.target.value)}
                style={{ width: '100%', borderRadius: '8px', cursor: 'pointer' }}
              >
                <option value="/quran">📖 Holy Quran Reader (/quran)</option>
                <option value="/books">📚 Books Library (/books)</option>
                <option value="/courses">🎓 Courses & Academics (/courses)</option>
                <option value="/series">📦 Thematic Series (/series)</option>
                <option value="/hadith">📜 Hadith Haven (/hadith)</option>
                <option value="/hisn">🛡️ Hisnul Muslim (/hisn)</option>
                <option value="/solat">🕌 Prayer Times & Qibla (/solat)</option>
                <option value="/adhkaar">📿 Daily Adhkaar & Remembrance (/adhkaar)</option>
                <option value="/reminder">⏰ Worship Alarms & Reminders (/reminder)</option>
                <option value="/societies">🏛️ Islamic Societies Directory (/societies)</option>
                <option value="/zakat">💰 Zakat Calculator (/zakat)</option>
                <option value="/account">👤 User Account & Messages (/account)</option>
                <option value="/notifications">🔔 Notification Center (/notifications)</option>
                <option value="/support">💚 Support & Donations (/support)</option>
                <option value="/">🏠 Library Home (/)</option>
                <option value="/explore">🔍 Explore Catalog (/explore)</option>
                <option value="custom">🌐 Custom Route / URL...</option>
              </select>

              {deepLink === 'custom' && (
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. /read/my-book-id or https://..."
                  value={customDeepLink}
                  onChange={(e) => setCustomDeepLink(e.target.value)}
                  style={{ width: '100%', marginTop: '0.5rem', borderRadius: '8px' }}
                />
              )}
            </div>

            {/* Delivery Channels Checklist */}
            <div
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px',
                padding: '1rem',
                marginBottom: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={sendPush}
                  onChange={(e) => setSendPush(e.target.checked)}
                  style={{ accentColor: '#10b981', width: '16px', height: '16px' }}
                />
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  📲 Dispatch Native Mobile Lock Screen Push (Expo Push API)
                </span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={saveInApp}
                  onChange={(e) => setSaveInApp(e.target.checked)}
                  style={{ accentColor: '#10b981', width: '16px', height: '16px' }}
                />
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  📥 Record in Mobile In-App Notification Center (Firestore History)
                </span>
              </label>
            </div>

            {/* Admin Self-Test Token Field */}
            <div
              style={{
                marginBottom: '1rem',
                padding: '0.85rem',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '4px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  🧪 Test Push Device Token (Admin Self-Test)
                </label>
                <span style={{ fontSize: '0.72rem', color: '#10b981' }}>
                  Target: {user?.email ? `Admin (${user.email})` : 'Pasted Token'}
                </span>
              </div>
              <input
                type="text"
                className="form-input"
                placeholder="ExponentPushToken[...] (optional — leave empty to target your logged-in admin account)"
                value={testTokenInput}
                onChange={(e) => setTestTokenInput(e.target.value)}
                style={{ width: '100%', fontSize: '0.8rem', borderRadius: '8px' }}
              />
              <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                Test pushes only reach your device. They never broadcast to subscribers or other users.
              </span>
            </div>

            {/* Audience Reach Preview */}
            <div
              style={{
                marginBottom: '1.25rem',
                padding: '0.9rem 1.15rem',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(212, 175, 55, 0.04))',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <div>
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#10b981', fontWeight: 800, display: 'block' }}>
                  Audience Reach Preview
                </span>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {targetType === 'all'
                    ? `Global Broadcast: ${sendPush ? `${stats.totalTokens} push devices (${stats.androidCount} Android, ${stats.iosCount} iOS)` : 'Push disabled'}${saveInApp ? ` + ${stats.totalUsers} registered in-app accounts` : ''}`
                    : targetType === 'specific'
                    ? `Single User Targeting: ${targetUid ? `UID ${targetUid.slice(0, 12)}...` : 'No user selected'}`
                    : `Role Segment: All ${targetType === 'creators' ? 'Creators' : 'Societies'}`}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                  Rate Limit Status
                </span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#10b981' }}>
                  ● 10-min Guard Active
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleTestSelfPush}
                disabled={isBroadcasting}
                title="Send test push only to your admin device"
                style={{
                  padding: '0.8rem 1.25rem',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: isBroadcasting ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                🧪 Send Test Push (Admin Only)
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isBroadcasting || (!sendPush && !saveInApp)}
                style={{
                  flex: 1,
                  padding: '0.8rem 1.5rem',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  cursor: isBroadcasting ? 'not-allowed' : 'pointer',
                }}
              >
                {isBroadcasting
                  ? 'Transmitting Broadcast...'
                  : `🚀 Dispatch to ${
                      targetType === 'all'
                        ? `${stats.totalTokens} Devices`
                        : targetType === 'specific'
                        ? 'Selected User'
                        : 'Selected Group'
                    }`}
              </button>
            </div>
          </form>
        </div>

        {/* Live Mobile Lock Screen Preview Mockup */}
        <div>
          <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Live Mobile Lock Screen Preview
            </h3>
            <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 600 }}>● High Priority Push</span>
          </div>

          <div
            style={{
              background: '#030712',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '24px',
              padding: '2rem 1.5rem',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
              position: 'relative',
              overflow: 'hidden',
              minHeight: '380px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            {/* Ambient Background Glow */}
            <div
              style={{
                position: 'absolute',
                top: '-50px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '240px',
                height: '140px',
                background: 'rgba(220, 38, 38, 0.15)',
                filter: 'blur(60px)',
                borderRadius: '50%',
                pointerEvents: 'none',
              }}
            />

            {/* Simulated Phone Lock Screen Header */}
            <div style={{ textAlign: 'center', marginBottom: '2rem', opacity: 0.85 }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 200, color: '#f3f4f6', letterSpacing: '-0.02em' }}>
                {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
            </div>

            {/* Notification Banner Component */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '16px',
                padding: '1rem',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.35)',
                transition: 'all 0.2s ease',
              }}
            >
              {/* Header inside banner */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '5px',
                      background: 'var(--accent-red, #dc2626)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      color: '#fff',
                    }}
                  >
                    N
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f3f4f6', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    NOOR LIBRARY
                  </span>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)' }}>now</span>
              </div>

              {/* Title inside banner */}
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#ffffff', marginBottom: '0.2rem' }}>
                {title || 'Scheduled Reminder: Read Hadith'}
              </div>

              {/* Body inside banner */}
              <div
                style={{
                  fontSize: '0.82rem',
                  color: 'rgba(255, 255, 255, 0.8)',
                  lineHeight: 1.35,
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {message ||
                  'The Prophet (ﷺ) said: "Actions are judged by intentions..." Explore 40 Hadith of Imam An-Nawawi in Noor Library today.'}
              </div>

              {/* Deep Link indicator */}
              <div style={{ marginTop: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span
                  style={{
                    fontSize: '0.7rem',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: '#34d399',
                    fontWeight: 600,
                  }}
                >
                  Opens: {deepLink === 'custom' ? customDeepLink || '/...' : deepLink}
                </span>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
              Swipe up to unlock & tap to open target page
            </div>
          </div>
        </div>
      </div>

      {/* Broadcast Sent History & Audit Log */}
      <div className="glass-card" style={{ borderRadius: '18px', overflow: 'hidden', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Broadcast Transmission History
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Audit log of system-wide notifications dispatched by Noor Library administrators.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchStatsAndHistory}
            disabled={loading}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Refreshing...' : '🔄 Refresh History'}
          </button>
        </div>

        {history.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center' }}>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              No broadcast transmissions logged yet.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Dispatched</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Title & Content</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Scope</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Deep Link</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    {/* Timestamp */}
                    <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        {item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </td>

                    {/* Content */}
                    <td style={{ padding: '0.85rem 1rem', maxWidth: '380px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>
                        {item.title}
                      </div>
                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: 'var(--text-secondary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={item.message}
                      >
                        {item.message}
                      </div>
                    </td>

                    {/* Scope */}
                    <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background:
                            item.type === 'global'
                              ? 'rgba(16, 185, 129, 0.15)'
                              : 'rgba(59, 130, 246, 0.15)',
                          color: item.type === 'global' ? '#34d399' : '#60a5fa',
                        }}
                      >
                        {item.type === 'global' ? '🌍 All Devices' : '👤 Direct / Target'}
                      </span>
                    </td>

                    {/* Deep Link */}
                    <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                      <code
                        style={{
                          fontSize: '0.75rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: 'rgba(0,0,0,0.3)',
                          color: '#e2e8f0',
                        }}
                      >
                        {item.deepLink || '/notifications'}
                      </code>
                    </td>

                    {/* Re-send clone shortcut */}
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setTitle(item.title);
                          setMessage(item.message);
                          if (item.deepLink) setDeepLink(item.deepLink);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: '1px solid rgba(255,255,255,0.1)',
                          background: 'rgba(255,255,255,0.05)',
                          color: 'var(--text-primary)',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        Clone to Composer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
