'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '../../context/AppContext';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

type FeedbackCategory = 'complaint' | 'bug' | 'correction' | 'feature' | 'general';

interface CategoryOption {
  id: FeedbackCategory;
  label: string;
  icon: string;
  desc: string;
}

const CATEGORIES: CategoryOption[] = [
  {
    id: 'complaint',
    label: 'Complaint / Grievance',
    icon: '⚠️',
    desc: 'Report inappropriate behavior, copyright issue, or service grievance',
  },
  {
    id: 'bug',
    label: 'Technical Bug',
    icon: '🐛',
    desc: 'App crash, playback failure, login issue, or broken link',
  },
  {
    id: 'correction',
    label: 'Content Correction',
    icon: '📖',
    desc: 'Typo, translation error, or citation mistake in Quran, Hadith, or Books',
  },
  {
    id: 'feature',
    label: 'Feature Request',
    icon: '💡',
    desc: 'Suggest an idea, tool, or learning feature you would love to see',
  },
  {
    id: 'general',
    label: 'General Feedback',
    icon: '💬',
    desc: 'Share your overall thoughts, praise, or encouragement',
  },
];

export default function FeedbackPage() {
  const { user } = useApp();
  const searchParams = useSearchParams();

  const initialCat = (searchParams.get('category') as FeedbackCategory) || 'complaint';
  const initialSubject = searchParams.get('subject') || '';
  const initialPlatform = searchParams.get('platform') || (typeof navigator !== 'undefined' && /android|iphone|ipad/i.test(navigator.userAgent) ? 'Mobile App' : 'Web');

  const [category, setCategory] = useState<FeedbackCategory>(initialCat);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState(initialSubject);
  const [message, setMessage] = useState('');
  const [contentRef, setContentRef] = useState('');
  const [platform, setPlatform] = useState(initialPlatform);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Pre-fill user details if logged in
  useEffect(() => {
    if (user) {
      if (user.displayName) setName(user.displayName);
      if (user.email) setEmail(user.email);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address so we can reply.');
      return;
    }

    if (!subject.trim()) {
      setErrorMsg('Please provide a brief subject for your submission.');
      return;
    }

    if (!message.trim() || message.trim().length < 15) {
      setErrorMsg('Please describe your feedback or complaint in at least 15 characters.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Generate clean reference code
      const refCode = `NL-FB-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      await addDoc(collection(db, 'feedback'), {
        referenceId: refCode,
        category,
        name: name.trim() || 'Anonymous Seeker',
        email: email.trim().toLowerCase(),
        subject: subject.trim(),
        message: message.trim(),
        contentRef: contentRef.trim() || null,
        platform: platform || 'Web',
        userId: user?.uid || null,
        status: 'open',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        createdAt: serverTimestamp(),
      });

      setSubmittedRef(refCode);
    } catch (err: any) {
      console.error('Feedback submit error:', err);
      setErrorMsg(
        err?.message || 'Unable to submit your feedback due to a connection or network error. Your message has been preserved—please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyRef = async () => {
    if (!submittedRef) return;
    try {
      await navigator.clipboard.writeText(submittedRef);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleReset = () => {
    setSubmittedRef(null);
    setSubject('');
    setMessage('');
    setContentRef('');
    setCategory('complaint');
  };

  return (
    <div className="container" style={{ paddingTop: '8rem', paddingBottom: '6rem', maxWidth: '850px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <span
          style={{
            color: 'var(--accent-red)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontSize: '0.85rem',
            display: 'inline-block',
            marginBottom: '0.5rem',
          }}
        >
          Community Care & Support
        </span>
        <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '2.8rem', lineHeight: 1.15, marginBottom: '1rem', color: 'var(--text-primary)' }}>
          Feedback & <span style={{ color: 'var(--accent-red)' }}>Complaints</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '620px', margin: '0 auto', lineHeight: 1.6 }}>
          We uphold the highest standards of Islamic authenticity and digital excellence.
          Whether you have an issue, a correction, or a complaint, our team reviews every submission.
        </p>

        {/* Prophetic Hadith Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'rgba(212, 175, 55, 0.1)',
            border: '1px solid rgba(212, 175, 55, 0.3)',
            borderRadius: '999px',
            padding: '0.4rem 1.25rem',
            marginTop: '1.25rem',
            fontSize: '0.85rem',
            color: 'var(--accent-gold, #d4af37)',
          }}
        >
          <span>📜</span>
          <span>&ldquo;Religion is sincere counsel (Nasihah).&rdquo; — Sahih Muslim</span>
        </div>
      </div>

      {submittedRef ? (
        /* Submission Success Confirmation */
        <div
          className="glass-card"
          style={{
            padding: '3rem 2rem',
            textAlign: 'center',
            borderRadius: '16px',
            animation: 'fadeIn 0.3s ease',
          }}
        >
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              backgroundColor: 'rgba(34, 197, 94, 0.12)',
              color: '#22c55e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              margin: '0 auto 1.5rem',
            }}
          >
            ✓
          </div>

          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '2rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            Submission Received
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: '520px', margin: '0 auto 1.5rem', lineHeight: 1.6 }}>
            Jazakumullahu Khayran! Your {category === 'complaint' ? 'complaint' : 'feedback'} has been securely dispatched to the Noor Library administration.
          </p>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.75rem',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '0.75rem 1.25rem',
              marginBottom: '2rem',
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Ticket Reference ID
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-red)' }}>
                {submittedRef}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyRef}
              style={{
                background: 'transparent',
                border: 'none',
                color: copied ? '#22c55e' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '0.9rem',
                padding: '0.35rem 0.65rem',
                borderRadius: '6px',
              }}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleReset}
              className="btn btn-secondary"
              style={{ padding: '0.75rem 1.75rem' }}
            >
              Submit Another Response
            </button>
            <Link
              href="/"
              className="btn btn-primary"
              style={{ padding: '0.75rem 1.75rem' }}
            >
              Back to Home
            </Link>
          </div>
        </div>
      ) : (
        /* Feedback Submission Form */
        <form
          onSubmit={handleSubmit}
          className="glass-card"
          style={{
            padding: '2.5rem',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.75rem',
          }}
        >
          {errorMsg && (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                padding: '0.9rem 1.2rem',
                borderRadius: '10px',
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Category Pill Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              Select Nature of Submission *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      padding: '0.9rem 0.6rem',
                      borderRadius: '12px',
                      border: `1.5px solid ${isSelected ? 'var(--accent-red)' : 'var(--border-color)'}`,
                      background: isSelected ? 'rgba(220, 38, 38, 0.08)' : 'var(--bg-secondary)',
                      color: isSelected ? 'var(--accent-red)' : 'var(--text-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <span style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>{cat.icon}</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{cat.label}</span>
                  </button>
                );
              })}
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem', marginLeft: '0.25rem' }}>
              {CATEGORIES.find((c) => c.id === category)?.desc}
            </p>
          </div>

          {/* 2. Identity Row (Name & Email) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                Your Name (Optional)
              </label>
              <input
                type="text"
                placeholder="Abdullah / Amina"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.8rem 1rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.95rem',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                Email Address (For Follow-up) *
              </label>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.8rem 1rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.95rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* 3. Subject & Platform */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                Subject / Title *
              </label>
              <input
                type="text"
                required
                placeholder={
                  category === 'complaint'
                    ? 'e.g., Copyright dispute or payment grievance'
                    : category === 'bug'
                    ? 'e.g., Audio player crashes when device locks'
                    : category === 'correction'
                    ? 'e.g., Surah Al-Kahf verse 12 typo'
                    : 'e.g., Add offline hadith bookmarking'
                }
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.8rem 1rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.95rem',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                Platform
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.8rem 1rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.95rem',
                  outline: 'none',
                }}
              >
                <option value="Mobile App (Android)">Mobile App (Android)</option>
                <option value="Mobile App (iOS)">Mobile App (iOS)</option>
                <option value="Web Browser">Web Browser</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* 4. Optional Content Reference */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
              Content Reference / Page URL (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g., Book: Kitab at-Tawheed (Page 42) or URL"
              value={contentRef}
              onChange={(e) => setContentRef(e.target.value)}
              style={{
                width: '100%',
                padding: '0.8rem 1rem',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '0.95rem',
                outline: 'none',
              }}
            />
          </div>

          {/* 5. Message Description */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
              Detailed Description / Explanation *
            </label>
            <textarea
              required
              rows={6}
              placeholder={
                category === 'complaint'
                  ? 'Please state clearly what happened, who was involved, and how you would like us to resolve this matter...'
                  : 'Please provide full context, steps to reproduce, or exact words that need attention...'
              }
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{
                width: '100%',
                padding: '1rem',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '0.95rem',
                lineHeight: 1.6,
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Submit Action */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary"
              style={{
                padding: '0.9rem 2.5rem',
                fontSize: '1rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              {isSubmitting ? (
                <span>Submitting Securely...</span>
              ) : (
                <>
                  <span>Submit {category === 'complaint' ? 'Complaint' : 'Feedback'}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
